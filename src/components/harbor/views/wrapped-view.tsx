"use client";

// Harbor Web — Wrapped view: personal viewing stats (port of Harbor wrapped.tsx, self-contained)
// Computes from local watch history: watch time, top genres (resolved via Cinemeta), activity, collage.
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Sparkles,
  Clock,
  Film,
  Tv,
  Flame,
  CalendarDays,
  Trophy,
  RadioTower,
  Share2,
  Loader2,
  Moon,
  Footprints,
  Layers,
  Compass,
  Heart,
  Timer,
  Medal,
} from "lucide-react";
import type { Meta } from "@/lib/harbor/types";
import { fetchMeta } from "@/lib/harbor/api";
import { getHistory, type HistoryEntry } from "@/lib/harbor/cw";
import { generateShareCard } from "@/lib/harbor/share-card";
import { useNav } from "@/lib/harbor/store";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { PosterImage } from "../common/poster";
import { PageHeader } from "../chrome/page-header";

type Stats = {
  totalEntries: number;
  uniqueTitles: number;
  movies: number;
  episodes: number;
  watchMs: number;
  activeDays: number;
  bestDay: { date: string; ms: number } | null;
  daily: { date: string; ms: number }[]; // last 14 days
  heat365: { date: string; ms: number }[]; // last 365 days, oldest -> today
  maxEpisodesPerDay: number; // most episodes of one series watched in a single day
  lateNightSessions: number; // sessions between 00:00-04:59 local
  maxSessions: number; // most sessions of a single title
  topTitles: { id: string; name: string; ms: number; poster?: string; type: string; count: number }[];
  topGenres: { genre: string; count: number }[];
};

function dayKey(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function computeStats(history: HistoryEntry[]): Stats {
  const totalMs = (e: HistoryEntry) => Math.max(0, Math.min(e.positionMs || e.durationMs, e.durationMs || e.positionMs));
  let watchMs = 0;
  let movies = 0;
  let episodes = 0;
  const byDay = new Map<string, number>();
  const byTitle = new Map<string, { name: string; ms: number; poster?: string; type: string; count: number }>();
  const days = new Set<string>();

  for (const e of history) {
    const ms = totalMs(e);
    watchMs += ms;
    const dk = dayKey(e.t);
    days.add(dk);
    byDay.set(dk, (byDay.get(dk) ?? 0) + ms);
    if (e.type === "series" && e.episode) episodes++;
    else movies++;
    const prev = byTitle.get(e.id);
    byTitle.set(e.id, {
      name: e.name,
      ms: (prev?.ms ?? 0) + ms,
      poster: prev?.poster ?? e.poster,
      type: e.type,
      count: (prev?.count ?? 0) + 1,
    });
  }

  // last 14 days series
  const daily: { date: string; ms: number }[] = [];
  const now = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = dayKey(d.getTime());
    daily.push({ date: key, ms: byDay.get(key) ?? 0 });
  }

  // last 365 days heatmap series (day 364 days ago -> today, oldest first)
  const heat365: { date: string; ms: number }[] = [];
  for (let i = 364; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = dayKey(d.getTime());
    heat365.push({ date: key, ms: byDay.get(key) ?? 0 });
  }

  // Badge stats — computed honestly from the same history
  let maxEpisodesPerDay = 0;
  let lateNightSessions = 0;
  const episodesPerDay = new Map<string, number>(); // `${dayKey}|${id}` -> same-series episode count
  for (const e of history) {
    if (new Date(e.t).getHours() < 5) lateNightSessions++;
    if (e.type === "series" && e.episode) {
      const k = `${dayKey(e.t)}|${e.id}`;
      const n = (episodesPerDay.get(k) ?? 0) + 1;
      episodesPerDay.set(k, n);
      if (n > maxEpisodesPerDay) maxEpisodesPerDay = n;
    }
  }
  let maxSessions = 0;
  for (const v of byTitle.values()) {
    if (v.count > maxSessions) maxSessions = v.count;
  }

  let bestDay: { date: string; ms: number } | null = null;
  for (const [date, ms] of byDay) {
    if (!bestDay || ms > bestDay.ms) bestDay = { date, ms };
  }

  const topTitles = Array.from(byTitle.entries())
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 6);

  return {
    totalEntries: history.length,
    uniqueTitles: byTitle.size,
    movies,
    episodes,
    watchMs,
    activeDays: days.size,
    bestDay,
    daily,
    heat365,
    maxEpisodesPerDay,
    lateNightSessions,
    maxSessions,
    topTitles,
    topGenres: [], // filled async
  };
}

