// Harbor Web — on-the-fly image transform proxy (GET /api/img)
// Powers hero art / LQIP thumbs / title-logo delivery: fetches a public
// http(s) image server-side, resizes it to the requested width (never
// upscales), optionally crops (fit=cover) and blurs (lqip=1), negotiates the
// best output format from the Accept header (AVIF > WebP > JPEG; PNG when
// alpha must be kept) and serves the result with year-long immutable caching.
//
// Security model (mirrors /api/proxy + /api/proxy/raw):
// - only http(s); SSRF host validation on EVERY redirect hop
//   (assertPublicHost — hostname blocklist + DNS resolves to public IPs only).
// - 12s upstream timeout, 24MB upstream cap, no client-supplied headers.
// - params are clamped: w 16..2560, h 16..4096, q 30..92; lqip forces a tiny
//   blurred thumb regardless of the requested width.
// - per-IP rate limit; bounded LRU caches (upstream bytes + encoded output)
//   keep repeat hits off the network with flat memory.
//
// Usage:
//   /api/img?u=<encoded upstream>&w=800[&q=80][&alpha=1][&lqip=1]
//           [&h=1100&fit=cover&pos=top|attention|centre]
import { NextRequest, NextResponse } from "next/server";
import { assertPublicHost, clientIp, rateLimit } from "@/lib/harbor/proxy-core";
import sharp from "sharp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPSTREAM_TIMEOUT_MS = 12_000;
const UPSTREAM_MAX_BYTES = 24 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

// ---------- bounded LRU caches ----------
type Entry = { buf: Buffer; at: number; bytes: number };
const MAX_OUT_ENTRIES = 160;
const MAX_OUT_BYTES = 64 * 1024 * 1024;
const MAX_UP_ENTRIES = 14;
const MAX_UP_BYTES = 48 * 1024 * 1024;
const imgCache = new Map<string, Entry>();
const upCache = new Map<string, Entry>();

function lruPut(map: Map<string, Entry>, key: string, buf: Buffer, maxEntries: number, maxBytes: number): void {
  map.set(key, { buf, at: Date.now(), bytes: buf.byteLength });
  let total = 0;
  for (const e of map.values()) total += e.bytes;
  // evict oldest-first when over either budget (Map iteration = insertion order)
  while ((map.size > maxEntries || total > maxBytes) && map.size > 1) {
    const oldest = map.keys().next().value as string;
    const b = map.get(oldest)?.bytes ?? 0;
    map.delete(oldest);
    total -= b;
  }
}

// in-flight upstream fetches (dedup stampede for the same URL)
const inflight = new Map<string, Promise<Buffer>>();

async function fetchUpstream(url: URL): Promise<Buffer> {
  const hit = inflight.get(url.href);
  if (hit) return hit;
  const p = (async () => {
    let current = new URL(url.href);
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (current.protocol !== "https:" && current.protocol !== "http:") throw new Error("bad protocol");
      await assertPublicHost(current.hostname); // re-validated per hop (blocks redirect-to-private / rebinding)
      const res = await fetch(current.href, {
        headers: { Accept: "image/avif,image/webp,image/*,*/*;q=0.8", "User-Agent": UA },
        redirect: "manual",
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        cache: "no-store",
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) throw new Error("bad redirect");
        current = new URL(loc, current);
        continue;
      }
      if (!res.ok) throw new Error(`upstream ${res.status}`);
      const len = Number(res.headers.get("content-length") ?? 0);
      if (len > UPSTREAM_MAX_BYTES) throw new Error("upstream too large");
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.byteLength > UPSTREAM_MAX_BYTES) throw new Error("upstream too large");
      const type = res.headers.get("content-type") ?? "";
      if (type && !type.startsWith("image/")) throw new Error("not an image");
      return buf;
    }
    throw new Error("too many redirects");
  })().finally(() => inflight.delete(url.href));
  inflight.set(url.href, p);
  return p;
}

