// Harbor Web — POST /api/auth/qr/status  { pollToken }
// Polled by the TV while it waits. The pollToken (raw, 256-bit) is hashed and
// looked up — the DB only ever stores the hash. States:
//   • waiting  — the code is live, nothing approved it yet
//   • denied   — the phone refused; the row is deleted (terminal)
//   • expired  — missing / expired / consumed (the row is swept)
//   • approved — a phone signed off: a real DB session is minted for the
//                approver, the httpOnly cookie is set on THIS response
//                (createSession, same pattern as /api/auth/login), the row is
//                DELETED (single-use), and the user profile is returned.
// No session required — the TV is not signed in yet, that is the whole point.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ensureDb } from "@/lib/ensure-db";
import { rateLimit } from "@/lib/harbor/auth/ratelimit";
import { clientIp, audit } from "@/lib/harbor/auth/util";
import { createSession } from "@/lib/harbor/auth/session";
import { hashPollToken } from "@/lib/harbor/qr-login-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ pollToken: z.string().min(10).max(512) });

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rl = await rateLimit(`qr-status:${clientIp(req)}`, 120, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }
  await ensureDb();

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid poll token" }, { status: 400 });
  }
  const pollHash = hashPollToken(parsed.data.pollToken);

  try {
    const row = await db.qrLogin.findFirst({
      where: { pollHash },
      orderBy: { createdAt: "desc" },
    });

    if (!row) {
      return NextResponse.json({ status: "expired" });
    }
    if (row.expiresAt.getTime() <= Date.now()) {
      await db.qrLogin.deleteMany({ where: { code: row.code } }).catch(() => {});
      return NextResponse.json({ status: "expired" });
    }

    if (row.status === "waiting") {
      return NextResponse.json({ status: "waiting", expiresAt: row.expiresAt.getTime() });
    }

    // Denied → terminal: sweep the row so the code cannot be reused.
    if (row.status === "denied") {
      await db.qrLogin.deleteMany({ where: { code: row.code } }).catch(() => {});
      return NextResponse.json({ status: "denied" });
    }

    // Approved → hand over the session exactly once.
    const user = row.userId
      ? await db.horseUser.findUnique({
          where: { id: row.userId },
          select: { id: true, email: true, username: true, displayName: true, createdAt: true, emailVerifiedAt: true },
        })
      : null;
    if (!user) {
      // Approver vanished between approve and poll — treat as expired.
      await db.qrLogin.deleteMany({ where: { code: row.code } }).catch(() => {});
      return NextResponse.json({ status: "expired" });
    }

    const res = NextResponse.json({
      status: "approved",
      user: {
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        createdAt: user.createdAt.toISOString(),
        emailVerified: user.emailVerifiedAt !== null,
      },
    });
    // Sets the DB session row + httpOnly cookie on this same response.
    await createSession(user.id, req, res, { remember: true });
    await audit({ uid: user.id, event: "qr_login", ip: clientIp(req) });
    // Single-use consumption: after this poll the code is spent.
    await db.qrLogin.deleteMany({ where: { code: row.code } }).catch(() => {});
    return res;
  } catch {
    return NextResponse.json({ error: "storage unavailable" }, { status: 502 });
  }
}
