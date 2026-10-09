"use client";

// Harbor Web — floating glass SIDE navigation (large screens ≥1024px only)
// The laptop/desktop/TV face of the SAME navigation the phone gets as the
// glass dock. One shared truth, two presentations:
//  - Tabs: the SAME config array + per-locale order (dockTabsFor) — the dock's
//    inline-start→end order maps start→end → top→bottom here (a flex column is
//    always top-to-bottom in both LTR and RTL, so the array order IS the
//    visual order; no direction flip is needed on the vertical axis).
//  - Active tab: the SAME activeTabId() stack walk (exported from glass-dock)
//    — Settings stays lit on every page moved under it, Kids Mode keeps only
//    Home + Kids, and the rail is not rendered in the player (app-shell).
//  - Indicator: exactly ONE .rail-pill (dev check asserts it), DOM-owned like
//    the dock pill — React renders a bare <span>; every position write is a
//    direct transform write so re-renders can never spawn a ghost state.
//  - Press-and-drag scrub: the dock's rules adapted to the VERTICAL axis
//    (≥250ms hold OR >6px move enters scrub; fractional pill follows the
//    pointer clamped inside the capsule; nearest slot lights as preview; a
//    fast flick advances one extra tab; pointercancel snaps back; taps land
//    as real clicks). The grow lives INSIDE the same translate3d scale write
//    (the standalone `scale` property would amplify the translation — the
//    dock's old overshoot bug, avoided here by construction).
//  - Keyboard: roving ArrowUp/ArrowDown (Home/End jump), Enter/Space activates
//    (native button), focus ring via the shared .harbor-tv-focus.
//  - Bands: compact rail (1024–1599) ~80dp icons+tooltips; expanded (≥1600 or
//    the user's persisted railExpanded toggle) ~240dp icon+label rows with
//    10-foot sizing. The toggle lives at the rail's end (chevron), laptop band
//    only — persisted in settings.railExpanded.
// All visual values live in the --rail-* tokens (globals.css); glass colors
// come from the shared --glass-* set, so both navs are siblings by construction.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { useNav, useSettings } from "@/lib/harbor/store";
import { activeTabId } from "./glass-dock";
import { dockTabsFor, dockTabLabel, type DockTab } from "./nav-items";
import { cn } from "@/lib/utils";

// ---------- scrub constants (same rules as the dock, vertical axis) ----------
const SCRUB_HOLD_MS = 250;
const SCRUB_MOVE_PX = 6;
const SCRUB_GROW = 1.08;
const SCRUB_GROW_MS = 150;
const FLICK_PX_MS = 0.5;

type ScrubGesture = {
  id: number;
  startX: number;
  startY: number;
  lastY: number;
  timer: number | null;
  raf: number;
  active: boolean;
  growT0: number;
  frac: number;
  dirSign: number; // +1 down, -1 up (kept for symmetry with the dock math)
  samples: { t: number; y: number }[];
  btns: HTMLButtonElement[];
};

