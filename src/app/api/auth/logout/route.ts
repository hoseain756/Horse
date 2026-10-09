// Harbor Web — POST /api/auth/logout
// Clears the session cookie. The client pushes one final sync BEFORE calling
// this (so the account bucket stays fresh), then re-syncs its device bucket.
import { NextResponse } from "next/server";
import { SESSION_COOKIE, clearSessionCookieOptions } from "@/lib/harbor/account-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", clearSessionCookieOptions());
  return res;
}