function fmtDuration(ms: number): string {
  const hours = Math.floor(ms / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  const secs = Math.floor((ms % 60_000) / 1000);
  if (hours >= 1) return `${hours}h ${mins}m`;
  if (mins >= 1) return `${mins}m`;
  return `${secs}s`;
}

/**
 * Resolve the app accent (applyTheme sets --color-accent-var on <html>) to a CSS
 * color string usable in inline color-mix() styles. Falls back to a pleasant
 * warm amber if the variable can't be read.
 */
function resolvedAccent(): string {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue("--color-accent-var").trim();
    return v || "#f0b429";
  } catch {
    return "#f0b429";
  }
}

// ---------- 365-day heatmap (GitHub style) ----------

const WEEKDAY_ROWS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]; // row 0 = Monday
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type HeatCell = { key: string; label: string; level: number; future: boolean };

function heatLevel(ms: number, max: number): number {
  if (ms <= 0) return 0;
  if (max <= 0) return 4;
  if (ms <= max * 0.25) return 1;
  if (ms <= max * 0.5) return 2;
  if (ms <= max * 0.75) return 3;
  return 4;
}

/** 0 = raised/empty (class-driven); 1-4 = accent tints via color-mix. */
function levelBg(level: number, accent: string): string | undefined {
  switch (level) {
    case 1:
      return `color-mix(in srgb, ${accent} 25%, transparent)`;
    case 2:
      return `color-mix(in srgb, ${accent} 45%, transparent)`;
    case 3:
      return `color-mix(in srgb, ${accent} 70%, transparent)`;
    case 4:
      return accent;
    default:
      return undefined;
  }
}

