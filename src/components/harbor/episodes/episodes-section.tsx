"use client";

// Harbor Web — Episodes section (detail page, full rebuild)
// Replaces the old chips + plain list. Owner of all local state (season,
// sort, view, virtualization, user-data derivation) so season/view changes
// never re-render the rest of the details page.
//
// Features:
//  • Season dropdown (single-season titles show a plain count instead)
//  • Default season = season of the in-progress/next-unwatched episode, else
//    the first season; the user's pick is remembered per title for the session
//  • List / Grid views with a persisted toggle (settings.episodesView; "auto"
//    resolves List < 600px container, Grid ≥ 600px)
//  • Both views virtualized (useWindowedRows) — 1000+ episodes render ~10
//    rows of DOM, flat memory; view toggle keeps the current item in view
//  • Per-episode art chain + IMDb-style rating chip + runtime via TMDB season
//    data (fail-soft), watched/progress from local history (read-only)
//  • Spoiler blur (settings.blurEpisodeThumbnails) on unwatched thumbnails
//  • Upcoming (future air date) episodes: dimmed, show the air date, and are
//    not playable — behavior contract of the app
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Meta, MetaVideo } from "@/lib/harbor/types";
import { getCwEntry, getHistory, episodeProgressMap } from "@/lib/harbor/cw";
import { isArabic } from "@/lib/harbor/i18n";
import { useSettings } from "@/lib/harbor/store";
import { useT } from "@/hooks/use-t";
import { cn } from "@/lib/utils";
import { EpisodesToolbar, type EpisodesViewMode } from "./episodes-toolbar";
import { EpisodeCard, type EpisodeLabels } from "./episode-card";
import { EpisodeRow } from "./episode-row";
import { type SeasonOption } from "./season-dropdown";
import { useWindowedRows, type WindowedRowsApi } from "./use-windowed-rows";
import { useEpisodeArt } from "./use-episode-art";
import type { EpisodeItem } from "./types";

const WATCHED_THRESHOLD = 0.85;

/** Session (per page load) season memory keyed by title id. */
const sessionSeason = new Map<string, number>();

const DATE_FMT: Record<string, Intl.DateTimeFormat> = {};
function formatDate(iso: string, lang: string): string {
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) return "";
  // Latin digits in every locale — matches the app-wide digit discipline
  // (formatNumber uses ar-u-nu-latn), so one meta line never mixes digit sets.
  const tag = isArabic(lang) ? "ar-u-nu-latn" : "en";
  DATE_FMT[tag] ??= new Intl.DateTimeFormat(tag, { year: "numeric", month: "short", day: "numeric" });
  return DATE_FMT[tag].format(time);
}

