"use client";

// Harbor Web — Home hero (round-21 mobile rebuild: full-bleed portrait
// carousel; round-23 perf pass). Spec source: Nuvio-reference measurements
// (360dp viewport) — every visual value lives in the --hero-* token block in
// globals.css.
// Data: Harbor's existing featured pool (Cinemeta anchor catalogs, passed in
// by HomeView) + fail-soft TMDB enrichment for title logos and the meta-line
// genre. Autoplay pauses on hover/touch/focus/hidden tab/off-screen/reduced-motion.
//
// Round-23 performance contract (measured, see worklog Task 41):
//  - ONE art element per slide via <picture><source media>: phones download
//    only the portrait ladder, md+ only the backdrop ladder (the old double
//    <img> downloaded the hidden layer too).
//  - Responsive tiers: metahub small/medium/large/original (backdrop
//    medium/large; tmdb w-tier when the source is TMDB) picked by rendered
//    width × DPR via srcset+sizes; Save-Data / 2G caps the ladder.
//  - Art window: only the active slide and its two wrap-aware neighbors mount
//    art; the rest render the static gradient placeholder (fewer decoded
//    bitmaps: was 16.3MB for 8 slides, now ~3-5MB).
//  - The content stack NEVER remounts on slide change (focus in the dots
//    survives); the entrance animation replays via the Web Animations API
//    (opacity/transform only, same tokens as the old keyframes).
//  - Indicator dots crossfade two absolutely-positioned layers (dot ↔ pill)
//    with opacity + scaleX — zero layout animation.
//  - Images decode before reveal (img.decode() gate + fade-in) so a
//    transition never shows a half-decoded frame; first slide preloads via a
//    hoisted <link rel=preload imagesrcset> (React 19 hoists <link>).
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { useNav, useSettings } from "@/lib/harbor/store";
import type { Meta } from "@/lib/harbor/types";
import { tmdbDetails, tmdbIdFromImdb, tmdbLogo } from "@/lib/harbor/tmdb";
import {
  goToSlideLabel,
  homeT,
  isArabic,
  metaTypeLabel,
  slideOf,
} from "@/lib/harbor/i18n";

export type HeroSlide = { meta: Meta };

type SlideInfo = { logo?: string; genre?: string };

const FAILED_ART = new Set<string>();
const WARMED_ART = new Set<string>(); // artworks already decoded this session
const AUTOPLAY_MS = 6_000;
/** Cached once per document: the token-driven content-crossfade duration
 *  (avoid a forced style recalc on every slide change during fast bursts). */
let CROSSFADE_MS = 300;
/** Must match the CSS swap point for the portrait/backdrop art layers. */
const MD_MIN = "(min-width: 600px)";

// ---------- Responsive art ladders (round-23) ----------
// The featured pool serves metahub (Cinemeta) or TMDB or addon URLs. Build a
// width ladder for the two known CDNs; anything else stays a single src (the
// old behavior) so addon-provided art keeps working untouched.

type ArtTier = { w: number; url: string };

/** Cap the ladder for data-saver / slow connections (never below medium so
 *  quality stays usable; the browser still picks by rendered×DPR). */
