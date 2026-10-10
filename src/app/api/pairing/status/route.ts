// Harbor Web — GET /api/pairing/status?code=XXXXXX
// Polled by the big screen while it waits. Two states matter:
//   • "waiting" — the code is live, nothing claimed it yet
//   • "linked"  — a phone claimed the code: the encrypted payload is opened,
//                 the row is DELETED (single-use), and the debrid config is
//                 handed over exactly once
// Anything else is "missing" (expired, canceled, or already relayed).
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clientIp } from "@/lib/harbor/proxy-core";
import { rateLimit } from "@/lib/harbor/auth/ratelimit";
import { normalizePairingCode, openPairingPayload } from "@/lib/harbor/pairing-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const rl = await rateLimit(`pairing-status:${clientIp(req)}`, 120, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }
  const code = normalizePairingCode(req.nextUrl.searchParams.get("code"));
  if (!code) {
    return NextResponse.json({ error: "invalid code" }, { status: 400 });
  }

  let row: {
    code: string;
    payloadEnc: string | null;
    pinnedService: string | null;
    claimedAt: Date | null;
    expiresAt: Date;
  } | null = null;
  try {
    row = await db.pairingCode.findUnique({
      where: { code },
      select: { code: true, payloadEnc: true, pinnedService: true, claimedAt: true, expiresAt: true },
    });
  } catch {
    return NextResponse.json({ error: "pairing storage unavailable" }, { status: 502 });
  }

  if (!row || row.expiresAt.getTime() <= Date.now()) {
    return NextResponse.json({ status: "missing" });
  }

  // Claimed → hand over the payload exactly once, then delete the row.
  // peek=1 (phone-side pre-claim check) NEVER consumes the handover — only
  // the waiting screen's own poll may relay the key.
  if (req.nextUrl.searchParams.get("peek") === "1") {
    if (row.claimedAt) {
      return NextResponse.json({ status: "claimed" });
    }
    return NextResponse.json({
      status: "waiting",
      ...(row.pinnedService ? { service: row.pinnedService } : {}),
      expiresAt: row.expiresAt.getTime(),
    });
  }
  if (row.claimedAt && row.payloadEnc) {
    const taken = await db.pairingCode.deleteMany({
      where: { code, claimedAt: row.claimedAt, payloadEnc: { not: null } },
    });
    if (taken.count !== 1) {
      // Another poll already relayed it — the code is spent.
      return NextResponse.json({ status: "missing" });
    }
    const payload = openPairingPayload(code, row.payloadEnc);
    if (!payload) {
      return NextResponse.json({ status: "missing" });
    }
    return NextResponse.json({
      status: "linked",
      service: payload.service,
      apiKey: payload.apiKey,
      username: payload.username,
      premium: payload.premium,
      expiresAt: payload.expiresAt,
      planName: payload.planName,
      ...(payload.kind ? { kind: payload.kind } : {}),
    });
  }

  // Claimed but the payload was already relayed by another poll.
  if (row.claimedAt) {
    return NextResponse.json({ status: "missing" });
  }

  // The phone peeks this endpoint before claiming: pinnedService tells it
  // WHICH debrid key to send (per-service QR linking). Null → legacy code,
  // the phone is free to pick.
  return NextResponse.json({
    status: "waiting",
    ...(row.pinnedService ? { service: row.pinnedService } : {}),
    expiresAt: row.expiresAt.getTime(),
  });
}
