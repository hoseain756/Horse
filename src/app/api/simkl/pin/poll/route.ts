// Harbor Web — POST /api/simkl/pin/poll
// Polls the Simkl PIN endpoint. While the user has not entered the code yet,
// Simkl answers 401 with an error body — relayed verbatim (pinPoll mode) so
// the client can treat unknown errors as "pending" and only fail on
// definitive text like "bad_verification_code"/expired.
import { NextRequest, NextResponse } from "next/server";
import {
  guard,
  simklFetch,
  validClientId,
  validClientSecret,
  type NextResponseLike,
} from "@/lib/harbor/simkl-server";

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
  if (!validClientId(body.clientId)) {
    return NextResponse.json({ error: "invalid client id" }, { status: 400 });
  }
  if (body.clientSecret !== undefined && !validClientSecret(body.clientSecret)) {
    return NextResponse.json({ error: "invalid client secret" }, { status: 400 });
  }
  if (typeof body.deviceCode !== "string" || body.deviceCode.length < 4 || body.deviceCode.length > 128) {
    return NextResponse.json({ error: "invalid device code" }, { status: 400 });
  }
  const r = await simklFetch(`/oauth/pin/${encodeURIComponent(body.deviceCode.trim())}`, {
    clientId: (body.clientId as string).trim(),
    clientSecret: typeof body.clientSecret === "string" ? body.clientSecret.trim() : undefined,
    method: "POST",
    pinPoll: true,
  });
  return toRes(r);
}

function toRes(r: NextResponseLike): NextResponse {
  return NextResponse.json((r.body ?? {}) as object, { status: r.status });
}
