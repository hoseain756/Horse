// POST /api/auth/change-password {currentPassword, newPassword} — session-
// authenticated; verifies the current password, re-hashes, revokes all OTHER
// sessions, and ROTATES the current session (fresh token + cookie).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ensureDb } from "@/lib/ensure-db";
import { dummyVerify, hashPassword, validatePassword, verifyPassword } from "@/lib/harbor/auth/password";
import { createSession, resolveSession, revokeAllSessions } from "@/lib/harbor/auth/session";
import { rateLimit } from "@/lib/harbor/auth/ratelimit";
import { audit, clientIp } from "@/lib/harbor/auth/util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ currentPassword: z.string().min(1).max(128), newPassword: z.string() });

export async function POST(req: NextRequest): Promise<NextResponse> {
  await ensureDb();
  const session = await resolveSession(req);
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!(await rateLimit(`pwchange:uid:${session.uid}`, 5, 60_000)).ok) {
    return NextResponse.json({ error: "Too many attempts. Try again shortly." }, { status: 429 });
  }
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success || !validatePassword(parsed.data.newPassword)) {
    return NextResponse.json({ error: "New password must be 10–128 characters." }, { status: 400 });
  }
  try {
    const user = await db.horseUser.findUnique({ where: { id: session.uid }, select: { id: true, passwordHash: true } });
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    if (!verifyPassword(parsed.data.currentPassword, user.passwordHash)) {
      dummyVerify(parsed.data.currentPassword);
      await audit({ uid: user.id, event: "password_change_failed", ip: clientIp(req) });
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 403 });
    }
    await db.horseUser.update({ where: { id: user.id }, data: { passwordHash: hashPassword(parsed.data.newPassword) } });
    const revoked = await revokeAllSessions(user.id, session.id);
    const res = NextResponse.json({ ok: true, revokedOtherSessions: revoked });
    // Rotate: fresh token + row for THIS device.
    await createSession(user.id, req, res, { remember: session.remember });
    if (!session.id.startsWith("legacy:")) await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    await audit({ uid: user.id, event: "password_change", ip: clientIp(req), detail: { revoked } });
    return res;
  } catch (e) {
    console.error("change-password failed", e);
    return NextResponse.json({ error: "Could not change the password right now." }, { status: 500 });
  }
}
