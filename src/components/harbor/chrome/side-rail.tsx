"use client";

// Harbor Web — floating glass SIDE navigation (large screens ≥1024px only).
//
// A1 (owner revision — replaces the always-visible rail + expand toggle):
// The rail has ONE form — the compact glass capsule with the tab icons — and
// it is HIDDEN at the inline-start edge (right edge in Arabic, left in
// English) by default, leaving only a 4×48dp glass edge handle so the
// surface is discoverable. It reveals on intent and hides when intent ends:
//
//  Reveal triggers
//   - Pointer enters a thin hot zone along that edge (24dp wide, covering the
//     rail's vertical span ±80dp) with an ~80ms hover-intent delay; the delay
//     plus the ~700ms leave grace is the hysteresis (boundary sweeps cannot
//     flicker). Detected with a document-level pointermove probe — the hot
//     zone is NOT an element, so it can never block page controls or the
//     scrollbar.
//   - Keyboard focus reaches any rail item (focusin) — items always stay in
//     the tab order, hidden or not.
//   - Touch/pen: tap on the edge handle (edge swipes are reserved by some
//     browsers for back navigation, so the tap is the reliable path). A tap
//     outside the rail hides it again.
//   - TV/D-pad: spatial navigation moves focus onto the rail items → the
//     focusin trigger above reveals it.
//
//  Hide triggers
//   - ~700ms after the pointer leaves the rail and hot zone
//   - ~600ms after selecting a destination (click or drag-scrub commit)
//   - immediately on Esc (rail focus is released too)
//   - never while a rail item has keyboard focus, while the indicator is
//     being scrubbed, or while a tooltip is shown
//
//  Motion: transform + opacity only (~280ms, the shared glass easing);
//  reduced-motion gets a pure fade (no translate). While hidden the capsule
//  is pointer-events:none — it cannot intercept clicks.
//
//  Labels appear as glass TOOLTIPS beside the hovered/focused icon (plus
//  aria-labels on the buttons) — there is no expanded/labelled menu anymore.
//
// Everything else is the SAME single-source navigation as before:
//  - Tabs: the dock's config array + per-locale order (dockTabsFor) mapped
//    start→end → top→bottom (a flex column is top-to-bottom in LTR and RTL).
//  - Active tab: the SAME activeTabId() stack walk (exported from
//    glass-dock) — Settings stays lit on moved pages, Kids Mode keeps only
//    Home + Kids, and the rail is not rendered in the player (app-shell).
//  - Indicator: exactly ONE .rail-pill (dev check asserts it), DOM-owned —
//    React renders a bare <span>; every position write is a direct transform
//    write so re-renders can never spawn a ghost state.
//  - Press-and-drag scrub: ≥250ms hold OR >6px move enters scrub; fractional
//    pill follows the pointer clamped inside the capsule; nearest slot lights
//    as preview; a fast flick advances one extra tab; pointercancel snaps
//    back; taps land as real clicks. The grow lives INSIDE the same
//    translate3d scale write.
//  - Keyboard: roving ArrowUp/ArrowDown (Home/End), Enter/Space activates.
//
// All visual values live in the --rail-* / --side-safe-inset tokens
// (globals.css); glass colors come from the shared --glass-* set.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNav, useSettings } from "@/lib/harbor/store";
import { activeTabId } from "./glass-dock";
import { dockTabsFor, dockTabLabel, type DockTab } from "./nav-items";
import { cn } from "@/lib/utils";

