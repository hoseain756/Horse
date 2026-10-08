// Harbor Web — POST /api/media/probe
// Header-sniffing probe used by the stream classifier: reports status,
// content-type, length, Accept-Ranges and whether the host itself serves CORS
// headers (i.e. whether direct playback is possible without our proxy).
//
// Duration truth (round: playback timeline): with `wantsDuration: true` the
// route ffprobes the TRUE source — signed /api/media and /api/transcode URLs
// are unwrapped (signature-verified) so the answer always describes the
// original title, with a signed transcode offset subtracted. Cached 10 minutes
// per source; SSRF-checked; rate limited; never runs when conversion is off.
import { NextRequest, NextResponse } from "next/server";
import {
  assertProxyableTarget,
  probeUpstream,
  sanitizeProxyHeaders,
  vaultGet,
  verifyProxySignature,
} from "@/lib/harbor/media-proxy";
import { ffprobeMedia } from "@/lib/harbor/transcode-core";
import { clientIp, rateLimit } from "@/lib/harbor/proxy-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProbeBody = { url?: unknown; proxyHeaders?: unknown; wantsDuration?: unknown };

// Duration cache: inner-source URL → seconds. Same TTL as the header probe.
const DURATION_TTL_MS = 10 * 60_000;
const durationCache = new Map<string, { durationS: number | null; at: number }>();

/** ffprobe total duration for the exact source a signed URL points at. */
async function resolveDurationS(
  url: string,
  headers: Record<string, string>,
): Promise<{ durationS: number | null; offsetS: number; via: string }> {
  let inner = url;
  let innerHeaders = headers;
  let offsetS = 0;
  let via = "direct";

  // Same-origin signed path? Verify the signature, unwrap the inner target.
  if (url.startsWith("/api/media?") || url.startsWith("/api/transcode?")) {
    try {
      const parsed = new URL(url, "http://internal.local");
      const verified = verifyProxySignature(parsed.searchParams);
      if (!verified) return { durationS: null, offsetS: 0, via: "signed-invalid" };
      inner = verified.url;
      offsetS = verified.mode === "transcode" ? verified.startOffsetS : 0;
      const vaultHeaders = verified.vaultId ? (vaultGet(verified.vaultId) ?? {}) : {};
      innerHeaders = Object.keys(vaultHeaders).length > 0 ? vaultHeaders : headers;
      via = verified.mode;
    } catch {
      return { durationS: null, offsetS: 0, via: "signed-invalid" };
    }
  }

  const cacheKey = `${via}|${offsetS}|${inner}`;
  const hit = durationCache.get(cacheKey);
  if (hit && Date.now() - hit.at < DURATION_TTL_MS) {
    return { durationS: hit.durationS, offsetS, via: `${via} (cached)` };
  }

  try {
    await assertProxyableTarget(inner);
  } catch {
    return { durationS: null, offsetS, via: `${via} blocked` };
  }
  const report = await ffprobeMedia(inner, innerHeaders);
  // FULL-SOURCE duration (what the title bar needs). The signed transcode
  // offset is returned separately so the client timeline can map element time
  // ↔ title time (element time = title time − offset).
  const durationS = report.durationS ?? null;
  durationCache.set(cacheKey, { durationS, at: Date.now() });
  if (durationCache.size > 500) {
    const cutoff = Date.now() - DURATION_TTL_MS;
    for (const [k, v] of durationCache) if (v.at < cutoff) durationCache.delete(k);
  }
  return { durationS, offsetS, via: `${via}${report.error ? ` (${report.error})` : " ffprobe"}` };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!rateLimit(clientIp(req), 90, 60_000)) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }
  let body: ProbeBody;
  try {
    body = (await req.json()) as ProbeBody;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url || url.length > 4096) {
    return NextResponse.json({ error: "missing url" }, { status: 400 });
  }
  const wantsDuration = body.wantsDuration === true;

  // Signed same-origin URLs are pre-trusted (HMAC); plain URLs must pass SSRF.
  if (!url.startsWith("/api/media?") && !url.startsWith("/api/transcode?")) {
    try {
      await assertProxyableTarget(url);
    } catch (e) {
      return NextResponse.json(
        { ok: false, error: `blocked: ${e instanceof Error ? e.message : "ssrf"}` },
        { status: 403 },
      );
    }
  }

  // Header probe only applies to real upstream URLs — signed same-origin paths
  // skip it (their header story is the media proxy's, not the inner host's).
  const out: Record<string, unknown> = url.startsWith("/api/")
    ? { ok: true, viaSignedPath: true }
    : { ...(await probeUpstream(url, sanitizeProxyHeaders(body.proxyHeaders))) };
  if (wantsDuration) {
    const headers = sanitizeProxyHeaders(body.proxyHeaders);
    const dur = await resolveDurationS(url, headers);
    out.durationS = dur.durationS;
    out.durationVia = dur.via;
  }
  return NextResponse.json(out, {
    headers: { "Cache-Control": "no-store" },
  });
}
