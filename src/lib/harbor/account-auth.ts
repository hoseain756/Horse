// Harbor Web — HORSE platform account auth (server-side).
// Passwords: scrypt (node:crypto, per-user random salt, timing-safe verify).
// Sessions: stateless AES-256-GCM encrypted cookie (uid + expiry) keyed from
// HORSE_TOKEN_SECRET — same at-rest standard as the OAuth vault (vault.ts).
// The cookie is httpOnly, so the browser never sees the user id; /api/sync
// derives the acct:<uid> bucket purely server-side.
import crypto from "crypto";
import { NextRequest } from "next/server";

export const SESSION_COOKIE = "horse_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

// ---------- password hashing ----------

const SCRYPT_KEYLEN = 64;

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  return `scrypt$${b64url(salt)}$${b64url(hash)}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [scheme, saltB64, hashB64] = stored.split("$");
    if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
    const salt = Buffer.from(saltB64, "base64url");
    const expected = Buffer.from(hashB64, "base64url");
    const actual = crypto.scryptSync(password, salt, expected.length);
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

// ---------- session cookie (AES-256-GCM) ----------

let cachedKey: Buffer | null = null;

function sessionKey(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = process.env.HORSE_TOKEN_SECRET?.trim() || "harbor-dev-fallback-secret";
  cachedKey = crypto.createHash("sha256").update(`${secret}:auth-session:v1`).digest();
  return cachedKey;
}

export function createSessionCookieValue(userId: string): string {
  const payload = JSON.stringify({ uid: userId, exp: Date.now() + SESSION_TTL_SECONDS * 1000 });
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", sessionKey(), iv);
  const enc = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${b64url(iv)}.${b64url(tag)}.${b64url(enc)}`;
}

export function readSessionCookieValue(value: string | undefined | null): string | null {
  if (!value) return null;
  try {
    const [ivB, tagB, dataB] = value.split(".");
    if (!ivB || !tagB || !dataB) return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", sessionKey(), Buffer.from(ivB, "base64url"));
    decipher.setAuthTag(Buffer.from(tagB, "base64url"));
    const dec = Buffer.concat([decipher.update(Buffer.from(dataB, "base64url")), decipher.final()]).toString("utf8");
    const parsed = JSON.parse(dec) as { uid?: unknown; exp?: unknown };
    if (typeof parsed.uid !== "string" || typeof parsed.exp !== "number") return null;
    if (parsed.exp < Date.now()) return null;
    return parsed.uid;
  } catch {
    return null;
  }
}

/** Resolve the signed-in user id from the request's session cookie (or null). */
export function sessionUid(req: NextRequest): string | null {
  return readSessionCookieValue(req.cookies.get(SESSION_COOKIE)?.value);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

export function clearSessionCookieOptions() {
  return { ...sessionCookieOptions(), maxAge: 0 };
}

// ---------- validation + best-effort rate limiting ----------

export function normalizeUsername(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const u = raw.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9_.-]{2,23}$/.test(u) ? u : null;
}

export function validatePassword(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length < 8 || raw.length > 128) return null;
  return raw;
}

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/** Simple fixed-window limiter (per server instance — good-enough friction). */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  b.count += 1;
  return b.count <= limit;
}

export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "local";
}
