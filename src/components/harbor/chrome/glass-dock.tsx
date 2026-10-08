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
    case "search":
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
      <div ref={trackRef} className="dock-track" role="tablist" aria-label="Primary" onKeyDown={onTrackKeyDown}>
        <span
          className="dock-pill"
          aria-hidden
          style={
            pill
              ? { transform: `translateX(${pill.x}px)`, width: `${pill.w}px`, opacity: 1 }
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
