// Harbor Web — secure media proxy core (server-only)
// Powers /api/media (streaming), /api/media/sign, /api/media/probe, /api/transcode.
//
// Security model:
// - Proxy URLs are HMAC-signed with a short-lived expiry (no open proxy). The
//   signature covers the upstream URL, expiry, mode and an optional header-vault id.
// - SSRF defense: only http/https, hostname blocklist, DNS resolution checked
//   for every address (v4+v6), redirects chased MANUALLY so every hop is
//   re-validated (blocks redirect-to-private and DNS rebinding between hops).
// - behaviorHints.proxyHeaders are held in an in-memory vault (TTL) and never
//   placed in URLs or logs. Full upstream URLs are never logged — host only.
// - Env knobs: MEDIA_PROXY_ALLOWLIST / MEDIA_PROXY_DENYLIST (comma-separated
//   host suffixes), PROXY_SECRET (HMAC key; auto-generated and stored under
//   db/ when absent so URLs survive dev restarts).
import dns from "dns/promises";
import fs from "fs";
import net from "net";
import path from "path";
import crypto from "crypto";

export const MEDIA_MAX_ACTIVE = 24;
export const SIGN_TTL_S = 2 * 60 * 60; // signed URLs valid 2h (covers long movies + seeks)
export const VAULT_TTL_MS = 6 * 60 * 60 * 1000;
export const PROBE_TIMEOUT_MS = 8_000;
export const CONNECT_TIMEOUT_MS = 15_000;
export const PROBE_CACHE_MS = 10 * 60 * 1000;

// ---------- secret ----------
let secretCache: string | null = null;

function loadSecret(): string {
  if (secretCache) return secretCache;
  const env = process.env.PROXY_SECRET?.trim();
  if (env && env.length >= 16) {
    secretCache = env;
    return secretCache;
  }
  // Persist a generated secret so signed URLs survive restarts without config
  try {
    const file = path.join(process.cwd(), "db", ".media-proxy-secret");
    if (fs.existsSync(file)) {
      secretCache = fs.readFileSync(file, "utf8").trim();
      if (secretCache) return secretCache;
    }
    secretCache = crypto.randomBytes(32).toString("hex");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, secretCache, { mode: 0o600 });
  } catch {
    secretCache = crypto.randomBytes(32).toString("hex");
  }
  return secretCache;
}

// ---------- host policy ----------
const BLOCKED_HOST_PATTERNS = [/^localhost$/i, /\.local$/i, /^metadata/i];

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    if (parts[0] === 127 || parts[0] === 10 || parts[0] === 0) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] >= 224) return true; // multicast/reserved
    return false;
  }
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA
  if (lower.startsWith("fe80")) return true; // link-local
  if (lower.startsWith("ff")) return true; // multicast
  return false;
}

