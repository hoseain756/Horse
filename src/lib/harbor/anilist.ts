// Harbor Web — AniList client (public metadata API, no auth)
// Queries are POSTed to our /api/anilist server proxy (cached 5 min).
// All media resolution back to playable Stremio IDs happens via Cinemeta search.
"use client";

import type { Meta } from "./types";
import { searchCinemeta } from "./api";

const ENDPOINT = "/api/anilist";

export type AniListMedia = {
  id: number;
  idMal?: number | null;
  title: { romaji: string | null; english: string | null; native: string | null };
  coverImage?: { extraLarge?: string | null; large?: string | null } | null;
  bannerImage?: string | null;
  description?: string | null;
  episodes?: number | null;
  duration?: number | null;
  format?: string | null; // TV | MOVIE | OVA | ONA | SPECIAL ...
  status?: string | null; // RELEASING | FINISHED | NOT_YET_RELEASED ...
  averageScore?: number | null; // 0-100
  seasonYear?: number | null;
  genres?: string[] | null;
  nextAiringEpisode?: { airingAt: number; episode: number } | null;
};

type GraphQLResponse<T> = { data?: T; errors?: { message: string }[] };

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`anilist ${res.status}`);
  const json = (await res.json()) as GraphQLResponse<T>;
  if (json.errors?.length) throw new Error(json.errors[0].message);
  if (!json.data) throw new Error("empty anilist response");
  return json.data;
}

const MEDIA_FIELDS = `
  id
  idMal
  title { romaji english native }
  coverImage { extraLarge large }
  bannerImage
  description(asHtml: false)
  episodes
  duration
  format
  status
  averageScore
  seasonYear
  genres
`;

const PAGE_QUERY = `query ($page: Int, $perPage: Int, $sort: [MediaSort], $season: MediaSeason, $seasonYear: Int, $format: MediaFormat, $isAdult: Boolean) {
  Page(page: $page, perPage: $perPage) {
    media(sort: $sort, season: $season, seasonYear: $seasonYear, format: $format, type: ANIME, isAdult: $isAdult) {
      ${MEDIA_FIELDS}
    }
  }
}`;

const SEASON_NOW_QUERY = `query ($page: Int, $perPage: Int, $sort: [MediaSort], $isAdult: Boolean) {
  Page(page: $page, perPage: $perPage) {
    media(sort: $sort, season: PREVIOUS, seasonYear: 0, type: ANIME, isAdult: $isAdult, status_in: [RELEASING]) {
      ${MEDIA_FIELDS}
      nextAiringEpisode { airingAt episode }
    }
  }
}`;

// Season-current airing (uses Page airingSchedules for a week window)
const AIRING_WEEK_QUERY = `query ($weekStart: Int, $weekEnd: Int) {
  Page(page: 1, perPage: 100) {
    airingSchedules(airingAt_greater: $weekStart, airingAt_lesser: $weekEnd, sort: TIME) {
      airingAt
      episode
      media {
        ${MEDIA_FIELDS}
      }
    }
  }
}`;

const SEARCH_QUERY = `query ($search: String) {
  Media(search: $search, type: ANIME) {
    ${MEDIA_FIELDS}
  }
}`;

export function mediaTitle(m: AniListMedia): string {
  return m.title.english ?? m.title.romaji ?? m.title.native ?? `AniList #${m.id}`;
}

export function coverOf(m: AniListMedia): string | undefined {
  return m.coverImage?.extraLarge ?? m.coverImage?.large ?? undefined;
}

function currentSeason(): { season: "WINTER" | "SPRING" | "SUMMER" | "FALL"; year: number } {
  const now = new Date();
  const month = now.getMonth(); // 0-11
  const year = now.getFullYear();
  if (month <= 1) return { season: "WINTER", year };
  if (month <= 4) return { season: "SPRING", year };
  if (month <= 7) return { season: "SUMMER", year };
  if (month <= 11) return { season: "FALL", year };
  return { season: "WINTER", year };
}

function nextSeason(): { season: "WINTER" | "SPRING" | "SUMMER" | "FALL"; year: number } {
  const { season, year } = currentSeason();
  const order = ["WINTER", "SPRING", "SUMMER", "FALL"] as const;
  const idx = order.indexOf(season);
  return idx === 3 ? { season: "WINTER", year: year + 1 } : { season: order[idx + 1], year };
}

// ---------- Catalog rows ----------

