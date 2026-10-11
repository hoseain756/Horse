"use client";

// Harbor Web — search overlay with AI mode (port of Harbor search-overlay.tsx + ai-search)
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Search, Sparkles, X, Wand2 } from "lucide-react";
import { useNav } from "@/lib/harbor/store";
import type { Meta } from "@/lib/harbor/types";
import { fetchCinemetaCatalog, searchAddonCatalogs, searchCinemeta } from "@/lib/harbor/api";
import { installedAddons, useAddons } from "@/lib/harbor/store";
import { MetaCard } from "../common/meta-card";

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

  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [movies, setMovies] = useState<Meta[]>([]);
  const [series, setSeries] = useState<Meta[]>([]);
  const [addonHits, setAddonHits] = useState<Meta[]>([]);
  const [aiPicks, setAiPicks] = useState<Meta[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [aiMode, setAiMode] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const runToken = useRef(0);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 30);
      document.body.style.overflow = "hidden";
      // Round 9 (additive): apply a prefill handed over by the command palette
      // (dispatched before it opened this overlay). 0ms timeout keeps setState
      // out of the effect body (codebase lint pattern); it fires well before
      // the 30ms focus timer, so the query is applied within the same open tick.
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
    }
    return () => {
      document.body.style.overflow = "";
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
      setOpen(false);
      push({ kind: "detail", type: m.type, id: m.id });
    },
    [push, setOpen],
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

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex justify-center overflow-y-auto harbor-scroll"
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-4xl bg-canvas/95 border border-edge rounded-b-2xl shadow-2xl min-h-fit"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-canvas/95 backdrop-blur border-b border-edge-soft p-4">
          <div className="flex items-center gap-3">
            <Search className="w-5 h-5 text-ink-subtle shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && aiMode) runSearch(query, true);
              }}
              placeholder={
                aiMode
                  ? "Describe what you feel like watching… (Enter)"
                  : "Search movies, series, addons…"
              }
              className="flex-1 bg-transparent text-lg text-ink placeholder:text-ink-subtle outline-none"
              aria-label="Search query"
            />
            {phase === "searching" || phase === "ai-thinking" ? (
              <Loader2 className="w-5 h-5 text-accent animate-spin" />
            ) : null}
            <button
              type="button"
              onClick={() => setAiMode((v) => !v)}
              className={`harbor-tv-focus flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                aiMode
                  ? "bg-accent text-black"
                  : "text-ink-muted hover:text-ink border border-edge-soft"
              }`}
              aria-pressed={aiMode}
              title="AI mode: describe what you want to watch"
            >
              {aiMode ? <Wand2 className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
              AI
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="harbor-tv-focus w-8 h-8 rounded-lg flex items-center justify-center text-ink-muted hover:text-ink hover:bg-raised"
              aria-label="Close search"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-6 pb-16">
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
            <div className="text-center py-16 text-ink-subtle">
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
      <h3 className="text-sm font-semibold text-ink-muted uppercase tracking-wide mb-3 px-1">
        {title}
      </h3>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {metas.map((m) => (
          <MetaCard key={`${m.type}:${m.id}`} meta={m} onOpen={() => onOpen(m)} />
        ))}
      </div>
    </section>
  );
}
