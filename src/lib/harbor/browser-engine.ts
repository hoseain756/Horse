// Harbor Web — in-browser torrent engine (WebTorrent over WebRTC)
//
// The ZERO-INSTALL "one button" path: the user's browser itself becomes the
// torrent engine. Nothing to install, nothing to host, nothing to run — the
// page loads the official WebTorrent bundle on demand and renders the video
// straight into the player's <video> element via MediaSource.
//
// Honest physics (surfaced in the UI, never hidden):
//   • A browser cannot use UDP → no DHT. Discovery happens ONLY through
//     WSS (secure websocket) trackers, and transfers happen ONLY with
//     "web peers" — a subset of every swarm. Dead/quiet swarms won't play.
//   • No remux in the browser: mp4/m4v/webm/mov stream via MSE; MKV/AVI/TS
//     and HEVC/DoVi are honestly refused (the engine app or debrid unlocks
//     those instead).
//   • Console/TV browsers vary wildly: capability-first detection (WebRTC
//     data channels + MSE) decides, and Settings shows a per-device note.
//
// The engine script is loaded from the pinned official CDN bundle
// (cdn.jsdelivr.net, fallback unpkg) — CSP allows both hosts explicitly.
// No content sources are bundled or promoted: the self-test torrent is a
// free-licensed Blender sample (Sintel) used purely as a capability probe.
"use client";

import type { Stream } from "./types";

// ---- CDN bundle (pinned) ----
// v1.9.7: the last release whose browser bundle still INCLUDES MSE rendering
// (file.renderTo via the bundled render-media). webtorrent@2 unbundled it —
// its File API only exposes stream()/buffer(), so v2 cannot render without a
// custom MSE pipeline. The v1 root webtorrent.min.js is a UMD build that
// assigns window.WebTorrent directly.
export const BROWSER_ENGINE_SCRIPT = "https://cdn.jsdelivr.net/npm/webtorrent@1.9.7/webtorrent.min.js";
const SCRIPT_FALLBACKS = ["https://unpkg.com/webtorrent@1.9.7/webtorrent.min.js"];
const SCRIPT_TIMEOUT_MS = 20_000;

// Public WSS trackers — the ONLY discovery a browser can do (no UDP/DHT).
const WSS_TRACKERS = [
  "wss://tracker.openwebtorrent.com",
  "wss://tracker.webtorrent.dev",
  "wss://tracker.files.fm:7073/announce",
];

// Free-licensed capability probe (Blender's Sintel — web-seeded by
// webtorrent.dev with WSS trackers). Never promoted as content.
const SELF_TEST_INFOHASH = "08ada5a7a6183aae1e09d831df6748d566095a10";
const SELF_TEST_MAX_MS = 25_000;
const SELF_TEST_EARLY_MS = 8_000;

// Containers the browser can stream via MSE without remux.
const BROWSER_NATIVE_EXT = ["mp4", "m4v", "webm", "mov"];
// Containers that would need a remux the browser cannot do.
const BROWSER_HEAVY_EXT = ["mkv", "avi", "ts", "wmv", "flv", "mpg", "mpeg"];
const VIDEO_FILE_EXT = [...BROWSER_NATIVE_EXT, ...BROWSER_HEAVY_EXT];

export type BrowserEngineErrCode =
  | "no-webrtc"
  | "load-failed"
  | "no-peers"
  | "metadata-timeout"
  | "unsupported-container"
  | "no-video-file"
  | "render-failed";

export type BrowserEngineGate = "off" | "hevc" | "container" | "ok";

export type DeviceClass = "desktop" | "android" | "ios" | "console" | "tv" | "unknown";

// ---- capability detection (SSR-safe) ----
let supportCache: { webrtc: boolean; mse: boolean } | null = null;

