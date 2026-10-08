"use client";

// Harbor Web — floating glass bottom navigation (sidebar replacement)
// Design spec (Figma-derived): stadium glass capsule, 4 equal flex slots,
// one shared highlight pill that slides between tabs (350ms
// cubic-bezier(0.2,0,0,1)), icon outline→filled cross-fade (150ms), pressed
// scale(0.96) + M3 state layer. All visual values live in the --nav-* tokens
// in globals.css; this component only wires behavior.
//  - Active tab detection: Settings stays lit on every page moved under it
//    (Discover, Library, Addons, …) by walking the nav stack down to the
//    nearest view frame — pure presentation, no business-logic change.
//  - Kids Mode: only Home + Kids tabs (stricter than the old sidebar).
//  - Player: not rendered at all (app-shell showChrome), never overlaps the
//    player controls or the subtitle layer.
//  - Auto-hide on scroll down / reveal on scroll up (settings.dockAutoHide).
//  - ARIA: <nav> landmark, aria-current="page", sr-only labels + native
//    tooltips, roving arrow-key navigation, TV focus rings.
//  - RTL: the flex row mirrors via dir=rtl; the pill position is measured
//    from offsetLeft so it follows the mirror with no extra math.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNav, useSettings, type Frame, type View } from "@/lib/harbor/store";
import { dockTabsFor, dockTabLabel, type DockTab, type DockTabId } from "./nav-items";
import { cn } from "@/lib/utils";

/** Map any view id to the dock tab that represents it. Every hub destination
 *  (discover/catalogs/movies/shows/live/calendar/library/addons/wrapped) maps
 *  to Settings so the tab stays highlighted while browsing those pages. */
