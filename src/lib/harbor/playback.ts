// Harbor Web — playback planning (client)
// Stream classifier + URL builder + failure classifier for the browser
// playback pipeline. Works with the secure media proxy (/api/media) and the
// on-demand converter (/api/transcode). No content sources are bundled —
// this only decides HOW a user-installed addon's stream can play.
"use client";

import type { Stream } from "./types";

// ---------- server capabilities (probed once per session) ----------
/** Where torrent streams can play: "external" (self-hosted engine via
 *  ENGINE_URL), "builtin" (sandbox gateway, torrent-service on :3031), or
 *  "none" (serverless — a BitTorrent engine cannot run there). */
export type TorrentMode = "external" | "builtin" | "none";

export type Capabilities = {
  proxy: boolean;
  transcode: boolean;
  torrent: TorrentMode;
  enginePublicUrl: string | null;
};

let capsCache: Capabilities | null = null;
let capsPromise: Promise<Capabilities> | null = null;

export function serverCapabilities(): Promise<Capabilities> {
  if (capsCache) return Promise.resolve(capsCache);
  if (!capsPromise) {
    capsPromise = fetch("/api/media/capabilities")
      .then((r) => r.json() as Promise<{ proxy?: boolean; transcode?: boolean; torrent?: string; enginePublicUrl?: string }>)
      .then((j) => {
        const torrent: TorrentMode = j.torrent === "external" || j.torrent === "none" ? j.torrent : "builtin";
        capsCache = {
          proxy: j.proxy !== false,
          transcode: j.transcode === true,
          torrent,
          enginePublicUrl: torrent === "external" && typeof j.enginePublicUrl === "string" && j.enginePublicUrl ? j.enginePublicUrl : null,
        };
        return capsCache;
      })
      .catch(() => {
        capsCache = { proxy: true, transcode: false, torrent: "builtin", enginePublicUrl: null };
        return capsCache;
      });
  }
  return capsPromise;
}

export function cachedTranscodeSupported(): boolean {
  return capsCache?.transcode === true;
}

/** Last-known torrent engine mode: "external" / "builtin" / "none" / null
 *  (capabilities not fetched yet — callers treat null as "maybe builtin" and
 *  must not hard-block on it; the live engine probe still gates playback). */
export function cachedTorrentMode(): TorrentMode | null {
  return capsCache?.torrent ?? null;
}

// ---------- browser capability ----------
let browserProbe: { hevc: boolean; aac: boolean; ac3: boolean; hls: boolean } | null = null;

export function browserSupport(): { hevc: boolean; aac: boolean; ac3: boolean; hls: boolean } {
  if (browserProbe) return browserProbe;
  if (typeof document === "undefined") {
    browserProbe = { hevc: false, aac: true, ac3: false, hls: false };
    return browserProbe;
  }
  const v = document.createElement("video");
  browserProbe = {
    hevc:
      v.canPlayType('video/mp4; codecs="hvc1"') !== "" ||
      v.canPlayType('video/mp4; codecs="hev1"') !== "",
    aac: v.canPlayType('audio/mp4; codecs="mp4a.40.2"') !== "",
    ac3: v.canPlayType('audio/mp4; codecs="ac-3"') !== "",
    hls: v.canPlayType("application/vnd.apple.mpegurl") !== "",
  };
  return browserProbe;
}

// ---------- classification ----------
export type PlayVerdict = "direct" | "proxy" | "convert" | "external" | "unplayable";

export type StreamClass = {
  verdict: PlayVerdict;
  /** badge label key — resolved by the picker with the UI language */
  badge: "plays-here" | "plays-proxy" | "plays-convert" | "external" | "not-playable";
  reasons: string[];
  container: string | null;
  videoCodec: string | null;
  audioCodec: string | null;
  isHls: boolean;
  isTorrent: boolean;
  isMagnet: boolean;
  externalUrl: string | null;
  ytId: string | null;
  mixedContent: boolean;
};

const AUDIO_BAD = /^(ac3|eac3|dts|dtshd|truehd|atmos|ddp|dd\+|e-ac-?3|ac-?3)/i;
const VIDEO_BAD = /^(hevc|h265|x265|hev1|hvc1|dolby.?vision|dvhe|dvh1)/i;

function extOf(...candidates: (string | null | undefined)[]): string | null {
  for (const c of candidates) {
    if (!c) continue;
    const m = c.toLowerCase().match(/\.([a-z0-9]{2,4})(?:$|[?&])/);
    if (m) return m[1];
  }
  return null;
}

