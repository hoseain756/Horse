// Harbor Web — GET /api/transcode
// On-demand ffmpeg remux/transcode for direct streams the browser cannot
// demux/decode natively (MKV container, AC3/DTS/TrueHD audio, HEVC video).
//
// Pipeline: ffprobe the upstream (through our own signed media proxy URL so
// SSRF/header handling stays in ONE place) → choose:
//   remux    — video copy + audio→AAC (container/audio problem only; cheap)
//   transcode— video→H.264 (veryfast) + audio→AAC (last resort; CPU heavy)
// Output: progressive fragmented MP4 (fMP4) streamed to the player.
//
// Gated by TRANSCODE_ENABLED (default OFF) with a graceful JSON error, capped
// concurrent sessions, wall-clock kill and client-disconnect cleanup.
import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { Readable } from "node:stream";
import {
  TRANSCODE_MAX_HOURS,
  acquireSession,
  ffprobeMedia,
  ffmpegPath,
  releaseSession,
  transcodeEnabled,
} from "@/lib/harbor/transcode-core";
import {
  CONNECT_TIMEOUT_MS,
  baseUpstreamHeaders,
  releaseStreamSlot,
  acquireStreamSlot,
  safeUpstreamFetch,
  vaultGet,
  verifyProxySignature,
} from "@/lib/harbor/media-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// NOTE: must be a plain literal — see src/app/api/media/route.ts for the
// full explanation (build-time static extraction rejects expressions).
export const maxDuration = 60;

