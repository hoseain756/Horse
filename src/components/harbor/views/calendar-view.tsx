"use client";

// Harbor Web — Calendar view: weekly airing schedule for your tracked series.
// Data sources (all user-owned, no bundled content):
//   1. Tracked series = watchlist(series) + continue-watching(series) + history(series)
//   2. For each tracked series: Cinemeta meta -> videos[].released grouped by day
//   3. "New episodes this week" discovery row via Cinemeta last-videos catalog
// M3 (m3-3c): header → md-headline-small, week nav → .md-chip(+selected), section
// subheads → md-title-medium, empty state → .md-card-outlined + .md-btn-filled.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2,
  Tv,
  PlayCircle,
  Sparkles,
  ListPlus,
  Zap,
} from "lucide-react";
import type { Meta } from "@/lib/harbor/types";
import { fetchMeta, fetchCinemetaCatalog } from "@/lib/harbor/api";
import { getWatchlist, getCwCards, getHistory, episodeWatchedSet } from "@/lib/harbor/cw";
import { useNav } from "@/lib/harbor/store";
import {
  animeAiringWeek,
  mediaTitle,
  coverOf,
  resolveAnimeMeta,
  type AniListMedia,
  type AiringEntry,
} from "@/lib/harbor/anilist";
import { cn } from "@/lib/utils";
import { PosterImage } from "../common/poster";
import { PageHeader } from "../chrome/page-header";

// ---------- helpers ----------

const DAY_MS = 86_400_000;

/** Monday-based week start for a date (local time). */
function weekStart(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dow = (d.getDay() + 6) % 7; // Mon=0
  d.setDate(d.getDate() - dow);
  return d;
}

function dayKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Session-scoped meta cache so week navigation doesn't refetch
const metaCache = new Map<string, Meta | null>();

async function loadSeriesMeta(id: string): Promise<Meta | null> {
  if (metaCache.has(id)) return metaCache.get(id) ?? null;
  try {
    const meta = await Promise.race([
      fetchMeta("series", id),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 10_000)),
    ]);
    metaCache.set(id, meta);
    return meta;
  } catch {
    metaCache.set(id, null);
    return null;
  }
}

async function mapPool<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return results;
}

// ---------- types ----------

type CalEpisode = {
  videoId: string;
  seriesId: string;
  seriesName: string;
  poster?: string;
  season: number;
  episode: number;
  name?: string;
  releasedMs: number;
  overview?: string;
};

type WeekData = {
  episodes: CalEpisode[]; // tracked-series episodes inside the week
  loading: boolean;
  missing: number; // series metas that failed to load
};

const EMPTY_WEEK: WeekData = { episodes: [], loading: false, missing: 0 };

function collectTrackedSeries(): { id: string; name: string; poster?: string }[] {
  const map = new Map<string, { id: string; name: string; poster?: string }>();
  for (const w of getWatchlist()) {
    if (w.type === "series") map.set(w.id, { id: w.id, name: w.name, poster: w.poster });
  }
  for (const c of getCwCards()) {
    if (c.type === "series") map.set(c.id, { id: c.id, name: c.name, poster: c.poster });
  }
  for (const h of getHistory()) {
    if (h.type === "series" && !map.has(h.id)) map.set(h.id, { id: h.id, name: h.name, poster: h.poster });
  }
  return Array.from(map.values()).slice(0, 60);
}

// ---------- component ----------