function tierCap(): number {
  if (typeof navigator === "undefined") return Infinity;
  const c = (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (!c) return Infinity;
  if (c.saveData) return 500;
  if (c.effectiveType && /(^|\b)2g(\b|$)/i.test(c.effectiveType)) return 500;
  return Infinity;
}

function metahubLadder(base: string, kind: "poster" | "background" | "logo"): ArtTier[] {
  // https://images.metahub.space/<kind>/<size>/<id>/img — sizes verified:
  // poster small 300w / medium 500w / large 780w / original 2000w;
  // background medium 1280w / large 3840w; logo medium ~780w / large ~1526w.
  const sizes = kind === "poster"
    ? [
        { slug: "small", w: 300 },
        { slug: "medium", w: 500 },
        { slug: "large", w: 780 },
        { slug: "original", w: 2000 },
      ]
    : kind === "background"
      ? [
          { slug: "medium", w: 1280 },
          { slug: "large", w: 3840 },
        ]
      : [
          { slug: "medium", w: 780 },
          { slug: "large", w: 1526 },
        ];
  const cap = tierCap();
  const out: ArtTier[] = [];
  for (const s of sizes) {
    if (s.w > cap) break;
    out.push({ w: s.w, url: base.replace(/\/(small|medium|large|xlarge|original)\//, `/${s.slug}/`) });
  }
  return out.length > 0 ? out : [{ w: 500, url: base.replace(/\/(small|medium|large|xlarge|original)\//, "/medium/") }];
}

function tmdbLadder(base: string, poster: boolean): ArtTier[] {
  // .../t/p/<size>/<path> — poster w185…w780/original; backdrop w780…original.
  const sizes = poster
    ? [
        { slug: "w342", w: 342 },
        { slug: "w500", w: 500 },
        { slug: "w780", w: 780 },
        { slug: "original", w: 2000 },
      ]
    : [
        { slug: "w780", w: 780 },
        { slug: "w1280", w: 1280 },
        { slug: "original", w: 3840 },
      ];
  const cap = tierCap();
  const out: ArtTier[] = [];
  for (const s of sizes) {
    if (s.w > cap) break;
    out.push({ w: s.w, url: base.replace(/\/(w\d+|original)\//, `/${s.slug}/`) });
  }
  return out.length > 0 ? out : [{ w: 500, url: base.replace(/\/(w\d+|original)\//, "/w500/") }];
}

function srcSetOf(tiers: ArtTier[]): string {
  return tiers.map((t) => `${t.url} ${t.w}w`).join(", ");
}

/** Resolved art for one slide: portrait (poster) + landscape (backdrop)
 *  ladders, plus a stable failure key (per title, not per size). */
function slideArt(meta: Meta): {
  portrait: { src: string; srcSet: string } | null;
  landscape: { src: string; srcSet: string } | null;
  failKey: string;
} | null {
  const poster = meta.poster;
  const bg = meta.background;
  if (!poster && !bg) return null;
  // Failure key is per TITLE (all size variants of one artwork 404 together).
  const failKey = `${meta.type}:${meta.id}`;
  const ladderFor = (url: string, kind: "poster" | "background" | "logo") => {
    if (!url) return null;
    if (/images\.metahub\.space\//.test(url)) return metahubLadder(url, kind);
    if (/image\.tmdb\.org\//.test(url)) return tmdbLadder(url, kind === "poster");
    return null; // unknown CDN → single-src
  };
  const pTiers = ladderFor(poster ?? "", "poster");
  const bTiers = ladderFor(bg ?? "", "background");
  return {
    portrait: poster
      ? { src: (pTiers ? pTiers[Math.min(1, pTiers.length - 1)] : { url: poster }).url, srcSet: pTiers ? srcSetOf(pTiers) : "" }
      : null,
    landscape: bg
      ? { src: (bTiers ? bTiers[0] : { url: bg }).url, srcSet: bTiers ? srcSetOf(bTiers) : "" }
      : null,
    failKey,
  };
}

function preferrsReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Physical scrollLeft that aligns the given slide to the inline-start edge.
 *  Works in both directions: LTR slide.offsetLeft is i*width; RTL scrollLeft
 *  is negative (modern spec) and slide 0 rests at the right edge. */
function slideScrollLeft(track: HTMLElement, slide: HTMLElement): number {
  const dir = getComputedStyle(track).direction;
  if (dir === "rtl") {
    const slideStart = slide.offsetLeft + slide.offsetWidth; // physical right edge
    return -(track.clientWidth - slideStart);
  }
  return slide.offsetLeft;
}

/** One art element per slide — <picture> swaps portrait (phones) ↔ backdrop
 *  (md+) at the CSS breakpoint so ONLY the matching layer downloads. The img
 *  fades in after decode() resolves; failure falls back to the theme
 *  gradient (never a blank or broken icon). */
const HeroArt = memo(function HeroArt({
  art,
  alt,
  eager,
  active,
}: {
  art: NonNullable<ReturnType<typeof slideArt>>;
  alt: string;
  eager: boolean;
  active: boolean;
}) {
  const [failed, setFailed] = useState(FAILED_ART.has(art.failKey));
  const [ready, setReady] = useState(false);
  const [seenKey, setSeenKey] = useState(art.failKey);
  const imgRef = useRef<HTMLImageElement>(null);
  // Render-phase reset when the artwork changes (React-recommended pattern;
  // keeps the codebase's no-sync-setState-in-effect rule intact).
  if (seenKey !== art.failKey) {
    setSeenKey(art.failKey);
    setReady(false);
  }

  // Decode gate: reveal only a fully-decoded frame (no half-painted flash).
  // Cached images are detected on the next tick (codebase lint pattern);
  // in-flight ones resolve via decode()/onLoad.
  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    if (img.complete && img.naturalWidth > 0) {
      const h = setTimeout(() => setReady(true), 0);
      return () => clearTimeout(h);
    }
    img.decode?.().catch(() => {
      /* decode rejects on empty/undecodable sources; onLoad/onError take over */
    });
    return undefined;
  }, [art.portrait?.src, art.landscape?.src]);

  if (failed || (!art.portrait && !art.landscape)) {
    return (
      <div
        aria-label={alt || undefined}
        role="img"
        className="home-hero-art home-hero-art-fallback"
      />
    );
  }

  return (
    <picture
      className={`home-hero-art home-hero-art-picture${ready ? " home-hero-art-ready" : ""}`}
    >
      {art.landscape && (
        <source
          media={MD_MIN}
          srcSet={art.landscape.srcSet || undefined}
          sizes="100vw"
        />
      )}
      <img
        ref={imgRef}
        src={art.portrait?.src ?? art.landscape?.src}
        srcSet={art.portrait?.srcSet || undefined}
        sizes="(max-width: 599px) 100vw"
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        decoding={eager ? "sync" : "async"}
        fetchPriority={eager ? (active ? "high" : "low") : "auto"}
        draggable={false}
        onLoad={() => setReady(true)}
        onError={() => {
          FAILED_ART.add(art.failKey);
          setFailed(true);
        }}
      />
    </picture>
  );
});

/** Static gradient placeholder for out-of-window slides (same surface as the
 *  failure fallback — the carousel never shows a blank frame). */
function ArtPlaceholder({ label }: { label?: string }) {
  return (
    <div
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      className="home-hero-art home-hero-art-fallback"
      aria-hidden={label ? undefined : true}
    />
  );
}

/** Sequential TMDB enrichment: fills title logos + a localized first genre
 *  for slides that lack them. One slide at a time, ~150ms apart; every step
 *  fails soft (cached by tmdbGet, so revisits are free). */
function useHeroEnrichment(slides: HeroSlide[]) {
  const [info, setInfo] = useState<Record<string, SlideInfo>>({});
  const infoRef = useRef(info);
  useEffect(() => {
    infoRef.current = info;
  }, [info]);
  const sig = slides.map((s) => s.meta.id).join("|");
  useEffect(() => {
    if (slides.length === 0) return;
    let alive = true;
    (async () => {
      for (const { meta } of slides) {
        if (!alive) return;
        if (!/^tt\d+$/.test(meta.id)) continue;
        if (meta.logo && meta.genres?.length) continue;
        if (infoRef.current[meta.id]) continue;
        try {
          const tmdbId = await tmdbIdFromImdb(meta.id, meta.type === "series" ? "series" : "movie");
          if (!alive) return;
          if (!tmdbId) continue;
          const details = await tmdbDetails(meta.type === "series" ? "series" : "movie", tmdbId);
          if (!alive || !details) continue;
          const logo = tmdbLogo(details);
          const genre = details.genres?.[0]?.name;
          if (logo || genre) {
            setInfo((prev) => ({ ...prev, [meta.id]: { logo, genre } }));
          }
        } catch {
          /* fail soft */
        }
        await new Promise((r) => setTimeout(r, 150));
      }
    })();
    return () => {
      alive = false;
    };
  }, [sig, slides]);
  return info;
}

export function HomeHero({ slides, loading }: { slides: HeroSlide[]; loading: boolean }) {
  const settings = useSettings((s) => s.settings);
  const lang = settings.uiLanguage || "en";
  const rtl = isArabic(lang);
  const push = useNav((s) => s.push);

  const [idx, setIdx] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [touching, setTouching] = useState(false);
  const [focusPaused, setFocusPaused] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const [reduced, setReduced] = useState(false);
  // Burst-tolerant art window (round-23): steady state is the strict
  // [idx-1, idx, idx+1] window; during rapid navigation (fast dot jumps,
  // keyboard repeat) the set ACCUMULATES visited slides and prunes back
  // 1.6s after the burst ends — mount/unmount thrash during a burst is zero,
  // the resting DOM stays virtualized (3 arts). Standard overscan practice.
  const [burstSet, setBurstSet] = useState<Set<number>>(() => new Set());

  const trackRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const touchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const info = useHeroEnrichment(slides);

  // Reduced-motion: no autoplay, no smooth scrolling, no crossfade (CSS too)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Off-screen gate (also prevents programmatic scrolling from yanking the page)
  useEffect(() => {
    const el = trackRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), {
      threshold: 0.35,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Scroll → active index (exact 1-slide-per-width snapping). rAF-coalesced;
  // setIdx with an unchanged number is bailed out by React, so swiping costs
  // one cheap re-render per slide boundary only.
  const onScroll = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      const el = trackRef.current;
      if (!el || el.clientWidth === 0) return;
      const i = Math.round(Math.abs(el.scrollLeft) / el.clientWidth);
      setIdx(Math.max(0, Math.min(slides.length - 1, i)));
    });
  }, [slides.length]);

  const goTo = useCallback(
    (i: number, smooth = true) => {
      const el = trackRef.current;
      if (!el) return;
      const slide = el.querySelector<HTMLElement>(`[data-slide="${i}"]`);
      if (!slide) return;
      el.scrollTo({
        left: slideScrollLeft(el, slide),
        behavior: smooth && !reduced ? "smooth" : "auto",
      });
      setIdx(i);
    },
    [reduced],
  );

  const total = slides.length;

  // Wrap-aware art window + per-slide art resolution. Hooks stay ABOVE the
  // early returns (rules-of-hooks); the early returns below only choose the
  // skeleton/empty presentation.
  // Resolved ONCE per slides-array identity so HeroArt's memo holds.
  const arts = useMemo(() => slides.map((s) => slideArt(s.meta)), [slides]);
  const artWindow = useMemo(() => {
    const set = new Set<number>();
    if (total > 0) {
      set.add(idx);
      set.add((idx + 1) % total);
      set.add((idx - 1 + total) % total);
    }
    return set;
  }, [idx, total]);

  // Burst accumulation + delayed prune (see burstSet above). Both state
  // updates run inside timers (codebase no-sync-setState-in-effect rule).
  useEffect(() => {
    if (total <= 0) return;
    const grow = setTimeout(() => {
      setBurstSet((prev) => {
        const next = new Set(prev);
        next.add(idx);
        next.add((idx + 1) % total);
        next.add((idx - 1 + total) % total);
        return next.size === prev.size ? prev : next;
      });
    }, 0);
    const prune = setTimeout(() => {
      setBurstSet(new Set([idx, (idx + 1) % total, (idx - 1 + total) % total]));
    }, 1600);
    return () => {
      clearTimeout(grow);
      clearTimeout(prune);
    };
  }, [idx, total]);

  const canAutoplay =
    total > 1 && !reduced && !userPaused && !hovering && !touching && !focusPaused && onScreen;

  // Autoplay (pauses when the tab is hidden via the document listener below)
  useEffect(() => {
    if (!canAutoplay || document.hidden) return;
    const t = setInterval(() => {
      if (document.hidden) return;
      const el = trackRef.current;
      const next = el ? (Math.round(Math.abs(el.scrollLeft) / el.clientWidth) + 1) % total : 0;
      goTo(next);
    }, AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [canAutoplay, total, goTo]);

  // Keyboard: arrows respect RTL direction; Home/End jump
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (total <= 1) return;
    const nextKey = rtl ? "ArrowLeft" : "ArrowRight";
    const prevKey = rtl ? "ArrowRight" : "ArrowLeft";
    if (e.key === nextKey) {
      e.preventDefault();
      goTo((idx + 1) % total);
    } else if (e.key === prevKey) {
      e.preventDefault();
      goTo((idx - 1 + total) % total);
    } else if (e.key === "Home") {
      e.preventDefault();
      goTo(0);
    } else if (e.key === "End") {
      e.preventDefault();
      goTo(total - 1);
    }
  };

  // Touch pause WITHOUT the per-event timer storm (round-23): arm once on
  // pointerdown, release 8s after the gesture ends (covers a slow swipe).
  const onTouchStart = useCallback(() => {
    setTouching(true);
    if (touchTimer.current) clearTimeout(touchTimer.current);
  }, []);
  const onTouchEnd = useCallback(() => {
    if (touchTimer.current) clearTimeout(touchTimer.current);
    touchTimer.current = setTimeout(() => setTouching(false), 8_000);
  }, []);

  // Unmount cleanup for the touch-release timer + scroll rAF (round-23 leak fix)
  useEffect(() => {
    return () => {
      if (touchTimer.current) clearTimeout(touchTimer.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Content entrance replay WITHOUT remounting the stack (round-23): same
  // keyframes/easing as the old .home-hero-content-in CSS animation, driven
  // by the Web Animations API so the dots keep their focus and the logo img
  // node (and its decoded bitmap) is reused across slide changes. A new
  // animation CANCELS the previous one (fast dot bursts must not stack 50
  // running animations on the same element).
  const contentAnimRef = useRef<Animation | null>(null);
  const activeMeta = slides[Math.min(idx, Math.max(0, total - 1))]?.meta;
  const activeId = activeMeta?.id ?? "";
  useEffect(() => {
    if (!activeId || reduced) return;
    const el = contentRef.current;
    if (!el?.animate) return;
    if (CROSSFADE_MS === 300) {
      // Read once per session; stays token-driven (--hero-crossfade-ms).
      CROSSFADE_MS = parseFloat(getComputedStyle(el).getPropertyValue("--hero-crossfade-ms")) || 300;
    }
    contentAnimRef.current?.cancel();
    contentAnimRef.current = el.animate(
      [{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "translateY(0)" }],
      { duration: CROSSFADE_MS, easing: "cubic-bezier(0.2, 0, 0, 1)" },
    );
  }, [activeId, reduced]);
  useEffect(() => {
    return () => {
      contentAnimRef.current?.cancel();
    };
  }, []);

  // Idle prefetch (round-23): walk the WHOLE carousel during idle time, one
  // slide per idle slice, warming bytes + decoded bitmaps for every artwork
  // at the tier this device would pick. Autoplay visits all slides anyway, so
  // this costs nothing extra and no transition ever decodes on the critical
  // path (in-window slides get img.decode(); out-of-window ones a detached
  // Image() so the HTTP + image caches are warm when the window reaches them).
  // WARMED_ART de-duplicates across walk restarts (no repeated decodes when
  // idx changes; each artwork is decoded at most once per session).
  useEffect(() => {
    if (total <= 1) return;
    let cancelled = false;
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
    };
    const needPx = () => (typeof innerWidth === "number" ? innerWidth : 412) * (devicePixelRatio || 1);
    const warmAt = (i: number) => {
      const art = arts[i];
      if (!art || WARMED_ART.has(art.failKey)) return;
      const mark = () => WARMED_ART.add(art.failKey);
      // In-window slide: warm the mounted element directly.
      const img = trackRef.current?.querySelector<HTMLImageElement>(`[data-slide="${i}"] img`);
      if (img) {
        img.decode?.().then(mark).catch(() => {
          /* warm-up only */
        });
        return;
      }
      // Out-of-window: detached Image() with the SAME srcset the mounted img
      // will use, so the browser cache entry matches exactly.
      const pick = (ladder: { src: string; srcSet: string } | null) => {
        if (!ladder?.srcSet) return ladder?.src;
        const px = needPx();
        const tiers = ladder.srcSet.split(",").map((t) => {
          const [u, d] = t.trim().split(/\s+/);
          return { u, w: parseInt(d, 10) || 0 };
        });
        return (tiers.find((t) => t.w >= px) ?? tiers[tiers.length - 1]).u;
      };
      const probe = new Image();
      probe.onload = mark;
      probe.src = pick(art.portrait) ?? pick(art.landscape) ?? "";
      if (typeof probe.decode === "function") {
        probe.decode().then(mark).catch(() => {
          /* warm-up only */
        });
      }
    };
    let k = idx + 1;
    const step = () => {
      if (cancelled) return;
      warmAt(((k % total) + total) % total);
      k++;
      if (k < idx + total) {
        if (w.requestIdleCallback) w.requestIdleCallback(step, { timeout: 2500 });
        else setTimeout(step, 400);
      }
    };
    if (w.requestIdleCallback) w.requestIdleCallback(step, { timeout: 2000 });
    else setTimeout(step, 300);
    return () => {
      cancelled = true;
    };
  }, [idx, total, arts]);

  if (loading) return <HeroSkeleton lang={lang} />;
  if (total === 0) return null;

  const slide = slides[Math.min(idx, total - 1)];
  const meta = slide.meta;
  const enriched = info[meta.id] ?? {};
  const logo = meta.logo ?? enriched.logo;
  const genre = meta.genres?.[0] ?? enriched.genre;
  const year = meta.releaseInfo?.split("–")[0];
  const typeLabel = metaTypeLabel(meta.type, meta.genres ?? (genre ? [genre] : undefined), lang);

  // Preload ladder for the FIRST slide (React 19 hoists <link> to <head>);
  // media-split so each platform preloads exactly the layer it will show.
  // (arts/artWindow are computed above, before the early returns.)
  const firstArt = arts.length > 0 ? arts[0] : null;

  const titleLen = meta.name.length;
  // Length-based fallback sizing (tokens live in globals.css, scale-aware)
  const titleClass =
    titleLen <= 8 ? "" : titleLen <= 16 ? " home-hero-title-m" : " home-hero-title-s";

  return (
    <section
      className="home-hero group/hero"
      role="region"
      aria-roledescription="carousel"
      aria-label={homeT("featured", lang)}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocusCapture={() => setFocusPaused(true)}
      onBlurCapture={() => setFocusPaused(false)}
      onKeyDown={onKeyDown}
    >
      {firstArt && (
        <>
          {firstArt.portrait && (
            <link
              rel="preload"
              as="image"
              media="(max-width: 599px)"
              href={firstArt.portrait.src}
              imageSrcSet={firstArt.portrait.srcSet || undefined}
              imageSizes="100vw"
              fetchPriority="high"
            />
          )}
          {firstArt.landscape && (
            <link
              rel="preload"
              as="image"
              media={MD_MIN}
              href={firstArt.landscape.src}
              imageSrcSet={firstArt.landscape.srcSet || undefined}
              imageSizes="100vw"
              fetchPriority="high"
            />
          )}
        </>
      )}

      <div
        ref={trackRef}
        className="home-hero-track"
        onScroll={onScroll}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        tabIndex={0}
        aria-label={homeT("featured", lang)}
      >
        {slides.map((s, i) => {
          const active = i === idx;
          const adjacent = artWindow.has(i) || burstSet.has(i);
          return (
            <div
              key={s.meta.id}
              data-slide={i}
              className="home-hero-slide"
              role="group"
              aria-roledescription="slide"
              aria-label={slideOf(i + 1, total, lang)}
              aria-hidden={!active}
            >
              {adjacent && arts[i] ? (
                <HeroArt
                  art={arts[i]!}
                  alt={active ? s.meta.name : ""}
                  eager={adjacent}
                  active={active}
                />
              ) : (
                <ArtPlaceholder label={active ? s.meta.name : undefined} />
              )}
            </div>
          );
        })}
      </div>

      <div className="home-hero-scrim-top" aria-hidden />
      <div className="home-hero-scrim-fade" aria-hidden />

      {/* Shared content stack — NEVER remounts (round-23): the entrance
          animation replays via WAAI; dots/button keep DOM identity + focus. */}
      <div ref={contentRef} className="home-hero-content">
        <div className="home-hero-logo-row">
          {logo ? (
            <img
              src={logo}
              alt={meta.name}
              className="home-hero-logo"
              loading="eager"
              decoding="async"
            />
          ) : (
            <h1 className={`home-hero-title${titleClass}`}>{meta.name}</h1>
          )}
        </div>

        <div className="home-hero-meta" style={{ marginBottom: "var(--hero-gap-meta)" }}>
          {year && <span className="shrink-0">{year}</span>}
          {year && genre && <span className="hero-meta-dot" aria-hidden />}
          {genre && <span className="overflow-hidden text-ellipsis">{genre}</span>}
          <span className="hero-meta-dot" aria-hidden />
          <span className="shrink-0">{typeLabel}</span>
        </div>

        <button
          type="button"
          onClick={() => push({ kind: "detail", type: meta.type, id: meta.id })}
          className="home-hero-btn md-state harbor-tv-focus"
          style={{ marginBottom: "var(--hero-gap-btn)" }}
        >
          {homeT("viewDetails", lang)}
        </button>

        {total > 1 && (
          <div className="flex items-center justify-center" style={{ gap: "var(--hero-ind-gap)" }}>
            {slides.map((s, i) => (
              <button
                key={s.meta.id}
                type="button"
                aria-label={goToSlideLabel(i + 1, lang)}
                aria-current={i === idx}
                onClick={() => goTo(i)}
                className="home-hero-dot-btn harbor-tv-focus"
              >
                <span className="home-hero-dot-dot" aria-hidden />
                <span className="home-hero-dot-pill" aria-hidden />
              </button>
            ))}
            <button
              type="button"
              aria-label={userPaused ? homeT("resumeAutoplay", lang) : homeT("pauseAutoplay", lang)}
              onClick={() => setUserPaused((p) => !p)}
              className="md-icon-btn md-state !h-11 !w-11 !text-white/70 hover:!text-white harbor-tv-focus"
            >
              {userPaused ? <Play className="h-4 w-4 fill-current" /> : <Pause className="h-4 w-4" />}
            </button>
          </div>
        )}
        {/* Live region: announces slide changes only while autoplay is off */}
        <p aria-live={userPaused ? "polite" : "off"} className="sr-only">
          {slideOf(idx + 1, total, lang)}
        </p>
      </div>
    </section>
  );
}

// ---------- Skeleton (reserved height, no layout shift; token-driven so it
// mirrors the scaled real layout at every breakpoint) ----------
function HeroSkeleton({ lang }: { lang: string }) {
  return (
    <div className="home-hero" role="status" aria-label={homeT("loadingFeatured", lang)}>
      <div className="home-hero-content">
        <div className="home-hero-logo-row">
          <div
            className="harbor-skeleton rounded-xl"
            style={{ width: "calc(var(--hero-logo-max-w) * 0.72)", height: "calc(var(--hero-logo-max-h) * 0.78)" }}
          />
        </div>
        <div className="home-hero-meta" style={{ marginBottom: "var(--hero-gap-meta)" }}>
          <div className="harbor-skeleton rounded-full" style={{ height: "var(--hero-meta-size)", width: 46 }} />
          <div className="harbor-skeleton rounded-full" style={{ height: "var(--hero-meta-size)", width: 70 }} />
          <div className="harbor-skeleton rounded-full" style={{ height: "var(--hero-meta-size)", width: 52 }} />
        </div>
        <div
          className="harbor-skeleton rounded-full"
          style={{ width: "var(--hero-btn-min-w)", height: "var(--hero-btn-height)", marginBottom: "var(--hero-gap-btn)" }}
        />
        <div className="flex items-center justify-center" style={{ gap: "var(--hero-ind-gap)" }}>
          <div className="harbor-skeleton rounded-full" style={{ width: "var(--hero-ind-dot)", height: "var(--hero-ind-dot)" }} />
          <div className="harbor-skeleton rounded-full" style={{ width: "var(--hero-ind-active-w)", height: "var(--hero-ind-dot)" }} />
          <div className="harbor-skeleton rounded-full" style={{ width: "var(--hero-ind-dot)", height: "var(--hero-ind-dot)" }} />
          <div className="harbor-skeleton rounded-full" style={{ width: "var(--hero-ind-dot)", height: "var(--hero-ind-dot)" }} />
        </div>
      </div>
    </div>
  );
}
