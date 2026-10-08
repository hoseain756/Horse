"use client";

// Harbor Web — page header for pages moved under the Settings hub.
// Renders a compact top app bar: Back button (pops the nav stack back to
// Settings, or resets to Settings when entered directly) + breadcrumb-style
// context ("Settings > Library"). RTL-safe (chevrons rotate with dir).
import { ChevronLeft } from "lucide-react";
import { useNav } from "@/lib/harbor/store";
import type { View } from "@/lib/harbor/store";
import { useSettings } from "@/lib/harbor/store";
import { HUB_ENTRIES, hubLabel } from "./nav-items";

export function PageHeader({ view }: { view: View }) {
  const stack = useNav((s) => s.stack);
  const pop = useNav((s) => s.pop);
  const resetTo = useNav((s) => s.resetTo);
  const lang = useSettings((s) => s.settings.uiLanguage || "en");

  const entry = HUB_ENTRIES.find((e) => e.view === view);
  const title = entry ? hubLabel(entry, lang) : String(view);
  const parentLabel = /^ar(-|_|$)/i.test(lang) ? "الإعدادات" : "Settings";
  const canPop = stack.length > 1;

  return (
    <header className="pt-20 md:pt-14 pb-1" data-hub-page={entry?.id}>
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          onClick={() => (canPop ? pop() : resetTo({ kind: "view", view: "settings" }))}
          className="md-icon-btn md-state harbor-tv-focus shrink-0 !w-11 !h-11 text-ink-muted hover:!text-ink"
          aria-label={/^ar(-|_|$)/i.test(lang) ? "رجوع" : "Back"}
        >
          <ChevronLeft className="w-5 h-5 rtl:rotate-180" />
        </button>
        <nav aria-label="Breadcrumb" className="min-w-0">
          <ol className="flex items-center gap-1.5 min-w-0">
            <li className="shrink-0">
              <button
                type="button"
                onClick={() => resetTo({ kind: "view", view: "settings" })}
                className="md-state rounded-full px-1.5 py-0.5 md-body-small text-ink-subtle hover:text-ink transition-colors"
              >
                {parentLabel}
              </button>
            </li>
            <li aria-hidden className="text-ink-subtle shrink-0">
              <ChevronLeft className="w-3.5 h-3.5 rtl:rotate-180" />
            </li>
            <li className="min-w-0">
              <h1 className="md-title-medium font-display font-bold text-ink truncate">{title}</h1>
            </li>
          </ol>
        </nav>
      </div>
    </header>
  );
}
