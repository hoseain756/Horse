// Harbor Web — Ratings providers (Feature: unified ratings row)
// Provider-adapter architecture: one adapter per platform, a common interface,
// a registry, aggressive server-side caching, and per-provider failure
// isolation (one dead provider never breaks the page).
// Platform note: Letterboxd has NO public API and scraping is against its
// ToS — we deliberately do not integrate it (deep links only, see final notes).
import { tmdbFetch } from "@/lib/harbor/tmdb-server";

export type RatingKind = "movie" | "series";

export type RatingValue = {
  provider: string; // registry id
  score: number; // normalized 0..10
  display: string; // "8.4" | "94%" | "78"
  originalScale: string; // "/10", "%", "/100"
  votes?: number | null;
  url?: string;
};

export type RatingContext = {
  kind: RatingKind;
  imdbId?: string;
  tmdbId?: number;
  title: string;
  year?: string;
  anime: boolean;
};

export type RatingAdapter = {
  id: string;
  label: string;
  /** chip color classes (theme-safe, avoids blue/indigo) */
  color: string;
  supports: (ctx: RatingContext) => boolean;
  fetch: (ctx: RatingContext) => Promise<RatingValue | null>;
};

// ---------- shared TTL cache ----------

type Entry = { value: RatingValue | null; at: number };
const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<RatingValue | null>>();
const TTL = 6 * 60 * 60_000;

function cached(id: string, key: string, run: () => Promise<RatingValue | null>): Promise<RatingValue | null> {
  const cacheKey = `${id}:${key}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL) return Promise.resolve(hit.value);
  const pending = inflight.get(cacheKey);
  if (pending) return pending;
  const p = run()
    .then((value) => {
      cache.set(cacheKey, { value, at: Date.now() });
      if (cache.size > 3_000) {
        for (const k of Array.from(cache.keys()).slice(0, 750)) cache.delete(k);
      }
      return value;
    })
    .finally(() => inflight.delete(cacheKey));
  inflight.set(cacheKey, p);
  return p;
}

async function getJson(url: string, init?: RequestInit): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store", ...init });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function yearOf(ctx: RatingContext): number | null {
  const y = parseInt(ctx.year ?? "", 10);
  return Number.isFinite(y) && y > 1900 ? y : null;
}

// ---------- OMDb family (IMDb / Rotten Tomatoes / Metacritic) ----------
// One upstream OMDb call feeds all three providers (IMDb + RT + MC ratings).

type OmdbResponse = {
  Response?: string;
  imdbRating?: string;
  imdbVotes?: string;
  Ratings?: { Source: string; Value: string }[];
};

const sideRt = new Map<string, string | null>();
const sideMc = new Map<string, string | null>();
const omdbRawCache = new Map<string, { body: OmdbResponse | null; at: number }>();

async function omdbRaw(imdbId: string): Promise<OmdbResponse | null> {
  const key = process.env.OMDB_API_KEY?.trim();
  if (!key || !/^tt\d+$/.test(imdbId)) return null;
  const hit = omdbRawCache.get(imdbId);
  if (hit && Date.now() - hit.at < TTL) return hit.body;
  const body = (await getJson(`https://www.omdbapi.com/?i=${encodeURIComponent(imdbId)}&apikey=${encodeURIComponent(key)}`)) as OmdbResponse | null;
  const usable = body && body.Response !== "False" ? body : null;
  omdbRawCache.set(imdbId, { body: usable, at: Date.now() });
  if (usable?.Ratings) {
    sideRt.set(imdbId, usable.Ratings.find((r) => r.Source === "Rotten Tomatoes")?.Value ?? null);
    sideMc.set(imdbId, usable.Ratings.find((r) => r.Source === "Metacritic")?.Value ?? null);
  }
  return usable;
}

function parsePercent(v: string | null): number | null {
  if (!v) return null;
  const m = v.match(/(\d+)%/);
  return m ? Number(m[1]) : null;
}
function parseOutOf100(v: string | null): number | null {
  if (!v) return null;
  const m = v.match(/(\d+)\/100/);
  return m ? Number(m[1]) : null;
}

const imdbAdapter: RatingAdapter = {
  id: "imdb",
  label: "IMDb",
  color: "bg-amber-500/90 text-black",
  supports: (ctx) => !!process.env.OMDB_API_KEY && /^tt\d+$/.test(ctx.imdbId ?? ""),
  fetch: (ctx) =>
    cached("imdb", ctx.imdbId ?? "", async () => {
      const raw = await omdbRaw(ctx.imdbId!);
      if (!raw?.imdbRating) return null;
      const score = parseFloat(raw.imdbRating);
      if (!Number.isFinite(score)) return null;
      const votes = raw.imdbVotes?.replace(/,/g, "");
      return {
        provider: "imdb",
        score,
        display: score.toFixed(1),
        originalScale: "/10",
        votes: votes && Number.isFinite(Number(votes)) ? Number(votes) : null,
        url: `https://www.imdb.com/title/${ctx.imdbId}/`,
      };
    }),
};

