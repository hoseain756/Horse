"use client";

// Harbor Web — episode thumbnail (episodes rebuild)
// Shared by EpisodeCard (grid) and EpisodeRow (list): 16:9 art with the
// overlay kit — episode-number pill (top inline-end), IMDb score chip
// (bottom inline-end), watched pill (bottom inline-start), red progress bar
// along the bottom edge — plus spoiler blur.
//
// Art source order (never a broken image):
//   addon episode thumb → TMDB episode still → series backdrop (cover-cropped)
//   → theme gradient placeholder carrying the episode number.
//
// Sizing: TMDB stills use native CDN srcset (w185/w300/w780 — the TMDB CDN
// serves AVIF/WebP by Accept header); addon/backdrop URLs go through our
// /api/img transform proxy (AVIF/WebP + width fit). Blurred (spoiler) thumbs
// ALWAYS request the smallest variant (TMDB w92 / proxy w=112) — the sharp
// full-size image is never fetched.
//
// No-flash guarantee: the blur filter is a CSS rule on the WRAPPER
// (.ep-thumb-blur, see globals.css) present from the first paint — before the
// <img> loads, during scroll, and across view switches. Overlays are siblings
// of the filtered element, so pills stay sharp.
import { memo, useState } from "react";
import { Check } from "lucide-react";

const PROGRESS_WISHED = 0.85; // ≥ → watched (matches episodeWatchedSet)

export type EpisodeThumbnailProps = {
  thumb?: string;
  stillPath?: string;
  backdropUrl?: string;
  episodeNumber: number;
  alt: string;
  /** CSS `sizes` for the TMDB srcset (grid column / list thumb width). */
  sizes: string;
  blurred: boolean;
  watched: boolean;
  /** 0..1; bar renders only for 0 < progress < watched threshold. */
  progress: number;
  upcoming: boolean;
  rating?: number;
  /** Localized strings (kept as props so the component stays memo-friendly). */
  numLabel: string;
  watchedLabel: string;
  ratingLabel: string;
};

function tmdbStillSrc(path: string, size: "w92" | "w185" | "w300" | "w780"): string {
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

function proxied(url: string, w: number, q: number): string {
  return `/api/img?u=${encodeURIComponent(url)}&w=${w}&q=${q}`;
}

function EpisodeThumbnailImpl({
  thumb,
  stillPath,
  backdropUrl,
  episodeNumber,
  alt,
  sizes,
  blurred,
  watched,
  progress,
  upcoming,
  rating,
  numLabel,
  watchedLabel,
  ratingLabel,
}: EpisodeThumbnailProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  // ---- resolve the art URL for the CURRENT mode (blur = smallest size) ----
  let src: string | undefined;
  let srcSet: string | undefined;
  let sizesAttr = sizes;
  if (stillPath) {
    if (blurred) {
      src = tmdbStillSrc(stillPath, "w92");
      sizesAttr = "92px";
    } else {
      srcSet = ["w185", "w300", "w780"]
        .map((s) => `${tmdbStillSrc(stillPath, s as "w185")} ${s.slice(1)}w`)
        .join(", ");
    }
  } else if (thumb) {
    src = blurred ? proxied(thumb, 112, 45) : thumb;
  } else if (backdropUrl) {
    src = blurred ? proxied(backdropUrl, 112, 45) : proxied(backdropUrl, 560, 72);
  }
  const hasArt = !!(src || srcSet);

  // Reset load state when the resolved art changes (mode/season/view flips).
  const artKey = `${src ?? ""}|${srcSet ?? ""}`;
  const [seenKey, setSeenKey] = useState(artKey);
  if (seenKey !== artKey) {
    setSeenKey(artKey);
    setLoaded(false);
    setFailed(false);
  }

  const showProgress = !watched && progress > 0.02 && progress < PROGRESS_WISHED;
  const showRating = typeof rating === "number" && rating > 0;

  return (
    <div
      className={`relative aspect-video w-full overflow-hidden rounded-[var(--ep-radius)] bg-raised ${
        blurred ? "ep-thumb-blur" : ""
      } ${upcoming ? "opacity-50 saturate-50" : ""}`}
    >
      {/* skeleton underlay until the image decodes (CLS=0 via aspect-video) */}
      {hasArt && !loaded && !failed && (
        <div className="harbor-skeleton absolute inset-0" aria-hidden />
      )}

      {hasArt && !failed ? (
        <img
          src={src}
          srcSet={srcSet}
          sizes={sizesAttr}
          alt={alt}
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={`ep-thumb-art absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
        />
      ) : (
        /* gradient placeholder carrying the episode number — never broken */
        <div
          role="img"
          aria-label={alt}
          className="ep-thumb-art absolute inset-0 flex items-center justify-center bg-[linear-gradient(135deg,var(--md-sys-color-surface-container-high),var(--md-sys-color-surface-container-highest))]"
        >
          <span className="font-display text-3xl font-black tabular-nums text-ink-subtle/70">
            {episodeNumber}
          </span>
        </div>
      )}

      {/* legibility scrim for the overlay row (no text sits on raw art) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/55 to-transparent"
      />

      {/* ---- overlays (siblings of the blurred art → always sharp) ---- */}
      <span
        className="absolute top-1.5 end-1.5 rounded-full px-2 py-0.5 text-[var(--ep-num-size)] font-bold leading-4 tabular-nums text-[var(--ep-overlay-fg)] shadow-[0_1px_4px_rgba(0,0,0,0.4)]"
        style={{ background: "var(--ep-overlay-bg)" }}
      >
        {numLabel}
      </span>

      {watched && (
        <span className="absolute bottom-1.5 start-1.5 flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold leading-4 text-white shadow-[0_1px_4px_rgba(0,0,0,0.4)]" style={{ background: "var(--ep-overlay-bg)" }}>
          <Check className="h-3 w-3" style={{ color: "var(--ep-watched)" }} aria-hidden />
          {watchedLabel}
        </span>
      )}

      {showRating && (
        <span
          className="absolute bottom-1.5 end-1.5 flex items-center gap-1 rounded-full px-1.5 py-0.5 leading-4 shadow-[0_1px_4px_rgba(0,0,0,0.4)]"
          style={{ background: "var(--ep-overlay-bg)" }}
          aria-label={ratingLabel}
        >
          <span
            className="rounded-[3px] px-1 py-px text-[9px] font-black tracking-tight text-black"
            style={{ background: "var(--ep-imdb)" }}
            aria-hidden
          >
            IMDb
          </span>
          <bdi dir="ltr" className="text-[11px] font-bold tabular-nums text-[var(--ep-overlay-fg)]">
            {rating!.toFixed(1)}
          </bdi>
        </span>
      )}

      {showProgress && (
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-[var(--ep-progress-h)] bg-black/35"
        >
          <div
            className="h-full rounded-e-full"
            style={{ width: `${Math.round(progress * 100)}%`, background: "var(--ep-progress)" }}
          />
        </div>
      )}
    </div>
  );
}

/** Memoized: rows/cards re-render only when their own item data changes. */
export const EpisodeThumbnail = memo(EpisodeThumbnailImpl);
