"use client";

// Harbor Web — floating glass bottom navigation (sidebar replacement)
// Design spec (Figma-derived): stadium glass capsule, 4 equal flex slots,
// ONE shared highlight pill that slides between tabs (350ms
// cubic-bezier(0.2,0,0,1)), icon outline→filled cross-fade (150ms), pressed
// scale(0.96) + M3 state layer. All visual values live in the --nav-* tokens
// in globals.css; this component only wires behavior.
//  - Single indicator: exactly ONE .dock-pill exists for the whole bar (a dev
//    check asserts it). Its position comes from ONE value — a fractional tab
//    index (0..count-1) — set from the active tab when idle and from the
//    pointer while dragging. React never styles the pill: every write is a
//    direct DOM write, so re-renders can never spawn a second/ghost state.
//  - Inline-axis math (direction-safe): the track is measured with
//    getBoundingClientRect() each frame; slotW = trackWidth / tabCount; the
//    pointer's inline position (flipped in RTL) gives
//    frac = clamp(pos/slotW - 0.5, 0, count-1); the pill is anchored with
//    inset-inline-start: 0 and moved with
//    translate3d(frac * slotW * dirSign, 0, 0) — dirSign is -1 in RTL. No
//    physical left/right math is mixed with logical offsets anywhere.
//  - Active tab detection: Settings stays lit on every page moved under it
//    (Discover, Library, Addons, …) by walking the nav stack down to the
//    nearest view frame — pure presentation, no business-logic change.
//  - Tab order: explicit per-locale config (dockTabsFor(settings, lang)) —
//    on-screen order is Settings | Kids | Anime | Home in BOTH languages;
//    switching language reorders the tabs and the pill re-seats via measure().
//  - Kids Mode: only Home + Kids tabs (stricter than the old sidebar).
//  - Player: not rendered at all (app-shell showChrome), never overlaps the
//    player controls or the subtitle layer.
//  - Auto-hide on scroll down / reveal on scroll up (settings.dockAutoHide).
//  - ARIA: <nav> landmark, aria-current="page", sr-only labels + native
//    tooltips, roving arrow-key navigation, TV focus rings.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNav, useSettings, type Frame, type View } from "@/lib/harbor/store";
import {
  dockDirectionFor,
  dockTabsFor,
  dockTabLabel,
  type DockTab,
  type DockTabId,
} from "./nav-items";
import { cn } from "@/lib/utils";

/** Map any view id to the dock tab that represents it. Every hub destination
 *  (discover/catalogs/movies/shows/live/calendar/library/addons/wrapped) maps
 *  to Settings so the tab stays highlighted while browsing those pages.
 *  SHARED with the large-screen side rail (side-rail.tsx) — one active-tab
 *  truth for both navigation faces. */
export function tabIdForView(view: View): DockTabId {
  switch (view) {
    case "anime":
      return "anime";
    case "kids":
      return "kids";
    case "home":
      return "home";
    default:
      // settings + every Quick Access destination
      return "settings";
  }
}

export function activeTabId(stack: Frame[]): DockTabId {
  for (let i = stack.length - 1; i >= 0; i--) {
    const f = stack[i];
    if (f.kind === "view") return tabIdForView(f.view);
  }
  // Detail/grid/player frames on top: fall back to the deepest view frame's
  // tab (handled above), or Home when the stack is somehow empty.
  return "home";
}

// ---------- press-and-drag scrub (pointer enhancement; taps untouched) ----------
// Enter scrub on a ≥250ms hold OR a >6px move while pressed. The pill then
// follows the pointer as a FRACTIONAL index (clamped to the first/last slot —
// it can never leave the capsule), transitions off, grows slightly via a
// scale factor baked INTO the same transform write (never the standalone
// `scale` property, which composes around the untranslated origin and
// amplifies the translation — the old overshoot bug), and the tab under the
// pointer lights as a PREVIEW (data-lit) while the real active tab's visuals
// are suppressed (CSS) so exactly ONE indicator is on screen at all times.
// Release commits exactly ONE navigation to the nearest slot (a fast flick
// advances one extra tab) + snaps the pill with the normal 350ms transition.
// pointercancel / lostpointercapture snap back to the still-active tab.
// Capture only engages when scrub starts, so a quick tap still lands as a
// real click on the button (tap logic untouched).
const SCRUB_HOLD_MS = 250;
const SCRUB_MOVE_PX = 6; // tap-vs-drag threshold (spec: 4-6px)
const SCRUB_GROW = 1.08; // pill grow while scrubbing (inside the transform)
const SCRUB_GROW_MS = 150; // grow ease duration
const FLICK_PX_MS = 0.5; // release velocity that advances one extra tab

