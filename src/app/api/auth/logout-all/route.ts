// POST /api/auth/logout-all — revokes EVERY session for the current user
// (all devices, including this one) and clears the cookie.
import { NextRequest, NextResponse } from "next/server";
import { ensureDb } from "@/lib/ensure-db";
import { clearSessionCookie, resolveSession, revokeAllSessions } from "@/lib/harbor/auth/session";
import { audit, clientIp } from "@/lib/harbor/auth/util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const res = NextResponse.json({ ok: true });
  try {
    await ensureDb();
    const session = await resolveSession(req);
    if (session) {
      const count = await revokeAllSessions(session.uid);
      await audit({ uid: session.uid, event: "logout_all", ip: clientIp(req), detail: { revoked: count } });
    }
  } catch (e) {
    console.error("auth logout-all failed", e);
  }
  clearSessionCookie(res);
  return res;
}
