// Harbor Web — torrent-service
// Server-side BitTorrent streaming engine (webtorrent v3, Node runtime).
// Port of Harbor desktop's librqbit engine role: take an infoHash from a stream
// addon (e.g. Torrentio), join the swarm, pick the largest video file, and serve
// it over HTTP with Range support so the web player can stream while downloading.
//
// Endpoints (all bound to 127.0.0.1 — reached through the Caddy gateway):
//   GET  /health                 → engine status + active torrents
//   POST /prepare                → add/join a torrent, pick file, wait for metadata
//   GET  /status/:key            → per-torrent progress/peers/speed
//   GET  /stream/:key/:fileIdx   → native file stream (Range-capable, browser-ready containers)
//   GET  /remux/:key/:fileIdx    → ffmpeg progressive remux to fMP4 (mkv with h264/aac)
//                                  optional ?vtrans=h264 → transcodes HEVC video (CPU-heavy)
//   GET  /codec/:key             → ffprobe codec report for the selected file
//   POST /remove/:key            → destroy one torrent (keeps nothing)
//   POST /cleanup                → destroy all torrents, optional { purge: true } wipes cache dir
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import WebTorrent from "webtorrent";

const PORT = 3031;
const HOST = "127.0.0.1";
const CACHE_DIR = path.join(os.tmpdir(), "harbor-web-torrent-cache");
const METADATA_TIMEOUT_MS = 35_000;
const IDLE_TTL_MS = 45 * 60 * 1000; // destroy torrents nobody touched for 45 min
const MAX_TORRENTS = 6;
const PREPARE_TIMEOUT_MS = 60_000;
const MAX_REMUX = 2;
// On-demand video transcoding (HEVC→H.264) — gated by env like the main app.
const TRANSCODE_ENABLED = /^(1|true|yes)$/i.test((process.env.TRANSCODE_ENABLED ?? "").trim());

fs.mkdirSync(CACHE_DIR, { recursive: true });

const EXTRA_TRACKERS = [
  "wss://tracker.openwebtorrent.com",
  "wss://tracker.webtorrent.dev",
  "udp://tracker.opentrackr.org:1337/announce",
  "udp://open.tracker.cl:1337/announce",
  "udp://tracker.openbittorrent.com:6969/announce",
  "udp://exodus.desync.com:6969/announce",
  "http://tracker.opentrackr.org:1337/announce",
  "https://tracker.tamersunion.org:443/announce",
  "udp://tracker.torrent.eu.org:451/announce",
];

// NOTE: do NOT set downloadLimit/uploadLimit here — in webtorrent v3 a 0 limit
// throttles announce/DHT traffic itself and peer discovery silently dies.
const client = new WebTorrent({
  maxConns: 80,
});

const lastAccess = new Map(); // key → ms
const pendingSince = new Map(); // key → ms (torrents still waiting for metadata)
const remuxActive = new Set();
let paused = false;

// webtorrent v3 destroy() is callback-style and returns undefined — never chain .catch
function destroyTorrent(t, opts = {}) {
  if (!t) return Promise.resolve();
  return new Promise((resolve) => {
    try {
      t.destroy({ destroyStore: true, ...opts }, () => resolve());
      setTimeout(resolve, 400);
    } catch {
      resolve();
    }
  });
}

function log(...args) {
  console.log(`[torrent-service ${new Date().toISOString()}]`, ...args);
}

function send(res, status, body, extraHeaders = {}) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Range",
    ...extraHeaders,
  });
  res.end(data);
}

