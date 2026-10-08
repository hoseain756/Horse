"use client";

// Harbor Web — Ratings row (Feature: ratings platforms)
// Compact provider chips on detail pages: icon-initial chip, score, votes,
// deep link. Skeletons while loading, graceful hiding when a provider has no
// data, ordering + toggles from Settings. Normalized to 0-10 internally; the
// original scale is shown in the tooltip.
import { useEffect, useMemo, useState } from "react";
import { Star } from "lucide-react";
import { useSettings } from "@/lib/harbor/store";
import { cn } from "@/lib/utils";

export type RatingChip = {
  provider: string;
  display: string;
  originalScale: string;
  votes?: number | null;
  url?: string;
};

/** Client-side view of the registry (id, label, chip color, key requirement). */
export const RATING_PROVIDERS: { id: string; label: string; color: string; needsKey: string }[] = [
  { id: "imdb", label: "IMDb", color: "bg-amber-500/90 text-black", needsKey: "OMDB_API_KEY" },
  { id: "rotten", label: "Rotten Tomatoes", color: "bg-red-600/90 text-white", needsKey: "OMDB_API_KEY" },
  { id: "metacritic", label: "Metacritic", color: "bg-emerald-600/90 text-white", needsKey: "OMDB_API_KEY" },
  { id: "tmdb", label: "TMDB", color: "bg-sky-600/90 text-white", needsKey: "TMDB key" },
  { id: "trakt", label: "Trakt", color: "bg-red-500/90 text-white", needsKey: "TRAKT_CLIENT_ID" },
  { id: "mdblist", label: "MDBList", color: "bg-teal-600/90 text-white", needsKey: "MDBLIST_API_KEY" },
  { id: "anilist", label: "AniList", color: "bg-violet-600/90 text-white", needsKey: "" },
  { id: "mal", label: "MyAnimeList", color: "bg-blue-500/90 text-white", needsKey: "" },
  { id: "kitsu", label: "Kitsu", color: "bg-orange-500/90 text-black", needsKey: "" },
];

function detectAnime(genres?: string[], country?: string): boolean {
  if (!genres?.includes("Animation")) return false;
  return !!country && /japan/i.test(country);
}

