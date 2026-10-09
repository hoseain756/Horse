"use client";

// Harbor Web — full catalog grid with infinite paging + catalog filter bar
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, ArrowLeft, Search, X } from "lucide-react";
import type { CatalogQuery } from "@/lib/harbor/store";
import { useNav, useAddons } from "@/lib/harbor/store";
import type { CatalogDef, Meta, ParseOpts } from "@/lib/harbor/types";
import { fetchCatalog, fetchCinemetaCatalog } from "@/lib/harbor/api";
import { MetaCard } from "../common/meta-card";

const PAGE_SIZE = 40;

// Mirrors Cinemeta's manifest genre declarations (v3-cinemeta.strem.io), used only
// when no installed cinemeta addon can provide the catalog definition for this grid.
const DEFAULT_MOVIE_GENRES = [
  "Action",
  "Adventure",
  "Animation",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "History",
  "Horror",
  "Music",
  "Mystery",
  "Romance",
  "Sci-Fi & Fantasy",
  "Science Fiction",
  "Thriller",
  "War",
  "Western",
];
const DEFAULT_SERIES_GENRES = [
  "Action",
  "Adventure",
  "Animation",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "History",
  "Horror",
  "Mystery",
  "Romance",
  "Sci-Fi & Fantasy",
  "Science Fiction",
  "Thriller",
  "War",
  "Western",
  "Kids",
  "Reality",
  "War & Politics",
];

/** Resolve the CatalogDef powering the filter bar.
 *  - addonId set: the addon's own manifest catalog.
 *  - Cinemeta fallback path: reuse an installed cinemeta-like addon's declared
 *    catalog when possible; otherwise synthesize one with Cinemeta's genres/extras. */
function resolveCatalogDef(
  addons: ReturnType<typeof useAddons.getState>["addons"],
  query: CatalogQuery,
  title: string,
): CatalogDef {
  if (query.addonId) {
    const addon = addons.find((a) => a.manifest.id === query.addonId);
    const found = addon?.manifest.catalogs?.find(
      (c) => c.id === query.catalogId && c.type === query.type,
    );
    if (found) return found;
  }
  const cinemeta = addons.find((a) => a.manifest.id.toLowerCase().includes("cinemeta"));
  const declared = cinemeta?.manifest.catalogs?.find(
    (c) => c.id === query.catalogId && c.type === query.type,
  );
  if (declared) return declared;
  return {
    id: query.catalogId,
    type: query.type,
    name: title,
    genres: query.type === "series" ? DEFAULT_SERIES_GENRES : DEFAULT_MOVIE_GENRES,
    extra: [{ name: "search" }, { name: "genre" }],
  };
}

// M3 filter chips (m3-3c): .md-chip primitives + state layers; selected = .md-chip-selected
const CHIP_BASE =
  "md-chip md-state harbor-tv-focus shrink-0 whitespace-nowrap";
const CHIP_ACTIVE = "md-chip-selected";
const CHIP_IDLE = "";

