// Harbor Web — POST /api/transfer/claim  { code }
// The receiving side: prove knowledge of the code, get the sealed addons list
// exactly once. The claim is ATOMIC (updateMany — claimedAt must still be
// null and the row unexpired) so two receivers racing on the same code cannot
// both win. On success the payload is opened (any failure → the row is
// destroyed and "missing" is answered — never leak crypto details) and the
// sealed payload is WIPED: codes are single-shot, the receiver got the data.
// The inert row (claimedAt set, payloadEnc null) stays until expiry so a
// second claim answers "already" rather than a confusing "missing".
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ensureDb } from "@/lib/ensure-db";
import { rateLimit } from "@/lib/harbor/auth/ratelimit";
import { clientIp } from "@/lib/harbor/auth/util";
import {
  normalizeTransferCode,
  openTransferPayload,
} from "@/lib/harbor/transfer-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ code: z.string().max(48) });

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rl = await rateLimit(`transfer-claim:${clientIp(req)}`, 15, 60_000);
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
  const code = parsed.success ? normalizeTransferCode(parsed.data.code) : null;
  if (!code) {
    return NextResponse.json({ ok: false, reason: "missing" });
  }

  try {
    // Atomic single-use claim: only a live, unclaimed, sealed row can be won.
    const claimed = await db.transferCode.updateMany({
      where: { code, claimedAt: null, expiresAt: { gt: new Date() }, payloadEnc: { not: null } },
      data: { claimedAt: new Date() },
    });
    if (claimed.count === 0) {
      const existing = await db.transferCode.findUnique({
        where: { code },
        select: { claimedAt: true, expiresAt: true },
      });
      if (!existing) {
        return NextResponse.json({ ok: false, reason: "missing" });
      }
      if (existing.expiresAt.getTime() <= Date.now()) {
        await db.transferCode.deleteMany({ where: { code } }).catch(() => {});
        return NextResponse.json({ ok: false, reason: "missing" });
      }
      if (existing.claimedAt) {
        return NextResponse.json({ ok: false, reason: "already" });
      }
      return NextResponse.json({ ok: false, reason: "missing" });
    }

    const row = await db.transferCode.findUnique({ where: { code } });
    if (!row?.payloadEnc) {
      return NextResponse.json({ ok: false, reason: "missing" });
    }
    const payload = openTransferPayload(code, row.payloadEnc);
    if (!payload) {
      // Sealed data unreadable (tamper/rotation) — never leak details; the
      // code is destroyed so it cannot be retried.
      await db.transferCode.deleteMany({ where: { code } }).catch(() => {});
      return NextResponse.json({ ok: false, reason: "missing" });
    }
    // Single-shot: the receiver has the data — the sealed payload is wiped
    // NOW (nothing sensitive remains; a later claim sees claimedAt != null).
    // The row itself is kept until expiry so a second receiver gets the
    // meaningful "already" (someone used this code) instead of "missing".
    await db.transferCode
      .updateMany({ where: { code, claimedAt: { not: null } }, data: { payloadEnc: null } })
      .catch(() => {});
    return NextResponse.json({
      ok: true,
      addons: payload.addons,
      count: payload.addons.length,
      senderHint: payload.senderHint ?? null,
    });
  } catch {
    return NextResponse.json({ error: "storage unavailable" }, { status: 502 });
  }
}