/** Stremio addon runtimes are latin strings ("23min") — normalize to minutes. */
function parseDurationMinutes(raw?: string): number | undefined {
  if (!raw) return undefined;
  const m = raw.match(/(\d+)\s*(?:min|mins|minutes?)\b/i) ?? /^(\d+)$/.exec(raw.trim());
  const n = m ? Number.parseInt(m[1], 10) : Number.NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

type UserData = { watched: Set<string>; progress: Map<string, number> };

function computeUserData(metaId: string): UserData {
  const progress = episodeProgressMap();
  const watched = new Set<string>();
  for (const h of getHistory()) {
    const p = h.durationMs > 0 ? h.positionMs / h.durationMs : 0;
    if (p < WATCHED_THRESHOLD) continue;
    if (h.videoId) watched.add(h.videoId);
    if (h.season != null && h.episode != null) watched.add(`${metaId}:${h.season}:${h.episode}`);
  }
  return { watched, progress };
}

export function EpisodesSection({
  meta,
  tmdbId,
  backdropUrl,
  onPlay,
}: {
  meta: Meta;
  /** Resolved TMDB id from the detail page enrichment (null → no TMDB art). */
  tmdbId: number | null;
  /** Series-level backdrop (cover-cropped) as the last art fallback. */
  backdropUrl?: string;
  onPlay: (video: MetaVideo) => void;
}) {
  const tr = useT();
  const settings = useSettings((s) => s.settings);
  const updateSettings = useSettings((s) => s.update);

  const videos = useMemo(() => meta.videos ?? [], [meta.videos]);

  // ---------- user data (watched + progress), self-contained ----------
  const [userData, setUserData] = useState<UserData>({ watched: new Set(), progress: new Map() });
  useEffect(() => {
    const refresh = () => setUserData(computeUserData(meta.id));
    refresh();
    window.addEventListener("harbor:data-changed", refresh);
    return () => window.removeEventListener("harbor:data-changed", refresh);
  }, [meta.id]);

  // ---------- seasons ----------
  const seasons = useMemo(() => {
    const set = new Set<number>();
    for (const v of videos) if (typeof v.season === "number") set.add(v.season);
    return Array.from(set).sort((a, b) => a - b);
  }, [videos]);

  const seasonStats = useMemo(() => {
    const map = new Map<number, SeasonOption>();
    for (const s of seasons) {
      map.set(s, {
        season: s,
        label: s === 0 ? tr("specialsSeason") : tr("seasonN", { n: s }),
        count: 0,
        watched: 0,
      });
    }
    for (const v of videos) {
      if (typeof v.season !== "number") continue;
      const opt = map.get(v.season);
      if (!opt) continue;
      opt.count += 1;
      const p = v.id ? (userData.progress.get(v.id) ?? 0) : 0;
      if (
        userData.watched.has(v.id) ||
        userData.watched.has(`${meta.id}:${v.season}:${v.episode}`) ||
        p >= WATCHED_THRESHOLD
      ) {
        opt.watched += 1;
      }
    }
    return map;
  }, [seasons, videos, userData, meta.id, tr]);

  // ---------- selected season ----------
  const [season, setSeason] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const defaultSeason = useMemo(() => {
    if (seasons.length === 0) return null;
    // Natural order for "next episode": regular seasons ascending, then
    // specials (season 0) last — a fresh user lands on Season 1, not Specials.
    const orderedSeasons = [...seasons.filter((s) => s > 0), ...seasons.filter((s) => s === 0)];
    const orderIdx = new Map(orderedSeasons.map((s, i) => [s, i]));
    // 1) in-progress episode (continue-watching entry for this title)
    const cw = getCwEntry(meta.id);
    if (
      cw?.season != null &&
      seasons.includes(cw.season) &&
      (userData.progress.get(cw.videoId ?? "") ?? 0) < WATCHED_THRESHOLD
    ) {
      return cw.season;
    }
    // 2) first season with something unwatched, in natural season+episode order
    const sorted = [...videos]
      .filter((v) => typeof v.season === "number")
      .sort(
        (a, b) =>
          (orderIdx.get(a.season as number) ?? 99) - (orderIdx.get(b.season as number) ?? 99) ||
          (a.episode ?? 0) - (b.episode ?? 0),
      );
    for (const v of sorted) {
      const p = userData.progress.get(v.id) ?? 0;
      const isWatched =
        userData.watched.has(v.id) ||
        userData.watched.has(`${meta.id}:${v.season}:${v.episode}`) ||
        p >= WATCHED_THRESHOLD;
      if (!isWatched) return v.season as number;
    }
    // 3) everything watched → first regular season (else the very first)
    return orderedSeasons[0];
  }, [seasons, videos, userData, meta.id]);

  const effectiveSeason =
    season ??
    (hydrated ? (sessionSeason.get(meta.id) ?? defaultSeason) : null) ??
    seasons[0] ??
    null;

  const onSeasonChange = useCallback(
    (s: number) => {
      setSeason(s);
      sessionSeason.set(meta.id, s);
    },
    [meta.id],
  );

  // ---------- TMDB per-episode art/ratings (fail-soft) ----------
  const { art } = useEpisodeArt(tmdbId, effectiveSeason);

  // ---------- sort ----------
  const [sortDesc, setSortDesc] = useState(false);

  // ---------- scroller measurement (drives view + cols + estimates) ----------
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [sectionW, setSectionW] = useState(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.round(entry.contentRect.width);
        setSectionW((prev) => (Math.abs(prev - w) >= 1 ? w : prev));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ---------- view mode ----------
  // Explicit setting wins; "auto" = List < 600px container / Grid ≥ 600px.
  const view: EpisodesViewMode =
    settings.episodesView !== "auto" ? settings.episodesView : sectionW >= 600 ? "grid" : "list";

  const cols =
    view === "grid"
      ? sectionW < 600
        ? 2
        : sectionW < 1024
          ? 3
          : sectionW < 1360
            ? 4
            : 5
      : sectionW >= 1280
        ? 2
        : 1;

  // ---------- build items for the active season ----------
  const items = useMemo<EpisodeItem[]>(() => {
    if (effectiveSeason === null) return [];
    const list = videos
      .filter((v) => v.season === effectiveSeason)
      .map((v) => {
        const epNum = v.episode ?? 0;
        const artEntry = art.get(epNum);
        const progress = userData.progress.get(v.id) ?? 0;
        const watched =
          userData.watched.has(v.id) ||
          userData.watched.has(`${meta.id}:${v.season}:${v.episode}`) ||
          progress >= WATCHED_THRESHOLD;
        const releasedMs = v.released ? new Date(v.released).getTime() : Number.NaN;
        return {
          video: v,
          season: effectiveSeason,
          epNum,
          title: v.name ?? v.title ?? tr("episodeN", { n: epNum }),
          story: (v.overview ?? v.description ?? "").trim(),
          watched,
          progress,
          upcoming: Number.isFinite(releasedMs) && releasedMs > Date.now(),
          stillPath: artEntry?.stillPath,
          rating: settings.ratingsEnabled === false ? undefined : artEntry?.rating,
          runtimeMin: artEntry?.runtimeMin ?? parseDurationMinutes(v.duration),
        } satisfies EpisodeItem;
      });
    list.sort((a, b) => (sortDesc ? b.epNum - a.epNum : a.epNum - b.epNum));
    return list;
  }, [videos, effectiveSeason, art, userData, meta.id, tr, sortDesc, settings.ratingsEnabled]);

  // ---------- virtualization ----------
  const gapFor = useCallback(
    (w: number) => (w >= 1360 ? 20 : w >= 1024 ? 18 : w >= 600 ? 16 : 12),
    [],
  );

  const estimateRowH = useCallback(
    (colsArg: number, w: number) => {
      if (view === "grid") {
        const colW = w > 0 ? (w - (colsArg - 1) * gapFor(w)) / colsArg : 220;
        const thumbH = Math.max(90, (colW * 9) / 16);
        return thumbH + 122 + gapFor(w);
      }
      const thumbW = Math.min(250, Math.max(120, w * 0.4));
      return Math.max(152, (thumbW * 9) / 16 + 24);
    },
    [view, gapFor],
  );

  const api = useWindowedRows({
    count: items.length,
    cols,
    containerW: sectionW,
    scrollRef,
    estimateRowH,
    resetKey: `${meta.id}|${effectiveSeason}|${sortDesc}|${view}`,
  });
  const apiRef = useRef<WindowedRowsApi | null>(null);
  apiRef.current = api;

  // Re-anchor after a view toggle (the hook's resetKey effect scrolled to 0).
  const pendingAnchorRef = useRef<number | null>(null);
  useEffect(() => {
    const anchor = pendingAnchorRef.current;
    if (anchor == null) return;
    pendingAnchorRef.current = null;
    const raf = requestAnimationFrame(() => apiRef.current?.scrollToItem(anchor));
    return () => cancelAnimationFrame(raf);
  }, [api.resetKey]);

  const changeView = useCallback(
    (v: EpisodesViewMode) => {
      if (v === view) return;
      // Keep the current item in view across the layout swap.
      pendingAnchorRef.current = apiRef.current?.firstVisibleItem() ?? 0;
      updateSettings({ episodesView: v });
    },
    [view, updateSettings],
  );

  // ---------- keyboard roving navigation ----------
  const focusItem = useCallback((idx: number) => {
    const el = apiRef.current?.scrollRef.current;
    if (!el) return;
    const q = el.querySelector<HTMLElement>(`[data-ep-idx="${idx}"]`);
    if (q) {
      q.focus();
      return;
    }
    apiRef.current?.scrollToItem(idx);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        el.querySelector<HTMLElement>(`[data-ep-idx="${idx}"]`)?.focus();
      }),
    );
  }, []);

  const onNavKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const keys = ["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End"];
      if (!keys.includes(e.key)) return;
      const el = apiRef.current?.scrollRef.current;
      if (!el || items.length === 0) return;
      const rtl = getComputedStyle(el).direction === "rtl";
      const from = Number(
        (e.target as HTMLElement).closest<HTMLElement>("[data-ep-idx]")?.dataset.epIdx ??
          Number.NaN,
      );
      const base = Number.isFinite(from) ? from : (apiRef.current?.firstVisibleItem() ?? 0);
      let next: number;
      if (e.key === "Home") next = 0;
      else if (e.key === "End") next = items.length - 1;
      else {
        let delta = 0;
        if (e.key === "ArrowDown") delta = view === "grid" ? cols : 1;
        else if (e.key === "ArrowUp") delta = view === "grid" ? -cols : -1;
        else if (e.key === "ArrowLeft") delta = rtl ? 1 : -1;
        else if (e.key === "ArrowRight") delta = rtl ? -1 : 1;
        next = Math.min(items.length - 1, Math.max(0, base + delta));
      }
      e.preventDefault();
      focusItem(next);
    },
    [items.length, view, cols, focusItem],
  );

  // ---------- render helpers ----------
  const handlePlay = useCallback((item: EpisodeItem) => onPlay(item.video), [onPlay]);

  const labels = useMemo<EpisodeLabels>(
    () => ({
      watchedLabel: tr("watchedBadge"),
      upcomingLabel: tr("upcomingBadge"),
      runtimeMin: (n) => tr("minutesShort", { n }),
      formatDate: (iso) => formatDate(iso, tr.lang),
    }),
    [tr],
  );

  if (videos.length === 0 || seasons.length === 0) {
    return (
      <section className="episodes-scope mt-12 w-full" aria-label={tr("episodesTitle")}>
        <div className="harbor-page-container">
          <h2 className="md-title-medium mb-3 text-ink">{tr("episodesTitle")}</h2>
          <p className="text-sm text-ink-subtle">{tr("noEpisodes")}</p>
        </div>
      </section>
    );
  }

  const gapPx = gapFor(sectionW);
  const gridSizes =
    sectionW > 0
      ? `${Math.max(120, Math.round((sectionW - (cols - 1) * gapPx) / cols))}px`
      : "45vw";
  const listSizes = "(max-width: 599px) 40vw, 250px";
  const sizes = view === "grid" ? gridSizes : listSizes;
  const blurSetting = settings.blurEpisodeThumbnails;

  const rows: number[] = [];
  for (let r = api.startRow; r <= api.endRow && r < api.rowCount; r++) rows.push(r);

  return (
    <section className="episodes-scope mt-12 w-full" aria-label={tr("episodesTitle")}>
      <div className="harbor-page-container">
        <h2 className="md-title-medium mb-3 text-ink">{tr("episodesTitle")}</h2>

        <div className="episodes-body">
          <EpisodesToolbar
            seasonOptions={seasons.map((s) => seasonStats.get(s)!).filter(Boolean)}
            season={effectiveSeason}
            onSeasonChange={onSeasonChange}
            singleSeasonLabel={tr("episodesCount", { n: videos.length })}
            selectLabel={tr("selectSeason")}
            sortDesc={sortDesc}
            onToggleSort={() => setSortDesc((v) => !v)}
            sortLabel={sortDesc ? tr("newestFirst") : tr("oldestFirst")}
            view={view}
            onViewChange={changeView}
            viewListLabel={tr("viewList")}
            viewGridLabel={tr("viewGrid")}
            layoutLabel={tr("episodesLayoutLabel")}
          />

          <div
            ref={scrollRef}
            onKeyDown={onNavKeyDown}
            className={cn(
              "harbor-scroll min-h-44 overflow-y-auto overscroll-contain rounded-[var(--ep-radius)]",
              items.length > 6 && "max-h-[var(--ep-scroller-max)]",
            )}
          >
            <div
              ref={api.bodyRef}
              role="list"
              aria-label={tr("episodesTitle")}
              className="relative mx-auto w-full"
              style={{
                height: api.spacerH,
                maxWidth: view === "list" && cols === 1 ? "var(--ep-list-max)" : undefined,
              }}
            >
              {rows.map((row) => (
                <div
                  key={row}
                  ref={api.registerRow(row)}
                  role="presentation"
                  className="absolute inset-x-0"
                  style={{ top: api.rowTop(row) }}
                >
                  <div
                    className="grid"
                    style={{
                      gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                      columnGap: "var(--ep-gap)",
                      paddingBottom: "var(--ep-gap)",
                    }}
                  >
                    {Array.from({ length: cols }, (_, k) => {
                      const idx = row * cols + k;
                      const item = items[idx];
                      if (!item) return <div key={k} role="presentation" />;
                      // Spoiler blur: untouched episodes only — watched AND
                      // in-progress ones show clearly (spec).
                      const blurred =
                        blurSetting &&
                        !item.watched &&
                        item.progress <= 0.02;
                      return view === "grid" ? (
                        <EpisodeCard
                          key={item.video.id}
                          item={item}
                          index={idx}
                          blurred={blurred}
                          backdropUrl={backdropUrl}
                          sizes={sizes}
                          labels={labels}
                          onPlay={handlePlay}
                        />
                      ) : (
                        <EpisodeRow
                          key={item.video.id}
                          item={item}
                          index={idx}
                          blurred={blurred}
                          backdropUrl={backdropUrl}
                          sizes={sizes}
                          labels={labels}
                          onPlay={handlePlay}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