export function SideRail() {
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  const stack = useNav((s) => s.stack);
  const resetTo = useNav((s) => s.resetTo);

  const lang = settings.uiLanguage || "en";
  const tabs = dockTabsFor(settings, lang);
  const activeId = activeTabId(stack);
  const tabSig = useMemo(() => tabs.map((t) => t.id).join("|"), [tabs]);

  const trackRef = useRef<HTMLDivElement>(null);
  const pillElRef = useRef<HTMLSpanElement>(null);
  const [scrubbing, setScrubbing] = useState(false);

  /** Write the pill to a fractional slot. DOM-only (see module comment). */
  const writePill = useCallback(
    (frac: number, scale = 1) => {
      const track = trackRef.current;
      const pillEl = pillElRef.current;
      if (!track || !pillEl) return;
      const h = track.getBoundingClientRect().height;
      const slotH = h / Math.max(1, tabs.length);
      pillEl.style.height = `${slotH}px`;
      pillEl.style.transform = `translate3d(0, ${frac * slotH}px, 0) scale(${scale})`;
      pillEl.dataset.ready = "true";
    },
    [tabs.length],
  );

  const measure = useCallback(() => {
    const activeFrac = Math.max(0, tabs.findIndex((t) => t.id === activeId));
    writePill(activeFrac, 1);
  }, [activeId, tabs, writePill]);

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

  // Dev check: exactly ONE indicator (same requirement as the dock).
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const n = document.querySelectorAll(".rail-pill").length;
    if (n !== 1) console.error(`[side-rail] expected exactly 1 indicator, found ${n}`);
  }, [tabSig]);

  // ---------- press-and-drag scrub (vertical) ----------
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

  useEffect(() => endGesture, [endGesture]);

  const fracFor = useCallback(
    (clientY: number) => {
      const track = trackRef.current;
      const count = tabs.length;
      if (!track || count === 0) return 0;
      const rect = track.getBoundingClientRect();
      const slotH = rect.height / count;
      const pos = clientY - rect.top;
      return Math.min(Math.max(pos / slotH - 0.5, 0), count - 1);
    },
    [tabs.length],
  );

  const applyScrubFrame = useCallback(() => {
    const g = gestureRef.current;
    const pillEl = pillElRef.current;
    if (!g || !pillEl || !g.active) return;
    g.raf = 0;
    // Eased grow inside the SAME transform write (see module comment).
    const k = Math.min(1, (performance.now() - g.growT0) / SCRUB_GROW_MS);
    const s = 1 + (SCRUB_GROW - 1) * (1 - (1 - k) * (1 - k));
    const frac = fracFor(g.lastY);
    g.frac = frac;
    const track = trackRef.current;
    if (track) {
      const slotH = track.getBoundingClientRect().height / Math.max(1, tabs.length);
      pillEl.style.transform = `translate3d(0, ${frac * slotH}px, 0) scale(${s})`;
    }
    const litIdx = Math.min(Math.max(Math.round(frac), 0), g.btns.length - 1);
    const lit = g.btns[litIdx];
    if (lit && lastLitRef.current !== lit) {
      clearLit();
      lit.dataset.lit = "true";
      lastLitRef.current = lit;
    }
  }, [clearLit, fracFor, tabs.length]);

  const scheduleScrubFrame = useCallback(() => {
    const g = gestureRef.current;
    if (!g || g.raf) return;
    g.raf = requestAnimationFrame(applyScrubFrame);
  }, [applyScrubFrame]);

  const enterScrub = useCallback(
    (clientY: number, pointerId: number) => {
      const track = trackRef.current;
      const pillEl = pillElRef.current;
      const g = gestureRef.current;
      if (!track || !pillEl || !g || g.active) return;
      const btns = Array.from(track.querySelectorAll<HTMLButtonElement>(".rail-tab"));
      if (btns.length < 2) return;
      g.active = true;
      g.id = pointerId;
      g.lastY = clientY;
      g.growT0 = performance.now();
      g.frac = fracFor(clientY);
      g.samples = [{ t: performance.now(), y: clientY }];
      g.btns = btns;
      applyScrubFrame();
      try {
        track.setPointerCapture(pointerId);
      } catch {
        /* best-effort */
      }
      setScrubbing(true);
      try {
        navigator.vibrate?.(10);
      } catch {
        /* best-effort */
      }
      scheduleScrubFrame();
    },
    [applyScrubFrame, fracFor, scheduleScrubFrame],
  );

  const onTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (gestureRef.current) return;
    const g: ScrubGesture = {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastY: e.clientY,
      timer: null,
      raf: 0,
      active: false,
      growT0: 0,
      frac: 0,
      dirSign: 1,
      samples: [],
      btns: [],
    };
    gestureRef.current = g;
    g.timer = window.setTimeout(() => {
      if (gestureRef.current === g && !g.active) enterScrub(g.lastY, g.id);
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
        enterScrub(e.clientY, e.pointerId);
      }
      return;
    }
    g.lastY = e.clientY;
    const now = performance.now();
    g.samples.push({ t: now, y: e.clientY });
    if (g.samples.length > 6) g.samples.shift();
    scheduleScrubFrame();
  };

  const onTrackPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gestureRef.current;
    if (!g || e.pointerId !== g.id) return;
    if (!g.active) {
      endGesture();
      return;
    }
    const frac = fracFor(g.lastY);
    let target = Math.min(Math.max(Math.round(frac), 0), tabs.length - 1);
    // Release flick along the vertical axis: a fast downward drag advances one
    // extra tab (top→bottom order), an upward drag goes back one.
    const now = performance.now();
    const recent = g.samples.filter((s) => now - s.t <= 120);
    if (recent.length >= 2) {
      const a = recent[0];
      const b = recent[recent.length - 1];
      const dt = b.t - a.t;
      const v = dt > 0 ? (b.y - a.y) / dt : 0;
      if (Math.abs(v) > FLICK_PX_MS) target = Math.min(Math.max(target + Math.sign(v), 0), tabs.length - 1);
    }
    const targetTab = tabs[target];
    delete trackRef.current?.dataset.scrub;
    endGesture();
    clearLit();
    setScrubbing(false);
    if (targetTab) {
      writePill(target, 1);
      if (targetTab.id !== activeId) {
        resetTo({ kind: "view", view: targetTab.view });
      }
    }
    measure();
  };

  const onTrackPointerCancel = useCallback(() => {
    const g = gestureRef.current;
    if (!g) return;
    const wasScrub = g.active;
    endGesture();
    clearLit();
    if (wasScrub) {
      delete trackRef.current?.dataset.scrub;
      setScrubbing(false);
      measure();
    }
  }, [endGesture, clearLit, measure]);

  const onTrackLostPointerCapture = useCallback(() => {
    if (gestureRef.current?.active) onTrackPointerCancel();
  }, [onTrackPointerCancel]);

  // Keyboard roving: ArrowUp/ArrowDown move focus + activate (visual order =
  // DOM order top→bottom in both directions), Home/End jump to first/last.
  const onTrackKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown" && e.key !== "Home" && e.key !== "End") return;
    const track = trackRef.current;
    if (!track) return;
    const buttons = Array.from(track.querySelectorAll<HTMLButtonElement>(".rail-tab"));
    if (buttons.length === 0) return;
    const current = buttons.findIndex((b) => b === document.activeElement);
    e.preventDefault();
    let next = current;
    if (e.key === "Home") next = 0;
    else if (e.key === "End") next = buttons.length - 1;
    else if (e.key === "ArrowDown") next = current < 0 ? 0 : (current + 1) % buttons.length;
    else next = current < 0 ? buttons.length - 1 : (current - 1 + buttons.length) % buttons.length;
    const btn = buttons[next];
    btn?.focus();
    const tab = tabs[next];
    if (tab) resetTo({ kind: "view", view: tab.view });
  };

  const toggleExpanded = () => update({ railExpanded: !settings.railExpanded });

  return (
    <nav
      className="side-rail"
      data-expanded={settings.railExpanded ? "true" : undefined}
      aria-label="Primary navigation"
    >
      <div className="rail-capsule">
        <div
          ref={trackRef}
          className="rail-track"
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
          {/* THE single vertical indicator — React renders it bare; all styling
              is DOM-owned (writePill) so no render can duplicate/ghost it. */}
          <span ref={pillElRef} className="rail-pill" aria-hidden />
          {tabs.map((tab) => (
            <RailTabButton key={tab.id} tab={tab} active={tab.id === activeId} lang={lang} />
          ))}
        </div>
        {/* Expand/collapse toggle — OUTSIDE the track (the pill's slot math
            measures the tab stack only) and hidden on the TV band where the
            rail is always expanded. Native tooltip doubles as its name. */}
        <button
          type="button"
          className="rail-toggle md-state harbor-tv-focus"
          onClick={toggleExpanded}
          aria-pressed={settings.railExpanded}
          title={settings.railExpanded ? "Collapse sidebar" : "Expand sidebar"}
          aria-label={settings.railExpanded ? "Collapse sidebar" : "Expand sidebar"}
        >
          <ChevronsRight className="rail-toggle-icon rtl:rotate-180" aria-hidden />
          <ChevronsLeft className="rail-toggle-icon rail-toggle-icon-alt rtl:rotate-180" aria-hidden />
          <span className={cn("rail-toggle-label", !settings.railExpanded && "sr-only")}>
            {settings.railExpanded ? "Collapse" : "Expand"}
          </span>
        </button>
      </div>
    </nav>
  );
}

function RailTabButton({ tab, active, lang }: { tab: DockTab; active: boolean; lang: string }) {
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
      className={cn("rail-tab md-state harbor-tv-focus")}
    >
      <span className="rail-icon-frame" aria-hidden>
        <Icon className="rail-icon-outline" strokeWidth={1.8} />
        <Icon className="rail-icon-filled" fill="currentColor" strokeWidth={1} />
      </span>
      <span className="rail-label">{label}</span>
    </button>
  );
}