function readBody(req, limit = 16 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const HASH_RE = /^[0-9a-fA-F]{40}$/;
const VIDEO_EXT = /\.(mp4|m4v|webm|mkv|avi|mov|ts|flv|wmv|mpg|mpeg)$/i;

function normFilename(name) {
  return (name ?? "").toLowerCase().replace(/[\s._-]+/g, "");
}

// Pick which file inside the torrent to stream: explicit index > filename hint > largest video file
function pickFile(torrent, fileIdx, filename) {
  const files = torrent.files ?? [];
  if (files.length === 0) return null;
  const isVideo = (f) => VIDEO_EXT.test(f.name) || f.length > 100 * 1024 * 1024;
  if (Number.isInteger(fileIdx) && fileIdx >= 0 && fileIdx < files.length) {
    return { file: files[fileIdx], index: fileIdx, reason: "explicit" };
  }
  const videos = files
    .map((f, index) => ({ f, index }))
    .filter(({ f }) => isVideo(f));
  if (videos.length === 0) return { file: files[0], index: 0, reason: "no-video-fallback" };
  if (filename) {
    const want = normFilename(filename).slice(0, 40);
    const byName = videos.find(({ f }) => normFilename(f.name).includes(want.slice(0, 24)));
    if (byName) return { file: byName.f, index: byName.index, reason: "filename" };
  }
  const best = videos.reduce((a, b) => (b.f.length > a.f.length ? b : a));
  return { file: best.f, index: best.index, reason: "largest" };
}

function selectFile(torrent, fileIdx) {
  // deselect everything, then stream only the chosen file (saves bandwidth/disk)
  for (const f of torrent.files) f.deselect();
  torrent.files[fileIdx]?.select();
}

async function addTorrent(infoHash) {
  const existing = await client.get(infoHash); // v3: get() is async → Promise<Torrent|null>
  if (existing) return existing;
  const torrent = client.add(infoHash, {
    path: CACHE_DIR,
    deselect: true,
    strategy: "sequential",
    announce: EXTRA_TRACKERS,
  });
  return torrent;
}

function waitForMetadata(torrent) {
  if (torrent.files && torrent.files.length > 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("metadata-timeout"));
    }, METADATA_TIMEOUT_MS);
    const onMeta = () => {
      cleanup();
      resolve();
    };
    const cleanup = () => {
      clearTimeout(timer);
      torrent.off("metadata", onMeta);
      torrent.off("error", onError);
    };
    const onError = (err) => {
      cleanup();
      reject(err instanceof Error ? err : new Error(String(err)));
    };
    torrent.on("metadata", onMeta);
    torrent.on("error", onError);
  });
}

function torrentSnapshot(torrent) {
  const key = torrent.infoHash;
  return {
    key,
    name: torrent.name ?? null,
    ready: !!(torrent.files && torrent.files.length > 0),
    progress: Number((torrent.progress ?? 0).toFixed(4)),
    downloaded: torrent.downloaded ?? 0,
    downloadSpeed: Math.round(torrent.downloadSpeed ?? 0),
    uploadSpeed: Math.round(torrent.uploadSpeed ?? 0),
    peers: torrent.numPeers ?? 0,
    timeRemaining: torrent.timeRemaining ?? Infinity,
    length: torrent.length ?? 0,
    files: (torrent.files ?? []).slice(0, 30).map((f, idx) => ({
      index: idx,
      name: f.name,
      length: f.length,
    })),
  };
}

// ---------- codec probe (ffprobe over a small header dump) ----------
const codecCache = new Map(); // key → report

// Containers browsers demux natively — no probe needed, Range playback just works.
const NATIVE_EXT = /\.(mp4|m4v|webm|mov)$/i;

