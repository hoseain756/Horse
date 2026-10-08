// Harbor Web — TMDB client (Feature: metadata enrichment)
// All requests go through our server proxy (/api/tmdb) — the API key never
// touches the browser. The optional user key IS stored in settings but only
// travels in a request header to our own backend (validated live in Settings).
// Every helper degrades gracefully: TMDB failure never breaks addon metadata.
"use client";

import type { Meta } from "./types";
import { useSettings } from "./store";

const ENDPOINT = "/api/tmdb";
const TIMEOUT = 10_000;

export type TmdbImageQuality = "low" | "medium" | "high";

const POSTER_SIZES: Record<TmdbImageQuality, string> = {
  low: "w185",
  medium: "w342",
  high: "w780",
};
const BACKDROP_SIZES: Record<TmdbImageQuality, string> = {
  low: "w780",
  medium: "w1280",
  high: "original",
};

export function tmdbEnabled(): boolean {
  try {
    return useSettings.getState().settings.tmdbEnabled !== false;
  } catch {
    return false;
  }
}

function authHeaders(): Record<string, string> {
  const s = useSettings.getState().settings;
  const h: Record<string, string> = {};
  if (s.tmdbUserKey) h["x-tmdb-user-key"] = s.tmdbUserKey;
  if (s.tmdbLanguage) h["x-tmdb-lang"] = s.tmdbLanguage;
  if (s.region) h["x-tmdb-region"] = s.region;
  return h;
}

// Small client-side TTL cache (dedupes rapid re-renders / shared rows)
const mem = new Map<string, { body: unknown; at: number }>();
function memKey(path: string, params: Record<string, string>): string {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return `${path}?${sorted}`;
}

export class TmdbUnavailableError extends Error {}

export async function tmdbGet<T>(path: string, params: Record<string, string> = {}, ttlMs = 60_000): Promise<T> {
  if (!tmdbEnabled()) throw new TmdbUnavailableError("TMDB disabled in settings");
  const key = memKey(path, params);
  const hit = mem.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.body as T;
  const qs = new URLSearchParams({ path, ...params }).toString();
  const res = await fetch(`${ENDPOINT}?${qs}`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) {
    let msg = `tmdb ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) msg = body.error;
    } catch {
      /* keep default */
    }
    throw new TmdbUnavailableError(msg);
  }
  const body = (await res.json()) as T;
  mem.set(key, { body, at: Date.now() });
  if (mem.size > 600) mem.delete(mem.keys().next().value as string);
  return body;
}

// ---------- image helpers ----------

export function tmdbImg(path: string | null | undefined, kind: "poster" | "backdrop" | "profile" | "logo" = "poster"): string | undefined {
  if (!path) return undefined;
  const s = useSettings.getState().settings;
  const q = (s.tmdbImageQuality ?? "medium") as TmdbImageQuality;
  const size = kind === "poster" ? POSTER_SIZES[q] : kind === "backdrop" ? BACKDROP_SIZES[q] : kind === "profile" ? "w185" : "w500";
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

// ---------- multi search (floating search integration) ----------

export type TmdbMultiHit = {
  id: number;
  name: string;
  media_type: "movie" | "tv" | "person";
  profile_path: string | null;
  known_for_department?: string | null;
  url: string;
};

type RawMulti = {
  results?: {
    id: number;
    media_type: string;
    name?: string;
    title?: string;
    profile_path?: string | null;
    known_for_department?: string | null;
  }[];
};

export async function tmdbMultiSearch(query: string): Promise<{ person: TmdbMultiHit[] }> {
  const data = await tmdbGet<RawMulti>("/search/multi", { query, include_adult: "false" });
  const person: TmdbMultiHit[] = [];
  for (const r of data.results ?? []) {
    if (r.media_type !== "person") continue;
    person.push({
      id: r.id,
      name: r.name ?? `Person ${r.id}`,
      media_type: "person",
      profile_path: r.profile_path ?? null,
      known_for_department: r.known_for_department ?? undefined,
      url: `https://www.themoviedb.org/person/${r.id}`,
    });
    if (person.length >= 4) break;
  }
  return { person };
}

// ---------- ID mapping (IMDb ⇄ TMDB) ----------

type FindResp = { movie_results?: { id: number }[]; tv_results?: { id: number }[] };

/**
 * Resolve an IMDb id to a TMDB id. Returns null when TMDB is disabled,
 * unconfigured, or the id is unknown — callers must always have a fallback.
 */
