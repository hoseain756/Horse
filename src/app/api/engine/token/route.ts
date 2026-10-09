// Harbor Web — GET /api/engine/token
// Mints a short-lived HMAC token the BROWSER appends to the external engine's
// media endpoints (/stream/:key/:idx, /remux/:key/:idx) as ?k=<token>. The
// engine verifies it with the shared ENGINE_API_KEY — so the API key itself
// never reaches the browser, yet browser-direct media stays authenticated.
//
// Only relevant when ENGINE_URL + ENGINE_API_KEY are configured; returns
// { available: false } otherwise (the client then skips tokens entirely —
// tokenless engines must be protected at the network level instead).
import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/harbor/proxy-core";
import { enginePublicUrl, engineMediaToken } from "@/lib/harbor/engine-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!rateLimit(`${clientIp(req)}:engine-token`, 30, 60_000)) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }
  const base = enginePublicUrl();
  const minted = engineMediaToken();
  if (!base || !minted) {
    return NextResponse.json({ available: false });
  }
  return NextResponse.json(
    { available: true, engineUrl: base, token: minted.token, exp: minted.exp },
    { headers: { "Cache-Control": "no-store" } },
  );
}
