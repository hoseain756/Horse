// Harbor Web — SubtitleManager
// The ONE source of truth for subtitle rendering. Invariant enforced here:
//   exactly ONE active subtitle layer at any time (the custom overlay div).
// Native <track> elements / TextTracks are ALWAYS disabled and swept — the
// browser must never paint its own subtitle layer alongside ours (this is the
// root cause of the "same line rendered twice" bug: a native track with
// `default` mode showing while the custom overlay was also active).
//
// Responsibilities:
//  - attach(video): own the media element, initial sweep
//  - sweep(): set every TextTrack to "disabled", remove stray <track> children,
//             revoke stale blob URLs, dev-time assertion
//  - makeVttUrl(cues): tracked object-URL lifecycle (create → revoke on sweep/destroy)
//  - dedupeKey(sub): stable identity for idempotent track loading (url+lang+label)
//  - destroy(): full teardown on unmount / source change

import type { SubCue } from "./subtitles";
import { cuesToVTT } from "./subtitles";

export type DedupeLike = { url: string; lang?: string; label: string };

export class SubtitleManager {
  private video: HTMLVideoElement | null = null;
  private blobUrls = new Set<string>();
  private destroyed = false;

  attach(video: HTMLVideoElement): void {
    this.video = video;
    this.sweep();
  }

  /**
   * Hard invariant: no native subtitle rendering may be active.
   *  - Every TextTrack on the media element → mode "disabled" (covers embedded
   *    HLS/WebM tracks that the browser or hls.js may flip to "showing").
   *  - Any <track> child elements are removed (legacy/dup renders, hot reload).
   *  - All previously created blob URLs are revoked (they backed removed tracks).
   *  - Dev assertion: warn loudly if a second subtitle layer is still visible.
   */
  sweep(): void {
    if (this.destroyed || !this.video) return;
    const video = this.video;

    // 1) kill every TextTrack (both element tracks and addTextTrack() ones)
    const tracks = video.textTracks;
    if (tracks) {
      for (let i = 0; i < tracks.length; i++) {
        const t = tracks[i];
        if (t) {
          // Only subtitles/captions belong to us; metadata/chapters are harmless
          // but disabling them too is safe (we never use them).
          try {
            t.mode = "disabled";
          } catch {
            /* some UAs throw on invalid state transitions — ignore */
          }
        }
      }
    }

    // 2) remove stray <track> children (React no longer renders them, but a
    //    previous version of the app or a hot reload may have left some)
    const stale: HTMLTrackElement[] = [];
    for (const child of Array.from(video.children)) {
      if (child instanceof HTMLTrackElement) stale.push(child);
    }
    for (const el of stale) el.remove();

    // 3) revoke tracked blob URLs — the custom overlay renders cues from
    //    memory, object URLs are only ever needed for native tracks (never us)
    this.revokeAll();

    // 4) dev-time assertion: more than one subtitle layer active?
    if (process.env.NODE_ENV !== "production") {
      let showing = 0;
      if (tracks) {
        for (let i = 0; i < tracks.length; i++) {
          const t = tracks[i];
          if (t && (t.mode === "showing" || t.mode === "hidden") && t.kind !== "metadata") showing++;
        }
      }
      if (showing > 0) {
        console.warn(
          `[Harbor] SubtitleManager: ${showing} native text track(s) still visible after sweep — ` +
            `custom overlay is the only permitted renderer.`,
        );
      }
    }
  }

  /** Create a tracked VTT blob URL (used only by the native-fallback path). */
  makeVttUrl(cues: SubCue[]): string {
    const url = URL.createObjectURL(new Blob([cuesToVTT(cues)], { type: "text/vtt" }));
    this.blobUrls.add(url);
    return url;
  }

  revokeAll(): void {
    for (const url of this.blobUrls) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* ignore */
      }
    }
    this.blobUrls.clear();
  }

  destroy(): void {
    this.destroyed = true;
    this.revokeAll();
    this.video = null;
  }
}

/** Stable identity for idempotent subtitle loading (dedupe by url+language+label). */
export function subtitleDedupeKey(s: DedupeLike): string {
  const norm = (v: string | undefined) => (v ?? "").trim().toLowerCase();
  return `${norm(s.url)}|${norm(s.lang)}|${norm(s.label)}`;
}

/**
 * Append candidates to an existing loaded list idempotently:
 * skips anything already present (by stable key) and anything duplicated
 * inside the batch itself. Returns a NEW array (no in-place mutation).
 */
export function mergeSubtitlesUnique<T extends DedupeLike>(existing: T[], additions: T[]): T[] {
  const seen = new Set(existing.map(subtitleDedupeKey));
  const out = [...existing];
  for (const add of additions) {
    const key = subtitleDedupeKey(add);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(add);
  }
  return out;
}
