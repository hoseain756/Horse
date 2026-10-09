"use client";

// Harbor Web — Anime view
// Powered by AniList (public metadata, no auth) via the /api/anilist server proxy.
// Cards resolve to playable Stremio metas through Cinemeta search on click.
// A "Stremio catalogs" section below shows Cinemeta anime rails + addon catalogs.
// M3 (m3-3c): header → md-headline-small, rail headers → md-title-medium, CTAs →
// .md-btn-filled/.md-btn-tonal, badges → .md-chip with on-media scrim overrides.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, Flame, Trophy, CalendarClock, Film, RotateCcw, ListVideo, SearchX } from "lucide-react";
import { useNav, useAddons } from "@/lib/harbor/store";
import {
  animeTrending,
  animeThisSeason,
  animeAllTime,
  animeMovies,
  animeUpcoming,
  mediaTitle,
  coverOf,
  resolveAnimeMeta,
  anilistUrl,
  type AniListMedia,
} from "@/lib/harbor/anilist";
import { Rail, RailSkeleton } from "../common/rail";
import { PosterImage } from "../common/poster";
import { SectionRails, type SectionSpec } from "./section-rails";
import { cn } from "@/lib/utils";

type RowState = {
  items: AniListMedia[];
  loading: boolean;
  failed: boolean;
};

type RowKey = "trending" | "season" | "alltime" | "movies" | "upcoming";

const ROW_META: { key: RowKey; title: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "trending", title: "Trending Now", icon: Flame },
  { key: "season", title: "Popular This Season", icon: Sparkles },
  { key: "alltime", title: "All-Time Best", icon: Trophy },
  { key: "movies", title: "Anime Movies", icon: Film },
  { key: "upcoming", title: "Upcoming Next Season", icon: CalendarClock },
];

/* M3 chip on media (AniList banners/cards): .md-chip primitives are unlayered CSS,
   so scrim overrides use `!` importance. On-media badges keep a dark scrim + light
   text in BOTH appearances (same readability contract as .harbor-subtitle). */
const MEDIA_CHIP = "md-chip md-label-small !h-6 !gap-1 !px-2 !border-0 !bg-black/60 backdrop-blur-sm cursor-default!";

