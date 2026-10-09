"use client";
// Horse Web — per-device LOCAL torrent engine (browser-direct).
//
// A BitTorrent engine can never run inside Vercel serverless functions, and a
// debrid subscription is not always an option. The remaining honest, free path
// is to run the engine on a machine the USER controls (their own computer):
// `npm install && npm start` inside mini-services/torrent-service, then point
// Horse at it from Settings → Integrations → P2P. The BROWSER talks to that
// engine directly:
//   • JSON calls (health/prepare/status/codec/remove/cleanup) fetch the local
//     base URL with the optional shared key (?key=).
//   • Media URLs (/stream, /remux) are handed straight to <video src>.
// https pages are allowed to load http://localhost / http://127.0.0.1 (browsers
// treat loopback as potentially trustworthy — no mixed-content block), and the
// engine answers Private-Network-Access preflights with ACPN: true.
//
// This config is deliberately DEVICE-LOCAL (localStorage, never cloud-synced):
// "my laptop's engine" is meaningless on a phone, and a synced private engine
// key would leak across devices. Remote engines stay an operator concern
// (ENGINE_URL server env) — user input can never redirect the server relay.

export type LocalEngineConfig = { base: string; key: string };

const STORE_KEY = "horse.localEngine.v1";
const listeners = new Set<() => void>();

function normalizeBase(raw: string): string | null {
  const v = (raw ?? "").trim().replace(/\/+$/, "");
  if (!v) return null;
  try {
    const u = new URL(v);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname) return null;
    return v;
  } catch {
    return null;
  }
}

/** Saved local engine for THIS device, or null. SSR-safe. */
export function getLocalEngine(): LocalEngineConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as { base?: unknown; key?: unknown };
    const base = normalizeBase(String(j.base ?? ""));
    if (!base) return null;
    const key = typeof j.key === "string" ? j.key : "";
    return key ? { base, key } : { base, key: "" };
  } catch {
    return null;
  }
}

/** Validate + persist a local engine config (returns null when invalid). */
export function setLocalEngine(base: string, key: string): LocalEngineConfig | null {
  if (typeof window === "undefined") return null;
  const b = normalizeBase(base);
  if (!b) return null;
  const cfg: LocalEngineConfig = { base: b, key: (key ?? "").trim() };
  window.localStorage.setItem(STORE_KEY, JSON.stringify(cfg));
  for (const l of listeners) l();
  return cfg;
}

export function clearLocalEngine(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORE_KEY);
  for (const l of listeners) l();
}

/** Subscribe to local-engine changes (save/remove in this tab). */
export function onLocalEngineChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/**
 * Direct browser probe of a local engine (CORS + optional ?key=).
 * /health alone can NOT detect a key mismatch — it always answers 200 to
 * unauthenticated callers (privacy-limited, load-balancer probe contract).
 * So the key is additionally validated against /status/<zero-hash>:
 * wrong key → 401, right key (or engine without a key) → 404 torrent-not-active.
 */
export function localEngineHealth(
  cfg: LocalEngineConfig,
  timeoutMs = 6_000,
): Promise<{ ok: boolean; unauthorized: boolean; transcodeEnabled: boolean }> {
  const keyQ = cfg.key ? `?key=${encodeURIComponent(cfg.key)}` : "";
  const zeroHash = "0".repeat(40);
  const probe = (path: string) =>
    fetch(`${cfg.base}${path}`, { signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
  return Promise.all([probe(`/health${keyQ}`), probe(`/status/${zeroHash}${keyQ}`)])
    .then(async ([h, s]) => {
      if (h.status === 401 || h.status === 403 || s.status === 401 || s.status === 403) {
        return { ok: false, unauthorized: true, transcodeEnabled: false };
      }
      const j = (await h.json().catch(() => ({}))) as { ok?: boolean; transcodeEnabled?: boolean };
      return { ok: h.ok && j.ok === true, unauthorized: false, transcodeEnabled: j.transcodeEnabled === true };
    })
    .catch(() => ({ ok: false, unauthorized: false, transcodeEnabled: false }));
}
