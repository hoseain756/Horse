"use client";

// Harbor Web — Floating search bar (Feature: always-available search entry)
// M3 search bar: corner-full glass pill (translucency is Harbor's identity),
// 48dp mobile / 56dp md+ idle height, on-surface-variant leading icon, .md-icon-btn
// trailing clear (28dp), dropdown = M3 search results view (surface-container,
// corner-large→extra-large, elevation-3, .md-state rows).
// Fixed top-center glassmorphism bar with instant grouped results.
//  - "/" or Ctrl/Cmd+K focus it (see app-shell), Esc closes the dropdown.
//  - Idle: compact glass pill; focus: expands smoothly (width transition).
//  - Dropdown: debounced searches (Cinemeta + installed addons; TMDB multi-search
//    and People group join automatically once tmdbEnabled), recents, trending.
//  - Full keyboard navigation (↑/↓/Enter), ARIA combobox/listbox semantics,
//    RTL-safe (logical properties + centered anchor), reduced-motion aware,
//    backdrop-filter fallback via .harbor-glass-fallback.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Clock, Loader2, Search, Sparkles, TrendingUp, X } from "lucide-react";
import { useNav, useSettings } from "@/lib/harbor/store";
import { installedAddons } from "@/lib/harbor/store";
import { HUB_ENTRIES, hubLabel, hubDesc, type HubEntry } from "./nav-items";
import type { Meta } from "@/lib/harbor/types";
import {
  fetchCinemetaCatalog,
  searchAddonCatalogs,
  searchCinemeta,
} from "@/lib/harbor/api";
import { tmdbEnabled, tmdbMultiSearch, type TmdbMultiHit } from "@/lib/harbor/tmdb";
import { cn } from "@/lib/utils";
import { PosterImage } from "../common/poster";

const RECENTS_KEY = "harbor-web.search-recents";
const MAX_RECENTS = 8;
const MAX_PER_GROUP = 4;

type Phase = "idle" | "searching" | "error";

// Focus bridge: app-shell hotkeys dispatch this; the bar listens for it.
export function focusFloatingSearch() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("harbor:focus-floating-search"));
}

export function readRecents(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const arr = JSON.parse(window.localStorage.getItem(RECENTS_KEY) ?? "[]") as unknown;
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string").slice(0, MAX_RECENTS) : [];
  } catch {
    return [];
  }
}

