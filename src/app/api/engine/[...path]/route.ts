// Harbor Web — /api/engine/[...path]
// Server-side relay to the OPTIONAL self-hosted torrent engine (ENGINE_URL).
//
// Why a relay: the browser must never see ENGINE_API_KEY. Short JSON calls
// (health/prepare/status/codec/remove/cleanup) are cheap and serverless-safe,
// so they relay through this function with the key attached server-side.
//
// Why media is NOT relayed: /stream and /remux are long-lived responses;
// streaming a movie through a serverless function is capped by maxDuration and
// egress — so the BROWSER hits the engine's media endpoints directly using
// ENGINE_PUBLIC_URL with a short-lived HMAC token minted by /api/engine/token.
// The engine host must therefore be publicly reachable (or same-domain behind
// a reverse proxy). Media paths requested here get an explicit, documented 400.
//
// SSRF safety: the destination host comes ONLY from ENGINE_URL (operator env);
// the client can influence neither host nor port — only an allowlisted path.
import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/harbor/proxy-core";
import { engineApiKey, engineUrl } from "@/lib/harbor/engine-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// JSON endpoints only. One dynamic segment max (/:key for status/codec/remove).
const ALLOWED = /^(health|prepare|cleanup|status\/[A-Za-z0-9_-]{1,80}|codec\/[A-Za-z0-9_-]{1,80}|remove\/[A-Za-z0-9_-]{1,80})$/;

const CALL_TIMEOUT_MS = 20_000;

function forwardHeaders(): Record<string, string> {
  const h: Record<string, string> = { Accept: "application/json" };
  const key = engineApiKey();
  if (key) h.Authorization = `Bearer ${key}`;
  return h;
}

async function relay(req: NextRequest, path: string, method: "GET" | "POST"): Promise<NextResponse> {
  const base = engineUrl();
  if (!base) {
    return NextResponse.json({ error: "no engine configured on this deployment" }, { status: 404 });
  }
  if (!ALLOWED.test(path)) {
    return NextResponse.json(
      { error: /stream|remux/i.test(path) ? "media is served directly by the engine host (ENGINE_PUBLIC_URL), not through this relay" : "unknown engine endpoint" },
      { status: 400 },
    );
  }
  if (!rateLimit(`${clientIp(req)}:engine-relay`, 120, 60_000)) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS);
  try {
    const init: RequestInit = {
      method,
      headers: forwardHeaders(),
      signal: controller.signal,
      cache: "no-store",
      ...(method === "POST" ? { body: await req.text() } : {}),
    };
    const res = await fetch(`${base}/${path}`, init);
    const text = await res.text();
    // Pass the engine's JSON through verbatim (it is a trusted first-party service).
    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("content-type") ?? "application/json", "Cache-Control": "no-store" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "engine unreachable";
    const isTimeout = /abort|timeout/i.test(msg);
    return NextResponse.json(
      { error: isTimeout ? "engine timed out" : "engine unreachable" },
      { status: isTimeout ? 504 : 502 },
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }): Promise<NextResponse> {
  const { path } = await ctx.params;
  return relay(req, (path ?? []).join("/"), "GET");
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }): Promise<NextResponse> {
  const { path } = await ctx.params;
  return relay(req, (path ?? []).join("/"), "POST");
}
