// Harbor Web — PlaybackTimeline: THE single source of truth for player time.
//
// Every consumer (control bar, seek slider, resume, Continue Watching,
// Trakt/Simkl scrobbling, subtitle sync) reads from here — never from
// video.duration / video.currentTime directly.
//
// Duration resolution ladder (first trustworthy value wins, upgrades later):
//   1. element   — finite video.duration (> 1s, ≥ currentTime, not "crawling")
//   2. hls       — hls.js levelDetails.totalduration when the playlist is VOD
//   3. seekable  — video.seekable.end(last) when finite and not live
//   4. probe     — server ffprobe (applied via applyProbe; approximate=false)
//   5. meta      — metadata runtime (approximate=true, shown with "~")
//   6. none      — duration null: elapsed-only UI, no fake bar
//
// Trust rules (spec): reject non-finite, ≤ 1s, < currentTime − 0.05, and the
// fMP4 "crawling duration" signature (empty_moov pipes report a growing total
// — box-dump evidence in worklog round 25) once ≥ 3 upward revisions arrive.
//
// Seek model: seeks are requested in TITLE time; the timeline maps them onto
// the element when the element's seekable range covers them, and otherwise
// returns a { restart } instruction so the player can re-open the source with
// a signed server-side offset (transcode -ss) without breaking subs/scrobbles.
"use client";

export type DurationSource = "element" | "hls" | "seekable" | "probe" | "meta" | "none";

export type BufferedRange = { start: number; end: number };

export type TimelineSnapshot = {
  /** Title seconds (offset applied) — drives the time display and slider. */
  currentTime: number;
  /** Raw media-element seconds (subtitle cue matching still uses this). */
  elementTime: number;
  /** Total title seconds; null while unknown. Never fabricated. */
  duration: number | null;
  /** duration − currentTime, null when duration unknown. */
  remaining: number | null;
  /** 0..1; null when duration unknown (callers render no fake progress). */
  progress: number | null;
  /** Buffered ranges in title time. */
  buffered: BufferedRange[];
  /** True when the playlist/stream is live (no total). */
  isLive: boolean;
  /** Whether the timeline can serve seeks on the element right now. */
  isSeekable: boolean;
  /** True when duration comes from metadata runtime (approximate, "~"). */
  isApproximate: boolean;
  /** Debug label — surfaced in the player's technical-details panel. */
  durationSource: DurationSource;
};

export type SeekOutcome =
  | { type: "element"; titleTime: number }
  | { type: "restart"; offsetS: number; titleTime: number };

export type PlaybackTimelineOptions = {
  /** Metadata runtime in seconds (Stremio/TMDB, minutes normalized upstream). */
  approximateDurationS?: number | null;
  /** Initial live verdict (overridden by hls.js levelDetails when present). */
  isLive?: boolean;
  /** Server-side start offset of the current source (transcode -ss). */
  offsetS?: number;
  /** Emission throttle in ms (default ~8/s, spec allows 4–10). */
  emitIntervalMs?: number;
};

const MIN_TRUSTED_DURATION_S = 1;

function isTrustedDuration(cand: number, currentTime: number): boolean {
  return Number.isFinite(cand) && cand > MIN_TRUSTED_DURATION_S && cand >= currentTime - 0.05;
}

export class PlaybackTimeline {
  private video: HTMLMediaElement | null = null;
  private hls: {
    on: (evt: string, cb: (d: unknown) => void) => void;
    off?: (evt: string, cb: (d: unknown) => void) => void;
  } | null = null;
  private listeners = new Set<() => void>();
  private rafId: number | null = null;
  private lastEmit = 0;
  private snap: TimelineSnapshot = PlaybackTimeline.emptySnapshot();
  private destroyed = false;

  // Candidates
  private probeDurationS: number | null = null;
  private hlsDurationS: number | null = null;
  private approximateDurationS: number | null = null;
  private offsetS = 0;
  private live = false;
  private hlsLive = false;

  // fMP4 crawl detector: element durations that keep growing are untrusted.
  private elementDurSamples: { d: number; t: number }[] = [];
  private elementCrawling = false;
  /** Set by the player for sources whose element duration is known-bad
   *  (piped empty_moov fMP4 — duration may even freeze at a fragment parse). */
  private elementUntrusted = false;

