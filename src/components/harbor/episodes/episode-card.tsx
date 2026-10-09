"use client";

// Harbor Web — grid episode card (episodes rebuild, matches target image 1)
// 16:9 thumbnail + text BELOW (no card background): bold title (max 2 lines),
// meta line "E{n} · runtime · air date" (only available parts), story clamped
// to exactly 2 lines. Titles/stories are dir="auto" + unicode-bidi:plaintext +
// text-align:start so English text inside the Arabic layout can never drag
// punctuation/ellipsis to the wrong side.
import { memo } from "react";
import { EpisodeThumbnail } from "./episode-thumbnail";
import type { EpisodeItem } from "./types";

export type EpisodeLabels = {
  watchedLabel: string;
  upcomingLabel: string;
  runtimeMin: (n: number) => string;
  formatDate: (iso: string) => string;
};

export type EpisodeCardProps = {
  item: EpisodeItem;
  /** Flat item index — powers roving keyboard navigation (data-ep-idx). */
  index: number;
  blurred: boolean;
  backdropUrl?: string;
  /** CSS sizes hint for the thumbnail srcset. */
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

function EpisodeCardImpl({ item, index, blurred, backdropUrl, sizes, labels, onPlay }: EpisodeCardProps) {
  const common = (
    <>
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
      <div className="min-w-0 px-0.5 pb-1">
        <p
          dir="auto"
          style={{ unicodeBidi: "plaintext", fontSize: "var(--ep-title-size)", lineHeight: "var(--ep-title-lh)" }}
          className="harbor-clamp-2 text-start font-semibold text-ink"
        >
          <bdi>{item.title}</bdi>
        </p>
        <div className="mt-1">
          <MetaLine item={item} labels={labels} />
        </div>
        {item.story && (
          <p
            dir="auto"
            style={{ unicodeBidi: "plaintext", fontSize: "var(--ep-story-size)" }}
            className="harbor-clamp-2 mt-1.5 text-start leading-snug text-ink-muted"
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
        className="flex w-full flex-col gap-2 select-none"
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
      className="md-state harbor-tv-focus group/ep flex w-full flex-col gap-2 rounded-[var(--ep-radius)] text-start"
    >
      {common}
    </button>
  );
}

export const EpisodeCard = memo(EpisodeCardImpl);
