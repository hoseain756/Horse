// Shared rate limiting with a DATABASE-backed fixed window (atomic upsert),
// so limits hold across ALL serverless instances. Falls back to an in-memory
// map when the DB is briefly unavailable (cold start), degrading to per-
// instance friction instead of failing requests.
//
// Atomic counter (libSQL/SQLite single-writer serialized):
//   INSERT ... ON CONFLICT(key) DO UPDATE SET count = <reset-or-increment>
// Prisma stores SQLite DateTime as INTEGER epoch-ms, so the raw SQL below
// compares/stores plain integers.
// Upgrade path if scale ever demands it: Upstash Redis (Vercel Marketplace).
import { db } from "@/lib/db";

export type RateResult = { ok: boolean; remaining: number; resetMs: number };

// In-memory fallback (per-instance).
const mem = new Map<string, { count: number; resetAt: number }>();

function memLimit(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now();
  const b = mem.get(key);
  if (!b || b.resetAt < now) {
    mem.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, resetMs: windowMs };
  }
  b.count += 1;
  return { ok: b.count <= limit, remaining: Math.max(0, limit - b.count), resetMs: b.resetAt - now };
}

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateResult> {
  try {
    const nowMs = Date.now();
    const endMs = nowMs + windowMs;
    const rows = (await db.$queryRawUnsafe<{ count: number; windowEnd: number }[]>(
      `INSERT INTO "RateLimit" ("key", "count", "windowStart", "windowEnd")
       VALUES (?1, 1, ?2, ?3)
       ON CONFLICT("key") DO UPDATE SET
         "count" = CASE WHEN "RateLimit"."windowEnd" <= ?2 THEN 1 ELSE "RateLimit"."count" + 1 END,
         "windowStart" = CASE WHEN "RateLimit"."windowEnd" <= ?2 THEN ?2 ELSE "RateLimit"."windowStart" END,
         "windowEnd" = CASE WHEN "RateLimit"."windowEnd" <= ?2 THEN ?3 ELSE "RateLimit"."windowEnd" END
       RETURNING "count", "windowEnd"`,
      key,
      nowMs,
      endMs,
    )) as { count: number; windowEnd: number }[];
    const row = rows?.[0];
    if (!row) return memLimit(key, limit, windowMs);
    const end = Number(row.windowEnd);
    return {
      ok: Number(row.count) <= limit,
      remaining: Math.max(0, limit - Number(row.count)),
      resetMs: Math.max(0, end - nowMs),
    };
  } catch {
    return memLimit(key, limit, windowMs);
  }
}

/** Login throttle: per-IP 20/15min + per-account 10/15min (progressive — the
 * account bucket keeps counting across IPs, the IP bucket across accounts). */
export async function loginThrottle(keys: { ip: string; account: string }): Promise<{ blocked: boolean; retryAfterSec: number }> {
  const ip = await rateLimit(keys.ip, 20, 15 * 60_000);
  if (!ip.ok) return { blocked: true, retryAfterSec: Math.ceil(ip.resetMs / 1000) };
  const acct = await rateLimit(keys.account, 10, 15 * 60_000);
  if (!acct.ok) return { blocked: true, retryAfterSec: Math.ceil(acct.resetMs / 1000) };
  return { blocked: false, retryAfterSec: 0 };
}

export async function rateLimitAllowed(key: string, limit: number, windowMs: number): Promise<boolean> {
  return (await rateLimit(key, limit, windowMs)).ok;
}
