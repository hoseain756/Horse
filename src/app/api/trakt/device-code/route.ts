// Harbor Web — POST /api/trakt/device-code
// Relays the OAuth device-code request to Trakt (BYO client id/secret).
import { NextRequest, NextResponse } from "next/server";
import { guard, traktFetch, validCredential, type NextResponseLike } from "@/lib/harbor/trakt-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const g = guard(req);
  if (g) return toRes(g);
  let body: { clientId?: unknown; clientSecret?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!validCredential(body.clientId)) {
    return NextResponse.json(
      { error: "Provide a valid Trakt client id (from trakt.tv/settings/applications)." },
      { status: 400 },
    );
  }
  // PKCE-era apps have NO client secret — the field is optional upstream
  if (body.clientSecret !== undefined && body.clientSecret !== "" && !validCredential(body.clientSecret)) {
    return NextResponse.json({ error: "Invalid client secret." }, { status: 400 });
  }
  const reqBody: Record<string, string> = { client_id: (body.clientId as string).trim() };
  if (typeof body.clientSecret === "string" && body.clientSecret.trim()) {
    reqBody.client_secret = body.clientSecret.trim();
  }
  // Device-code endpoint lives on the API host (see trakt-server.ts note)
  const r = await traktFetch("/oauth/device/code", {
    clientId: (body.clientId as string).trim(),
    body: reqBody,
    oauth: false,
  });
  return toRes(r);
}

function toRes(r: NextResponseLike): NextResponse {
  return NextResponse.json((r.body ?? {}) as object, { status: r.status });
}
