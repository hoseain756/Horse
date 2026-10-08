// Harbor Web — POST /api/trakt/history
// Relays the caller's Trakt watched history (last 250 plays, extended info)
// and normalizes it app-side. Credentials are supplied per request and never
// stored server-side.
import { NextRequest, NextResponse } from "next/server";
import { traktCredsFromBody } from "@/lib/harbor/link-resolve";
import {
  guard,
  json,
  traktFetch,
  validCredential,
  type NextResponseLike,
} from "@/lib/harbor/trakt-server";
import type { TraktHistoryItem } from "@/lib/harbor/trakt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TraktIds = { imdb?: unknown; tmdb?: unknown; slug?: unknown };
type TraktHistoryEntry = {
  type?: unknown;
  watched_at?: unknown;
  movie?: { title?: unknown; ids?: TraktIds };
  show?: { title?: unknown; ids?: TraktIds };
  episode?: { season?: unknown; number?: unknown; title?: unknown; ids?: TraktIds };
};

/**
 * Normalize raw Trakt /users/me/history entries into:
 *   {id (imdb of movie/show), type: movie|series, name, videoId? ("<showImdb>:<s>:<e>"),
 *    season?, episode?, episodeName?, watchedAt (epoch ms)}
 * Episodes without a show imdb id are skipped; movies fall back to `trakt:<slug>`.
 */
export function normalizeHistory(raw: unknown): TraktHistoryItem[] {
  if (!Array.isArray(raw)) return [];
  const out: TraktHistoryItem[] = [];
  for (const entry of (raw as TraktHistoryEntry[]).slice(0, 250)) {
    if (typeof entry !== "object" || entry === null) continue;
    const watchedAt =
      typeof entry.watched_at === "string" ? Date.parse(entry.watched_at) : NaN;
    const watchedAtMs = Number.isFinite(watchedAt) ? watchedAt : 0;

    if (entry.type === "movie") {
      const m = entry.movie;
      if (typeof m !== "object" || m === null || typeof m.ids !== "object" || m.ids === null) continue;
      const imdb = typeof m.ids.imdb === "string" ? m.ids.imdb : null;
      const slug = typeof m.ids.slug === "string" ? m.ids.slug : null;
      if (!imdb && !slug) continue;
      out.push({
        id: imdb ?? `trakt:${slug}`,
        type: "movie",
        name: typeof m.title === "string" ? m.title : "Unknown title",
        watchedAt: watchedAtMs,
      });
      continue;
    }

    if (entry.type === "episode") {
      const show = entry.show;
      const ep = entry.episode;
      if (typeof show !== "object" || show === null) continue; // episode without show data is skipped
      const showImdb =
        typeof show.ids === "object" && show.ids !== null
          ? typeof show.ids.imdb === "string"
            ? show.ids.imdb
            : null
          : null;
      if (!showImdb) continue; // episodes without the show's imdb id are skipped
      if (typeof ep !== "object" || ep === null) continue;
      const season = typeof ep.season === "number" && Number.isFinite(ep.season) ? ep.season : null;
      const number = typeof ep.number === "number" && Number.isFinite(ep.number) ? ep.number : null;
      if (season === null || number === null) continue;
      out.push({
        id: showImdb,
        type: "series",
        name: typeof show.title === "string" ? show.title : "Unknown show",
        videoId: `${showImdb}:${season}:${number}`,
        season,
        episode: number,
        episodeName: typeof ep.title === "string" && ep.title.length > 0 ? ep.title : undefined,
        watchedAt: watchedAtMs,
      });
    }
  }
  return out.slice(0, 250);
}

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

  const r = await traktFetch("/users/me/history?limit=250&extended=full", {
    clientId,
    accessToken: token,
    method: "GET",
  });
  if (r.status === 401) return toRes(json({ error: "token expired or revoked" }, 401));
  if (r.status >= 400) return toRes(r);
  return NextResponse.json({ items: normalizeHistory(r.body) });
}

function toRes(r: NextResponseLike): NextResponse {
  return NextResponse.json((r.body ?? {}) as object, { status: r.status });
}
