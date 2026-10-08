// Harbor Web — POST /api/trakt/link/start + GET /api/trakt/link/start
// Zero-config Trakt linking (activation-code flow). Credentials come from the
// SERVER environment — TRAKT_CLIENT_ID (required) and TRAKT_CLIENT_SECRET
// (OPTIONAL: new PKCE-era Trakt apps are created WITHOUT a secret; the field
// is deprecated upstream). The device_code stays server-side; the client
// polls with an opaque pollId.
// GET is a cheap configured-probe for the UI: never creates device codes.
import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/harbor/proxy-core";
import { TRAKT_API, resolveTraktClientId, envTraktClientSecret } from "@/lib/harbor/trakt-server";
import { putPendingLink } from "@/lib/harbor/vault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cheap probe — reports whether server-side linking is configured. */
export async function GET(): Promise<NextResponse> {
  const clientId = await resolveTraktClientId();
  return NextResponse.json(
    { configured: !!clientId, pkceOnly: clientId !== null && envTraktClientSecret() === null },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = clientIp(req);
  if (!rateLimit(`${ip}:trakt-link`, 10, 60_000)) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }
  const clientId = await resolveTraktClientId();
  const clientSecret = envTraktClientSecret();
  if (!clientId) {
    return NextResponse.json(
      { error: "Trakt linking is not configured on this server (missing TRAKT_CLIENT_ID).", configured: false },
      { status: 501 },
    );
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    // PKCE-only apps: omit client_secret entirely (empty string is NOT a valid omit)
    const body: Record<string, string> = { client_id: clientId };
    if (clientSecret) body.client_secret = clientSecret;
    // Device endpoints live on the API host (auth.trakt.tv 429-blocks them —
    // see the TRAKT_OAUTH note in trakt-server.ts)
    const res = await fetch(`${TRAKT_API}/oauth/device/code`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "trakt-api-version": "2",
        "trakt-api-key": clientId,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });
    const data = (await res.json().catch(() => null)) as {
      device_code?: string;
      user_code?: string;
      verification_url?: string;
      expires_in?: number;
      interval?: number;
    } | null;
    if (!res.ok || !data?.device_code || !data.user_code) {
      return NextResponse.json({ error: `Trakt responded ${res.status}` }, { status: 502 });
    }
    const intervalSec = Math.max(3, data.interval ?? 5);
    const pollId = putPendingLink({
      provider: "trakt",
      deviceCode: data.device_code,
      userCode: data.user_code,
      verificationUrl: data.verification_url || "https://trakt.tv/activate",
      expiresAt: Date.now() + (data.expires_in ?? 600) * 1000,
      intervalSec,
      nextPollAt: 0,
      pollIntervalMs: intervalSec * 1000,
    });
    return NextResponse.json({
      pollId,
      userCode: data.user_code,
      verificationUrl: data.verification_url || "https://trakt.tv/activate",
      expiresAt: Date.now() + (data.expires_in ?? 600) * 1000,
      intervalSec,
    });
  } catch (e) {
    const msg = e instanceof Error && e.message.includes("abort") ? "upstream timeout" : "trakt unreachable";
    return NextResponse.json({ error: msg }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