export async function animeTrending(perPage = 24): Promise<AniListMedia[]> {
  const d = await gql<{ Page: { media: AniListMedia[] } }>(PAGE_QUERY, {
    page: 1,
    perPage,
    sort: ["TRENDING_DESC", "POPULARITY_DESC"],
    isAdult: false,
  });
  return d.Page.media;
}

export async function animeThisSeason(perPage = 24): Promise<AniListMedia[]> {
  const { season, year } = currentSeason();
  const d = await gql<{ Page: { media: AniListMedia[] } }>(PAGE_QUERY, {
    page: 1,
    perPage,
    sort: ["POPULARITY_DESC"],
    season,
    seasonYear: year,
    isAdult: false,
  });
  return d.Page.media;
}

export async function animeAllTime(perPage = 24): Promise<AniListMedia[]> {
  const d = await gql<{ Page: { media: AniListMedia[] } }>(PAGE_QUERY, {
    page: 1,
    perPage,
    sort: ["SCORE_DESC"],
    isAdult: false,
  });
  return d.Page.media;
}

export async function animeMovies(perPage = 24): Promise<AniListMedia[]> {
  const d = await gql<{ Page: { media: AniListMedia[] } }>(PAGE_QUERY, {
    page: 1,
    perPage,
    sort: ["POPULARITY_DESC", "SCORE_DESC"],
    format: "MOVIE",
    isAdult: false,
  });
  return d.Page.media;
}

export async function animeUpcoming(perPage = 24): Promise<AniListMedia[]> {
  const ns = nextSeason();
  const d = await gql<{ Page: { media: AniListMedia[] } }>(PAGE_QUERY, {
    page: 1,
    perPage,
    sort: ["POPULARITY_DESC"],
    season: ns.season,
    seasonYear: ns.year,
    isAdult: false,
  });
  return d.Page.media;
}

export type AiringEntry = { airingAt: number; episode: number; media: AniListMedia };

export async function animeAiringWeek(weekStartMs: number, weekEndMs: number): Promise<AiringEntry[]> {
  const d = await gql<{ Page: { airingSchedules: AiringEntry[] } }>(AIRING_WEEK_QUERY, {
    weekStart: Math.floor(weekStartMs / 1000),
    weekEnd: Math.floor(weekEndMs / 1000),
  });
  // filter adult + dedupe (media can appear multiple times per week)
  const seen = new Set<number>();
  return d.Page.airingSchedules.filter((s) => {
    if (!s.media || s.media.id === undefined) return false;
    return true;
  }).filter((s) => {
    if (seen.has(s.media.id)) return false;
    seen.add(s.media.id);
    return true;
  });
}

// ---------- Stremio resolution ----------

type Resolved = { meta: Meta | null; checkedAt: number };

const resolveCache = new Map<string, Resolved>();

function scoreMatch(meta: Meta, title: string): number {
  const a = meta.name.toLowerCase().replace(/[^a-z0-9]/g, "");
  const b = title.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (a.startsWith(b) || b.startsWith(a)) return 70;
  return a.includes(b) || b.includes(a) ? 40 : 0;
}

/**
 * Resolve an AniList entry to a playable Stremio meta via Cinemeta search.
 * TV-ish formats resolve against series first; movies against movies first.
 * Results are cached for the session (including null misses).
 */
export async function resolveAnimeMeta(m: AniListMedia): Promise<Meta | null> {
  const key = String(m.id);
  const hit = resolveCache.get(key);
  if (hit && Date.now() - hit.checkedAt < 10 * 60_000) return hit.meta;

  const title = mediaTitle(m);
  const isMovie = m.format === "MOVIE";
  let resolved: Meta | null = null;
  try {
    const { movies, series } = await searchCinemeta(title);
    // Prefer the pool matching the AniList format, but allow cross-type matches
    const pool = [...(isMovie ? movies : series), ...(isMovie ? series : movies)];
    let best: Meta | null = null;
    let bestScore = 0;
    for (const meta of pool) {
      const s = scoreMatch(meta, title);
      if (s > bestScore) {
        bestScore = s;
        best = meta;
      }
    }
    resolved = bestScore >= 40 ? best : null;
  } catch {
    resolved = null;
  }
  resolveCache.set(key, { meta: resolved, checkedAt: Date.now() });
  return resolved;
}

export function anilistUrl(m: AniListMedia): string {
  return `https://anilist.co/anime/${m.id}`;
}
