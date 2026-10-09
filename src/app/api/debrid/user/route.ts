// Harbor Web — POST /api/debrid/user
// Validates the caller's own debrid API key and returns account info
// {username, premium, expiresAt}. The key is relayed upstream per request
// and never stored or logged server-side.
import { NextRequest, NextResponse } from "next/server";
import {
  AD_API,
  RD_API,
  TB_API,
  UpstreamError,
  bearer,
  fetchJson,
  guardDebrid,
  torboxHeaders,
  validApiKey,
} from "@/lib/harbor/debrid-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UserResult = { username: string; premium: boolean; expiresAt: number | null; planName?: string | null };

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!guardDebrid(req, "debrid-user")) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }
  let body: { service?: unknown; apiKey?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (body.service !== "realdebrid" && body.service !== "alldebrid" && body.service !== "torbox") {
    return NextResponse.json({ error: "invalid service (realdebrid | alldebrid | torbox)" }, { status: 400 });
  }
  if (!validApiKey(body.apiKey)) {
    return NextResponse.json({ error: "invalid API key (10-200 characters required)" }, { status: 400 });
  }
  const apiKey = body.apiKey;

  try {
    const result =
      body.service === "realdebrid"
        ? await realDebridUser(apiKey)
        : body.service === "alldebrid"
          ? await allDebridUser(apiKey)
          : await torboxUser(apiKey);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof UpstreamError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    const message = e instanceof Error ? e.message : "debrid service unreachable";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

async function realDebridUser(apiKey: string): Promise<UserResult> {
  const r = await fetchJson(`${RD_API}/user`, { headers: bearer(apiKey) }, "Real-Debrid user");
  if (r.status === 401 || r.status === 403) {
    throw new UpstreamError("Invalid Real-Debrid API key", 401);
  }
  if (r.status !== 200) {
    throw new UpstreamError(`Real-Debrid responded ${r.status}`, 502);
  }
  const d = r.data as {
    username?: unknown;
    premium?: unknown;
    expiration?: unknown;
  };
  const username = typeof d.username === "string" && d.username.length > 0 ? d.username : null;
  if (!username) throw new UpstreamError("Real-Debrid returned no username", 502);
  // RD `premium` is the unix timestamp (seconds) of premium expiration — 0 when expired.
  const premiumUntil =
    typeof d.premium === "number" && Number.isFinite(d.premium) ? d.premium : 0;
  let expiresAt: number | null = null;
  if (typeof d.expiration === "string") {
    const parsed = Date.parse(d.expiration);
    if (Number.isFinite(parsed)) expiresAt = parsed;
  }
  if (expiresAt === null && premiumUntil > 0) expiresAt = premiumUntil * 1000;
  return { username, premium: premiumUntil > 0, expiresAt };
}

async function allDebridUser(apiKey: string): Promise<UserResult> {
  const url = `${AD_API}/user?agent=harborweb&apikey=${encodeURIComponent(apiKey)}`;
  const r = await fetchJson(url, { headers: { Accept: "application/json" } }, "AllDebrid user");
  if (r.status === 401 || r.status === 403) {
    throw new UpstreamError("Invalid AllDebrid API key", 401);
  }
  if (r.status !== 200) {
    throw new UpstreamError(`AllDebrid responded ${r.status}`, 502);
  }
  const d = r.data as {
    status?: unknown;
    error?: { code?: unknown; message?: unknown };
    data?: {
      user?: {
        username?: unknown;
        isPremium?: unknown;
        premiumUntil?: unknown;
      };
    };
  };
  if (d.status !== "success") {
    const code = typeof d.error?.code === "string" ? d.error.code : "";
    const message = typeof d.error?.message === "string" ? d.error.message : "rejected by AllDebrid";
    if (/auth/i.test(code)) throw new UpstreamError("Invalid AllDebrid API key", 401);
    throw new UpstreamError(`AllDebrid: ${message}`, 502);
  }
  const user = d.data?.user;
  const username = typeof user?.username === "string" && user.username.length > 0 ? user.username : null;
  if (!username) throw new UpstreamError("AllDebrid returned no username", 502);
  const premiumUntil =
    typeof user?.premiumUntil === "number" && Number.isFinite(user.premiumUntil)
      ? user.premiumUntil
      : 0;
  const premium = user?.isPremium === true || premiumUntil * 1000 > Date.now();
  return {
    username,
    premium,
    expiresAt: premiumUntil > 0 ? premiumUntil * 1000 : null,
  };
}

// ---------------- TorBox ----------------

// TorBox `plan` is a numeric tier code (torbox.app pricing):
//   0 = Free, 1 = Essential, 2 = Pro, 3 = Standard.
function torboxPlanName(plan: number): string {
  if (plan === 1) return "Essential";
  if (plan === 2) return "Pro";
  if (plan === 3) return "Standard";
  return "Free";
}

async function torboxUser(apiKey: string): Promise<UserResult> {
  const r = await fetchJson(`${TB_API}/user/me`, { headers: torboxHeaders(apiKey) }, "TorBox user");
  if (r.status === 401 || r.status === 403) {
    throw new UpstreamError("Invalid TorBox API key", 401);
  }
  if (r.status !== 200) {
    throw new UpstreamError(`TorBox responded ${r.status}`, 502);
  }
  const d = r.data as {
    success?: unknown;
    detail?: unknown;
    data?: {
      email?: unknown;
      plan?: unknown;
      is_subscribed?: unknown;
      premium_expires_at?: unknown;
    } | null;
  };
  if (d.success !== true || !d.data || typeof d.data !== "object") {
    // TorBox wraps auth failures in a 200 envelope too — read the detail.
    const detail = typeof d.detail === "string" && /auth|token|key/i.test(d.detail)
      ? "Invalid TorBox API key"
      : `TorBox: ${typeof d.detail === "string" ? d.detail : "user request rejected"}`;
    throw new UpstreamError(detail, /auth|token|key/i.test(String(d.detail)) ? 401 : 502);
  }
  const email = typeof d.data.email === "string" && d.data.email.length > 0 ? d.data.email : null;
  if (!email) throw new UpstreamError("TorBox returned no account identifier", 502);
  const plan = typeof d.data.plan === "number" && Number.isFinite(d.data.plan) ? d.data.plan : 0;
  let expiresAt: number | null = null;
  if (typeof d.data.premium_expires_at === "string") {
    const parsed = Date.parse(d.data.premium_expires_at);
    if (Number.isFinite(parsed)) expiresAt = parsed;
  }
  // A paid/trial plan (tier > 0) counts as premium while it has not expired;
  // after the trial/subscription lapses TorBox itself drops the tier back to 0.
  const premium = plan > 0 && (expiresAt === null || expiresAt > Date.now());
  return { username: email, premium, expiresAt, planName: torboxPlanName(plan) };
}
