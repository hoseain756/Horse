"use client";

// Harbor Web — site-wide fullscreen toggle (top chrome icon).
//
// A floating glass icon button that puts the whole site in fullscreen —
// phones: top-start corner (mirrors the search trigger at top-end);
// ≥600: top-end corner (the centered search pill leaves it free).
// Icon swaps Maximize/Minimize and follows external exits (Esc, browser UI)
// via the fullscreenchange events. Hidden entirely on engines without the
// element-fullscreen API (iPhone Safari) instead of showing a dead button.

import { useEffect, useState } from "react";
import { Maximize, Minimize } from "lucide-react";
import { useSettings } from "@/lib/harbor/store";

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

export function FullscreenButton() {
  const language = useSettings((s) => s.settings.uiLanguage || "en");
  const ar = /^ar(?:-|_|$)/i.test(language);
  const [supported, setSupported] = useState(false);
  const [isFull, setIsFull] = useState(false);

  useEffect(() => {
    const doc = document as FullscreenDocument;
    const el = document.documentElement as FullscreenElement;
    // Feature-detect AFTER mount (SSR-safe). iPhone Safari has no element
    // fullscreen — the button would be a dead control there, so it unmounts.
    const ok =
      typeof el.requestFullscreen === "function" ||
      typeof el.webkitRequestFullscreen === "function";
    if (!ok) return;
    // State writes are deferred one frame out of the effect body (no
    // synchronous setState within effects); the extra frame is imperceptible.
    const showRaf = requestAnimationFrame(() => setSupported(true));
    const sync = () =>
      setIsFull(Boolean(document.fullscreenElement || doc.webkitFullscreenElement));
    const syncRaf = requestAnimationFrame(sync);
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      cancelAnimationFrame(showRaf);
      cancelAnimationFrame(syncRaf);
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);

  if (!supported) return null;

  const toggle = () => {
    const doc = document as FullscreenDocument;
    const el = document.documentElement as FullscreenElement;
    if (document.fullscreenElement || doc.webkitFullscreenElement) {
      if (document.exitFullscreen) void document.exitFullscreen();
      else doc.webkitExitFullscreen?.();
    } else if (el.requestFullscreen) {
      void el.requestFullscreen().catch(() => {});
    } else {
      el.webkitRequestFullscreen?.();
    }
  };

  const label = isFull ? (ar ? "الخروج من ملء الشاشة" : "Exit full screen") : ar ? "ملء الشاشة" : "Full screen";
  const Icon = isFull ? Minimize : Maximize;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      aria-pressed={isFull}
      title={label}
      className="fs-full-btn md-state harbor-tv-focus fixed z-[var(--z-search-bar)] flex h-12 w-12 items-center justify-center rounded-full glass-surface text-ink min-[600px]:h-14 min-[600px]:w-14 shadow-[0_10px_36px_-12px_rgba(0,0,0,0.65),0_2px_10px_rgba(0,0,0,0.3)]"
    >
      <Icon className="h-5 w-5" aria-hidden />
    </button>
  );
}
