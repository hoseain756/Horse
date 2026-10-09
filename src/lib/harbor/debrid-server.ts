// Harbor Web — server-side debrid relay helpers (BYO API key model)
// The browser supplies the user's own Real-Debrid / AllDebrid API key per
// request; this server only relays calls upstream. Keys are NEVER logged or
// persisted server-side.
import { NextRequest } from "next/server";
import { clientIp, rateLimit } from "@/lib/harbor/proxy-core";

export const RD_API = "https://api.real-debrid.com/rest/1.0";
export const AD_API = "https://api.alldebrid.com/v4";
export const TB_API = "https://api.torbox.app/v1/api";

export const CALL_TIMEOUT_MS = 15_000;
export const TOTAL_BUDGET_MS = 45_000;

const VIDEO_EXTS = /\.(mkv|mp4|avi|ts|m2ts|mov|webm|flv|wmv)$/i;
export { VIDEO_EXTS as VIDEO_EXT_RE };

/** infoHash must be a 40-char hex torrent info hash. */
export function validInfoHash(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-fA-F]{40}$/.test(v);
}

/** Debrid API keys are opaque tokens; bound their length only. */
export function validApiKey(v: unknown): v is string {
  return typeof v === "string" && v.length >= 10 && v.length <= 200;
}

/** 20 req/min per IP for every debrid relay route (scrobble-style chatty routes excluded). */
export function guardDebrid(req: NextRequest, bucket: string): boolean {
  return rateLimit(`${clientIp(req)}:${bucket}`, 20, 60_000);
}

export class UpstreamError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "UpstreamError";
    this.status = status;
  }
}

/**
 * Fetch with a per-call timeout; maps 429 / non-JSON / network failures onto
 * clean UpstreamErrors carrying the step name. Never includes credentials in
 * error messages.
 */
export async function fetchJson(
  url: string,
  init: RequestInit,
  step: string,
): Promise<{ status: number; data: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
    if (res.status === 429) {
      throw new UpstreamError(`${step}: rate limited upstream — retry in a minute`, 429);
    }
    const text = await res.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        throw new UpstreamError(`${step}: upstream returned a non-JSON response`, 502);
      }
    }
    return { status: res.status, data };
  } catch (e) {
    if (e instanceof UpstreamError) throw e;
    const msg = e instanceof Error ? e.message : "network error";
    const isTimeout = /abort|timeout/i.test(msg);
    throw new UpstreamError(
      `${step}: ${isTimeout ? "timed out" : "service unreachable"}`,
      isTimeout ? 504 : 502,
    );
  } finally {
    clearTimeout(timer);
  }
}

/** Returns a guard that throws a clean error once the overall budget is exhausted. */
export function makeBudget(): (step: string) => void {
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  return (step: string) => {
    if (Date.now() >= deadline) {
      throw new UpstreamError(`${step}: exceeded total time budget`, 504);
    }
  };
}

export function bearer(key: string): Record<string, string> {
  return { Authorization: `Bearer ${key}`, Accept: "application/json" };
}

/** TorBox speaks Bearer for JSON calls (token also travels as ?token= on
 *  requestdl because the resulting CDN link must stay playable standalone). */
export function torboxHeaders(key: string): Record<string, string> {
  return { ...bearer(key), "User-Agent": "HarborWeb/1.0" };
}

export function formBody(fields: Record<string, string>): string {
  return new URLSearchParams(fields).toString();
}

export const FORM_HEADERS: Record<string, string> = {
  "Content-Type": "application/x-www-form-urlencoded",
  Accept: "application/json",
};

// ---------------- Account identity lookup (user/me style) ----------------
// Shared by POST /api/debrid/user (settings validation) and the device
// pairing relay (claim validation) — both must prove a key works before it
// is trusted.

export type DebridUserResult = {
  username: string;
  premium: boolean;
  expiresAt: number | null;
  planName?: string | null;
};

async function realDebridUser(apiKey: string): Promise<DebridUserResult> {
  const r = await fetchJson(`${RD_API}/user`, { headers: bearer(apiKey) }, "Real-Debrid user");
  if (r.status === 401 || r.status === 403) {
    throw new UpstreamError("Invalid Real-Debrid API key", 401);
  }
  if (r.status !== 200) {
    throw new UpstreamError(`Real-Debrid responded ${r.status}`, 502);
  }
  const d = r.data as {
    username?: unknown;
    premium?: unknown;
    expiration?: unknown;
  };
  const username = typeof d.username === "string" && d.username.length > 0 ? d.username : null;
  if (!username) throw new UpstreamError("Real-Debrid returned no username", 502);
  // RD `premium` is the unix timestamp (seconds) of premium expiration — 0 when expired.
  const premiumUntil =
    typeof d.premium === "number" && Number.isFinite(d.premium) ? d.premium : 0;
  let expiresAt: number | null = null;
  if (typeof d.expiration === "string") {
    const parsed = Date.parse(d.expiration);
    if (Number.isFinite(parsed)) expiresAt = parsed;
  }
  if (expiresAt === null && premiumUntil > 0) expiresAt = premiumUntil * 1000;
  return { username, premium: premiumUntil > 0, expiresAt };
}

