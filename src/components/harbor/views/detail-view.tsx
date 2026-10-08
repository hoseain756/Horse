"use client";

// Harbor Web — Detail view (Task 30 premium redesign)
// Visual language: Apple TV+ / Disney+ / Netflix-style title page.
//   1. Hero artwork CARD at the top with the official title logo embedded in
//      its bottom scrim — zero floating chips/badges/buttons on the artwork.
//   2. Single-line, non-wrapping metadata row directly below the card:
//      [Rating badge] • [Year] • [Duration] • [Genre tag] (+ cert / source).
//   3. Synopsis right beneath the metadata row (muted, generous line-height).
//   4. Centered action row: primary "Watch Now" CTA + compact expandable
//      menu (watchlist / streams / share) + circular custom-lists button.
//   5. Immersive chrome: the glass dock + floating search are hidden for this
//      page (app-shell immersiveDetail); a semi-transparent back button floats
//      at the top (owned here so deep-linked roots get one too).
// Business logic (meta loading, resume, watchlist, picker push) is unchanged
// from the Harbor port — this is a presentation refactor.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft, Play, Plus, Check, Star, RotateCcw, Layers, ChevronDown, Share2,
} from "lucide-react";
import type { Meta, MetaVideo } from "@/lib/harbor/types";
import { fetchMeta, fetchAddonMeta, fetchCinemetaCatalog } from "@/lib/harbor/api";
import { parseRuntimeToSeconds } from "@/lib/harbor/playback-timeline";
import { useAddons, useNav, useSettings } from "@/lib/harbor/store";
import { isInWatchlist, toggleWatchlist, resumeMsFor, getCwEntry, episodeWatchedSet } from "@/lib/harbor/cw";
import { PosterImage } from "../common/poster";
import { MetaCard } from "../common/meta-card";
import { AddToListButton } from "../chrome/add-to-list";
import { useTmdbEnrichment } from "../chrome/tmdb-enrich";
import { RatingsRow } from "../chrome/ratings-row";
import { useT } from "@/hooks/use-t";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/* ---------- small presentational atoms ---------- */

/** Subtle bullet divider for the single-line metadata row. */
function MetaBullet() {
  return (
    <span aria-hidden className="shrink-0 select-none text-[11px] leading-none text-ink-subtle/60">
      •
    </span>
  );
}

/** Semi-transparent top back button (owned by the detail page so it exists
 *  even when a title is deep-linked as the root nav frame). RTL-mirrors. */
function DetailBackButton() {
  const tr = useT();
  const pop = useNav((s) => s.pop);
  const resetTo = useNav((s) => s.resetTo);
  const depth = useNav((s) => s.stack.length);
  const goBack = useCallback(() => {
    if (depth <= 1) resetTo({ kind: "view", view: "home" });
    else pop();
  }, [depth, pop, resetTo]);
  return (
    <button
      type="button"
      onClick={goBack}
      className="harbor-tv-focus fixed top-4 start-4 z-40 flex h-10 items-center gap-2 rounded-full border border-white/15 bg-black/55 ps-3.5 pe-4 text-sm font-medium text-white backdrop-blur-md transition-all hover:scale-[1.03] hover:bg-black/75 active:scale-95 md-state"
      aria-label={tr("goBack")}
    >
      <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
      {tr("back")}
    </button>
  );
}

