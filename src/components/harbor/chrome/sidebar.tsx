"use client";

// Harbor Web — Sidebar chrome (default Harbor layout)
import { useMemo } from "react";
import { MonitorDown } from "lucide-react";
import { HarborMark } from "./brand";
import { UserChip } from "./account";
import { useNav, useSettings, useCurrentView } from "@/lib/harbor/store";
import { usePwa } from "@/lib/harbor/pwa";
import { navItemsFor, navLabel } from "./nav-items";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const settings = useSettings((s) => s.settings);
  const currentView = useCurrentView();
  const resetTo = useNav((s) => s.resetTo);
  const items = useMemo(() => navItemsFor(settings), [settings]);
  const canInstall = usePwa((s) => s.canInstall);
  const promptInstall = usePwa((s) => s.promptInstall);

  return (
    <nav
      aria-label="Primary navigation"
      className="fixed left-0 top-0 bottom-0 z-40 w-[68px] md:w-[220px] flex flex-col bg-surface/80 backdrop-blur-xl border-r border-edge-soft"
    >
      <div className="flex items-center gap-2.5 px-4 md:px-5 h-16 shrink-0">
        <HarborMark className="w-8 h-8 text-accent shrink-0" />
        <span className="hidden md:block font-display text-xl font-bold text-ink tracking-tight">
          Harbor
        </span>
      </div>

      {/* NOTE: intentionally NO search input/button here — the floating glass bar
          at the top is the single search surface (press / to focus). Previously a
          duplicate "Search…" pseudo-input lived under the logo and read as a
          second search bar. */}
      <ul className="flex-1 overflow-y-auto no-scrollbar px-3 pt-1 pb-4 space-y-1">
        {items.map((item) => {
          const active = currentView === item.id;
          const Icon = item.icon;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => resetTo({ kind: "view", view: item.id })}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "harbor-nav-item harbor-tv-focus w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "active bg-accent-soft text-ink font-semibold"
                    : "text-ink-muted hover:text-ink hover:bg-raised/60",
                )}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="hidden md:inline truncate">{navLabel(item, settings.navRenamed)}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {canInstall && (
        <button
          type="button"
          onClick={() => void promptInstall()}
          className="harbor-tv-focus mx-3 mb-2 flex items-center gap-2.5 rounded-xl border border-accent/40 bg-accent-soft px-3 py-2 text-ink transition-colors hover:border-accent"
          aria-label="Install Harbor as an app"
        >
          <MonitorDown className="w-4 h-4 text-accent shrink-0" />
          <span className="hidden md:inline text-xs font-medium">Install app</span>
        </button>
      )}

      <UserChip />

      <div className="hidden md:block px-5 pb-4 text-[11px] text-ink-subtle leading-relaxed">
        <p>Harbor Web — open-source Stremio client</p>
        <p>Not affiliated with Stremio. Bring your own addons.</p>
      </div>
    </nav>
  );
}
