// Harbor Web — persistent DB-backed sessions (server-side).
//
// Design (per security spec):
//  - Session token: 256-bit random opaque value, delivered in an httpOnly,
//    Secure, SameSite=Lax cookie (Path=/). In production the cookie uses the
//    __Host- prefix (no domain attribute). NEVER stored client-side readable.
//  - Storage: only sha256(token) lives in the DB (Session table) — a DB leak
//    cannot be replayed as cookies.
//  - Sliding lifetime: 90 days, renewed on activity at most once per 24h
//    (throttled to avoid a DB write per request); hard absolute cap 180 days.
//  - Rotation: a fresh token+row is created on every login and on password
//    change/reset; other sessions are revoked there.
//  - Devices: each row = one device (UA summary, truncated UA, IP hash) so
//    Settings > Account can list and revoke individual sessions.
//  - Legacy migration: the previous stateless AES-256-GCM cookie
//    ("horse_session") is accepted and transparently upgraded to a DB session
//    on the first authenticated request.
import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readSessionCookieValue, SESSION_COOKIE as LEGACY_COOKIE } from "@/lib/harbor/account-auth";
import { clientIp, ipHash, truncateUa, uaSummary } from "./util";

export const SESSION_COOKIE = "hs_session";
export const SESSION_COOKIE_HOST = "__Host-hs_session";

export const SLIDING_DAYS = 90;
export const ABSOLUTE_DAYS = 180;
const RENEW_THROTTLE_MS = 24 * 60 * 60 * 1000;

function cookieName(): string {
  return process.env.NODE_ENV === "production" ? SESSION_COOKIE_HOST : SESSION_COOKIE;
}

function sha256hex(v: string): string {
  return crypto.createHash("sha256").update(v).digest("hex");
}

function baseCookieOptions() {
  const host = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: true, // localhost is exempt from Secure by browsers; Vercel is HTTPS
    path: "/",
    // __Host- requires no domain attribute — omitted on purpose.
    ...(host ? {} : {}),
  };
}

export type SessionRow = {
  id: string;
  uid: string;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  absoluteExpiresAt: Date;
  remember: boolean;
  /** Raw cookie token (present only when resolved from a real DB session). */
  rawToken?: string;
};

/** Create a fresh session row + set the cookie on the given response. */
export async function createSession(
  uid: string,
  req: NextRequest,
  res: NextResponse,
  opts: { remember?: boolean } = {},
): Promise<{ token: string; sessionId: string }> {
  const token = crypto.randomBytes(32).toString("base64url"); // 256-bit
  const now = new Date();
  const remember = opts.remember !== false;
  const uaRaw = truncateUa(req.headers.get("user-agent") ?? "");
  const row = await db.session.create({
    data: {
      uid,
      tokenHash: sha256hex(token),
      uaSummary: uaSummary(uaRaw),
      uaRaw: uaRaw || null,
      ipHash: ipHash(clientIp(req)),
      lastSeenAt: now,
      expiresAt: new Date(now.getTime() + SLIDING_DAYS * 86_400_000),
      absoluteExpiresAt: new Date(now.getTime() + ABSOLUTE_DAYS * 86_400_000),
      remember,
    },
    select: { id: true },
  });
  applySessionCookie(res, token, remember);
  return { token, sessionId: row.id };
}

/** Serialize the session cookie onto a response. `remember=false` → session
 * cookie (ends with the browser) while the DB row keeps its server lifetime. */
export function applySessionCookie(res: NextResponse, token: string, remember: boolean): void {
  res.cookies.set({
    ...baseCookieOptions(),
    name: cookieName(),
    value: token,
    ...(remember ? { maxAge: SLIDING_DAYS * 86_400 } : {}),
  });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set({ ...baseCookieOptions(), name: cookieName(), value: "", maxAge: 0 });
  // also clear legacy + the other name, best effort
  res.cookies.set({ ...baseCookieOptions(), name: SESSION_COOKIE, value: "", maxAge: 0 });
  res.cookies.set({ ...baseCookieOptions(), name: LEGACY_COOKIE, value: "", maxAge: 0 });
}

function readCookie(req: NextRequest): string | null {
  return (
    req.cookies.get(SESSION_COOKIE_HOST)?.value ??
    req.cookies.get(SESSION_COOKIE)?.value ??
    null
  );
}

/** Resolve the current session (row) from the request, or null.
 * Validates sliding + absolute expiry. Does NOT write. */
export async function resolveSession(req: NextRequest): Promise<SessionRow | null> {
  const token = readCookie(req);
  let row: SessionRow | null = null;
  if (token) {
    const found = await db.session.findUnique({ where: { tokenHash: sha256hex(token) } });
    if (found) {
      row = {
        id: found.id,
        uid: found.uid,
        createdAt: found.createdAt,
        lastSeenAt: found.lastSeenAt,
        expiresAt: found.expiresAt,
        absoluteExpiresAt: found.absoluteExpiresAt,
        remember: found.remember,
        rawToken: token,
      };
    }
  }
  // Legacy stateless cookie → transparent upgrade path (uid only).
  if (!row) {
    const legacyUid = readSessionCookieValue(req.cookies.get(LEGACY_COOKIE)?.value);
    if (legacyUid) {
      const user = await db.horseUser.findUnique({ where: { id: legacyUid }, select: { id: true } });
      if (user) {
        return {
          id: `legacy:${legacyUid}`,
          uid: legacyUid,
          createdAt: new Date(0),
          lastSeenAt: new Date(0),
          expiresAt: new Date(Date.now() + SLIDING_DAYS * 86_400_000),
          absoluteExpiresAt: new Date(Date.now() + ABSOLUTE_DAYS * 86_400_000),
          remember: true,
        };
      }
    }
    return null;
  }
  const now = Date.now();
  if (row.expiresAt.getTime() < now || row.absoluteExpiresAt.getTime() < now) return null;
  return row;
}

/** Convenience: current user id (for bucket scoping etc.) or null. */
export async function sessionUid(req: NextRequest): Promise<string | null> {
  const s = await resolveSession(req);
  return s ? s.uid : null;
}

/** Throttled sliding renewal — extends expiresAt at most once per 24h.
 * Returns true when the DB row was renewed (caller may refresh the cookie). */
export async function touchSession(s: SessionRow): Promise<boolean> {
  if (s.id.startsWith("legacy:")) return false; // upgraded lazily by /api/auth/me
  const now = Date.now();
  if (now - s.lastSeenAt.getTime() < RENEW_THROTTLE_MS) return false;
  const newSliding = new Date(Math.min(now + SLIDING_DAYS * 86_400_000, s.absoluteExpiresAt.getTime()));
  try {
    await db.session.update({
      where: { id: s.id },
      data: { lastSeenAt: new Date(now), expiresAt: newSliding },
    });
    return true;
  } catch {
    return false;
  }
}

export async function revokeSession(sessionId: string): Promise<void> {
  if (sessionId.startsWith("legacy:")) return;
  await db.session.deleteMany({ where: { id: sessionId } });
}

export async function revokeAllSessions(uid: string, exceptSessionId?: string): Promise<number> {
  const res = await db.session.deleteMany({
    where: { uid, ...(exceptSessionId && !exceptSessionId.startsWith("legacy:") ? { id: { not: exceptSessionId } } : {}) },
  });
  return res.count;
}
