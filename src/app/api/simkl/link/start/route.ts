// Harbor Web — POST /api/simkl/link/start + GET /api/simkl/link/start
// Zero-config Simkl linking (activation-code flow). Credentials come from the
// SERVER (SIMKL_CLIENT_ID — env first, then the DB-backed ServerConfig row;
// optional SIMKL_CLIENT_SECRET). The device code stays server-side; the
// client polls with an opaque pollId. No credential value is ever echoed.
//
// Two upstream flavors (auto-detected, recorded on the pending link):
//   • "oauth2" — current Simkl "OAuth 2.0" apps: RFC-8628 POST /oauth2/device
//   • "pin"    — legacy apps: POST /oauth/pin
// GET is a cheap configured-probe for the UI: never creates PINs.
import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/harbor/proxy-core";
import { SIMKL_API, resolveSimklClientId } from "@/lib/harbor/simkl-server";
import { putPendingLink } from "@/lib/harbor/vault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/** Cheap probe — reports whether server-side linking is configured. */
export async function GET(): Promise<NextResponse> {
  const clientId = await resolveSimklClientId();
  return NextResponse.json(
    { configured: !!clientId },
    { headers: { "Cache-Control": "no-store" } },
  );
}

type DeviceStart = {
  result?: string;
  device_code?: string;
  user_code?: string;
  verification_url?: string; // legacy /oauth/pin naming
  verification_uri?: string; // RFC-8628 /oauth2/device naming
  expires_in?: number;
  interval?: number;
  error?: string;
  message?: string;
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = clientIp(req);
  if (!rateLimit(`${ip}:simkl-link`, 10, 60_000)) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }
  const clientId = await resolveSimklClientId();
  if (!clientId) {
    return NextResponse.json(
      { error: "Simkl linking is not configured on this server (missing SIMKL_CLIENT_ID).", configured: false },
      { status: 501 },
    );
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const post = (path: string, body: Record<string, string>) =>
      fetch(`${SIMKL_API}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "simkl-api-key": clientId,
          "User-Agent": UA,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
        cache: "no-store",
      });

    // 1) Try the RFC-8628 device endpoint first (what current Simkl apps use).
    let flow: "oauth2" | "pin" = "oauth2";
    let res = await post("/oauth2/device", { client_id: clientId });
    let data = (await res.json().catch(() => null)) as DeviceStart | null;

    // 2) Legacy apps are rejected by /oauth2/device (404/405, or 400/401 with
    //    "unauthorized_client"/"invalid_client" — e.g. "This client_id is an
    //    OAuth 2.0 app"-style hints) → retry the legacy PIN endpoint, which
    //    either succeeds (legacy app) or yields the honest upstream error.
    const oauth2Rejected = !res.ok && res.status !== 429;
    if (oauth2Rejected) {
      flow = "pin";
      res = await post("/oauth/pin", { client_id: clientId, redirect: "" });
      data = (await res.json().catch(() => null)) as DeviceStart | null;
    }

    const verificationUrl = data?.verification_uri ?? data?.verification_url ?? "https://simkl.com/pin";
    if (!res.ok || !data?.device_code || !data.user_code) {
      return NextResponse.json(
        { error: data?.message ?? data?.error ?? `Simkl responded ${res.status}` },
        { status: 502 },
      );
    }
    const intervalSec = Math.max(3, data.interval ?? 5);
    const expiresAt = Date.now() + (data.expires_in ?? 600) * 1000;
    const pollId = putPendingLink({
      provider: "simkl",
      deviceCode: data.device_code,
      userCode: data.user_code,
      verificationUrl,
      expiresAt,
      intervalSec,
      nextPollAt: 0,
      pollIntervalMs: intervalSec * 1000,
      flow,
    });
    return NextResponse.json({
      pollId,
      userCode: data.user_code,
      verificationUrl,
      expiresAt,
      intervalSec,
    });
  } catch (e) {
    const msg = e instanceof Error && e.message.includes("abort") ? "upstream timeout" : "simkl unreachable";
    return NextResponse.json({ error: msg }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
