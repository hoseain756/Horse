// Harbor Web — POST /api/trakt/me
// Returns the authenticated Trakt user's profile (username, stats) so the UI
// can display who is connected.
import { NextRequest, NextResponse } from "next/server";
import { guard, traktFetch, validCredential, type NextResponseLike } from "@/lib/harbor/trakt-server";
import { traktCredsFromBody } from "@/lib/harbor/link-resolve";


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
  const r = await traktFetch("/users/me", {
    clientId: creds.clientId,
    accessToken: creds.accessToken,
    method: "GET",
  });
  if (r.status !== 200 || !r.body || typeof r.body !== "object") {
    return toRes(r);
  }
  const data = r.body as { user?: { username?: string; name?: string; avatar?: string } };
  return NextResponse.json({
    username: data.user?.username ?? null,
    name: data.user?.name ?? null,
  });
}

function toRes(r: NextResponseLike): NextResponse {
  return NextResponse.json((r.body ?? {}) as object, { status: r.status });
}
