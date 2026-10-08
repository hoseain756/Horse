// Harbor Web — transcode-core (server-only)
// Shared helpers for the on-demand ffmpeg remux/transcode service:
// env configuration, session accounting, resource limits.
//
// Env:
//   TRANSCODE_ENABLED=1        — master switch (default OFF; graceful 503 when off)
//   FFMPEG_PATH / FFPROBE_PATH — binary paths (default: resolve from PATH)
//   TRANSCODE_MAX_SESSIONS     — concurrent ffmpeg sessions (default 2)
//   TRANSCODE_MAX_HOURS        — per-session wall-clock cap (default 3h)
import { spawn } from "node:child_process";

export const TRANSCODE_MAX_SESSIONS = Number(
  process.env.TRANSCODE_MAX_SESSIONS ?? 2,
);

export const TRANSCODE_MAX_HOURS = Number(process.env.TRANSCODE_MAX_HOURS ?? 3);

export function transcodeEnabled(): boolean {
  return /^(1|true|yes)$/i.test((process.env.TRANSCODE_ENABLED ?? "").trim());
}

export function ffmpegPath(): string {
  return process.env.FFMPEG_PATH?.trim() || "ffmpeg";
}

export function ffprobePath(): string {
  return process.env.FFPROBE_PATH?.trim() || "ffprobe";
}

const activeSessions = new Set<string>();

export function acquireSession(id: string): boolean {
  if (activeSessions.size >= TRANSCODE_MAX_SESSIONS) return false;
  activeSessions.add(id);
  return true;
}

export function releaseSession(id: string): void {
  activeSessions.delete(id);
}

export function activeSessionCount(): number {
  return activeSessions.size;
}

/** Boolean ffprobe availability probe (cached 5 min). */
let ffprobeOkCache: { ok: boolean; at: number } | null = null;

export async function ffprobeAvailable(): Promise<boolean> {
  if (!transcodeEnabled()) return false;
  if (ffprobeOkCache && Date.now() - ffprobeOkCache.at < 5 * 60_000) return ffprobeOkCache.ok;
  const ok = await new Promise<boolean>((resolve) => {
    try {
      const p = spawn(ffprobePath(), ["-version"]);
      p.on("error", () => resolve(false));
      p.on("close", (code) => resolve(code === 0));
      setTimeout(() => {
        try {
          p.kill();
        } catch {
          /* ignore */
        }
        resolve(false);
      }, 4000).unref();
    } catch {
      resolve(false);
    }
  });
  ffprobeOkCache = { ok, at: Date.now() };
  return ok;
}

export type MediaCodecReport = {
  container?: string | null;
  video?: string | null;
  audio?: string | null;
  width?: number | null;
  height?: number | null;
  /**
   * Best total duration in seconds (format.duration, falling back to the max
   * stream duration). Null when unknown (live input, pipe, probe failure).
   * Previously this data was fetched and thrown away — the player timeline
   * and the transcode route's X-Content-Duration header both need it.
   */
  durationS?: number | null;
  /** Codec strings precise enough to build an MSE sourceBuffer mimeType. */
  videoCodecStr?: string | null;
  audioCodecStr?: string | null;
  error?: string;
};

function parseBs(s: string | undefined): number | null {
  // ffprobe durations arrive as strings; a rational like "N/M" is possible in
  // some containers — take the integer part when we see a slash.
  if (!s) return null;
  const n = Number(s.split("/")[0]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** ffprobe a URL (safe: pass the SAME signed proxy URL we would play). */
export async function ffprobeMedia(
  url: string,
  headers: Record<string, string>,
): Promise<MediaCodecReport> {
  const ok = await ffprobeAvailable();
  if (!ok) return { error: transcodeEnabled() ? "ffprobe-missing" : "transcode-disabled" };
  const args = [
    "-v", "quiet",
    "-print_format", "json",
    "-show_format", "-show_streams",
    ...(Object.keys(headers).length > 0
      ? ["-headers", Object.entries(headers).map(([k, v]) => `${k}: ${v}\r\n`).join("")]
      : []),
    url,
  ];
  return new Promise<MediaCodecReport>((resolve) => {
    let stdout = "";
    let settled = false;
    const done = (r: MediaCodecReport) => {
      if (!settled) {
        settled = true;
        resolve(r);
      }
    };
    try {
      const p = spawn(ffprobePath(), args);
      p.stdout.on("data", (d) => (stdout += String(d)));
      p.on("error", () => done({ error: "ffprobe-spawn-failed" }));
      p.on("close", () => {
        try {
          const j = JSON.parse(stdout || "{}") as {
            streams?: {
              codec_type?: string;
              codec_name?: string;
              codec_tag_string?: string;
              profile?: string;
              width?: number;
              height?: number;
              duration?: string;
            }[];
            format?: { format_name?: string; duration?: string };
          };
          const streams = j.streams ?? [];
          const video = streams.find((s) => s.codec_type === "video");
          const audio = streams.find((s) => s.codec_type === "audio");
          // Duration truth: format.duration first, then the max stream duration
          // (some containers leave format.duration empty while streams know it).
          let durationS = parseBs(j.format?.duration);
          for (const s of streams) {
            const d = parseBs(s.duration);
            if (d != null && (durationS == null || d > durationS)) durationS = d;
          }
          done({
            container: (j.format?.format_name ?? "").split(",")[0] ?? null,
            video: video?.codec_name ?? null,
            audio: audio?.codec_name ?? null,
            width: video?.width ?? null,
            height: video?.height ?? null,
            durationS,
            videoCodecStr: video ? rfc6381Video(video) : null,
            audioCodecStr: audio ? rfc6381Audio(audio) : null,
          });
        } catch {
          done({ error: "probe-parse" });
        }
      });
      setTimeout(() => {
        try {
          p.kill("SIGKILL");
        } catch {
          /* ignore */
        }
        done({ error: "probe-timeout" });
      }, 20_000).unref();
    } catch {
      done({ error: "ffprobe-spawn-failed" });
    }
  });
}

/** RFC-6381-ish codec string for the video track (avc1.PPCCLL / hev1… / vp09…). */
function rfc6381Video(s: {
  codec_name?: string;
  codec_tag_string?: string;
  profile?: number | string;
  width?: number;
}): string | null {
  const codec = s.codec_name ?? "";
  const profile = typeof s.profile === "string" ? parseInt(s.profile, 10) : s.profile;
  if (codec === "h264") {
    // ftyp-level precision needs the raw PPS bytes; the numeric ffprobe profile
    // (66/77/100) with the implicit level 30 is what MSE accepts in practice.
    const ppc = profile === 100 ? 0x64 : profile === 77 ? 0x4d : profile === 66 ? 0x42 : 0x64;
    return `avc1.${ppc.toString(16).padStart(2, "0")}00${(30).toString(16).padStart(2, "0")}`;
  }
  if (codec === "hevc") return "hev1.1.6.L93.B0";
  if (codec === "vp9") return "vp09.00.10.08";
  if (codec === "vp8") return "vp8";
  if (codec === "av1") return "av01.0.01M.08";
  return null;
}

/** RFC-6381-ish codec string for the audio track (mp4a.40.2 / ac-3 / ec-3 / opus / flac). */
function rfc6381Audio(s: { codec_name?: string }): string | null {
  const codec = s.codec_name ?? "";
  if (codec === "aac") return "mp4a.40.2";
  if (codec === "ac3") return "ac-3";
  if (codec === "eac3") return "ec-3";
  if (codec === "opus") return "opus";
  if (codec === "flac") return "flac";
  if (codec === "mp3") return "mp3";
  return null;
}
