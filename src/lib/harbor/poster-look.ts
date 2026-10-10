// Harbor Web — poster look → CSS custom properties (Task 70 / audit F2).
// `posterScale` + `posterRadius` were half-working settings (UI rows existed,
// nothing consumed the values). This module is the SINGLE runtime writer of
// the `--poster-scale` / `--poster-radius` custom properties that the real
// poster-card CSS consumes:
//   - `.harbor-poster` border-radius ← var(--poster-radius)   (globals.css)
//   - `.harbor-poster > .harbor-poster-img` transform scale   (globals.css)
// Called from the app-shell settings effect (next to applyTheme) so both
// sliders respond live. Sanitize clamps live in settings.ts; the guards here
// are a defensive second clamp so a bad persisted value can never distort
// every card on the page.
"use client";

const SCALE_MIN = 0.6;
const SCALE_MAX = 1.6;
const RADIUS_MIN = 0;
const RADIUS_MAX = 28;

export function applyPosterLook(posterScale: number, posterRadius: number): void {
  if (typeof document === "undefined") return;
  const scale =
    typeof posterScale === "number" && Number.isFinite(posterScale)
      ? Math.min(SCALE_MAX, Math.max(SCALE_MIN, posterScale))
      : 1;
  const radius =
    typeof posterRadius === "number" && Number.isFinite(posterRadius)
      ? Math.min(RADIUS_MAX, Math.max(RADIUS_MIN, posterRadius))
      : 12;
  const root = document.documentElement.style;
  root.setProperty("--poster-scale", String(scale));
  root.setProperty("--poster-radius", `${Math.round(radius)}px`);
}