function tabIdForView(view: View): DockTabId {
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

function activeTabId(stack: Frame[]): DockTabId {
  for (let i = stack.length - 1; i >= 0; i--) {
    const f = stack[i];
    if (f.kind === "view") return tabIdForView(f.view);
  }
  // Detail/grid/player frames on top: fall back to the deepest view frame's
  // tab (handled above), or Home when the stack is somehow empty.
  return "home";
}

// ---------- press-and-drag scrub (pointer enhancement; taps untouched) ----------
// Enter scrub on a ≥250ms hold OR a >8px move while pressed. The pill then
// follows the pointer in real pixels (clamped inside the track, transitions
// off), the tab under the pointer lights as a PREVIEW (data-lit), and release
// commits exactly ONE navigation to that zone + snaps the pill with the
// normal 350ms transition. pointercancel snaps back to the still-active tab.
// Capture only engages when scrub starts, so a quick tap still lands as a
// real click on the button (tap logic untouched).
const SCRUB_HOLD_MS = 250;
const SCRUB_MOVE_PX = 8;

type ScrubTab = { el: HTMLButtonElement; tab: DockTab; left: number; width: number };

type ScrubGesture = {
  id: number;
  startX: number;
  startY: number;
  lastX: number;
  timer: number | null;
  raf: number;
  active: boolean; // scrub mode entered
  trackW: number;
  pillW: number;
  zone: number;
  tabs: ScrubTab[];
};

/** Physical-zone lookup via each tab's offsetLeft/offsetWidth — works in RTL
 *  and any future non-uniform layout without mirroring math. */
function zoneAt(tabs: ScrubTab[], px: number): number {
  if (px < 0) return 0;
  for (let i = 0; i < tabs.length; i++) {
    const t = tabs[i];
    if (px >= t.left && px < t.left + t.width) return i;
  }
  return tabs.length - 1;
}

export function GlassDock() {
  const settings = useSettings((s) => s.settings);
  const stack = useNav((s) => s.stack);
  const resetTo = useNav((s) => s.resetTo);

  const tabs = dockTabsFor(settings);
  const activeId = activeTabId(stack);
  const lang = settings.uiLanguage || "en";

  // Sliding pill measurement — physical offsetLeft works in both LTR/RTL.
  const trackRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null);

  const measure = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const btn = track.querySelector<HTMLButtonElement>(`[data-tab="${activeId}"]`);
    if (!btn) return;
    setPill({ x: btn.offsetLeft, w: btn.offsetWidth });
  }, [activeId]);

  useLayoutEffect(() => {
    measure();
  }, [measure, tabs.length]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

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
  const pillElRef = useRef<HTMLSpanElement>(null);
  const [scrubbing, setScrubbing] = useState(false);
  /** Pill x captured ONCE at scrub start — keeps the React-rendered style
   *  agreeable with the per-frame DOM writes that own the position during a
   *  scrub (mid-scrub pointermove frames heal any stale render instantly). */
  const [scrubX, setScrubX] = useState<number | null>(null);
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

  const applyScrubFrame = useCallback(() => {
    const g = gestureRef.current;
    const pillEl = pillElRef.current;
    const track = trackRef.current;
    if (!g || !pillEl || !track || !g.active) return;
    g.raf = 0;
    const rect = track.getBoundingClientRect(); // read before write (no thrash)
    const px = g.lastX - rect.left; // pointer x in track-local real pixels
    const x = Math.min(Math.max(px - g.pillW / 2, 0), Math.max(0, g.trackW - g.pillW));
    pillEl.style.transform = `translateX(${x}px)`; // transition is off via [data-scrub]
    const zone = zoneAt(g.tabs, px);
    if (zone !== g.zone) {
      g.zone = zone;
      const t = g.tabs[zone];
      if (t && lastLitRef.current !== t.el) {
        clearLit();
        t.el.dataset.lit = "true";
        lastLitRef.current = t.el;
      }
    }
  }, [clearLit]);

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
      const rect = track.getBoundingClientRect();
      g.active = true;
      g.id = pointerId;
      g.lastX = clientX;
      g.trackW = rect.width;
      g.pillW = pillEl.offsetWidth || 1;
      g.zone = tabs.findIndex((t) => t.id === activeId); // no redundant lit on the real active tab
      g.tabs = tabs
        .map((tab, i) => ({ tab, el: btns[i], left: btns[i]?.offsetLeft ?? 0, width: btns[i]?.offsetWidth ?? 0 }))
        .filter((t) => t.el);
      // Seed the pill at the pointer position synchronously AND via state so
      // the scrub-start render agrees with the immediate DOM write.
      const x0 = Math.min(Math.max(clientX - rect.left - g.pillW / 2, 0), Math.max(0, g.trackW - g.pillW));
      pillEl.style.transform = `translateX(${x0}px)`;
      setScrubX(x0);
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
    [activeId, tabs, scheduleScrubFrame],
  );

  const onTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (gestureRef.current) return; // a gesture is already in flight
    const g: ScrubGesture = {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      timer: null,
      raf: 0,
      active: false,
      trackW: 0,
      pillW: 0,
      zone: -1,
      tabs: [],
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
    // Commit: ONE navigation to the zone under the release point + snap the
    // pill there with the existing 350ms transition (scrubbing=false restores
    // it; setPill animates from the last per-frame position).
    const x = g.lastX - (trackRef.current?.getBoundingClientRect().left ?? 0);
    const target = g.tabs[zoneAt(g.tabs, x)];
    endGesture();
    clearLit();
    setScrubX(null);
    setScrubbing(false);
    if (target) {
      setPill({ x: target.el.offsetLeft, w: target.el.offsetWidth });
      resetTo({ kind: "view", view: target.tab.view });
    }
  };

  const onTrackPointerCancel = useCallback(() => {
    const g = gestureRef.current;
    if (!g) return;
    const wasScrub = g.active;
    endGesture();
    clearLit();
    if (wasScrub) {
      // Nothing was navigated mid-scrub — the still-current tab IS the
      // "current tab": snap the pill back to it via the normal measure.
      setScrubbing(false);
      setScrubX(null);
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
  // (direction-aware for RTL), Home/End jump to the first/last tab.
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
        <span
          ref={pillElRef}
          className="dock-pill"
          aria-hidden
          style={
            pill
              ? {
                  transform: `translateX(${scrubbing && scrubX !== null ? scrubX : pill.x}px)`,
                  width: `${pill.w}px`,
                  opacity: 1,
                }
              : { opacity: 0 }
          }
        />
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
