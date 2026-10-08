// Harbor Web — POST /api/simkl/scrobble
// Relays start/pause/stop scrobbles to Simkl while the user plays media.
// Accepts vault linkId or legacy clientId/accessToken. Fire-and-forget on the
// client; failures are non-fatal.
import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/harbor/proxy-core";
import { simklFetch } from "@/lib/harbor/simkl-server";
import { simklCredsFromBody } from "@/lib/harbor/link-resolve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIONS = new Set(["start", "pause", "stop"]);
const IMDB_RE = /^tt\d+$/;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = clientIp(req);
  if (!rateLimit(`${ip}:simkl-scrobble`, 60, 60_000)) {
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
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const creds = await simklCredsFromBody(body);
  if (!creds) {
    return NextResponse.json({ error: "missing or invalid credentials" }, { status: 401 });
  }
  if (typeof body.action !== "string" || !ACTIONS.has(body.action)) {
    return NextResponse.json({ error: "invalid action (start | pause | stop)" }, { status: 400 });
  }
  const progress =
    typeof body.progress === "number" && Number.isFinite(body.progress) ? Math.round(body.progress) : NaN;
  if (Number.isNaN(progress) || progress < 0 || progress > 100) {
    return NextResponse.json({ error: "invalid progress (0-100)" }, { status: 400 });
  }
  if (body.type !== "movie" && body.type !== "episode") {
    return NextResponse.json({ error: "invalid type (movie | episode)" }, { status: 400 });
  }
  if (typeof body.imdbId !== "string" || !IMDB_RE.test(body.imdbId)) {
    return NextResponse.json({ error: "invalid imdbId (expected tt<digits>)" }, { status: 400 });
  }

  // Simkl /scrobble shape: {progress, movie:{ids:{imdb}}} or
  // {progress, show:{ids:{imdb}}, episode:{season, number}}
  let scrobbleBody: unknown;
  if (body.type === "movie") {
    scrobbleBody = { progress, movie: { ids: { imdb: body.imdbId } } };
  } else {
    const season = typeof body.season === "number" && Number.isInteger(body.season) && body.season >= 0 ? body.season : null;
    const episode = typeof body.episode === "number" && Number.isInteger(body.episode) && body.episode >= 0 ? body.episode : null;
    if (season === null || episode === null) {
      return NextResponse.json({ error: "invalid season/episode" }, { status: 400 });
    }
    scrobbleBody = {
      progress,
      show: { ids: { imdb: body.imdbId } },
      episode: { season, number: episode },
    };
  }

  const r = await simklFetch("/scrobble", {
    clientId: creds.clientId,
    accessToken: creds.accessToken,
    method: "POST",
    body: scrobbleBody,
  });
  if (r.status === 401) {
    return NextResponse.json({ error: "token expired or revoked" }, { status: 401 });
  }
  return NextResponse.json((r.body ?? {}) as object, { status: r.status === 200 || r.status === 201 ? 200 : r.status });
}
