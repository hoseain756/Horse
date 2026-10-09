// Password hashing — scrypt via node:crypto (serverless-friendly, no native
// builds). Format carries the cost parameters so they can be tuned later
// without breaking old hashes:
//   scrypt$<N>$<r>$<p>$<saltB64url>$<hashB64url>
// Verification is timing-safe; a dummy verify is exported for login/register
// paths that must not leak account existence through timing.
import crypto from "crypto";

const DEFAULT_N = 16384; // 2^14 — ~50-100ms on Vercel Node runtime
const DEFAULT_R = 8;
const DEFAULT_P = 1;
const KEYLEN = 64;

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, KEYLEN, { N: DEFAULT_N, r: DEFAULT_R, p: DEFAULT_P });
  return `scrypt$${DEFAULT_N}$${DEFAULT_R}$${DEFAULT_P}$${b64url(salt)}$${b64url(hash)}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const parts = stored.split("$");
    if (parts.length !== 6 || parts[0] !== "scrypt") return false;
    const N = Number(parts[1]);
    const r = Number(parts[2]);
    const p = Number(parts[3]);
    if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
    if (N < 16384 || N > 4_194_304 || r < 8 || r > 64 || p < 1 || p > 8) return false;
    const salt = Buffer.from(parts[4], "base64url");
    const expected = Buffer.from(parts[5], "base64url");
    const actual = crypto.scryptSync(password, salt, expected.length, { N, r, p });
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

// A hash of a random string — used to equalize timing when the account does
// not exist (login) or already exists (register), so response latency does
// not reveal whether the account was found.
const DUMMY_HASH = hashPassword(crypto.randomBytes(24).toString("base64"));

export function dummyVerify(password: string): void {
  verifyPassword(password, DUMMY_HASH);
}

// Acceptance: 10–128 chars (spec), any printable characters allowed.
export function validatePassword(pw: unknown): pw is string {
  return typeof pw === "string" && pw.length >= 10 && pw.length <= 128;
}

/** Common/breached-password gate via the HIBP k-anonymity range API.
 * Sends ONLY the 5-char SHA-1 prefix (never the password or its full hash).
 * Fails OPEN on network errors so signup never breaks. */
export async function isBreachedPassword(password: string): Promise<boolean> {
  try {
    const sha1 = crypto.createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      signal: AbortSignal.timeout(6_000),
      headers: { "add-padding": "true" },
    });
    if (!res.ok) return false; // fail-open
    const body = await res.text();
    for (const line of body.split("\n")) {
      const [suf, count] = line.trim().split(":");
      if (suf === suffix && Number(count) > 0) return true;
    }
    return false;
  } catch {
    return false; // fail-open
  }
}