export function GridView({ query, title }: { query: CatalogQuery; title: string }) {
  const pop = useNav((s) => s.pop);
  const addons = useAddons((s) => s.addons);
  const [metas, setMetas] = useState<Meta[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exhausted, setExhausted] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);

  // Local filter state — merged into every fetch on top of the nav frame's static
  // extra (never mutated). Wire keys follow the Stremio extra names: `genre` and
  // `search` (ParseOpts.query is NOT a catalog extra; Cinemeta ignores `query=`).
  const [filters, setFilters] = useState<{ genre?: string; search?: string }>(() => ({
    genre: query.extra?.genre,
  }));
  const [searchInput, setSearchInput] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const catalogDef = useMemo(
    () => resolveCatalogDef(addons, query, title),
    [addons, query, title],
  );

  const extraNames = useMemo(() => {
    const names = new Set<string>((catalogDef.extra ?? []).map((e) => e.name));
    for (const n of catalogDef.extraSupported ?? []) names.add(n);
    return names;
  }, [catalogDef]);
  const supportsSearch = extraNames.has("search");
  const supportsGenre = extraNames.has("genre");

  // Manifest-declared genre options win over the fallback genre lists.
  const genreChips = useMemo(() => {
    if (!supportsGenre) return [];
    const declared = catalogDef.extra?.find((e) => e.name === "genre");
    if (declared?.options && declared.options.length > 0) return declared.options;
    if (catalogDef.genres && catalogDef.genres.length > 0) return catalogDef.genres;
    return [];
  }, [catalogDef, supportsGenre]);

  const showFilterBar = genreChips.length > 0 || supportsSearch;
  const hasActiveFilters = Boolean(filters.genre || filters.search);

  // If the frame at this stack slot is ever replaced (resetTo/replace), drop stale filters.
  useEffect(() => {
    const initialGenre = query.extra?.genre;
    setFilters((f) => (f.genre === initialGenre && !f.search ? f : { genre: initialGenre }));
    setSearchInput("");
  }, [query]);

  const metasRef = useRef<Meta[]>([]);
  useEffect(() => {
    metasRef.current = metas;
  }, [metas]);

  const loadPage = useCallback(
    async (p: number) => {
      setLoading(true);
      setError(null);
      try {
        const extras: ParseOpts = {
          ...query.extra,
          ...filters,
          skip: (p - 1) * PAGE_SIZE,
        };
        let result: Meta[];
        if (query.addonId) {
          const addon = addons.find((a) => a.manifest.id === query.addonId);
          if (!addon) throw new Error("addon not installed");
          const catalog = (addon.manifest.catalogs ?? []).find(
            (c) => c.id === query.catalogId && c.type === query.type,
          );
          if (!catalog) throw new Error("catalog missing");
          result = await fetchCatalog(addon, catalog, extras);
        } else {
          result = await fetchCinemetaCatalog(
            query.type as "movie" | "series",
            query.catalogId,
            extras,
          );
        }
        setMetas((prev) => {
          if (p === 1) return result;
          const seen = new Set(prev.map((m) => m.id));
          return [...prev, ...result.filter((m) => !seen.has(m.id))];
        });
        // End-of-catalog guard: an empty page or a page with zero new items after
        // dedupe means paging further would just hammer upstream forever.
        if (p === 1) {
          setExhausted(result.length === 0);
        } else {
          const seenIds = new Set(metasRef.current.map((m) => m.id));
          if (!result.some((m) => !seenIds.has(m.id))) setExhausted(true);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to load catalog";
        // Stremio catalogs answer 404 for "no matches / end of catalog" (e.g. a
        // search term with zero results, or paging past the last page). The proxy
        // surfaces that as `proxy 502: ..."status":404}` — treat it as a quiet
        // stop, not a hard failure, whenever we're paging or filtering.
        const upstream404 = /status"?\s*[:=]\s*"?404/.test(msg);
        if (upstream404 && (p > 1 || filters.genre || filters.search)) {
          setExhausted(true);
        } else {
          setError(msg);
        }
      } finally {
        setLoading(false);
      }
    },
    [query, addons, filters],
  );

  useEffect(() => {
    setMetas([]);
    setPage(1);
    setExhausted(false);
    loadPage(1);
  }, [loadPage]);

  // Infinite scroll
  useEffect(() => {
    const el = sentinel.current;
    if (!el || loading || error || exhausted) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setPage((p) => {
            const next = p + 1;
            loadPage(next);
            return next;
          });
        }
      },
      { rootMargin: "600px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loading, error, exhausted, loadPage]);

  useEffect(() => {
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, []);

  const commitSearch = useCallback((value: string) => {
    if (searchTimer.current) {
      clearTimeout(searchTimer.current);
      searchTimer.current = null;
    }
    const term = value.trim();
    setFilters((f) => (f.search === term ? f : { ...f, search: term || undefined }));
  }, []);

  const onSearchInput = (value: string) => {
    setSearchInput(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => commitSearch(value), 400);
  };

  const clearSearch = useCallback(() => {
    setSearchInput("");
    commitSearch("");
    searchInputRef.current?.focus();
  }, [commitSearch]);

  const setGenreFilter = useCallback((g?: string) => {
    setFilters((f) => (f.genre === g ? f : { ...f, genre: g }));
  }, []);

  const clearAllFilters = useCallback(() => {
    setSearchInput("");
    if (searchTimer.current) {
      clearTimeout(searchTimer.current);
      searchTimer.current = null;
    }
    setFilters((f) => (f.genre || f.search ? { genre: undefined } : f));
  }, []);

  const push = useNav((s) => s.push);

  return (
    <div className="pt-20 md:pt-16 pb-16">
      <div className="px-4 md:px-8 mb-5 flex items-center gap-4">
        <button
          type="button"
          onClick={pop}
          className="md-icon-btn md-state harbor-tv-focus w-12! h-12! text-ink-muted! hover:text-ink!"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="md-headline-small text-ink">{title}</h1>
          <p className="md-body-small text-ink-subtle capitalize">
            {query.type} · {query.catalogId.replace(/-/g, " ")}
            {metas.length > 0 && (
              <span className="normal-case">
                {" "}
                · {metas.length} {metas.length === 1 ? "item" : "items"}
              </span>
            )}
          </p>
        </div>
      </div>

      {showFilterBar && (
        <div className="sticky top-14 z-20 mb-5 border-b border-edge-soft bg-canvas/80 backdrop-blur-xl harbor-pop-in">
          <div className="px-4 md:px-8 py-2.5 flex flex-col-reverse sm:flex-row sm:items-center gap-2 sm:gap-3">
            {genreChips.length > 0 && (
              <div
                className="harbor-scroll overflow-x-auto flex items-center gap-2 min-w-0 flex-1 py-0.5"
                role="group"
                aria-label="Filter by genre"
              >
                <button
                  type="button"
                  onClick={() => setGenreFilter(undefined)}
                  aria-pressed={!filters.genre}
                  className={`${CHIP_BASE} ${!filters.genre ? CHIP_ACTIVE : CHIP_IDLE}`}
                >
                  All
                </button>
                {genreChips.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGenreFilter(g)}
                    aria-pressed={filters.genre === g}
                    className={`${CHIP_BASE} ${filters.genre === g ? CHIP_ACTIVE : CHIP_IDLE}`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            )}
            {(supportsSearch || hasActiveFilters) && (
              <div className="flex items-center gap-2 shrink-0">
                {supportsSearch && (
                  <div className="relative w-full sm:w-56">
                    <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-subtle pointer-events-none" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchInput}
                      onChange={(e) => onSearchInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitSearch(searchInput);
                        if (e.key === "Escape") clearSearch();
                      }}
                      placeholder="Search catalog…"
                      aria-label={`Search ${title}`}
                      className="md-field-outlined harbor-tv-focus w-full h-10 ps-9 pe-9 text-sm text-ink placeholder:text-ink-subtle"
                    />
                    {searchInput && (
                      <button
                        type="button"
                        onClick={clearSearch}
                        aria-label="Clear search"
                        className="harbor-tv-focus absolute end-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center text-ink-subtle hover:text-ink after:content-[''] after:absolute after:-inset-1 after:rounded-full"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    aria-label="Clear all filters"
                    className={`${CHIP_BASE} ${CHIP_ACTIVE}`}
                  >
                    <X className="w-3 h-3" />
                    Clear all
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="mx-4 md:mx-8 rounded-xl border border-danger/40 bg-danger/10 text-danger px-4 py-3 text-sm mb-6">
          {error}
        </div>
      )}

      <div className="px-4 md:px-8 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-3 md:gap-4">
        {metas.map((m) => (
          <MetaCard key={m.id} meta={m} onOpen={() => push({ kind: "detail", type: m.type, id: m.id })} />
        ))}
        {loading &&
          Array.from({ length: 12 }).map((_, i) => (
            <div key={`sk-${i}`} className="harbor-skeleton rounded-xl aspect-[2/3]" aria-hidden />
          ))}
      </div>

      <div ref={sentinel} className="h-10" />
      {loading && metas.length > 0 && (
        <div className="flex justify-center py-6">
          <Loader2 className="w-6 h-6 text-accent animate-spin" />
        </div>
      )}
      {!loading && metas.length === 0 && !error && (
        <div className="text-center py-20 text-ink-subtle">
          <p>{hasActiveFilters ? "No items match the active filters." : "This catalog returned no items."}</p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="md-btn md-btn-tonal md-state harbor-tv-focus mt-4"
            >
              Clear filters
            </button>
          )}
        </div>
      )}
      {!loading && exhausted && metas.length > 0 && !error && (
        <p className="text-center text-[11px] text-ink-subtle py-4" role="status">
          End of catalog · {metas.length} {metas.length === 1 ? "item" : "items"}
        </p>
      )}
    </div>
  );
}