/** WebRTC data channels + MediaSource Extensions — the hard requirements. */
export function browserEngineSupport(): { webrtc: boolean; mse: boolean; supported: boolean } {
  if (typeof window === "undefined") return { webrtc: false, mse: false, supported: false };
  if (!supportCache) {
    const webrtc = typeof RTCPeerConnection === "function" && typeof RTCSessionDescription === "function";
    let mse = typeof MediaSource === "function";
    if (mse) {
      try {
        mse = MediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E, mp4a.40.2"');
      } catch {
        mse = false;
      }
    }
    supportCache = { webrtc, mse };
  }
  return { ...supportCache, supported: supportCache.webrtc && supportCache.mse };
}

/** Coarse device class — used ONLY for honest messaging, never to hard-block
 *  (capability detection above is the gate; consoles that do expose WebRTC
 *  may try, with an "experimental" note). */
export function detectDeviceClass(): DeviceClass {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/PlayStation|Nintendo|Xbox/i.test(ua)) return "console";
  if (/Smart-?TV|SMART-TV|AppleTV|GoogleTV|HbbTV|NetCast|BRAVIA|webOS|Web0S|Tizen|Viera/i.test(ua)) return "tv";
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && !/Chrome/i.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/i.test(ua)) return "android";
  if (/Windows|Macintosh|Linux|CrOS/i.test(ua)) return "desktop";
  return "unknown";
}

// ---- settings read (localStorage — same store the settings page persists) ----
/** Read `browserEngineEnabled` straight from localStorage: playback code paths
 *  (classification, auto-select) run outside React and must not depend on
 *  store hydration. The value is written by the settings store on update. */
export function isBrowserEngineEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem("harbor-web.settings");
    if (!raw) return false;
    return (JSON.parse(raw) as { browserEngineEnabled?: boolean }).browserEngineEnabled === true;
  } catch {
    return false;
  }
}

/** Pre-play gate for a torrent stream against the in-browser engine. */
export function browserEngineStreamGate(s: Stream): BrowserEngineGate {
  if (!s.infoHash) return "off";
  if (!isBrowserEngineEnabled() || !browserEngineSupport().supported) return "off";
  const codec = (s.parsed?.codec ?? "").toUpperCase();
  if (/^(HEVC|H265|H\.265|X265|HEV1|HVC1|DOLBY.?VISION|DVH[ES]\d)/.test(codec)) return "hevc";
  const filename = s.behaviorHints?.filename ?? s.parsed?.filename ?? "";
  const ext = filename.toLowerCase().match(/\.([a-z0-9]{2,4})$/)?.[1] ?? "";
  if (ext && BROWSER_HEAVY_EXT.includes(ext)) return "container";
  return "ok";
}

// ---- WebTorrent script loader (CDN, pinned, with fallback) ----
type WebTorrentCtor = new (opts?: Record<string, unknown>) => WebTorrentClient;

interface WebTorrentFile {
  name: string;
  length: number;
  index: number;
  progress: number;
  getBlobURL(cb: (err: Error | null, url?: string) => void): void;
}

interface WebTorrentTorrent {
  infoHash: string;
  name?: string;
  files: WebTorrentFile[];
  numPeers: number;
  progress: number;
  downloadSpeed: number;
  timeRemaining: number;
  on(evt: string, cb: (...args: unknown[]) => void): void;
  destroy(opts?: Record<string, unknown>, cb?: () => void): void;
}

interface WebTorrentClient {
  torrents: WebTorrentTorrent[];
  add(torrentId: Record<string, unknown>, cb?: (torrent: WebTorrentTorrent) => void): WebTorrentTorrent;
  get(infoHash: string): WebTorrentTorrent | null;
  remove(infoHash: string, opts?: Record<string, unknown>, cb?: () => void): void;
  destroy(cb?: () => void): void;
}

declare global {
  interface Window {
    WebTorrent?: WebTorrentCtor;
  }
}

let scriptPromise: Promise<WebTorrentCtor> | null = null;