function hostAllowedByList(hostname: string): boolean {
  const allow = (process.env.MEDIA_PROXY_ALLOWLIST ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const deny = (process.env.MEDIA_PROXY_DENYLIST ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const host = hostname.toLowerCase();
  for (const d of deny) {
    if (host === d || host.endsWith(`.${d}`)) return false;
  }
  if (allow.length === 0) return true;
  return allow.some((a) => host === a || host.endsWith(`.${a}`));
}

/** Validate an upstream URL for proxying. Throws with a safe reason on rejection. */
export async function assertProxyableTarget(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("invalid url");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("unsupported protocol");
  }
  if (parsed.username || parsed.password) throw new Error("credentials in url not allowed");
  if (!hostAllowedByList(parsed.hostname)) throw new Error("host not allowed");
  if (BLOCKED_HOST_PATTERNS.some((re) => re.test(parsed.hostname))) throw new Error("blocked host");
  if (net.isIP(parsed.hostname)) {
    if (isPrivateIp(parsed.hostname)) throw new Error("blocked host");
    return parsed;
  }
  let addrs: string[] = [];
  try {
    const [v4, v6] = await Promise.all([
      dns.resolve4(parsed.hostname).catch((): string[] => []),
      dns.resolve6(parsed.hostname).catch((): string[] => []),
    ]);
    addrs = [...v4, ...v6];
  } catch {
    throw new Error("dns resolve failed");
  }
  if (addrs.length === 0) throw new Error("dns resolve failed");
  for (const ip of addrs) {
    if (isPrivateIp(ip)) throw new Error("blocked host");
  }
  return parsed;
}

// ---------- header vault (proxyHeaders never travel in URLs) ----------
type VaultEntry = { headers: Record<string, string>; expiresAt: number };
const headerVault = new Map<string, VaultEntry>();

export function vaultPut(headers: Record<string, string>): string {
  const id = crypto.randomBytes(8).toString("hex");
  headerVault.set(id, { headers, expiresAt: Date.now() + VAULT_TTL_MS });
  if (headerVault.size > 500) {
    const now = Date.now();
    for (const [k, v] of headerVault) if (v.expiresAt < now) headerVault.delete(k);
  }
  return id;
}

export function vaultGet(id: string): Record<string, string> | null {
  const e = headerVault.get(id);
  if (!e) return null;
  if (e.expiresAt < Date.now()) {
    headerVault.delete(id);
    return null;
  }
  return e.headers;
}

const FORWARDABLE_HEADERS = new Set([
  "referer",
  "user-agent",
  "origin",
  "cookie",
  "authorization",
  "x-requested-with",
  "accept-language",
]);

export function sanitizeProxyHeaders(input: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!input || typeof input !== "object") return out;
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    const name = k.toLowerCase();
    if (!FORWARDABLE_HEADERS.has(name)) continue;
    if (typeof v !== "string" || v.length > 4096) continue;
    out[name] = v;
  }
  return out;
}

const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

// ---------- signing ----------
function hmac(payload: string): string {
  return crypto.createHmac("sha256", loadSecret()).update(payload).digest("base64url");
}

export type SignOpts = {
  url: string;
  mode?: "media" | "transcode";
  vaultId?: string;
  filename?: string;
  ttlS?: number;
  /** Transcode-only: signed ffmpeg -ss start offset (seek-restart support). */
  startOffsetS?: number;
};

export function signProxyUrl(opts: SignOpts): string {
  const exp = Math.floor(Date.now() / 1000) + (opts.ttlS ?? SIGN_TTL_S);
  const mode = opts.mode ?? "media";
  // A non-zero start offset participates in the signature: seek-restarts of a
  // transcode session carry ?ss=N and must not be forgeable beyond the signed
  // value (the offset feeds ffmpeg -ss server-side).
  const ss = opts.startOffsetS && opts.startOffsetS > 0 ? Math.floor(opts.startOffsetS) : 0;
  const payload = `${exp}|${mode}|${opts.vaultId ?? ""}|${opts.url}|${ss}`;
  const sig = hmac(payload);
  const qs = new URLSearchParams();
  qs.set("url", opts.url);
  qs.set("exp", String(exp));
  qs.set("mode", mode);
  if (opts.vaultId) qs.set("hv", opts.vaultId);
  if (opts.filename) qs.set("fn", opts.filename.slice(0, 200));
  if (ss > 0) qs.set("ss", String(ss));
  qs.set("sig", sig);
  // transcode-mode signatures are served by the ffmpeg route
  return `/api/${mode === "transcode" ? "transcode" : "media"}?${qs.toString()}`;
}

