"use client";

// Harbor Web — M3 window size classes (material.io/foundations/adaptive-design)
// compact <600 · medium 600–839 · expanded 840–1199 · large 1200–1599 ·
// extra-large ≥1600. SSR-safe: defaults to "expanded" then syncs on mount.
import { useEffect, useState } from "react";

export type WindowClass = "compact" | "medium" | "expanded" | "large" | "extraLarge";

const QUERIES: [WindowClass, number][] = [
  ["extraLarge", 1600],
  ["large", 1200],
  ["expanded", 840],
  ["medium", 600],
];

function classify(w: number): WindowClass {
  for (const [cls, min] of QUERIES) if (w >= min) return cls;
  return "compact";
}

export function useWindowClass(): WindowClass {
  const [cls, setCls] = useState<WindowClass>("expanded");
  useEffect(() => {
    const update = () => setCls(classify(window.innerWidth));
    update();
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);
  return cls;
}

/** Non-hook helper for components that compute layout in render callbacks. */
export function windowClass(): WindowClass {
  if (typeof window === "undefined") return "expanded";
  return classify(window.innerWidth);
}
