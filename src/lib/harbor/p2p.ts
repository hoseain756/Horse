// Harbor Web — P2P torrent engine client
// Talks to mini-services/torrent-service (port 3031, behind the Caddy gateway via
// the XTransformPort query param). All playback URLs are relative so the gateway
// proxies range requests straight to the torrent engine.
"use client";

import type { Stream } from "./types";

export const P2P_PORT = 3031;
const Q = `?XTransformPort=${P2P_PORT}`;
const BASE = ""; // paths are root-level; the gateway routes by query port

export type P2pFile = { index: number; name: string; length: number };

export type P2pPrepareResult =
  | {
      key: string;
      fileIdx: number;
      filename: string;
      size: number;
      name: string | null;
      pending?: false;
    }
  | { key: string; pending: true; name: string | null; peers: number };

export type P2pStatus = {
  ok?: boolean;
  error?: string;
  key?: string;
  name?: string | null;
  ready?: boolean;
  progress?: number;
  downloaded?: number;
  downloadSpeed?: number; // bytes/s
  uploadSpeed?: number;
  peers?: number;
  timeRemaining?: number;
  length?: number;
  files?: P2pFile[];
};

export type P2pCodecReport = {
  error?: string;
  fileIdx?: number;
  filename?: string;
  container?: string | null;
  video?: string | null;
  audio?: string | null;
  width?: number | null;
  height?: number | null;
  playable?: boolean | null; // null = unknown
  needsRemux?: boolean;
  assumed?: boolean;
};

export type P2pHealth = {
  ok: boolean;
  paused?: boolean;
  transcodeEnabled?: boolean;
  torrents?: {
    key: string;
    name: string | null;
    ready: boolean;
    progress: number;
    peers: number;
    downloadSpeed: number;
  }[];
};

async function jfetch<T>(path: string, init?: RequestInit, timeoutMs = 65_000): Promise<T> {
  const res = await fetch(`${BASE}${path}${path.includes("?") ? "&" : "?"}XTransformPort=${P2P_PORT}`, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok && data && typeof data === "object" && "error" in data && data.error) {
    throw new Error(String(data.error));
  }
  return data;
}

/** Join the swarm for an infoHash and pick a file. 202 = still discovering peers → poll status. */
export function p2pPrepare(
  infoHash: string,
  opts: { fileIdx?: number; filename?: string; filesize?: number } = {},
): Promise<P2pPrepareResult> {
  return jfetch<P2pPrepareResult>("/prepare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      infoHash,
      ...(Number.isInteger(opts.fileIdx) ? { fileIdx: opts.fileIdx } : {}),
      ...(opts.filename ? { filename: opts.filename } : {}),
    }),
  });
}

export function p2pStatus(key: string): Promise<P2pStatus> {
  return jfetch<P2pStatus>(`/status/${key}`, undefined, 15_000);
}

export function p2pCodec(key: string, fileIdx: number, filename?: string): Promise<P2pCodecReport> {
  const params = new URLSearchParams({ file: String(fileIdx) });
  if (filename) params.set("filename", filename);
  return jfetch<P2pCodecReport>(`/codec/${key}?${params.toString()}`, undefined, 45_000);
}

export function p2pHealth(): Promise<P2pHealth> {
  return jfetch<P2pHealth>("/health", undefined, 8_000);
}

export function p2pRemove(key: string): Promise<void> {
  return jfetch<void>(`/remove/${key}`, { method: "POST" }, 15_000).then(() => undefined);
}

export function p2pCleanup(purge: boolean): Promise<void> {
  return jfetch<void>("/cleanup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ purge }),
  }, 30_000).then(() => undefined);
}

/** Native range-capable URL for a browser-playable container (mp4/webm/mov). */
export function p2pStreamUrl(key: string, fileIdx: number): string {
  return `/stream/${key}/${fileIdx}${Q}`;
}

/** ffmpeg progressive remux URL (mkv → fMP4). Elements cannot re-fetch a
 *  progressive pipe arbitrarily, so seeking beyond the buffer re-opens this
 *  URL with ss=<seconds> — the engine drops packets until the target time.
 *  vtrans=h264 additionally re-encodes the video track (HEVC → H.264). */
export function p2pRemuxUrl(key: string, fileIdx: number, vtrans?: boolean, ssS?: number): string {
  const ss = ssS != null && ssS > 0 ? `&ss=${Math.round(ssS)}` : "";
  return `/remux/${key}/${fileIdx}${Q}${vtrans ? "&vtrans=h264" : ""}${ss}`;
}

/** Engine-level conversion support (cached; read from /health). */
let transcodeAvailCache: boolean | null = null;

export function cachedP2pTranscode(): boolean {
  return transcodeAvailCache === true;
}

export async function refreshP2pCapabilities(): Promise<boolean> {
  try {
    const h = await p2pHealth();
    transcodeAvailCache = h.transcodeEnabled === true;
  } catch {
    transcodeAvailCache = false;
  }
  return transcodeAvailCache;
}

export type P2pPlaybackPlan = {
  key: string;
  fileIdx: number;
  url: string;
  mode: "native" | "remux" | "unknown";
  codec?: P2pCodecReport;
};

/** Decide how to serve a torrent file: native stream for browser containers, ffmpeg remux for mkv etc.
 * The remux transcodes audio to AAC and stream-copies video, so any audio codec works —
 * HEVC video is re-encoded to H.264 when the engine has conversion enabled (TRANSCODE_ENABLED);
 * otherwise it is an honest dead end for P2P. */
export async function p2pPlan(
  infoHash: string,
  fileIdx: number,
  filename?: string,
): Promise<P2pPlaybackPlan> {
  const ext = (filename ?? "").toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
  const native = ["mp4", "m4v", "webm", "mov"].includes(ext);
  const remuxable = ["mkv", "avi", "ts", "wmv", "flv", "mpg", "mpeg"].includes(ext);
  if (native) {
    return { key: infoHash, fileIdx, url: p2pStreamUrl(infoHash, fileIdx), mode: "native" };
  }
  if (remuxable) {
    let codec: P2pCodecReport | undefined;
    try {
      codec = await p2pCodec(infoHash, fileIdx, filename);
    } catch {
      codec = undefined;
    }
    // HEVC video needs a real transcode — only possible when the engine has it enabled
    if (codec?.video === "hevc" || codec?.video === "h265") {
      if (transcodeAvailCache === true) {
        return { key: infoHash, fileIdx, url: p2pRemuxUrl(infoHash, fileIdx, true), mode: "remux", codec };
      }
      return { key: infoHash, fileIdx, url: p2pStreamUrl(infoHash, fileIdx), mode: "unknown", codec };
    }
    return { key: infoHash, fileIdx, url: p2pRemuxUrl(infoHash, fileIdx), mode: "remux", codec };
  }
  return { key: infoHash, fileIdx, url: p2pStreamUrl(infoHash, fileIdx), mode: "unknown" };
}

/** True when a stream object can be played right now without debrid (direct URL or via P2P engine). */
export function isFreePlayable(s: Stream): boolean {
  return (!!s.url && s.url !== "#") || !!s.infoHash;
}

export function formatSpeed(bytesPerSec?: number): string {
  if (!bytesPerSec || bytesPerSec <= 0) return "0 KB/s";
  if (bytesPerSec >= 1024 * 1024) return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
  return `${Math.round(bytesPerSec / 1024)} KB/s`;
}

export function formatEta(seconds?: number): string {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
