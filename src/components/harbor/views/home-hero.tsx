"use client";

// Harbor Web — Home hero (round-24 rebuild: infinite modular carousel).
// Visual/motion source: measured spec (360dp reference) — every value lives in
// the --hero-* token block in globals.css; the JS constants below mirror the
// motion tokens and are re-read from them once per session.
//
// Architecture (round-24):
//  - MODULAR SLOTS: only previous/current/next mount, positioned by index
//    modulo count (translate3d(slot * 100% * dir)). The track offset is a
//    transform; wrapping = one normal step, never a rewind.
//  - FINGER-FOLLOWING DRAG: pointer events drive translate3d 1:1 (rAF-coalesced,
//    transform/opacity only). Release snaps with velocity + distance thresholds
//    via the Web Animations API at --hero-slide-ms / cubic-bezier(.2,0,0,1).
//    Every transition is interruptible: a new pointerdown continues from the
//    current computed position (no jump).
//  - JUMP TRANSITIONS: far targets (dot taps) crossfade in place — outgoing
//    slides ~--hero-jump-shift toward the travel direction, incoming from the
//    opposite side — shortest circular direction, intermediates never mount.
//  - LAYERED MOTION: art moves 1:1; the content stack drifts at most
//    --hero-content-drift and fades with drag progress, then crossfades to the
//    next slide's data (it NEVER remounts; dots keep focus).
//  - INDICATOR: one 28×7 bar per dot, scaleX .25 ↔ 1 (7dp dot ↔ 28×7dp pill)
//    with layered opacity .4 ↔ 1 — both synced to drag progress, compositor-only.
//  - IMAGES: everything routes through /api/img (SSRF-safe sharp proxy):
//    DPR-sized width ladders, AVIF>WebP>JPEG negotiation, 24px blurred LQIP
//    thumbs, decode() gates, hoisted preload for slide 0, idle warm-up walk.
//  - TEXTLESS ART: TMDB iso_639_1-null posters (best-voted) preferred; then a
//    textless backdrop attention-cropped to portrait; then the titled catalog
//    poster (bottom gradient hides its baked title). Logos: user language →
//    English → any, rendered through the proxy at DPR-correct width.
//
// Autoplay pauses on hover/touch/drag/focus/hidden tab/off-screen/reduced-motion
// and never interrupts a drag. Cleanup covers every timer/observer/animation.

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNav, useSettings } from "@/lib/harbor/store";
import type { Meta } from "@/lib/harbor/types";
import { tmdbDetails, tmdbHeroArt, tmdbIdFromImdb, tmdbLogoPath, tmdbOriginal } from "@/lib/harbor/tmdb";
import { goToSlideLabel, homeT, isArabic, metaTypeLabel, slideOf } from "@/lib/harbor/i18n";
import { PosterImage } from "../common/poster";

export type HeroSlide = { meta: Meta };

// ---------- motion constants (mirror the --hero-* tokens in globals.css;
// actual durations are re-read from the tokens once per session) ----------
const EASE = "cubic-bezier(0.2, 0, 0, 1)";
const AUTOPLAY_MS = 6_000;
const ADVANCE_FRACTION = 0.2; // drag past 20% of the width advances
const VELOCITY_PX_MS = 0.4; // …or release velocity above 0.4 px/ms
const SNAP_MS = 380; // --hero-slide-ms
const JUMP_MS = 350; // --hero-jump-ms
const REDUCED_MS = 200; // --hero-reduced-ms
const JUMP_SHIFT = 22; // --hero-jump-shift (px)
const CONTENT_DRIFT = 12; // --hero-content-drift (px)
const IND_DOT = 8; // --hero-ind-dot at --ind-scale 1 (fallback; resolved px measured per gesture)
const IND_ACTIVE_W = 32; // --hero-ind-active-w fallback (reference: 4× the dot)
/** Must match the CSS swap point for the portrait/backdrop art layers. */
const MD_MIN = "(min-width: 600px)";
/** Hero aspect used for backdrop→portrait crops (height = width × ratio). */
const PORTRAIT_H_RATIO = 496 / 360;

let tokensRead = false;
function readMotionTokens(): void {
  if (tokensRead || typeof window === "undefined") return;
  tokensRead = true;
  const cs = getComputedStyle(document.documentElement);
  const ms = (name: string, dflt: number) => {
    const v = parseFloat(cs.getPropertyValue(name));
    return Number.isFinite(v) && v > 0 ? v : dflt;
  };
  tokenVals.snapMs = ms("--hero-slide-ms", SNAP_MS);
  tokenVals.jumpMs = ms("--hero-jump-ms", JUMP_MS);
  tokenVals.reducedMs = ms("--hero-reduced-ms", REDUCED_MS);
  tokenVals.jumpShift = ms("--hero-jump-shift", JUMP_SHIFT);
  tokenVals.contentDrift = ms("--hero-content-drift", CONTENT_DRIFT);
}
const tokenVals: {
  snapMs: number;
  jumpMs: number;
  reducedMs: number;
  jumpShift: number;
  contentDrift: number;
} = {
  snapMs: SNAP_MS,
  jumpMs: JUMP_MS,
  reducedMs: REDUCED_MS,
  jumpShift: JUMP_SHIFT,
  contentDrift: CONTENT_DRIFT,
};

// ---------- session caches ----------
const FAILED_ART = new Set<string>(); // artworks that 404'd (per title)
const WARMED_ART = new Set<string>(); // artworks already decoded this session
/** Enrichment survives hero remounts (round-trips between Home visits). */
const ENRICH_CACHE = new Map<string, SlideInfo>();
/** B6: measured extra-scrim alpha per artwork (0…0.75) — sampled once per
 *  image from a canvas (art is same-origin via /api/img), cached per failKey
 *  so slide revisits apply it instantly. */
const SCRIM_CACHE = new Map<string, number>();

type SlideInfo = { logo?: string; genre?: string; posterPath?: string; backdropPath?: string; overview?: string };

// ---------- image proxy helpers ----------
type ProxyOpts = { alpha?: boolean; lqip?: boolean; q?: number; h?: number; pos?: string };

/** Route an upstream image through the SSRF-safe transform proxy. */
function imgProxy(upstream: string, w: number, opts?: ProxyOpts): string {
  const p = new URLSearchParams({ u: upstream, w: String(Math.round(w)) });
  if (opts?.h) p.set("h", String(Math.round(opts.h)));
  if (opts?.pos) p.set("pos", opts.pos);
  if (opts?.alpha) p.set("alpha", "1");
  if (opts?.lqip) p.set("lqip", "1");
  if (opts?.q) p.set("q", String(opts.q));
  return `/api/img?${p.toString()}`;
}

/** Cap the ladder for data-saver / slow connections (the browser still picks
 *  by rendered×DPR among what remains). */
