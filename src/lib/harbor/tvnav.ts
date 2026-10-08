// Harbor Web — TV spatial navigation engine.
// Arrow keys move DOM focus between visible, interactive elements using a
// nearest-neighbor-in-direction algorithm (primary-axis distance weighted with
// cross-axis offset). Activates only after the user navigates by keyboard —
// mouse use silently disables it (html[data-tv]), matching Harbor's TV polish.
"use client";

import { useNav } from "./store";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  'input:not([type="hidden"]):not([disabled])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

type Dir = "left" | "right" | "up" | "down";

const KEY_DIRS: Record<string, Dir> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
};

type Candidate = { el: HTMLElement; x: number; y: number; w: number; h: number };

function collectCandidates(): Candidate[] {
  const els = document.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
  const out: Candidate[] = [];
  for (const el of els) {
    // Skip anything inside aria-hidden subtrees (hidden frames, inactive overlays)
    if (el.closest("[aria-hidden='true']")) continue;
    // Skip disabled / non-visual widgets
    if (el.getAttribute("aria-disabled") === "true") continue;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    // Must be at least partially on screen (viewport, vertically generous for rails)
    if (r.bottom < 0 || r.top > window.innerHeight) continue;
    out.push({ el, x: r.left, y: r.top, w: r.width, h: r.height });
  }
  return out;
}

function centerX(c: Candidate): number {
  return c.x + c.w / 2;
}
function centerY(c: Candidate): number {
  return c.y + c.h / 2;
}

function isInDir(cur: Candidate, nxt: Candidate, dir: Dir): boolean {
  switch (dir) {
    case "left":
      return centerX(nxt) < cur.x + cur.w * 0.4;
    case "right":
      return centerX(nxt) > cur.x + cur.w * 0.6;
    case "up":
      return centerY(nxt) < cur.y + cur.h * 0.4;
    case "down":
      return centerY(nxt) > cur.y + cur.h * 0.6;
  }
}

function score(cur: Candidate, nxt: Candidate, dir: Dir): number {
  const dx = centerX(nxt) - centerX(cur);
  const dy = centerY(nxt) - centerY(cur);
  const primary = dir === "left" || dir === "right" ? Math.abs(dx) : Math.abs(dy);
  const cross = dir === "left" || dir === "right" ? Math.abs(dy) : Math.abs(dx);
  // Overlap bonus on the cross axis: prefer items aligned in a row/column
  const overlap =
    dir === "left" || dir === "right"
      ? Math.max(0, Math.min(cur.y + cur.h, nxt.y + nxt.h) - Math.max(cur.y, nxt.y))
      : Math.max(0, Math.min(cur.x + cur.w, nxt.x + nxt.w) - Math.max(cur.x, nxt.x));
  const crossPenalty = Math.max(0, cross - overlap);
  return primary + crossPenalty * 2.5;
}

function findNext(current: HTMLElement | null, dir: Dir): HTMLElement | null {
  const candidates = collectCandidates();
  if (candidates.length === 0) return null;

  // Entry point: no focus yet -> focus first/last sensible element
  if (!current || current === document.body) {
    const sorted =
      dir === "down" || dir === "right"
        ? candidates.sort((a, b) => a.y - b.y || a.x - b.x)
        : candidates.sort((a, b) => b.y - a.y || b.x - a.x);
    return sorted[0]?.el ?? null;
  }

  const r = current.getBoundingClientRect();
  const cur: Candidate = { el: current, x: r.left, y: r.top, w: r.width, h: r.height };

  let best: Candidate | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const c of candidates) {
    if (c.el === current || c.el.contains(current) || current.contains(c.el)) continue;
    if (!isInDir(cur, c, dir)) continue;
    const s = score(cur, c, dir);
    if (s < bestScore) {
      bestScore = s;
      best = c;
    }
  }
  return best?.el ?? null;
}

export function installTvNavigation(): () => void {
  const onKey = (e: KeyboardEvent) => {
    const dir = KEY_DIRS[e.key];
    if (!dir || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;

    const target = e.target as HTMLElement | null;
    if (!target) return;
    const tag = target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) {
      return; // let native caret/option handling work
    }
    // Never fight the player overlay (it owns arrow keys for seeking)
    if (useNav.getState().top()?.kind === "player") return;
    // Don't hijack native controls mid-interaction (open selects, sliders)
    if (tag === "BUTTON" && target.getAttribute("role") === "combobox") return;

    const next = findNext(document.activeElement as HTMLElement | null, dir);
    if (next) {
      e.preventDefault();
      document.documentElement.dataset.tv = "on";
      next.focus({ preventScroll: true });
      next.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    }
  };

  const onMouseMove = () => {
    if (document.documentElement.dataset.tv === "on") {
      document.documentElement.dataset.tv = "off";
    }
  };

  window.addEventListener("keydown", onKey);
  window.addEventListener("mousemove", onMouseMove, { passive: true });
  return () => {
    window.removeEventListener("keydown", onKey);
    window.removeEventListener("mousemove", onMouseMove);
  };
}