export async function GET(req: NextRequest): Promise<NextResponse | Response> {
  if (!transcodeEnabled()) {
    return NextResponse.json(
      {
        error: "Conversion is disabled on this server (TRANSCODE_ENABLED).",
        reason: "transcode-disabled",
      },
      { status: 503 },
    );
  }
  const verified = verifyProxySignature(req.nextUrl.searchParams);
  if (!verified || verified.mode !== "transcode") {
    return NextResponse.json({ error: "invalid or expired signature" }, { status: 403 });
  }
  const { url, vaultId, filename, startOffsetS } = verified;
  const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  if (!acquireSession(sessionId)) {
    return NextResponse.json(
      { error: "All conversion slots are busy — try again shortly.", reason: "transcode-busy" },
      { status: 503 },
    );
  }

  const vaultHeaders = vaultId ? (vaultGet(vaultId) ?? {}) : {};

  // The upstream must be fetched THROUGH the media proxy so ffmpeg never does
  // its own DNS (SSRF surface) and proxyHeaders still apply. Build the signed
  // internal proxy URL from the verified target.
  const { signProxyUrl } = await import("@/lib/harbor/media-proxy");
  const internalProxyUrl = signProxyUrl({
    url,
    mode: "media",
    vaultId,
    filename,
    ttlS: Math.max(2 * 60 * 60, TRANSCODE_MAX_HOURS * 60 * 60),
  });
  const origin = req.nextUrl.origin;

  // Quick reachability check of the upstream before spawning ffmpeg
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CONNECT_TIMEOUT_MS);
    const probe = await safeUpstreamFetch(url, {
      method: "GET",
      headers: { ...baseUpstreamHeaders(vaultHeaders), Range: "bytes=0-1" },
      signal: controller.signal,
    });
    clearTimeout(timer);
    try {
      probe.res.body?.cancel();
    } catch {
      /* ignore */
    }
    if (probe.res.status >= 400) {
      releaseSession(sessionId);
      return NextResponse.json(
        { error: `Source is not reachable (HTTP ${probe.res.status}).`, reason: "upstream-status" },
        { status: 502 },
      );
    }
  } catch (e) {
    releaseSession(sessionId);
    const msg = e instanceof Error ? e.message : "upstream failed";
    return NextResponse.json({ error: `Source unreachable: ${msg}` }, { status: 502 });
  }

  // Probe codecs (+ duration) to decide remux vs transcode. The duration is
  // the ONLY reliable total-length source for the piped fMP4 output (empty_moov
  // carries no mehd — verified by box dump), so it is re-exported to the player
  // as X-Content-Duration and the timeline consumes it from the probe endpoint.
  const report = await ffprobeMedia(internalProxyUrl.startsWith("http") ? `${origin}${internalProxyUrl}` : internalProxyUrl, {});
  const video = report.video ?? null;
  const videoPlayable = video === null || ["h264", "vp8", "vp9", "av1", "mpeg4"].includes(video);
  const mode: "remux" | "transcode" = videoPlayable ? "remux" : "transcode";

  const ffArgs = [
    "-hide_banner", "-loglevel", "error",
    "-fflags", "+genpts",
    // Seek-restart support (timeline maps unseekable-fMP4 seeks here): a signed
    // start offset re-opens the source at the requested title position. Input
    // seeking (-ss BEFORE -i) is keyframe-fast and does not re-encode the lead-in.
    ...(startOffsetS > 0 ? ["-ss", String(startOffsetS)] : []),
    "-reconnect", "1", "-reconnect_streamed", "1", "-reconnect_on_network_error", "1",
    "-i", `${origin}${internalProxyUrl}`,
    "-map", "0:v:0", "-map", "0:a:0?",
    ...(mode === "remux"
      ? ["-c:v", "copy"]
      : ["-c:v", "libx264", "-preset", "veryfast", "-crf", "23"]),
    "-c:a", "aac", "-b:a", "256k",
    "-max_muxing_queue_size", "1024",
    "-movflags", "frag_keyframe+empty_moov+default_base_moof",
    "-f", "mp4", "pipe:1",
  ];

  const slotId = `tx-${sessionId}`;
  acquireStreamSlot(slotId);

  let ff: ReturnType<typeof spawn>;
  try {
    ff = spawn(ffmpegPath(), ffArgs, { stdio: ["ignore", "pipe", "pipe"] });
  } catch {
    releaseSession(sessionId);
    releaseStreamSlot(slotId);
    return NextResponse.json(
      { error: "ffmpeg could not be started on the host.", reason: "ffmpeg-missing" },
      { status: 503 },
    );
  }

  const cleanup = () => {
    releaseSession(sessionId);
    releaseStreamSlot(slotId);
    try {
      ff.stdin?.destroy();
    } catch {
      /* ignore */
    }
    try {
      ff.kill("SIGKILL");
    } catch {
      /* ignore */
    }
  };

  const wallTimer = setTimeout(() => cleanup(), TRANSCODE_MAX_HOURS * 60 * 60 * 1000);
  wallTimer.unref?.();
  req.signal.addEventListener("abort", cleanup);
  ff.on("close", () => {
    clearTimeout(wallTimer);
    releaseSession(sessionId);
    releaseStreamSlot(slotId);
  });
  ff.stderr?.on("data", (d) => {
    // host-only diagnostics; never the URL
    console.log(`[transcode ${sessionId.slice(0, 6)}]`, String(d).slice(0, 200));
  });
  ff.on("error", cleanup);

  if (!ff.stdout) {
    cleanup();
    return NextResponse.json({ error: "ffmpeg produced no output" }, { status: 500 });
  }

  const responseHeaders: Record<string, string> = {
    "Content-Type": "video/mp4",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "X-Content-Type-Options": "nosniff",
    "X-Harbor-Transcode": mode,
  };
  // Duration truth for the playback timeline: the piped fMP4 has no mehd box,
  // so the browser cannot know the length — we tell it (probe endpoint also
  // serves the same value for JS-side reads). Adjusted for the start offset so
  // the header always describes the OUTPUT timeline this session produces.
  if (report.durationS && report.durationS > 1) {
    const outDur = Math.max(1, report.durationS - startOffsetS);
    responseHeaders["X-Content-Duration"] = outDur.toFixed(3);
  }
  const codecs = [report.videoCodecStr, report.audioCodecStr].filter(Boolean).join(",");
  if (codecs) responseHeaders["X-Codecs"] = codecs;

  return new Response(Readable.toWeb(ff.stdout) as ReadableStream, {
    status: 200,
    headers: responseHeaders,
  });
}
