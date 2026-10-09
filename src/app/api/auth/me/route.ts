// Harbor Web — GET /api/auth/me
// Session probe for the client store: returns the signed-in user (if any).
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureDb } from "@/lib/ensure-db";
import { sessionUid } from "@/lib/harbor/account-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const uid = sessionUid(req);
  if (!uid) return NextResponse.json({ authenticated: false });
  await ensureDb(); // create sqlite file + tables on cold serverless instances
  try {
    const user = await db.horseUser.findUnique({
      where: { id: uid },
      select: { username: true, createdAt: true },
    });
    if (!user) return NextResponse.json({ authenticated: false });
    return NextResponse.json({ authenticated: true, user: { username: user.username, createdAt: user.createdAt.toISOString() } });
  } catch (e) {
    console.error("auth me failed", e);
    return NextResponse.json({ authenticated: false });
  }
}
