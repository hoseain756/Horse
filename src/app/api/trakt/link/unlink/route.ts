// Harbor Web — POST /api/trakt/link/unlink { linkId }
// Revokes the Trakt token server-side (best-effort) and deletes the vault row.
import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/harbor/proxy-core";
import { db } from "@/lib/db";
import { ensureDb } from "@/lib/ensure-db";
import { resolveSession } from "@/lib/harbor/auth/session";
import { resolveLinkedAccount, revokeTraktToken } from "@/lib/harbor/link-resolve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  await ensureDb(); // create sqlite file + tables on cold serverless instances
  const ip = clientIp(req);
  if (!rateLimit(`${ip}:trakt-unlink`, 20, 60_000)) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }
  let linkId = "";
  try {
    const body = (await req.json()) as { linkId?: unknown };
    if (typeof body.linkId === "string") linkId = body.linkId;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const session = await resolveSession(req);
  const account = session ? await resolveLinkedAccount(linkId, session.uid).catch(() => null) : null;
  if (!account || account.provider !== "trakt") {
    return NextResponse.json({ ok: true, note: "already unlinked" });
  }
  await revokeTraktToken(account.accessToken);
  await db.linkedAccount.delete({ where: { id: account.linkId } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
