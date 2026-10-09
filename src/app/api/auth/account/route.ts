// DELETE /api/auth/account
// Permanently deletes the SIGNED-IN account and every server-side trace of
// it: the acct:<uid> sync bucket (settings blob, addon/library/list mirrors,
// watch events), all sessions (every device), email tokens, OAuth links,
// Trakt/Simkl links (with best-effort upstream token revocation), and audit
// rows. The session cookies are cleared in the same response. Requires a
// valid session — an account can only ever delete itself.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureDb } from "@/lib/ensure-db";
import { clearSessionCookie, resolveSession } from "@/lib/harbor/auth/session";
import { rateLimit } from "@/lib/harbor/auth/ratelimit";
import { audit, clientIp } from "@/lib/harbor/auth/util";
import { decryptSecret } from "@/lib/harbor/vault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  await ensureDb();
  const res = NextResponse.json({ ok: true });
  if (!(await rateLimit(`account-delete:ip:${clientIp(req)}`, 5, 60_000)).ok) {
    return NextResponse.json({ error: "Too many attempts. Try again in a minute." }, { status: 429 });
  }
  const session = await resolveSession(req);
  if (!session) {
    clearSessionCookie(res);
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const uid = session.uid;
  try {
    const pid = `acct:${uid}`;
    // Best-effort upstream revocation of linked service tokens (Trakt has a
    // revoke endpoint; Simkl has none — dropping the row revokes our access).
    const links = await db.linkedAccount.findMany({ where: { ownerUid: uid } });
    for (const link of links) {
      if (link.provider === "trakt") {
        const token = link.accessTokenEnc ? decryptSecret(link.accessTokenEnc, `link:${link.id}`) : null;
        if (token) {
          void fetch("https://api.trakt.tv/oauth/revoke", {
            method: "POST",
            headers: { "content-type": "application/json", "trakt-api-version": "2" },
            body: JSON.stringify({ token }),
            signal: AbortSignal.timeout(6_000),
          }).catch(() => undefined);
        }
      }
    }
    // Bucket first, then identity rows — an interrupted delete can never leave
    // a live user pointing at a half-deleted bucket.
    await db.appSettings.deleteMany({ where: { profileId: pid } });
    await db.addon.deleteMany({ where: { profileId: pid } });
    await db.libraryItem.deleteMany({ where: { profileId: pid } });
    await db.customList.deleteMany({ where: { profileId: pid } });
    await db.watchEvent.deleteMany({ where: { profileId: pid } });
    await db.session.deleteMany({ where: { uid } });
    await db.emailToken.deleteMany({ where: { uid } });
    await db.oAuthAccount.deleteMany({ where: { uid } });
    await db.linkedAccount.deleteMany({ where: { ownerUid: uid } });
    const gone = await db.horseUser.deleteMany({ where: { id: uid } });
    if (gone.count === 0) {
      clearSessionCookie(res);
      return NextResponse.json({ ok: true, deleted: false, note: "already gone" });
    }
    await db.auditLog.deleteMany({ where: { uid } });
    await audit({ event: "account_delete", ip: clientIp(req), detail: { uid } }); // uid row now gone
    clearSessionCookie(res);
    return NextResponse.json({ ok: true, deleted: true });
  } catch (e) {
    console.error("auth account delete failed", e);
    return NextResponse.json({ error: "Could not delete the account." }, { status: 500 });
  }
}