function probeFile(torrent, fileIdx) {
  return new Promise((resolve) => {
    const file = torrent.files[fileIdx];
    if (!file) return resolve({ error: "file-not-found" });
    if (NATIVE_EXT.test(file.name)) {
      return resolve({
        fileIdx,
        filename: file.name,
        container: path.extname(file.name).slice(1),
        video: null,
        audio: null,
        audioTracks: [], // native containers are streamed raw — track list unknown
        playable: true,
        needsRemux: false,
        assumed: true,
      });
    }
    const headBytes = Math.min(6 * 1024 * 1024, file.length);
    const tmp = path.join(os.tmpdir(), `harbor-probe-${crypto.randomBytes(6).toString("hex")}.bin`);
    const out = fs.createWriteStream(tmp);
    const rs = file.createReadStream({ start: 0, end: headBytes - 1 });
    let settled = false;
    const finish = (report) => {
      if (settled) return;
      settled = true;
      try { fs.unlinkSync(tmp); } catch { /* ignore */ }
      resolve(report);
    };
    rs.on("error", () => finish({ error: "read-error" }));
    out.on("error", () => { rs.destroy(); finish({ error: "tmp-error" }); });
    out.on("finish", () => {
      const ff = spawn("ffprobe", [
        "-v", "quiet", "-print_format", "json",
        "-show_format", "-show_streams", tmp,
      ]);
      let stdout = "";
      ff.stdout.on("data", (d) => (stdout += d));
      ff.on("error", () => finish({ error: "ffprobe-missing" }));
      ff.on("close", () => {
        try {
          const j = JSON.parse(stdout || "{}");
          const streams = j.streams ?? [];
          const video = streams.find((s) => s.codec_type === "video");
          const audioStreams = streams.filter((s) => s.codec_type === "audio");
          const audio = audioStreams[0];
          const v = video?.codec_name ?? null;
          const a = audio?.codec_name ?? null;
          const playableVideo = ["h264", "vp8", "vp9", "av1", "mpeg4"].includes(v);
          const playableAudio = a === null || ["aac", "mp3", "opus", "flac", "vorbis"].includes(a);
          finish({
            fileIdx,
            filename: file.name,
            container: (j.format?.format_name ?? "").split(",")[0] ?? null,
            video: v,
            audio: a,
            // FULL audio/dub track list (dub-switch feature): rel = the 0-based
            // audio selector for ffmpeg `-map 0:a:<rel>?` (remux ?audio= param).
            audioTracks: audioStreams.map((s, rel) => ({
              rel,
              index: s.index,
              codec: s.codec_name ?? null,
              lang: (s.tags?.language ?? "").toLowerCase() || null,
              title: s.tags?.title ?? null,
              channels: s.channels ?? null,
              default: !!(s.disposition?.default ?? false),
              forced: !!(s.disposition?.forced ?? false),
            })),
            width: video?.width ?? null,
            height: video?.height ?? null,
            playable: playableVideo && playableAudio,
            needsRemux: v === "h264" && /\.(mkv|avi|ts|wmv|flv|mpg|mpeg)$/i.test(file.name),
          });
        } catch {
          finish({ error: "probe-parse" });
        }
      });
    });
    rs.pipe(out);
  });
}