export async function tmdbIdFromImdb(imdbId: string, type: "movie" | "series"): Promise<number | null> {
  try {
    const data = await tmdbGet<FindResp>(`/find/${encodeURIComponent(imdbId)}`, { external_source: "imdb_id" }, 6 * 60 * 60_000);
    const list = type === "series" ? data.tv_results : data.movie_results;
    return list?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

// ---------- details enrichment ----------

export type TmdbDetails = {
  id: number;
  overview?: string | null;
  tagline?: string | null;
  runtime?: number | null;
  episode_run_time?: number[];
  vote_average?: number | null;
  vote_count?: number | null;
  release_date?: string | null;
  first_air_date?: string | null;
  genres?: { id: number; name: string }[] | null;
  images?: {
    logos?: { file_path: string; iso_639_1: string | null }[] | null;
    backdrops?: { file_path: string }[] | null;
  } | null;
  recommendations?: { results?: { id: number; title?: string; name?: string; poster_path?: string | null; vote_average?: number }[] } | null;
  production_companies?: { name: string; logo_path: string | null }[] | null;
  content_ratings?: { results?: { iso_3166_1: string; rating: string }[] } | null;
  release_dates?: { results?: { iso_3166_1: string; release_dates: { certification: string }[] }[] } | null;
  number_of_seasons?: number | null;
  seasons?: { season_number: number; name: string; episode_count?: number; poster_path?: string | null; air_date?: string | null }[] | null;
  watch?: unknown;
};

/** Full details incl. images/logos (append_to_response keeps it to one request). */
export async function tmdbDetails(type: "movie" | "series", tmdbId: number): Promise<TmdbDetails | null> {
  try {
    return await tmdbGet<TmdbDetails>(
      `/${type === "series" ? "tv" : "movie"}/${tmdbId}`,
      { append_to_response: "images,recommendations,release_dates,content_ratings,watch/providers", include_image_language: "en,null" },
      30 * 60_000,
    );
  } catch {
    return null;
  }
}

/** Best logo (prefers English, then any) rendered as an image URL. */
export function tmdbLogo(details: TmdbDetails | null): string | undefined {
  const logos = details?.images?.logos ?? [];
  if (logos.length === 0) return undefined;
  const en = logos.find((l) => l.iso_639_1 === "en") ?? logos[0];
  return tmdbImg(en.file_path, "logo");
}

/** Certification like "PG-13" (movie) / "TV-14" (series) for the US region, else first. */
export function tmdbCertification(details: TmdbDetails | null, region = "US"): string | undefined {
  if (!details) return undefined;
  const tv = details.content_ratings?.results;
  if (tv && tv.length > 0) {
    return (tv.find((r) => r.iso_3166_1 === region) ?? tv[0])?.rating ?? undefined;
  }
  const rd = details.release_dates?.results;
  if (rd && rd.length > 0) {
    const entry = rd.find((r) => r.iso_3166_1 === region) ?? rd[0];
    return entry?.release_dates?.find((d) => d.certification)?.certification || undefined;
  }
  return undefined;
}

// ---------- trending (Discover rows / search idle state) ----------

type RawTrending = { results?: { id: number; media_type?: string; title?: string; name?: string; poster_path?: string | null; backdrop_path?: string | null; vote_average?: number; release_date?: string; first_air_date?: string }[] };

/** TMDB trending mapped into the app's Meta shape (ids become `tmdb:{id}`). */
export async function tmdbTrending(window: "day" | "week" = "week", max = 14): Promise<Meta[]> {
  try {
    const data = await tmdbGet<RawTrending>(`/trending/all/${window}`, {}, 10 * 60_000);
    return (data.results ?? [])
      .filter((r) => r.media_type === "movie" || r.media_type === "tv")
      .slice(0, max)
      .map((r) => ({
        id: `tmdb:${r.id}`,
        type: r.media_type === "tv" ? "series" : "movie",
        name: r.title ?? r.name ?? "Unknown",
        poster: tmdbImg(r.poster_path, "poster"),
        background: tmdbImg(r.backdrop_path, "backdrop"),
        releaseInfo: (r.release_date ?? r.first_air_date ?? "").slice(0, 4) || undefined,
        imdbRating: r.vote_average && r.vote_average > 0 ? r.vote_average.toFixed(1) : undefined,
      }));
  } catch {
    return [];
  }
}
