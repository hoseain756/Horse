"use client";

// Harbor Web — universal meta card (poster + title + badges), used by rails/search/grids
// M3 (m3-3c): poster keeps .harbor-poster (so the --poster-radius setting still wins),
// overlay badges become M3 chips (.md-chip primitives, reduced height) and the title
// uses the M3 type scale (md-title-small / md-body-small).
import { memo } from "react";
import type { Meta } from "@/lib/harbor/types";
import { PosterCard } from "./poster";
import { Star } from "lucide-react";

/* M3 chip on media: .md-chip primitives are unlayered CSS (they beat Tailwind's
   cascade-layered utilities), so the media-scrim overrides use `!` importance.
   On-media badges keep a dark scrim + light text in BOTH appearances — same
   readability contract as .harbor-subtitle (intentional exception). */
const POSTER_CHIP =
  "md-chip md-label-small !h-6 !gap-1 !px-2 !border-0 !bg-black/75 backdrop-blur-sm cursor-default!";

export const MetaCard = memo(function MetaCard({
  meta,
  onOpen,
}: {
  meta: Meta;
  onOpen: () => void;
}) {
  const rating = meta.imdbRating && parseFloat(meta.imdbRating) > 0 ? meta.imdbRating : null;
  return (
    <div className="w-full group">
      <PosterCard poster={meta.poster} background={meta.background} name={meta.name} onClick={onOpen}>
        {rating && (
          <span className={`${POSTER_CHIP} absolute top-1.5 start-1.5 !text-amber-300`}>
            <Star className="w-3 h-3 fill-amber-300" />
            {rating}
          </span>
        )}
        {meta.addonOrigin && (
          <span className={`${POSTER_CHIP} absolute top-1.5 end-1.5 max-w-[90px] truncate !text-white/90`}>
            {meta.addonOrigin.name}
          </span>
        )}
        {meta.releaseInfo && (
          <span
            className={`${POSTER_CHIP} !bg-black/70 absolute bottom-1.5 start-1.5 !text-white/90 opacity-0 translate-y-1 group-hover/poster:opacity-100 group-hover/poster:translate-y-0 transition-all duration-200`}
          >
            {meta.releaseInfo.split("–")[0]}
          </span>
        )}
      </PosterCard>
      <div className="mt-1.5 px-0.5">
        <p className="md-title-small harbor-clamp-1 text-ink group-hover:text-accent transition-colors">
          {meta.name}
        </p>
        <p className="md-body-small harbor-clamp-1 text-ink-subtle">{meta.releaseInfo ?? meta.type}</p>
      </div>
    </div>
  );
});
