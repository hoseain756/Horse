"use client";

// Harbor Web — list episode row (episodes rebuild, matches target image 2)
// Thumbnail at the inline-start (same overlays as the grid card), text block
// beside it: bold title (max 2 lines), meta line, story (max 2 lines).
// Thumbnail width rides the --ep-list-thumb-w token (38–42% of the row on
// phones via clamp, 220/250px on tablet/desktop from the @container ladder).
import { memo } from "react";
import { EpisodeThumbnail } from "./episode-thumbnail";
import type { EpisodeItem } from "./types";
import type { EpisodeLabels } from "./episode-card";

export type EpisodeRowProps = {
  item: EpisodeItem;
  /** Flat item index — powers roving keyboard navigation (data-ep-idx). */
  index: number;
  blurred: boolean;
  backdropUrl?: string;
  sizes: string;
  labels: EpisodeLabels;
  onPlay: (item: EpisodeItem) => void;
};

function ariaName(item: EpisodeItem, labels: EpisodeLabels): string {
  const num = `E${item.epNum}`;
  const state = item.watched
    ? labels.watchedLabel
    : item.upcoming
      ? labels.upcomingLabel
      : item.progress > 0.02
        ? `${Math.round(item.progress * 100)}%`
        : "";
  return [num, item.title, state].filter(Boolean).join(" — ");
}

function MetaLine({ item, labels }: { item: EpisodeItem; labels: EpisodeLabels }) {
  const runtime = item.runtimeMin != null ? labels.runtimeMin(item.runtimeMin) : null;
  const date = item.video.released ? labels.formatDate(item.video.released) : null;
  if (!runtime && !date) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 text-[length:var(--ep-meta-size)] leading-4 text-ink-subtle">
      <bdi dir="ltr" className="font-semibold tabular-nums">
        E{item.epNum}
      </bdi>
      {runtime && (
        <>
          <span aria-hidden>·</span>
          <span className="tabular-nums">{runtime}</span>
        </>
      )}
      {date && (
        <>
          <span aria-hidden>·</span>
          <bdi className="tabular-nums">{date}</bdi>
        </>
      )}
    </div>
  );
}

function EpisodeRowImpl({ item, index, blurred, backdropUrl, sizes, labels, onPlay }: EpisodeRowProps) {
  const common = (
    <>
      <div className="w-[var(--ep-list-thumb-w)] shrink-0">
        <EpisodeThumbnail
          thumb={item.video.thumb}
          stillPath={item.stillPath}
          backdropUrl={backdropUrl}
          episodeNumber={item.epNum}
          alt=""
          sizes={sizes}
          blurred={blurred}
          watched={item.watched}
          progress={item.progress}
          upcoming={item.upcoming}
          rating={item.rating}
          numLabel={`E${item.epNum}`}
          watchedLabel={labels.watchedLabel}
          ratingLabel={`IMDb ${item.rating?.toFixed(1) ?? ""}`}
        />
      </div>
      <div className="min-w-0 flex-1 py-1">
        <p
          dir="auto"
          style={{ unicodeBidi: "plaintext", fontSize: "var(--ep-title-size)", lineHeight: "var(--ep-title-lh)" }}
          className="harbor-clamp-2 text-start font-semibold text-ink"
        >
          <bdi>{item.title}</bdi>
        </p>
        <div className="mt-1.5">
          <MetaLine item={item} labels={labels} />
        </div>
        {item.story && (
          <p
            dir="auto"
            style={{ unicodeBidi: "plaintext", fontSize: "var(--ep-story-size)" }}
            className="harbor-clamp-2 mt-2 text-start leading-snug text-ink-muted"
          >
            {item.story}
          </p>
        )}
        {item.upcoming && (
          <span className="md-chip md-label-small pointer-events-none mt-2 !h-6 cursor-default!">
            {labels.upcomingLabel}
          </span>
        )}
      </div>
    </>
  );

  if (item.upcoming) {
    // Future episode: dimmed, shows the air date, NOT playable (behavior kept).
    // The "Upcoming" state is conveyed through the accessible name.
    return (
      <div
        role="listitem"
        aria-label={ariaName(item, labels)}
        className="flex w-full select-none items-center gap-3 rounded-[var(--ep-radius)] p-2 sm:gap-4 sm:p-2.5"
      >
        {common}
      </div>
    );
  }

  return (
    <button
      type="button"
      role="listitem"
      data-ep-idx={index}
      onClick={() => onPlay(item)}
      aria-label={ariaName(item, labels)}
      className="md-state harbor-tv-focus group/ep flex w-full items-center gap-3 rounded-[var(--ep-radius)] p-2 text-start sm:gap-4 sm:p-2.5"
    >
      {common}
    </button>
  );
}

export const EpisodeRow = memo(EpisodeRowImpl);