/** Classify a stream BEFORE the user picks it (sync — uses hints, no network). */
export function classifyStream(stream: Stream): StreamClass {
  const reasons: string[] = [];
  const filename = stream.behaviorHints?.filename ?? stream.parsed?.filename;
  const desc = stream.description ?? "";
  const title = stream.title ?? "";
  const url = stream.url ?? null;

  const isMagnet = /^(magnet:|infoHash:)/i.test(url ?? "") || (!url && !!stream.infoHash && !isHttpUrl(url));
  const isTorrent = (!!stream.infoHash && !url) || isMagnet;
  const isHls = !!url && (/\.m3u8(\?|$)/i.test(url) || url.includes("m3u8"));
  const externalUrl =
    (stream.behaviorHints?.openInBrowser && url ? url : null) ??
    (/^https?:\/\//i.test(url ?? "") && stream.behaviorHints?.openInBrowser ? url : null);
  const ytId =
    (url && /^[A-Za-z0-9_-]{11}$/.test(url) ? url : null) ??
    (/#ytid=([A-Za-z0-9_-]{11})/i.exec(desc)?.[1] ?? null);

  const ext = extOf(url, filename) ?? (/\.([a-z0-9]{2,4})/i.exec(` ${desc} `)?.[1] ?? null);
  const codecText = `${title} ${desc} ${filename ?? ""}`;
  const parsedCodec = stream.parsed?.codec?.toUpperCase() ?? null;
  const parsedAudio = stream.parsed?.audioCodec?.toUpperCase() ?? null;
  const videoBad = parsedCodec
    ? VIDEO_BAD.test(parsedCodec)
    : /\b(x265|hevc|h\.265|dolby.?vision|\bDV\b|hdr10)\b/i.test(codecText) && !/\b(x264|h\.264|avc)\b/i.test(codecText);
  const audioBad =
    (parsedAudio ? AUDIO_BAD.test(parsedAudio) : false) ||
    (parsedAudio === null && /\b(ac3|eac3|e-ac-?3|ddp?5|dd\+|dts(?:-hd)?|truehd|atmos)\b/i.test(codecText) && !/\b(aac|mp3|opus|flac)\b/i.test(codecText));

  const pageHttps = typeof location !== "undefined" && location.protocol === "https:";
  const mixedContent = !!url && /^http:\/\//i.test(url) && pageHttps;

  let verdict: PlayVerdict;
  let badge: StreamClass["badge"];

  if (ytId || (stream.behaviorHints?.openInBrowser && url)) {
    verdict = "external";
    badge = "external";
  } else if (isTorrent || isMagnet) {
    // Environment truth first: on a serverless host without an external
    // engine, torrent streams simply cannot play — say so up-front instead of
    // teasing a P2P badge and failing after the user presses play.
    if (cachedTorrentMode() === "none") {
      verdict = "unplayable";
      badge = "not-playable";
      reasons.push("P2P/torrent streams cannot play on this serverless host — a debrid key unlocks them");
    } else {
      const support = cachedTranscodeSupported();
      if (videoBad && !support) {
        verdict = "unplayable";
        badge = "not-playable";
        reasons.push("HEVC/DoVi video needs conversion, which is disabled on this server");
      } else if (videoBad) {
        verdict = "convert";
        badge = "plays-convert";
        reasons.push("HEVC/DoVi video will be converted to H.264");
      } else {
        // container/audio handled by the P2P engine's remux
        verdict = "proxy";
        badge = "plays-proxy";
      }
    }
  } else if (!url) {
    verdict = "unplayable";
    badge = "not-playable";
    reasons.push("no playable source in this stream object");
  } else if (stream.behaviorHints?.notWebReady) {
    // addon says the browser needs help — proxy always fixes CORS/headers
    verdict = cachedTranscodeSupported() ? "convert" : "proxy";
    badge = cachedTranscodeSupported() ? "plays-convert" : "plays-proxy";
    reasons.push("addon marked this stream not-web-ready");
  } else if (isHls) {
    verdict = "proxy"; // hls.js needs CORS on manifest+segments; proxy guarantees it
    badge = "plays-proxy";
  } else if (mixedContent) {
    verdict = "proxy";
    badge = "plays-proxy";
    reasons.push("http source on an https page — mixed content is blocked");
  } else {
    const containerOk = ext === null || ["mp4", "m4v", "webm", "mov"].includes(ext);
    if (videoBad || audioBad || !containerOk) {
      const support = cachedTranscodeSupported();
      if (!support && videoBad) {
        verdict = "unplayable";
        badge = "not-playable";
        reasons.push("HEVC/DoVi video needs conversion, which is disabled on this server");
      } else {
        verdict = "convert";
        badge = "plays-convert";
        if (videoBad) reasons.push("HEVC/DoVi video will be converted to H.264");
        if (audioBad) reasons.push("audio (AC3/DTS/TrueHD) will be converted to AAC");
        if (!containerOk) reasons.push(`${(ext ?? "?").toUpperCase()} container will be remuxed to MP4`);
      }
    } else {
      verdict = "direct";
      badge = "plays-here";
    }
  }

  return {
    verdict,
    badge,
    reasons,
    container: ext,
    videoCodec: parsedCodec,
    audioCodec: parsedAudio,
    isHls,
    isTorrent,
    isMagnet,
    externalUrl,
    ytId,
    mixedContent,
  };
}

function isHttpUrl(u: string | null): boolean {
  return !!u && /^https?:\/\//i.test(u);
}

/** Verdict rank for "playable first" sorting (lower = better). */
export function verdictRank(v: PlayVerdict): number {
  switch (v) {
    case "direct": return 0;
    case "proxy": return 1;
    case "convert": return 2;
    case "external": return 3;
    case "unplayable": return 4;
  }
}

// ---------- URL resolution ----------
export type ResolvedSource = {
  url: string;          // final URL for the <video> (direct or proxied)
  mode: "direct" | "proxy" | "transcode";
  viaProxy: boolean;
  host: string;
};

const resolvedCache = new Map<string, ResolvedSource>();

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

/**
 * Decide how to serve a direct (http/s) stream:
 * 1. proxyMode=never → direct attempt only.
 * 2. proxyMode=always → sign immediately.
 * 3. auto → probe the upstream (cached server-side): direct works when the
 *    host serves CORS headers; otherwise sign. Codec/container problems are
 *    handled by the caller through the transcode ladder.
 */
export async function resolveDirectSource(
  stream: Stream,
  opts: { proxyMode: "auto" | "always" | "never" },
): Promise<ResolvedSource> {
  const url = stream.url ?? "";
  const cacheKey = `${url}|${opts.proxyMode}`;
  const hit = resolvedCache.get(cacheKey);
  if (hit) return hit;
  const out = await (async (): Promise<ResolvedSource> => {
    const host = hostOf(url);
    if (opts.proxyMode === "never") {
      return { url, mode: "direct", viaProxy: false, host };
    }
    if (opts.proxyMode === "always") {
      return signSource(stream, "media");
    }
    // auto: header probe decides
    const probe = await fetch("/api/media/probe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, proxyHeaders: stream.behaviorHints?.proxyHeaders?.request ?? {} }),
    })
      .then((r) => r.json() as Promise<{ ok?: boolean; corsAllowOrigin?: string | null; contentType?: string | null }>)
      .catch(() => null);
    const corsOk = !!probe?.corsAllowOrigin;
    const isHls = /\.m3u8(\?|$)/i.test(url) || /mpegurl/i.test(probe?.contentType ?? "");
    if (corsOk && !isHls) {
      return { url, mode: "direct", viaProxy: false, host };
    }
    // HLS goes through the proxy even with CORS: our proxy rewrites child
    // URLs so segment/key CORS can never bite mid-playback.
    return signSource(stream, "media");
  })();
  resolvedCache.set(cacheKey, out);
  return out;
}

export async function signSource(
  stream: Stream,
  mode: "media" | "transcode",
  /** Transcode-mode seek-restart: signed ffmpeg -ss start offset (seconds). */
  startOffsetS = 0,
): Promise<ResolvedSource> {
  const url = stream.url ?? "";
  const res = await fetch("/api/media/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      mode,
      filename: stream.behaviorHints?.filename ?? stream.parsed?.filename,
      proxyHeaders: stream.behaviorHints?.proxyHeaders?.request ?? {},
      ...(mode === "transcode" && startOffsetS > 0 ? { ss: Math.floor(startOffsetS) } : {}),
    }),
  });
  const j = (await res.json().catch(() => ({}))) as { proxiedUrl?: string; error?: string };
  if (!res.ok || !j.proxiedUrl) {
    throw new Error(j.error ?? "signing failed");
  }
  return { url: j.proxiedUrl, mode: mode === "transcode" ? "transcode" : "proxy", viaProxy: true, host: hostOf(url) };
}