type ScrubGesture = {
  id: number;
  startX: number;
  startY: number;
  lastX: number;
  timer: number | null;
  raf: number;
  active: boolean; // scrub mode entered
  growT0: number; // performance.now() at scrub start (grow ease)
  frac: number; // current fractional index
  slotW: number; // px, from the live track rect
  dirSign: number; // +1 LTR, -1 RTL
  samples: { t: number; x: number }[]; // recent pointer samples for the flick
  btns: HTMLButtonElement[]; // DOM-order tab buttons (pairs with tabs)
};

export function GlassDock() {
  const settings = useSettings((s) => s.settings);
  const stack = useNav((s) => s.stack);
  const resetTo = useNav((s) => s.resetTo);

  const lang = settings.uiLanguage || "en";
  const tabs = dockTabsFor(settings, lang);
  const activeId = activeTabId(stack);
  const dirSign = dockDirectionFor(lang) === "rtl" ? -1 : 1;
  // Stable signature: re-measure whenever the tab SET or ORDER changes
  // (language switch / Kids Mode / hide-anime) — not on every render.
  const tabSig = useMemo(() => tabs.map((t) => t.id).join("|"), [tabs]);

  const trackRef = useRef<HTMLDivElement>(null);
  const pillElRef = useRef<HTMLSpanElement>(null);
  const [scrubbing, setScrubbing] = useState(false);

  /** Write the pill to a fractional index. All pill styling is DOM-only —
   *  React renders a bare <span> so re-renders can never fight the drag. */
  const writePill = useCallback(
    (frac: number, scale = 1) => {
      const track = trackRef.current;
      const pillEl = pillElRef.current;
      if (!track || !pillEl) return;
      const w = track.getBoundingClientRect().width;
      const slotW = w / Math.max(1, tabs.length);
      pillEl.style.width = `${slotW}px`;
      pillEl.style.transform = `translate3d(${frac * slotW * dirSign}px, 0, 0) scale(${scale})`;
      pillEl.dataset.ready = "true";
    },
    [dirSign, tabs.length],
  );

  const measure = useCallback(() => {
    const activeFrac = Math.max(0, tabs.findIndex((t) => t.id === activeId));
    writePill(activeFrac, 1);
  }, [activeId, tabs, writePill]);

  // Re-measure on: active tab change, tab set/order change (language switch,
  // Kids Mode, hide-anime), track resize (width zoom / rotation / safe area).
  useLayoutEffect(() => {
    measure();
  }, [measure, tabSig]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(track);
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, [measure]);

  // Dev check: exactly ONE indicator must exist at all times (spec requirement).
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const n = document.querySelectorAll(".dock-pill").length;
    if (n !== 1) console.error(`[glass-dock] expected exactly 1 indicator, found ${n}`);
  }, [tabSig]);

  // Auto-hide on scroll down (reveal on scroll up / near top) — mirrors the
  // floating search's behavior; opt-out via Settings → Basics.
  const [hidden, setHidden] = useState(false);
  const autoHide = settings.dockAutoHide;
  useEffect(() => {
    if (!autoHide) {
      // Reveal without a synchronous setState in the effect body (lint rule)
      const raf = requestAnimationFrame(() => setHidden(false));
      return () => cancelAnimationFrame(raf);
    }
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const dy = y - lastY;
      lastY = y;
      if (y > 120 && dy > 4) setHidden(true);
      else if (dy < -4 || y <= 120) setHidden(false);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [autoHide]);

  // ---------- press-and-drag scrub ----------
  const gestureRef = useRef<ScrubGesture | null>(null);
  const lastLitRef = useRef<HTMLButtonElement | null>(null);

  const clearLit = useCallback(() => {
    if (lastLitRef.current) {
      delete lastLitRef.current.dataset.lit;
      lastLitRef.current = null;
    }
  }, []);

  const endGesture = useCallback(() => {
    const g = gestureRef.current;
    if (g?.timer) window.clearTimeout(g.timer);
    if (g?.raf) cancelAnimationFrame(g.raf);
    gestureRef.current = null;
  }, []);

  // Kill a pending hold timer if the component unmounts mid-press.
  useEffect(() => endGesture, [endGesture]);

  /** Fractional index for a pointer clientX, measured against the LIVE track
   *  rect along the inline axis (RTL flips to right-edge-relative). */
  const fracFor = useCallback((clientX: number) => {
    const track = trackRef.current;
    const count = tabs.length;
    if (!track || count === 0) return 0;
    const rect = track.getBoundingClientRect();
    const slotW = rect.width / count;
    const pos = dirSign === -1 ? rect.right - clientX : clientX - rect.left;
    return Math.min(Math.max(pos / slotW - 0.5, 0), count - 1);
  }, [dirSign, tabs.length]);

  const applyScrubFrame = useCallback(() => {
    const g = gestureRef.current;
    const pillEl = pillElRef.current;
    if (!g || !pillEl || !g.active) return;
    g.raf = 0;
    // Eased grow inside the SAME transform write (never the standalone `scale`
    // property — that composes around the untranslated origin and amplifies
    // the translation = the old right-edge overshoot).
    const k = Math.min(1, (performance.now() - g.growT0) / SCRUB_GROW_MS);
    const s = 1 + (SCRUB_GROW - 1) * (1 - (1 - k) * (1 - k));
    const frac = fracFor(g.lastX);
    g.frac = frac;
    const track = trackRef.current;
    if (track) {
      const slotW = track.getBoundingClientRect().width / Math.max(1, tabs.length);
      pillEl.style.transform = `translate3d(${frac * slotW * dirSign}px, 0, 0) scale(${s})`;
    }
    // Live preview: nearest slot lights up, every other tab stays outlined.
    const litIdx = Math.min(Math.max(Math.round(frac), 0), g.btns.length - 1);
    const lit = g.btns[litIdx];
    if (lit && lastLitRef.current !== lit) {
      clearLit();
      lit.dataset.lit = "true";
      lastLitRef.current = lit;
    }
  }, [clearLit, dirSign, fracFor, tabs.length]);

  const scheduleScrubFrame = useCallback(() => {
    const g = gestureRef.current;
    if (!g || g.raf) return;
    g.raf = requestAnimationFrame(applyScrubFrame);
  }, [applyScrubFrame]);

  const enterScrub = useCallback(
    (clientX: number, pointerId: number) => {
      const track = trackRef.current;
      const pillEl = pillElRef.current;
      const g = gestureRef.current;
      if (!track || !pillEl || !g || g.active) return;
      const btns = Array.from(track.querySelectorAll<HTMLButtonElement>(".dock-tab"));
      if (btns.length < 2) return;
      g.active = true;
      g.id = pointerId;
      g.lastX = clientX;
      g.growT0 = performance.now();
      g.frac = fracFor(clientX);
      g.samples = [{ t: performance.now(), x: clientX }];
      g.btns = btns;
      // Seed the pill at the pointer position synchronously (scrub-start frame).
      applyScrubFrame();
      try {
        track.setPointerCapture(pointerId); // drag keeps working outside the bar
      } catch {
        /* best-effort (synthetic pointers etc.) */
      }
      setScrubbing(true);
      // Subtle haptic tick where supported (Android/Chrome; iOS Safari no-ops).
      try {
        navigator.vibrate?.(10);
      } catch {
        /* vibration is best-effort */
      }
      scheduleScrubFrame();
    },
    [applyScrubFrame, fracFor, scheduleScrubFrame],
  );

  const onTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (gestureRef.current) return; // a gesture is already in flight (multi-touch ignored)
    const g: ScrubGesture = {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      timer: null,
      raf: 0,
      active: false,
      growT0: 0,
      frac: 0,
      slotW: 0,
      dirSign: 1,
      samples: [],
      btns: [],
    };
    gestureRef.current = g;
    g.timer = window.setTimeout(() => {
      if (gestureRef.current === g && !g.active) enterScrub(g.lastX, g.id);
    }, SCRUB_HOLD_MS);
  };

  const onTrackPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gestureRef.current;
    if (!g || e.pointerId !== g.id) return;
    if (!g.active) {
      if (Math.hypot(e.clientX - g.startX, e.clientY - g.startY) > SCRUB_MOVE_PX) {
        if (g.timer) {
          window.clearTimeout(g.timer);
          g.timer = null;
        }
        enterScrub(e.clientX, e.pointerId);
      }
      return;
    }
    g.lastX = e.clientX;
    const now = performance.now();
    g.samples.push({ t: now, x: e.clientX });
    if (g.samples.length > 6) g.samples.shift();
    scheduleScrubFrame();
  };

  const onTrackPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gestureRef.current;
    if (!g || e.pointerId !== g.id) return;
    if (!g.active) {
      // Plain tap: hand the gesture back untouched — the button's own onClick
      // (and the browser's synthesized click) still handles it.
      endGesture();
      return;
    }
    const frac = fracFor(g.lastX);
    let target = Math.min(Math.max(Math.round(frac), 0), tabs.length - 1);
    // Release velocity flick: a fast physical-direction drag advances one
    // extra tab in the inline direction (physical right = +1 index in LTR,
    // -1 in RTL). Samples older than 120ms are ignored.
    const now = performance.now();
    const recent = g.samples.filter((s) => now - s.t <= 120);
    if (recent.length >= 2) {
      const a = recent[0];
      const b = recent[recent.length - 1];
      const dt = b.t - a.t;
      const v = dt > 0 ? (b.x - a.x) / dt : 0;
      if (Math.abs(v) > FLICK_PX_MS) target = Math.min(Math.max(target + Math.sign(v) * dirSign, 0), tabs.length - 1);
    }
    const targetTab = tabs[target];
    // Resume the CSS transition BEFORE the snap write: drop data-scrub in the
    // DOM now (React's render follows with the same state) so the release
    // snap animates with the existing 350ms easing from the dragged position.
    delete trackRef.current?.dataset.scrub;
    endGesture();
    clearLit();
    setScrubbing(false);
    if (targetTab) {
      writePill(target, 1); // animates into place (grow eases back inside the transform)
      if (targetTab.id !== activeId) {
        resetTo({ kind: "view", view: targetTab.view });
      }
    }
    measure(); // reconcile with the (possibly async) navigation once it lands
  };

  const onTrackPointerCancel = useCallback(() => {
    const g = gestureRef.current;
    if (!g) return;
    const wasScrub = g.active;
    endGesture();
    clearLit();
    if (wasScrub) {
      // Nothing was navigated mid-scrub — the still-current tab IS the
      // "current tab": snap the pill back to it via the normal transition.
      delete trackRef.current?.dataset.scrub;
      setScrubbing(false);
      measure();
    }
  }, [endGesture, clearLit, measure]);

  const onTrackLostPointerCapture = useCallback(() => {
    // Safety net: capture lost mid-scrub (element removed, etc.) behaves like
    // pointercancel. The auto-release after pointerup arrives with
    // gestureRef already cleared, so it no-ops there.
    if (gestureRef.current?.active) onTrackPointerCancel();
  }, [onTrackPointerCancel]);

  // Keyboard roving: Arrow keys move focus + activation across the tabs
  // (direction-aware for RTL — follows the VISUAL direction), Home/End jump
  // to the first/last tab.
  const onTrackKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "Home" && e.key !== "End") return;
    const track = trackRef.current;
    if (!track) return;
    const buttons = Array.from(track.querySelectorAll<HTMLButtonElement>(".dock-tab"));
    if (buttons.length === 0) return;
    const current = buttons.findIndex((b) => b === document.activeElement);
    const rtl = document.documentElement.dir === "rtl";
    e.preventDefault();
    let next = current;
    if (e.key === "Home") next = 0;
    else if (e.key === "End") next = buttons.length - 1;
    else {
      const delta = (e.key === "ArrowRight" ? 1 : -1) * (rtl ? -1 : 1);
      next = current < 0 ? 0 : (current + delta + buttons.length) % buttons.length;
    }
    const btn = buttons[next];
    btn?.focus();
    const tab = tabs[next];
    if (tab) resetTo({ kind: "view", view: tab.view });
  };

  return (
    <nav
      className="glass-dock"
      data-hidden={hidden ? "true" : undefined}
      aria-hidden={hidden || undefined}
      aria-label="Primary navigation"
    >
      <div
        ref={trackRef}
        className="dock-track"
        role="tablist"
        aria-label="Primary"
        data-scrub={scrubbing ? "true" : undefined}
        onPointerDown={onTrackPointerDown}
        onPointerMove={onTrackPointerMove}
        onPointerUp={onTrackPointerUp}
        onPointerCancel={onTrackPointerCancel}
        onLostPointerCapture={onTrackLostPointerCapture}
        onKeyDown={onTrackKeyDown}
      >
        {/* THE single indicator — React renders it bare; all styling is
            DOM-owned (see writePill) so no render can duplicate/ghost it. */}
        <span ref={pillElRef} className="dock-pill" aria-hidden />
        {tabs.map((tab) => (
          <DockTabButton key={tab.id} tab={tab} active={tab.id === activeId} lang={lang} />
        ))}
      </div>
    </nav>
  );
}

function DockTabButton({ tab, active, lang }: { tab: DockTab; active: boolean; lang: string }) {
  const resetTo = useNav((s) => s.resetTo);
  const Icon = tab.icon;
  const label = dockTabLabel(tab, lang);
  return (
    <button
      type="button"
      data-tab={tab.id}
      role="tab"
      aria-selected={active}
      aria-current={active ? "page" : undefined}
      title={label}
      onClick={() => resetTo({ kind: "view", view: tab.view })}
      className={cn("dock-tab md-state harbor-tv-focus")}
    >
      <span className="dock-icon-frame" aria-hidden>
        <Icon className="dock-icon-outline" strokeWidth={1.8} />
        <Icon className="dock-icon-filled" fill="currentColor" strokeWidth={1} />
      </span>
      <span className="sr-only">{label}</span>
    </button>
  );
}