export function verifyProxySignature(
  params: URLSearchParams,
): { url: string; mode: "media" | "transcode"; vaultId?: string; filename?: string; startOffsetS: number } | null {
  const url = params.get("url");
  const exp = Number(params.get("exp"));
  const mode = params.get("mode") === "transcode" ? "transcode" : "media";
  const vaultId = params.get("hv") ?? undefined;
  const filename = params.get("fn") ?? undefined;
  const sig = params.get("sig");
  if (!url || !Number.isFinite(exp) || !sig) return null;
  if (exp * 1000 < Date.now()) return null;
  // The signed offset is the qs "ss" value AT SIGN TIME; a missing/0 ss is the
  // default. An attacker-supplied ss that differs from what was signed fails
  // the HMAC below.
  const ssRaw = params.get("ss");
  const startOffsetS = ssRaw != null && /^\d+$/.test(ssRaw) ? parseInt(ssRaw, 10) : 0;
  const expected = hmac(`${exp}|${mode}|${vaultId ?? ""}|${url}|${startOffsetS}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return { url, mode, vaultId, filename, startOffsetS };
}

// ---------- redirect-safe fetch ----------
export type UpstreamHop = { host: string; status: number };

/** Manual redirect chase so every hop's host is re-validated against SSRF rules. */
export async function safeUpstreamFetch(
  rawUrl: string,
  init: { headers?: Record<string, string>; method?: "GET" | "HEAD"; signal?: AbortSignal },
): Promise<{ res: Response; finalUrl: string; hops: UpstreamHop[] }> {
  let current = rawUrl;
  const hops: UpstreamHop[] = [];
  for (let i = 0; i < 6; i++) {
    const parsed = await assertProxyableTarget(current);
    if (!hostAllowedByList(parsed.hostname)) throw new Error("host not allowed");
    const res = await fetch(parsed.toString(), {
      method: init.method ?? "GET",
      headers: init.headers,
      redirect: "manual",
      signal: init.signal,
      cache: "no-store",
    });
    hops.push({ host: parsed.hostname, status: res.status });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return { res, finalUrl: current, hops };
      try {
        res.body?.cancel();
      } catch {
        /* ignore */
      }
      current = new URL(loc, parsed).toString();
      continue;
    }
    return { res, finalUrl: current, hops };
  }
  throw new Error("too many redirects");
}

export function baseUpstreamHeaders(
  extra: Record<string, string> = {},
): Record<string, string> {
  return {
    "User-Agent": DEFAULT_UA,
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    // identity: media must not be gzip-br-encoded or Range handling breaks
    "Accept-Encoding": "identity",
    ...extra,
  };
}

// ---------- concurrency guard ----------
const activeStreams = new Set<string>();

export function acquireStreamSlot(id: string): boolean {
  if (activeStreams.size >= MEDIA_MAX_ACTIVE) return false;
  activeStreams.add(id);
  return true;
}

export function releaseStreamSlot(id: string): void {
  activeStreams.delete(id);
}

// ---------- probe cache ----------
export type ProbeReport = {
  ok: boolean;
  status?: number;
  contentType?: string | null;
  contentLength?: number | null;
  acceptRanges?: boolean;
  corsAllowOrigin?: string | null;
  finalHost?: string;
  redirects?: number;
  error?: string;
  probedAt: number;
};

const probeCache = new Map<string, ProbeReport>();

export function probeCacheKey(url: string): string {
  return crypto.createHash("sha256").update(url).digest("hex").slice(0, 32);
}

export function getCachedProbe(url: string): ProbeReport | null {
  const hit = probeCache.get(probeCacheKey(url));
  if (!hit) return null;
  if (Date.now() - hit.probedAt > PROBE_CACHE_MS) {
    probeCache.delete(probeCacheKey(url));
    return null;
  }
  return hit;
}

export function storeProbe(url: string, report: ProbeReport): void {
  if (probeCache.size > 400) probeCache.clear();
  probeCache.set(probeCacheKey(url), report);
}

/** HEAD with GET+Range fallback; caches the report for the classifier. */
export async function probeUpstream(
  url: string,
  headers: Record<string, string>,
): Promise<ProbeReport> {
  const cached = getCachedProbe(url);
  if (cached) return cached;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  const finish = (r: ProbeReport) => {
    clearTimeout(timer);
    storeProbe(url, r);
    return r;
  };
  try {
    const { res, finalUrl, hops } = await safeUpstreamFetch(url, {
      method: "HEAD",
      headers: baseUpstreamHeaders(headers),
      signal: controller.signal,
    });
    try {
      res.body?.cancel();
    } catch {
      /* ignore */
    }
    if (res.status >= 400) {
      // some servers 404/405 HEAD → retry with a 1-byte GET
      const g = await safeUpstreamFetch(url, {
        method: "GET",
        headers: { ...baseUpstreamHeaders(headers), Range: "bytes=0-0" },
        signal: controller.signal,
      }).catch(() => null);
      if (g) {
        try {
          g.res.body?.cancel();
        } catch {
          /* ignore */
        }
        return finish({
          ok: g.res.ok,
          status: g.res.status,
          contentType: g.res.headers.get("content-type"),
          contentLength: contentLengthOf(g.res),
          acceptRanges: /bytes/i.test(g.res.headers.get("accept-ranges") ?? ""),
          corsAllowOrigin: g.res.headers.get("access-control-allow-origin"),
          finalHost: hostOf(g.finalUrl),
          redirects: Math.max(0, g.hops.length - 1),
          probedAt: Date.now(),
        });
      }
    }
    return finish({
      ok: res.ok,
      status: res.status,
      contentType: res.headers.get("content-type"),
      contentLength: contentLengthOf(res),
      acceptRanges: /bytes/i.test(res.headers.get("accept-ranges") ?? ""),
      corsAllowOrigin: res.headers.get("access-control-allow-origin"),
      finalHost: hostOf(finalUrl),
      redirects: Math.max(0, hops.length - 1),
      probedAt: Date.now(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "probe failed";
    const aborted = msg.includes("abort");
    return finish({ ok: false, error: aborted ? "timeout" : msg, probedAt: Date.now() });
  }
}

function contentLengthOf(res: Response): number | null {
  const cl = Number(res.headers.get("content-length"));
  const cr = res.headers.get("content-range");
  if (Number.isFinite(cl) && cl > 0) return cl;
  if (cr) {
    const total = Number(cr.split("/")[1]);
    if (Number.isFinite(total) && total > 0) return total;
  }
  return null;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

// ---------- HLS manifest rewriting ----------
const HLS_URI_RE = /URI="([^"]+)"/gi;

/**
 * Rewrite an HLS manifest so every segment / key / map / rendition URL is
 * wrapped in our signed proxy. Runs server-side, so signing per-line is free.
 * Returns null when the payload is not plausibly an HLS manifest.
 */
export function rewriteHlsManifest(body: string, manifestUrl: string): string | null {
  if (!body.includes("#EXTM3U")) return null;
  const base = manifestUrl;
  const wrap = (raw: string): string => {
    try {
      const abs = new URL(raw, base).toString();
      if (abs.startsWith("data:")) return raw;
      const signed = signProxyUrl({ url: abs, mode: "media", ttlS: SIGN_TTL_S });
      return signed;
    } catch {
      return raw;
    }
  };
  const lines = body.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      out.push(line);
      continue;
    }
    if (trimmed.startsWith("#")) {
      // rewrite URI="..." inside tags (EXT-X-KEY, EXT-X-MAP, EXT-X-MEDIA, I-FRAME…)
      out.push(line.replace(HLS_URI_RE, (_m, uri: string) => `URI="${wrap(uri)}"`));
      continue;
    }
    // plain segment / playlist line
    out.push(wrap(trimmed));
  }
  return out.join("\n");
}

export function guessContentType(url: string, upstreamType: string | null, filename?: string): string {
  const fromName = (name: string): string | null => {
    const ext = name.toLowerCase().match(/\.([a-z0-9]+)(?:\?|$)/)?.[1];
    switch (ext) {
      case "mp4": case "m4v": return "video/mp4";
      case "webm": return "video/webm";
      case "mkv": return "video/x-matroska";
      case "mov": return "video/quicktime";
      case "ts": return "video/mp2t";
      case "m3u8": return "application/vnd.apple.mpegurl";
      case "mpd": return "application/dash+xml";
      default: return null;
    }
  };
  if (upstreamType && /^video\/|^application\/vnd\.apple\.mpegurl|^application\/dash\+xml|^audio\//i.test(upstreamType)) {
    return upstreamType;
  }
  return fromName(url) ?? (filename ? fromName(filename) : null) ?? (upstreamType || "application/octet-stream");
}

export function looksLikeHls(url: string, contentType: string | null): boolean {
  return (
    /\.m3u8(\?|$)/i.test(url) ||
    (contentType != null && /mpegurl/i.test(contentType))
  );
}

export function looksLikeDash(url: string, contentType: string | null): boolean {
  return (
    /\.mpd(\?|$)/i.test(url) ||
    (contentType != null && /dash\+xml/i.test(contentType))
  );
}