export function DetailView({ type, id }: { type: string; id: string }) {
  const tr = useT();
  const { toast } = useToast();
  const push = useNav((s) => s.push);
  const addons = useAddons((s) => s.addons);
  const addonsLoaded = useAddons((s) => s.loaded);
  const settings = useSettings((s) => s.settings);
  // TMDB enrichment (logo, certification, recommendations) — fails soft
  const tmdb = useTmdbEnrichment(type, id, settings.region);

  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inList, setInList] = useState(false);
  const [resume, setResume] = useState(0);
  const [cwEntry, setCwEntry] = useState<ReturnType<typeof getCwEntry>>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    setMeta(null);
    (async () => {
      try {
        let result = await fetchMeta(type, id);
        // If cinemeta misses, try addon metas
        if (!result && addonsLoaded) {
          for (const addon of addons.filter((a) => a.enabled)) {
            try {
              const m = await fetchAddonMeta(addon, type, id);
              if (m) {
                result = m;
                break;
              }
            } catch {
              /* try next */
            }
          }
        }
        if (!alive) return;
        if (!result) {
          setError(tr("titleNotFound"));
        } else {
          setMeta(result);
          setInList(isInWatchlist(id));
          setResume(resumeMsFor(id));
          setCwEntry(getCwEntry(id));
        }
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : tr("fetchFailed"));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, id, addons, addonsLoaded]);

  // Next episode to resume (series)
  const nextVideo: MetaVideo | null = useMemo(() => {
    if (!meta || meta.type !== "series" || !meta.videos?.length) return null;
    if (cwEntry?.season && cwEntry?.episode) {
      const exact = meta.videos.find(
        (v) => v.season === cwEntry.season && v.episode === cwEntry.episode,
      );
      if (exact && resume > 0) return exact;
    }
    return null;
  }, [meta, cwEntry, resume]);

  const onPlay = useCallback(
    (video?: MetaVideo) => {
      if (!meta) return;
      // Duration hint for the playback timeline (approximate until the real
      // container/ffprobe duration lands): TMDB runtime first (minutes), then
      // the Stremio meta runtime string. Series: per-episode runtime when the
      // addon provides one, else the show average / TMDB episode_run_time.
      const tmdbRuntimeMin =
        meta.type === "series"
          ? (tmdb.details?.episode_run_time?.[0] ?? null)
          : (tmdb.details?.runtime ?? null);
      const runtimeSeconds =
        parseRuntimeToSeconds(video?.duration ?? null) ??
        (tmdbRuntimeMin != null ? Math.round(tmdbRuntimeMin * 60) : null) ??
        parseRuntimeToSeconds(meta.runtime);
      if (settings.instantPlay) {
        push({
          kind: "player",
          payload: {
            url: "", // resolved by picker
            title: meta.name,
            type: meta.type,
            metaId: meta.id,
            poster: meta.poster,
            season: video?.season,
            episode: video?.episode,
            videoId: video?.id,
            episodeName: video?.name ?? video?.title,
            deepLink: { type: meta.type, id: meta.id, videoId: video?.id },
            runtimeSeconds: runtimeSeconds ?? undefined,
          },
        });
      } else {
        push({
          kind: "picker",
          type: meta.type,
          id: meta.id,
          videoId: video?.id,
          season: video?.season,
          episode: video?.episode,
          runtimeSeconds: runtimeSeconds ?? undefined,
        });
      }
    },
    [meta, tmdb.details, push, settings.instantPlay],
  );

  /* ---------- expandable secondary menu ---------- */
  const [menuOpen, setMenuOpen] = useState(false);
  const menuWrapRef = useRef<HTMLDivElement>(null);

  // Close on outside pointer + Escape; return focus to the trigger on Esc.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (menuWrapRef.current && !menuWrapRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setMenuOpen(false);
        menuWrapRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
      }
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [menuOpen]);

  const openStreams = useCallback(() => {
    setMenuOpen(false);
    if (!meta) return;
    if (meta.type === "series" && nextVideo) {
      push({
        kind: "picker",
        type: meta.type,
        id: meta.id,
        videoId: nextVideo.id,
        season: nextVideo.season,
        episode: nextVideo.episode,
      });
    } else {
      push({ kind: "picker", type: meta.type, id: meta.id });
    }
  }, [meta, nextVideo, push]);

  const toggleWatchlistFromMenu = useCallback(() => {
    if (!meta) return;
    setInList(
      toggleWatchlist({
        id: meta.id,
        type: meta.type,
        name: meta.name,
        poster: meta.poster,
        releaseInfo: meta.releaseInfo,
        imdbRating: meta.imdbRating,
      }),
    );
  }, [meta]);

  const onShare = useCallback(async () => {
    setMenuOpen(false);
    if (!meta) return;
    const url = window.location.href;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: meta.name, url });
        return; // native sheet finished (dismiss throws AbortError → caught below)
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      // fall through to the clipboard fallback
    }
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: tr("linkCopied") });
    } catch {
      toast({ title: tr("copyFailed") });
    }
  }, [meta, toast, tr]);

  // The back button is fixed chrome of this page — render in every state.
  const back = <DetailBackButton />;

  if (loading) {
    return (
      <div className="px-4 pt-[72px] pb-16 md:px-8 md:pt-20">
        {back}
        {/* hero card skeleton */}
        <div
          className="harbor-skeleton mx-auto aspect-[16/11] max-w-5xl rounded-[28px] sm:aspect-[16/8] md:aspect-[21/8] md:rounded-[36px]"
          aria-hidden
        />
        {/* metadata row skeleton */}
        <div className="mt-5 flex justify-center" aria-hidden>
          <div className="harbor-skeleton h-6 w-72 rounded-full" />
        </div>
        {/* synopsis skeleton */}
        <div className="mx-auto mt-4 max-w-xl space-y-2" aria-hidden>
          <div className="harbor-skeleton mx-auto h-4 w-full rounded-lg" />
          <div className="harbor-skeleton mx-auto h-4 w-3/4 rounded-lg" />
        </div>
        {/* action row skeleton */}
        <div className="mt-7 flex items-center justify-center gap-3" aria-hidden>
          <div className="harbor-skeleton h-[52px] w-44 rounded-full" />
          <div className="harbor-skeleton h-[52px] w-[52px] rounded-full" />
          <div className="harbor-skeleton h-[52px] w-[52px] rounded-full" />
        </div>
        <div className="sr-only">{tr("loadingDetails")}</div>
      </div>
    );
  }

  if (error || !meta) {
    return (
      <div className="mx-auto max-w-xl px-4 pt-28 pb-16 text-center md:pt-32">
        {back}
        <div className="rounded-2xl border border-danger/40 bg-danger/10 px-5 py-4 text-sm text-danger">
          {error ?? tr("titleNotFound")}
        </div>
      </div>
    );
  }

  const watched = episodeWatchedSet();

  /* ---- single-line metadata row data (requirement 2) ---- */
  const imdbScore =
    meta.imdbRating && parseFloat(meta.imdbRating) > 0 ? meta.imdbRating : null;
  const year = meta.releaseInfo?.trim() || null;
  const runtime = meta.runtime?.trim() || null;
  const genre = meta.genres?.find((g) => g && g.trim().length > 0) ?? null;
  const hasAnyMeta = imdbScore || year || runtime || genre;

  return (
    <div className="pb-16">
      {back}

      {/* ================= 1 · HERO ARTWORK CARD =================
          The official logo lives INSIDE the card's bottom scrim. No chips,
          ratings, text or buttons float over the artwork anymore. */}
      <section className="px-4 pt-[72px] md:px-8 md:pt-20" aria-label={meta.name}>
        <div className="harbor-pop-in relative mx-auto aspect-[16/11] max-w-5xl overflow-hidden rounded-[28px] border border-edge-soft bg-raised shadow-[0_36px_90px_-36px_rgba(0,0,0,0.9)] sm:aspect-[16/8] md:aspect-[21/8] md:rounded-[36px]">
          <PosterImage
            src={tmdb.backdrop ?? meta.background ?? meta.poster}
            alt={meta.name}
            className="absolute inset-0"
            landscape
          />
          {/* Bottom scrim — legibility bed for the embedded logo */}
          <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/90 via-black/45 to-transparent" />
          {/* Embedded official title logo (sr-only h1 keeps document outline) */}
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-center px-5 pb-5 md:pb-9">
            {tmdb.logo || meta.logo ? (
              <>
                <h1 className="sr-only">{meta.name}</h1>
                <img
                  src={tmdb.logo ?? meta.logo}
                  alt=""
                  className="max-h-14 w-auto max-w-[78%] object-contain drop-shadow-[0_10px_28px_rgba(0,0,0,0.95)] transition-transform duration-500 sm:max-h-16 md:max-h-24"
                  loading="lazy"
                />
              </>
            ) : (
              <h1 className="font-display text-center text-3xl font-bold tracking-tight text-white drop-shadow-[0_6px_20px_rgba(0,0,0,0.9)] md:text-5xl">
                {meta.name}
              </h1>
            )}
          </div>
        </div>
      </section>

      {/* ============ 2 · SINGLE-LINE METADATA ROW ============
          One horizontal, non-wrapping line directly below the card.
          Scrolls horizontally on the narrowest screens — never wraps. */}
      {hasAnyMeta && (
        <div className="mx-auto mt-4 max-w-3xl">
          {/* Outer scroller + inner w-max row: centers when it fits, scrolls
              from the true start edge when it doesn't (no justify-center
              scroll-trap). Single line — never wraps. */}
          <div className="no-scrollbar overflow-x-auto">
            <div className="flex w-max min-w-full flex-nowrap items-center justify-center gap-2.5 px-4 py-0.5 md:px-6">
              {imdbScore && (
                <span
                  className="flex shrink-0 items-center gap-1.5 rounded-full border border-amber-300/25 bg-amber-400/10 px-2.5 py-1 text-[13px] font-bold text-amber-300 tabular-nums"
                  title="IMDb"
                >
                  <Star className="h-3.5 w-3.5 fill-amber-300" aria-hidden />
                  {imdbScore}
                </span>
              )}
              {imdbScore && year && <MetaBullet />}
              {year && (
                <span className="shrink-0 text-[13px] font-semibold text-ink md:text-sm">
                  {year}
                </span>
              )}
              {year && runtime && <MetaBullet />}
              {runtime && (
                <span
                  dir="ltr" /* addon runtime strings are latin ("58 min", "1h 52m") — isolate so RTL can't reorder to "min 58" */
                  className="shrink-0 text-[13px] font-medium text-ink-muted tabular-nums md:text-sm"
                >
                  {runtime}
                </span>
              )}
              {runtime && genre && <MetaBullet />}
              {genre && (
                <span className="shrink-0 rounded-full border border-edge-soft bg-raised/70 px-2.5 py-1 text-[12px] font-medium text-ink-muted md:text-[13px]">
                  {genre}
                </span>
              )}
              {tmdb.certification && (
                <>
                  <MetaBullet />
                  <span
                    className="shrink-0 rounded-[5px] border border-ink-subtle/40 px-1.5 py-px text-[11px] font-black tracking-wide text-ink-muted"
                    title={tr("contentRating")}
                  >
                    {tmdb.certification}
                  </span>
                </>
              )}
              {meta.addonOrigin && (
                <>
                  <MetaBullet />
                  <span className="shrink-0 text-[12px] text-ink-subtle md:text-[13px]">
                    {/* tr() without vars returns the raw template (keeps the
                        {name} placeholder) so RichVia can bidi-isolate the name */}
                    <RichVia name={meta.addonOrigin.name} template={tr("viaAddon")} />
                  </span>
                </>
              )}
            </div>
          </div>
          {/* Provider rating chips (deep links) — subtle, centered; hidden
              entirely when ratings are off / no provider data. */}
          <div className="mt-2 flex justify-center px-4 md:px-6">
            <RatingsRow
              type={meta.type}
              imdbId={/^tt\d+$/.test(meta.id) ? meta.id : undefined}
              title={meta.name}
              year={meta.releaseInfo}
              genres={meta.genres}
              country={meta.country}
            />
          </div>
        </div>
      )}

      {/* ================== 3 · SYNOPSIS ================== */}
      {meta.description && (
        <p className="mx-auto mt-4 max-w-2xl px-4 text-center text-sm leading-[1.8] text-ink-muted md:px-6 md:text-[15px]">
          {meta.description}
        </p>
      )}

      {/* ========== 4 · CENTERED ACTION CONTROLS + EXPANDABLE MENU ========== */}
      <div className="mx-auto mt-6 flex items-center justify-center gap-2.5 px-4 md:gap-3">
        {/* Primary CTA */}
        {meta.type === "series" && nextVideo && resume > 0 ? (
          <button
            type="button"
            onClick={() => onPlay(nextVideo)}
            className="md-btn md-btn-filled md-state harbor-tv-focus !h-[52px] !rounded-full !px-5 !text-[15px] shadow-[0_14px_36px_-14px_var(--md-sys-color-primary)] transition-transform hover:scale-[1.03] active:scale-[0.97] sm:!px-7 md:!px-9"
          >
            <RotateCcw className="md-btn-icon" aria-hidden />
            {tr("resumeSE", { s: nextVideo.season ?? 1, e: nextVideo.episode ?? 1 })}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onPlay(nextVideo ?? undefined)}
            className="md-btn md-btn-filled md-state harbor-tv-focus !h-[52px] !rounded-full !px-6 !text-[15px] shadow-[0_14px_36px_-14px_var(--md-sys-color-primary)] transition-transform hover:scale-[1.03] active:scale-[0.97] sm:!px-8 md:!px-10"
          >
            <Play className="md-btn-icon fill-current" aria-hidden />
            {tr("watchNow")}
          </button>
        )}

        {/* Secondary expandable menu (spinner/dropdown button) */}
        <div ref={menuWrapRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={tr("moreOptions")}
            className="harbor-tv-focus flex h-[52px] w-[52px] items-center justify-center rounded-full border border-edge-soft bg-raised/80 text-ink backdrop-blur-md transition-all hover:scale-[1.04] hover:bg-raised active:scale-95 md-state"
          >
            <motion.span
              animate={{ rotate: menuOpen ? 180 : 0 }}
              transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
              className="flex"
            >
              <ChevronDown className="h-5 w-5" aria-hidden />
            </motion.span>
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                role="menu"
                aria-label={tr("moreOptions")}
                initial={{ opacity: 0, x: "-50%", y: -8, scale: 0.95 }}
                animate={{ opacity: 1, x: "-50%", y: 0, scale: 1 }}
                exit={{ opacity: 0, x: "-50%", y: -6, scale: 0.97 }}
                transition={{ duration: 0.19, ease: [0.2, 0, 0, 1] }}
                className="absolute top-full left-1/2 z-40 mt-2 w-60 origin-top overflow-hidden rounded-2xl border border-edge-soft bg-elevated/95 shadow-[var(--md-sys-elevation-3)] backdrop-blur-xl"
              >
                <ul className="p-1.5">
                  <li>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        toggleWatchlistFromMenu();
                        setMenuOpen(false);
                      }}
                      className="md-state harbor-tv-focus flex min-h-11 w-full items-center gap-3 rounded-xl px-3.5 text-start text-sm font-medium text-ink transition-colors hover:bg-raised"
                    >
                      {inList ? (
                        <Check className="h-4 w-4 text-accent" aria-hidden />
                      ) : (
                        <Plus className="h-4 w-4" aria-hidden />
                      )}
                      {inList ? tr("inWatchlistItem") : tr("addToWatchlist")}
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={openStreams}
                      title={tr("streamsHint")}
                      className="md-state harbor-tv-focus flex min-h-11 w-full items-center gap-3 rounded-xl px-3.5 text-start text-sm font-medium text-ink transition-colors hover:bg-raised"
                    >
                      <Layers className="h-4 w-4" aria-hidden />
                      {tr("availableStreams")}
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={onShare}
                      className="md-state harbor-tv-focus flex min-h-11 w-full items-center gap-3 rounded-xl px-3.5 text-start text-sm font-medium text-ink transition-colors hover:bg-raised"
                    >
                      <Share2 className="h-4 w-4" aria-hidden />
                      {tr("share")}
                    </button>
                  </li>
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Custom user lists — compact circular icon variant (Task 30) */}
        <AddToListButton
          variant="icon"
          item={{
            id: meta.id,
            type: meta.type,
            name: meta.name,
            poster: meta.poster,
            releaseInfo: meta.releaseInfo,
            imdbRating: meta.imdbRating,
          }}
        />
      </div>

      {/* Cast & crew — quiet centered lines under the action row */}
      {(meta.cast?.length || meta.director?.length) && (
        <div className="mx-auto mt-8 flex max-w-2xl flex-col items-center gap-2 px-4 text-center md:px-6">
          {meta.director && meta.director.length > 0 && (
            <p className="text-[13px] leading-relaxed">
              <span className="me-2 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
                {tr("director")}
              </span>
              <span className="font-medium text-ink">{meta.director.slice(0, 2).join(", ")}</span>
            </p>
          )}
          {meta.cast && meta.cast.length > 0 && (
            <p className="text-[13px] leading-relaxed">
              <span className="me-2 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
                {tr("starring")}
              </span>
              <span className="font-medium text-ink harbor-clamp-2">{meta.cast.slice(0, 4).join(", ")}</span>
            </p>
          )}
        </div>
      )}

      {/* Episodes */}
      {meta.type === "series" && <EpisodeList meta={meta} watched={watched} onPlay={onPlay} />}

      {/* TMDB recommendations (fail-soft — hidden when TMDB is off) */}
      {tmdb.recommendations.length > 0 && <TmdbRecsRail items={tmdb.recommendations} />}

      {/* More like this — genre-based discovery via the Cinemeta top catalog */}
      <SimilarRail type={meta.type} genres={meta.genres} currentId={meta.id} />

      {/* Movie: default video behavior — Cinemeta movies have behaviorHints.defaultVideoId or just play id */}
      {meta.type === "movie" && !meta.genres?.length && (
        <div className="mx-auto mt-8 max-w-2xl px-4 text-center md:px-6">
          <p className="text-xs text-ink-subtle">{tr("pressPlayHint")}</p>
        </div>
      )}
    </div>
  );
}

