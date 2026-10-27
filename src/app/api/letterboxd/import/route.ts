// Harbor Web — POST /api/letterboxd/import (Feature: Letterboxd integration)
// Accepts Letterboxd's official CSV export text OR a public profile username
// (RSS feed), parses the rows server-side and matches every film to TMDB so
// the client can save a real Horse collection. No letterboxd.com scraping —
// only the CSV the user exports themselves and the official public RSS feed.
import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/harbor/proxy-core";
import { hydrateEnv } from "@/lib/harbor/env-hydrate";
import {
  fetchLetterboxdRss,
  isValidLbUsername,
  parseLetterboxdCsv,
  resolveLetterboxdRows,
} from "@/lib/harbor/letterboxd";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CSV_BYTES = 2_000_000; // ~2MB covers years of diary exports

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = clientIp(req);
  if (!rateLimit(`${ip}:lb-import`, 10, 60_000)) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }
  await hydrateEnv();

  let body: { source?: string; csv?: string; user?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  try {
    if (body.source === "csv") {
      const csv = typeof body.csv === "string" ? body.csv : "";
      if (!csv || csv.length > MAX_CSV_BYTES) {
        return NextResponse.json({ error: "csv" }, { status: 400 });
      }
      const rows = parseLetterboxdCsv(csv);
      const result = await resolveLetterboxdRows(rows);
      return NextResponse.json(result);
    }

    if (body.source === "rss") {
      const user = (body.user ?? "").trim();
      // accept a bare username or a full profile/list URL
      const fromUrl = user.match(/letterboxd\.com\/([A-Za-z0-9_-]{2,30})/);
      const handle = fromUrl ? fromUrl[1] : user;
      if (!isValidLbUsername(handle)) {
        return NextResponse.json({ error: "rss" }, { status: 400 });
      }
      const rows = await fetchLetterboxdRss(handle);
      const result = await resolveLetterboxdRows(rows);
      return NextResponse.json({ ...result, handle });
    }

    return NextResponse.json({ error: "bad request" }, { status: 400 });
  } catch (e) {
    const which = e instanceof Error && e.message === "rss" ? "rss" : "csv";
    return NextResponse.json({ error: which }, { status: 502 });
  }
}
