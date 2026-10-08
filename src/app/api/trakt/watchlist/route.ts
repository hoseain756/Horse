// Harbor Web — POST /api/trakt/watchlist
// Returns the caller's Trakt watchlist (movies + shows) normalized to
// {id, type, name, year} items. Requires the user's own access token.
import { NextRequest, NextResponse } from "next/server";
import { traktCredsFromBody } from "@/lib/harbor/link-resolve";
import {
  guard,
  json,
  normalizeWatchlist,
  traktFetch,
  validCredential,
  type NextResponseLike,
} from "@/lib/harbor/trakt-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const g = guard(req);
  if (g) return toRes(g);
  let body: { linkId?: unknown; clientId?: unknown; accessToken?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const creds = await traktCredsFromBody(body);
  if (!creds) {
    return NextResponse.json({ error: "missing or invalid credentials" }, { status: 401 });
  }
  const clientId = creds.clientId;
  const token = creds.accessToken;

  const [movies, shows] = await Promise.all([
    traktFetch("/users/me/watchlist/movies", { clientId, accessToken: token, method: "GET" }),
    traktFetch("/users/me/watchlist/shows", { clientId, accessToken: token, method: "GET" }),
  ]);
  if (movies.status === 401 || shows.status === 401) {
    return toRes(json({ error: "token expired or revoked" }, 401));
  }
  if (movies.status >= 400 && movies.status !== 404) return toRes(movies);
  if (shows.status >= 400 && shows.status !== 404) return toRes(shows);

  const items = [
    ...normalizeWatchlist(movies.body),
    ...normalizeWatchlist(shows.body),
  ];
  return NextResponse.json({ items });
}

function toRes(r: NextResponseLike): NextResponse {
  return NextResponse.json((r.body ?? {}) as object, { status: r.status });
}
