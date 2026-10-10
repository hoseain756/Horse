// Harbor Web — POST /api/auth/qr/approve  { code }
// The phone side, step 2a: approve the login request behind the code. The row
// flips to "approved" and records the approving user; the TV's next
// /api/auth/qr/status poll then collects the session. Requires a session.
// Atomicity: updateMany with status:"waiting" guard — two phones approving in
// a race cannot both flip a denied/consumed row.
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
  const rl = await rateLimit(`qr-approve:${clientIp(req)}`, 15, 60_000);
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
    const existing = await db.qrLogin.findUnique({
      where: { code },
      select: { status: true, deviceHint: true, expiresAt: true },
    });
    if (!existing || existing.expiresAt.getTime() <= Date.now()) {
      if (existing) await db.qrLogin.deleteMany({ where: { code } }).catch(() => {});
      return NextResponse.json({ ok: false, reason: "missing" });
    }
    if (existing.status !== "waiting") {
      return NextResponse.json({ ok: false, reason: "used" });
    }
    // Guarded flip — racing approvals/denials cannot both win.
    const flipped = await db.qrLogin.updateMany({
      where: { code, status: "waiting", expiresAt: { gt: new Date() } },
      data: { status: "approved", userId: uid, approvedAt: new Date() },
    });
    if (flipped.count !== 1) {
      return NextResponse.json({ ok: false, reason: "used" });
    }
    return NextResponse.json({ ok: true, deviceHint: existing.deviceHint });
  } catch {
    return NextResponse.json({ error: "storage unavailable" }, { status: 502 });
  }
}
