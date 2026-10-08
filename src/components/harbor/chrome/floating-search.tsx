"use client";

// Harbor Web — Floating search bar (THE single search surface)
// M3 search bar in the shared glass language: corner-full glass pill (same
// --glass-* recipe as the bottom nav), 48dp mobile trigger / 56dp md+ idle
// height, .md-icon-btn trailing clear (28dp), results view = glass card.
//  - "/" or Ctrl/Cmd+K focus it (see app-shell); Esc closes. One search
//    component, one entry point per platform — there is no other search UI.
//  - Desktop (md+): docked centered glass bar with an instant grouped
//    dropdown (movies / series / go-to / people / addons, recents, trending),
//    full keyboard navigation (↑/↓/Enter), ARIA combobox/listbox semantics.
//  - Phones (<md): the 48dp glass icon expands THIS bar into a full-screen
//    glass sheet with the same grouped results (mobile face of the same node).
//  - Command palette hands its query off via the "harbor:prefill-search"
//    event; this bar consumes it (the old full-screen overlay is removed).
//  - Debounced searches (Cinemeta + installed addons; TMDB multi-search and
//    People group join automatically once tmdbEnabled), RTL-safe (logical
//    properties + centered anchor), reduced-motion aware, backdrop-filter
//    fallback via the shared .fs-results media rules.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Clock, Loader2, Search, TrendingUp, X } from "lucide-react";
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

function readRecents(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const arr = JSON.parse(window.localStorage.getItem(RECENTS_KEY) ?? "[]") as unknown;
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string").slice(0, MAX_RECENTS) : [];
  } catch {
    return [];
  }
}