export function invalidateResolutionCache(): void {
  resolvedCache.clear();
}

// ---------- failure classification ----------
export type FailureClass =
  | "cors-or-network"   // retry through proxy
  | "codec"             // needs conversion
  | "expired"           // 403/404/410 → link dead
  | "timeout"           // slow / stalled
  | "fatal";            // unknown — offer picker

export type ClassifiedFailure = {
  cls: FailureClass;
  code: number | string | null;
  message: string;
};

export function classifyVideoError(err: { code?: number | null; message?: string | null }): ClassifiedFailure {
  const code = err.code ?? null;
  switch (code) {
    case 1: // MEDIA_ERR_ABORTED
      return { cls: "cors-or-network", code, message: "MEDIA_ERR_ABORTED" };
    case 2: // MEDIA_ERR_NETWORK
      return { cls: "cors-or-network", code, message: err.message ?? "MEDIA_ERR_NETWORK" };
    case 3: // MEDIA_ERR_DECODE
      return { cls: "codec", code, message: err.message ?? "MEDIA_ERR_DECODE" };
    case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
      return { cls: "codec", code, message: err.message ?? "MEDIA_ERR_SRC_NOT_SUPPORTED" };
    default:
      return { cls: "fatal", code, message: err.message ?? "UNKNOWN" };
  }
}

/** True when the failure looks like the source being gone (proxy answered 403/404/410). */
export function failureLooksExpired(statusLike: string): boolean {
  return /40[34]|410|expired/i.test(statusLike);
}

// ---------- H.264/AAC preference ----------
export function prefersH264(stream: Stream): boolean {
  const codec = (stream.parsed?.codec ?? "").toUpperCase();
  const text = `${stream.title ?? ""} ${stream.description ?? ""}`;
  if (/^(H264|H\.264|X264|AVC)$/.test(codec)) return true;
  return /\b(x264|h\.264|avc)\b/i.test(text) && !/\b(x265|hevc|h\.265)\b/i.test(text);
}