function tierCap(): number {
  if (typeof navigator === "undefined") return Infinity;
  const c = (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (!c) return Infinity;
  if (c.saveData) return 500;
  if (c.effectiveType && /(^|\b)2g(\b|$)/i.test(c.effectiveType)) return 500;
  return Infinity;
}

/** One srcset tier: served width w, upstream URL, optional crop options. */
type ArtTier = { w: number; up: string; h?: number; pos?: string };

// Upstream width ladders per CDN (descriptor = the width the proxy serves).
// Metahub slugs verified: poster small 300 / medium 500 / large 780 / original
// 2000; background medium 1280 / large 3840. TMDB: poster w342…original;
// backdrop w780…original.
function metahubTiers(url: string, kind: "poster" | "background"): ArtTier[] {
  const at = (slug: string) => url.replace(/\/(small|medium|large|xlarge|original)\//, `/${slug}/`);
  return kind === "poster"
    ? [
        { w: 300, up: at("small") },
        { w: 500, up: at("medium") },
        { w: 780, up: at("large") },
        { w: 1200, up: at("original") },
        { w: 1600, up: at("original") },
      ]
    : [
        { w: 1280, up: at("medium") },
        { w: 1920, up: at("large") },
        { w: 2560, up: at("large") },
      ];
}

function tmdbPosterTiers(path: string): ArtTier[] {
  const at = (slug: string) => `https://image.tmdb.org/t/p/${slug}${path}`;
  return [
    { w: 342, up: at("w342") },
    { w: 500, up: at("w500") },
    { w: 780, up: at("w780") },
    { w: 1200, up: at("original") },
    { w: 1600, up: at("original") },
  ];
}

function tmdbBackdropTiers(path: string): ArtTier[] {
  const at = (slug: string) => `https://image.tmdb.org/t/p/${slug}${path}`;
  return [
    { w: 780, up: at("w780") },
    { w: 1280, up: at("w1280") },
    { w: 1920, up: at("original") },
    { w: 2560, up: at("original") },
  ];
}

/** A landscape backdrop cropped server-side to the hero's portrait aspect —
 *  attention positioning finds the subject (focal point), never the edges. */
function tmdbBackdropPortraitTiers(path: string): ArtTier[] {
  const at = (slug: string) => `https://image.tmdb.org/t/p/${slug}${path}`;
  return [
    { w: 500, h: Math.round(500 * PORTRAIT_H_RATIO), pos: "attention", up: at("w780") },
    { w: 800, h: Math.round(800 * PORTRAIT_H_RATIO), pos: "attention", up: at("w780") },
    { w: 1080, h: Math.round(1080 * PORTRAIT_H_RATIO), pos: "attention", up: at("original") },
    { w: 1440, h: Math.round(1440 * PORTRAIT_H_RATIO), pos: "attention", up: at("original") },
  ];
}

/** Unknown CDN (addon art): one nominal tier through the proxy (which still
 *  transcodes + resizes when the source is larger; never upscales). */
function genericTiers(url: string): ArtTier[] {
  return [{ w: 1280, up: url }];
}

function tiersFor(url: string, kind: "poster" | "background"): ArtTier[] {
  if (/images\.metahub\.space\//.test(url)) return metahubTiers(url, kind);
  if (/image\.tmdb\.org\/t\/p\//.test(url)) {
    return kind === "poster"
      ? tmdbPosterTiers(url.replace(/^.*\/t\/p\/[^/]+/, ""))
      : tmdbBackdropTiers(url.replace(/^.*\/t\/p\/[^/]+/, ""));
  }
  return genericTiers(url);
}

type ArtLayer = { src: string; srcSet: string };
type HeroArtSpec = {
  portrait: ArtLayer | null; // phones (max-599px)
  landscape: ArtLayer | null; // md+
  lqipPortrait: string | null;
  lqipLandscape: string | null;
  failKey: string;
};

function buildLayer(tiers: ArtTier[]): ArtLayer | null {
  if (tiers.length === 0) return null;
  const cap = tierCap();
  const usable = tiers.filter((t) => t.w <= cap);
  const list = usable.length > 0 ? usable : [tiers[0]];
  const mid = list[Math.min(1, list.length - 1)];
  return {
    src: imgProxy(mid.up, mid.w, { h: mid.h, pos: mid.pos }),
    srcSet: list.map((t) => `${imgProxy(t.up, t.w, { h: t.h, pos: t.pos })} ${t.w}w`).join(", "),
  };
}

function lqipFor(tiers: ArtTier[]): string | null {
  if (tiers.length === 0) return null;
  const smallest = tiers[0];
  return imgProxy(smallest.up, 24, { h: smallest.h, pos: smallest.pos, lqip: true, q: 40 });
}

/** Resolved art for one slide. TEXTLESS-first portrait selection:
 *  ① TMDB textless poster (iso_639_1 null, best-voted)
 *  ② TMDB textless backdrop, attention-cropped to the hero portrait aspect
 *  ③ the catalog poster (titled — the bottom fade hides the baked title).
 *  md+ landscape prefers the textless backdrop, then the catalog backdrop. */
function slideArt(meta: Meta, info: SlideInfo): HeroArtSpec {
  const failKey = `${meta.type}:${meta.id}`;
  let portraitTiers: ArtTier[] = [];
  let landscapeTiers: ArtTier[] = [];
  if (info.posterPath) {
    portraitTiers = tmdbPosterTiers(info.posterPath);
  } else if (info.backdropPath) {
    portraitTiers = tmdbBackdropPortraitTiers(info.backdropPath);
  } else if (meta.poster) {
    portraitTiers = tiersFor(meta.poster, "poster");
  }
  if (info.backdropPath) {
    landscapeTiers = tmdbBackdropTiers(info.backdropPath);
  } else if (meta.background) {
    landscapeTiers = tiersFor(meta.background, "background");
  }
  return {
    portrait: buildLayer(portraitTiers),
    landscape: buildLayer(landscapeTiers),
    lqipPortrait: lqipFor(portraitTiers),
    lqipLandscape: lqipFor(landscapeTiers),
    failKey,
  };
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Shortest circular delta from a to b on an n-ring, in [-n/2, n/2]. */
function wrapDelta(d: number, n: number): number {
  const m = ((d % n) + n) % n;
  return m > n / 2 ? m - n : m;
}

// ---------- per-slide art (memoized, keyed by spec identity) ----------
const HeroArt = memo(function HeroArt({
  art,
  alt,
  eager,
  active,
}: {
  art: HeroArtSpec;
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
    setFailed(FAILED_ART.has(art.failKey));
  }

  // Decode gate: reveal only a fully-decoded frame (no half-painted flash).
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

  if (failed || (!art.portrait && !art.landscape)) return null; // base layer shows

  return (
    <>
      {(art.lqipPortrait || art.lqipLandscape) && (
        /* Tiny blurred placeholder — instant on any connection, crossfaded
           under the sharp art. <picture> swaps it at the same breakpoint as
           the main art so only the matching branch downloads. */
        <picture className="home-hero-lqip">
          {art.lqipLandscape && <source media={MD_MIN} srcSet={art.lqipLandscape} />}
          <img src={art.lqipPortrait ?? art.lqipLandscape ?? undefined} alt="" aria-hidden loading="eager" decoding="async" draggable={false} />
        </picture>
      )}
      <picture className={`home-hero-art${ready ? " home-hero-art-ready" : ""}`}>
        {art.landscape && <source media={MD_MIN} srcSet={art.landscape.srcSet || undefined} sizes="100vw" />}
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
    </>
  );
});

// ---------- TMDB enrichment (logos, genre, textless art) ----------
// Sequential, one slide at a time ~150ms apart; every step fails soft and is
// cached (tmdbGet TTL + session ENRICH_CACHE) so revisits are free.
function useHeroEnrichment(slides: HeroSlide[], lang: string): Record<string, SlideInfo> {
  const [info, setInfo] = useState<Record<string, SlideInfo>>(() => {
    const seed: Record<string, SlideInfo> = {};
    for (const s of slides) {
      const hit = ENRICH_CACHE.get(s.meta.id);
      if (hit) seed[s.meta.id] = hit;
    }
    return seed;
  });
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
        if (meta.logo && meta.genres?.length && infoRef.current[meta.id]?.posterPath) continue;
        if (infoRef.current[meta.id]) continue;
        try {
          const tmdbId = await tmdbIdFromImdb(meta.id, meta.type === "series" ? "series" : "movie");
          if (!alive) return;
          if (!tmdbId) continue;
          const details = await tmdbDetails(meta.type === "series" ? "series" : "movie", tmdbId);
          if (!alive || !details) continue;
          const logoPath = tmdbLogoPath(details, lang);
          const value: SlideInfo = {
            logo: logoPath ? imgProxy(tmdbOriginal(logoPath), 720, { alpha: true, q: 82 }) : undefined,
            genre: details.genres?.[0]?.name,
            overview: typeof details.overview === "string" && details.overview.trim() ? details.overview.trim() : undefined,
            ...tmdbHeroArt(details),
          };
          if (value.logo || value.genre || value.posterPath || value.backdropPath || value.overview) {
            ENRICH_CACHE.set(meta.id, value);
            setInfo((prev) => ({ ...prev, [meta.id]: value }));
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
  }, [sig]);
  return info;
}

// ---------- main component ----------
export function HomeHero({ slides, loading }: { slides: HeroSlide[]; loading: boolean }) {
  const settings = useSettings((s) => s.settings);
  const lang = settings.uiLanguage || "en";
  const rtl = isArabic(lang);
  const push = useNav((s) => s.push);

  const [idx, setIdx] = useState(0); // committed slide
  const [settle, setSettle] = useState(0); // in-flight step (syncs the dots)
  const [jump, setJump] = useState<{ from: number; delta: number } | null>(null);
  const [userPaused, setUserPaused] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [touching, setTouching] = useState(false);
  const [focusPaused, setFocusPaused] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [moving, setMoving] = useState(false); // will-change window
  // Large-screen presentation gates (round 25). PHONES NEVER SET THESE — the
  // phone code path renders exactly the pre-round-25 tree (same DOM, same
  // classes, same inline styles); every large-screen element is conditional
  // on these flags and additionally gated by the ≥600/≥1024 CSS bands.
  const [large, setLarge] = useState(false); // ≥600: start-anchored column, segments, arrows
  const [wide, setWide] = useState(false); // ≥1024: up-next strip

  const trackRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const xRef = useRef(0); // current track offset (px)
  const wRef = useRef(0); // viewport width captured per gesture
  const idxRef = useRef(0);
  const phaseRef = useRef<"idle" | "drag" | "anim" | "jump">("idle");
  const dirRef = useRef(1);
  dirRef.current = rtl ? -1 : 1;
  const reducedRef = useRef(false);
  reducedRef.current = reduced;
  const dragRef = useRef<{ id: number; startX: number; x0: number; lastX: number; lastT: number; v: number; active: boolean } | null>(null);
  const rafRef = useRef(0);
  const trackAnimRef = useRef<Animation | null>(null);
  const contentAnimRef = useRef<Animation | null>(null); // entrance replay
  const fadeAnimRef = useRef<Animation | null>(null); // settle fade
  const jumpAnimRef = useRef<Animation[]>([]);
  const jumpElsRef = useRef<{ from: HTMLDivElement | null; to: HTMLDivElement | null }>({ from: null, to: null });
  const dotBtnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // Round 25 (large screens): segmented indicator — the ACTIVE segment's fill
  // is driven per-frame from the autoplay clock below (transform-only).
  const segFillRef = useRef<HTMLSpanElement | null>(null);
  const segBtnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const lastTickRef = useRef(0); // autoplay interval's last fire time
  /** Resolved indicator slot sizes (px) — measured once per gesture so the
   *  drag-synced width morph respects the --ind-scale ladder. */
  const indSizesRef = useRef<{ dot: number; active: number } | null>(null);
  const lingerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // A2: a click right after a drag that actually moved is accidental — swallow
  // exactly one click (capture phase) after any drag beyond a few px.
  const suppressClickRef = useRef(false);

  const total = slides.length;
  const totalRef = useRef(0);
  totalRef.current = total;
  idxRef.current = Math.min(idx, Math.max(0, total - 1));

  const info = useHeroEnrichment(slides, lang);

  // Reduced-motion: no autoplay, no smooth scrolling, short crossfades (CSS too)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Size-class gates (round 25): one listener pair, applied together.
  useEffect(() => {
    const lg = window.matchMedia("(min-width: 600px)");
    const wd = window.matchMedia("(min-width: 1024px)");
    const apply = () => {
      setLarge(lg.matches);
      setWide(wd.matches);
    };
    apply();
    lg.addEventListener("change", apply);
    wd.addEventListener("change", apply);
    return () => {
      lg.removeEventListener("change", apply);
      wd.removeEventListener("change", apply);
    };
  }, []);

  // Off-screen gate (also prevents programmatic motion from yanking the page)
  useEffect(() => {
    const el = trackRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // B7: show 3–4 up-next cards depending on the available hero height —
  // never more than actually fit (measured, not assumed). Re-runs when the
  // skeleton resolves: sectionRef only exists after `loading` clears.
  const [upnextMax, setUpnextMax] = useState(3);
  useEffect(() => {
    if (!wide || loading) return;
    const el = sectionRef.current;
    if (!el) return;
    const compute = () => setUpnextMax(el.clientHeight >= 620 ? 4 : 3);
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [wide, loading]);

  // A2: trackpad/horizontal-wheel navigation — horizontal intent only (a
  // vertical scroll never moves the carousel), debounced, shortest direction.
  // Native non-passive listener: React's onWheel is passive, and preventDefault
  // is what stops a horizontal trackpad swipe from also scrolling the page.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    let accum = 0;
    let lockUntil = 0;
    const onWheel = (e: WheelEvent) => {
      if (totalRef.current <= 1) return;
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return; // vertical scroll wins
      e.preventDefault();
      const now = performance.now();
      if (now < lockUntil) return;
      accum += e.deltaX;
      if (Math.abs(accum) < 60) return;
      const forward = accum > 0 ? (dirRef.current < 0 ? 1 : -1) : dirRef.current < 0 ? -1 : 1;
      accum = 0;
      lockUntil = now + 450; // one step per gesture (momentum floods events)
      const n = totalRef.current;
      const cur = idxRef.current;
      const target = (((cur + forward) % n) + n) % n;
      goToRef.current(target);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // The section (and the ref) only exists once the skeleton resolves.
  }, [loading]);

  // ---------- art specs (identity-cached per title so HeroArt memo holds) ----------
  const artsCacheRef = useRef(new Map<string, { sig: string; spec: HeroArtSpec }>());
  const arts = useMemo(() => {
    return slides.map((s) => {
      const inf = info[s.meta.id] ?? {};
      const sig = `${inf.logo ?? ""}|${inf.genre ?? ""}|${inf.posterPath ?? ""}|${inf.backdropPath ?? ""}`;
      const prev = artsCacheRef.current.get(s.meta.id);
      if (prev && prev.sig === sig) return prev.spec;
      const spec = slideArt(s.meta, inf);
      artsCacheRef.current.set(s.meta.id, { sig, spec });
      return spec;
    });
  }, [slides, info]);

  // B6: adaptive readability — sample the ACTIVE artwork behind the text zone
  // (inline-start half, lower 70%) on a tiny canvas and write --hero-adapt, the
  // opacity of the extra scrim layer, so white text keeps ≥4.5:1 on bright art.
  // Sampled once per image (cached by failKey); art is same-origin (/api/img).
  // Gated to ≥1024 (`wide`): the 600–1023 tablet band is design-frozen, and
  // shrinking below 1024 resets the layer to 0 so no stale value leaks.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const apply = (v: number) => section.style.setProperty("--hero-adapt", v.toFixed(3));
    if (!wide) {
      apply(0);
      return;
    }
    const i = Math.min(idx, Math.max(0, total - 1));
    const art = arts[i];
    if (!art) {
      apply(0);
      return;
    }
    const cached = SCRIM_CACHE.get(art.failKey);
    if (cached !== undefined) {
      apply(cached);
      return;
    }
    const img = trackRef.current?.querySelector<HTMLImageElement>(`[data-i="${i}"] .home-hero-art img`);
    if (!img) {
      apply(0);
      return;
    }
    let cancelled = false;
    const sample = () => {
      if (cancelled || !img.complete || img.naturalWidth === 0) return;
      try {
        const W = 64;
        const H = 36;
        const cv = document.createElement("canvas");
        cv.width = W;
        cv.height = H;
        const ctx = cv.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, W, H);
        // The text zone: the column side (inline-start half), lower 70%.
        const rtlNow = dirRef.current < 0;
        const x0 = rtlNow ? Math.floor(W * 0.48) : 0;
        const x1 = rtlNow ? W : Math.floor(W * 0.52);
        const y0 = Math.floor(H * 0.3);
        const data = ctx.getImageData(x0, y0, x1 - x0, H - y0).data;
        let sum = 0;
        let n = 0;
        for (let p = 0; p < data.length; p += 4) {
          const r = data[p] / 255;
          const g = data[p + 1] / 255;
          const b = data[p + 2] / 255;
          sum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
          n++;
        }
        const L = n > 0 ? sum / n : 0;
        // White text needs backdrop luminance ≲0.18 for 4.5:1; the static side
        // scrim covers moderate art — add extra darkening only above ~0.24.
        const extra = Math.min(0.75, Math.max(0, (L - 0.24) * 1.9));
        SCRIM_CACHE.set(art.failKey, extra);
        apply(extra);
      } catch {
        /* sampling is best-effort (tainted canvas, detached node, …) */
      }
    };
    if (img.complete) sample();
    else img.addEventListener("load", sample, { once: true });
    return () => {
      cancelled = true;
      img.removeEventListener("load", sample);
    };
    // `loading` re-runs this once the real section (and ref) exists.
  }, [idx, arts, wide, total, loading]);

  const artWindow = useMemo(() => {
    // jump: exactly the crossfading pair; otherwise the 3-slot window
    if (jump) return new Set([jump.from, Math.min(idx, total - 1)]);
    const set = new Set<number>();
    if (total > 0) {
      set.add(idx);
      set.add((idx + 1) % total);
      set.add((idx - 1 + total) % total);
    }
    return set;
  }, [idx, total, jump]);

  const canAutoplay = total > 1 && !reduced && !userPaused && !hovering && !touching && !focusPaused && onScreen;

  // will-change linger: keep compositor hints while active, drop when idle
  const idleSoon = useCallback(() => {
    if (lingerRef.current) clearTimeout(lingerRef.current);
    lingerRef.current = setTimeout(() => {
      if (phaseRef.current === "idle") setMoving(false);
    }, 300);
  }, []);

  // ---------- commit (swap slots while the incoming slide fully covers) ----------
  const commitVisual = useCallback(
    (nextIdx: number) => {
      const track = trackRef.current;
      trackAnimRef.current?.cancel();
      trackAnimRef.current = null;
      if (track) {
        const dir = dirRef.current;
        const n = totalRef.current;
        // Manual reposition BEFORE paint: each mounted slide re-slotted
        // relative to nextIdx; the covering slide lands exactly at slot 0.
        for (const child of Array.from(track.children) as HTMLElement[]) {
          const i = Number(child.dataset.i);
          if (!Number.isFinite(i)) continue;
          const d = wrapDelta(i - nextIdx, n);
          if (Math.abs(d) <= 1) child.style.transform = `translate3d(${d * 100 * dir}%, 0, 0)`;
        }
        track.style.transform = "translate3d(0, 0, 0)";
      }
      const content = contentRef.current;
      if (content) {
        content.style.opacity = "";
        content.style.transform = "";
      }
      xRef.current = 0;
      phaseRef.current = "idle";
      setSettle(0);
      setIdx(nextIdx);
      idleSoon();
    },
    [idleSoon],
  );

  // ---------- crossfade jump (far targets; |delta| > 1 never mounts middles) ----------
  const startJump = useCallback(
    (target: number, delta: number) => {
      const n = totalRef.current;
      if (n < 2) return;
      const cur = idxRef.current;
      const t = ((target % n) + n) % n;
      if (t === cur) return;
      for (const a of jumpAnimRef.current) a.cancel();
      jumpAnimRef.current = [];
      phaseRef.current = "jump";
      setMoving(true);
      setSettle(0);
      setJump({ from: cur, delta: wrapDelta(delta, n) });
      setIdx(t);
      idleSoon();
    },
    [idleSoon],
  );
  const startJumpRef = useRef(startJump);
  useEffect(() => {
    startJumpRef.current = startJump;
  }, [startJump]);
  // Wheel navigation (A2) reads the latest goTo through a ref (declared
  // before goTo itself, assigned right after).
  const goToRef = useRef<(target: number) => void>(() => {});

  /** Live track offset from the computed transform (matrix read; used when
   *  interrupting an in-flight transition so it continues, never jumps). */
  const currentTrackX = useCallback((): number => {
    const track = trackRef.current;
    if (!track) return 0;
    try {
      const t = getComputedStyle(track).transform;
      if (!t || t === "none") return 0;
      return new DOMMatrixReadOnly(t).m41;
    } catch {
      return 0;
    }
  }, []);

  // ---------- adjacent slide transition (from arbitrary x; interruptible) ----------
  const slideStepFrom = useCallback(
    (step: 1 | -1, fromX: number) => {
      const track = trackRef.current;
      const w = wRef.current || track?.clientWidth || 0;
      const n = totalRef.current;
      if (!track || n < 2 || w === 0) return;
      const target = (((idxRef.current + step) % n) + n) % n;
      const dir = dirRef.current;
      const targetX = -dir * step * w;
      if (reducedRef.current) {
        // reduced motion: programmatic transitions become a short crossfade
        startJumpRef.current(target, step);
        return;
      }
      // interrupt any in-flight transition from its CURRENT position
      let startX = fromX;
      if (trackAnimRef.current) {
        startX = currentTrackX();
        trackAnimRef.current.cancel();
        trackAnimRef.current = null;
      }
      phaseRef.current = "anim";
      setMoving(true);
      setSettle(step);
      // content: fade toward the travel side (data crossfades on commit)
      const content = contentRef.current;
      fadeAnimRef.current?.cancel();
      if (content) {
        const curOp = parseFloat(content.style.opacity || getComputedStyle(content).opacity || "1");
        fadeAnimRef.current = content.animate([{ opacity: Number.isFinite(curOp) ? curOp : 1 }, { opacity: 0 }], {
          duration: tokenVals.snapMs,
          easing: EASE,
        });
        const anim = fadeAnimRef.current;
        anim.onfinish = () => {
          content.style.opacity = "0";
          anim.cancel();
        };
      }
      const anim = track.animate(
        [{ transform: `translate3d(${startX}px, 0, 0)` }, { transform: `translate3d(${targetX}px, 0, 0)` }],
        { duration: tokenVals.snapMs, easing: EASE },
      );
      trackAnimRef.current = anim;
      anim.onfinish = () => commitVisual(target);
    },
    [commitVisual, currentTrackX],
  );

  // Jump animation: runs on the two mounted wrappers (from → to).
  useEffect(() => {
    if (!jump) return;
    const outEl = jumpElsRef.current.from;
    const inEl = jumpElsRef.current.to;
    if (!outEl || !inEl || !outEl.animate) return;
    const reducedNow = reducedRef.current;
    const dur = reducedNow ? tokenVals.reducedMs : tokenVals.jumpMs;
    const travel = dirRef.current * (jump.delta > 0 ? 1 : -1);
    const shift = reducedNow ? 0 : tokenVals.jumpShift * travel;
    const anims: Animation[] = [];
    if (outEl.animate) {
      anims.push(
        outEl.animate(
          [
            { opacity: 1, transform: "translate3d(0, 0, 0)" },
            { opacity: 0, transform: `translate3d(${shift}px, 0, 0)` },
          ],
          { duration: dur, easing: EASE },
        ),
      );
    }
    if (inEl.animate) {
      anims.push(
        inEl.animate(
          [
            { opacity: 0, transform: `translate3d(${-shift}px, 0, 0)` },
            { opacity: 1, transform: "translate3d(0, 0, 0)" },
          ],
          { duration: dur, easing: EASE },
        ),
      );
    }
    jumpAnimRef.current = anims;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      for (const a of anims) a.cancel();
      jumpAnimRef.current = [];
      setJump(null);
      phaseRef.current = "idle";
      idleSoon();
    };
    for (const a of anims) a.onfinish = finish;
    return () => {
      done = true;
      for (const a of anims) a.cancel();
      jumpAnimRef.current = [];
    };
  }, [jump, idleSoon]);

  // Hand the dot slots back to CSS after per-frame drag width writes;
  // transitions resume from the cleared (aria-current) state toward the new
  // active slot with zero pop.
  useLayoutEffect(() => {
    for (const el of dotBtnRefs.current) {
      if (el) el.style.width = "";
    }
  }, [settle, idx]);

  // ---------- autoplay ----------
  useEffect(() => {
    if (!canAutoplay || total <= 1 || document.hidden) return;
    lastTickRef.current = performance.now(); // segment fill starts from 0 on (re)creation
    const t = setInterval(() => {
      if (document.hidden || phaseRef.current !== "idle") return; // never interrupts a drag/jump
      lastTickRef.current = performance.now(); // fill completes exactly as the tick fires
      slideStepFrom(1, xRef.current);
    }, AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [canAutoplay, total, slideStepFrom]);

  // ---------- segmented autoplay progress (large screens, transform-only) ----------
  useEffect(() => {
    if (!large || total <= 1) return;
    let raf = 0;
    let frozen = 0; // last displayed progress (resumed pauses freeze here)
    const tick = () => {
      const el = segFillRef.current;
      if (el) {
        let p: number;
        if (canAutoplay) {
          p = Math.min(1, Math.max(0, (performance.now() - lastTickRef.current) / AUTOPLAY_MS));
          frozen = p;
        } else {
          p = frozen; // paused (hover/focus/touch/off-screen/reduced): freeze
        }
        el.style.transform = `scaleX(${p.toFixed(4)})`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [large, total, canAutoplay]);

  // ---------- keyboard ----------
  const goTo = useCallback(
    (target: number) => {
      const n = totalRef.current;
      if (n < 2) return;
      const cur = idxRef.current;
      const t = ((target % n) + n) % n;
      if (t === cur) return;
      const d = wrapDelta(t - cur, n);
      if (d === 1) slideStepFrom(1, xRef.current);
      else if (d === -1) slideStepFrom(-1, xRef.current);
      else startJump(t, d);
    },
    [slideStepFrom, startJump],
  );
  useEffect(() => {
    goToRef.current = goTo;
  }, [goTo]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (total <= 1) return;
    const nextKey = rtl ? "ArrowLeft" : "ArrowRight";
    const prevKey = rtl ? "ArrowRight" : "ArrowLeft";
    if (e.key === nextKey) {
      e.preventDefault();
      goTo((idxRef.current + 1) % total);
    } else if (e.key === prevKey) {
      e.preventDefault();
      goTo((idxRef.current - 1 + total) % total);
    } else if (e.key === "Home") {
      e.preventDefault();
      goTo(0);
    } else if (e.key === "End") {
      e.preventDefault();
      goTo(total - 1);
    }
  };

  // ---------- pointer drag (finger-following, 1:1, interruptible) ----------
  const applyDragFrame = useCallback(() => {
    rafRef.current = 0;
    const x = xRef.current;
    const w = wRef.current;
    if (w === 0) return;
    const track = trackRef.current;
    if (track) track.style.transform = `translate3d(${x}px, 0, 0)`;
    // content: drift at most --hero-content-drift, fade with progress
    const p = x / w;
    const content = contentRef.current;
    if (content) {
      content.style.opacity = String(Math.max(0, 1 - Math.abs(p)));
      content.style.transform = `translate3d(${-p * tokenVals.contentDrift}px, 0, 0)`;
    }
    // indicator: morph the candidate + current SLOT WIDTHS with drag progress
    // (the row always reserves the pill's room — gaps stay clean mid-gesture)
    const n = totalRef.current;
    if (n > 1) {
      const step = x * dirRef.current < 0 ? 1 : -1;
      const prog = Math.min(1, Math.abs(p));
      const cand = ((((idxRef.current + step) % n) + n) % n) % n;
      const candBtn = dotBtnRefs.current[cand];
      const curBtn = dotBtnRefs.current[idxRef.current];
      const sizes = indSizesRef.current;
      if (candBtn && sizes) {
        candBtn.style.width = `${sizes.dot + (sizes.active - sizes.dot) * prog}px`;
      }
      if (curBtn && curBtn !== candBtn && sizes) {
        curBtn.style.width = `${sizes.active - (sizes.active - sizes.dot) * prog}px`;
      }
    }
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (total <= 1) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const track = trackRef.current;
    if (!track) return;
    // Interrupt any in-flight motion and CONTINUE from the current position.
    if (trackAnimRef.current) {
      xRef.current = currentTrackX();
      trackAnimRef.current.cancel();
      trackAnimRef.current = null;
      // commit the continued position inline RIGHT NOW (before any rAF) so
      // cancelling the animation never flashes the resting slide
      track.style.transform = `translate3d(${xRef.current}px, 0, 0)`;
    } else {
      xRef.current = 0;
    }
    if (jump) {
      for (const a of jumpAnimRef.current) a.cancel();
      jumpAnimRef.current = [];
      setJump(null);
    }
    fadeAnimRef.current?.cancel();
    fadeAnimRef.current = null;
    const content = contentRef.current;
    if (content) content.style.opacity = getComputedStyle(content).opacity;
    // resolve indicator slot sizes for this gesture (min across non-current
    // buttons — immune to a hover-swelled button)
    {
      const restWidths = dotBtnRefs.current
        .map((b, i) => (b && i !== idxRef.current ? parseFloat(getComputedStyle(b).width) : Infinity))
        .filter((v) => Number.isFinite(v) && v > 0);
      const curBtn = dotBtnRefs.current[idxRef.current];
      const activeW = curBtn ? parseFloat(getComputedStyle(curBtn).width) : NaN;
      const dot = restWidths.length ? Math.min(...restWidths) : IND_DOT;
      const active = Number.isFinite(activeW) && activeW >= dot ? activeW : IND_ACTIVE_W;
      indSizesRef.current = { dot, active };
    }
    setSettle(0);
    wRef.current = track.clientWidth;
    try {
      track.setPointerCapture(e.pointerId);
    } catch {
      /* capture is best-effort */
    }
    dragRef.current = { id: e.pointerId, startX: e.clientX, x0: xRef.current, lastX: xRef.current, lastT: performance.now(), v: 0, active: true };
    phaseRef.current = "drag";
    setDragging(true);
    setMoving(true);
    setTouching(true);
    if (touchTimer.current) clearTimeout(touchTimer.current);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d?.active || e.pointerId !== d.id) return;
    const track = trackRef.current;
    const w = wRef.current;
    if (!track || w === 0) return;
    let x = d.x0 + (e.clientX - d.startX);
    // modular window covers exactly one width to each side; hard-stop there
    if (x > w) x = w;
    if (x < -w) x = -w;
    const now = performance.now();
    const dt = now - d.lastT;
    if (dt > 0) d.v = 0.6 * d.v + 0.4 * ((x - d.lastX) / dt);
    d.lastX = x;
    d.lastT = now;
    xRef.current = x;
    if (!rafRef.current) rafRef.current = requestAnimationFrame(applyDragFrame);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d?.active || e.pointerId !== d.id) return;
    d.active = false;
    dragRef.current = null;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    setDragging(false);
    if (touchTimer.current) clearTimeout(touchTimer.current);
    touchTimer.current = setTimeout(() => setTouching(false), 8_000);
    const x = xRef.current;
    const w = wRef.current;
    if (w === 0) return;
    const s = -(x * dirRef.current) / w; // signed progress toward "next"
    const flung = Math.abs(d.v) > VELOCITY_PX_MS;
    // A real drag (beyond a few px) swallows the click that follows the
    // release so releasing over a button never activates it (A2).
    if (Math.abs(x) > 8) suppressClickRef.current = true;
    let step: 0 | 1 | -1 = 0;
    if (s > ADVANCE_FRACTION || (flung && s > 0)) step = 1;
    else if (s < -ADVANCE_FRACTION || (flung && s < 0)) step = -1;
    if (step === 0) {
      // snap back
      if (reducedRef.current) {
        const track = trackRef.current;
        if (track) track.style.transform = "translate3d(0, 0, 0)";
        const content = contentRef.current;
        if (content) {
          content.style.opacity = "";
          content.style.transform = "";
        }
        xRef.current = 0;
        phaseRef.current = "idle";
        idleSoon();
        return;
      }
      phaseRef.current = "anim";
      setMoving(true);
      const track = trackRef.current;
      const content = contentRef.current;
      fadeAnimRef.current?.cancel();
      if (content) {
        const curOp = parseFloat(content.style.opacity || "1") || 0;
        fadeAnimRef.current = content.animate([{ opacity: curOp }, { opacity: 1 }], { duration: tokenVals.snapMs, easing: EASE });
        const anim = fadeAnimRef.current;
        anim.onfinish = () => {
          content.style.opacity = "1";
          anim.cancel();
        };
      }
      if (track) {
        trackAnimRef.current?.cancel();
        const anim = track.animate(
          [{ transform: `translate3d(${x}px, 0, 0)` }, { transform: "translate3d(0, 0, 0)" }],
          { duration: tokenVals.snapMs, easing: EASE },
        );
        trackAnimRef.current = anim;
        anim.onfinish = () => {
          xRef.current = 0;
          phaseRef.current = "idle";
          idleSoon();
          anim.cancel();
        };
      }
      setSettle(0);
    } else {
      slideStepFrom(step, x);
    }
  };

  // ---------- entrance crossfade of the content stack (never remounts) ----------
  const activeMeta = slides[Math.min(idx, Math.max(0, total - 1))]?.meta;
  const activeId = activeMeta?.id ?? "";
  useEffect(() => {
    if (!activeId || reduced) return;
    const el = contentRef.current;
    if (!el?.animate) return;
    fadeAnimRef.current?.cancel();
    contentAnimRef.current?.cancel();
    contentAnimRef.current = el.animate(
      [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "translateY(0)" }],
      { duration: 300, easing: EASE },
    );
  }, [activeId, reduced]);

  // ---------- idle warm-up: decode every artwork once per session ----------
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
      const img = trackRef.current?.querySelector<HTMLImageElement>(`[data-i="${i}"] img`);
      if (img) {
        img.decode?.().then(mark).catch(() => {
          /* warm-up only */
        });
        return;
      }
      // Out-of-window: detached Image() with the srcset the mounted img will
      // use, so the browser cache entry matches exactly when the window reaches it.
      const pick = (ladder: ArtLayer | null): string | undefined => {
        if (!ladder) return undefined;
        if (!ladder.srcSet) return ladder.src;
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

  // ---------- unmount cleanup: every timer / animation / listener ----------
  useEffect(() => {
    return () => {
      if (touchTimer.current) clearTimeout(touchTimer.current);
      if (lingerRef.current) clearTimeout(lingerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      trackAnimRef.current?.cancel();
      contentAnimRef.current?.cancel();
      fadeAnimRef.current?.cancel();
      for (const a of jumpAnimRef.current) a.cancel();
      jumpAnimRef.current = [];
    };
  }, []);

  if (loading) return <HeroSkeleton lang={lang} large={large} />;
  if (total === 0) return null;

  const slide = slides[Math.min(idx, total - 1)];
  const meta = slide.meta;
  const enriched = info[meta.id] ?? {};
  const logo = meta.logo ?? enriched.logo;
  const genre = meta.genres?.[0] ?? enriched.genre;
  const year = meta.releaseInfo?.split("–")[0];
  const typeLabel = metaTypeLabel(meta.type, meta.genres ?? (genre ? [genre] : undefined), lang);
  // Round 25 (large screens): synopsis from the SAME enrichment data.
  const synopsis = enriched.overview;
  // "Up next" preview list (≥1024): the next min(4, total-1) slides after the
  // current one, circular. Plain derivation (≤8 slides — no memo needed), and
  // intentionally AFTER the early returns (no hooks here).
  const upNext: { meta: Meta; i: number }[] = [];
  if (total > 1) {
    // B7: 3–4 cards by measured hero height (never more than fit).
    const count = Math.min(upnextMax, total - 1);
    for (let k = 1; k <= count; k++) {
      const i = (idx + k) % total;
      const s = slides[i];
      if (s) upNext.push({ meta: s.meta, i });
    }
  }

  // Preload the FIRST slide's art (React 19 hoists <link> to <head>);
  // media-split so each platform preloads exactly the layer it will show.
  const firstArt = arts.length > 0 ? arts[0] : null;

  const titleLen = meta.name.length;
  const titleClass = titleLen <= 8 ? "" : titleLen <= 16 ? " home-hero-title-m" : " home-hero-title-s";

  // Mounted slots: the 3-window (dup ids at ±1 when total === 2 — keys are
  // slot-scoped) or the crossfade pair while a jump is in flight.
  const dir = dirRef.current;
  const mounted: { slot: number; i: number; jumpRole?: "from" | "to" }[] = jump
    ? [
        { slot: 0, i: jump.from, jumpRole: "from" },
        { slot: 0, i: Math.min(idx, total - 1), jumpRole: "to" },
      ]
    : total === 1
      ? [{ slot: 0, i: 0 }]
      : [
          { slot: -1, i: (idx - 1 + total) % total },
          { slot: 0, i: idx },
          { slot: 1, i: (idx + 1) % total },
        ];

  const currentTarget = settle !== 0 ? (((idx + settle) % total) + total) % total : idx;

  return (
    <section
      ref={sectionRef}
      className={`home-hero group/hero${moving ? " is-moving" : ""}${dragging ? " is-dragging" : ""}`}
      role="region"
      aria-roledescription="carousel"
      aria-label={homeT("featured", lang)}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocusCapture={() => setFocusPaused(true)}
      onBlurCapture={() => setFocusPaused(false)}
      onKeyDown={onKeyDown}
      onClickCapture={(e) => {
        // A2: swallow the single click that trails a real drag.
        if (suppressClickRef.current) {
          e.preventDefault();
          e.stopPropagation();
          suppressClickRef.current = false;
        }
      }}
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
        tabIndex={0}
        aria-label={homeT("featured", lang)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {mounted.map(({ slot, i, jumpRole }) => {
          const s = slides[i];
          if (!s) return null;
          const active = i === idx;
          const adjacent = artWindow.has(i);
          return (
            <div
              key={`${slot}:${s.meta.id}`}
              data-i={i}
              data-jump={jumpRole}
              ref={
                jumpRole
                  ? (el) => {
                      jumpElsRef.current[jumpRole] = el;
                    }
                  : undefined
              }
              className="home-hero-slide"
              style={{ transform: `translate3d(${slot * 100 * dir}%, 0, 0)` }}
              role="group"
              aria-roledescription="slide"
              aria-label={slideOf(i + 1, total, lang)}
              aria-hidden={!active}
            >
              <div className="home-hero-base" aria-hidden />
              {adjacent && arts[i] ? (
                <HeroArt art={arts[i]!} alt={active ? s.meta.name : ""} eager={adjacent} active={active} />
              ) : active ? (
                <div role="img" aria-label={s.meta.name} />
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="home-hero-scrim-top" aria-hidden />
      {/* Round 25 (≥600): directional readability scrim — darkest at the
          content column's inline-start edge, physical gradient flips in RTL. */}
      <div className="home-hero-scrim-side" aria-hidden />
      {/* B6 (≥600): adaptive layer — opacity is --hero-adapt, measured from
          the rendered artwork's luminance behind the text zone (cached). */}
      <div className="home-hero-scrim-adapt" aria-hidden />
      <div className="home-hero-scrim-fade" aria-hidden />

      {/* Round 25 (≥1024): "Up next" preview strip — next 3–4 titles as small
          glass cards; the nearest one is highlighted. Shares the SAME data
          slides (no new source) and the SAME goTo engine. Card count adapts
          to the hero height (B7): 3–4, never more than fit. */}
      {wide && total > 1 && (
        <div className="home-hero-upnext">
          <p className="home-hero-upnext-label">{homeT("upNext", lang)}</p>
          {upNext.map(({ meta: um, i }, k) => (
            <button
              key={`${um.type}:${um.id}`}
              type="button"
              className="upnext-card md-state harbor-tv-focus"
              data-primary={k === 0 ? "true" : undefined}
              onClick={() => goTo(i)}
            >
              <span className="upnext-thumb" aria-hidden>
                {um.poster ? <PosterImage src={um.poster} alt="" className="absolute inset-0" /> : null}
              </span>
              <span className="upnext-name" dir="auto">{um.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Shared content stack — NEVER remounts: data crossfades in place.
          A4: ONE vertical flow anchored from the bottom — [logo] [meta]
          [synopsis] [actions] [progress segments]; variable-height parts
          (logo, meta, synopsis) only grow UPWARD, so the button and the
          segments keep the exact same position on every slide (B4). Gaps are
          tokens: --hero-gap-meta / --hero-gap-syn / --hero-gap-segs. */}
      <div ref={contentRef} className="home-hero-content">
        <div className="home-hero-logo-row">
          {logo ? (
            <img
              src={logo}
              alt={meta.name}
              className="home-hero-logo"
              loading="eager"
              decoding="async"
              onLoad={(e) => {
                // B5: classify the mark so square/round logos get their
                // minimum visual size (CSS [data-shape="square"]).
                const el = e.currentTarget;
                const ratio = el.naturalWidth / Math.max(1, el.naturalHeight);
                el.dataset.shape = ratio < 1.25 ? "square" : "wide";
              }}
            />
          ) : (
            <h1 className={`home-hero-title${titleClass}`} dir="auto">{meta.name}</h1>
          )}
        </div>

        <div className="home-hero-meta" style={{ marginBottom: "var(--hero-gap-meta)" }}>
          {year && <bdi className="shrink-0">{year}</bdi>}
          {year && genre && <span className="hero-meta-dot" aria-hidden />}
          {genre && <bdi className="overflow-hidden text-ellipsis">{genre}</bdi>}
          <span className="hero-meta-dot" aria-hidden />
          <bdi className="shrink-0">{typeLabel}</bdi>
        </div>

        {/* Round 25 (≥600 only — the phone hero has no synopsis): TMDB overview
            from the SAME enrichment call. A3: clamped to exactly 2 lines at
            every large size (--hero-syn-lines: 2) with a real ellipsis; B1:
            dir="auto" renders each locale's punctuation at its logical end. */}
        {large && synopsis && <p className="home-hero-synopsis" dir="auto">{synopsis}</p>}

        {large ? (
          <button
            type="button"
            onClick={() => push({ kind: "detail", type: meta.type, id: meta.id })}
            className="home-hero-btn-lg md-state harbor-tv-focus"
          >
            {homeT("viewDetails", lang)}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => push({ kind: "detail", type: meta.type, id: meta.id })}
            className="home-hero-btn md-state harbor-tv-focus"
            style={{ marginBottom: "var(--hero-gap-btn)" }}
          >
            {homeT("viewDetails", lang)}
          </button>
        )}

        {total > 1 && !large && (
          <div className="home-hero-dots flex items-center justify-center" style={{ gap: "var(--hero-ind-gap)" }}>
            {slides.map((s, i) => (
              <button
                key={s.meta.id}
                type="button"
                ref={(el) => {
                  dotBtnRefs.current[i] = el;
                }}
                aria-label={goToSlideLabel(i + 1, lang)}
                aria-current={i === currentTarget}
                onClick={() => goTo(i)}
                className="home-hero-dot-btn harbor-tv-focus"
              >
                <span className="home-hero-dot-bar" aria-hidden />
              </button>
            ))}
            {/* WCAG 2.2.2 pause mechanism: visually hidden (reference design
                has no visible control) but reachable via keyboard focus. */}
            <button
              type="button"
              aria-label={userPaused ? homeT("resumeAutoplay", lang) : homeT("pauseAutoplay", lang)}
              onClick={() => setUserPaused((p) => !p)}
              className="home-hero-pause-a11y harbor-tv-focus"
            >
              {userPaused ? homeT("resumeAutoplay", lang) : homeT("pauseAutoplay", lang)}
            </button>
          </div>
        )}

        {/* Round 25 (≥600): segmented progress indicator — the active segment
            fills with the autoplay clock (JS-driven, transform-only); taps/
            keyboard jump via the SAME goTo engine. The WCAG pause control is
            repeated here as the visually-hidden last segment-row child. */}
        {total > 1 && large && (
          <div className="home-hero-segs" role="group" aria-label={homeT("featured", lang)}>
            {slides.map((s, i) => {
              const current = i === currentTarget;
              return (
                <button
                  key={s.meta.id}
                  type="button"
                  ref={(el) => {
                    segBtnRefs.current[i] = el;
                  }}
                  aria-label={goToSlideLabel(i + 1, lang)}
                  aria-current={current}
                  onClick={() => goTo(i)}
                  className="home-hero-seg-btn harbor-tv-focus"
                >
                  <span className="home-hero-seg-bar" aria-hidden>
                    {current && (
                      <span
                        ref={segFillRef}
                        className="home-hero-seg-fill"
                        style={canAutoplay ? undefined : { transform: "scaleX(0)" }}
                      />
                    )}
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              aria-label={userPaused ? homeT("resumeAutoplay", lang) : homeT("pauseAutoplay", lang)}
              onClick={() => setUserPaused((p) => !p)}
              className="home-hero-pause-a11y harbor-tv-focus"
            >
              {userPaused ? homeT("resumeAutoplay", lang) : homeT("pauseAutoplay", lang)}
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
// mirrors the scaled real layout at every breakpoint; the large variant adds
// the synopsis slot + segmented row so composition matches at ≥600) ----------
function HeroSkeleton({ lang, large }: { lang: string; large: boolean }) {
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
        {large && (
          <>
            <div className="home-hero-synopsis" aria-hidden>
              <div className="harbor-skeleton hero-skel-syn" style={{ width: "min(60ch, 100%)" }} />
              <div className="harbor-skeleton hero-skel-syn" style={{ width: "min(48ch, 82%)", marginBottom: "var(--hero-gap-btn)" }} />
            </div>
            <div className="harbor-skeleton rounded-full" style={{ width: "var(--hero-btn-min-w)", height: "var(--hero-btn-height)", marginBottom: "var(--hero-gap-btn)" }} />
            <div className="hero-skel-segs" aria-hidden>
              <div className="harbor-skeleton rounded-full" style={{ width: 44, height: 6 }} />
              <div className="harbor-skeleton rounded-full" style={{ width: 44, height: 6 }} />
              <div className="harbor-skeleton rounded-full" style={{ width: 44, height: 6 }} />
              <div className="harbor-skeleton rounded-full" style={{ width: 44, height: 6 }} />
            </div>
          </>
        )}
        {!large && (
          <>
            <div
              className="harbor-skeleton rounded-full"
              style={{ width: "var(--hero-btn-min-w)", height: "var(--hero-btn-height)", marginBottom: "var(--hero-gap-btn)" }}
            />
            <div className="hero-skel-dots flex items-center justify-center" style={{ gap: "var(--hero-ind-gap)" }}>
              <div className="harbor-skeleton rounded-full" style={{ width: "var(--hero-ind-active-w)", height: "var(--hero-ind-dot)" }} />
              <div className="harbor-skeleton rounded-full" style={{ width: "var(--hero-ind-dot)", height: "var(--hero-ind-dot)" }} />
              <div className="harbor-skeleton rounded-full" style={{ width: "var(--hero-ind-dot)", height: "var(--hero-ind-dot)" }} />
              <div className="harbor-skeleton rounded-full" style={{ width: "var(--hero-ind-dot)", height: "var(--hero-ind-dot)" }} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
