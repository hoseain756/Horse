// Harbor Web — POST /api/simkl/link/poll { pollId }
// Polls Simkl SERVER-SIDE, stores the token encrypted in the vault, returns
// the profile + opaque linkId. Two flavors (recorded on the pending link by
// link/start — never exposed to the client):
//   • flow:"oauth2" — RFC-8628 POST /oauth2/token (current Simkl apps)
//   • flow:"pin"    — legacy GET /oauth/pin/{code}
// Response contract (consumed by lib/harbor/linking.ts):
//   {status:"pending"|"authorized"|"expired"|"denied", slowDown?, error?}
import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/harbor/proxy-core";
import { SIMKL_API, resolveSimklClientId, envSimklClientSecret } from "@/lib/harbor/simkl-server";
import { db } from "@/lib/db";
import { ensureDb } from "@/lib/ensure-db";
import { encryptSecret, getPendingLink, takePendingLink, type PendingLink } from "@/lib/harbor/vault";
import { resolveSession } from "@/lib/harbor/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export async function POST(req: NextRequest): Promise<NextResponse> {
  await ensureDb(); // create sqlite file + tables on cold serverless instances
  const ip = clientIp(req);
  if (!rateLimit(`${ip}:simkl-poll`, 120, 60_000)) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }
  let pollId = "";
  try {
    const body = (await req.json()) as { pollId?: unknown };
    if (typeof body.pollId === "string") pollId = body.pollId;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const pending = getPendingLink(pollId);
  if (!pending || pending.provider !== "simkl") {
    return NextResponse.json({ status: "expired" });
  }
  const clientId = await resolveSimklClientId();
  if (!clientId) {
    return NextResponse.json({ error: "Simkl is not configured on this server.", configured: false }, { status: 501 });
  }

  const now = Date.now();
  if (pending.nextPollAt > now) {
    return NextResponse.json({ status: "pending", retryInMs: pending.nextPollAt - now });
  }
  pending.nextPollAt = now + pending.pollIntervalMs;

  try {
    if (pending.flow === "oauth2") {
      return await pollOauth2(req, pollId, pending, clientId);
    }
    return await pollLegacyPin(req, pollId, pending, clientId);
  } catch (e) {
    const msg = e instanceof Error && e.message.includes("abort") ? "upstream timeout" : "simkl unreachable";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

/** Shared success path: fetch the profile (best-effort) and persist the token
 * encrypted in the vault, scoped to the SIGNED-IN user (per-account links). */
async function finishAuthorized(req: NextRequest, accessToken: string, clientId: string): Promise<NextResponse> {
  const session = await resolveSession(req);
  if (!session) {
    return NextResponse.json(
      { error: "Sign in to your HORSE account to link Simkl (links are saved per account)." },
      { status: 401 },
    );
  }
  let username: string | null = null;
  let avatar: string | null = null;
  try {
    const meRes = await fetch(`${SIMKL_API}/users/settings`, {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "simkl-api-key": clientId,
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": UA,
      },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (meRes.ok) {
      const me = (await meRes.json()) as { user?: { name?: string; slug?: string; avatar?: string } };
      username = me?.user?.name ?? me?.user?.slug ?? null;
      avatar = me?.user?.avatar ?? null;
    }
  } catch {
    /* profile is cosmetic */
  }
  const row = await db.linkedAccount.upsert({
    where: { provider_ownerUid: { provider: "simkl", ownerUid: session.uid } },
    create: { ownerUid: session.uid, provider: "simkl", accessTokenEnc: "", username, avatar },
    update: { username, avatar },
  });
  const tokenEnc = encryptSecret(accessToken, `link:${row.id}`);
  await db.linkedAccount.update({ where: { id: row.id }, data: { accessTokenEnc: tokenEnc } });
  return NextResponse.json({ status: "authorized", linkId: row.id, username, avatar });
}

/** RFC-8628 device grant (current "OAuth 2.0" Simkl apps). While waiting the
 * upstream answers 400 with error=authorization_pending / slow_down. */
async function pollOauth2(req: NextRequest, pollId: string, pending: PendingLink, clientId: string): Promise<NextResponse> {
  const clientSecret = envSimklClientSecret();
  const body: Record<string, string> = {
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    device_code: pending.deviceCode,
    client_id: clientId,
  };
  if (clientSecret) body.client_secret = clientSecret;
  const res = await fetch(`${SIMKL_API}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "simkl-api-key": clientId,
      "User-Agent": UA,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => null)) as {
    access_token?: string;
    error?: string;
    error_description?: string;
    message?: string;
  } | null;

  if (res.ok && data?.access_token) {
    takePendingLink(pollId);
    return finishAuthorized(req, data.access_token, clientId);
  }
  const err = `${data?.error ?? ""} ${data?.error_description ?? ""} ${data?.message ?? ""}`.toLowerCase();
  if (err.includes("authorization_pending")) {
    return NextResponse.json({ status: "pending" });
  }
  if (err.includes("slow_down")) {
    pending.pollIntervalMs = Math.min(30_000, pending.pollIntervalMs + 5_000);
    pending.nextPollAt = Date.now() + pending.pollIntervalMs;
    return NextResponse.json({ status: "pending", slowDown: true });
  }
  if (err.includes("expired")) {
    takePendingLink(pollId);
    return NextResponse.json({ status: "expired" });
  }
  if (err.includes("access_denied") || err.includes("denied")) {
    takePendingLink(pollId);
    return NextResponse.json({ status: "denied" });
  }
  // Definitive rejection (e.g. confidential app polled without its secret) —
  // surface it honestly instead of polling forever. HTTP 200 + status:"failed"
  // is the store's terminal contract for this.
  const base = data?.error_description ?? data?.message ?? data?.error ?? `Simkl responded ${res.status}`;
  const hint =
    err.includes("invalid_client") && !clientSecret
      ? `${base} — this Simkl app needs its client secret (SIMKL_CLIENT_SECRET) on the server.`
      : base;
  takePendingLink(pollId);
  return NextResponse.json({ status: "failed", error: hint });
}

/** Legacy PIN poll: a 401 with an (unknown) error body means "still pending";
 * only definitive text (bad_verification_code/expired) terminates the flow. */
async function pollLegacyPin(req: NextRequest, pollId: string, pending: PendingLink, clientId: string): Promise<NextResponse> {
  const clientSecret = envSimklClientSecret();
  let url = `${SIMKL_API}/oauth/pin/${encodeURIComponent(pending.deviceCode)}`;
  if (clientSecret) {
    const u = new URL(url);
    u.searchParams.set("client_id", clientId);
    u.searchParams.set("client_secret", clientSecret);
    url = u.toString();
  }
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "simkl-api-key": clientId,
      "User-Agent": UA,
    },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => null)) as {
    result?: string;
    access_token?: string;
    error?: string;
    message?: string;
  } | null;

  if (res.ok && data?.access_token) {
    takePendingLink(pollId);
    return finishAuthorized(req, data.access_token, clientId);
  }
  // While pending, Simkl answers 401 with an error body.
  if (res.status === 401) {
    const errText = `${data?.error ?? ""} ${data?.message ?? ""}`.toLowerCase();
    const definitive = errText.includes("bad_verification_code") || errText.includes("expired");
    if (!definitive) {
      return NextResponse.json({ status: "pending" });
    }
    takePendingLink(pollId);
    return NextResponse.json({ status: errText.includes("expired") ? "expired" : "denied" });
  }
  return NextResponse.json({ error: data?.message ?? data?.error ?? `Simkl responded ${res.status}` }, { status: 502 });
}