// ---------- reveal/hide timing (A1) ----------
const INTENT_MS = 80; // hover-intent delay before revealing from the hot zone
const LEAVE_MS = 700; // grace after the pointer leaves rail + hot zone
const SELECT_MS = 600; // grace after selecting a destination
const HOT_ZONE_PX = 24; // thin hot-zone width from the inline-start edge
const SPAN_MARGIN_PX = 80; // hot zone extends this far beyond the rail span

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
  const stack = useNav((s) => s.stack);
  const resetTo = useNav((s) => s.resetTo);

  const lang = settings.uiLanguage || "en";
  const rtl = /^ar(-|_|$)/i.test(lang);
  const autoHide = settings.railAutoHide !== false; // optional Setting: auto-hide (default) / always visible
  const tabs = dockTabsFor(settings, lang);
  const activeId = activeTabId(stack);
  const tabSig = useMemo(() => tabs.map((t) => t.id).join("|"), [tabs]);

  const navRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const pillElRef = useRef<HTMLSpanElement>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const scrubbingRef = useRef(false);
  const setScrubbingSafe = useCallback((v: boolean) => {
    scrubbingRef.current = v;
    setScrubbing(v);
  }, []);

  // ---------- A1 reveal state ----------
  const autoHideRef = useRef(autoHide);
  autoHideRef.current = autoHide;
  const [revealed, setRevealed] = useState(!autoHide);
  const revealedRef = useRef(revealed);
  revealedRef.current = revealed;
  // Set after a selection-hide so a resting pointer does not instantly
  // re-reveal (hysteresis); cleared the next time the pointer leaves the zone.
  const suppressHoverRef = useRef(false);
  const intentTimer = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);
  const tooltipTimer = useRef<number | null>(null);
  const [tooltip, setTooltip] = useState<{ label: string; top: number } | null>(null);
  const tooltipRef = useRef(false);
  tooltipRef.current = tooltip !== null;

  const clearTimers = useCallback(() => {
    if (intentTimer.current) window.clearTimeout(intentTimer.current);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    intentTimer.current = null;
    hideTimer.current = null;
  }, []);

  const cancelHide = useCallback(() => {
    if (hideTimer.current) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const reveal = useCallback(() => {
    cancelHide();
    suppressHoverRef.current = false;
    if (!revealedRef.current) {
      revealedRef.current = true;
      setRevealed(true);
    }
  }, [cancelHide]);

  /** Hide unless something owns the surface (focus / scrub / tooltip). */
  const hideNow = useCallback((force = false) => {
    const nav = navRef.current;
    if (!force) {
      if (scrubbingRef.current || tooltipRef.current) return;
      if (nav && nav.contains(document.activeElement)) return;
    }
    if (hideTimer.current) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    if (revealedRef.current) {
      revealedRef.current = false;
      setRevealed(false);
      setTooltip(null);
    }
  }, []);

  const scheduleHide = useCallback(
    (ms: number) => {
      if (!autoHideRef.current) return;
      cancelHide();
      // Null the id BEFORE hideNow runs: if hideNow early-returns (tooltip /
      // focus / scrub guard), the stale id must never block a later
      // scheduleHide — the next pointermove/leave simply re-arms the grace.
      hideTimer.current = window.setTimeout(() => {
        hideTimer.current = null;
        hideNow();
      }, ms);
    },
    [cancelHide, hideNow],
  );

  /** Selection commit → hide after the ~600ms grace (A1). */
  const onDestinationSelected = useCallback(() => {
    if (!autoHideRef.current) return;
    suppressHoverRef.current = true;
    scheduleHide(SELECT_MS);
  }, [scheduleHide]);

  // Pointer probe: NO overlay element — a document-level pointermove probe
  // means the hot zone can never block page controls or the scrollbar.
  useEffect(() => {
    if (!autoHide) return; // "always visible" mode: no probe, no handle, no hide
    let raf = 0;
    let last: { x: number; y: number; type: string } | null = null;

    const process = () => {
      raf = 0;
      const ev = last;
      last = null;
      const nav = navRef.current;
      if (!ev || !nav) return;
      if (ev.type === "touch") return; // touch/pen reveal = the handle tap
      const rect = nav.getBoundingClientRect();
      const vw = window.innerWidth;
      const distToEdge = rtl ? vw - ev.x : ev.x;
      const inSpan = ev.y >= rect.top - SPAN_MARGIN_PX && ev.y <= rect.bottom + SPAN_MARGIN_PX;
      const inRail =
        ev.x >= rect.left - 4 && ev.x <= rect.right + 4 && ev.y >= rect.top - 4 && ev.y <= rect.bottom + 4;
      const inHot = distToEdge <= HOT_ZONE_PX && inSpan;
      if (revealedRef.current) {
        if (inRail || inHot) {
          cancelHide();
          return;
        }
        // pointer left the rail and the hot zone → ~700ms grace (A1)
        if (!hideTimer.current && !suppressHoverRef.current) scheduleHide(LEAVE_MS);
        return;
      }
      // hidden: intent inside the hot zone reveals after ~80ms (A1)
      if (suppressHoverRef.current) {
        if (!inHot) suppressHoverRef.current = false; // left the edge → armed again
        return;
      }
      if (inHot || inRail) {
        if (intentTimer.current === null && hideTimer.current === null) {
          intentTimer.current = window.setTimeout(() => {
            intentTimer.current = null;
            reveal();
          }, INTENT_MS);
        }
      } else if (intentTimer.current !== null) {
        window.clearTimeout(intentTimer.current);
        intentTimer.current = null;
      }
    };

    const onMove = (e: PointerEvent) => {
      last = { x: e.clientX, y: e.clientY, type: e.pointerType };
      if (!raf) raf = requestAnimationFrame(process);
    };
    const onLeaveWindow = () => {
      if (revealedRef.current) scheduleHide(300);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const nav = navRef.current;
      if (nav && nav.contains(document.activeElement)) {
        (document.activeElement as HTMLElement | null)?.blur?.();
      }
      clearTimers();
      hideNow(true);
    };
    // Touch: a tap outside the rail dismisses it (touch has no pointerleave).
    const onDocPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch" || !revealedRef.current) return;
      const nav = navRef.current;
      if (nav && !nav.contains(e.target as Node)) hideNow(true);
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerdown", onDocPointerDown, true);
    document.documentElement.addEventListener("mouseleave", onLeaveWindow);
    window.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerdown", onDocPointerDown, true);
      document.documentElement.removeEventListener("mouseleave", onLeaveWindow);
      window.removeEventListener("keydown", onEsc);
      if (raf) cancelAnimationFrame(raf);
      clearTimers();
    };
  }, [autoHide, rtl, cancelHide, clearTimers, hideNow, reveal, scheduleHide]);

  // Keyboard focus anywhere in the rail reveals it (items keep tab order).
  const onNavFocusCapture = useCallback(() => {
    if (!autoHideRef.current) return;
    suppressHoverRef.current = false;
    reveal();
  }, [reveal]);

  // Focus left the rail entirely → gentle hide (never while scrubbing).
  const onNavBlurCapture = useCallback(
    (e: React.FocusEvent) => {
      if (!autoHideRef.current) return;
      const next = e.relatedTarget;
      const nav = navRef.current;
      if (next instanceof Node && nav?.contains(next)) return;
      scheduleHide(LEAVE_MS);
    },
    [scheduleHide],
  );

  // ---------- tooltip (labels live beside the icons, NOT an expanded menu) ----------
  const showTooltipFor = useCallback(
    (el: HTMLElement) => {
      if (!autoHideRef.current || !revealedRef.current) return;
      if (tooltipTimer.current) window.clearTimeout(tooltipTimer.current);
      const label = el.getAttribute("aria-label") ?? "";
      const navRect = navRef.current?.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      if (!navRect || !label) return;
      tooltipTimer.current = window.setTimeout(() => {
        setTooltip({ label, top: r.top - navRect.top + r.height / 2 });
      }, 60);
    },
    [],
  );
  const hideTooltip = useCallback(() => {
    if (tooltipTimer.current) {
      window.clearTimeout(tooltipTimer.current);
      tooltipTimer.current = null;
    }
    setTooltip(null);
  }, []);

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
      setScrubbingSafe(true);
      try {
        navigator.vibrate?.(10);
      } catch {
        /* best-effort */
      }
      scheduleScrubFrame();
    },
    [applyScrubFrame, fracFor, scheduleScrubFrame, setScrubbingSafe],
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
    setScrubbingSafe(false);
    if (targetTab) {
      writePill(target, 1);
      if (targetTab.id !== activeId) {
        resetTo({ kind: "view", view: targetTab.view });
        onDestinationSelected();
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
      setScrubbingSafe(false);
      measure();
    }
  }, [endGesture, clearLit, measure, setScrubbingSafe]);

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
    if (tab) {
      resetTo({ kind: "view", view: tab.view });
      onDestinationSelected();
    }
  };

  // Handle tap: touch/pen path (and a mouse fallback) — toggle the rail.
  const onHandleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (revealedRef.current) {
      const nav = navRef.current;
      if (nav && nav.contains(document.activeElement)) {
        (document.activeElement as HTMLElement | null)?.blur?.();
      }
      hideNow(true);
    } else {
      reveal();
    }
  };

  return (
    <nav
      ref={navRef}
      className="side-rail"
      data-hidden={autoHide && !revealed ? "true" : undefined}
      data-autohide={autoHide ? "true" : undefined}
      aria-label="Primary navigation"
      onFocusCapture={onNavFocusCapture}
      onBlurCapture={onNavBlurCapture}
    >
      {/* Edge handle — the only visible affordance while hidden (4×48dp glass
          at ~40% opacity, vertically centered at the inline-start edge). */}
      <button
        type="button"
        className="rail-handle"
        tabIndex={-1}
        aria-hidden={autoHide && !revealed ? undefined : true}
        aria-label={revealed ? "Hide navigation" : "Show navigation"}
        onClick={onHandleClick}
      />
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
            <RailTabButton
              key={tab.id}
              tab={tab}
              active={tab.id === activeId}
              lang={lang}
              onHover={showTooltipFor}
              onLeave={hideTooltip}
              onSelect={onDestinationSelected}
            />
          ))}
        </div>
      </div>
      {/* Glass tooltip beside the hovered/focused icon (labels are NOT a
          persisted expanded menu — see module comment). */}
      <span
        className={cn("rail-tooltip", tooltip ? "rail-tooltip-on" : undefined)}
        role="tooltip"
        aria-hidden={!tooltip}
        style={tooltip ? { top: tooltip.top } : undefined}
      >
        {tooltip?.label}
      </span>
    </nav>
  );
}

function RailTabButton({
  tab,
  active,
  lang,
  onHover,
  onLeave,
  onSelect,
}: {
  tab: DockTab;
  active: boolean;
  lang: string;
  onHover: (el: HTMLElement) => void;
  onLeave: () => void;
  onSelect: () => void;
}) {
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
      aria-label={label}
      onClick={() => {
        resetTo({ kind: "view", view: tab.view });
        onSelect();
      }}
      onPointerEnter={(e) => onHover(e.currentTarget)}
      onPointerLeave={onLeave}
      onFocus={(e) => onHover(e.currentTarget)}
      onBlur={onLeave}
      className={cn("rail-tab md-state harbor-tv-focus")}
    >
      <span className="rail-icon-frame" aria-hidden>
        <Icon className="rail-icon-outline" strokeWidth={1.8} />
        <Icon className="rail-icon-filled" fill="currentColor" strokeWidth={1} />
      </span>
      <span className="sr-only">{label}</span>
    </button>
  );
}
