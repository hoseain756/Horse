// Harbor Web — P2P torrent engine client
// Talks to the torrent engine in whichever mode the deployment supports
// (from /api/media/capabilities):
//   "builtin"  — mini-services/torrent-service (port 3031, behind the Caddy
//                gateway via the XTransformPort query param); media paths are
//                root-level relative so the gateway proxies Range requests.
//   "external" — operator self-hosted engine (ENGINE_URL): short JSON calls
//                relay through /api/engine/* (API key stays server-side),
//                media paths go DIRECTLY to the engine's public host with a
//                short-lived HMAC token (?k=exp.sig) minted by /api/engine/token.
//   "none"     — serverless without an engine: p2pEngineAvailable() answers
//                false instantly; no network request is ever made.
// All playback URLs are relative or point at the operator's engine — never at
// a hardcoded host. No content sources are bundled (neutral client).
"use client";

import type { Stream } from "./types";
import { cachedTorrentMode } from "./playback";

export const P2P_PORT = 3031;

// ---- engine media base + auth token (external mode) ----
// Token TTL is long (12 h) because seek-restarts rebuild media URLs at
// arbitrary times from synchronous code; builders refresh in the background
// once <30 min remain, so a build practically never uses a stale token.
const ENGINE_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const ENGINE_TOKEN_REFRESH_AHEAD_MS = 30 * 60 * 1000;
let engineMedia: { base: string; token: string | null; exp: number; refresh: Promise<void> | null } = {
  base: "",
  token: null,
  exp: 0,
  refresh: null,
};

/** Load the external-engine media base + token from /api/engine/token.
 *  No-op in builtin mode; resolves cache on concurrent calls. */
export function primeEngineMedia(): Promise<void> {
  if (cachedTorrentMode() !== "external") return Promise.resolve();
  if (engineMedia.refresh) return engineMedia.refresh;
  engineMedia.refresh = fetch("/api/engine/token")
    .then((r) => r.json() as Promise<{ available?: boolean; engineUrl?: string; token?: string; exp?: number }>)
    .then((j) => {
      engineMedia.base = j.available && j.engineUrl ? j.engineUrl.replace(/\/+$/, "") : "";
      engineMedia.token = j.available && j.token ? j.token : null;
      engineMedia.exp = j.available && j.exp ? j.exp : 0;
    })
    .catch(() => {
      /* engine relay unreachable — URLs fall back to gateway-relative (builtin) */
    })
    .finally(() => {
      engineMedia.refresh = null;
    });
  return engineMedia.refresh;
}

function engineMediaQuery(): string {
  if (cachedTorrentMode() === "external" && engineMedia.token) {
    if (engineMedia.exp - Date.now() < ENGINE_TOKEN_REFRESH_AHEAD_MS) void primeEngineMedia();
    return `k=${engineMedia.token}`;
  }
  return "";
}

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

export type P2pAudioTrack = {
  /** 0-based RELATIVE audio index — the remux `?audio=` selector. */
  rel: number;
  /** Absolute stream index in the container (informational). */
  index?: number;
  codec?: string | null;
  /** ISO 639 tag from the container ("eng", "ara", "ita"…) or null. */
  lang?: string | null;
  /** Track title as authored in the file ("English", "UITA AAC 5.1"…). */
  title?: string | null;
  channels?: number | null;
  default?: boolean;
  forced?: boolean;
};

