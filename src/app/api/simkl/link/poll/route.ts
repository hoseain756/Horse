// Harbor Web — POST /api/simkl/link/poll { pollId }
// Polls Simkl /oauth/pin/{code} SERVER-SIDE, stores the token encrypted in
// the vault, returns the profile + opaque linkId.
import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/harbor/proxy-core";
import { SIMKL_API } from "@/lib/harbor/simkl-server";
import { db } from "@/lib/db";
import { encryptToken, randomLinkId, getPendingLink, takePendingLink } from "@/lib/harbor/vault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
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
  const clientId = process.env.SIMKL_CLIENT_ID?.trim();
  const clientSecret = process.env.SIMKL_CLIENT_SECRET?.trim();
  if (!clientId) {
    return NextResponse.json({ error: "Simkl is not configured on this server.", configured: false }, { status: 501 });
  }

  const now = Date.now();
  if (pending.nextPollAt > now) {
    return NextResponse.json({ status: "pending", retryInMs: pending.nextPollAt - now });
  }
  pending.nextPollAt = now + pending.pollIntervalMs;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
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
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      },
      signal: controller.signal,
      cache: "no-store",
    });
    const data = (await res.json().catch(() => null)) as {
      result?: string;
      access_token?: string;
      error?: string;
      message?: string;
    } | null;

    if (res.ok && data?.access_token) {
      takePendingLink(pollId); // terminal: consume
      // Best-effort profile
      let username: string | null = null;
      let avatar: string | null = null;
      try {
        const meRes = await fetch(`${SIMKL_API}/users/settings`, {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "simkl-api-key": clientId,
            Authorization: `Bearer ${data.access_token}`,
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
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

      const linkId = randomLinkId();
      await db.linkedAccount.upsert({
        where: { provider: "simkl" },
        create: { provider: "simkl", accessTokenEnc: encryptToken(data.access_token), username, avatar },
        update: { accessTokenEnc: encryptToken(data.access_token), username, avatar },
      });
      return NextResponse.json({ status: "authorized", linkId, username, avatar });
    }

    // While pending, Simkl answers 401 with an error body.
    if (res.status === 401) {
      const errText = `${data?.error ?? ""} ${data?.message ?? ""}`.toLowerCase();
      const definitive = errText.includes("bad_verification_code") || errText.includes("expired");
      if (!definitive) {
        return NextResponse.json({ status: "pending", retryInMs: pending.pollIntervalMs });
      }
      takePendingLink(pollId);
      return NextResponse.json({ status: errText.includes("expired") ? "expired" : "denied" });
    }
    return NextResponse.json({ error: data?.message ?? data?.error ?? `Simkl responded ${res.status}` }, { status: 502 });
  } catch (e) {
    const msg = e instanceof Error && e.message.includes("abort") ? "upstream timeout" : "simkl unreachable";
    return NextResponse.json({ error: msg }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
