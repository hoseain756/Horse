// Harbor Web — POST /api/trakt/push-watchlist
// Pushes local watchlist additions to the caller's Trakt watchlist via
// POST /sync/watchlist. Only imdb-backed ids (^tt\d+$) are pushable —
// anything else is skipped client-side. Credentials are supplied per
// request and never stored server-side.
import { NextRequest, NextResponse } from "next/server";
import { traktCredsFromBody } from "@/lib/harbor/link-resolve";
import {
  guard,
  traktFetch,
  validCredential,
} from "@/lib/harbor/trakt-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PushItem = { id?: unknown; type?: unknown };

export async function POST(req: NextRequest): Promise<NextResponse> {
  const g = guard(req);
  if (g) return NextResponse.json((g.body ?? {}) as object, { status: g.status });
  let body: { linkId?: unknown; clientId?: unknown; accessToken?: unknown; items?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const creds = await traktCredsFromBody(body);
  if (!creds) {
    return NextResponse.json({ error: "missing or invalid credentials" }, { status: 401 });
  }
  if (!Array.isArray(body.items)) {
    return NextResponse.json({ error: "items must be an array" }, { status: 400 });
  }
  const clientId = creds.clientId;
  const token = creds.accessToken;

  const IMDB_RE = /^tt\d+$/;
  const movies: { ids: { imdb: string } }[] = [];
  const shows: { ids: { imdb: string } }[] = [];
  let skipped = 0;
  for (const raw of (body.items as PushItem[]).slice(0, 500)) {
    if (typeof raw !== "object" || raw === null || typeof raw.id !== "string") {
      skipped++;
      continue;
    }
    const id = raw.id.trim();
    if (!IMDB_RE.test(id)) {
      skipped++;
      continue;
    }
    if (raw.type === "movie") movies.push({ ids: { imdb: id } });
    else if (raw.type === "series") shows.push({ ids: { imdb: id } });
    else skipped++;
  }

  if (movies.length === 0 && shows.length === 0) {
    return NextResponse.json({ added: { movies: 0, shows: 0 }, notFound: 0, skipped });
  }

  const res = await traktFetch("/sync/watchlist", {
    clientId,
    accessToken: token,
    method: "POST",
    body: { movies, shows },
  });
  if (res.status === 401) {
    return NextResponse.json({ error: "token expired or revoked" }, { status: 401 });
  }
  if (res.status >= 400) {
    return NextResponse.json((res.body ?? { error: "Trakt request failed" }) as object, {
      status: res.status,
    });
  }

  type SyncResponse = {
    added?: { movies?: number; shows?: number };
    not_found?: { movies?: unknown[]; shows?: unknown[] };
  };
  const parsed = (res.body ?? {}) as SyncResponse;
  const added = {
    movies: typeof parsed.added?.movies === "number" ? parsed.added.movies : 0,
    shows: typeof parsed.added?.shows === "number" ? parsed.added.shows : 0,
  };
  const nf = parsed.not_found;
  const notFound =
    (Array.isArray(nf?.movies) ? nf.movies.length : 0) +
    (Array.isArray(nf?.shows) ? nf.shows.length : 0);

  return NextResponse.json({ added, notFound, skipped });
}
