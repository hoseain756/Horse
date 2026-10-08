// Harbor Web — server-side Trakt.tv API helpers (BYO credentials model)
// The user creates their own Trakt application (client id + secret) and the
// browser stores the credentials/tokens locally; this server only relays
// requests to api.trakt.tv. No secrets are persisted server-side.
import { NextRequest } from "next/server";
import { clientIp, rateLimit } from "@/lib/harbor/proxy-core";

export const TRAKT_API = "https://api.trakt.tv";
/** OAuth **web** endpoints (authorize page, token exchange, refresh, revoke).
 * NOTE — device flow endpoints (oauth/device/code + oauth/device/token) are
 * served by **api.trakt.tv** (verified live 2025: auth.trakt.tv answers
 * Cloudflare 429 with an empty body for /oauth/device/token at ANY pacing,
 * which made our poller read "slow_down" forever — the exact
 * "authorized but the app never notices" bug). Keep device calls on the API
 * host; only /oauth/token and /oauth/revoke belong on the auth host. */
export const TRAKT_OAUTH = "https://auth.trakt.tv";

export function guard(req: NextRequest): NextResponseLike | null {
  const ip = clientIp(req);
  if (!rateLimit(`${ip}:trakt`, 30, 60_000)) {
    return json({ error: "rate limited" }, 429);
  }
  return null;
}

export type NextResponseLike = { status: number; body: unknown };

export function json(body: unknown, status = 200): NextResponseLike {
  return { status, body };
}

/** Trakt client ids: legacy UUID-like (hex+dash) OR PKCE-era (43-char
 * base62 with underscores, e.g. "pk0CCmQa…_…_fUY"). Both are 32–64 chars of
 * [A-Za-z0-9_-]. */
export function validCredential(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[A-Za-z0-9_-]{32,64}$/.test(v.trim())
  );
}

/** Server env Trakt credential — client_secret is OPTIONAL for PKCE apps
 * (new Trakt apps are created without a secret; it is deprecated upstream). */
export function envTraktClientId(): string | null {
  const id = process.env.TRAKT_CLIENT_ID?.trim();
  return id ? id : null;
}
export function envTraktClientSecret(): string | null {
  const s = process.env.TRAKT_CLIENT_SECRET?.trim();
  return s ? s : null;
}

/** Client id resolution: env var first, then the DB-backed ServerConfig row
 * (survives .env resets). Async because of the DB fallback. */
export async function resolveTraktClientId(): Promise<string | null> {
  const env = envTraktClientId();
  if (env) return env;
  const { getServerConfig } = await import("./server-config");
  return getServerConfig("trakt.client_id");
}

export async function traktFetch(
  path: string,
  init: {
    method?: string;
    clientId: string;
    accessToken?: string;
    body?: unknown;
    /** OAuth endpoints (device code/token, token exchange, revoke) must hit
     * auth.trakt.tv instead of api.trakt.tv (per developer.trakt.tv). */
    oauth?: boolean;
  },
): Promise<NextResponseLike> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "trakt-api-version": "2",
      "trakt-api-key": init.clientId,
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    };
    if (init.accessToken) headers.Authorization = `Bearer ${init.accessToken}`;
    const base = init.oauth ? TRAKT_OAUTH : TRAKT_API;
    const upstream = await fetch(`${base}${path}`, {
      method: init.method ?? "POST",
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
      cache: "no-store",
    });
    const text = await upstream.text();
    let body: unknown = null;
    let parsed = false;
    try {
      body = text ? JSON.parse(text) : null;
      parsed = true;
    } catch {
      body = null;
    }
    if (!parsed) {
      // Non-JSON upstream (e.g. a Cloudflare challenge page) — report clearly
      return json(
        {
          error:
            upstream.status === 403
              ? "Trakt blocked this request (Cloudflare). If you self-host, check your server's egress IP."
              : "Trakt returned a non-JSON response",
        },
        upstream.status,
      );
    }
    return { status: upstream.status, body };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch failed";
    const isTimeout = msg.includes("abort") || msg.includes("timeout");
    return json({ error: isTimeout ? "upstream timeout" : "trakt unreachable" }, isTimeout ? 504 : 502);
  } finally {
    clearTimeout(timer);
  }
}

// ---------- watchlist normalization ----------

export type TraktWatchItem = {
  id: string;
  type: string; // movie | series
  name: string;
  year?: string;
  tmdb?: number;
};

type TraktIds = { imdb?: string; tmdb?: number; slug?: string };
type TraktEntry = {
  type?: string;
  movie?: { title?: string; year?: number; ids?: TraktIds };
  show?: { title?: string; year?: number; ids?: TraktIds };
};

/** Normalize Trakt watchlist entries (movies+shows) into app-neutral items. */
export function normalizeWatchlist(raw: unknown): TraktWatchItem[] {
  if (!Array.isArray(raw)) return [];
  const out: TraktWatchItem[] = [];
  for (const entry of raw.slice(0, 500) as TraktEntry[]) {
    const obj = entry.type === "movie" ? entry.movie : entry.type === "show" ? entry.show : null;
    if (!obj?.ids) continue;
    const imdb = obj.ids.imdb;
    const slug = obj.ids.slug;
    if (!imdb && !slug) continue;
    out.push({
      id: imdb ?? `trakt:${slug}`,
      type: entry.type === "movie" ? "movie" : "series",
      name: obj.title ?? "Unknown title",
      year: typeof obj.year === "number" && obj.year > 1900 ? String(obj.year) : undefined,
      tmdb: obj.ids.tmdb,
    });
  }
  return out;
}
