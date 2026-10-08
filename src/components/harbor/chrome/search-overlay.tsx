"use client";

// Harbor Web — search overlay with AI mode (port of Harbor search-overlay.tsx + ai-search)
// M3: mobile (<sm) = full-screen search view on surface-container-low with a
// large top app-bar header (back arrow icon button + input); desktop = docked
// panel (corner-extra-large, surface-container-high, elevation-3). Results are
// M3 list items on mobile, poster grid on sm+.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, Clock, Loader2, Search, Sparkles, X, Wand2 } from "lucide-react";
import { useNav, useSettings } from "@/lib/harbor/store";
import type { Meta } from "@/lib/harbor/types";
import { fetchCinemetaCatalog, searchAddonCatalogs, searchCinemeta } from "@/lib/harbor/api";
import { installedAddons, useAddons } from "@/lib/harbor/store";
import { hubDesc, hubLabel, type HubEntry } from "./nav-items";
import { matchingDestinations, readRecents, writeRecent } from "./floating-search";
import { HorseMark } from "./brand";
import { MetaCard } from "../common/meta-card";
import { PosterImage } from "../common/poster";
import { cn } from "@/lib/utils";

type Phase = "idle" | "searching" | "ai-thinking" | "done" | "error";

// Round 9 (additive): pending search prefill from the command palette.
// The palette dispatches "harbor:prefill-search" BEFORE it opens this overlay;
// the window listener below stores the query here and the open-effect consumes
// it (then clears it) so the prefill applies exactly once.
let pendingPrefill: string | null = null;

