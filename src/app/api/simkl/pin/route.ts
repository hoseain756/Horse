// Harbor Web — POST /api/simkl/pin
// Relays the OAuth PIN request to Simkl (BYO client id). Simkl answers
// 200 {result, device_code, user_code, verification_url, expires_in, interval}
// or a 412 error envelope (mapped by simklFetch).
import { NextRequest, NextResponse } from "next/server";
import { guard, simklFetch, validClientId, type NextResponseLike } from "@/lib/harbor/simkl-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const g = guard(req);
  if (g) return toRes(g);
  let body: { clientId?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!validClientId(body.clientId)) {
    return NextResponse.json(
      { error: "invalid client id" },
      { status: 400 },
    );
  }
  const r = await simklFetch("/oauth/pin", {
    clientId: (body.clientId as string).trim(),
    body: { client_id: (body.clientId as string).trim(), redirect: "" },
  });
  return toRes(r);
}

function toRes(r: NextResponseLike): NextResponse {
  return NextResponse.json((r.body ?? {}) as object, { status: r.status });
}
