"use client";

// Harbor Web — spotlight hero for section views (smaller than home hero)
// M3 (m3-3c): meta chips → .md-chip, CTAs → .md-btn-filled / .md-btn-tonal.
// Ken-burns/rise animations, rotation logic and the canvas-gradient scrim are untouched.
import { useEffect, useState } from "react";
import type { Meta } from "@/lib/harbor/types";
import { useNav } from "@/lib/harbor/store";
import { PosterImage } from "../common/poster";
import { Play, Info, Star } from "lucide-react";

/* M3 assist chips on the hero scrim — transparent chips over the canvas-gradient
   scrim give appearance-correct contrast in dark AND light. The amber rating
   star stays (rating-gold identity — intentional exception). */
const HERO_CHIP = "md-chip md-label-medium !h-7 !px-3 cursor-default!";

export function HeroSpotlight({ metas }: { metas: Meta[] }) {
  const [idx, setIdx] = useState(0);
  const push = useNav((s) => s.push);

  useEffect(() => {
    if (metas.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % metas.length), 10_000);
    return () => clearInterval(t);
  }, [metas.length]);

  if (metas.length === 0) return null;
  const meta = metas[Math.min(idx, metas.length - 1)];

  return (
    <section className="relative h-[40vh] min-h-[300px] md:h-[52vh] overflow-hidden" aria-label="Spotlight">
      <div key={meta.id} className="absolute inset-0">
        <PosterImage src={meta.background ?? meta.poster} alt={meta.name} className="absolute inset-0" landscape />
        <div className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-canvas/80 via-canvas/20 to-transparent" />
      </div>
      <div className="relative z-10 h-full flex flex-col justify-end px-4 md:px-8 pb-8 max-w-2xl">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {meta.releaseInfo && <span className={HERO_CHIP}>{meta.releaseInfo.split("–")[0]}</span>}
          {meta.imdbRating && parseFloat(meta.imdbRating) > 0 && (
            <span className={`${HERO_CHIP} !text-amber-300`}>
              <Star className="w-3.5 h-3.5 fill-amber-300" /> {meta.imdbRating}
            </span>
          )}
        </div>
        <h1 className="font-display text-2xl md:text-4xl font-bold text-ink mb-4 harbor-clamp-2">{meta.name}</h1>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => push({ kind: "detail", type: meta.type, id: meta.id })}
            className="md-btn md-btn-filled md-state harbor-tv-focus"
          >
            <Play className="md-btn-icon fill-current" /> Play
          </button>
          <button
            type="button"
            onClick={() => push({ kind: "detail", type: meta.type, id: meta.id })}
            className="md-btn md-btn-tonal md-state harbor-tv-focus"
          >
            <Info className="md-btn-icon" /> Details
          </button>
        </div>
      </div>
      {metas.length > 1 && (
        <div className="absolute bottom-3 end-4 md:end-8 z-10 flex gap-1.5">
          {metas.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Slide ${i + 1}`}
              onClick={() => setIdx(i)}
              className={`relative h-1.5 rounded-full transition-all after:content-[''] after:absolute after:-inset-1.5 after:rounded-full ${i === idx ? "w-5 bg-accent" : "w-1.5 bg-white/40"}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