export function SearchOverlay() {
  const open = useNav((s) => s.searchOpen);
  const setOpen = useNav((s) => s.setSearchOpen);
  const push = useNav((s) => s.push);
  const addons = useAddons((s) => s.addons);
  const uiLanguage = useSettings((s) => s.settings.uiLanguage) || "en";

  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [movies, setMovies] = useState<Meta[]>([]);
  const [series, setSeries] = useState<Meta[]>([]);
  const [addonHits, setAddonHits] = useState<Meta[]>([]);
  const [aiPicks, setAiPicks] = useState<Meta[]>([]);
  const [recents, setRecents] = useState<string[]>([]);
  const [trending, setTrending] = useState<Meta[]>([]);
  const [kbInset, setKbInset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [aiMode, setAiMode] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const backGuard = useRef(false);
  const runToken = useRef(0);

  // Focus SYNCHRONOUSLY in the commit that follows the opening tap — mobile
  // browsers only honor programmatic focus inside the active user gesture;
  // the old setTimeout(30) dropped the virtual keyboard on iOS/Android.
  useLayoutEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (open) {
      lastFocus.current = document.activeElement as HTMLElement | null;
      document.body.style.overflow = "hidden";
      // localStorage read + setState inside a timer (codebase lint pattern)
      setTimeout(() => setRecents(readRecents()), 0);
      // Round 9 (additive): apply a prefill handed over by the command palette
      // (dispatched before it opened this overlay). 0ms timeout keeps setState
      // out of the effect body (codebase lint pattern); it fires well before
      // the layout-effect focus, so the query is applied within the same tick.
      if (pendingPrefill) {
        const prefill = pendingPrefill;
        pendingPrefill = null;
        setTimeout(() => {
          setQuery(prefill);
          setPhase("idle");
        }, 0);
      }
    } else {
      document.body.style.overflow = "";
      // Restore focus to the trigger when the overlay closes (round-22)
      if (lastFocus.current) {
        lastFocus.current.focus?.();
        lastFocus.current = null;
      }
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Android/system back gesture: push a history entry on open so browser Back
  // closes the search instead of leaving the page; a UI close consumes the
  // pushed entry (no dead clicks, no double-back).
  useEffect(() => {
    if (!open) return;
    backGuard.current = false;
    history.pushState({ harborSearch: true }, "");
    const onPop = () => {
      backGuard.current = true;
      setOpen(false);
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (!backGuard.current) {
        try {
          if (history.state?.harborSearch) history.back();
        } catch {
          /* sandboxed/history edge — ignore */
        }
      }
    };
  }, [open, setOpen]);

  // Virtual keyboard: pad the results area by the keyboard overlap so the last
  // rows stay reachable. iOS keeps the layout viewport (overlap > 0); Android
  // resize shrinks innerHeight (overlap ≈ 0) — the math covers both.
  useEffect(() => {
    if (!open || typeof window === "undefined" || !window.visualViewport) return;
    const vv = window.visualViewport;
    const update = () => {
      const overlap = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      setKbInset((prev) => (prev === overlap ? prev : overlap));
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [open]);

  // Trending suggestions for the idle state — fetched once per session
  // (shared budget with the floating bar's idle list; errors stay silent).
  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      const [mv, sr] = await Promise.allSettled([
        fetchCinemetaCatalog("movie", "trending"),
        fetchCinemetaCatalog("series", "trending"),
      ]);
      if (!alive) return;
      setTrending([
        ...(mv.status === "fulfilled" ? mv.value : []),
        ...(sr.status === "fulfilled" ? sr.value : []),
      ].slice(0, 8));
    })();
    return () => {
      alive = false;
    };
  }, [open]);

  // Round 9 (additive): palette → overlay prefill bridge. SearchOverlay mounts
  // once in app-shell, so this listener lives for the app's lifetime.
  useEffect(() => {
    const onPrefill = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail !== "string") return;
      const q = detail.trim().slice(0, 100);
      if (q) pendingPrefill = q;
    };
    window.addEventListener("harbor:prefill-search", onPrefill);
    return () => window.removeEventListener("harbor:prefill-search", onPrefill);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !open) {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
          return;
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  const openMeta = useCallback(
    (m: Meta) => {
      writeRecent(query || m.name);
      setOpen(false);
      push({ kind: "detail", type: m.type, id: m.id });
    },
    [push, setOpen, query],
  );

  const runSearch = useCallback(
    async (q: string, useAi: boolean) => {
      if (!q.trim()) return;
      const token = ++runToken.current;
      setPhase(useAi ? "ai-thinking" : "searching");
      setError(null);
      setMovies([]);
      setSeries([]);
      setAddonHits([]);
      setAiPicks([]);

      try {
        if (useAi) {
          // AI path: ask LLM for titles, then resolve each via cinemeta search
          const res = await fetch("/api/ai/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: q }),
          });
          const data = (await res.json()) as { titles?: string[]; error?: string };
          if (token !== runToken.current) return;
          const titles = data.titles ?? [];
          const resolved: Meta[] = [];
          for (const title of titles.slice(0, 10)) {
            try {
              const { movies: mv, series: sr } = await searchCinemeta(title);
              const first = mv[0] ?? sr[0];
              if (first) resolved.push(first);
            } catch {
              /* skip unresolvable */
            }
            if (token !== runToken.current) return;
          }
          setAiPicks(resolved);
        } else {
          const [cinemeta, addonResults] = await Promise.allSettled([
            searchCinemeta(q),
            searchAddonCatalogs(installedAddons(), q),
          ]);
          if (token !== runToken.current) return;
          if (cinemeta.status === "fulfilled") {
            setMovies(cinemeta.value.movies);
            setSeries(cinemeta.value.series);
          }
          if (addonResults.status === "fulfilled") {
            setAddonHits(addonResults.value);
          }
          if (cinemeta.status === "rejected" && addonResults.status === "rejected") {
            setError("Search failed. Check your connection and try again.");
          }
        }
        setPhase("done");
      } catch {
        if (token !== runToken.current) return;
        setError("Something went wrong. Try again.");
        setPhase("error");
      }
    },
    [],
  );

  // debounced plain search
  useEffect(() => {
    if (!open || aiMode) return;
    const q = query.trim();
    if (q.length < 2) {
      const reset = setTimeout(() => {
        setPhase("idle");
        setMovies([]);
        setSeries([]);
        setAddonHits([]);
      }, 0);
      return () => clearTimeout(reset);
    }
    const t = setTimeout(() => runSearch(q, false), 350);
    return () => clearTimeout(t);
  }, [query, open, aiMode, runSearch]);

  if (!open) return null;

  const hasResults = movies.length + series.length + addonHits.length + aiPicks.length > 0;
  const dests: HubEntry[] = query.trim().length >= 2 ? matchingDestinations(query, uiLanguage) : [];

  return (
    <div
      className="fixed inset-0 z-[var(--z-search-overlay)] bg-black/70 backdrop-blur-sm flex justify-center overflow-y-auto harbor-scroll"
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      onClick={() => setOpen(false)}
    >
      <div
        className={cn(
          // Mobile: full-screen M3 search view (surface-container-low).
          // Desktop: docked panel, corner-extra-large, surface-container-high, elevation-3.
          "w-full min-h-full sm:min-h-[60vh] sm:h-auto sm:max-w-4xl sm:my-[6vh]",
          "bg-[var(--md-sys-color-surface-container-low)] sm:bg-[var(--md-sys-color-surface-container-high)]",
          "sm:rounded-[var(--md-sys-shape-corner-extra-large)] sm:shadow-[var(--md-sys-elevation-3)] shadow-2xl",
          "flex flex-col",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top app bar (mobile) / docked header (desktop) */}
        <div
          className={cn(
            "sticky top-0 z-10 bg-inherit border-b border-edge-soft",
            "px-2 sm:px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 sm:pt-4 sm:pb-4",
          )}
        >
          <div className="flex items-center gap-1 sm:gap-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="md-state md-icon-btn harbor-tv-focus sm:hidden shrink-0"
              aria-label="Close search"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <Search className="hidden sm:block w-5 h-5 text-ink-subtle shrink-0" aria-hidden />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && aiMode) runSearch(query, true);
              }}
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              placeholder={
                aiMode
                  ? "Describe what you feel like watching… (Enter)"
                  : "Search movies, series, addons…"
              }
              className="flex-1 min-w-0 bg-transparent text-base sm:text-lg text-ink placeholder:text-ink-subtle outline-none"
              aria-label="Search query"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
                className="md-state md-icon-btn harbor-tv-focus shrink-0"
                aria-label="Clear query"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            {phase === "searching" || phase === "ai-thinking" ? (
              <Loader2 className="w-5 h-5 text-accent animate-spin shrink-0" aria-hidden />
            ) : null}
            <button
              type="button"
              onClick={() => setAiMode((v) => !v)}
              className={cn(
                "md-chip md-state harbor-tv-focus h-8 shrink-0",
                aiMode && "md-chip-selected",
              )}
              aria-pressed={aiMode}
              title="AI mode: describe what you want to watch"
            >
              {aiMode ? <Wand2 className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
              AI
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="md-state md-icon-btn harbor-tv-focus hidden sm:inline-flex shrink-0"
              aria-label="Close search"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-6" style={{ paddingBottom: `calc(4rem + ${kbInset}px)` }}>
          {error && (
            <div className="rounded-xl border border-danger/40 bg-danger/10 text-danger px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {aiPicks.length > 0 && (
            <SearchSection title="AI Picks" metas={aiPicks} onOpen={openMeta} />
          )}
          {movies.length > 0 && (
            <SearchSection title="Movies" metas={movies} onOpen={openMeta} />
          )}
          {series.length > 0 && (
            <SearchSection title="Series" metas={series} onOpen={openMeta} />
          )}
          {dests.length > 0 && (
            <section aria-label="Go to">
              <h3 className="md-label-medium text-ink-muted uppercase tracking-wide mb-3 px-1">
                Go to
              </h3>
              <ul className="space-y-0.5">
                {dests.map((entry) => {
                  const Icon = entry.icon;
                  return (
                    <li key={entry.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setOpen(false);
                          push({ kind: "view", view: entry.view });
                        }}
                        className="md-state harbor-tv-focus flex w-full items-center gap-3 rounded-[var(--md-sys-shape-corner-medium)] px-2 py-2 text-start"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft" aria-hidden>
                          <Icon className="w-4 h-4 text-accent" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-ink">{hubLabel(entry, uiLanguage)}</span>
                          <span className="block text-xs text-ink-subtle truncate">{hubDesc(entry, uiLanguage)}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          {addonHits.length > 0 && (
            <SearchSection title="From your addons" metas={addonHits} onOpen={openMeta} />
          )}

          {phase === "done" && !hasResults && query.trim().length >= 2 && (
            <div className="text-center py-16 text-ink-subtle">
              <Search className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No results for “{query}”.</p>
              <p className="text-xs mt-1">
                Install more addons to expand your catalog coverage.
              </p>
            </div>
          )}

          {phase === "idle" && (
            <div className="space-y-5">
              {/* Brand lockup: primary mark + wordmark — the idle search view is
                  the app's most-seen full-screen surface on phones */}
              <div className="flex items-center justify-center gap-2.5 pt-2 pb-1">
                <HorseMark className="h-9 w-auto text-accent" label="Horse logo" />
                <span className="font-display text-2xl font-bold tracking-tight text-ink">
                  Horse
                </span>
              </div>
              {recents.length > 0 && (
                <section aria-label="Recent searches">
                  <h3 className="md-label-medium text-ink-muted uppercase tracking-wide mb-2 px-1">
                    Recent
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {recents.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => {
                          setQuery(r);
                          inputRef.current?.focus();
                        }}
                        className="md-chip md-state harbor-tv-focus h-8 max-w-full"
                      >
                        <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden />
                        <span className="truncate">{r}</span>
                      </button>
                    ))}
                  </div>
                </section>
              )}
              {trending.length > 0 ? (
                <SearchSection
                  title="Trending now"
                  metas={trending}
                  onOpen={openMeta}
                />
              ) : (
                <div className="text-center py-10 text-ink-subtle">
                  <Search className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">
                    Type to search Cinemeta and your installed addons.
                  </p>
                  <p className="text-xs mt-1">
                    Tip: toggle <Sparkles className="inline w-3 h-3 -mt-0.5" /> AI mode to describe
                    what you feel like watching.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SearchSection({
  title,
  metas,
  onOpen,
}: {
  title: string;
  metas: Meta[];
  onOpen: (m: Meta) => void;
}) {
  return (
    <section aria-label={title}>
      <h3 className="md-label-medium text-ink-muted uppercase tracking-wide mb-3 px-1">
        {title}
      </h3>
      {/* Mobile: M3 list items (thumbnail + headline/supporting text, state layer) */}
      <ul className="sm:hidden space-y-0.5">
        {metas.map((m) => (
          <li key={`${m.type}:${m.id}`}>
            <button
              type="button"
              onClick={() => onOpen(m)}
              className="md-state harbor-tv-focus flex w-full items-center gap-3 rounded-[var(--md-sys-shape-corner-medium)] px-2 py-2 text-start"
            >
              <span
                className="relative block h-14 w-10 shrink-0 overflow-hidden rounded-[var(--md-sys-shape-corner-small)] bg-raised border border-edge-soft"
                aria-hidden
              >
                {m.poster ? (
                  <PosterImage src={m.poster} alt="" className="absolute inset-0" />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <Search className="w-4 h-4 text-ink-subtle" />
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-ink">{m.name}</span>
                <span className="block text-xs text-ink-subtle">
                  {m.type === "series" ? "Series" : "Movie"}
                  {m.releaseInfo ? ` · ${m.releaseInfo}` : ""}
                  {m.imdbRating ? ` · ★ ${m.imdbRating}` : ""}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {/* sm+: poster grid */}
      <div className="hidden sm:grid grid-cols-4 md:grid-cols-6 gap-3">
        {metas.map((m) => (
          <MetaCard key={`${m.type}:${m.id}`} meta={m} onOpen={() => onOpen(m)} />
        ))}
      </div>
    </section>
  );
}