function pickFormat(accept: string, keepAlpha: boolean): { fmt: "avif" | "webp" | "jpeg" | "png"; mime: string } {
  if (accept.includes("image/avif")) return { fmt: "avif", mime: "image/avif" };
  if (accept.includes("image/webp")) return { fmt: "webp", mime: "image/webp" };
  if (keepAlpha) return { fmt: "png", mime: "image/png" };
  return { fmt: "jpeg", mime: "image/jpeg" };
}

function clamp(v: string | null, min: number, max: number, dflt: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!rateLimit(`${clientIp(req)}:img`, 240, 60_000)) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }
  const sp = req.nextUrl.searchParams;
  const u = sp.get("u");
  if (!u) return NextResponse.json({ error: "missing u" }, { status: 400 });
  let parsed: URL;
  try {
    parsed = new URL(u);
  } catch {
    return NextResponse.json({ error: "bad url" }, { status: 400 });
  }

  const lqip = sp.get("lqip") === "1";
  const keepAlpha = sp.get("alpha") === "1";
  const w = clamp(sp.get("w"), lqip ? 8 : 16, 2560, 1280);
  const hRaw = sp.get("h");
  const h = hRaw ? clamp(hRaw, 16, 4096, 0) : 0;
  const pos = sp.get("pos") === "attention" ? "attention" : sp.get("pos") === "centre" ? "centre" : "top";
  const q = clamp(sp.get("q"), 30, 92, lqip ? 45 : 80);
  const { fmt, mime } = pickFormat(req.headers.get("accept") ?? "", keepAlpha && !lqip);

  const cacheKey = `${parsed.href}|${w}|${h}|${pos}|${q}|${fmt}|${lqip ? 1 : 0}`;
  const cached = imgCache.get(cacheKey);
  const etag = `"${cacheKey.length.toString(36)}-${w}-${fmt}${lqip ? "-l" : ""}${keepAlpha ? "-a" : ""}"`;
  if (cached && req.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag } });
  }
  if (cached) return imageResponse(cached.buf, mime, etag);

  let upstream: Buffer;
  try {
    const upHit = upCache.get(parsed.href);
    upstream = upHit ? upHit.buf : await fetchUpstream(parsed);
    if (!upHit) lruPut(upCache, parsed.href, upstream, MAX_UP_ENTRIES, MAX_UP_BYTES);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch failed";
    const isTimeout = msg.includes("timeout") || msg.includes("abort");
    return NextResponse.json(
      { error: isTimeout ? "upstream timeout" : `upstream failed: ${msg}` },
      { status: isTimeout ? 504 : msg.includes("blocked") || msg.includes("protocol") ? 403 : 502 },
    );
  }

  try {
    let pipe = sharp(upstream, { failOn: "none", animated: false }).rotate();
    if (lqip) {
      // tiny blurred placeholder thumb (crossfaded under the sharp art)
      pipe = pipe.resize({ width: Math.min(w, 24), withoutEnlargement: false }).blur(2.4);
    } else if (h > 0) {
      pipe = pipe.resize({
        width: w,
        height: h,
        fit: "cover",
        position: pos === "attention" ? sharp.strategy.attention : pos === "centre" ? "centre" : "top",
        withoutEnlargement: true,
      });
    } else {
      pipe = pipe.resize({ width: w, withoutEnlargement: true }); // never upscale
    }
    const out =
      fmt === "avif"
        ? await pipe.avif({ quality: q, effort: 3 }).toBuffer()
        : fmt === "webp"
          ? await pipe.webp({ quality: q }).toBuffer()
          : fmt === "png"
            ? await pipe.png({ compressionLevel: 9 }).toBuffer()
            : await pipe.jpeg({ quality: q, mozjpeg: true }).toBuffer();
    lruPut(imgCache, cacheKey, out, MAX_OUT_ENTRIES, MAX_OUT_BYTES);
    return imageResponse(out, mime, etag);
  } catch {
    return NextResponse.json({ error: "decode/encode failed" }, { status: 415 });
  }
}

function imageResponse(buf: Buffer, mime: string, etag: string): NextResponse {
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Length": String(buf.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
      ETag: etag,
      Vary: "Accept",
    },
  });
}
