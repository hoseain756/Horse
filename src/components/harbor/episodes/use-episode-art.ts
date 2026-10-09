"use client";

// Harbor Web — per-episode TMDB art + ratings (episodes rebuild)
// One fail-soft request per season: /tv/{tmdbId}/season/{n} → still_path,
// vote_average, runtime. Follows the enrichment contract used across the app:
// TMDB being disabled/unreachable/missing never breaks addon metadata — the
// episodes render with their addon thumbnails and no rating badge.
// Responses are cached by tmdbGet (30 min TTL) so season switching is instant
// after the first visit. TMDB supplies ART + SCORE + RUNTIME only — the addon
// overview/name stay the source of truth for text.
import { useEffect, useState } from "react";
import { tmdbGet } from "@/lib/harbor/tmdb";

export type EpisodeArt = {
  /** TMDB still file path (build sizes with /t/p/w185|w300|w780). */
  stillPath?: string;
  /** TMDB vote_average (0–10) — rendered as the IMDb-style chip. */
  rating?: number;
  /** TMDB runtime in minutes. */
  runtimeMin?: number;
};

type RawSeasonEpisode = {
  episode_number: number;
  still_path?: string | null;
  vote_average?: number | null;
  runtime?: number | null;
};

export function useEpisodeArt(
  tmdbId: number | null,
  season: number | null,
): { art: Map<number, EpisodeArt>; loading: boolean } {
  const [art, setArt] = useState<Map<number, EpisodeArt>>(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tmdbId || season === null || season === undefined) {
      setArt(new Map());
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const data = await tmdbGet<{ episodes?: RawSeasonEpisode[] }>(
          `/tv/${tmdbId}/season/${season}`,
          {},
          30 * 60_000,
        );
        if (!alive) return;
        const map = new Map<number, EpisodeArt>();
        for (const ep of data.episodes ?? []) {
          if (typeof ep.episode_number !== "number") continue;
          map.set(ep.episode_number, {
            stillPath: ep.still_path ?? undefined,
            rating:
              typeof ep.vote_average === "number" && ep.vote_average > 0
                ? ep.vote_average
                : undefined,
            runtimeMin: typeof ep.runtime === "number" && ep.runtime > 0 ? ep.runtime : undefined,
          });
        }
        setArt(map);
      } catch {
        if (alive) setArt(new Map());
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [tmdbId, season]);

  return { art, loading };
}
