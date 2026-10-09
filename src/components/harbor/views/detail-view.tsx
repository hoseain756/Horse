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
import { motion } from "framer-motion";
import {
  ArrowLeft, Play, Plus, Check, Star, RotateCcw, Layers, ChevronDown, Share2,
} from "lucide-react";
import type { Meta, MetaVideo } from "@/lib/harbor/types";
import { fetchMeta, fetchAddonMeta, fetchCinemetaCatalog } from "@/lib/harbor/api";
import { parseRuntimeToSeconds } from "@/lib/harbor/playback-timeline";
import { useAddons, useNav, useSettings } from "@/lib/harbor/store";
import { isInWatchlist, toggleWatchlist, resumeMsFor, getCwEntry } from "@/lib/harbor/cw";
import { PosterImage } from "../common/poster";
import { MetaCard } from "../common/meta-card";
import { AddToListButton } from "../chrome/add-to-list";
import { useTmdbEnrichment } from "../chrome/tmdb-enrich";
import { RatingsRow } from "../chrome/ratings-row";
import { useT } from "@/hooks/use-t";
import { useToast } from "@/hooks/use-toast";
import { EpisodesSection } from "../episodes/episodes-section";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/* ---------- small presentational atoms ---------- */

/** Full-bleed hero backdrop art, following the app's image rules:
 *  - TMDB backdrops use the NATIVE CDN srcset ladder (w780 → w1280 →
 *    original; the TMDB CDN serves AVIF/WebP via Accept header) — same
 *    ladder as tmdbBackdropTiers in home-hero.
 *  - Metahub backgrounds go through the /api/img transform proxy
 *    (AVIF/WebP + width fit) — same rule as the episodes thumbnails.
 *  - Anything else keeps its plain src (never breaks).
 *  The hero always spans the full viewport width, so sizes="100vw". */
function heroBackdropArt(url: string | undefined): { src: string; srcSet?: string } {
  if (!url) return { src: "" };
  const tmdb = url.match(/image\.tmdb\.org\/t\/p\/[^/]+(\/.+)$/);
  if (tmdb) {
    const at = (slug: string) => `https://image.tmdb.org/t/p/${slug}${tmdb[1]}`;
    return {
      src: at("w1280"),
      srcSet: [
        `${at("w780")} 780w`,
        `${at("w1280")} 1280w`,
        `${at("original")} 1920w`,
        `${at("original")} 2560w`,
      ].join(", "),
    };
  }
  const mh = url.match(/images\.metahub\.space\/background\/(?:small|medium|large|xlarge|original)\/(.+)$/);
  if (mh) {
    const proxied = (slug: string, w: number) =>
      `/api/img?u=${encodeURIComponent(`https://images.metahub.space/background/${slug}/${mh[1]}`)}&w=${w}&q=80`;
    return {
      src: proxied("medium", 1280),
      srcSet: `${proxied("medium", 1280)} 1280w, ${proxied("large", 1920)} 1920w, ${proxied("large", 2560)} 2560w`,
    };
  }
  return { src: url };
}

/** Subtle bullet divider for the single-line metadata row. */
function MetaBullet() {
  return (
    <span aria-hidden className="shrink-0 select-none text-[11px] leading-none text-ink-subtle/60">
      •
    </span>
  );
}