export function AnimeView() {
  const push = useNav((s) => s.push);
  const addons = useAddons((s) => s.addons);
  const addonsLoaded = useAddons((s) => s.loaded);
  const [rows, setRows] = useState<Record<RowKey, RowState>>({
    trending: { items: [], loading: true, failed: false },
    season: { items: [], loading: true, failed: false },
    alltime: { items: [], loading: true, failed: false },
    movies: { items: [], loading: true, failed: false },
    upcoming: { items: [], loading: true, failed: false },
  });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = async (key: RowKey, fn: () => Promise<AniListMedia[]>) => {
      try {
        const items = await fn();
        if (!alive) return;
        setRows((r) => ({ ...r, [key]: { items, loading: false, failed: items.length === 0 } }));
      } catch {
        if (!alive) return;
        setRows((r) => ({ ...r, [key]: { items: [], loading: false, failed: true } }));
      }
    };
    const reset = setTimeout(() => {
      setRows({
        trending: { items: [], loading: true, failed: false },
        season: { items: [], loading: true, failed: false },
        alltime: { items: [], loading: true, failed: false },
        movies: { items: [], loading: true, failed: false },
        upcoming: { items: [], loading: true, failed: false },
      });
    }, 0);
    void load("trending", animeTrending);
    void load("season", animeThisSeason);
    void load("alltime", animeAllTime);
    void load("movies", animeMovies);
    void load("upcoming", animeUpcoming);
    return () => {
      alive = false;
      clearTimeout(reset);
    };
  }, [reloadKey]);

  // Hero: top 5 trending with banners
  const heroItems = useMemo(() => rows.trending.items.slice(0, 5), [rows.trending.items]);
  const anyFailed = useMemo(
    () => Object.values(rows).every((r) => r.failed && !r.loading),
    [rows],
  );

  const openAnime = useCallback(
    async (m: AniListMedia) => {
      const title = mediaTitle(m);
      const meta = await resolveAnimeMeta(m);
      if (meta) {
        push({ kind: "detail", type: meta.type, id: meta.id });
      } else {
        // Fall back to a Cinemeta search grid for this title
        push({
          kind: "grid",
          title,
          query: {
            type: m.format === "MOVIE" ? "movie" : "series",
            catalogId: "top",
            extra: { search: title },
          },
        });
      }
    },
    [push],
  );

  const addonSpecs: SectionSpec[] = useMemo(() => {
    const specs: SectionSpec[] = [];
    for (const a of addons) {
      if (!a.enabled) continue;
      for (const c of a.manifest.catalogs ?? []) {
        if (c.type !== "movie" && c.type !== "series") continue;
        if ((c.extra ?? []).some((e) => e.name === "search" && e.isRequired)) continue;
        specs.push({
          key: `${a.manifest.id}:${c.type}:${c.id}`,
          title: c.name,
          type: c.type,
          catalog: c.id,
        });
        break; // one catalog per addon keeps this section tidy
      }
      if (specs.length >= 4) break;
    }
    return specs;
  }, [addons]);

  const cinemetaSpecs: SectionSpec[] = [
    { key: "cinemeta-anime-series", title: "From Stremio Catalogs", type: "series", catalog: "anime-trending" },
  ];

  return (
    <div className="pt-4 pb-10">
      {/* Header */}
      <div className="px-4 md:px-8 mb-4 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="md-headline-small text-ink flex items-center gap-2.5">
            <Sparkles className="w-6 h-6 text-accent" />
            Anime
          </h1>
          <p className="md-body-medium text-ink-muted mt-1">
            Catalog by <span className="text-ink font-medium">AniList</span> · click any title to resolve into your Stremio catalogs
          </p>
        </div>
        {anyFailed && (
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="md-chip md-state harbor-tv-focus"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Retry
          </button>
        )}
      </div>

      {/* AniList hero strip */}
      {heroItems.length > 0 && <AnimeHeroStrip items={heroItems} onOpen={openAnime} />}
      {rows.trending.loading && (
        <div className="px-4 md:px-8 mb-6">
          <div className="harbor-skeleton rounded-2xl h-40 md:h-52 w-full" aria-hidden />
        </div>
      )}

      {/* AniList rails */}
      <div className="space-y-7 mt-4">
        {ROW_META.map(({ key, title, icon: Icon }) => {
          const row = rows[key];
          if (row.loading) {
            return (
              <section key={key} aria-label={`${title} loading`}>
                <h2 className="md-title-medium text-ink px-4 md:px-8 mb-2.5 flex items-center gap-2">
                  <Icon className="w-5 h-5 text-accent" /> {title}
                </h2>
                <RailSkeleton />
              </section>
            );
          }
          if (row.items.length === 0) return null;
          return (
            <AnimeRail key={key} title={title} icon={Icon} items={row.items} onOpen={openAnime} />
          );
        })}
      </div>

      {/* Stremio-side anime catalogs (Cinemeta + user addons) */}
      {addonsLoaded && (
        <div className="mt-10">
          <div className="px-4 md:px-8 mb-1">
            <h2 className="md-title-medium text-ink flex items-center gap-2">
              <ListVideo className="w-5 h-5 text-accent" />
              Stremio catalogs
            </h2>
            <p className="md-body-small text-ink-subtle mt-0.5">Anime catalogs from Cinemeta and your installed addons</p>
          </div>
          <SectionRails
            specs={[...cinemetaSpecs, ...addonSpecs]}
            addonsFirst={addonSpecs.length > 0}
          />
        </div>
      )}
    </div>
  );
}

