// Harbor Web — POST /api/pairing/cancel  { code }
// The big screen cancels a pending pairing (user backed out). Deleting the
// row makes the code immediately dead for claims and polls alike.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clientIp } from "@/lib/harbor/proxy-core";
import { rateLimit } from "@/lib/harbor/auth/ratelimit";
import { normalizePairingCode } from "@/lib/harbor/pairing-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rl = await rateLimit(`pairing-cancel:${clientIp(req)}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  let body: { code?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const code = normalizePairingCode(body.code);
  if (!code) {
    return NextResponse.json({ error: "invalid pairing code" }, { status: 400 });
  }
  try {
    await db.pairingCode.deleteMany({ where: { code } });
  } catch {
    return NextResponse.json({ error: "pairing storage unavailable" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