/** Classic <script> injection — the UMD build assigns window.WebTorrent. */
function loadClassic(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const el = document.createElement("script");
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("timeout"));
    }, SCRIPT_TIMEOUT_MS);
    const cleanup = () => {
      window.clearTimeout(timer);
      el.remove();
    };
    el.src = src;
    el.async = true;
    el.onload = () => {
      // Give the UMD wrapper a tick to assign the global.
      window.setTimeout(() => {
        cleanup();
        resolve();
      }, 0);
    };
    el.onerror = () => {
      cleanup();
      reject(new Error("load-error"));
    };
    document.head.appendChild(el);
  });
}

/**
 * ESM fallback via an inline `type="module"` bridge (for builds that ship as
 * ES modules, like webtorrent@2's dist file): imports the CDN URL, assigns
 * `window.WebTorrent` and dispatches `webtorrent-ready`.
 */
function loadViaModuleBridge(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const bridge = document.createElement("script");
    bridge.type = "module";
    bridge.textContent = `import WebTorrent from ${JSON.stringify(src)}; window.WebTorrent = WebTorrent; window.dispatchEvent(new Event("webtorrent-ready"));`;
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("timeout"));
    }, SCRIPT_TIMEOUT_MS);
    const cleanup = () => {
      window.clearTimeout(timer);
      window.removeEventListener("webtorrent-ready", onReady);
      bridge.remove();
    };
    const onReady = () => {
      if (typeof window.WebTorrent !== "function") return;
      cleanup();
      resolve();
    };
    window.addEventListener("webtorrent-ready", onReady);
    bridge.onerror = () => {
      cleanup();
      reject(new Error("load-error"));
    };
    document.head.appendChild(bridge);
    // Race guard: the event may have fired before the listener attached.
    if (typeof window.WebTorrent === "function") onReady();
  });
}

function loadWebTorrent(): Promise<WebTorrentCtor> {
  if (typeof window === "undefined") return Promise.reject(new Error("no-window"));
  if (typeof window.WebTorrent === "function") return Promise.resolve(window.WebTorrent);
  if (scriptPromise) return scriptPromise;
  scriptPromise = (async () => {
    const sources = [BROWSER_ENGINE_SCRIPT, ...SCRIPT_FALLBACKS];
    for (const src of sources) {
      // UMD first (webtorrent@1 assigns the global from a classic script);
      // module bridge second (webtorrent@2-style ESM builds).
      for (const loader of [loadClassic, loadViaModuleBridge]) {
        try {
          await loader(src);
          if (typeof window.WebTorrent === "function") return window.WebTorrent;
        } catch {
          /* try the next loader / CDN */
        }
      }
    }
    scriptPromise = null; // allow a later retry (network may recover)
    throw new Error("WebTorrent bundle unreachable from all CDNs");
  })();
  return scriptPromise;
}

let client: WebTorrentClient | null = null;

async function getClient(): Promise<WebTorrentClient> {
  const WT = await loadWebTorrent();
  if (!client) client = new WT();
  return client;
}

/** Kill the singleton client entirely (page keeps working; next use reloads). */
export function destroyBrowserEngine(): void {
  if (client) {
    try {
      client.destroy();
    } catch {
      /* ignore */
    }
    client = null;
  }
}

// ---- attach: render a torrent file into a <video> element ----
export type BrowserEngineAttachOpts = {
  infoHash: string;
  fileIdx: number | null;
  filename: string | null;
};

export type BrowserEngineStatusUpdate = {
  progress: number;
  peers: number;
  downloadSpeed: number;
  ready: boolean;
  name: string | null;
};

export type BrowserEngineCallbacks = {
  onStatus: (s: BrowserEngineStatusUpdate) => void;
  onReady: () => void;
  onError: (code: BrowserEngineErrCode, detail?: string) => void;
};

function extOfName(name: string): string {
  return name.toLowerCase().match(/\.([a-z0-9]{2,4})$/)?.[1] ?? "";
}