// ---------- Hero strip (banners of top 5 trending) ----------
function AnimeHeroStrip({ items, onOpen }: { items: AniListMedia[]; onOpen: (m: AniListMedia) => void }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (items.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % items.length), 9_000);
    return () => clearInterval(t);
  }, [items.length]);

  if (items.length === 0) return null;
  const m = items[Math.min(idx, items.length - 1)];
  const title = mediaTitle(m);

  return (
    <section className="px-4 md:px-8" aria-label="Trending anime spotlight">
      <div className="relative rounded-2xl overflow-hidden border border-edge-soft h-40 md:h-52 harbor-tv-focus">
        <div key={m.id} className="absolute inset-0 animate-in fade-in duration-700">
          <PosterImage src={m.bannerImage ?? coverOf(m)} alt={title} className="absolute inset-0" landscape />
          <div className="absolute inset-0 bg-gradient-to-r from-canvas/95 via-canvas/60 to-canvas/10" />
          <div className="absolute inset-0 bg-gradient-to-t from-canvas/70 to-transparent" />
        </div>
        <div className="relative z-10 h-full flex flex-col justify-end p-4 md:p-6 max-w-2xl">
          <div className="flex items-center gap-2 mb-1.5">
            {m.averageScore ? (
              <span className={`${MEDIA_CHIP} !text-emerald-300`}>
                {(m.averageScore / 10).toFixed(1)}
              </span>
            ) : null}
            {m.seasonYear && <span className="md-label-small text-ink-muted">{m.seasonYear}</span>}
            {m.format && <span className={`${MEDIA_CHIP} uppercase`}>{m.format}</span>}
            {m.nextAiringEpisode && (
              <span className={`${MEDIA_CHIP} bg-accent! text-black!`}>
                EP {m.nextAiringEpisode.episode} soon
              </span>
            )}
          </div>
          <h2 className="md-headline-small text-ink harbor-clamp-1 mb-2">{title}</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpen(m)}
              className="md-btn md-btn-filled md-state harbor-tv-focus"
            >
              Find streams
            </button>
            <a
              href={anilistUrl(m)}
              target="_blank"
              rel="noreferrer"
              className="md-btn md-btn-tonal md-state harbor-tv-focus"
            >
              AniList page
            </a>
          </div>
        </div>
        <div className="absolute bottom-3 end-4 z-10 flex gap-1.5">
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Spotlight ${i + 1}`}
              onClick={() => setIdx(i)}
              className={cn(
                "relative h-1.5 rounded-full transition-all after:content-[''] after:absolute after:-inset-1.5 after:rounded-full",
                i === idx ? "w-5 bg-accent" : "w-1.5 bg-white/40 hover:bg-white/70",
              )}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------- AniList rail ----------
function AnimeRail({
  title,
  icon: Icon,
  items,
  onOpen,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: AniListMedia[];
  onOpen: (m: AniListMedia) => void;
}) {
  return (
    <Rail title={title} titleIcon={Icon}>
      {items.map((m) => (
        <div key={m.id} className="shrink-0 w-[120px] md:w-[138px]">
          <AnimeCard media={m} onOpen={() => onOpen(m)} />
        </div>
      ))}
    </Rail>
  );
}

// ---------- AniList card ----------
function AnimeCard({ media, onOpen }: { media: AniListMedia; onOpen: () => void }) {
  const [state, setState] = useState<"idle" | "resolving" | "miss">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const click = () => {
    if (state === "resolving") return;
    setState("resolving");
    timer.current = setTimeout(() => setState((s) => (s === "resolving" ? "miss" : s)), 15_000);
    void (async () => {
      try {
        await onOpen();
        if (timer.current) clearTimeout(timer.current);
        setState("idle");
      } catch {
        setState("miss");
      }
    })();
  };

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={click}
        className="harbor-poster harbor-tv-focus relative block w-full aspect-[2/3] text-left group"
        aria-label={`${mediaTitle(media)} (AniList)`}
      >
        <PosterImage src={coverOf(media)} alt={mediaTitle(media)} className="absolute inset-0" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        {state === "resolving" && (
          <span className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center md-label-small text-white/90">
            Resolving…
          </span>
        )}
        {state === "miss" && (
          <span className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-1 md-label-small text-white/70 px-2 text-center">
            <SearchX className="w-5 h-5 text-white/70" />
            Not in Cinemeta — showing search results
          </span>
        )}
        {media.averageScore ? (
          <span className={`${MEDIA_CHIP} !bg-black/75 !text-emerald-300 absolute top-1.5 start-1.5`}>
            {(media.averageScore / 10).toFixed(1)}
          </span>
        ) : null}
        <span className={`${MEDIA_CHIP} !bg-black/75 !text-white/90 uppercase absolute top-1.5 end-1.5`}>
          AniList
        </span>
        {media.nextAiringEpisode && (
          <span className={`${MEDIA_CHIP} bg-accent! text-black! absolute bottom-1.5 start-1.5`}>
            EP {media.nextAiringEpisode.episode}
          </span>
        )}
      </button>
      <div className="mt-1.5 px-0.5">
        <p className="md-title-small harbor-clamp-1 text-ink">{mediaTitle(media)}</p>
        <p className="md-body-small harbor-clamp-1 text-ink-subtle">
          {[media.seasonYear, media.format === "MOVIE" ? "Movie" : media.episodes ? `${media.episodes} eps` : null, media.genres?.[0]]
            .filter(Boolean)
            .join(" · ") || "Anime"}
        </p>
      </div>
    </div>
  );
}
