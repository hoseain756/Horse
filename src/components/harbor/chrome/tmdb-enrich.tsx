"use client";

// Harbor Web — TMDB detail enrichment (Feature: TMDB integration)
// Resolves IMDb → TMDB once per title, pulls details (logo, certification,
// runtime, recommendations) and exposes them to DetailView. Every step fails
// soft: when TMDB is disabled/unconfigured the result stays null and the page
// renders exactly as before (addon/Cinemeta metadata only).
import { useEffect, useState } from "react";
import {
  tmdbDetails,
  tmdbIdFromImdb,
  tmdbImg,
  tmdbLogo,
  tmdbCertification,
  type TmdbDetails,
} from "@/lib/harbor/tmdb";
import type { Meta } from "@/lib/harbor/types";

export type TmdbEnrichment = {
  tmdbId: number | null;
  details: TmdbDetails | null;
  logo: string | undefined;
  certification: string | undefined;
  backdrop: string | undefined;
  /** TMDB recommendations mapped to Meta-ish cards (may use tmdb: ids). */
  recommendations: Meta[];
  state: "idle" | "loading" | "ready" | "off";
};

type TmdbData = {
  tmdbId: number | null;
  details: TmdbDetails | null;
  recommendations: Meta[];
};

function derive(data: TmdbData | null, valid: boolean, region: string): TmdbEnrichment {
  if (!valid) {
    return { tmdbId: null, details: null, logo: undefined, certification: undefined, backdrop: undefined, recommendations: [], state: "off" };
  }
  if (!data) {
    return { tmdbId: null, details: null, logo: undefined, certification: undefined, backdrop: undefined, recommendations: [], state: "loading" };
  }
  if (data.tmdbId === null) {
    return { ...data, logo: undefined, certification: undefined, backdrop: undefined, state: "off" };
  }
  return {
    ...data,
    logo: tmdbLogo(data.details),
    certification: tmdbCertification(data.details, region),
    backdrop: data.details?.images?.backdrops?.[0]
      ? tmdbImg(data.details.images.backdrops[0].file_path, "backdrop")
      : undefined,
    state: "ready",
  };
}

export function useTmdbEnrichment(type: string, imdbId: string, region: string): TmdbEnrichment {
  const valid = /^tt\d+$/.test(imdbId);
  const key = `${type}|${imdbId}`;
  // Render-phase reset when the title changes (official derived-state pattern —
  // avoids setState-in-effect and never flashes the previous title's artwork)
  const [prevKey, setPrevKey] = useState(key);
  const [data, setData] = useState<TmdbData | null>(null);
  if (prevKey !== key) {
    setPrevKey(key);
    setData(null);
  }

  useEffect(() => {
    if (!valid) return;
    let alive = true;
    (async () => {
      const tmdbId = await tmdbIdFromImdb(imdbId, type === "series" ? "series" : "movie");
      if (!alive) return;
      if (!tmdbId) {
        setData({ tmdbId: null, details: null, recommendations: [] });
        return;
      }
      const details = await tmdbDetails(type === "series" ? "series" : "movie", tmdbId);
      if (!alive) return;
      const recs: Meta[] = (details?.recommendations?.results ?? [])
        .slice(0, 14)
        .map((r) => ({
          id: `tmdb:${r.id}`,
          type: type === "series" ? "series" : "movie",
          name: r.title ?? r.name ?? "Unknown",
          poster: tmdbImg(r.poster_path, "poster"),
          imdbRating: r.vote_average && r.vote_average > 0 ? r.vote_average.toFixed(1) : undefined,
        }))
        .filter((m) => !!m.poster);
      setData({ tmdbId, details, recommendations: recs });
    })();
    return () => {
      alive = false;
    };
  }, [valid, type, imdbId]);

  return derive(data, valid, region);
}
