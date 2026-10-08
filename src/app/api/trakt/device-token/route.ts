// Harbor Web — POST /api/trakt/device-token
// Polls the OAuth device-token endpoint. While the user is still authorizing,
// Trakt answers 400 with { error: "authorization_pending" } — relayed verbatim.
import { NextRequest, NextResponse } from "next/server";
import { guard, traktFetch, validCredential, type NextResponseLike } from "@/lib/harbor/trakt-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const g = guard(req);
  if (g) return toRes(g);
  let body: { clientId?: unknown; clientSecret?: unknown; deviceCode?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!validCredential(body.clientId)) {
    return NextResponse.json({ error: "invalid client credentials" }, { status: 400 });
  }
  // PKCE-era apps have NO client secret — the field is optional upstream
  if (body.clientSecret !== undefined && body.clientSecret !== "" && !validCredential(body.clientSecret)) {
    return NextResponse.json({ error: "invalid client credentials" }, { status: 400 });
  }
  if (typeof body.deviceCode !== "string" || body.deviceCode.length < 8 || body.deviceCode.length > 128) {
    return NextResponse.json({ error: "invalid device code" }, { status: 400 });
  }
  const reqBody: Record<string, string> = {
    client_id: (body.clientId as string).trim(),
    device_code: (body.deviceCode as string).trim(),
  };
  if (typeof body.clientSecret === "string" && body.clientSecret.trim()) {
    reqBody.client_secret = body.clientSecret.trim();
  }
  // Device-token endpoint lives on the API host (auth.trakt.tv 429-blocks it)
  const r = await traktFetch("/oauth/device/token", {
    clientId: (body.clientId as string).trim(),
    body: reqBody,
    oauth: false,
  });
  // Normalize the NEW-API status codes into the legacy JSON contract the
  // client store understands (developer.trakt.tv: 400 Pending = EMPTY body,
  // 429 = slow down, 410 = expired, 418 = denied, 404/409 = invalid/used).
  if (r.status === 400 && !(r.body as { error?: string } | null)?.error) {
    return toRes({ status: 400, body: { error: "authorization_pending" } });
  }
  if (r.status === 429) return toRes({ status: 400, body: { error: "slow_down" } });
  if (r.status === 410) return toRes({ status: 400, body: { error: "expired_token" } });
  if (r.status === 418) return toRes({ status: 400, body: { error: "denied" } });
  if (r.status === 404 || r.status === 409) {
    return toRes({ status: 400, body: { error: "expired_token", error_description: "Device code is invalid or already used." } });
  }
  return toRes(r);
}

function toRes(r: NextResponseLike): NextResponse {
  return NextResponse.json((r.body ?? {}) as object, { status: r.status });
}