/** "via {addon}" with the addon name bidi-isolated (latin token in AR text).
 *  `template` is the raw localized string still containing {name}. */
function RichVia({ name, template }: { name: string; template: string }) {
  const parts = template.split("{name}");
  return (
    <>
      {parts[0]}
      <bdi>{name}</bdi>
      {parts[1]}
    </>
  );
}

// ---------- Episode list ----------
function EpisodeList({
  meta,
  watched,
  onPlay,
}: {
  meta: Meta;
  watched: Set<string>;
  onPlay: (video: MetaVideo) => void;
}) {
  const tr = useT();
  const videos = useMemo(() => {
    const vids = [...(meta.videos ?? [])];
    // group by season
    return vids;
  }, [meta.videos]);

  const seasons = useMemo(() => {
    const set = new Set<number>();
    for (const v of videos) {
      if (typeof v.season === "number") set.add(v.season);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [videos]);

  const [season, setSeason] = useState<number | null>(null);
  const [sortDesc, setSortDesc] = useState(false);

  // Default to latest season when none selected (render-time derivation, no effect)
  const effectiveSeason = season ?? (seasons.length > 0 ? seasons[seasons.length - 1] : null);

  const seasonVideos = useMemo(() => {
    const list = videos.filter((v) => v.season === effectiveSeason);
    return sortDesc ? [...list].reverse() : list;
  }, [videos, effectiveSeason, sortDesc]);

  if (videos.length === 0) {
    return (
      <div className="mx-auto mt-10 max-w-3xl px-4 text-sm text-ink-subtle md:px-8">
        {tr("noEpisodes")}
      </div>
    );
  }

  return (
    <div className="mx-auto mt-12 max-w-3xl px-4 md:px-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="md-title-large text-ink">{tr("episodesTitle")}</h2>
        <button
          type="button"
          onClick={() => setSortDesc((v) => !v)}
          className="md-chip md-state harbor-tv-focus"
        >
          {sortDesc ? tr("newestFirst") : tr("oldestFirst")}
        </button>
      </div>

      {/* Season selector chips (horizontally scrollable for long-running shows) */}
      {seasons.length > 1 && (
        <div
          className="no-scrollbar mb-3 flex gap-1.5 overflow-x-auto pb-2"
          role="group"
          aria-label={tr("selectSeason")}
        >
          {seasons.map((s) => {
            const active = s === effectiveSeason;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setSeason(s)}
                aria-pressed={active}
                className={cn(
                  "md-chip md-state harbor-tv-focus shrink-0",
                  active && "md-chip-selected",
                )}
              >
                {tr("seasonN", { n: s })}
              </button>
            );
          })}
        </div>
      )}

      <div className="harbor-scroll max-h-[60vh] space-y-2.5 overflow-y-auto pr-1">
        {seasonVideos.map((v) => {
          const isWatched = watched.has(v.id) || watched.has(`${meta.id}:${v.season}:${v.episode}`);
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => onPlay(v)}
              className={cn(
                "md-state group/ep harbor-tv-focus relative flex w-full items-center gap-4 rounded-[var(--md-sys-shape-corner-medium)] border border-edge-soft p-3 text-left",
                isWatched ? "bg-elevated/40 opacity-60" : "bg-elevated",
              )}
            >
              {/* Accent start bar on hover */}
              <span
                aria-hidden
                className="absolute start-0 top-3 bottom-3 w-[3px] rounded-full bg-accent opacity-0 transition-opacity group-hover/ep:opacity-100"
              />
              <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-xl bg-raised md:h-20 md:w-36">
                <PosterImage src={v.thumb} alt={v.name ?? v.title ?? ""} className="absolute inset-0" landscape />
                {isWatched && (
                  <span className="absolute top-1 end-1 flex h-5 w-5 items-center justify-center rounded-full border border-accent/50 bg-accent-soft backdrop-blur-sm">
                    <Check className="h-3 w-3 text-accent" />
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                {/* dir=auto: latin titles render "E1 Title"; Arabic titles render
                    RTL with the latin E-prefix bidi-isolated (bdi) */}
                <p dir="auto" className="harbor-clamp-1 md-title-small text-ink">
                  <bdi className="me-2 text-ink-subtle">E{v.episode}</bdi>
                  {v.name ?? v.title ?? tr("episodeN", { n: v.episode ?? 0 })}
                </p>
                {v.released && <p className="md-body-small mt-0.5 text-ink-subtle">{new Date(v.released).toLocaleDateString()}</p>}
                {(v.overview ?? v.description) && (
                  <p className="md-body-small harbor-clamp-2 mt-1 leading-relaxed text-ink-muted">
                    {v.overview ?? v.description}
                  </p>
                )}
              </div>
              <Play className="h-4 w-4 shrink-0 text-accent transition-transform group-hover/ep:scale-110" aria-hidden />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- TMDB recommendations rail (Feature: TMDB enrichment) ----------

function TmdbRecsRail({ items }: { items: Meta[] }) {
  const tr = useT();
  const push = useNav((s) => s.push);
  if (items.length === 0) return null;
  return (
    <section className="mt-12" aria-label={tr("recommendedByTmdb")}>
      <div className="mb-3 flex items-center gap-2 px-4 md:px-8">
        <Layers className="h-5 w-5 text-accent" aria-hidden />
        <h2 className="md-title-large text-ink">{tr("recommendedTitle")}</h2>
        <span className="md-chip md-label-small !h-6 !px-2 cursor-default!">{tr("viaTmdb")}</span>
      </div>
      <div className="harbor-scroll-x overflow-x-auto flex gap-3 px-4 pb-2 md:px-8">
        {items.map((m) => (
          <div key={`${m.type}-${m.id}`} className="w-[112px] shrink-0 md:w-[136px]">
            <MetaCard meta={m} onOpen={() => push({ kind: "detail", type: m.type, id: m.id })} />
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------- More like this rail (genre-based, Cinemeta top catalog) ----------

function SimilarRail({
  type,
  genres,
  currentId,
}: {
  type: string;
  genres?: string[];
  currentId: string;
}) {
  const tr = useT();
  const push = useNav((s) => s.push);
  const genre = genres?.find((g) => g && g.trim().length > 0);
  // Data is keyed by the genre it was fetched for, so a genre change renders a
  // skeleton without a synchronous setState inside the effect.
  const [data, setData] = useState<{ genre: string; items: Meta[] } | null>(null);

  useEffect(() => {
    if (!genre) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetchCinemetaCatalog(
          type === "series" ? "series" : "movie",
          "top",
          { genre },
        );
        if (!alive) return;
        setData({ genre, items: res.filter((m) => m.id !== currentId).slice(0, 14) });
      } catch {
        if (alive) setData({ genre, items: [] });
      }
    })();
    return () => {
      alive = false;
    };
  }, [type, genre, currentId]);

  if (!genre) return null;
  const items: Meta[] | null = data && data.genre === genre ? data.items : null;

  return (
    <section className="mt-12" aria-label={tr("moreLikeThis")}>
      <div className="mb-3 flex items-center gap-2 px-4 md:px-8">
        <Layers className="h-5 w-5 text-accent" aria-hidden />
        <h2 className="md-title-large text-ink">{tr("moreLikeThis")}</h2>
        <span className="md-chip md-label-small !h-6 !px-2 cursor-default!">{genre}</span>
      </div>
      {items === null ? (
        <div className="flex gap-3 overflow-hidden px-4 md:px-8" aria-hidden>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="harbor-skeleton aspect-[2/3] w-[112px] shrink-0 rounded-xl md:w-[136px]" />
          ))}
        </div>
      ) : items.length === 0 ? null : (
        <div className="harbor-scroll-x overflow-x-auto flex gap-3 px-4 pb-2 md:px-8">
          {items.map((m) => (
            <div key={`${m.id}`} className="w-[112px] shrink-0 md:w-[136px]">
              <MetaCard
                meta={m}
                onOpen={() => push({ kind: "detail", type: m.type || type, id: m.id })}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
