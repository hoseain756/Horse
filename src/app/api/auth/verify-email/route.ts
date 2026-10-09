// POST /api/auth/verify-email {token} — consumes a single-use verification
// token (delivered by email as <app>/#verify=<token>) and marks the account
// verified. Tokens are stored hashed; expiry 24h.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ensureDb } from "@/lib/ensure-db";
import { consumeEmailToken } from "@/lib/harbor/auth/mail";
import { audit } from "@/lib/harbor/auth/util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ token: z.string().min(20).max(200) });

export async function POST(req: NextRequest): Promise<NextResponse> {
  await ensureDb();
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid verification link." }, { status: 400 });
  try {
    const consumed = await consumeEmailToken(parsed.data.token, "verify");
    if (!consumed) return NextResponse.json({ error: "This verification link is invalid or has expired." }, { status: 400 });
    await db.horseUser.update({ where: { id: consumed.uid }, data: { emailVerifiedAt: new Date() } });
    await audit({ uid: consumed.uid, event: "email_verify" });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("verify-email failed", e);
    return NextResponse.json({ error: "Could not verify the email right now." }, { status: 500 });
  }
}
