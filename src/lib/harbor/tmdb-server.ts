// Harbor Web — server-side TMDB API helpers (Feature: metadata enrichment)
// All TMDB traffic funnels through here so we get:
//  - secrets from env only (TMDB_ACCESS_TOKEN v4 preferred, TMDB_API_KEY v3),
//    or a caller-provided user key (validated via /api/tmdb/validate)
//  - server-side TTL cache + in-flight request deduplication
//  - rate-limit handling with Retry-After-aware retry/backoff
// Nothing in this module is exported to the client bundle.

const TMDB_BASE = "https://api.themoviedb.org/3";

export type TmdbCreds = { kind: "v4"; token: string } | { kind: "v3"; key: string } | null;

export function tmdbEnvCreds(): TmdbCreds {
  const v4 = process.env.TMDB_ACCESS_TOKEN?.trim();
  if (v4 && v4.length > 20) return { kind: "v4", token: v4 };
  const v3 = process.env.TMDB_API_KEY?.trim();
  if (v3 && v3.length >= 20) return { kind: "v3", key: v3 };
  return null;
}

/** Validate a user-supplied key: v4 read-access tokens are long JWTs (ey...), v3 keys are 32-hex. */
export function parseUserKey(raw: string): TmdbCreds {
  const v = raw.trim();
  if (v.startsWith("ey") && v.includes(".") && v.length > 40) return { kind: "v4", token: v };
  if (/^[0-9a-f]{32}$/i.test(v)) return { kind: "v3", key: v };
  // Tolerate a pasted v4 token with surrounding quotes/whitespace
  if (v.length > 60 && /^[A-Za-z0-9\-_.]+$/.test(v)) return { kind: "v4", token: v };
  return null;
}

// ---------- TTL cache + inflight dedupe ----------

type CacheEntry = { body: unknown; at: number; ttl: number };
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

function ttlForPath(path: string): number {
  // Searches/discover churn fast; details/images/watch providers are stable.
  if (path.startsWith("/search/") || path.startsWith("/discover/") || path.startsWith("/trending/")) return 5 * 60_000;
  if (path.startsWith("/find/")) return 30 * 60_000; // id mapping is immutable
  return 6 * 60 * 60_000;
}

function cacheKey(path: string, params: Record<string, string>, credsTag: string, lang: string, region: string): string {
  const sorted = Object.keys(params)
    .sort()
    .filter((k) => k !== "api_key" && k !== "language" && k !== "region")
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return `${credsTag}|${path}|${sorted}|${lang}|${region}`;
}

export function tmdbCacheStats(): { size: number } {
  return { size: cache.size };
}

export type TmdbFetchResult =
  | { ok: true; body: unknown; cached: boolean }
  | { ok: false; status: number; error: string; configured: boolean };

/**
 * Fetch a TMDB path with cache + dedupe + retry/backoff.
 * `lang`/`region` default to en/US; callers pass the user's settings.
 */
