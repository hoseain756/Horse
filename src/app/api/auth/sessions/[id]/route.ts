// DELETE /api/auth/sessions/[id] — sign out ONE device (session must belong
// to the caller; IDOR-safe by construction).
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureDb } from "@/lib/ensure-db";
import { resolveSession } from "@/lib/harbor/auth/session";
import { audit, clientIp } from "@/lib/harbor/auth/util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  await ensureDb();
  const session = await resolveSession(req);
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { id } = await ctx.params;
  if (id === session.id) {
    return NextResponse.json({ error: "Use “Sign out” for the current device." }, { status: 400 });
  }
  try {
    const deleted = await db.session.deleteMany({ where: { id, uid: session.uid } }); // ownership enforced
    if (deleted.count === 0) return NextResponse.json({ error: "Session not found." }, { status: 404 });
    await audit({ uid: session.uid, event: "session_revoke", ip: clientIp(req), detail: { sessionId: id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("session revoke failed", e);
    return NextResponse.json({ error: "Could not revoke the session." }, { status: 500 });
  }
}
