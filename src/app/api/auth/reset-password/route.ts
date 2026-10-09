// POST /api/auth/reset-password {token, password} — consumes the single-use
// reset token, re-hashes the password, and revokes ALL other sessions
// (password change is a privilege change → global revocation).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ensureDb } from "@/lib/ensure-db";
import { hashPassword, validatePassword } from "@/lib/harbor/auth/password";
import { revokeAllSessions } from "@/lib/harbor/auth/session";
import { consumeEmailToken } from "@/lib/harbor/auth/mail";
import { rateLimit } from "@/lib/harbor/auth/ratelimit";
import { audit, clientIp } from "@/lib/harbor/auth/util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ token: z.string().min(20).max(200), password: z.string() });

export async function POST(req: NextRequest): Promise<NextResponse> {
  await ensureDb();
  const ip = clientIp(req);
  if (!(await rateLimit(`reset:ip:${ip}`, 10, 60_000)).ok) {
    return NextResponse.json({ error: "Too many attempts. Try again shortly." }, { status: 429 });
  }
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success || !validatePassword(parsed.data.password)) {
    return NextResponse.json({ error: "Password must be 10–128 characters." }, { status: 400 });
  }
  try {
    const consumed = await consumeEmailToken(parsed.data.token, "reset");
    if (!consumed) {
      return NextResponse.json({ error: "This reset link is invalid, used, or has expired." }, { status: 400 });
    }
    await db.horseUser.update({ where: { id: consumed.uid }, data: { passwordHash: hashPassword(parsed.data.password) } });
    const revoked = await revokeAllSessions(consumed.uid);
    await audit({ uid: consumed.uid, event: "password_reset", ip, detail: { revoked } });
    return NextResponse.json({ ok: true, revokedSessions: revoked });
  } catch (e) {
    console.error("reset-password failed", e);
    return NextResponse.json({ error: "Could not reset the password right now." }, { status: 500 });
  }
}