export function writeRecent(q: string) {
  if (typeof window === "undefined") return;
  const trimmed = q.trim();
  if (!trimmed) return;
  const next = [trimmed, ...readRecents().filter((r) => r.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_RECENTS);
  try {
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    /* quota — ignore */
  }
}

// A flattened result row (used for keyboard navigation)
type FlatRow =
  | { kind: "meta"; id: string; meta: Meta; group: string }
  | { kind: "person"; id: string; name: string; sub?: string | null; img?: string | null; url?: string }
  | { kind: "action"; id: string; action: "ai" | "see-all" }
  | { kind: "recent"; id: string; query: string }
  | { kind: "destination"; id: string; entry: HubEntry };

/** Quick Access destinations matching the query (EN + Arabic labels/keywords).
 *  Second way to reach the pages moved from the sidebar into Settings.
 *  Exported for the full-screen SearchOverlay (round-22 parity). */
export function matchingDestinations(q: string, lang: string): HubEntry[] {
  const needle = q.trim().toLowerCase();
  if (needle.length < 2) return [];
  const ar = /^ar(-|_|$)/i.test(lang);
  return HUB_ENTRIES.filter((e) => {
    const label = hubLabel(e, lang).toLowerCase();
    const words = [...e.keywordsEn, ...e.keywordsAr, label];
    return words.some((w) => w.toLowerCase().includes(needle));
  }).slice(0, ar ? 4 : 3);
}

export function FloatingSearch() {
  const push = useNav((s) => s.push);
  const openFullSearch = useNav((s) => s.setSearchOpen);
  const uiLanguage = useSettings((s) => s.settings.uiLanguage);

  const [expanded, setExpanded] = useState(false);
  const [hidden, setHidden] = useState(false); // scroll-direction visibility
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [movies, setMovies] = useState<Meta[]>([]);
  const [series, setSeries] = useState<Meta[]>([]);
  const [addonHits, setAddonHits] = useState<Meta[]>([]);
  const [people, setPeople] = useState<TmdbMultiHit[]>([]);
  const [recents, setRecents] = useState<string[]>([]);
  const [trending, setTrending] = useState<Meta[]>([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const runToken = useRef(0);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus bridge + outside click + Esc handled here
  useEffect(() => {
    const onFocus = () => {
      setExpanded(true);
      setHidden(false); // hotkey reveal: never focus an off-screen bar
      setRecents(readRecents());
      setTimeout(() => inputRef.current?.focus(), 20);
    };
    const onPointer = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setExpanded(false);
        setActiveIdx(-1);
      }
    };
    window.addEventListener("harbor:focus-floating-search", onFocus);
    document.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("harbor:focus-floating-search", onFocus);
      document.removeEventListener("mousedown", onPointer);
    };
  }, []);

  // Scroll-direction visibility: scrolling DOWN hides the bar (content first),
  // scrolling UP (or returning near the top) reveals it again. While the bar
  // is expanded/focused it always stays visible.
  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const dy = y - lastY;
      lastY = y;
      if (expanded) return; // never hide while the user is searching
      if (y > 90 && dy > 4) setHidden(true);
      else if (dy < -4 || y <= 90) setHidden(false);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [expanded]);

  // Trending suggestions (idle state) — fetched once per session, errors are silent
  useEffect(() => {
    let alive = true;
    (async () => {
      const [mv, sr] = await Promise.allSettled([
        fetchCinemetaCatalog("movie", "trending"),
        fetchCinemetaCatalog("series", "trending"),
      ]);
      if (!alive) return;
      const items = [
        ...(mv.status === "fulfilled" ? mv.value : []),
        ...(sr.status === "fulfilled" ? sr.value : []),
      ].slice(0, 8);
      setTrending(items);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const runInstant = useCallback(async (q: string) => {
    const token = ++runToken.current;
    setPhase("searching");
    try {
      const jobs: Promise<void>[] = [];
      jobs.push(
        searchCinemeta(q).then((r) => {
          if (token !== runToken.current) return;
          setMovies(r.movies);
          setSeries(r.series);
        }),
      );
      jobs.push(
        searchAddonCatalogs(installedAddons(), q).then((r) => {
          if (token !== runToken.current) return;
          setAddonHits(r);
        }),
      );
      if (tmdbEnabled()) {
        jobs.push(
          tmdbMultiSearch(q).then((r) => {
            if (token !== runToken.current) return;
            setPeople(r.person.slice(0, MAX_PER_GROUP));
          }),
        );
      } else {
        setPeople([]);
      }
      const res = await Promise.allSettled(jobs);
      if (token !== runToken.current) return;
      const allFailed = res.every((r) => r.status === "rejected");
      setPhase(allFailed && q.trim().length >= 2 ? "error" : "idle");
    } catch {
      if (token === runToken.current) setPhase("error");
    }
  }, []);

  // Debounced instant search (250ms). State resets also run inside the timer
  // (never synchronously in the effect body) to satisfy the set-state lint rule.
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const q = query.trim();
    const token = ++runToken.current; // invalidate any in-flight run
    if (q.length < 2) {
      debounce.current = setTimeout(() => {
        if (token !== runToken.current) return;
        setMovies([]);
        setSeries([]);
        setAddonHits([]);
        setPeople([]);
        setPhase("idle");
      }, 0);
    } else {
      debounce.current = setTimeout(() => void runInstant(q), 250);
    }
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query, runInstant]);

  const openMeta = useCallback(
    (m: Meta) => {
      writeRecent(query || m.name);
      setRecents(readRecents());
      setExpanded(false);
      setActiveIdx(-1);
      push({ kind: "detail", type: m.type, id: m.id });
    },
    [push, query],
  );

  const openFull = useCallback(
    (q: string) => {
      writeRecent(q);
      setExpanded(false);
      setActiveIdx(-1);
      window.dispatchEvent(new CustomEvent("harbor:prefill-search", { detail: q }));
      openFullSearch(true);
    },
    [openFullSearch],
  );

  // Flatten the dropdown for keyboard navigation
  const rows = useMemo<FlatRow[]>(() => {
    const out: FlatRow[] = [];
    const q = query.trim();
    if (q.length < 2) {
      for (const r of recents) out.push({ kind: "recent", id: `recent:${r}`, query: r });
      for (const m of trending) out.push({ kind: "meta", id: `trend:${m.type}:${m.id}`, meta: m, group: "Trending" });
      return out;
    }
    for (const m of movies.slice(0, MAX_PER_GROUP)) out.push({ kind: "meta", id: `m:${m.id}`, meta: m, group: "Movies" });
    for (const m of series.slice(0, MAX_PER_GROUP)) out.push({ kind: "meta", id: `s:${m.id}`, meta: m, group: "Series" });
    for (const e of matchingDestinations(q, uiLanguage)) out.push({ kind: "destination", id: `dest:${e.id}`, entry: e });
    for (const m of people) out.push({ kind: "person", id: `p:${m.id}`, name: m.name, sub: m.known_for_department, img: m.profile_path, url: m.url });
    for (const m of addonHits.slice(0, MAX_PER_GROUP)) out.push({ kind: "meta", id: `a:${m.id}`, meta: m, group: "From your addons" });
    if (q.length >= 2) out.push({ kind: "action", id: "see-all", action: "see-all" });
    return out;
  }, [query, movies, series, addonHits, people, recents, trending, uiLanguage]);

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      setActiveIdx((i) => Math.min(rows.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      setActiveIdx((i) => Math.max(-1, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const row = rows[activeIdx];
      if (row?.kind === "meta") openMeta(row.meta);
      else if (row?.kind === "recent") {
        setQuery(row.query);
        inputRef.current?.focus();
      } else if (row?.kind === "destination") {
        setExpanded(false);
        setActiveIdx(-1);
        push({ kind: "view", view: row.entry.view });
      } else if (row?.kind === "action" && row.action === "see-all") {
        openFull(query);
      } else if (row?.kind === "person" && row.url) {
        window.open(row.url, "_blank", "noopener");
      } else if (query.trim()) {
        openFull(query);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (query) {
        setQuery("");
      } else {
        setExpanded(false);
        setActiveIdx(-1);
        inputRef.current?.blur();
      }
    }
  };

  // Keep the active option in view
  useEffect(() => {
    if (activeIdx < 0 || !listRef.current) return;
    const el = listRef.current.querySelector(`#fs-opt-${activeIdx}`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  const hasResults = movies.length + series.length + addonHits.length + people.length > 0;
  const searching = phase === "searching";
  const showDropdown = expanded;

  return (
    <div
      ref={wrapRef}
      className={cn(
        // Fixed top. PHONES: 48×48 glass trigger at the top inline-END corner
        // (over the hero, safe-area offset) that opens the full-screen search
        // view; md+: docked centered bar (unchanged). z: --z-search-bar map.
        "fixed z-[var(--z-search-bar)] top-[max(0.75rem,env(safe-area-inset-top))]",
        "end-3 md:end-auto md:left-1/2 md:-translate-x-1/2",
        "w-12 md:w-60",
        // Expand on focus + hide/reveal on scroll direction (smooth; motion-reduce users get instant snap)
        "transition-[width,transform,opacity] duration-300 ease-[var(--md-sys-motion-easing-emphasized)] motion-reduce:transition-none",
        expanded && "md:w-[42rem]",
        // Scrolled-down: slide the bar fully off-screen (keeps md centering).
        // invisible: aria-hidden subtrees must not keep focusable controls.
        hidden && "-translate-y-[160%] opacity-0 invisible pointer-events-none",
      )}
      aria-hidden={hidden || undefined}
    >
      {/* PHONE TRIGGER — root-cause fix: the old collapsed bar had NO tap
          handler on <md (input was pointer-events-none + w-0, icon decorative),
          so tapping it did nothing and search was keyboard-only ("/", Ctrl+K).
          This real button opens the M3 search view synchronously inside the
          tap gesture so mobile browsers honor the input focus. */}
      <button
        type="button"
        onClick={() => openFullSearch(true)}
        className="md:hidden md-state harbor-tv-focus flex h-12 w-12 items-center justify-center rounded-full harbor-glass border border-edge-soft shadow-[0_10px_36px_-12px_rgba(0,0,0,0.65),0_2px_10px_rgba(0,0,0,0.3)]"
        aria-label="Search"
      >
        <Search className="h-5 w-5 text-ink" aria-hidden />
      </button>

      {/* md+ docked bar (behavior unchanged) */}
      <div
        className={cn(
          // M3 search bar shape: corner-full. Glass translucency kept (Harbor identity).
          "harbor-glass hidden md:flex items-center gap-2 rounded-full border border-edge-soft",
          "shadow-[0_10px_36px_-12px_rgba(0,0,0,0.65),0_2px_10px_rgba(0,0,0,0.3)]",
          "transition-shadow duration-300",
          expanded && "shadow-[0_18px_50px_-12px_rgba(0,0,0,0.75)]",
        )}
      >
        <div
          className="flex items-center gap-2 px-2.5 md:px-4 h-11 md:h-14 w-full"
          role="combobox"
          aria-expanded={showDropdown && rows.length >= 0}
          aria-controls="harbor-float-search-list"
          aria-haspopup="listbox"
        >
          <Search className="w-4 h-4 md:w-5 md:h-5 text-ink-muted shrink-0" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              setExpanded(true);
              setHidden(false);
              setRecents(readRecents());
            }}
            onKeyDown={onInputKeyDown}
            placeholder="Search…"
            aria-label="Search movies, series, people and addons"
            aria-autocomplete="list"
            className={cn(
              "min-w-0 flex-1 self-stretch bg-transparent text-sm md:text-base text-ink placeholder:text-ink-muted outline-none",
              !expanded && "md:opacity-100 opacity-0 md:pointer-events-auto pointer-events-none w-0 md:w-auto",
            )}
            tabIndex={expanded ? 0 : -1}
          />
          {searching && <Loader2 className="w-4 h-4 text-accent animate-spin shrink-0" aria-hidden />}
          {/* AI mode hand-off (full overlay keeps the AI flow) */}
          <button
            type="button"
            tabIndex={expanded ? 0 : -1}
            onClick={() => openFull(query)}
            className={cn(
              "hidden md:flex shrink-0 items-center gap-1 rounded-full border border-edge-soft px-2 py-1 text-[10px] font-semibold text-ink-muted hover:text-accent hover:border-accent/50 transition-colors",
              !expanded && "opacity-0 pointer-events-none",
            )}
            title="AI search: describe what you feel like watching"
          >
            <Sparkles className="w-3 h-3" /> AI
          </button>
          <kbd
            className={cn(
              "harbor-kbd shrink-0 hidden md:inline-flex",
              (expanded || query) && "hidden",
            )}
            aria-hidden
          >
            /
          </kbd>
          {(query || expanded) && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setExpanded(false);
                setActiveIdx(-1);
              }}
              className="md-state md-icon-btn shrink-0 w-7! h-7!"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Dropdown (md+ only — phones use the full-screen search view) */}
      {showDropdown && (
        <div
          id="harbor-float-search-list"
          role="listbox"
          aria-label="Search suggestions"
          ref={listRef}
          className={cn(
            // M3 search results view: surface-container, corner-large → extra-large on md+, elevation-3
            "absolute top-[calc(100%+8px)] inset-x-0 overflow-hidden harbor-pop-in hidden md:block",
            "bg-[var(--md-sys-color-surface-container)] rounded-[var(--md-sys-shape-corner-large)] md:rounded-[var(--md-sys-shape-corner-extra-large)]",
            "shadow-[var(--md-sys-elevation-3)]",
          )}
        >
          <div className="max-h-[min(58vh,26rem)] overflow-y-auto harbor-scroll overscroll-contain p-1.5">
            {phase === "error" && query.trim().length >= 2 && (
              <p className="px-3 py-3 text-xs text-danger">
                Search failed — check your connection and try again.
              </p>
            )}

            {/* Idle: recents + trending */}
            {query.trim().length < 2 && (
              <>
                {recents.length > 0 && (
                  <FloatingGroup label="Recent">
                    {recents.map((r, i) => {
                      const idx = rows.findIndex((row) => row.id === `recent:${r}`);
                      return (
                        <RowShell
                          key={`recent-${r}`}
                          id={`fs-opt-${idx}`}
                          active={activeIdx === idx}
                          onHover={() => setActiveIdx(idx)}
                          onClick={() => {
                            setQuery(r);
                            inputRef.current?.focus();
                          }}
                          className="rounded-full"
                        >
                          <Clock className="w-3.5 h-3.5 text-ink-muted shrink-0" aria-hidden />
                          <span className="truncate text-sm text-ink">{r}</span>
                        </RowShell>
                      );
                    })}
                  </FloatingGroup>
                )}
                {trending.length > 0 && (
                  <FloatingGroup label="Trending now">
                    {trending.map((m) => {
                      const idx = rows.findIndex((row) => row.id === `trend:${m.type}:${m.id}`);
                      return (
                        <RowShell
                          key={`trend-${m.type}-${m.id}`}
                          id={`fs-opt-${idx}`}
                          active={activeIdx === idx}
                          onHover={() => setActiveIdx(idx)}
                          onClick={() => openMeta(m)}
                        >
                          <TrendingUp className="w-3.5 h-3.5 text-accent shrink-0" aria-hidden />
                          <Thumb src={m.poster} alt="" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-ink">{m.name}</span>
                            <span className="block text-[10px] text-ink-subtle">
                              {m.type === "series" ? "Series" : "Movie"}
                              {m.releaseInfo ? ` · ${m.releaseInfo}` : ""}
                            </span>
                          </span>
                        </RowShell>
                      );
                    })}
                  </FloatingGroup>
                )}
                {recents.length === 0 && trending.length === 0 && (
                  <p className="px-3 py-4 text-xs text-ink-subtle text-center">
                    Type to search, or press <span className="harbor-kbd">/</span> anytime.
                  </p>
                )}
              </>
            )}

            {/* Live results */}
            {query.trim().length >= 2 && (
              <>
                <ResultGroup label="Movies" metas={movies} rows={rows} activeIdx={activeIdx} setActiveIdx={setActiveIdx} onOpen={openMeta} />
                <ResultGroup label="Series" metas={series} rows={rows} activeIdx={activeIdx} setActiveIdx={setActiveIdx} onOpen={openMeta} />
                {(() => {
                  const dests = rows.filter((r): r is Extract<FlatRow, { kind: "destination" }> => r.kind === "destination");
                  if (dests.length === 0) return null;
                  const ar = /^ar(-|_|$)/i.test(uiLanguage);
                  return (
                    <FloatingGroup label={ar ? "انتقال سريع" : "Go to"}>
                      {dests.map((row) => {
                        const idx = rows.findIndex((r) => r.id === row.id);
                        const Icon = row.entry.icon;
                        return (
                          <RowShell
                            key={row.id}
                            id={`fs-opt-${idx}`}
                            active={activeIdx === idx}
                            onHover={() => setActiveIdx(idx)}
                            onClick={() => {
                              setExpanded(false);
                              setActiveIdx(-1);
                              push({ kind: "view", view: row.entry.view });
                            }}
                          >
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft" aria-hidden>
                              <Icon className="w-4 h-4 text-accent" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm text-ink">{hubLabel(row.entry, uiLanguage)}</span>
                              <span className="block text-[10px] text-ink-subtle truncate">{hubDesc(row.entry, uiLanguage)}</span>
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-ink-subtle rtl:rotate-180 shrink-0" aria-hidden />
                          </RowShell>
                        );
                      })}
                    </FloatingGroup>
                  );
                })()}
                {people.length > 0 && (
                  <FloatingGroup label="People">
                    {people.map((p) => {
                      const idx = rows.findIndex((row) => row.id === `p:${p.id}`);
                      return (
                        <RowShell
                          key={`p-${p.id}`}
                          id={`fs-opt-${idx}`}
                          active={activeIdx === idx}
                          onHover={() => setActiveIdx(idx)}
                          onClick={() => p.url && window.open(p.url, "_blank", "noopener")}
                        >
                          <Thumb src={p.profile_path} alt="" round />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-ink">{p.name}</span>
                            <span className="block text-[10px] text-ink-subtle">{p.known_for_department ?? "Person"}</span>
                          </span>
                        </RowShell>
                      );
                    })}
                  </FloatingGroup>
                )}
                <ResultGroup label="From your addons" metas={addonHits} rows={rows} activeIdx={activeIdx} setActiveIdx={setActiveIdx} onOpen={openMeta} />
                {!hasResults && phase !== "searching" && (
                  <p className="px-3 py-4 text-xs text-ink-subtle text-center">
                    No quick matches — press Enter for full results.
                  </p>
                )}
                {/* See all results row */}
                {rows.find((r) => r.id === "see-all") && (
                  <RowShell
                    id={`fs-opt-${rows.findIndex((r) => r.id === "see-all")}`}
                    active={activeIdx === rows.findIndex((r) => r.id === "see-all")}
                    onHover={() => setActiveIdx(rows.findIndex((r) => r.id === "see-all"))}
                    onClick={() => openFull(query)}
                    className="mt-1 border-t border-edge-soft rounded-t-none"
                  >
                    <ArrowRight className="w-3.5 h-3.5 text-accent" aria-hidden />
                    <span className="text-xs font-semibold text-ink">
                      See all results for “{query.trim()}”
                    </span>
                    <span className="ms-auto text-[10px] text-ink-subtle hidden md:inline">Enter</span>
                  </RowShell>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FloatingGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-1" role="group" aria-label={label}>
      <p className="md-label-medium text-ink-muted uppercase px-2.5 pt-2 pb-1">{label}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function ResultGroup({
  label,
  metas,
  rows,
  activeIdx,
  setActiveIdx,
  onOpen,
}: {
  label: string;
  metas: Meta[];
  rows: FlatRow[];
  activeIdx: number;
  setActiveIdx: (i: number) => void;
  onOpen: (m: Meta) => void;
}) {
  if (metas.length === 0) return null;
  return (
    <FloatingGroup label={label}>
      {metas.slice(0, MAX_PER_GROUP).map((m) => {
        const idx = rows.findIndex((r) => r.kind === "meta" && r.id === `${label === "Movies" ? "m" : label === "Series" ? "s" : "a"}:${m.id}`);
        return (
          <RowShell
            key={`${m.type}-${m.id}`}
            id={`fs-opt-${idx}`}
            active={activeIdx === idx}
            onHover={() => setActiveIdx(idx)}
            onClick={() => onOpen(m)}
          >
            <Thumb src={m.poster} alt="" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-ink">{m.name}</span>
              <span className="block text-[10px] text-ink-subtle">
                {m.type === "series" ? "Series" : "Movie"}
                {m.releaseInfo ? ` · ${m.releaseInfo}` : ""}
                {m.imdbRating ? ` · ★ ${m.imdbRating}` : ""}
              </span>
            </span>
          </RowShell>
        );
      })}
    </FloatingGroup>
  );
}

function RowShell({
  id,
  active,
  onHover,
  onClick,
  children,
  className,
}: {
  id: string;
  active: boolean;
  onHover: () => void;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      id={id}
      role="option"
      aria-selected={active}
      tabIndex={-1}
      onMouseEnter={onHover}
      onMouseDown={(e) => e.preventDefault()} // keep input focus for keyboard flow
      onClick={onClick}
      className={cn(
        // .md-state paints the M3 hover/focus/press state layer (8/10/16% of currentColor)
        "md-state harbor-tv-focus flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 cursor-pointer transition-colors",
        active ? "bg-accent-soft" : "",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Thumb({ src, alt, round }: { src?: string | null; alt: string; round?: boolean }) {
  return (
    <span
      className={cn(
        "relative w-8 h-11 shrink-0 overflow-hidden bg-raised border border-edge-soft block",
        round ? "rounded-full w-9 h-9" : "rounded-md",
      )}
      aria-hidden
    >
      {src ? (
        <PosterImage src={src} alt={alt} className="absolute inset-0" />
      ) : round ? (
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-ink-subtle">?</span>
      ) : (
        <span className="absolute inset-0 flex items-center justify-center">
          <Search className="w-3.5 h-3.5 text-ink-subtle" />
        </span>
      )}
    </span>
  );
}
