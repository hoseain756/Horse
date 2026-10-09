// Harbor Web — DELETE /api/auth/account
// Permanently deletes the SIGNED-IN account and every server-side trace of
// it: the acct:<uid> sync bucket (settings blob, addon/library/list mirrors,
// watch events) and the HorseUser row itself. The session cookie is cleared
// in the same response. Requires a valid session — an account can only ever
// delete itself.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureDb } from "@/lib/ensure-db";
import {
  SESSION_COOKIE,
  clientIp,
  clearSessionCookieOptions,
  rateLimit,
  sessionUid,
} from "@/lib/harbor/account-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  await ensureDb(); // create sqlite file + tables on cold serverless instances
  if (!rateLimit(`account-delete:${clientIp(req)}`, 5, 60_000)) {
    return NextResponse.json({ error: "Too many attempts. Try again in a minute." }, { status: 429 });
  }
  const uid = sessionUid(req);
  if (!uid) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  try {
    const pid = `acct:${uid}`;
    // Bucket first, then the user row — an interrupted delete can never leave
    // a live user pointing at a half-deleted bucket.
    await db.appSettings.deleteMany({ where: { profileId: pid } });
    await db.addon.deleteMany({ where: { profileId: pid } });
    await db.libraryItem.deleteMany({ where: { profileId: pid } });
    await db.customList.deleteMany({ where: { profileId: pid } });
    await db.watchEvent.deleteMany({ where: { profileId: pid } });
    const gone = await db.horseUser.deleteMany({ where: { id: uid } });
    if (gone.count === 0) {
      // Stale cookie for an already-deleted user — still clear the session.
      const res = NextResponse.json({ ok: true, deleted: false, note: "already gone" });
      res.cookies.set(SESSION_COOKIE, "", clearSessionCookieOptions());
      return res;
    }
    const res = NextResponse.json({ ok: true, deleted: true });
    res.cookies.set(SESSION_COOKIE, "", clearSessionCookieOptions());
    return res;
  } catch (e) {
    console.error("auth account delete failed", e);
    return NextResponse.json({ error: "Could not delete the account." }, { status: 500 });
  }
}
