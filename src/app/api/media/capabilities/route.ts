// Harbor Web — GET /api/media/capabilities
// Tells the client which playback server features are available: secure proxy
// (always, once this route exists) and on-demand ffmpeg conversion (only when
// TRANSCODE_ENABLED=1 and the ffmpeg binaries are reachable).
import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { transcodeEnabled, ffmpegPath, ffprobePath } from "@/lib/harbor/transcode-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let ffmpegOkCache: { ok: boolean; at: number } | null = null;

async function ffmpegAvailable(): Promise<boolean> {
  if (!transcodeEnabled()) return false;
  if (ffmpegOkCache && Date.now() - ffmpegOkCache.at < 5 * 60_000) return ffmpegOkCache.ok;
  const ok = await new Promise<boolean>((resolve) => {
    let settled = false;
    const done = (v: boolean) => {
      if (!settled) {
        settled = true;
        resolve(v);
      }
    };
    try {
      const ff = spawn(ffmpegPath(), ["-version"]);
      ff.on("error", () => done(false));
      ff.on("close", (code) => done(code === 0));
      setTimeout(() => {
        try {
          ff.kill();
        } catch {
          /* ignore */
        }
        done(false);
      }, 4000).unref();
    } catch {
      done(false);
    }
  });
  ffmpegOkCache = { ok, at: Date.now() };
  return ok;
}

export async function GET(): Promise<NextResponse> {
  const ffmpeg = await ffmpegAvailable();
  return NextResponse.json(
    {
      proxy: true,
      transcode: ffmpeg,
      ffprobe: ffmpeg, // single capability bit keeps the client logic simple
      transcodeEnabled: transcodeEnabled(),
      ffmpegPathSet: Boolean(ffmpegPath() && ffprobePath()),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
