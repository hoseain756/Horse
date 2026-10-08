// Harbor Web — server-side debrid relay helpers (BYO API key model)
// The browser supplies the user's own Real-Debrid / AllDebrid API key per
// request; this server only relays calls upstream. Keys are NEVER logged or
// persisted server-side.
import { NextRequest } from "next/server";
import { clientIp, rateLimit } from "@/lib/harbor/proxy-core";

export const RD_API = "https://api.real-debrid.com/rest/1.0";
export const AD_API = "https://api.alldebrid.com/v4";

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

export function formBody(fields: Record<string, string>): string {
  return new URLSearchParams(fields).toString();
}

export const FORM_HEADERS: Record<string, string> = {
  "Content-Type": "application/x-www-form-urlencoded",
  Accept: "application/json",
};
