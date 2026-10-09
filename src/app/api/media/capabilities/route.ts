// Harbor Web — GET /api/media/capabilities
// Single source of truth for what THIS deployment can do. The client reads it
// once per session and uses it everywhere: stream classification, auto-select
// ranking, picker badges and honest error screens — "P2P not available" must
// never be discovered only after the user pressed play.
//
//   proxy:      secure media proxy route exists (always true here)
//   transcode:  on-demand ffmpeg conversion (TRANSCODE_ENABLED + binaries)
//   torrent:    "external" — ENGINE_URL points at a self-hosted engine
//               "builtin"  — sandbox/VM: the gateway routes XTransformPort=3031
//                            to the locally running torrent-service
//               "none"     — Vercel without ENGINE_URL: a BitTorrent engine
//                            cannot run serverless; torrents are unplayable
//   debrid:     the BYO-key debrid relay exists (per-user key decides actual
//               availability — read client-side from the integrations store)
import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { transcodeEnabled, ffmpegPath, ffprobePath } from "@/lib/harbor/transcode-core";
import { engineMode, enginePublicUrl } from "@/lib/harbor/engine-config";

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
  const torrent = engineMode();
  return NextResponse.json(
    {
      proxy: true,
      transcode: ffmpeg,
      ffprobe: ffmpeg, // single capability bit keeps the client logic simple
      transcodeEnabled: transcodeEnabled(),
      ffmpegPathSet: Boolean(ffmpegPath() && ffprobePath()),
      torrent,
      // Browser-direct media base for the external engine (omit otherwise —
      // never leak the internal URL when the client cannot use it anyway).
      ...(torrent === "external" && enginePublicUrl() ? { enginePublicUrl: enginePublicUrl() } : {}),
      debrid: true,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
