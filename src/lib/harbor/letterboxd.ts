// Harbor Web — Letterboxd integration (server-only lib)
// Letterboxd has NO public API (invite-only for years) and scraping its pages
// is against its ToS — so this integration deliberately uses only channels
// Letterboxd itself publishes:
//   1. the official data export (CSV: diary / ratings / watchlist / films),
//   2. the public per-profile RSS feed,
//   3. Letterboxd scores relayed through MDBList's licensed ratings feed
//      (see ratings/adapters.ts — no letterboxd.com request involved).
// Films are matched to TMDB (title + year) so imports become real, clickable
// Horse collections with posters.
import { tmdbFetch } from "./tmdb-server";

export type LbSource = "csv" | "rss";

export type LbRow = {
  title: string;
  year: number | null;
  /** Letterboxd native 0..5 (half stars), null when unrated */
  rating5: number | null;
  watchedDate: string | null;
  uri: string | null;
};

export type LbResolvedItem = {
  id: string; // imdb id (tt…) when resolvable, else tmdb-<id>
  type: "movie";
  name: string;
  year: number | null;
  poster: string | null;
  rating5: number | null;
  watchedDate: string | null;
};

export type LbImportResult =
  | { ok: true; items: LbResolvedItem[]; matched: number; total: number; unmatched: string[] }
  | { ok: false; error: "csv" | "rss" | "tmdb" };

// ---------- 1 · CSV (official export) ----------

