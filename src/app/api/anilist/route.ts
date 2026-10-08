// Harbor Web — AniList GraphQL proxy (server-side)
// Forwards whitelisted GraphQL queries to graphql.anilist.co with an in-memory
// response cache. AniList is a public, no-auth metadata API (anilist.co).
// NOTE: This is metadata only — Harbor Web hosts and streams no content.
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API = "https://graphql.anilist.co";
const TTL_MS = 5 * 60_000; // 5 minutes
const MAX_ENTRIES = 200;
const MAX_QUERY_LEN = 6_000;

type Entry = { body: string; expires: number };
const cache = new Map<string, Entry>();

// Must match queries issued by lib/harbor/anilist.ts (cheap SSRF/replay guard)
const ALLOWED_ROOTS = [
  "query ($page: Int",
  "query ($page: Int,",
  "query ($weekStart: Int",
  "query ($search: String",
  "query ($ids: [Int",
];

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { query?: unknown; variables?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const query = typeof body.query === "string" ? body.query : "";
  if (!query || query.length > MAX_QUERY_LEN) {
    return NextResponse.json({ error: "invalid query" }, { status: 400 });
  }
  const head = query.trim().slice(0, 40);
  if (!ALLOWED_ROOTS.some((r) => head.startsWith(r))) {
    return NextResponse.json({ error: "query not allowed" }, { status: 403 });
  }

  const key = `${head}::${JSON.stringify(body.variables ?? {})}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) {
    // refresh recency for LRU eviction
    cache.delete(key);
    cache.set(key, hit);
    return new NextResponse(hit.body, {
      headers: { "Content-Type": "application/json", "X-Cache": "hit" },
    });
  }

  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables: body.variables ?? {} }),
      signal: AbortSignal.timeout(15_000),
    });
    const text = await res.text();
    if (!res.ok) {
      return new NextResponse(text, { status: res.status === 429 ? 429 : 502, headers: { "Content-Type": "application/json" } });
    }
    // Evict oldest entries beyond capacity
    if (cache.size >= MAX_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest) cache.delete(oldest);
    }
    cache.set(key, { body: text, expires: Date.now() + TTL_MS });
    return new NextResponse(text, {
      headers: { "Content-Type": "application/json", "X-Cache": "miss" },
    });
  } catch (e) {
    console.error("anilist proxy failed", e);
    return NextResponse.json({ error: "anilist request failed" }, { status: 504 });
  }
}
