// Harbor Web — POST /api/trakt/link/poll { pollId }
// Exchanges the pending device code for tokens SERVER-SIDE (env credentials),
// stores them encrypted in the vault, and returns the profile + opaque linkId.
// States: pending (authorization_pending / slow_down) | authorized | expired |
// denied | failed. The pending entry is consumed only on terminal states.
import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/harbor/proxy-core";
import { TRAKT_API, resolveTraktClientId, envTraktClientSecret } from "@/lib/harbor/trakt-server";
import { db } from "@/lib/db";
import { ensureDb } from "@/lib/ensure-db";
import { encryptToken, randomLinkId, getPendingLink, takePendingLink } from "@/lib/harbor/vault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  await ensureDb(); // create sqlite file + tables on cold serverless instances
  const ip = clientIp(req);
  if (!rateLimit(`${ip}:trakt-poll`, 120, 60_000)) {
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
  if (!pending || pending.provider !== "trakt") {
    return NextResponse.json({ status: "expired" });
  }

  const clientId = await resolveTraktClientId();
  const clientSecret = envTraktClientSecret();
  if (!clientId) {
    return NextResponse.json({ error: "Trakt is not configured on this server.", configured: false }, { status: 501 });
  }

  // Honor slow_down pacing locally too
  const now = Date.now();
  if (pending.nextPollAt > now) {
    return NextResponse.json({ status: "pending", retryInMs: pending.nextPollAt - now });
  }
  pending.nextPollAt = now + pending.pollIntervalMs;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    // PKCE-only apps: omit client_secret entirely (it is deprecated upstream;
    // empty string is NOT a valid omit)
    const body: Record<string, string> = { code: pending.deviceCode, client_id: clientId };
    if (clientSecret) body.client_secret = clientSecret;
    // CRITICAL: device/token MUST hit api.trakt.tv. auth.trakt.tv answers
    // Cloudflare-429 (empty body) for this path at any pacing, which our old
    // code interpreted as "slow_down" → the poller looped forever and a user
    // who had ALREADY approved on trakt.tv was never detected.
    const res = await fetch(`${TRAKT_API}/oauth/device/token`, {
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
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    } | null;
    // Permanent trace for operator debugging (dev.log / production logs)
    console.log(`[harbor:trakt-poll] upstream ${res.status}${data?.error ? ` (${data.error})` : ""}`);

    // New-API status mapping (https://developer.trakt.tv — apiary docs are
    // deprecated): 400 Pending has an EMPTY body now (schema z.undefined());
    // legacy JSON {"error":"authorization_pending"} is still accepted for
    // robustness. 429 = slow_down. 410 = expired. 418 = denied. 404/409 =
    // invalid/already-used (terminal).
    if (res.ok && data?.access_token) {
      takePendingLink(pollId); // terminal: consume
      // Fetch the profile for a friendly success screen
      let username: string | null = null;
      let avatar: string | null = null;
      try {
        const meRes = await fetch(`${TRAKT_API}/users/me`, {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "trakt-api-version": "2",
            "trakt-api-key": clientId,
            Authorization: `Bearer ${data.access_token}`,
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
          },
          signal: AbortSignal.timeout(10_000),
          cache: "no-store",
        });
        if (meRes.ok) {
          const me = (await meRes.json()) as { user?: { name?: string; username?: string; avatar?: string; ids?: { slug?: string } } };
          username = me?.user?.username ?? me?.user?.ids?.slug ?? me?.user?.name ?? null;
          avatar = me?.user?.avatar ?? null;
        }
      } catch {
        /* profile is cosmetic */
      }

      const linkId = randomLinkId();
      const expiresAt = new Date(Date.now() + (data.expires_in ?? 90 * 24 * 3600) * 1000);
      await db.linkedAccount.upsert({
        where: { provider: "trakt" },
        create: {
          provider: "trakt",
          accessTokenEnc: encryptToken(data.access_token),
          refreshTokenEnc: data.refresh_token ? encryptToken(data.refresh_token) : null,
          expiresAt,
          username,
          avatar,
        },
        update: {
          accessTokenEnc: encryptToken(data.access_token),
          refreshTokenEnc: data.refresh_token ? encryptToken(data.refresh_token) : null,
          expiresAt,
          username,
          avatar,
        },
      });
      return NextResponse.json({ status: "authorized", linkId, username, avatar });
    }

    if (res.status === 400) {
      const err = data?.error;
      if (err === "slow_down") {
        pending.pollIntervalMs = Math.min(30_000, pending.pollIntervalMs + 5_000);
        pending.nextPollAt = Date.now() + pending.pollIntervalMs;
        return NextResponse.json({ status: "pending", retryInMs: pending.pollIntervalMs, slowDown: true });
      }
      if (err === "expired_token") {
        takePendingLink(pollId);
        return NextResponse.json({ status: "expired" });
      }
      if (err === "denied") {
        takePendingLink(pollId);
        return NextResponse.json({ status: "denied" });
      }
      // Pending: empty body (new API) or authorization_pending (legacy) —
      // anything else with an error field is an honest failure.
      if (!err || err === "authorization_pending") {
        return NextResponse.json({ status: "pending", retryInMs: pending.pollIntervalMs });
      }
      takePendingLink(pollId);
      return NextResponse.json({ status: "failed", error: data?.error_description ?? err });
    }
    if (res.status === 429) {
      // Polling too fast — back off locally
      pending.pollIntervalMs = Math.min(30_000, pending.pollIntervalMs + 5_000);
      pending.nextPollAt = Date.now() + pending.pollIntervalMs;
      return NextResponse.json({ status: "pending", retryInMs: pending.pollIntervalMs, slowDown: true });
    }
    if (res.status === 410) {
      takePendingLink(pollId);
      return NextResponse.json({ status: "expired" });
    }
    if (res.status === 418) {
      takePendingLink(pollId);
      return NextResponse.json({ status: "denied" });
    }
    if (res.status === 404 || res.status === 409) {
      // Invalid device code / already used — terminal
      takePendingLink(pollId);
      return NextResponse.json({ status: "expired" });
    }
    return NextResponse.json({ error: data?.error ?? `Trakt responded ${res.status}` }, { status: 502 });
  } catch (e) {
    const msg = e instanceof Error && e.message.includes("abort") ? "upstream timeout" : "trakt unreachable";
    return NextResponse.json({ error: msg }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