  private onMediaEvent = () => {
    this.scheduleEmit(true);
  };

  private onHlsLevelLoaded = (data: unknown) => {
    const details = (data as { details?: { live?: boolean; totalduration?: number } })?.details;
    if (!details) return;
    this.hlsLive = details.live === true;
    if (!this.hlsLive && Number.isFinite(details.totalduration) && (details.totalduration ?? 0) > 1) {
      this.hlsDurationS = details.totalduration as number;
    } else if (this.hlsLive) {
      this.hlsDurationS = null;
    }
    this.scheduleEmit(true);
  };

  constructor(private opts: PlaybackTimelineOptions = {}) {
    this.approximateDurationS = opts.approximateDurationS ?? null;
    this.live = opts.isLive ?? false;
    this.offsetS = opts.offsetS ?? 0;
  }

  static emptySnapshot(): TimelineSnapshot {
    return {
      currentTime: 0,
      elementTime: 0,
      duration: null,
      remaining: null,
      progress: null,
      buffered: [],
      isLive: false,
      isSeekable: false,
      isApproximate: false,
      durationSource: "none",
    };
  }

  // ---------- wiring ----------

  attach(video: HTMLMediaElement, hls?: unknown): void {
    if (this.destroyed) return;
    this.detachMedia();
    this.video = video;
    for (const evt of [
      "timeupdate",
      "durationchange",
      "loadedmetadata",
      "progress",
      "seeked",
      "playing",
      "pause",
      "ended",
      "emptied",
    ]) {
      video.addEventListener(evt, this.onMediaEvent);
    }
    if (hls && typeof (hls as { on?: unknown }).on === "function") {
      this.hls = hls as NonNullable<typeof this.hls>;
      this.hls.on("LEVEL_LOADED", this.onHlsLevelLoaded);
    }
    this.startRaf();
    this.scheduleEmit(true);
  }

  attachHls(hls: unknown): void {
    if (this.destroyed || !hls || typeof (hls as { on?: unknown }).on !== "function") return;
    if (this.hls === hls) return;
    if (this.hls?.off) this.hls.off("LEVEL_LOADED", this.onHlsLevelLoaded);
    this.hls = hls as NonNullable<typeof this.hls>;
    this.hls.on("LEVEL_LOADED", this.onHlsLevelLoaded);
  }

  detachMedia(): void {
    if (this.video) {
      for (const evt of [
        "timeupdate",
        "durationchange",
        "loadedmetadata",
        "progress",
        "seeked",
        "playing",
        "pause",
        "ended",
        "emptied",
      ]) {
        this.video.removeEventListener(evt, this.onMediaEvent);
      }
    }
    if (this.hls?.off) this.hls.off("LEVEL_LOADED", this.onHlsLevelLoaded);
    this.hls = null;
    this.video = null;
    this.stopRaf();
  }

  destroy(): void {
    this.destroyed = true;
    this.detachMedia();
    this.listeners.clear();
  }

  // ---------- inputs ----------

  /** Server ffprobe result (source #4). Pass null when the probe failed. */
  applyProbe(durationS: number | null): void {
    this.probeDurationS =
      durationS != null && Number.isFinite(durationS) && durationS > MIN_TRUSTED_DURATION_S
        ? durationS
        : null;
    this.scheduleEmit(true);
  }

  /** Metadata runtime (source #5) — normalized to seconds by the caller. */
  setApproximateDuration(seconds: number | null): void {
    this.approximateDurationS =
      seconds != null && Number.isFinite(seconds) && seconds > MIN_TRUSTED_DURATION_S
        ? seconds
        : null;
    this.scheduleEmit(true);
  }

  /** Server-side start offset of the CURRENT source (transcode -ss restarts). */
  setOffset(seconds: number): void {
    const next = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
    if (next === this.offsetS) return;
    this.offsetS = next;
    this.scheduleEmit(true);
  }

  /** Current server offset (title → element mapping: element = title − offset). */
  get offset(): number {
    return this.offsetS;
  }

  /** Map a TITLE position onto the current media element's timebase. */
  elementTimeFor(titleSeconds: number): number {
    return Math.max(0, titleSeconds - this.offsetS);
  }