export async function tmdbFetch(
  path: string,
  params: Record<string, string>,
  opts: { creds?: TmdbCreds; lang?: string; region?: string } = {},
): Promise<TmdbFetchResult> {
  const creds = opts.creds ?? tmdbEnvCreds();
  if (!creds) {
    return {
      ok: false,
      status: 501,
      error:
        "TMDB is not configured on this server. Set TMDB_ACCESS_TOKEN (or TMDB_API_KEY) in the environment, or add your own key in Settings → Integrations.",
      configured: false,
    };
  }
  const lang = opts.lang?.trim() || "en-US";
  const region = opts.region?.trim() || "US";
  const credsTag = `${creds.kind}:${creds.kind === "v4" ? creds.token.slice(-8) : creds.key.slice(-8)}`;
  const key = cacheKey(path, params, credsTag, lang, region);

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < hit.ttl) {
    return { ok: true, body: hit.body, cached: true };
  }
  const pending = inflight.get(key);
  if (pending) {
    try {
      return { ok: true, body: await pending, cached: true };
    } catch (e) {
      return { ok: false, status: 502, error: e instanceof Error ? e.message : "tmdb failed", configured: true };
    }
  }

  const url = new URL(`${TMDB_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== "" && v !== undefined) url.searchParams.set(k, v);
  }
  url.searchParams.set("language", lang);
  if (region) url.searchParams.set("region", region);
  if (creds.kind === "v3") url.searchParams.set("api_key", creds.key);

  const run = (async (): Promise<unknown> => {
    let lastStatus = 0;
    let lastError = "tmdb request failed";
    for (let attempt = 0; attempt < 3; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12_000);
      try {
        const headers: Record<string, string> = { Accept: "application/json" };
        if (creds.kind === "v4") headers.Authorization = `Bearer ${creds.token}`;
        const res = await fetch(url.toString(), {
          method: "GET",
          headers,
          signal: controller.signal,
          cache: "no-store",
        });
        lastStatus = res.status;
        if (res.status === 429 || res.status >= 500) {
          // Rate-limited or upstream hiccup → honor Retry-After, back off
          const retryAfter = Number(res.headers.get("retry-after") ?? "");
          const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(8_000, retryAfter * 1000) : 600 * 2 ** attempt;
          lastError = res.status === 429 ? "TMDB rate limit reached" : `TMDB responded ${res.status}`;
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }
        const text = await res.text();
        let body: unknown = null;
        try {
          body = text ? JSON.parse(text) : null;
        } catch {
          return { ok: false, status: 502, error: "TMDB returned non-JSON", configured: true } as TmdbFetchResult;
        }
        if (!res.ok) {
          const errMsg =
            body && typeof body === "object" && "status_message" in (body as Record<string, unknown>)
              ? String((body as Record<string, unknown>).status_message)
              : `TMDB responded ${res.status}`;
          return { ok: false, status: res.status, error: errMsg, configured: true } as TmdbFetchResult;
        }
        cache.set(key, { body, at: Date.now(), ttl: ttlForPath(path) });
        if (cache.size > 2_000) {
          // simple sweep: drop the oldest quarter
          const keys = Array.from(cache.keys()).slice(0, 500);
          for (const k of keys) cache.delete(k);
        }
        return body;
      } catch (e) {
        lastError = e instanceof Error ? e.message : "tmdb unreachable";
        if (attempt === 2) break;
        await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
      } finally {
        clearTimeout(timer);
      }
    }
    const err = new Error(lastError) as Error & { status?: number };
    err.status = lastStatus;
    throw err;
  })();

  inflight.set(key, run);
  try {
    const body = await run;
    return { ok: true, body, cached: false };
  } catch (e) {
    return { ok: false, status: (e as { status?: number }).status ?? 502, error: e instanceof Error ? e.message : "tmdb failed", configured: true };
  } finally {
    inflight.delete(key);
  }
}

// ---------- device-pairing validation (TMDB QR / XXX-XXX linking) ----------

export class TmdbKeyError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/**
 * Validate a user-supplied TMDB credential against the live TMDB API
 * (/configuration) — the server-side proof used by the pairing claim route so
 * a waiting screen never ends up with a dead key. Throws TmdbKeyError with a
 * clear, user-safe message on any failure; resolves with the key kind.
 */
export async function validateTmdbKeyServer(raw: string): Promise<{ kind: "v3" | "v4"; imagesBase: string }> {
  const creds = parseUserKey(raw);
  if (!creds) {
    throw new TmdbKeyError(
      "That doesn't look like a TMDB key. A v3 API key is 32 hex characters; a v4 Read Access Token starts with “ey”.",
    );
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const url = new URL(`${TMDB_BASE}/configuration`);
    if (creds.kind === "v3") url.searchParams.set("api_key", creds.key);
    const res = await fetch(url.toString(), {
      headers:
        creds.kind === "v4"
          ? { Authorization: `Bearer ${creds.token}`, Accept: "application/json" }
          : { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (res.ok) {
      const body = (await res.json().catch(() => null)) as { images?: { secure_base_url?: string } } | null;
      return {
        kind: creds.kind,
        imagesBase: body?.images?.secure_base_url ?? "https://image.tmdb.org/t/p/",
      };
    }
    if (res.status === 401) throw new TmdbKeyError("TMDB rejected this key (401 unauthorized).", 401);
    throw new TmdbKeyError(`TMDB responded ${res.status}. Try again in a moment.`, 502);
  } catch (e) {
    if (e instanceof TmdbKeyError) throw e;
    throw new TmdbKeyError(
      e instanceof Error && e.message.includes("abort") ? "Validation timed out." : "Could not reach TMDB.",
      502,
    );
  } finally {
    clearTimeout(timer);
  }
}