async function allDebridUser(apiKey: string): Promise<DebridUserResult> {
  const url = `${AD_API}/user?agent=harborweb&apikey=${encodeURIComponent(apiKey)}`;
  const r = await fetchJson(url, { headers: { Accept: "application/json" } }, "AllDebrid user");
  if (r.status === 401 || r.status === 403) {
    throw new UpstreamError("Invalid AllDebrid API key", 401);
  }
  if (r.status !== 200) {
    throw new UpstreamError(`AllDebrid responded ${r.status}`, 502);
  }
  const d = r.data as {
    status?: unknown;
    error?: { code?: unknown; message?: unknown };
    data?: {
      user?: {
        username?: unknown;
        isPremium?: unknown;
        premiumUntil?: unknown;
      };
    };
  };
  if (d.status !== "success") {
    const code = typeof d.error?.code === "string" ? d.error.code : "";
    const message = typeof d.error?.message === "string" ? d.error.message : "rejected by AllDebrid";
    if (/auth/i.test(code)) throw new UpstreamError("Invalid AllDebrid API key", 401);
    throw new UpstreamError(`AllDebrid: ${message}`, 502);
  }
  const user = d.data?.user;
  const username = typeof user?.username === "string" && user.username.length > 0 ? user.username : null;
  if (!username) throw new UpstreamError("AllDebrid returned no username", 502);
  const premiumUntil =
    typeof user?.premiumUntil === "number" && Number.isFinite(user.premiumUntil)
      ? user.premiumUntil
      : 0;
  const premium = user?.isPremium === true || premiumUntil * 1000 > Date.now();
  return {
    username,
    premium,
    expiresAt: premiumUntil > 0 ? premiumUntil * 1000 : null,
  };
}

// ---------------- TorBox ----------------

// TorBox `plan` is a numeric tier code (torbox.app pricing):
//   0 = Free, 1 = Essential, 2 = Pro, 3 = Standard.
function torboxPlanName(plan: number): string {
  if (plan === 1) return "Essential";
  if (plan === 2) return "Pro";
  if (plan === 3) return "Standard";
  return "Free";
}

async function torboxUser(apiKey: string): Promise<DebridUserResult> {
  const r = await fetchJson(`${TB_API}/user/me`, { headers: torboxHeaders(apiKey) }, "TorBox user");
  if (r.status === 401 || r.status === 403) {
    throw new UpstreamError("Invalid TorBox API key", 401);
  }
  if (r.status !== 200) {
    throw new UpstreamError(`TorBox responded ${r.status}`, 502);
  }
  const d = r.data as {
    success?: unknown;
    detail?: unknown;
    data?: {
      email?: unknown;
      plan?: unknown;
      is_subscribed?: unknown;
      premium_expires_at?: unknown;
    } | null;
  };
  if (d.success !== true || !d.data || typeof d.data !== "object") {
    // TorBox wraps auth failures in a 200 envelope too — read the detail.
    const detail = typeof d.detail === "string" && /auth|token|key/i.test(d.detail)
      ? "Invalid TorBox API key"
      : `TorBox: ${typeof d.detail === "string" ? d.detail : "user request rejected"}`;
    throw new UpstreamError(detail, /auth|token|key/i.test(String(d.detail)) ? 401 : 502);
  }
  const email = typeof d.data.email === "string" && d.data.email.length > 0 ? d.data.email : null;
  if (!email) throw new UpstreamError("TorBox returned no account identifier", 502);
  const plan = typeof d.data.plan === "number" && Number.isFinite(d.data.plan) ? d.data.plan : 0;
  let expiresAt: number | null = null;
  if (typeof d.data.premium_expires_at === "string") {
    const parsed = Date.parse(d.data.premium_expires_at);
    if (Number.isFinite(parsed)) expiresAt = parsed;
  }
  // A paid/trial plan (tier > 0) counts as premium while it has not expired;
  // after the trial/subscription lapses TorBox itself drops the tier back to 0.
  const premium = plan > 0 && (expiresAt === null || expiresAt > Date.now());
  return { username: email, premium, expiresAt, planName: torboxPlanName(plan) };
}

/** Validate a debrid API key against its service and return the account identity. */
export async function lookupDebridUser(
  service: "realdebrid" | "alldebrid" | "torbox",
  apiKey: string,
): Promise<DebridUserResult> {
  if (service === "realdebrid") return realDebridUser(apiKey);
  if (service === "alldebrid") return allDebridUser(apiKey);
  return torboxUser(apiKey);
}
