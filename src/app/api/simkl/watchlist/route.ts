// Harbor Web — POST /api/simkl/watchlist
// Returns the caller's Simkl watchlist (movies + shows) normalized to
// {id, type, name, year} items. Requires the user's own access token.
import { NextRequest, NextResponse } from "next/server";
import {
  guard,
  normalizeWatchlist,
  simklFetch,
  validClientId,
  type NextResponseLike,
} from "@/lib/harbor/simkl-server";
import { simklCredsFromBody } from "@/lib/harbor/link-resolve";


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
  const creds = await simklCredsFromBody(body);
  if (!creds) {
    return NextResponse.json({ error: "missing or invalid credentials" }, { status: 401 });
  }
  const r = await simklFetch("/sync/watchlist/?extended=full", {
    clientId: creds.clientId,
    accessToken: creds.accessToken,
    method: "GET",
  });
  if (r.status >= 400) return toRes(r);
  return NextResponse.json({ items: normalizeWatchlist(r.body) });
}

function toRes(r: NextResponseLike): NextResponse {
  return NextResponse.json((r.body ?? {}) as object, { status: r.status });
}
