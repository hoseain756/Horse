// Harbor Web — GET /api/ratings (Feature: unified ratings row)
// Fans a title out to every enabled ratings provider in parallel with
// per-provider failure isolation. Providers without configured keys are
// skipped silently (the client hides them). Aggressive 6h cache upstream.
//
// Params: type=movie|series, imdb=tt..., title=..., year=..., anime=1
import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/harbor/proxy-core";
import { RATING_ADAPTERS, type RatingContext, type RatingValue } from "@/lib/harbor/ratings/adapters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IMDB_RE = /^tt\d+$/;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ip = clientIp(req);
  if (!rateLimit(`${ip}:ratings`, 40, 60_000)) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }
  const sp = req.nextUrl.searchParams;
  const type = sp.get("type") === "series" ? "series" : "movie";
  const imdb = sp.get("imdb") ?? undefined;
  const title = (sp.get("title") ?? "").trim().slice(0, 200);
  const year = (sp.get("year") ?? "").trim().slice(0, 6) || undefined;
  const anime = sp.get("anime") === "1";
  if (!title && !imdb) {
    return NextResponse.json({ error: "title or imdb required" }, { status: 400 });
  }
  if (imdb && !IMDB_RE.test(imdb)) {
    return NextResponse.json({ error: "invalid imdb id" }, { status: 400 });
  }

  const ctx: RatingContext = { kind: type, imdbId: imdb, title, year, anime };
  const results = await Promise.allSettled(
    RATING_ADAPTERS.filter((a) => a.supports(ctx)).map(async (a) => {
      try {
        const value = await a.fetch(ctx);
        return value;
      } catch {
        return null; // provider isolation: never throw upward
      }
    }),
  );
  const ratings: RatingValue[] = [];
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) ratings.push(r.value);
  }
  return NextResponse.json(
    { ratings },
    { headers: { "Cache-Control": "private, max-age=300" } },
  );
}