const rtAdapter: RatingAdapter = {
  id: "rotten",
  label: "Rotten Tomatoes",
  color: "bg-red-600/90 text-white",
  supports: (ctx) => !!process.env.OMDB_API_KEY && /^tt\d+$/.test(ctx.imdbId ?? ""),
  fetch: (ctx) =>
    cached("rotten", ctx.imdbId ?? "", async () => {
      await omdbRaw(ctx.imdbId!); // populates sideRt
      const pct = parsePercent(sideRt.get(ctx.imdbId!) ?? null);
      if (pct === null) return null;
      return {
        provider: "rotten",
        score: pct / 10,
        display: `${pct}%`,
        originalScale: "%",
        url: `https://www.rottentomatoes.com/search?search=${encodeURIComponent(ctx.title)}`,
      };
    }),
};

const mcAdapter: RatingAdapter = {
  id: "metacritic",
  label: "Metacritic",
  color: "bg-emerald-600/90 text-white",
  supports: (ctx) => !!process.env.OMDB_API_KEY && /^tt\d+$/.test(ctx.imdbId ?? ""),
  fetch: (ctx) =>
    cached("metacritic", ctx.imdbId ?? "", async () => {
      await omdbRaw(ctx.imdbId!); // populates sideMc
      const raw = parseOutOf100(sideMc.get(ctx.imdbId!) ?? null);
      if (raw === null) return null;
      return {
        provider: "metacritic",
        score: raw / 10,
        display: String(raw),
        originalScale: "/100",
        url: `https://www.metacritic.com/search/${encodeURIComponent(ctx.title)}/`,
      };
    }),
};

// ---------- MDBList (fallback for RT/MC when OMDb is absent) ----------

const mdbAdapter: RatingAdapter = {
  id: "mdblist",
  label: "MDBList",
  color: "bg-teal-600/90 text-white",
  supports: (ctx) => !!process.env.MDBLIST_API_KEY && /^tt\d+$/.test(ctx.imdbId ?? ""),
  fetch: (ctx) =>
    cached("mdblist", ctx.imdbId ?? "", async () => {
      const key = process.env.MDBLIST_API_KEY!.trim();
      const data = (await getJson(`https://api.mdblist.com/imdb/${ctx.imdbId}?apikey=${encodeURIComponent(key)}`)) as {
        ratings?: { source: string; value: number }[];
      } | null;
      if (!data?.ratings) return null;
      const rt = data.ratings.find((r) => r.source.toLowerCase() === "rottentomatoes");
      if (rt && rt.value > 0) {
        return {
          provider: "mdblist",
          score: rt.value / 10,
          display: `${rt.value}%`,
          originalScale: "%",
          url: `https://mdblist.com/?i=${ctx.imdbId}`,
        };
      }
      return null;
    }),
};

// ---------- TMDB ----------

const tmdbAdapter: RatingAdapter = {
  id: "tmdb",
  label: "TMDB",
  color: "bg-sky-600/90 text-white",
  supports: () => !!process.env.TMDB_ACCESS_TOKEN || !!process.env.TMDB_API_KEY,
  fetch: (ctx) =>
    cached("tmdb", `${ctx.kind}:${ctx.tmdbId ?? ctx.imdbId}`, async () => {
      let id = ctx.tmdbId;
      if (!id && ctx.imdbId && /^tt\d+$/.test(ctx.imdbId)) {
        const find = await tmdbFetch(`/find/${ctx.imdbId}`, { external_source: "imdb_id" });
        if (find.ok) {
          const body = find.body as { movie_results?: { id: number }[]; tv_results?: { id: number }[] };
          id = (ctx.kind === "series" ? body.tv_results : body.movie_results)?.[0]?.id;
        }
      }
      if (!id) return null;
      const det = await tmdbFetch(`/${ctx.kind === "series" ? "tv" : "movie"}/${id}`, {});
      if (!det.ok) return null;
      const body = det.body as { vote_average?: number; vote_count?: number };
      const score = body.vote_average ?? 0;
      if (score <= 0) return null;
      return {
        provider: "tmdb",
        score: Math.min(10, score),
        display: score.toFixed(1),
        originalScale: "/10",
        votes: body.vote_count ?? null,
        url: `https://www.themoviedb.org/${ctx.kind === "series" ? "tv" : "movie"}/${id}`,
      };
    }),
};

// ---------- Trakt (public ratings; client id only) ----------

const TRAKT_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json",
  "trakt-api-version": "2",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
};

