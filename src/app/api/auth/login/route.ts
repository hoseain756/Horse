// Harbor Web — POST /api/auth/login {username, password}
// Verifies credentials against the scrypt hash and sets the httpOnly session
// cookie. The client follows up by merging the account bucket (addons etc.)
// into local state and pushing back — the cross-device handoff.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  SESSION_COOKIE,
  clientIp,
  createSessionCookieValue,
  normalizeUsername,
  rateLimit,
  sessionCookieOptions,
  verifyPassword,
} from "@/lib/harbor/account-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!rateLimit(`login:${clientIp(req)}`, 15, 60_000)) {
    return NextResponse.json({ error: "Too many attempts. Try again in a minute." }, { status: 429 });
  }
  let body: { username?: unknown; password?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const username = normalizeUsername(body.username);
  const password = typeof body.password === "string" ? body.password : "";
  if (!username || !password) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 400 });
  }
  try {
    const user = await db.horseUser.findUnique({ where: { username } });
    // Generic error for both cases — never reveal whether a username exists.
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
    }
    const res = NextResponse.json({
      ok: true,
      user: { username: user.username, createdAt: user.createdAt.toISOString() },
    });
    res.cookies.set(SESSION_COOKIE, createSessionCookieValue(user.id), sessionCookieOptions());
    return res;
  } catch (e) {
    console.error("auth login failed", e);
    return NextResponse.json({ error: "Could not sign in." }, { status: 500 });
  }
}
