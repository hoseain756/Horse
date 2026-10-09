// Harbor Web — external torrent/stream engine configuration (SERVER-side).
import crypto from "node:crypto";
//
// The torrent engine (mini-services/torrent-service) is a long-running
// BitTorrent process: it can run in this sandbox (behind the Caddy gateway on
// port 3031) or on any self-hosted VPS/Docker box — but it can NEVER run
// inside Vercel serverless functions. ENGINE_URL lets an operator point the
// app at a self-hosted engine so torrent streams play on serverless deploys.
//
// Env contract:
//   ENGINE_URL        base URL of the self-hosted engine, e.g. https://torrent.example.com
//                     (JSON endpoints are relayed server-side; media endpoints
//                     are hit DIRECTLY by the browser, so the host must be
//                     publicly reachable — or same-domain behind a reverse proxy).
//   ENGINE_PUBLIC_URL optional public base for browser-direct media when the
//                     engine is reached through a different host internally;
//                     falls back to ENGINE_URL.
//   ENGINE_API_KEY    shared secret between the app and the engine. When set,
//                     JSON relays attach `Authorization: Bearer <key>` and
//                     browser-direct media requests carry a short-lived HMAC
//                     token (?k=<exp>.<sig>) the engine verifies with the same
//                     secret. Optional — an engine without a key must be
//                     protected at the network level.
//
// SSRF safety: the target host comes ONLY from these env vars (operator
// controlled); user input can never change the relay destination, only the
// allowlisted path.

function cleanBase(raw: string | undefined): string | null {
  const v = (raw ?? "").trim().replace(/\/+$/, "");
  if (!v) return null;
  try {
    const u = new URL(v);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (!u.hostname) return null;
    return v;
  } catch {
    return null;
  }
}

/** Configured engine base for SERVER-side relays, or null when unset/invalid. */
export function engineUrl(): string | null {
  return cleanBase(process.env.ENGINE_URL);
}

/** Public base the BROWSER uses for media (stream/remux); falls back to ENGINE_URL. */
export function enginePublicUrl(): string | null {
  return cleanBase(process.env.ENGINE_PUBLIC_URL) ?? engineUrl();
}

/** Shared secret (length-bound: opaque token, 16–200 chars). */
export function engineApiKey(): string | null {
  const v = (process.env.ENGINE_API_KEY ?? "").trim();
  return v.length >= 16 && v.length <= 200 ? v : null;
}

export type EngineMode = "external" | "builtin" | "none";

/**
 * - "external": ENGINE_URL is configured — torrent endpoints relay to it.
 * - "builtin":  no ENGINE_URL, non-Vercel runtime — the gateway routes
 *               XTransformPort=3031 to the locally running torrent-service.
 * - "none":     Vercel (VERCEL=1) without ENGINE_URL — a BitTorrent engine
 *               cannot run serverless; torrent streams are unplayable here.
 */
export function engineMode(): EngineMode {
  if (engineUrl()) return "external";
  return process.env.VERCEL ? "none" : "builtin";
}

/** Short-lived HMAC token pair for browser-direct media: "exp.sig" (hex). */
export function engineMediaToken(nowMs = Date.now(), ttlMs = 15 * 60_000): { token: string; exp: number } | null {
  const key = engineApiKey();
  const publicBase = enginePublicUrl();
  if (!key || !publicBase) return null;
  const exp = nowMs + ttlMs;
  const sig = crypto.createHmac("sha256", key).update(String(exp)).digest("hex");
  return { token: `${exp}.${sig}`, exp };
}

/** Constant-time verification of an "exp.sig" media token (engine-side protocol). */
export function verifyEngineMediaToken(token: string, key: string, nowMs = Date.now()): boolean {
  const m = /^(\d{13,16})\.([0-9a-f]{64})$/.exec(token ?? "");
  if (!m) return false;
  const exp = Number(m[1]);
  if (!Number.isFinite(exp) || exp < nowMs) return false;
  const expected = crypto.createHmac("sha256", key).update(String(exp)).digest("hex");
  const a = Buffer.from(m[2], "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
