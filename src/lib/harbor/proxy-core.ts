// Harbor Web — shared SSRF-safe proxy fetch logic (used by /api/proxy and /api/proxy/raw)
import { NextRequest, NextResponse } from "next/server";
import dns from "dns/promises";
import net from "net";

export const MAX_BYTES = 24 * 1024 * 1024;
export const TIMEOUT_MS = 20_000;

const BLOCKED_HOST_PATTERNS = [/^localhost$/i, /\.local$/i, /^metadata/i];

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    if (parts[0] === 127 || parts[0] === 10 || parts[0] === 0) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] >= 224) return true;
    return false;
  }
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  if (lower.startsWith("fe80")) return true;
  if (lower.startsWith("ff")) return true;
  return false;
}

export async function assertPublicHost(hostname: string): Promise<void> {
  if (BLOCKED_HOST_PATTERNS.some((re) => re.test(hostname))) {
    throw new Error("blocked host");
  }
  if (net.isIPv4(hostname) || net.isIPv6(hostname)) {
    if (isPrivateIp(hostname)) throw new Error("blocked host");
    return;
  }
  const results = await dns.resolve4(hostname).catch(() => [] as string[]);
  const results6 = await dns.resolve6(hostname).catch(() => [] as string[]);
  const all = [...results, ...results6];
  if (all.length === 0) throw new Error("dns resolve failed");
  for (const ip of all) {
    if (isPrivateIp(ip)) throw new Error("blocked host");
  }
}

const buckets = new Map<string, number[]>();
export function rateLimit(ip: string, limit = 300, windowMs = 60_000): boolean {
  const now = Date.now();
  const list = (buckets.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= limit) {
    buckets.set(ip, list);
    return false;
  }
  list.push(now);
  buckets.set(ip, list);
  if (buckets.size > 10_000) buckets.clear();
  return true;
}

export function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function proxiedFetch(
  req: NextRequest,
): Promise<{ res: NextResponse; upstream?: Response }> {
  const ip = clientIp(req);
  if (!rateLimit(ip)) {
    return { res: NextResponse.json({ error: "rate limited" }, { status: 429 }) };
  }
  const target = req.nextUrl.searchParams.get("url");
  if (!target) {
    return { res: NextResponse.json({ error: "missing url" }, { status: 400 }) };
  }
  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return { res: NextResponse.json({ error: "invalid url" }, { status: 400 }) };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { res: NextResponse.json({ error: "unsupported protocol" }, { status: 400 }) };
  }
  try {
    await assertPublicHost(parsed.hostname);
  } catch (e) {
    return {
      res: NextResponse.json(
        { error: `blocked: ${e instanceof Error ? e.message : "ssrf"}` },
        { status: 403 },
      ),
    };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const upstream = await fetch(parsed.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json,text/plain,*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      },
      redirect: "follow",
      signal: controller.signal,
      cache: "no-store",
    });
    return { res: NextResponse.next(), upstream };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch failed";
    const isTimeout = msg.includes("abort") || msg.includes("timeout");
    return {
      res: NextResponse.json(
        { error: isTimeout ? "upstream timeout" : "upstream fetch failed" },
        { status: isTimeout ? 504 : 502 },
      ),
    };
  } finally {
    clearTimeout(timer);
  }
}