  /** External live verdict (P2P/other); hls.js LEVEL_LOADED overrides. */
  markLive(isLive: boolean): void {
    if (this.live === isLive) return;
    this.live = isLive;
    this.scheduleEmit(true);
  }

  /**
   * Player-side veto on the element duration (priority 1). Used for sources
   * where the browser CANNOT know the real length: piped fMP4 (empty_moov,
   * no mehd — duration freezes mid-parse or crawls with fragments).
   */
  setElementUntrusted(untrusted: boolean): void {
    if (this.elementUntrusted === untrusted) return;
    this.elementUntrusted = untrusted;
    this.scheduleEmit(true);
  }

  // ---------- seeks ----------

  /**
   * Seek to a TITLE position. Returns what the player must do: move the
   * element (when its seekable range covers the target) or restart the source
   * server-side at the new offset (unseekable fMP4 / beyond-seekable cases).
   */
  seekTo(titleSeconds: number): SeekOutcome {
    const v = this.video;
    const target = Math.max(0, titleSeconds);
    if (!v) return { type: "restart", offsetS: target, titleTime: target };
    const sk = v.seekable;
    let seekEnd = 0;
    for (let i = 0; i < sk.length; i++) {
      const end = sk.end(i);
      if (end > seekEnd) seekEnd = end;
    }
    const elementTarget = target - this.offsetS;
    if (Number.isFinite(seekEnd) && seekEnd > 0.5 && elementTarget <= seekEnd - 0.25) {
      try {
        v.currentTime = Math.max(0, elementTarget);
        return { type: "element", titleTime: target };
      } catch {
        /* fall through to restart */
      }
    }
    return { type: "restart", offsetS: target, titleTime: target };
  }

  // ---------- snapshot ----------

