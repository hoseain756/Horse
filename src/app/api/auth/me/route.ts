// GET /api/auth/me — silent session restore probe (called early on app boot).
// Returns the signed-in user; transparently UPGRADES a legacy stateless cookie
// to a DB-backed session (device row), and applies the throttled sliding
// renewal (refreshed cookie at most once per 24h).
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureDb } from "@/lib/ensure-db";
import { applySessionCookie, clearSessionCookie, createSession, resolveSession, touchSession } from "@/lib/harbor/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  await ensureDb();
  try {
    const session = await resolveSession(req);
    if (!session) return NextResponse.json({ authenticated: false });
    const user = await db.horseUser.findUnique({
      where: { id: session.uid },
      select: { email: true, username: true, displayName: true, createdAt: true, emailVerifiedAt: true },
    });
    if (!user) {
      const res = NextResponse.json({ authenticated: false });
      clearSessionCookie(res);
      return res;
    }
    const res = NextResponse.json({
      authenticated: true,
      user: {
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        createdAt: user.createdAt.toISOString(),
        emailVerified: user.emailVerifiedAt !== null,
      },
    });
    if (session.id.startsWith("legacy:")) {
      // Transparent migration: stateless AES cookie → hashed DB session.
      await createSession(session.uid, req, res, { remember: true });
    } else {
      const renewed = await touchSession(session);
      if (renewed && session.remember && session.rawToken) {
        // Sliding renewal: re-set the cookie with the SAME raw token so the
        // browser-side 90d lifetime also rolls forward on activity.
        applySessionCookie(res, session.rawToken, true);
      }
    }
    return res;
  } catch (e) {
    console.error("auth me failed", e);
    return NextResponse.json({ authenticated: false });
  }
}
