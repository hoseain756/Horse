// Harbor Web — GET /api/media
// Secure streaming media proxy: pipes a signed upstream media URL to the
// browser with full HTTP Range support (seeking), behaviorHints.proxyHeaders
// forwarding, safe redirect chasing and on-the-fly HLS manifest rewriting.
// Access requires a valid HMAC signature (see /api/media/sign) — this is not
// an open proxy. Full upstream URLs are never logged (host only).
import { NextRequest, NextResponse } from "next/server";
import {
  CONNECT_TIMEOUT_MS,
  acquireStreamSlot,
  baseUpstreamHeaders,
  guessContentType,
  looksLikeDash,
  looksLikeHls,
  releaseStreamSlot,
  rewriteHlsManifest,
  safeUpstreamFetch,
  vaultGet,
  verifyProxySignature,
} from "@/lib/harbor/media-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60 * 60 * 3; // long movies on supporting hosts

export async function GET(req: NextRequest): Promise<NextResponse> {
  const params = req.nextUrl.searchParams;
  const verified = verifyProxySignature(params);
  if (!verified) {
    return NextResponse.json({ error: "invalid or expired signature" }, { status: 403 });
  }
  const { url, mode, vaultId, filename } = verified;
  if (mode === "transcode") {
    // transcode requests are served by /api/transcode; media route only handles media
    return NextResponse.json(
      { error: "transcode mode must be requested from /api/transcode" },
      { status: 400 },
    );
  }

  const slotId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const isHls = looksLikeHls(url, null);
  const vaultHeaders = vaultId ? (vaultGet(vaultId) ?? {}) : {};
  const range = req.headers.get("range");
  const headers = baseUpstreamHeaders(vaultHeaders);
  if (range && !isHls) headers.Range = range;

  const controller = new AbortController();
  const connectTimer = setTimeout(() => controller.abort(), CONNECT_TIMEOUT_MS);
  let upstream: Response;
  let finalUrl = url;
  try {
    const out = await safeUpstreamFetch(url, { headers, signal: controller.signal });
    upstream = out.res;
    finalUrl = out.finalUrl;
  } catch (e) {
    clearTimeout(connectTimer);
    const msg = e instanceof Error ? e.message : "upstream failed";
    const aborted = /abort|timeout/i.test(msg);
    return NextResponse.json(
      { error: aborted ? "upstream timeout" : `upstream failed: ${msg}` },
      { status: aborted ? 504 : 502 },
    );
  }
  clearTimeout(connectTimer);

  if (!upstream.ok && !upstream.headers.get("content-type")) {
    return NextResponse.json(
      { error: `upstream status ${upstream.status}` },
      { status: upstream.status === 403 || upstream.status === 404 ? upstream.status : 502 },
    );
  }

  const upstreamType = upstream.headers.get("content-type");
  const isHlsUpstream = isHls || looksLikeHls(finalUrl, upstreamType);
  const isDash = looksLikeDash(finalUrl, upstreamType);

  const commonHeaders: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
  };

  // ---- HLS manifest: rewrite every child URL through this proxy ----
  if (isHlsUpstream) {
    try {
      const text = await upstream.text();
      const rewritten = rewriteHlsManifest(text, finalUrl) ?? text;
      return new NextResponse(rewritten, {
        status: 200,
        headers: {
          ...commonHeaders,
          "Content-Type": "application/vnd.apple.mpegurl",
          "Content-Length": String(Buffer.byteLength(rewritten)),
        },
      });
    } catch {
      return NextResponse.json({ error: "manifest read failed" }, { status: 502 });
    }
  }

  // ---- DASH manifest: pass through so an MPD-aware client can still fetch it
  //      through the proxy (segments referenced absolutely will not be proxied;
  //      DASH is a passthrough courtesy, not a playback promise).
  if (isDash) {
    const text = await upstream.text().catch(() => null);
    if (text != null) {
      return new NextResponse(text, {
        status: 200,
        headers: { ...commonHeaders, "Content-Type": "application/dash+xml" },
      });
    }
  }

  // ---- binary media: stream through with Range fidelity ----
  if (!acquireStreamSlot(slotId)) {
    return NextResponse.json({ error: "too many active streams" }, { status: 503 });
  }

  const passHeaders: Record<string, string> = {
    ...commonHeaders,
    "Content-Type": guessContentType(finalUrl, upstreamType, filename ?? undefined),
  };
  const contentLength = upstream.headers.get("content-length");
  if (contentLength) passHeaders["Content-Length"] = contentLength;
  const contentRange = upstream.headers.get("content-range");
  if (contentRange) passHeaders["Content-Range"] = contentRange;

  let released = false;
  const release = () => {
    if (!released) {
      released = true;
      releaseStreamSlot(slotId);
      try {
        upstream.body?.cancel();
      } catch {
        /* ignore */
      }
    }
  };

  if (!upstream.body) {
    release();
    return NextResponse.json({ error: "upstream has no body" }, { status: 502 });
  }

  const status = contentRange ? 206 : upstream.status;
  return new NextResponse(upstream.body, { status, headers: passHeaders });
}

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Range",
    },
  });
}
