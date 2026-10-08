// Harbor Web — POST /api/simkl/link/unlink { linkId }
// Deletes the vault row. (Simkl has no public token-revoke endpoint — the
// local link is removed and the user can revoke the app on simkl.com.)
import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/harbor/proxy-core";
import { db } from "@/lib/db";
import { resolveLinkedAccount } from "@/lib/harbor/link-resolve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = clientIp(req);
  if (!rateLimit(`${ip}:simkl-unlink`, 20, 60_000)) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }
  let linkId = "";
  try {
    const body = (await req.json()) as { linkId?: unknown };
    if (typeof body.linkId === "string") linkId = body.linkId;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const account = await resolveLinkedAccount(linkId).catch(() => null);
  if (!account || account.provider !== "simkl") {
    return NextResponse.json({ ok: true, note: "already unlinked" });
  }
  await db.linkedAccount.delete({ where: { id: account.linkId } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
