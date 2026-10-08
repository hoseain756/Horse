// Harbor Web — POST /api/simkl/user
// Returns the authenticated Simkl user's profile (user.name from
// /users/settings) so the UI can display who is connected.
import { NextRequest, NextResponse } from "next/server";
import { guard, simklFetch, validClientId, type NextResponseLike } from "@/lib/harbor/simkl-server";
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
  const r = await simklFetch("/users/settings", {
    clientId: creds.clientId,
    accessToken: creds.accessToken,
    method: "GET",
  });
  if (r.status !== 200 || !r.body || typeof r.body !== "object") {
    return toRes(r);
  }
  const data = r.body as { user?: { name?: string; username?: string } };
  return NextResponse.json({
    username: data.user?.name ?? data.user?.username ?? null,
  });
}

function toRes(r: NextResponseLike): NextResponse {
  return NextResponse.json((r.body ?? {}) as object, { status: r.status });
}
