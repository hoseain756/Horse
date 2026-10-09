// GET /api/account/export — authenticated JSON download of ALL the user's
// account data. Secrets (session tokens, Trakt/Simkl access tokens) are NEVER
// included — only metadata the user owns (provider usernames, link dates).
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureDb } from "@/lib/ensure-db";
import { resolveSession } from "@/lib/harbor/auth/session";
import { decryptSecret } from "@/lib/harbor/vault";
import { safeJson } from "@/lib/harbor/safe-json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  await ensureDb();
  const session = await resolveSession(req);
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const pid = `acct:${session.uid}`;
  try {
    const [user, blob, addons, library, lists, watchEvents, linked, sessions] = await Promise.all([
      db.horseUser.findUnique({
        where: { id: session.uid },
        select: { email: true, username: true, displayName: true, createdAt: true, lastLoginAt: true, emailVerifiedAt: true },
      }),
      db.appSettings.findUnique({ where: { profileId: pid } }),
      db.addon.findMany({ where: { profileId: pid }, orderBy: { order: "asc" } }),
      db.libraryItem.findMany({ where: { profileId: pid } }),
      db.customList.findMany({ where: { profileId: pid } }),
      db.watchEvent.findMany({ where: { profileId: pid }, orderBy: { createdAt: "desc" }, take: 1000 }),
      db.linkedAccount.findMany({ where: { ownerUid: session.uid } }),
      db.session.findMany({ where: { uid: session.uid }, select: { uaSummary: true, createdAt: true, lastSeenAt: true } }),
    ]);
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    const snapshot = blob ? safeJson<unknown>(decryptSecret(blob.data) ?? blob.data /* legacy plaintext */, null) : null;

    const payload = {
      format: "horse-account-export",
      version: 1,
      exportedAt: new Date().toISOString(),
      account: {
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        createdAt: user.createdAt.toISOString(),
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
        emailVerified: user.emailVerifiedAt !== null,
      },
      snapshot,
      addons: addons.map((a) => ({
        id: a.id,
        transportUrl: decryptSecret(a.urlEnc, a.id) ?? "[undecryptable]",
        name: a.name,
        version: a.version,
        enabled: a.enabled,
        order: a.order,
        installedAt: a.installedAt.toISOString(),
        types: safeJson<string[]>(a.types, []),
      })),
      library: library.map((l) => ({
        itemId: l.itemId,
        type: l.type,
        name: l.name,
        state: safeJson<unknown>(l.state, null),
        lastWatched: l.lastWatched?.toISOString() ?? null,
      })),
      customLists: lists.map((l) => ({ id: l.id, name: l.name, items: safeJson<unknown[]>(l.items, []) })),
      watchEvents: watchEvents.map((w) => ({
        itemId: w.itemId,
        videoId: w.videoId,
        season: w.season,
        episode: w.episode,
        position: w.position,
        duration: w.duration,
        completed: w.completed,
        createdAt: w.createdAt.toISOString(),
      })),
      linkedServices: linked.map((l) => ({
        provider: l.provider,
        username: l.username,
        linkedAt: l.createdAt.toISOString(),
        expiresAt: l.expiresAt?.toISOString() ?? null,
        // NOTE: access/refresh tokens intentionally excluded.
      })),
      devices: sessions.map((s) => ({ device: s.uaSummary, createdAt: s.createdAt.toISOString(), lastSeenAt: s.lastSeenAt.toISOString() })),
    };

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="horse-account-export-${new Date().toISOString().slice(0, 10)}.json"`,
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    console.error("account export failed", e);
    return NextResponse.json({ error: "Could not export the account data." }, { status: 500 });
  }
}