export function RatingsRow({
  type,
  imdbId,
  title,
  year,
  genres,
  country,
}: {
  type: string;
  imdbId?: string;
  title: string;
  year?: string;
  genres?: string[];
  country?: string;
}) {
  const settings = useSettings((s) => s.settings);
  const enabled = settings.ratingsEnabled && (type === "movie" || type === "series");
  const anime = detectAnime(genres, country);
  const [chips, setChips] = useState<RatingChip[] | null>(null); // null = loading
  const [dead, setDead] = useState(false);
  // Render-phase reset when the title changes (derived-state pattern — no
  // setState-in-effect, no flash of the previous title's ratings)
  const requestKey = `${type}|${imdbId ?? ""}|${title}|${year ?? ""}|${anime ? 1 : 0}|${enabled ? 1 : 0}`;
  const [prevKey, setPrevKey] = useState(requestKey);
  if (prevKey !== requestKey) {
    setPrevKey(requestKey);
    setChips(null);
    setDead(false);
  }

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    (async () => {
      try {
        const qs = new URLSearchParams({ type: type === "series" ? "series" : "movie" });
        if (imdbId) qs.set("imdb", imdbId);
        if (title) qs.set("title", title);
        if (year) qs.set("year", year.slice(0, 4));
        if (anime) qs.set("anime", "1");
        const res = await fetch(`/api/ratings?${qs.toString()}`, { signal: AbortSignal.timeout(12_000) });
        if (!alive) return;
        if (!res.ok) {
          setDead(true);
          return;
        }
        const data = (await res.json()) as { ratings?: RatingChip[] };
        setChips(Array.isArray(data.ratings) ? data.ratings : []);
      } catch {
        if (alive) setDead(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [enabled, type, imdbId, title, year, anime]);

  // Apply user ordering + hidden providers
  const ordered = useMemo(() => {
    if (!chips) return null;
    const order = settings.ratingsProviders;
    if (order.length === 0) return chips;
    const idx = (p: string) => {
      const i = order.indexOf(p);
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };
    return [...chips].sort((a, b) => idx(a.provider) - idx(b.provider));
  }, [chips, settings.ratingsProviders]);

  if (!enabled || dead) return null;

  return (
    <div
      className="flex items-center gap-1.5 flex-wrap"
      role="group"
      aria-label="Ratings"
      data-anime={anime ? "1" : undefined}
    >
      {ordered === null &&
        Array.from({ length: 3 }).map((_, i) => (
          <span key={i} className="harbor-skeleton h-[22px] w-16 rounded-full" aria-hidden />
        ))}
      {ordered?.map((c) => {
        const meta = RATING_PROVIDERS.find((p) => p.id === c.provider);
        return (
          <a
            key={c.provider}
            href={c.url}
            target="_blank"
            rel="noreferrer noopener"
            title={`${meta?.label ?? c.provider}: ${c.display}${c.originalScale}${c.votes ? ` · ${c.votes.toLocaleString()} votes` : ""}`}
            className="harbor-tv-focus flex items-center gap-1 rounded-full border border-edge-soft bg-black/30 px-2 py-0.5 text-[11px] font-semibold text-ink backdrop-blur-sm hover:border-accent/60 transition-colors"
          >
            <span className={cn("rounded-full px-1.5 py-px text-[9px] font-black tracking-wide", meta?.color ?? "bg-raised text-ink")}>
              {meta?.label ?? c.provider}
            </span>
            <span className="tabular-nums">{c.display}</span>
            {c.originalScale !== "/10" && <span className="text-ink-subtle font-normal">{c.originalScale === "%" ? "" : c.originalScale}</span>}
            {c.votes != null && c.votes > 0 && <span className="text-ink-subtle font-normal">{compactVotes(c.votes)}</span>}
          </a>
        );
      })}
      {ordered !== null && ordered.length === 0 && (
        <span className="flex items-center gap-1 rounded-full border border-edge-soft bg-black/30 px-2 py-0.5 text-[11px] text-ink-subtle backdrop-blur-sm">
          <Star className="w-3 h-3" aria-hidden /> No ratings available
        </span>
      )}
    </div>
  );
}

function compactVotes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1000)}K`;
  return String(n);
}

/** Settings → Integrations card: enable ratings + per-provider order/toggles. */
export function RatingsSettingsCard() {
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  const order = settings.ratingsProviders;

  const visible = useMemo(() => {
    // Show all registry providers; ones present in `order` first (in order),
    // then the rest in registry order.
    const inOrder = order.map((id) => RATING_PROVIDERS.find((p) => p.id === id)).filter(Boolean) as typeof RATING_PROVIDERS;
    const rest = RATING_PROVIDERS.filter((p) => !order.includes(p.id));
    return [...inOrder, ...rest];
  }, [order]);

  const toggle = (id: string) => {
    const next = order.includes(id) ? order.filter((x) => x !== id) : [...order, id];
    update({ ratingsProviders: next });
  };
  const move = (id: string, dir: -1 | 1) => {
    const arr = [...order];
    const i = arr.indexOf(id);
    if (i === -1) return;
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    update({ ratingsProviders: arr });
  };

  return (
    <div className="rounded-2xl border border-edge-soft bg-elevated p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-1">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-accent-soft flex items-center justify-center">
            <Star className="w-5 h-5 text-accent" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-ink">Ratings</h3>
            <p className="text-xs text-ink-subtle">
              Scores shown on detail pages. Providers without a configured key are hidden
              automatically; anime titles also pull AniList / MAL / Kitsu.
            </p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs text-ink-muted cursor-pointer select-none">
          <input
            type="checkbox"
            checked={settings.ratingsEnabled}
            onChange={(e) => update({ ratingsEnabled: e.target.checked })}
            className="accent-[var(--color-accent-var)] w-4 h-4"
            aria-label="Show ratings on detail pages"
          />
          Enabled
        </label>
      </div>

      <ul className="mt-3 space-y-1" aria-label="Ratings providers (order = display order)">
        {visible.map((p, i) => {
          const active = order.includes(p.id);
          return (
            <li
              key={p.id}
              className="flex items-center gap-2.5 rounded-xl border border-edge-soft bg-raised/50 px-3 py-2"
            >
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-black", p.color)}>{p.label}</span>
              {!active && <span className="text-[10px] text-ink-subtle">default position</span>}
              {p.needsKey && <span className="text-[10px] text-ink-subtle hidden md:inline">needs {p.needsKey}</span>}
              <span className="ms-auto flex items-center gap-1">
                {active && (
                  <>
                    <button
                      type="button"
                      onClick={() => move(p.id, -1)}
                      disabled={i === 0}
                      className="harbor-tv-focus w-7 h-7 rounded-lg bg-raised text-ink-muted hover:text-ink disabled:opacity-40"
                      aria-label={`Move ${p.label} up`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => move(p.id, 1)}
                      disabled={i === order.length - 1}
                      className="harbor-tv-focus w-7 h-7 rounded-lg bg-raised text-ink-muted hover:text-ink disabled:opacity-40"
                      aria-label={`Move ${p.label} down`}
                    >
                      ↓
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => toggle(p.id)}
                  aria-pressed={active}
                  className={cn(
                    "harbor-tv-focus rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                    active ? "bg-accent-soft text-accent" : "bg-raised text-ink-muted hover:text-ink",
                  )}
                >
                  {active ? "Ordered" : "Default"}
                </button>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[10px] text-ink-subtle">
        “Ordered” providers appear first in the given sequence; everything else follows in default
        order. Hidden automatically when a provider has no data or no key.
      </p>
    </div>
  );
}
