"use client";

// Harbor Web — episodes toolbar (episodes rebuild)
// One row: [Season dropdown] · [Sort chip] · [List/Grid segmented toggle].
// Everything wears the shared glass recipe; controls are ≥48dp touch targets,
// tooltip'd, and exposed to AT (aria-pressed on the toggle segments).
import { List, LayoutGrid, ArrowDownUp } from "lucide-react";
import { SeasonDropdown, type SeasonOption } from "./season-dropdown";

export type EpisodesViewMode = "list" | "grid";

export function EpisodesToolbar({
  seasonOptions,
  season,
  onSeasonChange,
  singleSeasonLabel,
  selectLabel,
  sortDesc,
  onToggleSort,
  sortLabel,
  view,
  onViewChange,
  viewListLabel,
  viewGridLabel,
  layoutLabel,
}: {
  seasonOptions: SeasonOption[];
  season: number | null;
  onSeasonChange: (s: number) => void;
  /** Shown instead of the dropdown when the title has a single season. */
  singleSeasonLabel: string;
  selectLabel: string;
  sortDesc: boolean;
  onToggleSort: () => void;
  sortLabel: string;
  view: EpisodesViewMode;
  onViewChange: (v: EpisodesViewMode) => void;
  viewListLabel: string;
  viewGridLabel: string;
  layoutLabel: string;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {seasonOptions.length > 1 ? (
        <SeasonDropdown
          options={seasonOptions}
          value={season}
          onChange={onSeasonChange}
          selectLabel={selectLabel}
        />
      ) : (
        <span className="md-label-large text-ink-muted">{singleSeasonLabel}</span>
      )}

      <div className="ms-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleSort}
          title={sortLabel}
          className="md-chip md-state harbor-tv-focus !h-12 !px-4"
        >
          <ArrowDownUp className="h-4 w-4" aria-hidden />
          {sortLabel}
        </button>

        <div
          role="group"
          aria-label={layoutLabel}
          className="glass-surface flex items-center gap-0.5 rounded-full p-1"
        >
          <button
            type="button"
            onClick={() => onViewChange("list")}
            aria-pressed={view === "list"}
            title={viewListLabel}
            aria-label={viewListLabel}
            className={`md-state harbor-tv-focus flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
              view === "list"
                ? "bg-[var(--glass-active-fill)] text-[var(--md-sys-color-primary)]"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            <List className="h-5 w-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => onViewChange("grid")}
            aria-pressed={view === "grid"}
            title={viewGridLabel}
            aria-label={viewGridLabel}
            className={`md-state harbor-tv-focus flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
              view === "grid"
                ? "bg-[var(--glass-active-fill)] text-[var(--md-sys-color-primary)]"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            <LayoutGrid className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