export type P2pCodecReport = {
  error?: string;
  fileIdx?: number;
  filename?: string;
  container?: string | null;
  video?: string | null;
  audio?: string | null;
  /** Every audio/dub track in the file (multi-audio releases). Empty for
   *  native containers (streamed raw) — dub switching is remux-only. */
  audioTracks?: P2pAudioTrack[];
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
  // External engine: JSON endpoints relay server-side (key never reaches the
  // browser, path is allowlisted in the relay route). Builtin: gateway by port.
  const external = cachedTorrentMode() === "external";
  const url = external
    ? `/api/engine/${path}`
    : `${BASE}${path}${path.includes("?") ? "&" : "?"}XTransformPort=${P2P_PORT}`;
  const res = await fetch(url, {
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

// ---- engine availability probe (cached, in-flight deduped) ----
let engineProbe: { ok: boolean; at: number } | null = null;
let engineProbePromise: Promise<boolean> | null = null;

/**
 * True when the torrent engine answers /health. Cached: success 5 min,
 * failure 60 s (a freshly started engine is noticed quickly, while serverless
 * deployments that can never run the engine fail fast instead of stalling the
 * player through 100 s of peer polling against a 404). Concurrent callers
 * share one probe.
 *
 * Deployment truth first: when /api/media/capabilities says torrent:"none"
 * (Vercel without ENGINE_URL) this returns false WITHOUT touching the
 * network — the engine fundamentally cannot exist there. In external mode the
 * media base/token are primed opportunistically so later synchronous URL
 * builders already have them.
 */
export function p2pEngineAvailable(force = false): Promise<boolean> {
  const mode = cachedTorrentMode();
  if (mode === "none") {
    engineProbe = { ok: false, at: Date.now() };
    return Promise.resolve(false);
  }
  if (mode === "external") void primeEngineMedia();
  const now = Date.now();
  if (!force && engineProbe && now - engineProbe.at < (engineProbe.ok ? 300_000 : 60_000)) {
    return Promise.resolve(engineProbe.ok);
  }
  if (!engineProbePromise) {
    engineProbePromise = p2pHealth()
      .then((h) => {
        engineProbe = { ok: h.ok === true, at: Date.now() };
        return engineProbe.ok;
      })
      .catch(() => {
        engineProbe = { ok: false, at: Date.now() };
        return false;
      })
      .finally(() => {
        engineProbePromise = null;
      });
  }
  return engineProbePromise;
}

/** Last probe result without re-fetching: true / false / null (never probed). */
export function cachedEngineAvailable(): boolean | null {
  return engineProbe ? engineProbe.ok : null;
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

/** Native range-capable URL for a browser-playable container (mp4/webm/mov).
 *  Builtin mode: gateway-relative (Range passes straight through). External
 *  mode: direct to the engine's public host with the HMAC media token. */
export function p2pStreamUrl(key: string, fileIdx: number): string {
  if (cachedTorrentMode() === "external" && engineMedia.base) {
    const k = engineMediaQuery();
    return `${engineMedia.base}/stream/${key}/${fileIdx}${k ? `?${k}` : ""}`;
  }
  return `/stream/${key}/${fileIdx}${Q}`;
}

/** ffmpeg progressive remux URL (mkv → fMP4). Elements cannot re-fetch a
 *  progressive pipe arbitrarily, so seeking beyond the buffer re-opens this
 *  URL with ss=<seconds> — the engine drops packets until the target time.
 *  vtrans=h264 additionally re-encodes the video track (HEVC → H.264).
 *  audioRel selects the audio/dub track (0-based, from /codec audioTracks). */
export function p2pRemuxUrl(
  key: string,
  fileIdx: number,
  vtrans?: boolean,
  ssS?: number,
  audioRel?: number | null,
): string {
  const ss = ssS != null && ssS > 0 ? `ss=${Math.round(ssS)}` : "";
  const au = audioRel != null && audioRel > 0 ? `audio=${audioRel}` : "";
  if (cachedTorrentMode() === "external" && engineMedia.base) {
    const parts = [engineMediaQuery(), vtrans ? "vtrans=h264" : "", ss, au].filter(Boolean);
    return `${engineMedia.base}/remux/${key}/${fileIdx}${parts.length ? `?${parts.join("&")}` : ""}`;
  }
  return `/remux/${key}/${fileIdx}${Q}${vtrans ? "&vtrans=h264" : ""}${ss ? `&${ss}` : ""}${au ? `&${au}` : ""}`;
}

/** Engine-level conversion support (cached; read from /health). */
let transcodeAvailCache: boolean | null = null;

// ---- Audio/dub track selection (shared: player + picker) ----
// Container tags are ISO 639-2/3 ("eng","ara","ita"); settings carry display
// names ("English","Arabic"). The synonym table maps common dub languages to
// every tag/word they may appear as (lang tag OR track title substring).
const AUDIO_LANG_SYNONYMS: Record<string, string[]> = {
  english: ["english", "eng"],
  arabic: ["arabic", "ara", "arabic dub", "مترجم", "عربي"],
  italian: ["italian", "ita"],
  spanish: ["spanish", "spa", "español", "espanol", "latino", "castellano"],
  french: ["french", "fre", "fra", "français", "francais", "vff", "vfi", "vfq"],
  german: ["german", "ger", "deu", "deutsch"],
  japanese: ["japanese", "jpn", "日本語"],
  korean: ["korean", "kor"],
  chinese: ["chinese", "chi", "zho", "mandarin", "cantonese"],
  hindi: ["hindi", "hin"],
  turkish: ["turkish", "tur"],
  russian: ["russian", "rus"],
  persian: ["persian", "fas", "per", "farsi"],
  urdu: ["urdu", "urd"],
  portuguese: ["portuguese", "por", "br", "dublado"],
  hebrew: ["hebrew", "heb"],
  dutch: ["dutch", "nld", "dut", "vlaams"],
  polish: ["polish", "pol"],
  ukrainian: ["ukrainian", "ukr"],
  indonesian: ["indonesian", "ind", "bahasa"],
  malay: ["malay", "msa", "may"],
  thai: ["thai", "tha"],
  vietnamese: ["vietnamese", "vie"],
  filipino: ["filipino", "fil", "tagalog", "tgl"],
  czech: ["czech", "ces", "cze"],
  greek: ["greek", "ell", "gre"],
  swedish: ["swedish", "swe"],
  norwegian: ["norwegian", "nor"],
  danish: ["danish", "dan"],
  finnish: ["finnish", "fin"],
  hungarian: ["hungarian", "hun"],
  romanian: ["romanian", "ron", "rum"],
  bulgarian: ["bulgarian", "bul"],
  serbian: ["serbian", "srp"],
  croatian: ["croatian", "hrv"],
  slovak: ["slovak", "slk", "slo"],
  slovenian: ["slovenian", "slv"],
  catalan: ["catalan", "cat"],
  kannada: ["kannada", "kan"],
  tamil: ["tamil", "tam"],
  telugu: ["telugu", "tel"],
  malayalam: ["malayalam", "mal"],
  bengali: ["bengali", "ben", "bangla"],
  marathi: ["marathi", "mar"],
  punjabi: ["punjabi", "pan"],
  nepali: ["nepali", "nep"],
};

/** Best audio track for the user's preferred languages: first preference with
 *  a matching track wins; else the container's default-flagged track; else 0. */
export function pickAudioRel(tracks: P2pAudioTrack[], preferredLanguages?: string[]): number {
  if (!tracks.length) return 0;
  const hay = (t: P2pAudioTrack) => `${t.lang ?? ""} ${t.title ?? ""}`.toLowerCase();
  for (const pref of preferredLanguages ?? []) {
    const keys = AUDIO_LANG_SYNONYMS[pref.toLowerCase()] ?? [pref.toLowerCase()];
    const hit = tracks.find((t) => keys.some((k) => hay(t).includes(k)));
    if (hit) return hit.rel;
  }
  return tracks.find((t) => t.default)?.rel ?? 0;
}

/** Compact UI label for an audio track: authored title → lang tag → "Track N". */
export function audioTrackLabel(t: P2pAudioTrack, fallbackWord: string): string {
  const ch = t.channels ? (t.channels === 6 ? "5.1" : t.channels === 8 ? "7.1" : String(t.channels)) : null;
  const title = (t.title ?? "").trim() || null;
  const lang = (t.lang ?? "").toUpperCase() || null;
  const name = title || lang || `${fallbackWord} ${t.rel + 1}`;
  const parts = [name, ch, (t.codec ?? "").toUpperCase()].filter(Boolean);
  return parts.join(" · ");
}

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
  // Media URLs can be built before the opportunistic priming resolved — wait
  // for it (cheap no-op in builtin mode) so external tokens are present.
  await primeEngineMedia();
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
