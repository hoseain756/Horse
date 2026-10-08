// Harbor Web — TMDB API route (server-side proxy with cache + rate limiting)
// GET /api/tmdb?path=/search/multi&query=batman&...extra params
// Path allowlist keeps the surface tight; creds live in env (or a validated
// user key passed via header "x-tmdb-user-key" — set by the validate route flow).
import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/harbor/proxy-core";
import { parseUserKey, tmdbFetch } from "@/lib/harbor/tmdb-server";

const PATH_RE = /^\/(search|movie|tv|trending|discover|find|genre|person|collection|watch|configuration)(\/[A-Za-z0-9_\-./{}]*)?$/;

export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  if (!rateLimit(`${ip}:tmdb`, 60, 60_000)) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }
  const path = req.nextUrl.searchParams.get("path") ?? "";
  if (!path.startsWith("/") || !PATH_RE.test(path)) {
    return NextResponse.json({ error: "invalid path" }, { status: 400 });
  }
  const params: Record<string, string> = {};
  for (const [k, v] of req.nextUrl.searchParams.entries()) {
    if (k === "path") continue;
    if (k === "api_key" || k === "language" || k === "region") continue; // server-controlled
    params[k] = v;
  }
  // Optional per-user key (set from Settings → validated). Header, never URL.
  const userKey = req.headers.get("x-tmdb-user-key") ?? undefined;
  const creds = userKey ? parseUserKey(userKey) : undefined;
  const lang = req.headers.get("x-tmdb-lang") ?? undefined;
  const region = req.headers.get("x-tmdb-region") ?? undefined;

  const result = await tmdbFetch(path, params, { creds, lang, region });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, configured: result.configured },
      { status: result.status >= 400 && result.status < 600 ? result.status : 502 },
    );
  }
  return NextResponse.json(result.body, {
    headers: { "Cache-Control": result.cached ? "private, max-age=30" : "private, no-store" },
  });
}
