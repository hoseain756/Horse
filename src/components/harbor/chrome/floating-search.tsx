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
  const [tvOpen, setTvOpen] = useState(false); // TV band (≥1600) fullscreen face
  const [tvBand, setTvBand] = useState(false); // ≥1600 window class
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

  // Size bands (round 25): the desktop face moved 768→600 so the whole
  // tablet band gets the large search; the TV band (≥1600) gets the
  // fullscreen face (the idle bar becomes a focusable glass button).
  useEffect(() => {
    const tv = window.matchMedia("(min-width: 1600px)");
    const apply = () => {
      setTvBand(tv.matches);
      if (!tv.matches) setTvOpen(false); // leaving the TV band closes the overlay
    };
    apply();
    tv.addEventListener("change", apply);
    return () => tv.removeEventListener("change", apply);
  }, []);

  // TV fullscreen face: lock body scroll while open (modal surface).
  useEffect(() => {
    if (!tvOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [tvOpen]);

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

  const closeTv = useCallback(() => {
    setTvOpen(false);
    setActiveIdx(-1);
  }, []);

  const openTv = useCallback(() => {
    setExpanded(false);
    setTvOpen(true);
    setHidden(false);
    setTimeout(() => setRecents(readRecents()), 0);
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
    if (e.key === "Escape" && tvOpen) {
      e.preventDefault();
      e.stopPropagation();
      if (query) setQuery("");
      else closeTv();
      return;
    }
    if (e.key === "ArrowDown" && tvOpen && rows.length > 0) {
      // D-pad: from the TV input straight into the results grid.
      e.preventDefault();
      const first = listRef.current?.querySelector<HTMLElement>("[role='option'], .fs-tv-card");
      first?.focus();
      return;
    }
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
  const showDropdown = expanded && !tvBand;

  // All hooks above; only the idle presentation is suppressed on immersive
  // surfaces (an open search sheet/bar always renders).
  if (suppressed && !expanded && !tvOpen) return null;

  return (
    <div
      ref={wrapRef}
      className={cn(
        // Fixed top. PHONES (<600): 48×48 glass trigger at the top inline-END
        // corner (over the hero, safe-area offset) that expands THIS bar into
        // the full-screen glass search sheet. ≥600: floating glass pill
        // centered INSIDE the content area — the anchor box starts at
        // --fs-anchor-start (the side-rail inset at ≥1024) so the bar and its
        // popover can never overlap the side nav. z: --z-search-bar map.
        "fixed z-[var(--z-search-bar)] top-[max(0.75rem,env(safe-area-inset-top))] end-3",
        "min-[600px]:end-3 min-[600px]:start-[var(--fs-anchor-start)] min-[600px]:mx-auto",
        "w-12 min-[600px]:w-60",
        // Expand on focus + hide/reveal on scroll direction (smooth; motion-reduce users get instant snap)
        "transition-[width,transform,opacity] duration-300 ease-[var(--md-sys-motion-easing-emphasized)] motion-reduce:transition-none",
        expanded && "min-[600px]:w-[min(var(--fs-bar-max-w),calc(100vw-var(--fs-anchor-start)-24px))]",
        // Scrolled-down: slide the bar fully off-screen. invisible: aria-hidden
        // subtrees must not keep focusable controls.
        hidden && !tvOpen && "-translate-y-[160%] opacity-0 invisible pointer-events-none",
      )}
      aria-hidden={(hidden && !tvOpen) || undefined}
    >
      {/* PHONE TRIGGER — 48dp glass icon (shared glass recipe). Expands this
          bar into the full-screen glass sheet synchronously inside the tap
          gesture so mobile browsers honor the input focus. */}
      <button
        type="button"
        onClick={expandAndFocus}
        className="min-[600px]:hidden md-state harbor-tv-focus flex h-12 w-12 items-center justify-center rounded-full glass-surface shadow-[0_10px_36px_-12px_rgba(0,0,0,0.65),0_2px_10px_rgba(0,0,0,0.3)]"
        aria-label="Search"
        aria-expanded={expanded}
        aria-haspopup="listbox"
        aria-controls="harbor-float-search-list"
      >
        <Search className="h-5 w-5 text-ink" aria-hidden />
      </button>

      {/* ≥600 docked bar — shared glass recipe, same values as the navs. On
          the TV band (≥1600) the field is a focusable glass BUTTON: selecting
          it opens the fullscreen search view (D-pad friendly); on laptop/
          tablet it focuses the inline combobox as before. */}
      <div
        className={cn(
          "fs-shell glass-surface hidden min-[600px]:flex items-center gap-2 rounded-full w-full",
          "shadow-[0_10px_36px_-12px_rgba(0,0,0,0.65),0_2px_10px_rgba(0,0,0,0.3)]",
          "transition-shadow duration-300",
          expanded && !tvBand && "shadow-[0_18px_50px_-12px_rgba(0,0,0,0.75)]",
        )}
        onClick={tvBand ? openTv : undefined}
        data-tv-trigger={tvBand ? "true" : undefined}
      >
        <div
          className="flex items-center gap-2 px-2.5 min-[600px]:px-4 h-11 min-[600px]:h-14 w-full"
          role={tvBand ? undefined : "combobox"}
          aria-expanded={tvBand ? undefined : showDropdown && rows.length >= 0}
          aria-controls={tvBand ? undefined : "harbor-float-search-list"}
          aria-haspopup={tvBand ? undefined : "listbox"}
        >
          <Search className="w-4 h-4 min-[600px]:w-5 min-[600px]:h-5 text-ink-muted shrink-0" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (tvBand) {
                openTv(); // TV: the field is a glass button — selecting it opens fullscreen
                return;
              }
              setExpanded(true);
              setHidden(false);
              setTimeout(() => setRecents(readRecents()), 0);
            }}
            onKeyDown={onInputKeyDown}
            readOnly={tvBand}
            placeholder="Search…"
            aria-label="Search movies, series, people and addons"
            aria-autocomplete={tvBand ? undefined : "list"}
            className={cn(
              "fs-input min-w-0 flex-1 self-stretch bg-transparent text-sm min-[600px]:text-base text-ink placeholder:text-ink-muted outline-none",
              !expanded && "min-[600px]:opacity-100 opacity-0 min-[600px]:pointer-events-auto pointer-events-none w-0 min-[600px]:w-auto",
              tvBand && "cursor-pointer",
            )}
            tabIndex={tvBand || expanded ? 0 : -1}
          />
          {searching && <Loader2 className="w-4 h-4 text-accent animate-spin shrink-0" aria-hidden />}
          <kbd
            className={cn(
              "harbor-kbd shrink-0 hidden min-[600px]:inline-flex",
              (expanded || query || tvBand) && "hidden",
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

      {/* Results — ONE node, two faces (no second search UI): ≥600 = anchored
          glass dropdown card (M3 results view); phones = full-screen glass
          sheet with its own header; the TV band uses the fullscreen view
          below instead. Shared rows/keyboard nav/ARIA below. */}
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
            // ≥600: anchored dropdown under the bar (glass card).
            "min-[600px]:absolute min-[600px]:inset-auto min-[600px]:top-[calc(100%+8px)] min-[600px]:inset-x-0 min-[600px]:z-auto min-[600px]:block min-[600px]:rounded-[var(--md-sys-shape-corner-extra-large)] min-[600px]:shadow-[var(--md-sys-elevation-3)]",
          )}
        >
          {/* Mobile sheet header: glass pill with input + close (≥600 hidden) */}
          <div className="min-[600px]:hidden shrink-0 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
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

          <div className="min-h-0 flex-1 overflow-y-auto harbor-scroll overscroll-contain min-[600px]:max-h-[min(58vh,26rem)] min-[600px]:flex-none p-1.5">
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

      {/* TV fullscreen search view (≥1600 band, opened from the glass pill):
          large type, large results grid, D-pad friendly (arrow keys rove via
          the shared TV navigation; Enter selects; Esc goes back / clears).
          Same ONE search state/engine — presentation only. */}
      {tvOpen && (
        <div className="fs-tv-overlay harbor-pop-in" role="dialog" aria-modal="true" aria-label="Search">
          <div className="fs-tv-bar">
            <Search className="h-6 w-6 text-ink-muted shrink-0" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="Search movies, series, people…"
              aria-label="Search movies, series, people and addons"
              aria-autocomplete="list"
              autoFocus
            />
            {searching && <Loader2 className="h-5 w-5 text-accent animate-spin shrink-0" aria-hidden />}
            <button
              type="button"
              onClick={closeTv}
              className="md-state md-icon-btn shrink-0"
              aria-label="Close search"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {query.trim().length < 2 && recents.length > 0 && (
            <div className="fs-tv-grid mt-6" role="group" aria-label="Recent searches">
              {recents.slice(0, 6).map((r) => (
                <button
                  key={`tv-recent-${r}`}
                  type="button"
                  className="fs-tv-card harbor-tv-focus flex items-center gap-2 px-4 py-3"
                  onClick={() => {
                    setQuery(r);
                    setTimeout(() => setRecents(readRecents()), 0);
                  }}
                >
                  <Clock className="h-4 w-4 text-ink-muted shrink-0" aria-hidden />
                  <span className="truncate text-sm font-semibold">{r}</span>
                </button>
              ))}
            </div>
          )}

          <div ref={listRef} className="fs-tv-grid" role="listbox" aria-label={query.trim().length < 2 ? "Trending now" : "Search results"}>
            {(query.trim().length < 2
              ? trending
              : [...movies, ...series, ...addonHits]
            )
              .slice(0, 24)
              .map((m) => (
                <button
                  key={`tv-${m.type}-${m.id}`}
                  type="button"
                  role="option"
                  aria-selected="false"
                  tabIndex={0}
                  className="fs-tv-card harbor-tv-focus"
                  onClick={() => {
                    writeRecent(query || m.name);
                    setRecents(readRecents());
                    closeTv();
                    push({ kind: "detail", type: m.type, id: m.id });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.preventDefault();
                      e.stopPropagation();
                      closeTv();
                    }
                  }}
                >
                  <span className="fs-tv-poster" aria-hidden>
                    {m.poster ? <PosterImage src={m.poster} alt="" className="absolute inset-0" /> : null}
                  </span>
                  <span className="fs-tv-name">{m.name}</span>
                </button>
              ))}
            {query.trim().length >= 2 && !hasResults && !searching && (
              <p className="col-span-full py-10 text-center text-base text-ink-subtle">
                No results — try a different query.
              </p>
            )}
            {query.trim().length >= 2 && !hasResults && searching && (
              <p className="col-span-full py-10 text-center text-base text-ink-subtle">Searching…</p>
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
