"use client";

// Harbor Web — shared shape for one enriched episode row/card item.
// Built once per (season × sort × data) by EpisodesSection; view components
// stay pure presenters.
import type { MetaVideo } from "@/lib/harbor/types";

export type EpisodeItem = {
  video: MetaVideo;
  season: number;
  epNum: number;
  title: string;
  story: string;
  watched: boolean;
  /** 0..1 playback progress (0 = untouched). */
  progress: number;
  /** Air date in the future → dimmed + not playable (behavior kept). */
  upcoming: boolean;
  stillPath?: string;
  rating?: number;
  runtimeMin?: number;
};