function writeRecent(q: string) {
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
  | { kind: "recent"; id: string; query: string }
  | { kind: "destination"; id: string; entry: HubEntry };

/** Quick Access destinations matching the query (EN + Arabic labels/keywords).
 *  Second way to reach the pages moved from the sidebar into Settings. */
function matchingDestinations(q: string, lang: string): HubEntry[] {
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
  const stack = useNav((s) => s.stack);
  const uiLanguage = useSettings((s) => s.settings.uiLanguage);

  // Immersive surfaces (title detail / picker / player) hide the idle bar —
  // mirroring app-shell's showChrome — but an ALREADY-OPEN search stays up so
  // the "/" hotkey still reaches the single search surface from anywhere.
  const suppressed = useMemo(() => {
    for (let i = stack.length - 1; i >= 0; i--) {
      const f = stack[i];
      if (f.kind === "player" || f.kind === "picker" || f.kind === "detail") return true;
      return false;
    }
    return false;
  }, [stack]);

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
  const inputRef = useRef<HTMLInputElement>(null); // md+ bar input
  const mobileInputRef = useRef<HTMLInputElement>(null); // mobile sheet input
  const listRef = useRef<HTMLDivElement>(null);

  // Focus whichever input is on its active face (desktop bar / mobile sheet).
  const focusActiveInput = useCallback(() => {
    const desktop = window.matchMedia("(min-width: 768px)").matches;
    (desktop ? inputRef : mobileInputRef).current?.focus();
  }, []);

  // Expand + reveal + focus — shared by the hotkey bridge, the phone trigger
  // and the palette hand-off (one entry, same behavior everywhere).
  const expandAndFocus = useCallback(() => {
    setExpanded(true);
    setHidden(false); // hotkey reveal: never focus an off-screen bar
    setTimeout(() => setRecents(readRecents()), 0);
    setTimeout(() => focusActiveInput(), 20);
  }, [focusActiveInput]);

  // Focus bridge + palette prefill hand-off + outside click (desktop).
  useEffect(() => {
    const onFocus = () => expandAndFocus();
    const onPrefill = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail !== "string") return;
      const q = detail.trim().slice(0, 100);
      if (!q) return;
      setQuery(q);
      expandAndFocus();
    };
    const onPointer = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setExpanded(false);
        setActiveIdx(-1);
      }
    };
    window.addEventListener("harbor:focus-floating-search", onFocus);
    window.addEventListener("harbor:prefill-search", onPrefill);
    document.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("harbor:focus-floating-search", onFocus);
      window.removeEventListener("harbor:prefill-search", onPrefill);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [expandAndFocus]);

  // Mobile full-screen face: lock body scroll while the sheet is open (narrow
  // viewports only — the desktop dropdown never modally covers the page).
  useEffect(() => {
    if (!expanded) return;
    const mq = window.matchMedia("(max-width: 767.98px)");
    const apply = () => {
      document.body.style.overflow = mq.matches ? "hidden" : "";
    };
    apply();
    mq.addEventListener("change", apply);
    return () => {
      mq.removeEventListener("change", apply);
      document.body.style.overflow = "";
    };
  }, [expanded]);

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

  const collapse = useCallback(() => {
    setExpanded(false);
    setActiveIdx(-1);
  }, []);

  const openMeta = useCallback(
    (m: Meta) => {
      writeRecent(query || m.name);
      setRecents(readRecents());
      collapse();
      push({ kind: "detail", type: m.type, id: m.id });
    },
    [push, query, collapse],
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
        focusActiveInput();
      } else if (row?.kind === "destination") {
        collapse();
        push({ kind: "view", view: row.entry.view });
      } else if (row?.kind === "person" && row.url) {
        window.open(row.url, "_blank", "noopener");
      } else if (query.trim()) {
        // One search surface now: Enter opens the best quick match.
        const first = rows.find((r): r is Extract<FlatRow, { kind: "meta" }> => r.kind === "meta");
        if (first) openMeta(first.meta);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (query) {
        setQuery("");
      } else {
        collapse();
        focusActiveInput();
        inputRef.current?.blur();
        mobileInputRef.current?.blur();
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

  // All hooks above; only the idle presentation is suppressed on immersive
  // surfaces (an open search sheet/bar always renders).
  if (suppressed && !expanded) return null;

  return (
    <div
      ref={wrapRef}
      className={cn(
        // Fixed top. PHONES: 48×48 glass trigger at the top inline-END corner
        // (over the hero, safe-area offset) that expands THIS bar into the
        // full-screen glass search sheet; md+: docked centered bar. z:
        // --z-search-bar map.
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
      {/* PHONE TRIGGER — 48dp glass icon (shared glass recipe). Expands this
          bar into the full-screen glass sheet synchronously inside the tap
          gesture so mobile browsers honor the input focus. */}
      <button
        type="button"
        onClick={expandAndFocus}
        className="md:hidden md-state harbor-tv-focus flex h-12 w-12 items-center justify-center rounded-full glass-surface shadow-[0_10px_36px_-12px_rgba(0,0,0,0.65),0_2px_10px_rgba(0,0,0,0.3)]"
        aria-label="Search"
        aria-expanded={expanded}
        aria-haspopup="listbox"
        aria-controls="harbor-float-search-list"
      >
        <Search className="h-5 w-5 text-ink" aria-hidden />
      </button>

      {/* md+ docked bar — shared glass recipe, same values as the bottom nav */}
      <div
        className={cn(
          // M3 search bar shape: corner-full. Shared glass tokens (nav parity).
          "glass-surface hidden md:flex items-center gap-2 rounded-full",
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
              setTimeout(() => setRecents(readRecents()), 0);
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
                collapse();
              }}
              className="md-state md-icon-btn shrink-0 w-7! h-7!"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Results — ONE node, two faces (no second search UI): md+ = anchored
          glass dropdown card (M3 results view); phones = full-screen glass
          sheet with its own header. Shared rows/keyboard nav/ARIA below. */}
      {showDropdown && (
        <div
          id="harbor-float-search-list"
          role="listbox"
          aria-label="Search suggestions"
          ref={listRef}
          className={cn(
            "harbor-pop-in flex flex-col overflow-hidden fs-results",
            // Mobile: full-screen sheet over the page.
            "fixed inset-0 z-[var(--z-search-bar)]",
            // md+: anchored dropdown under the bar (glass card).
            "md:absolute md:inset-auto md:top-[calc(100%+8px)] md:inset-x-0 md:z-auto md:block md:rounded-[var(--md-sys-shape-corner-extra-large)] md:shadow-[var(--md-sys-elevation-3)]",
          )}
        >
          {/* Mobile sheet header: glass pill with input + close (md-hidden) */}
          <div className="md:hidden shrink-0 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
            <div className="glass-surface flex items-center gap-2 rounded-full h-12 px-3 shadow-[0_10px_36px_-12px_rgba(0,0,0,0.65),0_2px_10px_rgba(0,0,0,0.3)]">
              <Search className="w-4 h-4 text-ink-muted shrink-0" aria-hidden />
              <input
                ref={mobileInputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder="Search…"
                aria-label="Search movies, series, people and addons"
                aria-autocomplete="list"
                aria-controls="harbor-float-search-list"
                className="min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-ink-muted outline-none"
              />
              {searching && (
                <Loader2 className="w-4 h-4 text-accent animate-spin shrink-0" aria-hidden />
              )}
              <button
                type="button"
                onClick={collapse}
                className="md-state md-icon-btn shrink-0 w-7! h-7!"
                aria-label="Close search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto harbor-scroll overscroll-contain md:max-h-[min(58vh,26rem)] md:flex-none p-1.5">
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
                    {recents.map((r) => {
                      const idx = rows.findIndex((row) => row.id === `recent:${r}`);
                      return (
                        <RowShell
                          key={`recent-${r}`}
                          id={`fs-opt-${idx}`}
                          active={activeIdx === idx}
                          onHover={() => setActiveIdx(idx)}
                          onClick={() => {
                            setQuery(r);
                            focusActiveInput();
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
                              collapse();
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
                    No quick matches — try a different query.
                  </p>
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