/** Semi-transparent back button OVERLAID on the hero's top inline-start
 *  corner — 48dp touch target, safe-area aware (portrait top inset + physical
 *  start inset for landscape notches), glass recipe for readability over any
 *  artwork. Owned by the detail page so it exists even when a title is
 *  deep-linked as the root nav frame. RTL-mirrors (start = right in Arabic). */
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
      className="harbor-tv-focus fixed top-[calc(1rem_+_env(safe-area-inset-top))] start-[calc(1rem_+_env(safe-area-inset-left))] rtl:start-[calc(1rem_+_env(safe-area-inset-right))] z-40 flex h-12 items-center gap-2 rounded-full border border-white/15 bg-black/55 ps-3.5 pe-4 text-sm font-medium text-white backdrop-blur-md transition-all hover:scale-[1.03] hover:bg-black/75 active:scale-95 md-state"
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

  /* ---------- expandable secondary menu ----------
     Placement is owned by Radix (portal + collision-aware popper): the menu
     renders outside the document flow at the end of <body>, so opening it
     can never widen, clip, or shift the page. State stays here only to
     rotate the chevron. */
  const [menuOpen, setMenuOpen] = useState(false);

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
      <div className="min-w-0 pb-16">
        {back}
        {/* hero skeleton — mirrors the real hero (card <600px, full-bleed band ≥600px) */}
        <div
          className="harbor-skeleton mx-auto h-[calc((100vw_-_2rem)_*_11_/_16_+_72px)] max-w-5xl rounded-b-[28px] max-[599px]:mx-4 min-[600px]:mx-0 min-[600px]:h-[clamp(360px,52vh,680px)] min-[600px]:rounded-none"
          aria-hidden
        />
        {/* content column skeleton (same container as the real column) */}
        <div className="harbor-page-container mt-6 space-y-3" aria-hidden>
          <div className="harbor-skeleton h-6 w-72 max-w-full rounded-full" />
          <div className="harbor-skeleton h-4 w-full max-w-xl rounded-lg" />
          <div className="harbor-skeleton h-4 w-2/3 max-w-md rounded-lg" />
          <div className="harbor-skeleton h-[52px] w-64 max-w-full rounded-full" />
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

  /* ---- single-line metadata row data (requirement 2) ---- */
  const imdbScore =
    meta.imdbRating && parseFloat(meta.imdbRating) > 0 ? meta.imdbRating : null;
  const year = meta.releaseInfo?.trim() || null;
  const runtime = meta.runtime?.trim() || null;
  const genre = meta.genres?.find((g) => g && g.trim().length > 0) ?? null;
  const hasAnyMeta = imdbScore || year || runtime || genre;

  // Full-bleed backdrop sources (native TMDB ladder / proxied Metahub ladder)
  const backdrop = heroBackdropArt(tmdb.backdrop ?? meta.background ?? meta.poster);
  const hasLogo = Boolean(tmdb.logo || meta.logo);

  return (
    <div className="min-w-0 pb-16">
      {back}

      {/* ================= 1 · CINEMATIC HERO =================
          BOTH variants dock flush to the very top edge (y=0) — no strip above
          the artwork; the Back button overlays it (safe-area offset + light
          top scrim). <600px: contained card — square top corners where it
          meets the screen edge, rounded bottom; height = the old 16/11 art
          height + the 72px strip it replaced (100vw - 2rem ≈ card width), so
          the bottom edge — and everything below it — stays exactly where it
          was. ≥600px: full-bleed landscape backdrop, fading into the page
          background at the bottom. Scrims keep text readable; both mirror in
          RTL. */}
      <section aria-label={meta.name} className="relative max-[599px]:px-4">
        {/* sr-only h1 keeps the document outline in both hero variants */}
        <h1 className="sr-only">{meta.name}</h1>
        <div className="harbor-pop-in relative mx-auto h-[calc((100vw_-_2rem)_*_11_/_16_+_72px)] w-full max-w-5xl overflow-hidden rounded-b-[28px] border border-edge-soft bg-raised shadow-[0_36px_90px_-36px_rgba(0,0,0,0.9)] min-[600px]:h-[clamp(360px,52vh,680px)] min-[600px]:max-w-none min-[600px]:rounded-none min-[600px]:border-0 min-[600px]:shadow-none">
          <PosterImage
            src={backdrop.src}
            srcSet={backdrop.srcSet}
            sizes="100vw"
            eager
            alt={meta.name}
            className="absolute inset-0 min-[600px]:object-[50%_30%]"
            landscape
          />
          {/* Very light top scrim — the hero meets the screen's top edge and
              hosts the overlaid Back button; keep it readable on bright art
              (all widths). */}
          <div aria-hidden className="absolute inset-x-0 top-0 h-[120px] bg-gradient-to-b from-black/35 to-transparent" />
          {/* ≥600px scrims: directional gradient from the content (inline-start)
              side — mirrors in RTL — plus the bottom fade into the page. */}
          <div aria-hidden className="absolute inset-0 hidden bg-gradient-to-r from-canvas/90 via-canvas/40 to-transparent min-[600px]:block rtl:bg-gradient-to-l" />
          <div aria-hidden className="absolute inset-x-0 bottom-0 hidden h-[45%] bg-gradient-to-t from-canvas via-canvas/55 to-transparent min-[600px]:block" />
          {/* <600px card scrim — legibility bed for the embedded compact logo */}
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/90 via-black/45 to-transparent min-[600px]:hidden" />
          {/* Embedded compact logo (<600px only; ≥600px it lives in the column) */}
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-center px-5 pb-5 min-[600px]:hidden">
            {hasLogo ? (
              <img
                src={tmdb.logo ?? meta.logo}
                alt=""
                aria-hidden
                className="max-h-14 w-auto max-w-[78%] object-contain drop-shadow-[0_10px_28px_rgba(0,0,0,0.95)]"
                loading="lazy"
              />
            ) : (
              <div
                aria-hidden
                className="font-display text-center text-3xl font-bold tracking-tight text-white drop-shadow-[0_6px_20px_rgba(0,0,0,0.9)]"
              >
                {meta.name}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ============ HERO CONTENT COLUMN ============
          ONE inline-start-aligned column (mirrors in RTL) holding the title
          logo, metadata row, synopsis and actions — overlapping the hero's
          lower part on ≥600px. 600–839px widens to ~70%; ≥840px caps at
          600px. <600px: same elements, centered under the card (unchanged).
          pointer-events pass through the wrapper so the artwork behind the
          empty side stays hoverable; the column itself re-enables them. */}
      <div className="harbor-page-container relative z-10 min-[600px]:pointer-events-none min-[600px]:-mt-[clamp(96px,14vh,168px)]">
        <div className="flex min-w-0 flex-col items-center text-center min-[600px]:pointer-events-auto min-[600px]:max-w-[70%] min-[600px]:items-start min-[600px]:text-start min-[840px]:max-w-[600px]">
          {/* ≥600px title logo (sr-only h1 above carries the semantics) */}
          {hasLogo ? (
            <img
              src={tmdb.logo ?? meta.logo}
              alt=""
              aria-hidden
              loading="eager"
              decoding="async"
              className="hidden max-h-16 w-auto max-w-full object-contain drop-shadow-[0_10px_28px_rgba(0,0,0,0.95)] min-[600px]:block min-[840px]:max-h-24"
            />
          ) : (
            <div
              aria-hidden
              className="hidden font-display text-3xl font-bold tracking-tight text-white drop-shadow-[0_6px_20px_rgba(0,0,0,0.9)] min-[600px]:block min-[840px]:text-5xl"
            >
              {meta.name}
            </div>
          )}

          {/* ============ 2 · SINGLE-LINE METADATA ROW ============
              One horizontal, non-wrapping line. Scrolls horizontally on the
              narrowest screens — never wraps; never widens the page. */}
          {hasAnyMeta && (
            <div className="mx-auto mt-4 w-full max-w-3xl min-[600px]:mx-0 min-[600px]:mt-2 min-[600px]:max-w-none">
              {/* Outer scroller + inner w-max row: centers when it fits, scrolls
                  from the true start edge when it doesn't (no justify-center
                  scroll-trap). Single line — never wraps. */}
              <div className="no-scrollbar overflow-x-auto">
                <div className="flex w-max min-w-full flex-nowrap items-center justify-center gap-2.5 px-4 py-0.5 min-[600px]:justify-start min-[600px]:px-0">
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
          <div className="mt-2 flex justify-center px-4 min-[600px]:justify-start min-[600px]:px-0">
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

          {/* ================== 3 · SYNOPSIS ==================
              ≥600px: start-aligned, 60ch measure, 3-line clamp — inside the
              column. <600px: centered, no clamp (layout unchanged). */}
          {meta.description && (
            <p className="mx-auto mt-4 max-w-2xl px-4 text-center text-sm leading-[1.8] text-ink-muted min-[600px]:mx-0 min-[600px]:max-w-[60ch] min-[600px]:px-0 min-[600px]:text-start min-[600px]:line-clamp-3 md:text-[15px]">
              {meta.description}
            </p>
          )}

          {/* ========== 4 · ACTION CONTROLS + EXPANDABLE MENU ==========
              The primary CTA and its menu trigger stay together as one split
              group; the row wraps between groups (long labels never widen it). */}
          <div className="mx-auto mt-6 flex min-w-0 flex-wrap items-center justify-center gap-2.5 px-4 min-[600px]:mx-0 min-[600px]:justify-start min-[600px]:px-0 md:gap-3">
            <div className="flex min-w-0 items-center gap-2.5 md:gap-3">
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

        {/* Secondary expandable menu — Radix DropdownMenu. Rendered through a
            portal with collision-aware popper positioning (top of body, out of
            the document flow): opening it can never widen/clip/shift the page.
            Flips above when out of room, shifts to stay 12px inside the
            viewport, max-height = min(70vh, available space) with internal
            scrolling. Visual design unchanged (same panel + item classes).
            a11y: aria-haspopup/expanded/controls, focus into menu + back to
            trigger, arrow-key navigation, Esc/outside-click close. */}
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
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
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="bottom"
            align="center"
            sideOffset={8}
            collisionPadding={12}
            className="max-h-[min(70vh,var(--radix-dropdown-menu-content-available-height))] w-60 overflow-y-auto overscroll-contain rounded-2xl border border-edge-soft bg-elevated/95 p-1.5 shadow-[var(--md-sys-elevation-3)] backdrop-blur-xl"
          >
            <DropdownMenuItem
              onSelect={() => {
                toggleWatchlistFromMenu();
              }}
              className="md-state harbor-tv-focus flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3.5 text-start text-sm font-medium text-ink outline-none transition-colors hover:bg-raised focus:bg-raised focus:text-ink data-[highlighted]:bg-raised data-[highlighted]:text-ink"
            >
              {inList ? (
                <Check className="h-4 w-4 text-accent" aria-hidden />
              ) : (
                <Plus className="h-4 w-4" aria-hidden />
              )}
              {inList ? tr("inWatchlistItem") : tr("addToWatchlist")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={openStreams}
              title={tr("streamsHint")}
              className="md-state harbor-tv-focus flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3.5 text-start text-sm font-medium text-ink outline-none transition-colors hover:bg-raised focus:bg-raised focus:text-ink data-[highlighted]:bg-raised data-[highlighted]:text-ink"
            >
              <Layers className="h-4 w-4" aria-hidden />
              {tr("availableStreams")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={onShare}
              className="md-state harbor-tv-focus flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3.5 text-start text-sm font-medium text-ink outline-none transition-colors hover:bg-raised focus:bg-raised focus:text-ink data-[highlighted]:bg-raised data-[highlighted]:text-ink"
            >
              <Share2 className="h-4 w-4" aria-hidden />
              {tr("share")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
        </div>
      </div>

      {/* Cast & crew — shared container, start-aligned ≥600px (mirrors RTL) */}
      {(meta.cast?.length || meta.director?.length) && (
        <div className="harbor-page-container mt-8">
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-2 px-4 text-center min-[600px]:mx-0 min-[600px]:items-start min-[600px]:px-0 min-[600px]:text-start">
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
        </div>
      )}

      {/* Episodes */}
      {meta.type === "series" && (
        <EpisodesSection
          meta={meta}
          tmdbId={tmdb.tmdbId}
          backdropUrl={tmdb.backdrop ?? meta.background}
          onPlay={onPlay}
        />
      )}

      {/* TMDB recommendations (fail-soft — hidden when TMDB is off) */}
      {tmdb.recommendations.length > 0 && <TmdbRecsRail items={tmdb.recommendations} />}

      {/* More like this — genre-based discovery via the Cinemeta top catalog */}
      <SimilarRail type={meta.type} genres={meta.genres} currentId={meta.id} />

      {/* Movie: default video behavior — Cinemeta movies have behaviorHints.defaultVideoId or just play id */}
      {meta.type === "movie" && !meta.genres?.length && (
        <div className="harbor-page-container mt-8">
          <p className="mx-auto max-w-2xl text-center text-xs text-ink-subtle min-[600px]:mx-0 min-[600px]:text-start">
            {tr("pressPlayHint")}
          </p>
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

// ---------- TMDB recommendations rail (Feature: TMDB enrichment) ----------

function TmdbRecsRail({ items }: { items: Meta[] }) {
  const tr = useT();
  const push = useNav((s) => s.push);
  if (items.length === 0) return null;
  return (
    <section className="harbor-page-container mt-12" aria-label={tr("recommendedByTmdb")}>
      <div className="mb-3 flex items-center gap-2">
        <Layers className="h-5 w-5 text-accent" aria-hidden />
        <h2 className="md-title-medium text-ink">{tr("recommendedTitle")}</h2>
        <span className="md-chip md-label-small !h-6 !px-2 cursor-default!">{tr("viaTmdb")}</span>
      </div>
      {/* Hover headroom: pt-3/-mt-3 keeps the header→card gap while giving the hover lift room inside the scroll clip */}
      <div className="harbor-scroll-x overflow-x-auto flex gap-3 pb-2 pt-3 -mt-3">
        {items.map((m) => (
          <div key={`${m.type}-${m.id}`} className="w-[104px] shrink-0 md:w-[126px]">
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
    <section className="harbor-page-container mt-12" aria-label={tr("moreLikeThis")}>
      <div className="mb-3 flex items-center gap-2">
        <Layers className="h-5 w-5 text-accent" aria-hidden />
        <h2 className="md-title-medium text-ink">{tr("moreLikeThis")}</h2>
        <span className="md-chip md-label-small !h-6 !px-2 cursor-default!">{genre}</span>
      </div>
      {items === null ? (
        <div className="flex gap-3 overflow-hidden" aria-hidden>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="harbor-skeleton aspect-[2/3] w-[112px] shrink-0 rounded-xl md:w-[136px]" />
          ))}
        </div>
      ) : items.length === 0 ? null : (
        /* Hover headroom: same pt-3/-mt-3 contract as TmdbRecsRail above */
        <div className="harbor-scroll-x overflow-x-auto flex gap-3 pb-2 pt-3 -mt-3">
          {items.map((m) => (
            <div key={`${m.id}`} className="w-[104px] shrink-0 md:w-[126px]">
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
