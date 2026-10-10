// Harbor Web — POST /api/transfer/cancel  { code }
// The sender backs out (or the UI closes early): delete the pending row so
// the code is immediately dead for claims and polls alike. Idempotent —
// cancelling a missing/consumed code still answers { ok: true }.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ensureDb } from "@/lib/ensure-db";
import { rateLimit } from "@/lib/harbor/auth/ratelimit";
import { clientIp } from "@/lib/harbor/auth/util";
import { normalizeTransferCode } from "@/lib/harbor/transfer-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ code: z.string().max(48) });

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rl = await rateLimit(`transfer-cancel:${clientIp(req)}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }
  await ensureDb();

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const parsed = Body.safeParse(raw);
  const code = parsed.success ? normalizeTransferCode(parsed.data.code) : null;
  if (!code) {
    return NextResponse.json({ ok: true });
  }

  try {
    await db.transferCode.deleteMany({ where: { code } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "storage unavailable" }, { status: 502 });
  }
}
