// GET|POST /api/cron/maintenance — scheduled housekeeping (Vercel Cron).
// Secured by CRON_SECRET (Authorization: Bearer <secret>); also runnable
// on-demand by the operator with the same header.
//  - deletes expired sessions (sliding + absolute)
//  - deletes used/expired email tokens
//  - prunes stale rate-limit rows
//  - prunes audit rows older than 90 days
//  - refreshes Trakt/Simkl tokens expiring within 7 days (on-demand friendly)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureDb } from "@/lib/ensure-db";
import { decryptSecret, encryptSecret } from "@/lib/harbor/vault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false; // no secret configured → endpoint disabled
  const header = req.headers.get("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (bearer.length === secret.length && bearer.length > 0) {
    // length-equal, constant-time-ish compare
    let diff = 0;
    for (let i = 0; i < secret.length; i++) diff |= bearer.charCodeAt(i) ^ secret.charCodeAt(i);
    return diff === 0;
  }
  return false;
}

async function refreshDueTokens(): Promise<{ refreshed: number; failed: number }> {
  const due = await db.linkedAccount.findMany({
    where: { provider: { in: ["trakt", "simkl"] } },
  });
  let refreshed = 0;
  let failed = 0;
  const horizon = Date.now() + 7 * 86_400_000;
  for (const link of due) {
    if (!link.refreshTokenEnc || !link.expiresAt) continue;
    if (link.expiresAt.getTime() > horizon) continue;
    try {
      const refresh = decryptSecret(link.refreshTokenEnc, `link:${link.id}`);
      if (!refresh) continue;
      if (link.provider !== "trakt") continue; // simkl tokens are long-lived; refresh endpoint unused
      const clientId = process.env.TRAKT_CLIENT_ID?.trim();
      const clientSecret = process.env.TRAKT_CLIENT_SECRET?.trim();
      if (!clientId) continue;
      const res = await fetch("https://api.trakt.tv/oauth/token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          refresh_token: refresh,
          client_id: clientId,
          ...(clientSecret ? { client_secret: clientSecret } : {}),
          grant_type: "refresh_token",
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        failed += 1;
        continue;
      }
      const json = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
      if (!json.access_token) {
        failed += 1;
        continue;
      }
      await db.linkedAccount.update({
        where: { id: link.id },
        data: {
          accessTokenEnc: encryptSecret(json.access_token, `link:${link.id}`),
          refreshTokenEnc: json.refresh_token ? encryptSecret(json.refresh_token, `link:${link.id}`) : link.refreshTokenEnc,
          expiresAt: new Date(Date.now() + (json.expires_in ?? 7_776_000) * 1000),
        },
      });
      refreshed += 1;
    } catch {
      failed += 1;
    }
  }
  return { refreshed, failed };
}

async function run(): Promise<NextResponse> {
  await ensureDb();
  const now = new Date();
  const sessions = await db.session.deleteMany({ where: { expiresAt: { lt: now } } });
  const absolute = await db.session.deleteMany({ where: { absoluteExpiresAt: { lt: now } } });
  const tokens = await db.emailToken.deleteMany({ where: { expiresAt: { lt: now } } });
  const usedTokens = await db.emailToken.deleteMany({ where: { usedAt: { not: null, lt: new Date(now.getTime() - 86_400_000) } } });
  const limits = await db.rateLimit.deleteMany({ where: { windowEnd: { lt: now } } });
  const audits = await db.auditLog.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 90 * 86_400_000) } } });
  const refresh = await refreshDueTokens();
  return NextResponse.json({
    ok: true,
    at: now.toISOString(),
    expiredSessions: sessions.count + absolute.count,
    emailTokens: tokens.count + usedTokens.count,
    rateLimitRows: limits.count,
    auditRowsPruned: audits.count,
    tokenRefresh: refresh,
  });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return await run();
  } catch (e) {
    console.error("cron maintenance failed", e);
    return NextResponse.json({ error: "maintenance failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  return GET(req);
}