/** Minimal RFC-4180-ish CSV parser (quoted fields, embedded commas/newlines). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, ""); // strip BOM
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

function colIndex(header: string[], candidates: string[]): number {
  const norm = header.map((h) => h.trim().toLowerCase());
  for (const cand of candidates) {
    const i = norm.indexOf(cand);
    if (i !== -1) return i;
  }
  return -1;
}

export function parseLetterboxdCsv(text: string): LbRow[] {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error("csv");
  const header = rows[0];
  const iName = colIndex(header, ["name", "film title", "title"]);
  const iYear = colIndex(header, ["year", "release year"]);
  const iRating = colIndex(header, ["rating", "member rating"]);
  const iDate = colIndex(header, ["date", "date added", "watched date"]);
  if (iName === -1) throw new Error("csv");
  const out: LbRow[] = [];
  for (let r = 1; r < rows.length && out.length < 600; r++) {
    const cells = rows[r];
    const title = (cells[iName] ?? "").trim();
    if (!title) continue;
    const yearNum = iYear >= 0 ? parseInt((cells[iYear] ?? "").trim(), 10) : NaN;
    const ratingRaw = iRating >= 0 ? parseFloat((cells[iRating] ?? "").replace(",", ".").trim()) : NaN;
    out.push({
      title: title.slice(0, 200),
      year: Number.isFinite(yearNum) && yearNum > 1880 ? yearNum : null,
      rating5: Number.isFinite(ratingRaw) && ratingRaw > 0 && ratingRaw <= 5 ? Math.round(ratingRaw * 2) / 2 : null,
      watchedDate: iDate >= 0 ? (cells[iDate] ?? "").trim().slice(0, 10) || null : null,
      uri: null,
    });
  }
  if (out.length === 0) throw new Error("csv");
  return out;
}

// ---------- 2 · RSS (public profile feed) ----------

const LB_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

function blockText(block: string, tag: string): string | null {
  const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"));
  if (!m) return null;
  return m[1]
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .trim();
}

export function isValidLbUsername(user: string): boolean {
  return /^[A-Za-z0-9_-]{2,30}$/.test(user);
}

export async function fetchLetterboxdRss(user: string): Promise<LbRow[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  let xml: string;
  try {
    const res = await fetch(`https://letterboxd.com/${encodeURIComponent(user)}/rss/`, {
      headers: { "User-Agent": LB_UA, Accept: "application/rss+xml, application/xml, text/xml" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error("rss");
    xml = await res.text();
  } catch {
    throw new Error("rss");
  } finally {
    clearTimeout(timer);
  }
  if (!/<rss[\s\S]*<\/rss>/i.test(xml) && !/<feed[\s\S]*<\/feed>/i.test(xml)) throw new Error("rss");

  const rows: LbRow[] = [];
  const items = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
  for (const item of items) {
    const title = blockText(item, "letterboxd:filmTitle");
    const yearRaw = blockText(item, "letterboxd:filmYear");
    if (!title) continue;
    const ratingRaw = parseFloat((blockText(item, "letterboxd:memberRating") ?? "").replace(",", "."));
    const uri = blockText(item, "link");
    rows.push({
      title: title.slice(0, 200),
      year: yearRaw ? parseInt(yearRaw, 10) || null : null,
      rating5: Number.isFinite(ratingRaw) && ratingRaw > 0 && ratingRaw <= 5 ? Math.round(ratingRaw * 2) / 2 : null,
      watchedDate: blockText(item, "letterboxd:watchedDate")?.slice(0, 10) ?? null,
      uri,
    });
    if (rows.length >= 60) break; // the feed itself is a recent-activity window
  }
  if (rows.length === 0) throw new Error("rss");
  return rows;
}

// ---------- 3 · TMDB matching ----------

type TmdbSearchMovie = { id: number; title?: string; poster_path?: string | null; release_date?: string };
type TmdbExternalIds = { imdb_id?: string | null };

const resolveCache = new Map<string, { tmdbId: number | null; imdbId: string | null; poster: string | null }>();
const MAX_IMPORT = 300;
const CONCURRENCY = 4;

async function resolveRow(row: LbRow): Promise<{ tmdbId: number | null; imdbId: string | null; poster: string | null }> {
  const key = `${row.title.toLowerCase()}|${row.year ?? ""}`;
  const hit = resolveCache.get(key);
  if (hit) return hit;

  let out: { tmdbId: number | null; imdbId: string | null; poster: string | null } = {
    tmdbId: null,
    imdbId: null,
    poster: null,
  };
  const search = await tmdbFetch("/search/movie", {
    query: row.title,
    ...(row.year ? { year: String(row.year) } : {}),
    include_adult: "false",
  });
  if (search.ok) {
    const results = ((search.body as { results?: TmdbSearchMovie[] }).results ?? []).filter(
      (r) => !!r.id,
    );
    // prefer a release-year match, then the top result
    const pick =
      (row.year ? results.find((r) => (r.release_date ?? "").slice(0, 4) === String(row.year)) : null) ??
      results[0] ??
      null;
    if (pick) {
      const ext = await tmdbFetch(`/movie/${pick.id}/external_ids`, {});
      const imdbId = ext.ok ? ((ext.body as TmdbExternalIds).imdb_id ?? null) : null;
      out = {
        tmdbId: pick.id,
        imdbId: imdbId && /^tt\d+$/.test(imdbId) ? imdbId : null,
        poster: pick.poster_path ? `https://image.tmdb.org/t/p/w185${pick.poster_path}` : null,
      };
    }
  }
  if (resolveCache.size > 5_000) resolveCache.clear();
  resolveCache.set(key, out);
  return out;
}

/** Resolve rows → Horse list items (TMDB match + poster + imdb id). */
export async function resolveLetterboxdRows(rows: LbRow[]): Promise<LbImportResult> {
  // TMDB must be configured for matching — fail early with the explicit reason
  const probe = await tmdbFetch("/configuration", {});
  if (!probe.ok && probe.configured === false) return { ok: false, error: "tmdb" };

  const slice = rows.slice(0, MAX_IMPORT);
  // resolve in parallel but keep the source order: slots[i] corresponds to
  // slice[i], so the saved collection preserves the user's CSV/diary order
  const slots: { row: LbRow; r: { tmdbId: number | null; imdbId: string | null; poster: string | null } }[] = new Array(
    slice.length,
  );
  const items: LbResolvedItem[] = [];
  const unmatched: string[] = [];
  let cursor = 0;

  async function worker() {
    while (cursor < slice.length) {
      const i = cursor++;
      slots[i] = { row: slice[i], r: await resolveRow(slice[i]) };
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, slice.length) }, worker));

  for (const { row, r } of slots) {
    if (r.imdbId || r.tmdbId) {
      items.push({
        id: r.imdbId ?? `tmdb-${r.tmdbId}`,
        type: "movie",
        name: row.title,
        year: row.year,
        poster: r.poster,
        rating5: row.rating5,
        watchedDate: row.watchedDate,
      });
    } else {
      unmatched.push(row.year ? `${row.title} (${row.year})` : row.title);
    }
  }

  return { ok: true, items, matched: items.length, total: slice.length, unmatched: unmatched.slice(0, 40) };
}
