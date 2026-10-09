// Harbor Web — token vault (Feature: zero-config account linking)
// OAuth tokens from Trakt/Simkl, account snapshots, and addon manifest URLs
// are stored ONLY server-side, encrypted at rest with AES-256-GCM. The
// browser never sees tokens — it holds an opaque linkId (random 128-bit).
//
// Envelope format v2 (versioned, key-id aware, rotation-ready):
//   enc:v2:<keyId>:<ivB64url>.<tagB64url>.<ctB64url>
//   - unique random 12-byte IV per record
//   - optional AAD (additional authenticated data) binds a record to its
//     owner, e.g. "<uid>:<provider>" — pass via encryptSecret/decryptSecret
//
// Key resolution (first match wins):
//   k1: ENCRYPTION_KEY   (32 bytes, base64 — preferred; .env.example documents
//       generation: `openssl rand -base64 32`)
//   k0: HORSE_TOKEN_SECRET (sha256-derived — legacy deployments)
//   dev: machine-local fallback (sandbox only, warns loudly)
//
// Rotation path: set a new ENCRYPTION_KEY under a NEW keyId, keep the old key
// registered as `HORSE_OLD_ENCRYPTION_KEY` (also base64 32B → id "k0old");
// decryptSecret resolves records by their embedded keyId and re-encrypt with
// `reencryptSecret()` lazily on next write.
import crypto from "crypto";

type KeyEntry = { id: string; key: Buffer };
let cachedKeys: KeyEntry[] | null = null;

function loadKeys(): KeyEntry[] {
  if (cachedKeys) return cachedKeys;
  const keys: KeyEntry[] = [];
  const push = (id: string, material: string | undefined, derive: (m: string) => Buffer): void => {
    if (!material) return;
    try {
      keys.push({ id, key: derive(material) });
    } catch (e) {
      console.warn(`[horse:vault] key "${id}" rejected:`, e instanceof Error ? e.message : e);
    }
  };
  // k1 — preferred dedicated encryption key (raw 32-byte base64)
  push("k1", process.env.ENCRYPTION_KEY?.trim(), (m) => {
    const raw = Buffer.from(m, "base64");
    if (raw.length !== 32) throw new Error("ENCRYPTION_KEY must be 32 bytes base64");
    return raw;
  });
  // k0 — legacy secret-derived key (kept for old rows + deployments without ENCRYPTION_KEY)
  push("k0", process.env.HORSE_TOKEN_SECRET?.trim(), (m) =>
    crypto.createHash("sha256").update(m.length >= 8 ? m : `harbor-fallback:${process.env.DATABASE_URL ?? "local"}`).digest(),
  );
  // k0old — previous secret during rotation
  push(
    "k0old",
    process.env.HORSE_OLD_TOKEN_SECRET?.trim(),
    (m) => crypto.createHash("sha256").update(m).digest(),
  );
  if (keys.length === 0) {
    console.warn(
      "[horse:vault] Neither ENCRYPTION_KEY nor HORSE_TOKEN_SECRET is set — using a derived machine-local key. Set a strong random secret in production.",
    );
    keys.push({
      id: "dev",
      key: crypto.createHash("sha256").update(`harbor-fallback:${process.env.DATABASE_URL ?? "local"}`).digest(),
    });
  }
  cachedKeys = keys;
  return keys;
}

function keyById(id: string): KeyEntry | null {
  return loadKeys().find((k) => k.id === id) ?? null;
}

function currentKey(): KeyEntry {
  return loadKeys()[0];
}

function seal(key: Buffer, keyId: string, plain: string, aad?: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  if (aad) cipher.setAAD(Buffer.from(aad, "utf8"));
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v2:${keyId}:${iv.toString("base64url")}.${tag.toString("base64url")}.${enc.toString("base64url")}`;
}

/** Encrypt to the versioned envelope with the CURRENT key. */
export function encryptSecret(plain: string, aad?: string): string {
  const k = currentKey();
  return seal(k.key, k.id, plain, aad);
}

/** Decrypt either a v2 envelope (by embedded keyId) or a legacy v1 blob
 * (`iv.tag.ct`, no AAD was used). Returns null on any failure. */
export function decryptSecret(packed: string, aad?: string): string | null {
  if (!packed) return null;
  try {
    if (packed.startsWith("enc:v2:")) {
      const rest = packed.slice("enc:v2:".length);
      const c1 = rest.indexOf(":");
      if (c1 < 0) return null;
      const keyId = rest.slice(0, c1);
      const key = keyById(keyId);
      if (!key) return null;
      const [ivB, tagB, dataB] = rest.slice(c1 + 1).split(".");
      if (!ivB || !tagB || !dataB) return null;
      const decipher = crypto.createDecipheriv("aes-256-gcm", key.key, Buffer.from(ivB, "base64url"));
      if (aad) decipher.setAAD(Buffer.from(aad, "utf8"));
      decipher.setAuthTag(Buffer.from(tagB, "base64url"));
      const dec = Buffer.concat([decipher.update(Buffer.from(dataB, "base64url")), decipher.final()]);
      return dec.toString("utf8");
    }
    // legacy v1 (HORSE_TOKEN_SECRET-derived key, no AAD)
    const legacy = keyById("k0") ?? currentKey();
    const [ivB, tagB, dataB] = packed.split(".");
    if (!ivB || !tagB || !dataB) return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", legacy.key, Buffer.from(ivB, "base64url"));
    decipher.setAuthTag(Buffer.from(tagB, "base64url"));
    const dec = Buffer.concat([decipher.update(Buffer.from(dataB, "base64url")), decipher.final()]);
    return dec.toString("utf8");
  } catch {
    return null;
  }
}

/** Decrypt and re-encrypt with the current key if the record is stale
 * (legacy v1, or encrypted under a non-current key). Returns the input
 * unchanged when already current or when decryption fails. */
export function reencryptSecret(packed: string, aad?: string): string {
  const currentId = currentKey().id;
  const m = /^enc:v2:([^:]+):/.exec(packed);
  if (m && m[1] === currentId) return packed;
  const plain = decryptSecret(packed, aad);
  if (plain === null) return packed; // undecryptable — keep as-is (rotation issue logged by caller)
  return encryptSecret(plain, aad);
}

// ---- legacy aliases (kept so existing call sites keep working) ----
export function encryptToken(plain: string): string {
  return encryptSecret(plain);
}
export function decryptToken(packed: string): string | null {
  return decryptSecret(packed);
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
  /** Simkl only: which upstream OAuth flavor minted this code. Current
   * "OAuth 2.0" Simkl apps use RFC-8628 /oauth2/*; legacy apps use /oauth/pin. */
  flow?: "oauth2" | "pin";
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
