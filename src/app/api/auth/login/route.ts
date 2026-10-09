// POST /api/auth/login {email, password, remember?}
// Email + password login (legacy usernames accepted). Progressive throttling
// per-IP and per-account (shared, DB-backed counters). Generic errors only;
// a dummy scrypt verify equalizes timing when the account doesn't exist.
// Rotates the session: a fresh DB-backed session row + cookie per login.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ensureDb } from "@/lib/ensure-db";
import { dummyVerify, verifyPassword } from "@/lib/harbor/auth/password";
import { createSession } from "@/lib/harbor/auth/session";
import { loginThrottle } from "@/lib/harbor/auth/ratelimit";
import { clientIp, audit, ipHash } from "@/lib/harbor/auth/util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  email: z.string().trim().min(3).max(254),
  password: z.string(),
  remember: z.boolean().optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  await ensureDb();
  const ip = clientIp(req);
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const parsed = Body.safeParse(raw);
  const identifier = parsed.success ? parsed.data.email.toLowerCase() : "";
  const password = parsed.success ? parsed.data.password : "";

  // Throttle BEFORE touching the DB (blocked → generic message + Retry-After).
  const throttle = await loginThrottle({
    ip: `login:ip:${ip}`,
    account: identifier ? `login:acct:${ipHash(identifier)}` : `login:acct:anon:${ipHash(ip)}`,
  });
  if (throttle.blocked) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait and try again." },
      { status: 429, headers: { "retry-after": String(throttle.retryAfterSec) } },
    );
  }
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  try {
    // email (primary) or legacy username fallback.
    const isEmail = identifier.includes("@");
    const user = isEmail
      ? await db.horseUser.findUnique({ where: { email: identifier } })
      : await db.horseUser.findUnique({ where: { username: identifier } });

    if (!user) {
      dummyVerify(password);
      await audit({ event: "login_failed", ip, detail: { reason: "no-user" } });
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }
    if (!verifyPassword(password, user.passwordHash)) {
      await audit({ uid: user.id, event: "login_failed", ip, detail: { reason: "bad-password" } });
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }

    const res = NextResponse.json({
      ok: true,
      user: {
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        createdAt: user.createdAt.toISOString(),
        emailVerified: user.emailVerifiedAt !== null,
      },
    });
    await createSession(user.id, req, res, { remember: parsed.data.remember !== false });
    await db.horseUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await audit({ uid: user.id, event: "login", ip });
    return res;
  } catch (e) {
    console.error("auth login failed", e);
    return NextResponse.json({ error: "Could not sign in right now." }, { status: 500 });
  }
}
