"use client";

// Harbor Web — poster with fallback chain + lazy loading
import { useState } from "react";
import { Film, Play } from "lucide-react";

const FAILED = new Set<string>();

export function PosterImage({
  src,
  alt,
  className,
  landscape,
}: {
  src?: string;
  alt: string;
  className?: string;
  landscape?: boolean;
}) {
  const [state, setState] = useState({
    src,
    loaded: false,
    failed: !src || FAILED.has(src ?? ""),
  });

  // Adjust state during render when src changes (React-recommended pattern)
  if (state.src !== src) {
    setState({ src, loaded: false, failed: !src || FAILED.has(src ?? "") });
  }

  if (!src || state.failed) {
    return (
      <div
        className={`flex items-center justify-center bg-raised text-ink-subtle ${className ?? ""}`}
        aria-label={alt}
        role="img"
      >
        <Film className="w-8 h-8 opacity-40" />
      </div>
    );
  }
  return (
    <>
      {!state.loaded && <div className={`absolute inset-0 harbor-skeleton ${className ?? ""}`} aria-hidden />}
      { }
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setState((s) => ({ ...s, loaded: true }))}
        onError={() => {
          FAILED.add(src);
          setState((s) => ({ ...s, failed: true }));
        }}
        className={`${className ?? ""} ${state.loaded ? "opacity-100" : "opacity-0"} transition-opacity duration-300 harbor-poster-img`}
      />
    </>
  );
}

export function PosterCard({
  poster,
  background,
  name,
  className,
  landscape,
  onClick,
  children,
}: {
  poster?: string;
  background?: string;
  name: string;
  className?: string;
  landscape?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`harbor-poster harbor-tv-focus relative block w-full text-left group/poster ${landscape ? "aspect-video" : "aspect-[2/3]"} ${className ?? ""}`}
    >
      {/* Accessible name as a real descendant (not aria-label) so the name
          COMPOSES with any visible child text (rank numerals, year, title) —
          fixes axe label-content-name-mismatch across every caller. */}
      <span className="sr-only">{name}</span>
      <PosterImage
        src={landscape ? (background || poster) : (poster || background)}
        alt={name}
        className="absolute inset-0"
        landscape={landscape}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover/poster:opacity-100 transition-opacity" />
      {/* Quick-play affordance (Harbor-style hover overlay) — M3: primary/
          on-primary roles instead of hardcoded black */}
      <span
        aria-hidden
        className="absolute inset-0 flex items-center justify-center opacity-0 scale-75 group-hover/poster:opacity-100 group-hover/poster:scale-100 transition-all duration-200 pointer-events-none"
      >
        <span className="w-11 h-11 rounded-full bg-accent text-[var(--md-sys-color-on-primary)] flex items-center justify-center shadow-[0_8px_28px_-6px_rgba(0,0,0,0.8)]">
          <Play className="w-5 h-5 fill-current ms-0.5" />
        </span>
      </span>
      {children}
    </button>
  );
}