function pickFile(t: WebTorrentTorrent, opts: BrowserEngineAttachOpts): { file: WebTorrentFile | null; err: BrowserEngineErrCode | null } {
  const files = t.files ?? [];
  if (Number.isInteger(opts.fileIdx) && opts.fileIdx! >= 0 && opts.fileIdx! < files.length) {
    return { file: files[opts.fileIdx!], err: null };
  }
  const want = (opts.filename ?? "").toLowerCase();
  if (want) {
    const hit = files.find((f) => f.name.toLowerCase() === want) ?? files.find((f) => f.name.toLowerCase().includes(want));
    if (hit) return { file: hit, err: null };
  }
  // Largest video-ish file (single-file torrents fall through here too).
  const vids = files.filter((f) => VIDEO_FILE_EXT.includes(extOfName(f.name)));
  if (vids.length === 0) return { file: null, err: files.length > 0 ? "unsupported-container" : "no-video-file" };
  return { file: vids.reduce((a, b) => (b.length > a.length ? b : a), vids[0]), err: null };
}

const METADATA_TIMEOUT_MS = 45_000;
const STATUS_TICK_MS = 1_000;

/** Attach the torrent to the video element. Returns a stop function. */
export function attachBrowserTorrent(
  video: HTMLVideoElement,
  opts: BrowserEngineAttachOpts,
  cb: BrowserEngineCallbacks,
): () => void {
  let cancelled = false;
  let torrent: WebTorrentTorrent | null = null;
  let ready = false;
  let sawPeer = false;
  const timers: number[] = [];

  const cleanupVideo = () => {
    try {
      video.pause();
    } catch {
      /* ignore */
    }
    try {
      video.removeAttribute("src");
      video.load();
    } catch {
      /* ignore */
    }
  };

  void (async () => {
    let c: WebTorrentClient;
    try {
      c = await getClient();
    } catch {
      if (!cancelled) cb.onError("load-failed");
      return;
    }
    if (cancelled) return;

    let t: WebTorrentTorrent | null = null;
    try {
      t = c.add({ infoHash: opts.infoHash.toLowerCase(), announce: WSS_TRACKERS });
    } catch (e) {
      if (!cancelled) cb.onError("load-failed", e instanceof Error ? e.message : String(e));
      return;
    }
    if (cancelled) {
      try {
        t.destroy();
      } catch {
        /* ignore */
      }
      return;
    }
    torrent = t;

    // Blob-when-complete rendering (deliberate, honest design):
    // webtorrent@1's MSE pipeline (videostream) appends the init segments
    // but then stalls forever before the first media segment in several real
    // environments (measured live: init 736B+671B appended, then silence —
    // while createReadStream/getBuffer served the complete file instantly).
    // Native blob playback after the file finishes downloading is fully
    // seekable, universally reliable, and the player HUD shows the live
    // download progress meanwhile. For movie-sized files the honest answer
    // remains the engine app or debrid (surfaced in the UI limits text).
    let pickedFile: WebTorrentFile | null = null;
    let blobStarted = false;

    const startBlob = () => {
      if (cancelled || blobStarted || ready || !pickedFile) return;
      if ((pickedFile.progress ?? 0) < 1) return;
      blobStarted = true;
      pickedFile.getBlobURL((blobErr, url) => {
        if (cancelled) return;
        if (blobErr || !url) {
          cb.onError("render-failed", blobErr?.message ?? "no blob url");
          return;
        }
        ready = true;
        video.addEventListener(
          "loadedmetadata",
          () => {
            video.play().catch(() => {
              /* autoplay blocked; user gesture needed */
            });
          },
          { once: true },
        );
        video.src = url;
        cb.onReady();
      });
    };

    const onMetadata = () => {
      if (cancelled) return;
      const { file, err } = pickFile(t!, opts);
      if (!file || err) {
        cb.onError(err ?? "no-video-file");
        return;
      }
      pickedFile = file;
      startBlob(); // fully-seeded torrents play instantly
    };
    t.on("metadata", onMetadata);
    t.on("done", startBlob); // download finished → render

    const statusIv = window.setInterval(() => {
      if (cancelled || !torrent) return;
      if (torrent.numPeers > 0) sawPeer = true;
      if (pickedFile && !blobStarted) startBlob(); // poll file completeness
      cb.onStatus({
        progress: pickedFile ? (pickedFile.progress ?? torrent.progress ?? 0) : (torrent.progress ?? 0),
        peers: torrent.numPeers ?? 0,
        downloadSpeed: torrent.downloadSpeed ?? 0,
        ready,
        name: torrent.name ?? null,
      });
    }, STATUS_TICK_MS);
    timers.push(statusIv);

    // Watchdog: metadata needs at least one WSS-tracker peer. No metadata in
    // 45 s ⇒ either nobody answered (no web peers) or the network blocks WSS.
    const metaTimer = window.setTimeout(() => {
      if (cancelled || ready || torrent?.name) return;
      cb.onError(sawPeer ? "metadata-timeout" : "no-peers");
    }, METADATA_TIMEOUT_MS);
    timers.push(metaTimer);
  })();

  return () => {
    cancelled = true;
    timers.forEach((id) => {
      window.clearInterval(id);
      window.clearTimeout(id);
    });
    if (torrent) {
      try {
        torrent.destroy({ destroyStore: false });
      } catch {
        /* ignore */
      }
      torrent = null;
    }
    cleanupVideo();
  };
}

