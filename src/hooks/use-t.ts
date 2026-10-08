"use client";

// Harbor Web — i18n hook. Binds the app-wide t() dictionary (lib/harbor/i18n)
// to the live settings.uiLanguage so translated components re-render on
// language switch. Kept in its own file so lib/ modules never import the
// zustand store (no cycles).
import { useMemo } from "react";
import { useSettings } from "@/lib/harbor/store";
import { formatNumber, formatTimeAgo, t, type AppStringKey } from "@/lib/harbor/i18n";

export function useLang(): string {
  return useSettings((s) => s.settings.uiLanguage || "en");
}

export interface T {
  (key: AppStringKey, vars?: Record<string, string | number>): string;
  /** Latin-digit number formatting bound to the active locale. */
  num(n: number): string;
  /** Intl.RelativeTimeFormat "منذ 8 دقائق" / "8 minutes ago". */
  ago(ms: number): string;
  /** Resolved language tag (for Intl / dir-aware Intl calls). */
  lang: string;
}

/** Returns a `t(key, vars)` function bound to the current UI language. */
export function useT(): T {
  const lang = useLang();
  return useMemo(() => makeT(lang), [lang]);
}

/** Build the bound translator (Object.assign — no post-hoc mutation). */
function makeT(lang: string): T {
  return Object.assign(
    (key: AppStringKey, vars?: Record<string, string | number>) => t(key, lang, vars),
    {
      num: (n: number) => formatNumber(n, lang),
      ago: (ms: number) => formatTimeAgo(ms, lang),
      lang,
    },
  ) as T;
}
