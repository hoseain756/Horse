// Harbor Web — POST /api/media/sign
// Turns a stream URL (+ optional behaviorHints.proxyHeaders) into a signed,
// short-lived proxy URL. Rate limited, SSRF-checked, headers held in a
// server-side vault (never in the URL, never logged).
import { NextRequest, NextResponse } from "next/server";
import {
  assertProxyableTarget,
  sanitizeProxyHeaders,
  signProxyUrl,
  vaultPut,
} from "@/lib/harbor/media-proxy";
import { clientIp, rateLimit } from "@/lib/harbor/proxy-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SignBody = {
  url?: unknown;
  proxyHeaders?: unknown;
  filename?: unknown;
  mode?: unknown;
  /** Transcode-mode only: signed ffmpeg -ss start offset (seek restarts). */
  ss?: unknown;
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!rateLimit(clientIp(req), 120, 60_000)) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }
  let body: SignBody;
  try {
    body = (await req.json()) as SignBody;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url || url.length > 4096) {
    return NextResponse.json({ error: "missing or oversized url" }, { status: 400 });
  }
  if (/^(magnet:|rtsp:|rtmp:)/i.test(url)) {
    return NextResponse.json(
      { error: "unsupported protocol", reason: "torrent-or-stream-protocol" },
      { status: 400 },
    );
  }
  try {
    await assertProxyableTarget(url);
  } catch (e) {
    return NextResponse.json(
      { error: `blocked: ${e instanceof Error ? e.message : "ssrf"}`, reason: "blocked-host" },
      { status: 403 },
    );
  }
  const headers = sanitizeProxyHeaders(body.proxyHeaders);
  const vaultId = Object.keys(headers).length > 0 ? vaultPut(headers) : undefined;
  const filename = typeof body.filename === "string" ? body.filename : undefined;
  const mode = body.mode === "transcode" ? "transcode" : "media";
  const ssRaw = typeof body.ss === "number" ? body.ss : Number(body.ss);
  const ss = Number.isFinite(ssRaw) && ssRaw > 0 ? Math.min(Math.floor(ssRaw), 24 * 3600) : 0;
  const proxiedUrl = signProxyUrl({ url, mode, vaultId, filename, startOffsetS: mode === "transcode" ? ss : 0 });
  return NextResponse.json({
    proxiedUrl,
    // diagnostics for the player's technical-details panel (host only, never the full URL)
    host: safeHost(url),
  });
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}
