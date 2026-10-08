"use client";

// Harbor Web — Home hero (round-21 mobile rebuild: full-bleed portrait
// carousel). Spec source: Nuvio-reference measurements (360dp viewport) —
// every visual value lives in the --hero-* token block in globals.css.
// Data: Harbor's existing featured pool (Cinemeta anchor catalogs, passed in
// by HomeView) + fail-soft TMDB enrichment for title logos and the meta-line
// genre. Autoplay pauses on hover/touch/hidden tab/off-screen/reduced-motion.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
const AUTOPLAY_MS = 6_000;

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

/** One raw artwork layer (portrait on phones / landscape on md+). Kept local
 *  because the hero needs eager+priority loading and object-position control
 *  that PosterImage (lazy-only) does not expose. */
function HeroArt({
  src,
  alt,
  eager,
  portrait,
}: {
  src?: string;
  alt: string;
  eager: boolean;
  portrait: boolean;
}) {
  const [state, setState] = useState({ src, failed: !src || FAILED_ART.has(src ?? "") });
  // Render-phase reset when the source changes (React-recommended pattern)
  if (state.src !== src) {
    setState({ src, failed: !src || FAILED_ART.has(src ?? "") });
  }
  if (!src || state.failed) {
    return (
      <div
        aria-label={alt || undefined}
        role="img"
        className="absolute inset-0 bg-[radial-gradient(120%_90%_at_75%_0%,rgba(255,255,255,0.07),transparent_55%),linear-gradient(180deg,var(--color-raised-var),var(--hero-fade))]"
      />
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className={`home-hero-art ${portrait ? "home-hero-art-portrait" : "home-hero-art-landscape"}`}
      loading={eager ? "eager" : "lazy"}
      decoding={eager ? "sync" : "async"}
      fetchPriority={eager ? "high" : "low"}
      draggable={false}
      onError={() => {
        FAILED_ART.add(src);
        setState((s) => ({ ...s, failed: true }));
      }}
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
  const [onScreen, setOnScreen] = useState(true);
  const [reduced, setReduced] = useState(false);

  const trackRef = useRef<HTMLDivElement>(null);
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

  // Scroll → active index (exact 1-slide-per-width snapping)
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
  const canAutoplay = total > 1 && !reduced && !userPaused && !hovering && !touching && onScreen;

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

  // Touch pause: pointerdown holds autoplay for 8s (covers a slow swipe)
  const onTouchStart = () => {
    setTouching(true);
    if (touchTimer.current) clearTimeout(touchTimer.current);
    touchTimer.current = setTimeout(() => setTouching(false), 8_000);
  };

  if (loading) return <HeroSkeleton lang={lang} />;
  if (total === 0) return null;

  const slide = slides[Math.min(idx, total - 1)];
  const meta = slide.meta;
  const enriched = info[meta.id] ?? {};
  const logo = meta.logo ?? enriched.logo;
  const genre = meta.genres?.[0] ?? enriched.genre;
  const year = meta.releaseInfo?.split("–")[0];
  const typeLabel = metaTypeLabel(meta.type, meta.genres ?? (genre ? [genre] : undefined), lang);

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
      onKeyDown={onKeyDown}
    >
      <div
        ref={trackRef}
        className="home-hero-track"
        onScroll={onScroll}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchStart}
        tabIndex={0}
        aria-label={homeT("featured", lang)}
      >
        {slides.map((s, i) => (
          <div
            key={s.meta.id}
            data-slide={i}
            className="home-hero-slide"
            role="group"
            aria-roledescription="slide"
            aria-label={slideOf(i + 1, total, lang)}
            aria-hidden={i !== idx}
          >
            <HeroArt
              src={s.meta.poster}
              alt={i === idx ? s.meta.name : ""}
              eager={Math.abs(i - idx) <= 1}
              portrait
            />
            <HeroArt
              src={s.meta.background}
              alt=""
              eager={Math.abs(i - idx) <= 1}
              portrait={false}
            />
          </div>
        ))}
      </div>

      <div className="home-hero-scrim-top" aria-hidden />
      <div className="home-hero-scrim-fade" aria-hidden />

      {/* Shared content stack — crossfades on every active-item change */}
      <div key={meta.id} className="home-hero-content home-hero-content-in">
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
                <span />
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
