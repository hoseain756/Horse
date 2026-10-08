// Harbor Web — token vault (Feature: zero-config account linking)
// OAuth tokens from Trakt/Simkl are stored ONLY server-side, encrypted at
// rest with AES-256-GCM. The browser never sees them — it holds an opaque
// linkId (random 128-bit, sent back on each sync API call).
//
// Key material: HARBOR_TOKEN_SECRET (recommended). When absent we derive a
// stable machine-local key from DATABASE_URL so restarts keep working in the
// sandbox; .env.example documents how to set a proper secret.
import crypto from "crypto";

let cachedKey: Buffer | null = null;

function vaultKey(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = process.env.HARBOR_TOKEN_SECRET?.trim();
  const material = secret && secret.length >= 8 ? secret : `harbor-fallback:${process.env.DATABASE_URL ?? "local"}`;
  if (!secret) {
    console.warn(
      "[harbor:vault] HARBOR_TOKEN_SECRET is not set — using a derived machine-local key. Set a strong random secret in production.",
    );
  }
  cachedKey = crypto.createHash("sha256").update(material).digest();
  return cachedKey;
}

export function encryptToken(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", vaultKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${enc.toString("base64url")}`;
}

export function decryptToken(packed: string): string | null {
  try {
    const [ivB, tagB, dataB] = packed.split(".");
    if (!ivB || !tagB || !dataB) return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", vaultKey(), Buffer.from(ivB, "base64url"));
    decipher.setAuthTag(Buffer.from(tagB, "base64url"));
    const dec = Buffer.concat([decipher.update(Buffer.from(dataB, "base64url")), decipher.final()]);
    return dec.toString("utf8");
  } catch {
    return null;
  }
}

export function randomLinkId(): string {
  return crypto.randomBytes(16).toString("base64url");
}

// ---------- pending device flows (server-side, short-lived) ----------

export type PendingLink = {
  provider: "trakt" | "simkl";
  deviceCode: string;
  userCode: string;
  verificationUrl: string;
  expiresAt: number;
  intervalSec: number;
  nextPollAt: number; // honors slow_down
  pollIntervalMs: number;
};

const PENDING_TTL = 20 * 60_000;

// Pruned lazily on access; bounded by usage (one flow per user at a time)
const pending = new Map<string, PendingLink>();

export function putPendingLink(link: PendingLink): string {
  // opportunistic prune
  const now = Date.now();
  for (const [k, v] of pending) {
    if (v.expiresAt < now) pending.delete(k);
  }
  const pollId = randomLinkId();
  pending.set(pollId, link);
  return pollId;
}

export function getPendingLink(pollId: string): PendingLink | null {
  const p = pending.get(pollId);
  if (!p) return null;
  if (p.expiresAt < Date.now()) {
    pending.delete(pollId);
    return null;
  }
  return p;
}

export function takePendingLink(pollId: string): PendingLink | null {
  const p = getPendingLink(pollId);
  if (p) pending.delete(pollId);
  return p;
}