  snapshot(): TimelineSnapshot {
    return this.snap;
  }

  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };

  getSnapshot = (): TimelineSnapshot => this.snap;

  private startRaf(): void {
    if (this.rafId != null || typeof window === "undefined") return;
    const loop = () => {
      if (this.destroyed) return;
      const v = this.video;
      if (v && !v.paused && !v.ended) this.scheduleEmit(false);
      this.rafId = window.requestAnimationFrame(loop);
    };
    this.rafId = window.requestAnimationFrame(loop);
  }

  private stopRaf(): void {
    if (this.rafId != null && typeof window !== "undefined") {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private scheduleEmit(force: boolean): void {
    if (this.destroyed) return;
    const now = Date.now();
    if (!force && now - this.lastEmit < (this.opts.emitIntervalMs ?? 125)) return;
    this.lastEmit = now;
    this.recompute();
    for (const cb of this.listeners) cb();
  }

  private recompute(): void {
    const v = this.video;
    if (!v) {
      this.snap = PlaybackTimeline.emptySnapshot();
      return;
    }
    const elementTime = v.currentTime;
    const titleTime = Math.max(0, elementTime + this.offsetS);

    // Copy buffered ranges into title time
    const buffered: BufferedRange[] = [];
    try {
      const b = v.buffered;
      for (let i = 0; i < b.length; i++) {
        buffered.push({
          start: Math.max(0, b.start(i) + this.offsetS),
          end: Math.max(0, b.end(i) + this.offsetS),
        });
      }
    } catch {
      /* readyState 0 — no ranges yet */
    }

    // Seekable end (also used by the ladder)
    let seekableEnd = 0;
    try {
      const sk = v.seekable;
      for (let i = 0; i < sk.length; i++) {
        const end = sk.end(i);
        if (Number.isFinite(end) && end > seekableEnd) seekableEnd = end;
      }
    } catch {
      /* no seekable yet */
    }

    // Crawl detector: ≥3 upward element-duration revisions inside 8s ⇒ fMP4 pipe
    const elDur = v.duration;
    if (Number.isFinite(elDur) && elDur > 0) {
      const samples = this.elementDurSamples;
      const last = samples[samples.length - 1];
      if (!last || Math.abs(last.d - elDur) > 0.01) {
        samples.push({ d: elDur, t: Date.now() });
        while (samples.length > 12) samples.shift();
        const window = samples.filter((s) => Date.now() - s.t < 8_000);
        let ups = 0;
        for (let i = 1; i < window.length; i++) {
          if (window[i].d > window[i - 1].d + 0.01) ups++;
        }
        if (ups >= 2) this.elementCrawling = true;
      }
    }
    if (elDur === 0 || !Number.isFinite(elDur)) {
      // emptied / new source: reset the crawl state
      if (elDur === 0) {
        this.elementDurSamples = [];
        this.elementCrawling = false;
      }
    }

    const isLive = this.live || this.hlsLive;

    // ---- duration ladder ----
    let duration: number | null = null;
    let source: DurationSource = "none";
    let approximate = false;

    // Generic empty_moov signature (works even without source-mode knowledge):
    // a probe value exists, the element parse reports a SHORTER duration, and
    // the element has NO seekable range — Chromium froze mid-parse of a pipe.
    const elementFrozenParse =
      !isLive &&
      this.probeDurationS != null &&
      Number.isFinite(elDur) &&
      elDur > 0 &&
      seekableEnd < 0.5 &&
      elDur < this.probeDurationS - 1;

    if (!isLive) {
      if (
        Number.isFinite(elDur) &&
        !this.elementUntrusted &&
        !elementFrozenParse &&
        !this.elementCrawling &&
        isTrustedDuration(elDur, elementTime)
      ) {
        duration = elDur + this.offsetS;
        source = "element";
      } else if (this.hlsDurationS != null && isTrustedDuration(this.hlsDurationS, elementTime)) {
        duration = this.hlsDurationS;
        source = "hls";
      } else if (seekableEnd > MIN_TRUSTED_DURATION_S) {
        duration = seekableEnd + this.offsetS;
        source = "seekable";
      } else if (this.probeDurationS != null) {
        // Probe values are FULL-SOURCE durations (offset already stripped
        // server-side); title time = offset + element time, so no addition here.
        duration = this.probeDurationS;
        source = "probe";
      } else if (this.approximateDurationS != null) {
        duration = this.approximateDurationS;
        source = "meta";
        approximate = true;
      }
    }

    const progress = duration != null && duration > 0 ? Math.min(1, Math.max(0, titleTime / duration)) : null;

    this.snap = {
      currentTime: titleTime,
      elementTime,
      duration,
      remaining: duration != null ? Math.max(0, duration - titleTime) : null,
      progress,
      buffered,
      isLive,
      isSeekable: seekableEnd > 0.5 || (!isLive && duration != null && duration > 1),
      isApproximate: approximate,
      durationSource: source,
    };
  }
}

/** Localize seconds to a clock string: H:MM:SS or M:SS (tabular-nums safe). */
export function formatClock(t: number | null | undefined): string {
  if (t == null || !Number.isFinite(t) || t < 0) return "--:--";
  const total = Math.floor(t);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/**
 * Normalize metadata runtime strings to seconds. Handles the shapes seen in
 * the wild: "111 min", "85min", "1h 45min", "1h45", "1 h 20 m". Returns null
 * when nothing parseable is present (units are NOT assumed).
 */
export function parseRuntimeToSeconds(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) && raw > 0 ? raw : null;
  const s = String(raw).toLowerCase();
  const h = /(\d+(?:\.\d+)?)\s*h(?:our)?/.exec(s)?.[1];
  const m =
    /(\d+(?:\.\d+)?)\s*min/.exec(s)?.[1] ??
    /(\d+(?:\.\d+)?)\s*m(?![a-z])/.exec(s)?.[1];
  const hours = h != null ? parseFloat(h) : 0;
  const mins = m != null ? parseFloat(m) : 0;
  const total = hours * 3600 + mins * 60;
  if (!Number.isFinite(total) || total <= 0) return null;
  return Math.round(total);
}

/**
 * Accessible phrasing ("12 minutes 30 seconds of 1 hour 45 minutes") —
 * English; Arabic localization happens where the UI knows the language.
 */
export function spokenDuration(totalS: number): string {
  const h = Math.floor(totalS / 3600);
  const m = Math.floor((totalS % 3600) / 60);
  const s = Math.floor(totalS % 60);
  const parts: string[] = [];
  if (h > 0) parts.push(`${h} hour${h === 1 ? "" : "s"}`);
  if (m > 0) parts.push(`${m} minute${m === 1 ? "" : "s"}`);
  if (s > 0 || parts.length === 0) parts.push(`${s} second${s === 1 ? "" : "s"}`);
  return parts.join(" ");
}