// ---- one-click self-test (Settings → P2P → "Test it now") ----
export type BrowserEngineTestReason = "no-webrtc" | "load-failed" | "no-peers" | "timeout";
export type BrowserEngineTestStage = { stage: "loading" | "swarm"; peers: number; speed: number };
export type BrowserEngineTestResult = {
  ok: boolean;
  peers: number;
  speed: number;
  reason: BrowserEngineTestReason | null;
};

/** Join the Sintel swarm for ≤25 s and report whether real web peers were
 *  reached. Proves: CDN reachable → WebRTC alive → WSS trackers answering. */
export async function browserEngineSelfTest(onStage?: (s: BrowserEngineTestStage) => void): Promise<BrowserEngineTestResult> {
  if (!browserEngineSupport().supported) {
    return { ok: false, peers: 0, speed: 0, reason: "no-webrtc" };
  }
  onStage?.({ stage: "loading", peers: 0, speed: 0 });
  let c: WebTorrentClient;
  try {
    c = await getClient();
  } catch {
    return { ok: false, peers: 0, speed: 0, reason: "load-failed" };
  }
  let t: WebTorrentTorrent | null = null;
  try {
    t = c.add({ infoHash: SELF_TEST_INFOHASH, announce: WSS_TRACKERS }, () => {
      /* metadata callback — the poller below reads fields live */
    });
  } catch {
    return { ok: false, peers: 0, speed: 0, reason: "load-failed" };
  }
  const started = Date.now();
  return await new Promise<BrowserEngineTestResult>((resolve) => {
    const finish = (res: BrowserEngineTestResult) => {
      window.clearInterval(iv);
      try {
        t?.destroy({ destroyStore: false });
      } catch {
        /* ignore */
      }
      resolve(res);
    };
    const iv = window.setInterval(() => {
      if (!t) {
        finish({ ok: false, peers: 0, speed: 0, reason: "load-failed" });
        return;
      }
      const peers = t.numPeers ?? 0;
      const speed = t.downloadSpeed ?? 0;
      onStage?.({ stage: peers > 0 ? "swarm" : "loading", peers, speed });
      const elapsed = Date.now() - started;
      const hasMeta = !!t.name || (t.files?.length ?? 0) > 0;
      // Early exit once the swarm is clearly alive (peers + metadata/traffic).
      if (peers > 1 && elapsed >= SELF_TEST_EARLY_MS && (hasMeta || speed > 0)) {
        finish({ ok: true, peers, speed, reason: null });
        return;
      }
      if (elapsed >= SELF_TEST_MAX_MS) {
        finish(peers > 0 || speed > 0 ? { ok: true, peers, speed, reason: null } : { ok: false, peers, speed, reason: "no-peers" });
      }
    }, 1_000);
  });
}
