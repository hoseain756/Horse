// Harbor Web — server-side Simkl API helpers (BYO credentials model)
// The user creates their own Simkl application (client id + optional secret)
// and the browser stores the credentials/tokens locally; this server only
// relays requests to api.simkl.com. No secrets are persisted server-side.
import { NextRequest } from "next/server";
import { clientIp, rateLimit } from "@/lib/harbor/proxy-core";
import type { SimklHistoryItem } from "./simkl";

export const SIMKL_API = "https://api.simkl.com";

export function guard(req: NextRequest): NextResponseLike | null {
  const ip = clientIp(req);
  if (!rateLimit(`${ip}:simkl`, 20, 60_000)) {
    return json({ error: "rate limited" }, 429);
  }
  return null;
}

export type NextResponseLike = { status: number; body: unknown };

export function json(body: unknown, status = 200): NextResponseLike {
  return { status, body };
}

/** Simkl client ids are short alphanumeric strings (8–64 chars). */
export function validClientId(v: unknown): v is string {
  return typeof v === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(v.trim());
}

/** Simkl client secrets use the same short-alphanumeric shape. */
export function validClientSecret(v: unknown): v is string {
  return typeof v === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(v.trim());
}

export async function simklFetch(
  path: string,
  init: {
    method?: string;
    clientId: string;
    accessToken?: string;
    body?: unknown;
    /**
     * Accepted for the PIN poll route: when present, client_id + client_secret
     * are appended as query params (Simkl's contract for /oauth/pin/{code}).
     */
    clientSecret?: string;
    /** Poll mode: a 401 with an (unknown) error body means "still pending". */
    pinPoll?: boolean;
  },
): Promise<NextResponseLike> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    let url = `${SIMKL_API}${path}`;
    if (init.clientSecret) {
      const u = new URL(url);
      u.searchParams.set("client_id", init.clientId);
      u.searchParams.set("client_secret", init.clientSecret);
      url = u.toString();
    }
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "simkl-api-key": init.clientId,
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    };
    if (init.accessToken) headers.Authorization = `Bearer ${init.accessToken}`;
    const upstream = await fetch(url, {
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
      // Non-JSON upstream — report clearly, never leak upstream HTML
      return json({ error: "Simkl returned a non-JSON response" }, 502);
    }
    // 412 = error envelope, e.g. {"error":"client_id_failed","code":412,
    // "message":"Your client_id is wrong. Try another one"}
    if (upstream.status === 412 && body && typeof body === "object") {
      const env = body as { error?: unknown; message?: unknown };
      const msg =
        typeof env.message === "string" && env.message.length > 0
          ? env.message
          : typeof env.error === "string" && env.error.length > 0
            ? env.error
            : "Simkl rejected the client id";
      return json({ error: msg }, 412);
    }
    if (upstream.status === 401) {
      // PIN poll: while the user has not authorized yet Simkl answers 401 with
      // an error body — relay it verbatim so the client can treat unknown
      // errors as "pending" and only fail on definitive text.
      if (init.pinPoll) {
        if (body && typeof body === "object") return { status: 401, body };
        return json({ error: "authorization_pending" }, 401);
      }
      return json({ error: "token expired or revoked" }, 401);
    }
    return { status: upstream.status, body };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch failed";
    const isTimeout = msg.includes("abort") || msg.includes("timeout");
    return json({ error: isTimeout ? "upstream timeout" : "Simkl unreachable" }, isTimeout ? 504 : 502);
  } finally {
    clearTimeout(timer);
  }
}

// ---------- watchlist normalization ----------

export type SimklWatchItem = {
  id: string;
  type: string; // movie | series
  name: string;
  year?: string;
};

type SimklIds = { simkl?: unknown; imdb?: unknown; tmdb?: unknown; tvdb?: unknown };
type SimklListEntry = {
  ids?: SimklIds;
  title?: unknown;
  released?: unknown;
  year?: unknown;
};
type SimklListRaw = { movies?: unknown; shows?: unknown };

function pickYear(entry: SimklListEntry): string | undefined {
  if (typeof entry.year === "number" && entry.year > 1900 && entry.year < 2200) {
    return String(entry.year);
  }
  if (typeof entry.released === "string") {
    const m = /^(\d{4})/.exec(entry.released.trim());
    if (m) {
      const y = Number(m[1]);
      if (y > 1900 && y < 2200) return m[1];
    }
  }
  return undefined;
}

/**
 * Normalize a raw Simkl /sync/watchlist response ({movies:[…], shows:[…]}) into
 * app-neutral items keyed on imdb ids. Entries without an imdb id fall back to
 * `simkl:<simklId>`; entries with neither are skipped. Cap 500.
 */