export function CalendarView() {
  const push = useNav((s) => s.push);
  const topFrame = useNav((s) => s.stack[s.stack.length - 1]);
  const isActive = topFrame.kind === "view" && topFrame.view === "calendar";
  const [weekOffset, setWeekOffset] = useState(0);
  const [week, setWeek] = useState<WeekData>(EMPTY_WEEK);
  const [newThisWeek, setNewThisWeek] = useState<Meta[]>([]);
  const [anime, setAnime] = useState<{ entries: AiringEntry[]; loading: boolean; failed: boolean }>({
    entries: [],
    loading: false,
    failed: false,
  });
  const [mobileDay, setMobileDay] = useState(() => (new Date().getDay() + 6) % 7);
  const watchRef = useRef<Set<string>>(new Set());
  const [watchedReady, setWatchedReady] = useState(false);

  const baseWeek = useMemo(() => weekStart(new Date()), []);
  const days = useMemo(() => {
    const start = new Date(baseWeek.getTime() + weekOffset * 7 * DAY_MS);
    return Array.from({ length: 7 }, (_, i) => new Date(start.getTime() + i * DAY_MS));
  }, [baseWeek, weekOffset]);

  const isThisWeek = weekOffset === 0;

  // Load watched set whenever the view becomes active (history may have changed)
  useEffect(() => {
    if (!isActive) return;
    watchRef.current = episodeWatchedSet();
    setWatchedReady(true);
  }, [isActive]);

  // Load tracked-series episodes for the active week (re-runs when the view
  // becomes the top frame, so watchlist changes made elsewhere are picked up)
  useEffect(() => {
    if (!isActive) return;
    let alive = true;
    const tracked = collectTrackedSeries();
    if (tracked.length === 0) {
      setWeek({ episodes: [], loading: false, missing: 0 });
      return;
    }
    setWeek((w) => ({ ...w, loading: true }));
    (async () => {
      const metas = await mapPool(tracked, 4, (t) => loadSeriesMeta(t.id));
      if (!alive) return;
      const nameById = new Map(tracked.map((t) => [t.id, t]));
      const weekStartMs = days[0].getTime();
      const weekEndMs = weekStartMs + 7 * DAY_MS;
      const episodes: CalEpisode[] = [];
      let missing = 0;
      metas.forEach((meta, i) => {
        const info = nameById.get(tracked[i].id)!;
        if (!meta) {
          missing++;
          return;
        }
        const name = meta.name || info.name;
        const poster = meta.poster || info.poster;
        for (const v of meta.videos ?? []) {
          if (!v.released || typeof v.season !== "number" || typeof v.episode !== "number") continue;
          const t = new Date(v.released).getTime();
          if (!Number.isFinite(t) || t < weekStartMs || t >= weekEndMs) continue;
          episodes.push({
            videoId: v.id,
            seriesId: meta.id,
            seriesName: name,
            poster,
            season: v.season,
            episode: v.episode,
            name: v.name || v.title,
            releasedMs: t,
            overview: v.overview || v.description,
          });
        }
      });
      episodes.sort((a, b) => a.releasedMs - b.releasedMs);
      setWeek({ episodes, loading: false, missing });
    })();
    return () => {
      alive = false;
    };
  }, [weekOffset, isActive]);

  // Discovery row: series with recent episode releases (Cinemeta last-videos)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await Promise.race([
          fetchCinemetaCatalog("series", "last-videos"),
          new Promise<Meta[]>((resolve) => setTimeout(() => resolve([]), 12_000)),
        ]);
        if (alive && res.length > 0) setNewThisWeek(res.slice(0, 14));
      } catch {
        /* discovery row is optional */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Anime airing this week (AniList airing schedules, ±1 week supported)
  useEffect(() => {
    if (!isActive) return;
    // AniList schedules are most useful for the current & upcoming weeks
    if (weekOffset < -1 || weekOffset > 3) {
      setAnime({ entries: [], loading: false, failed: false });
      return;
    }
    let alive = true;
    setAnime((a) => ({ ...a, loading: true }));
    const startMs = days[0].getTime();
    const endMs = startMs + 7 * DAY_MS;
    animeAiringWeek(startMs, endMs)
      .then((entries) => {
        if (!alive) return;
        setAnime({ entries, loading: false, failed: false });
      })
      .catch(() => {
        if (!alive) return;
        setAnime({ entries: [], loading: false, failed: true });
      });
    return () => {
      alive = false;
    };
  }, [weekOffset, isActive]);

  const byDay = useMemo(() => {
    const map = new Map<string, CalEpisode[]>();
    for (const ep of week.episodes) {
      const key = dayKeyOf(new Date(ep.releasedMs));
      const arr = map.get(key) ?? [];
      arr.push(ep);
      map.set(key, arr);
    }
    return map;
  }, [week.episodes]);

  const weekLabel = `${MONTHS[days[0].getMonth()]} ${days[0].getDate()} – ${MONTHS[days[6].getMonth()]} ${days[6].getDate()}, ${days[6].getFullYear()}`;
  const trackedCount = useMemo(() => (isActive ? collectTrackedSeries().length : 0), [isActive, week]);

  return (
    <div className="pb-16 px-4 md:px-8 max-w-6xl">
      <PageHeader view="calendar" />
      <p className="md-body-medium text-ink-muted mb-6">
        Weekly airing schedule for series you track — from your watchlist, continue watching and
        history.
      </p>

      {/* Week navigation */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <button
          type="button"
          onClick={() => setWeekOffset((w) => w - 1)}
          className="md-chip md-state harbor-tv-focus"
          aria-label="Previous week"
        >
          <ChevronLeft className="w-4 h-4" /> <span className="hidden sm:inline">Prev</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setWeekOffset(0);
            setMobileDay((new Date().getDay() + 6) % 7);
          }}
          className={cn("md-chip md-state harbor-tv-focus", isThisWeek && "md-chip-selected")}
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => setWeekOffset((w) => w + 1)}
          className="md-chip md-state harbor-tv-focus"
          aria-label="Next week"
        >
          <span className="hidden sm:inline">Next</span> <ChevronRight className="w-4 h-4" />
        </button>
        <span className="ms-1 text-sm text-ink-subtle tabular-nums">{weekLabel}</span>
        {week.loading && (
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-subtle">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading episodes…
          </span>
        )}
      </div>

      {trackedCount === 0 && !week.loading ? (
        <EmptyCalendar />
      ) : (
        <>
          {/* Mobile day chips */}
          <div className="lg:hidden harbor-scroll-x overflow-x-auto flex gap-2 mb-4 pb-1" role="tablist" aria-label="Day of week">
            {days.map((d, i) => {
              const today = dayKeyOf(d) === dayKeyOf(new Date());
              return (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={mobileDay === i}
                  onClick={() => setMobileDay(i)}
                  className={cn(
                    "md-state harbor-tv-focus shrink-0 rounded-2xl border px-4 py-2 text-center transition-colors",
                    mobileDay === i
                      ? "border-accent bg-accent-soft text-ink"
                      : "border-edge-soft bg-elevated text-ink-muted",
                  )}
                >
                  <span className="block text-[10px] uppercase tracking-wide">{DAY_NAMES[i]}</span>
                  <span className={cn("block font-display text-lg font-bold", today && "text-accent")}>
                    {d.getDate()}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Desktop 7-day grid */}
          <div className="hidden lg:grid grid-cols-7 gap-3">
            {days.map((d, i) => (
              <DayColumn
                key={i}
                date={d}
                episodes={byDay.get(dayKeyOf(d)) ?? []}
                watched={watchedReady ? watchRef.current : new Set()}
                onSelect={(ep) => push({ kind: "detail", type: "series", id: ep.seriesId })}
              />
            ))}
          </div>

          {/* Mobile / tablet single-day list */}
          <div className="lg:hidden">
            <DayColumn
              date={days[mobileDay]}
              episodes={byDay.get(dayKeyOf(days[mobileDay])) ?? []}
              watched={watchedReady ? watchRef.current : new Set()}
              onSelect={(ep) => push({ kind: "detail", type: "series", id: ep.seriesId })}
            />
          </div>

          {week.missing > 0 && !week.loading && (
            <p className="mt-4 text-[11px] text-ink-subtle">
              {week.missing} tracked {week.missing === 1 ? "series" : "series"} could not be
              loaded from Cinemeta.
            </p>
          )}
        </>
      )}

      {/* Anime airing this week (AniList) */}
      {(anime.loading || anime.entries.length > 0 || anime.failed) && (
        <section className="mt-10" aria-label="Anime airing this week">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-accent" />
            <h2 className="md-title-medium text-ink uppercase tracking-wide">Anime airing this week</h2>
            <span className="md-chip md-label-small !h-5 !px-1.5 uppercase cursor-default!">AniList</span>
            {anime.loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-ink-subtle" />}
          </div>
          {anime.entries.length > 0 ? (
            <div className="harbor-scroll-x overflow-x-auto flex gap-3 pb-2 pt-2 -mt-2">
              {anime.entries.map((s) => (
                <AnimeAiringCard
                  key={`al-${s.media.id}-${s.episode}-${s.airingAt}`}
                  entry={s}
                  onOpen={async () => {
                    const meta = await resolveAnimeMeta(s.media);
                    if (meta) push({ kind: "detail", type: meta.type, id: meta.id });
                  }}
                />
              ))}
            </div>
          ) : anime.loading ? (
            <div className="flex gap-3 overflow-hidden" aria-hidden>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="harbor-skeleton rounded-xl w-[112px] aspect-[2/3] shrink-0" />
              ))}
            </div>
          ) : (
            <p className="text-xs text-ink-subtle">No airing data for this week.</p>
          )}
        </section>
      )}

      {/* Discovery row */}
      {newThisWeek.length > 0 && (
        <section className="mt-10" aria-label="Series with new episodes this week">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-accent" />
            <h2 className="md-title-medium text-ink uppercase tracking-wide">
              New episodes this week
            </h2>
          </div>
          <div className="harbor-scroll-x overflow-x-auto flex gap-3 pb-2 pt-2 -mt-2">
            {newThisWeek.map((m) => (
              <button
                key={`${m.id}`}
                type="button"
                onClick={() => push({ kind: "detail", type: "series", id: m.id })}
                className="harbor-tv-focus group w-[112px] shrink-0 text-left"
              >
                <div className="aspect-[2/3] rounded-xl overflow-hidden relative bg-raised border border-edge-soft transition-transform group-hover:scale-[1.04] group-hover:border-accent/50">
                  <PosterImage src={m.poster} alt={m.name} className="absolute inset-0" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="md-title-small harbor-clamp-1 mt-1.5 text-ink group-hover:text-accent transition-colors">
                  {m.name}
                </p>
                {m.releaseInfo && <p className="text-[10px] text-ink-subtle">{m.releaseInfo}</p>}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ---------- day column ----------

function DayColumn({
  date,
  episodes,
  watched,
  onSelect,
}: {
  date: Date;
  episodes: CalEpisode[];
  watched: Set<string>;
  onSelect: (ep: CalEpisode) => void;
}) {
  const isToday = dayKeyOf(date) === dayKeyOf(new Date());
  const isPast = date.getTime() + DAY_MS < Date.now();

  return (
    <section
      className={cn(
        "rounded-2xl border p-3 min-h-40 flex flex-col",
        isToday ? "border-accent/50 bg-accent-soft/40" : "border-edge-soft bg-elevated",
      )}
      aria-label={`${DAY_NAMES[(date.getDay() + 6) % 7]} ${date.getDate()}`}
    >
      <div className="flex items-baseline justify-between mb-2.5 px-1">
        <span className={cn("text-xs font-semibold uppercase tracking-wide", isToday ? "text-accent" : "text-ink-muted")}>
          {DAY_NAMES[(date.getDay() + 6) % 7]}
        </span>
        <span
          className={cn(
            "font-display text-xl font-bold tabular-nums",
            isToday ? "text-accent" : isPast ? "text-ink-subtle" : "text-ink",
          )}
        >
          {date.getDate()}
        </span>
      </div>
      <div className="space-y-2 flex-1">
        {episodes.length === 0 ? (
          <p className="text-[11px] text-ink-subtle/70 px-1 pt-1">No episodes</p>
        ) : (
          episodes.map((ep) => {
            const isWatched = watched.has(ep.videoId);
            const future = ep.releasedMs > Date.now();
            const time = new Date(ep.releasedMs);
            const hh = String(time.getHours()).padStart(2, "0");
            const mm = String(time.getMinutes()).padStart(2, "0");
            return (
              <button
                key={ep.videoId}
                type="button"
                onClick={() => onSelect(ep)}
                className="md-state harbor-tv-focus group w-full rounded-xl border border-edge-soft bg-raised p-2 flex items-center gap-2.5 text-left transition-colors hover:border-accent/60"
                title={ep.name ?? ep.seriesName}
              >
                <div className="w-9 h-[52px] rounded-lg overflow-hidden relative shrink-0 bg-canvas">
                  <PosterImage src={ep.poster} alt="" className="absolute inset-0" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="md-label-small harbor-clamp-1 text-ink group-hover:text-accent transition-colors">
                    {ep.seriesName}
                  </p>
                  <p className="flex items-center justify-between gap-1.5 text-[10px] text-ink-muted">
                    <span className="tabular-nums shrink-0">
                      S{ep.season}:E{ep.episode}
                    </span>
                    <span className="text-ink-subtle tabular-nums shrink-0">
                      {hh}:{mm}
                    </span>
                  </p>
                </div>
                <span className="shrink-0 self-center">
                  {isWatched ? (
                    <span className="w-5 h-5 rounded-full bg-accent/15 text-accent flex items-center justify-center" title="Watched">
                      <Check className="w-3 h-3" />
                    </span>
                  ) : future ? (
                    <span className="text-[9px] font-semibold uppercase text-ink-subtle bg-raised border border-edge-soft rounded-full px-1.5 py-0.5">
                      Soon
                    </span>
                  ) : (
                    <PlayCircle className="w-4 h-4 text-ink-subtle group-hover:text-accent transition-colors" />
                  )}
                </span>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}

function EmptyCalendar() {
  const resetTo = useNav((s) => s.resetTo);
  return (
    <div className="md-card-outlined p-10 text-center">
      <Tv className="w-10 h-10 mx-auto text-ink-subtle mb-3" />
      <h2 className="md-title-large text-ink mb-1">No tracked series yet</h2>
      <p className="md-body-medium text-ink-muted mb-5 max-w-sm mx-auto">
        Add shows to your watchlist or start watching, and their weekly episode air dates will
        appear here automatically.
      </p>
      <button
        type="button"
        onClick={() => resetTo({ kind: "view", view: "shows" })}
        className="md-btn md-btn-filled md-state harbor-tv-focus"
      >
        <ListPlus className="md-btn-icon" /> Browse shows
      </button>
    </div>
  );
}

// ---------- anime airing card (AniList) ----------

function AnimeAiringCard({
  entry,
  onOpen,
}: {
  entry: AiringEntry;
  onOpen: () => Promise<void>;
}) {
  const [state, setState] = useState<"idle" | "resolving">("idle");
  const media: AniListMedia = entry.media;
  const when = new Date(entry.airingAt * 1000);
  const hh = String(when.getHours()).padStart(2, "0");
  const mm = String(when.getMinutes()).padStart(2, "0");
  const dayIdx = (when.getDay() + 6) % 7;
  const future = entry.airingAt * 1000 > Date.now();

  const click = () => {
    if (state === "resolving") return;
    setState("resolving");
    void onOpen().finally(() => setState("idle"));
  };

  return (
    <button
      type="button"
      onClick={click}
      className="harbor-tv-focus group w-[112px] shrink-0 text-left"
      aria-label={`${mediaTitle(media)} episode ${entry.episode}`}
    >
      <div className="aspect-[2/3] rounded-xl overflow-hidden relative bg-raised border border-edge-soft transition-transform group-hover:scale-[1.04] group-hover:border-accent/50">
        <PosterImage src={coverOf(media)} alt={mediaTitle(media)} className="absolute inset-0" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <span className="md-chip md-label-small !h-6 !px-2 !border-0 !bg-black/75 backdrop-blur-sm !text-white/90 cursor-default! absolute top-1.5 start-1.5">
          EP {entry.episode}
        </span>
        {future && (
          <span className="md-chip md-label-small !h-6 !px-2 !border-0 bg-accent! text-black! cursor-default! absolute top-1.5 end-1.5">
            Soon
          </span>
        )}
        {state === "resolving" && (
          <span className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
            <Loader2 className="w-4 h-4 animate-spin text-white/90" />
          </span>
        )}
      </div>
      <p className="md-title-small harbor-clamp-1 mt-1.5 text-ink group-hover:text-accent transition-colors">
        {mediaTitle(media)}
      </p>
      <p className="text-[10px] text-ink-subtle tabular-nums">
        {DAY_NAMES[dayIdx]} {hh}:{mm}
      </p>
    </button>
  );
}
