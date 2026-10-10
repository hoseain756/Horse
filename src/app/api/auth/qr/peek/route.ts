// Harbor Web — POST /api/auth/qr/peek  { code }
// The phone side, step 1: the phone (already signed in) asks what is behind
// the code BEFORE approving — the response carries the asking device's coarse
// hint ("Chrome · Windows") so the approval dialog can say what it is about to
// sign in. Requires a session; missing/expired codes read as "missing" (200 —
// simpler client logic than 404), already-consumed codes as "used".
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ensureDb } from "@/lib/ensure-db";
import { rateLimit } from "@/lib/harbor/auth/ratelimit";
import { clientIp } from "@/lib/harbor/auth/util";
import { sessionUid } from "@/lib/harbor/auth/session";
import { normalizeQrCode } from "@/lib/harbor/qr-login-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ code: z.string().max(32) });

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rl = await rateLimit(`qr-peek:${clientIp(req)}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }
  await ensureDb();

  const uid = await sessionUid(req);
  if (!uid) {
    return NextResponse.json({ error: "auth required" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const parsed = Body.safeParse(raw);
  const code = parsed.success ? normalizeQrCode(parsed.data.code) : null;
  if (!code) {
    return NextResponse.json({ ok: false, reason: "missing" });
  }

  try {
    const row = await db.qrLogin.findUnique({
      where: { code },
      select: { status: true, deviceHint: true, expiresAt: true },
    });
    if (!row || row.expiresAt.getTime() <= Date.now()) {
      // Expired rows are swept on read — harmless, keeps the table tiny.
      if (row) await db.qrLogin.deleteMany({ where: { code } }).catch(() => {});
      return NextResponse.json({ ok: false, reason: "missing" });
    }
    if (row.status !== "waiting") {
      return NextResponse.json({ ok: false, reason: "used" });
    }
    return NextResponse.json({ ok: true, deviceHint: row.deviceHint, expiresAt: row.expiresAt.getTime() });
  } catch {
    return NextResponse.json({ error: "storage unavailable" }, { status: 502 });
  }
}
