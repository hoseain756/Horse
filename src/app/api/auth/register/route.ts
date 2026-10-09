// Harbor Web — POST /api/auth/register {username, password}
// Creates a HORSE platform account and sets the httpOnly session cookie.
// The client then pulls/merges the (fresh) account bucket and pushes its
// local data up — seeding the account with this device's addons & library.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  SESSION_COOKIE,
  clientIp,
  createSessionCookieValue,
  hashPassword,
  normalizeUsername,
  rateLimit,
  sessionCookieOptions,
  validatePassword,
} from "@/lib/harbor/account-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!rateLimit(`register:${clientIp(req)}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many attempts. Try again in a minute." }, { status: 429 });
  }
  let body: { username?: unknown; password?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const username = normalizeUsername(body.username);
  if (!username) {
    return NextResponse.json(
      { error: "Username must be 3–24 characters: letters, numbers, dot, dash or underscore." },
      { status: 400 },
    );
  }
  const password = validatePassword(body.password);
  if (!password) {
    return NextResponse.json({ error: "Password must be 8–128 characters." }, { status: 400 });
  }
  try {
    const user = await db.horseUser.create({
      data: { username, passwordHash: hashPassword(password) },
      select: { id: true, username: true, createdAt: true },
    });
    const res = NextResponse.json({
      ok: true,
      user: { username: user.username, createdAt: user.createdAt.toISOString() },
    });
    res.cookies.set(SESSION_COOKIE, createSessionCookieValue(user.id), sessionCookieOptions());
    return res;
  } catch (e: unknown) {
    // Prisma unique-violation → username taken
    if (typeof e === "object" && e !== null && e !== undefined && "code" in e && (e as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "This username is already taken." }, { status: 409 });
    }
    console.error("auth register failed", e);
    return NextResponse.json({ error: "Could not create the account." }, { status: 500 });
  }
}