const traktAdapter: RatingAdapter = {
  id: "trakt",
  label: "Trakt",
  color: "bg-red-500/90 text-white",
  supports: () => !!process.env.TRAKT_CLIENT_ID,
  fetch: (ctx) =>
    cached("trakt", `${ctx.kind}:${ctx.imdbId ?? ctx.title}`, async () => {
      const clientId = process.env.TRAKT_CLIENT_ID?.trim();
      if (!clientId || !ctx.imdbId) return null;
      const path = `/${ctx.kind === "series" ? "shows" : "movies"}/${ctx.imdbId}/ratings`;
      const data = (await getJson(`https://api.trakt.tv${path}`, {
        headers: { ...TRAKT_HEADERS, "trakt-api-key": clientId },
      })) as { rating?: number; votes?: number } | null;
      if (!data?.rating || data.rating <= 0) return null;
      return {
        provider: "trakt",
        score: Math.min(10, data.rating),
        display: data.rating.toFixed(1),
        originalScale: "/10",
        votes: data.votes ?? null,
        url: `https://trakt.tv/search/imdb?q=${ctx.imdbId}`,
      };
    }),
};

// ---------- AniList / MyAnimeList / Kitsu (anime) ----------

const anilistAdapter: RatingAdapter = {
  id: "anilist",
  label: "AniList",
  color: "bg-violet-600/90 text-white",
  supports: (ctx) => ctx.anime,
  fetch: (ctx) =>
    cached("anilist", ctx.title, async () => {
      const yr = yearOf(ctx);
      const query = `query ($search: String) { Page(page: 1, perPage: 5) { media(search: $search, type: ANIME, sort: SEARCH_MATCH) { id averageScore seasonYear } } }`;
      const data = (await getJson("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query, variables: { search: ctx.title } }),
      })) as { data?: { Page?: { media?: { id: number; averageScore: number | null; seasonYear: number | null }[] } } } | null;
      const media = data?.data?.Page?.media ?? [];
      // prefer a season-year match when available
      const pick = (yr ? media.find((m) => m.seasonYear === yr && (m.averageScore ?? 0) > 0) : null) ?? media.find((m) => (m.averageScore ?? 0) > 0) ?? null;
      if (!pick?.averageScore) return null;
      return {
        provider: "anilist",
        score: pick.averageScore / 10,
        display: String(pick.averageScore),
        originalScale: "/100",
        url: `https://anilist.co/anime/${pick.id}`,
      };
    }),
};

const jikanAdapter: RatingAdapter = {
  id: "mal",
  label: "MyAnimeList",
  color: "bg-blue-500/90 text-white",
  supports: (ctx) => ctx.anime,
  fetch: (ctx) =>
    cached("mal", ctx.title, async () => {
      const data = (await getJson(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(ctx.title)}&limit=1&sfw=true`)) as {
        data?: { mal_id: number; score: number | null; scored_by: number | null }[];
      } | null;
      const item = data?.data?.[0];
      if (!item?.score) return null;
      return {
        provider: "mal",
        score: item.score,
        display: item.score.toFixed(2),
        originalScale: "/10",
        votes: item.scored_by ?? null,
        url: `https://myanimelist.net/anime/${item.mal_id}`,
      };
    }),
};

const kitsuAdapter: RatingAdapter = {
  id: "kitsu",
  label: "Kitsu",
  color: "bg-orange-500/90 text-black",
  supports: (ctx) => ctx.anime,
  fetch: (ctx) =>
    cached("kitsu", ctx.title, async () => {
      const data = (await getJson(`https://kitsu.io/api/edge/anime?filter%5Btext%5D=${encodeURIComponent(ctx.title)}&page%5Blimit%5D=1`)) as {
        data?: { id: string; attributes?: { averageRating: string | null } }[];
      } | null;
      const item = data?.data?.[0];
      const rating = item?.attributes?.averageRating ? parseFloat(item.attributes.averageRating) : null;
      if (rating === null || !Number.isFinite(rating) || rating <= 0) return null;
      return {
        provider: "kitsu",
        score: rating / 10,
        display: rating.toFixed(1),
        originalScale: "/100",
        url: `https://kitsu.io/anime/${item!.id}`,
      };
    }),
};

// ---------- registry ----------

export const RATING_ADAPTERS: RatingAdapter[] = [
  imdbAdapter,
  rtAdapter,
  mcAdapter,
  tmdbAdapter,
  traktAdapter,
  mdbAdapter,
  anilistAdapter,
  jikanAdapter,
  kitsuAdapter,
];

export const RATING_REGISTRY_IDS = RATING_ADAPTERS.map((a) => a.id);

export function ratingAdapterById(id: string): RatingAdapter | undefined {
  return RATING_ADAPTERS.find((a) => a.id === id);
}