// ---------- HTTP server ----------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
  const p = url.pathname;

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Range",
    });
    return res.end();
  }

  try {
    // ---------- health ----------
    if (p === "/health") {
      return send(res, 200, {
        ok: true,
        version: "1.2.0",
        paused,
        torrents: client.torrents.map(torrentSnapshot),
        cacheDir: CACHE_DIR,
        remuxActive: remuxActive.size,
        transcodeEnabled: TRANSCODE_ENABLED,
      });
    }

    // ---------- prepare ----------
    if (p === "/prepare" && req.method === "POST") {
      const raw = await readBody(req);
      let body = {};
      try { body = JSON.parse(raw || "{}"); } catch { /* ignore */ }
      const infoHash = String(body.infoHash ?? "").toLowerCase();
      if (!HASH_RE.test(infoHash)) {
        return send(res, 400, { error: "Invalid infoHash (expected 40-char v1 hex)" });
      }
      if (paused) {
        return send(res, 503, { error: "Torrent engine is paused in Settings" });
      }
      lastAccess.set(infoHash, Date.now());
      // LRU: too many active torrents → drop the stalest
      while (client.torrents.length >= MAX_TORRENTS) {
        let oldest = null;
        for (const t of client.torrents) {
          const at = lastAccess.get(t.infoHash) ?? 0;
          if (!oldest || at < (lastAccess.get(oldest.infoHash) ?? 0)) oldest = t;
        }
        if (!oldest || oldest.infoHash === infoHash) break;
        log("LRU evicting", oldest.infoHash, oldest.name);
        await destroyTorrent(oldest);
        lastAccess.delete(oldest.infoHash);
      }
      let torrent;
      try {
        torrent = await addTorrent(infoHash);
      } catch (e) {
        return send(res, 500, { error: `Could not join swarm: ${e.message}` });
      }
      let metadataOk = torrent.files && torrent.files.length > 0;
      if (!metadataOk) {
        // Wait a bounded window for metadata; on timeout keep the torrent alive and
        // report `pending` so the client can poll /status while DHT discovery continues.
        metadataOk = await waitForMetadata(torrent)
          .then(() => true)
          .catch(() => false);
      }
      if (!metadataOk) {
        if (!pendingSince.has(infoHash)) pendingSince.set(infoHash, Date.now());
        log("prepare: metadata pending, keeping torrent alive for polling", infoHash, "peers:", torrent.numPeers);
        return send(res, 202, {
          key: infoHash,
          pending: true,
          name: torrent.name ?? null,
          peers: torrent.numPeers ?? 0,
        });
      }
      pendingSince.delete(infoHash);
      const picked = pickFile(torrent, body.fileIdx, body.filename);
      if (!picked) {
        return send(res, 404, { error: "Torrent has no files" });
      }
      selectFile(torrent, picked.index);
      const snap = torrentSnapshot(torrent);
      return send(res, 200, {
        ...snap,
        fileIdx: picked.index,
        pickedReason: picked.reason,
        filename: picked.file.name,
        size: picked.file.length,
      });
    }

    // ---------- status ----------
    const statusMatch = p.match(/^\/status\/([0-9a-fA-F]{40})$/);
    if (statusMatch) {
      const key = statusMatch[1].toLowerCase();
      const t = await client.get(key);
      if (!t) return send(res, 404, { ok: false, error: "torrent-not-active" });
      lastAccess.set(key, Date.now());
      return send(res, 200, { ok: true, ...torrentSnapshot(t) });
    }

    // ---------- codec ----------
    const codecMatch = p.match(/^\/codec\/([0-9a-fA-F]{40})$/);
    if (codecMatch) {
      const key = codecMatch[1].toLowerCase();
      const t = await client.get(key);
      if (!t || !t.files?.length) return send(res, 404, { error: "torrent-not-active" });
      lastAccess.set(key, Date.now());
      const urlFileIdx = Number(url.searchParams.get("file") ?? "NaN");
      const picked = pickFile(t, Number.isInteger(urlFileIdx) ? urlFileIdx : undefined, url.searchParams.get("filename") ?? undefined);
      if (!picked) return send(res, 404, { error: "file-not-found" });
      const cacheKey = `${key}:${picked.index}`;
      if (codecCache.has(cacheKey)) return send(res, 200, codecCache.get(cacheKey));
      const report = await probeFile(t, picked.index);
      if (!report.error) codecCache.set(cacheKey, report);
      return send(res, 200, report);
    }

    // ---------- remux (ffmpeg → progressive fMP4) ----------
    // ?vtrans=h264 additionally transcodes the video track (HEVC→H.264).
    // ?audio=N picks the audio track (0-based RELATIVE audio index — matches
    // /codec audioTracks[].rel). Dub-switch: the player re-opens this URL with
    // a new audio=N + ss=<now> (same seek-restart contract as below).
    // ?ss=N seeks: progressive pipes cannot input-seek, so ffmpeg uses an
    // OUTPUT seek (-ss after -i) and drops packets until the requested time —
    // cheap for -c:v copy (no decode). The player re-opens this URL with a
    // new ss on every out-of-buffer seek (seek-restart contract).
    // Video transcode is CPU-heavy and env-gated (TRANSCODE_ENABLED).
    const remuxMatch = p.match(/^\/remux\/([0-9a-fA-F]{40})\/(\d+)$/);
    if (remuxMatch) {
      const key = remuxMatch[1].toLowerCase();
      const idx = parseInt(remuxMatch[2], 10);
      const vtrans = url.searchParams.get("vtrans") === "h264";
      const ss = Math.max(0, parseFloat(url.searchParams.get("ss") ?? "0") || 0);
      const audioSel = Math.max(0, parseInt(url.searchParams.get("audio") ?? "0", 10) || 0);
      if (vtrans && !TRANSCODE_ENABLED) {
        return send(res, 503, { error: "Video conversion is disabled on this server (TRANSCODE_ENABLED)." });
      }
      const t = await client.get(key);
      const file = t?.files?.[idx];
      if (!file) return send(res, 404, { error: "torrent-not-active" });
      if (paused) return send(res, 503, { error: "Torrent engine is paused in Settings" });
      lastAccess.set(key, Date.now());
      if (remuxActive.size >= MAX_REMUX) {
        return send(res, 503, { error: "Remux busy — try again in a moment" });
      }
      selectFile(t, idx);
      remuxActive.add(key);
      res.writeHead(200, {
        "Content-Type": "video/mp4",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
        "X-Content-Type-Options": "nosniff",
        ...(vtrans ? { "X-Harbor-Transcode": "h264" } : {}),
        ...(audioSel > 0 ? { "X-Harbor-Audio": String(audioSel) } : {}),
      });
      log("remux start", key, idx, file.name, vtrans ? "(vtrans h264)" : "", `(a=${audioSel})`, ss > 0 ? `(ss=${ss})` : "");
      const ff = spawn("ffmpeg", [
        "-hide_banner", "-loglevel", "error",
        "-fflags", "+genpts",
        "-i", "pipe:0",
        // ?ss=N — output seek (after -i): drop packets/frames until the target
        // time. Works on non-seekable pipes where input -ss cannot.
        ...(ss > 0 ? ["-ss", String(ss)] : []),
        // Map the SELECTED audio track (?audio=N, default first). Multi-audio
        // releases (ITA+ENG dubs etc.) previously hard-served 0:a:0 with no
        // way to switch — now the player can pick any track via /codec list.
        "-map", "0:v:0", "-map", `0:a:${audioSel}?`,
        // Default: video stream-copy (fast); audio → AAC (mp4 muxing rejects
        // EAC3/DTS/TrueHD and browsers can't decode them anyway). With vtrans,
        // video is re-encoded to H.264 (last resort for HEVC — CPU-heavy).
        ...(vtrans
          ? ["-c:v", "libx264", "-preset", "veryfast", "-crf", "23"]
          : ["-c:v", "copy"]),
        "-c:a", "aac", "-b:a", "256k",
        "-max_muxing_queue_size", "1024",
        "-movflags", "frag_keyframe+empty_moov+default_base_moof",
        "-f", "mp4", "pipe:1",
      ]);
      const src = file.createReadStream({ start: 0 });
      src.pipe(ff.stdin);
      ff.stdout.pipe(res);
      const cleanupRemux = () => {
        remuxActive.delete(key);
        try { ff.stdin.destroy(); } catch { /* ignore */ }
        try { ff.kill("SIGKILL"); } catch { /* ignore */ }
        try { src.destroy(); } catch { /* ignore */ }
        log("remux end", key, idx);
      };
      req.on("close", cleanupRemux);
      ff.on("error", cleanupRemux);
      ff.stderr.on("data", (d) => log("ffmpeg:", String(d).trim().slice(0, 200)));
      return;
    }

    // ---------- native stream (Range-capable) ----------
    const streamMatch = p.match(/^\/stream\/([0-9a-fA-F]{40})\/(\d+)$/);
    if (streamMatch) {
      const key = streamMatch[1].toLowerCase();
      const idx = parseInt(streamMatch[2], 10);
      const t = await client.get(key);
      const file = t?.files?.[idx];
      if (!file) return send(res, 404, { error: "torrent-not-active" });
      if (paused) return send(res, 503, { error: "Torrent engine is paused in Settings" });
      lastAccess.set(key, Date.now());
      selectFile(t, idx);

      const total = file.length;
      const range = req.headers.range;
      const headers = {
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
        "Content-Type": contentTypeFor(file.name),
      };
      let start = 0;
      let end = total - 1;
      let status = 200;
      if (range) {
        const m = range.match(/bytes=(\d*)-(\d*)/);
        if (m) {
          if (m[1] === "" && m[2]) {
            // suffix range: last N bytes
            start = Math.max(0, total - parseInt(m[2], 10));
          } else {
            start = parseInt(m[1] || "0", 10);
            if (m[2]) end = Math.min(parseInt(m[2], 10), total - 1);
          }
          if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= total) {
            res.writeHead(416, { "Content-Range": `bytes */${total}`, ...headers });
            return res.end();
          }
          status = 206;
          headers["Content-Range"] = `bytes ${start}-${end}/${total}`;
        }
      }
      headers["Content-Length"] = String(end - start + 1);
      res.writeHead(status, headers);
      if (req.method === "HEAD") return res.end();
      log("stream", key, idx, `${start}-${end}`, file.name);
      const rs = file.createReadStream({ start, end });
      rs.on("error", () => {
        try { res.destroy(); } catch { /* ignore */ }
      });
      req.on("close", () => {
        try { rs.destroy(); } catch { /* ignore */ }
      });
      rs.pipe(res);
      return;
    }

    // ---------- remove ----------
    const removeMatch = p.match(/^\/remove\/([0-9a-fA-F]{40})$/);
    if (removeMatch && req.method === "POST") {
      const key = removeMatch[1].toLowerCase();
      const t = await client.get(key);
      if (!t) return send(res, 200, { ok: true, gone: true });
      await destroyTorrent(t);
      lastAccess.delete(key);
      pendingSince.delete(key);
      log("removed", key);
      return send(res, 200, { ok: true });
    }

    // ---------- cleanup ----------
    if (p === "/cleanup" && req.method === "POST") {
      const raw = await readBody(req).catch(() => "");
      let body = {};
      try { body = JSON.parse(raw || "{}"); } catch { /* ignore */ }
      const purge = body.purge === true;
      await Promise.all(client.torrents.map((t) => destroyTorrent(t, { destroyStore: purge })));
      lastAccess.clear();
      pendingSince.clear();
      codecCache.clear();
      if (purge) {
        try {
          for (const f of fs.readdirSync(CACHE_DIR)) {
            fs.rmSync(path.join(CACHE_DIR, f), { recursive: true, force: true });
          }
        } catch { /* ignore */ }
      }
      log(`cleanup (purge=${purge})`);
      return send(res, 200, { ok: true });
    }

    return send(res, 404, { error: "not-found", path: p });
  } catch (e) {
    log("handler error", e?.stack ?? e?.message ?? String(e));
    return send(res, 500, { error: e?.message ?? "internal" });
  }
});

