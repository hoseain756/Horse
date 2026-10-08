// Harbor Web — POST /api/trakt/scrobble
// Relays start/pause/stop scrobbles to Trakt while the user plays media.
// Chatty route: 60 req/min per IP. Credentials are supplied per request and
// never stored server-side.
import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/harbor/proxy-core";
import { traktCredsFromBody } from "@/lib/harbor/link-resolve";
import {
  json,
  traktFetch,
  validCredential,
  type NextResponseLike,
} from "@/lib/harbor/trakt-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIONS = new Set(["start", "pause", "stop"]);
const IMDB_RE = /^tt\d+$/;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = clientIp(req);
  if (!rateLimit(`${ip}:trakt-scrobble`, 60, 60_000)) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }
  let body: {
    linkId?: unknown;
    clientId?: unknown;
    accessToken?: unknown;
    action?: unknown;
    progress?: unknown;
    type?: unknown;
    imdbId?: unknown;
    season?: unknown;
    episode?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return bad("invalid JSON");
  }
  const creds = await traktCredsFromBody(body);
  if (!creds) return bad("missing or invalid credentials");
  if (typeof body.action !== "string" || !ACTIONS.has(body.action)) {
    return bad("invalid action (start | pause | stop)");
  }
  const progress =
    typeof body.progress === "number" && Number.isFinite(body.progress) ? body.progress : NaN;
  if (Number.isNaN(progress) || progress < 0 || progress > 100) {
    return bad("invalid progress (0-100)");
  }
  if (body.type !== "movie" && body.type !== "episode") {
    return bad("invalid type (movie | episode)");
  }
  if (typeof body.imdbId !== "string" || !IMDB_RE.test(body.imdbId)) {
    return bad("invalid imdbId (expected tt<digits>)");
  }

  const imdbId = body.imdbId;
  let traktBody: unknown;
  if (body.type === "movie") {
    traktBody = { progress, movie: { ids: { imdb: imdbId } } };
  } else {
    const season = body.season;
    const episode = body.episode;
    const validSeason =
      typeof season === "number" && Number.isInteger(season) && season >= 0 ? season : null;
    const validEpisode =
      typeof episode === "number" && Number.isInteger(episode) && episode >= 0 ? episode : null;
    if (validSeason === null) return bad("invalid season");
    if (validEpisode === null) return bad("invalid episode");
    // Episode identified by season/number inside its show (show keyed by imdb id).
    traktBody = {
      progress,
      episode: { season: validSeason, number: validEpisode, ids: { season: validSeason, episode: validEpisode } },
      show: { ids: { imdb: imdbId } },
    };
  }

  const r = await traktFetch(`/scrobble/${body.action}`, {
    clientId: creds.clientId,
    accessToken: creds.accessToken,
    method: "POST",
    body: traktBody,
  });
  if (r.status === 401) return toRes(json({ error: "token expired or revoked" }, 401));
  if (r.status >= 400) {
    const hasError =
      r.body !== null && typeof r.body === "object" && "error" in (r.body as Record<string, unknown>);
    return toRes(
      json(hasError ? r.body : { error: `Trakt responded ${r.status}` }, r.status),
    );
  }
  return toRes(r);
}

function bad(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

function toRes(r: NextResponseLike): NextResponse {
  return NextResponse.json((r.body ?? {}) as object, { status: r.status });
}
