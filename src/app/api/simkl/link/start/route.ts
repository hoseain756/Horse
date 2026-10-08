// Harbor Web — POST /api/simkl/link/start + GET /api/simkl/link/start
// Zero-config Simkl linking (PIN flow). Credentials from the SERVER
// environment (SIMKL_CLIENT_ID, optional SIMKL_CLIENT_SECRET). The device
// code stays server-side; the client polls with an opaque pollId.
// GET is a cheap configured-probe for the UI: never creates PINs.
import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/harbor/proxy-core";
import { SIMKL_API } from "@/lib/harbor/simkl-server";
import { putPendingLink } from "@/lib/harbor/vault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cheap probe — reports whether server-side linking is configured. */
export async function GET(): Promise<NextResponse> {
  const configured = !!process.env.SIMKL_CLIENT_ID?.trim();
  return NextResponse.json({ configured }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = clientIp(req);
  if (!rateLimit(`${ip}:simkl-link`, 10, 60_000)) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }
  const clientId = process.env.SIMKL_CLIENT_ID?.trim();
  const clientSecret = process.env.SIMKL_CLIENT_SECRET?.trim();
  if (!clientId) {
    return NextResponse.json(
      { error: "Simkl linking is not configured on this server (missing SIMKL_CLIENT_ID).", configured: false },
      { status: 501 },
    );
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    // When the app has a secret, Simkl requires client_id + client_secret as query params
    let url = `${SIMKL_API}/oauth/pin`;
    if (clientSecret) {
      const u = new URL(url);
      u.searchParams.set("client_id", clientId);
      u.searchParams.set("client_secret", clientSecret);
      url = u.toString();
    }
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "simkl-api-key": clientId,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      },
      body: JSON.stringify({ client_id: clientId, redirect: "" }),
      signal: controller.signal,
      cache: "no-store",
    });
    const data = (await res.json().catch(() => null)) as {
      result?: string;
      device_code?: string;
      user_code?: string;
      verification_url?: string;
      expires_in?: number;
      interval?: number;
    } | null;
    if (!res.ok || !data?.device_code || !data.user_code) {
      return NextResponse.json({ error: `Simkl responded ${res.status}` }, { status: 502 });
    }
    const intervalSec = Math.max(3, data.interval ?? 5);
    const pollId = putPendingLink({
      provider: "simkl",
      deviceCode: data.device_code,
      userCode: data.user_code,
      verificationUrl: data.verification_url || "https://simkl.com/pin",
      expiresAt: Date.now() + (data.expires_in ?? 600) * 1000,
      intervalSec,
      nextPollAt: 0,
      pollIntervalMs: intervalSec * 1000,
    });
    return NextResponse.json({
      pollId,
      userCode: data.user_code,
      verificationUrl: data.verification_url || "https://simkl.com/pin",
      expiresAt: Date.now() + (data.expires_in ?? 600) * 1000,
      intervalSec,
    });
  } catch (e) {
    const msg = e instanceof Error && e.message.includes("abort") ? "upstream timeout" : "simkl unreachable";
    return NextResponse.json({ error: msg }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