function HeatmapGrid({ heat, accent }: { heat: { date: string; ms: number }[]; accent: string }) {
  const { columns, monthLabels } = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 364);
    const dow = (start.getDay() + 6) % 7; // 0 = Monday
    const gridStart = new Date(start.getFullYear(), start.getMonth(), start.getDate() - dow);
    const byDate = new Map(heat.map((h) => [h.date, h.ms]));
    let max = 0;
    for (const h of heat) if (h.ms > max) max = h.ms;

    const cols: HeatCell[][] = [];
    const monthLabels: (string | null)[] = [];
    let prevMonth = -1;
    const cursor = new Date(gridStart);
    while (cursor <= today) {
      const col: HeatCell[] = [];
      let firstInRangeMonth = -1;
      for (let r = 0; r < 7; r++) {
        if (cursor > today) {
          col.push({ key: `f${cols.length}-${r}`, label: "", level: 0, future: true });
        } else {
          if (cursor.getTime() >= start.getTime() && firstInRangeMonth === -1) {
            firstInRangeMonth = cursor.getMonth();
          }
          const key = dayKey(cursor.getTime());
          const ms = byDate.get(key) ?? 0;
          col.push({
            key,
            label: `${MONTHS_SHORT[cursor.getMonth()]} ${cursor.getDate()} · ${fmtDuration(ms)}`,
            level: heatLevel(ms, max),
            future: false,
          });
        }
        cursor.setDate(cursor.getDate() + 1);
      }
      if (firstInRangeMonth !== -1 && firstInRangeMonth !== prevMonth) {
        monthLabels.push(MONTHS_SHORT[firstInRangeMonth]);
        prevMonth = firstInRangeMonth;
      } else {
        monthLabels.push(null);
      }
      cols.push(col);
    }
    return { columns: cols, monthLabels };
  }, [heat]);

  const todayKey = dayKey(Date.now());

  return (
    <div className="flex" role="img" aria-label="365-day watch activity heatmap">
      {/* Weekday gutter (Mon/Wed/Fri only) */}
      <div className="mr-1.5 shrink-0 pt-[14px]" aria-hidden>
        <div className="flex flex-col gap-[2px]">
          {WEEKDAY_ROWS.map((wd, i) => (
            <div key={wd} className="flex h-[10px] w-6 items-center justify-end">
              {(i === 0 || i === 2 || i === 4) && (
                <span className="text-[9px] leading-none text-ink-subtle">{wd}</span>
              )}
            </div>
          ))}
        </div>
      </div>
      {/* Grid — horizontally scrollable on narrow screens */}
      <div className="harbor-scroll flex-1 overflow-x-auto pb-1">
        <div className="w-max">
          <div className="mb-[3px] flex h-[11px] gap-[2px]">
            {monthLabels.map((m, i) => (
              <div key={i} className="relative h-[11px] w-[10px] shrink-0">
                {m && (
                  <span className="absolute left-0 top-0 whitespace-nowrap text-[9px] leading-[11px] text-ink-subtle">
                    {m}
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-[2px]">
            {columns.map((col, ci) => (
              <div key={ci} className="flex flex-col gap-[2px]">
                {col.map((cell) =>
                  cell.future ? (
                    <div key={cell.key} className="h-[10px] w-[10px]" />
                  ) : (
                    <div
                      key={cell.key}
                      className={cn(
                        "h-[10px] w-[10px] rounded-[2px]",
                        cell.level === 0 && "border border-edge-soft bg-raised",
                        cell.key === todayKey && "ring-1 ring-accent/80",
                      )}
                      style={cell.level > 0 ? { backgroundColor: levelBg(cell.level, accent) } : undefined}
                      title={cell.label}
                    />
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Achievements (computed honestly from history) ----------

type Achievement = {
  id: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  earned: boolean;
  progress: string;
};

function buildAchievements(stats: Stats | null): Achievement[] {
  if (!stats) return [];
  const marathon = 8 * 3_600_000;
  const bestDayMs = stats.bestDay?.ms ?? 0;
  return [
    {
      id: "first-steps",
      icon: <Footprints className="w-4 h-4" />,
      title: "First Steps",
      desc: "Watch your first title",
      earned: stats.totalEntries >= 1,
      progress: stats.totalEntries >= 1 ? "1+ titles watched" : "0/1 titles",
    },
    {
      id: "binger",
      icon: <Layers className="w-4 h-4" />,
      title: "Binger",
      desc: "3+ episodes of one series in a day",
      earned: stats.maxEpisodesPerDay >= 3,
      progress:
        stats.maxEpisodesPerDay >= 3
          ? `best: ${stats.maxEpisodesPerDay} episodes`
          : `${stats.maxEpisodesPerDay}/3 episodes in a day`,
    },
    {
      id: "night-owl",
      icon: <Moon className="w-4 h-4" />,
      title: "Night Owl",
      desc: "Watch between midnight and 5am",
      earned: stats.lateNightSessions >= 1,
      progress:
        stats.lateNightSessions >= 1
          ? `${stats.lateNightSessions} late-night sessions`
          : "no late-night sessions yet",
    },
    {
      id: "explorer",
      icon: <Compass className="w-4 h-4" />,
      title: "Explorer",
      desc: "Discover 10 different titles",
      earned: stats.uniqueTitles >= 10,
      progress:
        stats.uniqueTitles >= 10
          ? `${stats.uniqueTitles} titles discovered`
          : `${stats.uniqueTitles}/10 titles`,
    },
    {
      id: "devoted",
      icon: <Heart className="w-4 h-4" />,
      title: "Devoted",
      desc: "Watch one title in 5+ separate sessions",
      earned: stats.maxSessions >= 5,
      progress:
        stats.maxSessions >= 5
          ? `top: ${stats.maxSessions} sessions`
          : `${stats.maxSessions}/5 sessions of one title`,
    },
    {
      id: "marathoner",
      icon: <Timer className="w-4 h-4" />,
      title: "Marathoner",
      desc: "8h+ of watch time in a single day",
      earned: bestDayMs >= marathon,
      progress:
        bestDayMs >= marathon
          ? `best day: ${fmtDuration(bestDayMs)}`
          : `best day: ${fmtDuration(bestDayMs)} of 8h`,
    },
  ];
}

function AchievementCard({ a, delay }: { a: Achievement; delay: number }) {
  return (
    <div
      className={cn(
        "md-card-outlined md-state harbor-pop-in flex items-start gap-3 rounded-[var(--md-sys-shape-corner-medium)] p-4",
        a.earned ? "border-transparent bg-accent-soft" : "opacity-70",
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={cn("harbor-stat-chip relative shrink-0", !a.earned && "grayscale opacity-60")}>
        {a.icon}
        {!a.earned && (
          <span
            aria-hidden
            className="absolute -bottom-0.5 -end-0.5 h-2 w-2 rounded-full border border-elevated bg-ink-subtle/80"
          />
        )}
      </div>
      <div className="min-w-0">
        <p className="md-title-small text-ink">{a.title}</p>
        <p className="md-body-small text-ink-muted">{a.desc}</p>
        <p className={cn("mt-0.5 md-label-small", a.earned ? "text-accent" : "text-ink-subtle")}>{a.progress}</p>
      </div>
    </div>
  );
}

type GenreStatus = "idle" | "resolving" | "done";

export function WrappedView() {
  const push = useNav((s) => s.push);
  const { toast } = useToast();
  const [stats, setStats] = useState<Stats | null>(null);
  const [genreMap, setGenreMap] = useState<Map<string, string[]>>(new Map());
  const [genreStatus, setGenreStatus] = useState<GenreStatus>("idle");
  const [genreMisses, setGenreMisses] = useState(0);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setStats(computeStats(getHistory())), 0);
    return () => clearTimeout(t);
  }, []);

  const accent = useMemo(() => (stats ? resolvedAccent() : "#f0b429"), [stats]);

  const handleShare = useCallback(async () => {
    if (!stats || sharing || stats.totalEntries === 0) return;
    setSharing(true);
    setShareError(false);
    try {
      const blob = await generateShareCard({
        watchMs: stats.watchMs,
        movies: stats.movies,
        episodes: stats.episodes,
        activeDays: stats.activeDays,
        topTitles: stats.topTitles
          .slice(0, 3)
          .map((t) => ({ name: t.name, poster: t.poster, type: t.type })),
        accent: resolvedAccent(),
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "harbor-wrapped.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast({ title: "Share card downloaded" });
    } catch (e) {
      console.error("[wrapped] share card generation failed", e);
      setShareError(true);
    } finally {
      setSharing(false);
    }
  }, [stats, sharing, toast]);

  // Resolve genres for top titles via Cinemeta (bounded time; never hangs the panel)
  useEffect(() => {
    if (!stats || stats.topTitles.length === 0) return;
    let alive = true;
    (async () => {
      setGenreStatus("resolving");
      const results = await Promise.allSettled(
        stats.topTitles.map((t) =>
          Promise.race([
            fetchMeta(t.type === "series" ? "series" : "movie", t.id),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 8_000)),
          ]),
        ),
      );
      if (!alive) return;
      const map = new Map<string, string[]>();
      let misses = 0;
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r.status === "fulfilled" && r.value) {
          map.set(stats.topTitles[i].id, (r.value.genres ?? []).slice(0, 4));
        } else {
          misses++;
        }
      }
      setGenreMap(map);
      setGenreMisses(misses);
      setGenreStatus("done");
    })();
    return () => {
      alive = false;
    };
  }, [stats]);

  const topGenres = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of stats?.topTitles ?? []) {
      for (const g of genreMap.get(t.id) ?? []) {
        counts.set(g, (counts.get(g) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .map(([genre, count]) => ({ genre, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [stats, genreMap]);

  const heatTotalMs = useMemo(() => (stats?.heat365 ?? []).reduce((acc, d) => acc + d.ms, 0), [stats]);
  const heatActiveDays = useMemo(() => (stats?.heat365 ?? []).filter((d) => d.ms > 0).length, [stats]);
  const achievements = useMemo(() => buildAchievements(stats), [stats]);
  const earnedCount = achievements.filter((a) => a.earned).length;

  if (!stats) {
    return (
      <div className="pt-24 px-4 md:px-8">
        <div className="harbor-skeleton h-40 rounded-3xl mb-6" aria-hidden />
        <div className="harbor-skeleton h-24 rounded-3xl" aria-hidden />
        <div className="sr-only">Loading your stats…</div>
      </div>
    );
  }

  const maxDaily = Math.max(...stats.daily.map((d) => d.ms), 1);

  return (
    <div className="pb-16 px-4 md:px-8 max-w-5xl">
      <PageHeader view="wrapped" />
      <div className="flex flex-wrap items-center gap-3 mb-1">
        <div className="ms-auto flex items-center gap-2.5">
          {shareError && (
            <span role="alert" className="md-body-small text-danger">
              Couldn&apos;t generate card
            </span>
          )}
          <button
            type="button"
            onClick={handleShare}
            disabled={sharing || !stats || stats.totalEntries === 0}
            aria-label="Share stats"
            className="md-btn-outlined harbor-tv-focus !h-10 disabled:pointer-events-none disabled:opacity-50"
          >
            {sharing ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
            ) : (
              <Share2 className="w-4 h-4" aria-hidden />
            )}
            Share stats
          </button>
        </div>
      </div>
      <p className="md-body-medium text-ink-muted mb-8">
        Everything you&apos;ve watched on this device, computed locally.
      </p>

      {stats.totalEntries === 0 && <WrappedEmptyState onNavigate={(view) => push({ kind: "view", view })} />}

      {stats.totalEntries > 0 && (
        <>
          {/* Stat tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <StatTile icon={<Clock className="w-5 h-5" />} label="Total watch time" value={fmtDuration(stats.watchMs)} accent />
            <StatTile icon={<Film className="w-5 h-5" />} label="Movies" value={String(stats.movies)} />
            <StatTile icon={<Tv className="w-5 h-5" />} label="Episodes" value={String(stats.episodes)} />
            <StatTile icon={<Flame className="w-5 h-5" />} label="Active days" value={String(stats.activeDays)} />
          </div>

          {/* 14-day activity */}
          <div className="md-card-outlined rounded-[var(--md-sys-shape-corner-large)] p-5 mb-8">
            <div className="flex items-center gap-2 mb-4">
              <CalendarDays className="w-4 h-4 text-accent" />
              <h2 className="md-title-small text-ink">Last 14 days</h2>
              {stats.bestDay && (
                <span className="ms-auto md-body-small text-ink-muted">
                  Best day: {fmtDuration(stats.bestDay.ms)}
                </span>
              )}
            </div>
            <div className="flex items-end gap-1.5 h-28" role="img" aria-label="Watch activity chart">
              {stats.daily.map((d) => {
                const isToday = d.date === stats.daily[stats.daily.length - 1].date;
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5 group">
                    <div
                      className={cn(
                        "w-full rounded-t-md transition-colors bg-gradient-to-t from-accent/50 to-accent group-hover:brightness-110",
                        isToday && "ring-1 ring-accent/60",
                      )}
                      style={{ height: `${Math.max(4, (d.ms / maxDaily) * 100)}%` }}
                      title={`${d.date}: ${fmtDuration(d.ms)}`}
                    />
                    <span className={cn("text-[9px]", isToday ? "text-ink font-semibold" : "text-ink-subtle")}>
                      {d.date.split("-")[2]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 365-day heatmap */}
          <div className="md-card-outlined harbor-pop-in rounded-[var(--md-sys-shape-corner-large)] p-5 mb-8" style={{ animationDelay: "60ms" }}>
            <div className="flex items-center gap-2 mb-4">
              <CalendarDays className="w-4 h-4 text-accent" />
              <h2 className="md-title-small text-ink">Last 365 days</h2>
              <span className="ms-auto md-body-small text-ink-muted">{heatActiveDays} active days</span>
            </div>
            <HeatmapGrid heat={stats.heat365} accent={accent} />
            <p className="sr-only">
              {`Over the last 365 days you watched ${fmtDuration(heatTotalMs)} across ${heatActiveDays} active days.`}
            </p>
            <div className="mt-3 flex items-center justify-end gap-1.5" aria-hidden>
              <span className="text-[9px] text-ink-subtle">Less</span>
              {[0, 1, 2, 3, 4].map((l) => (
                <div
                  key={l}
                  className={cn("h-[9px] w-[9px] rounded-[2px]", l === 0 && "border border-edge-soft bg-raised")}
                  style={l > 0 ? { backgroundColor: levelBg(l, accent) } : undefined}
                />
              ))}
              <span className="text-[9px] text-ink-subtle">More</span>
            </div>
          </div>

          {/* Achievements */}
          <div className="harbor-pop-in mb-8" style={{ animationDelay: "120ms" }}>
            <div className="flex items-center gap-2 mb-3">
              <Medal className="w-4 h-4 text-accent" />
              <h2 className="md-title-small text-ink">Achievements</h2>
              <span className="text-xs text-ink-subtle">
                {earnedCount}/{achievements.length} earned
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {achievements.map((a, i) => (
                <AchievementCard key={a.id} a={a} delay={i * 45} />
              ))}
            </div>
          </div>

          {/* Top titles + collage */}
          <div className="grid gap-6 md:grid-cols-2 mb-8">
            <div className="md-card-outlined rounded-[var(--md-sys-shape-corner-large)] p-5">
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-4 h-4 text-accent" />
                <h2 className="md-title-small text-ink">Most watched</h2>
              </div>
              <div className="space-y-1">
                {stats.topTitles.map((t, i) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => push({ kind: "detail", type: t.type === "series" ? "series" : "movie", id: t.id })}
                    className="md-state harbor-tv-focus w-full flex items-center gap-3 text-start rounded-[var(--md-sys-shape-corner-medium)] px-2 py-2"
                  >
                    <span className="font-display text-lg font-black text-ink-subtle w-5">{i + 1}</span>
                    <div className="w-10 h-14 rounded-lg overflow-hidden relative shrink-0 bg-raised">
                      <PosterImage src={t.poster} alt={t.name} className="absolute inset-0" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="harbor-clamp-1 text-sm font-medium text-ink group-hover:text-accent transition-colors">
                        {t.name}
                      </p>
                      <p className="text-xs text-ink-subtle">
                        {t.count > 1 ? `${t.count} sessions · ` : ""}{fmtDuration(t.ms)}
                      </p>
                      {genreMap.has(t.id) && (
                        <p className="harbor-clamp-1 text-[10px] text-ink-subtle">
                          {(genreMap.get(t.id) ?? []).join(" · ")}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="md-card-outlined rounded-[var(--md-sys-shape-corner-large)] p-5 flex flex-col">
              <h2 className="md-title-small text-ink mb-4">Top genres</h2>
              {topGenres.length === 0 && genreStatus === "resolving" ? (
                <div className="space-y-3 flex-1" aria-label="Resolving genres">
                  {[0, 1, 2].map((i) => (
                    <div key={i}>
                      <div className="harbor-skeleton h-3 w-24 rounded mb-1.5" />
                      <div className="harbor-skeleton h-2 rounded-full" style={{ width: `${80 - i * 20}%` }} />
                    </div>
                  ))}
                </div>
              ) : topGenres.length === 0 ? (
                <p className="text-xs text-ink-subtle">
                  {genreMisses > 0
                    ? "Genres unavailable — could not reach Cinemeta for these titles."
                    : "No genre data for your watch history yet."}
                </p>
              ) : (
                <div className="space-y-3 flex-1">
                  {topGenres.map((g) => {
                    const max = topGenres[0].count || 1;
                    return (
                      <div key={g.genre}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-ink font-medium">{g.genre}</span>
                          <span className="text-ink-subtle">{g.count}</span>
                        </div>
                        <div className="h-2 rounded-full bg-raised overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-accent/60 to-accent"
                            style={{ width: `${(g.count / max) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {/* Poster collage */}
              <div className="grid grid-cols-3 gap-1.5 mt-5">
                {stats.topTitles.slice(0, 6).map((t) => (
                  <div key={`c-${t.id}`} className="aspect-[2/3] rounded-lg overflow-hidden relative bg-raised">
                    <PosterImage src={t.poster} alt="" className="absolute inset-0" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="text-[11px] text-ink-subtle text-center">
            Stats are computed locally from your watch history. Private by design — nothing leaves
            this device unless you sign in to Stremio.
          </p>
        </>
      )}
    </div>
  );
}

function WrappedEmptyState({
  onNavigate,
}: {
  onNavigate: (view: "movies" | "shows" | "live") => void;
}) {
  const previews = [
    { icon: <Clock className="h-4 w-4" />, label: "Watch time" },
    { icon: <Flame className="h-4 w-4" />, label: "Active days" },
    { icon: <Trophy className="h-4 w-4" />, label: "Top title" },
  ];
  return (
    <div className="flex justify-center">
      <div className="harbor-pop-in w-full md-card-outlined rounded-[var(--md-sys-shape-corner-extra-large)] max-w-xl p-8 text-center md:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-edge-soft bg-accent-soft text-accent">
          <Sparkles className="h-8 w-8" aria-hidden />
        </div>
        <h2 className="md-headline-small font-display font-bold text-ink mt-5">Your year in stories</h2>
        <p className="mx-auto mt-3 max-w-md md-body-medium leading-relaxed text-ink-muted">
          Watch time, active days, top titles and genres — computed locally from your watch
          history on this device. Nothing leaves your browser unless you sign in yourself.
        </p>

        <div
          className="harbor-pop-in mt-6 flex flex-wrap items-center justify-center gap-2.5"
          style={{ animationDelay: "90ms" }}
        >
          <button
            type="button"
            onClick={() => onNavigate("movies")}
            className="md-btn-filled harbor-tv-focus"
          >
            <Film className="h-4 w-4" aria-hidden />
            Browse Movies
          </button>
          <button
            type="button"
            onClick={() => onNavigate("shows")}
            className="md-btn-outlined harbor-tv-focus"
          >
            <Tv className="h-4 w-4" aria-hidden />
            Top Shows
          </button>
          <button
            type="button"
            onClick={() => onNavigate("live")}
            className="md-btn-outlined harbor-tv-focus"
          >
            <RadioTower className="h-4 w-4" aria-hidden />
            Open Live TV
          </button>
        </div>

        {/* Decorative preview of what the stats will look like — placeholder only, no data faked,
            non-interactive and hidden from assistive tech on purpose */}
        <div aria-hidden className="pointer-events-none mt-8 grid select-none grid-cols-3 gap-3 opacity-50">
          {previews.map((p, i) => (
            <div
              key={p.label}
              className="harbor-stat-card is-placeholder harbor-pop-in text-left"
              style={{ animationDelay: `${160 + i * 70}ms` }}
            >
              <span className="harbor-stat-chip">{p.icon}</span>
              <div className="mt-3 h-2.5 w-12 rounded-full bg-white/10" />
              <p className="mt-1.5 text-[11px] font-medium text-ink-subtle">{p.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`harbor-card rounded-2xl border p-4 ${
        accent ? "border-accent/40 bg-accent-soft" : "border-edge-soft bg-elevated"
      }`}
    >
      <div className={accent ? "text-accent" : "text-ink-subtle"}>{icon}</div>
      <p className="font-display text-2xl font-bold text-ink mt-2">{value}</p>
      <p className="text-xs text-ink-muted">{label}</p>
    </div>
  );
}