function contentTypeFor(name) {
  const ext = path.extname(name).toLowerCase();
  switch (ext) {
    case ".mp4": case ".m4v": return "video/mp4";
    case ".webm": return "video/webm";
    case ".mkv": return "video/x-matroska";
    case ".ts": return "video/mp2t";
    case ".mov": return "video/quicktime";
    default: return "application/octet-stream";
  }
}

// ---------- TTL sweeper ----------
setInterval(() => {
  const now = Date.now();
  for (const t of client.torrents) {
    const at = lastAccess.get(t.infoHash) ?? 0;
    // Metadata never arrived and nobody asked for a while → give up on the swarm
    if (pendingSince.has(t.infoHash) && now - at > 90_000) {
      log("TTL destroying dead torrent (no metadata)", t.infoHash, "peers:", t.numPeers);
      pendingSince.delete(t.infoHash);
      destroyTorrent(t);
      lastAccess.delete(t.infoHash);
      continue;
    }
    if (now - at > IDLE_TTL_MS) {
      log("TTL destroying idle torrent", t.infoHash, t.name);
      destroyTorrent(t);
      lastAccess.delete(t.infoHash);
    }
  }
}, 60_000).unref();

server.listen(PORT, HOST, () => {
  log(`torrent-service listening on http://${HOST}:${PORT}`);
  log(`cache dir: ${CACHE_DIR}`);
});

client.on("error", (e) => log("client error:", e?.message ?? e));
process.on("SIGINT", () => client.destroy(() => process.exit(0)));
process.on("SIGTERM", () => client.destroy(() => process.exit(0)));