export function normalizeWatchlist(raw: unknown): SimklWatchItem[] {
  const out: SimklWatchItem[] = [];
  if (typeof raw !== "object" || raw === null) return out;
  const data = raw as SimklListRaw;
  const sections: [unknown, "movie" | "series"][] = [
    [data.movies, "movie"],
    [data.shows, "series"],
  ];
  for (const [section, type] of sections) {
    if (!Array.isArray(section)) continue;
    for (const entry of section as SimklListEntry[]) {
      if (out.length >= 500) return out;
      if (typeof entry !== "object" || entry === null) continue;
      const ids = typeof entry.ids === "object" && entry.ids !== null ? entry.ids : undefined;
      if (!ids) continue;
      const imdb = typeof ids.imdb === "string" && ids.imdb.length > 0 ? ids.imdb : null;
      const simklRaw = typeof ids.simkl === "number" ? ids.simkl : typeof ids.simkl === "string" && /^\d+$/.test(ids.simkl) ? Number(ids.simkl) : null;
      const simkl = simklRaw !== null && Number.isFinite(simklRaw) ? simklRaw : null;
      if (!imdb && simkl === null) continue;
      out.push({
        id: imdb ?? `simkl:${simkl}`,
        type,
        name: typeof entry.title === "string" && entry.title.length > 0 ? entry.title : "Unknown title",
        year: pickYear(entry),
      });
    }
  }
  return out.slice(0, 500);
}

// ---------- history normalization ----------

type SimklHistoryEntry = {
  watched_at?: unknown;
  action?: unknown;
  movie?: { ids?: SimklIds; title?: unknown };
  show?: { ids?: SimklIds; title?: unknown };
  episode?: { title?: unknown; season?: unknown; number?: unknown; episode?: unknown };
};

function readId(ids: SimklIds | undefined): { imdb: string | null; simkl: number | null } {
  const imdb =
    ids && typeof ids.imdb === "string" && ids.imdb.length > 0 ? ids.imdb : null;
  const rawSimkl =
    ids && typeof ids.simkl === "number"
      ? ids.simkl
      : ids && typeof ids.simkl === "string" && /^\d+$/.test(ids.simkl)
        ? Number(ids.simkl)
        : null;
  return { imdb, simkl: rawSimkl !== null && Number.isFinite(rawSimkl) ? rawSimkl : null };
}

function readNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * Normalize a raw Simkl /sync/history response ({history:[…]}) into history
 * items. Fully defensive — an unexpected shape yields an empty array (an
 * honest "no plays found"), never a throw. Cap 250.
 */
export function normalizeHistory(raw: unknown): SimklHistoryItem[] {
  const out: SimklHistoryItem[] = [];
  if (typeof raw !== "object" || raw === null) return out;
  const history = (raw as { history?: unknown }).history;
  if (!Array.isArray(history)) return out;
  for (const entry of (history as SimklHistoryEntry[]).slice(0, 250)) {
    if (typeof entry !== "object" || entry === null) continue;
    const watchedAt =
      typeof entry.watched_at === "string" ? Date.parse(entry.watched_at) : NaN;
    const watchedAtMs = Number.isFinite(watchedAt) ? watchedAt : 0;

    if (entry.movie && typeof entry.movie === "object") {
      const { imdb, simkl } = readId(entry.movie.ids);
      if (!imdb && simkl === null) continue;
      out.push({
        id: imdb ?? `simkl:${simkl}`,
        type: "movie",
        name:
          typeof entry.movie.title === "string" && entry.movie.title.length > 0
            ? entry.movie.title
            : "Unknown title",
        watchedAt: watchedAtMs,
      });
      continue;
    }

    if (entry.show && typeof entry.show === "object") {
      const { imdb: showImdb, simkl: showSimkl } = readId(entry.show.ids);
      if (!showImdb && showSimkl === null) continue;
      const season =
        entry.episode && typeof entry.episode === "object"
          ? (readNumber(entry.episode.season) ?? readNumber(entry.episode.episode))
          : null;
      const number =
        entry.episode && typeof entry.episode === "object"
          ? readNumber(entry.episode.number)
          : null;
      const videoId =
        showImdb && season !== null && number !== null
          ? `${showImdb}:${season}:${number}`
          : undefined;
      out.push({
        id: showImdb ?? `simkl:${showSimkl}`,
        type: "series",
        name:
          typeof entry.show.title === "string" && entry.show.title.length > 0
            ? entry.show.title
            : "Unknown show",
        videoId,
        season: season ?? undefined,
        episode: number ?? undefined,
        episodeName:
          entry.episode &&
          typeof entry.episode === "object" &&
          typeof entry.episode.title === "string" &&
          entry.episode.title.length > 0
            ? entry.episode.title
            : undefined,
        watchedAt: watchedAtMs,
      });
    }
  }
  return out.slice(0, 250);
}
