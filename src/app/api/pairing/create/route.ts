// Harbor Web — POST /api/pairing/create
// A big screen (TV / laptop / iPad) asks for a short pairing code. The phone
// will later claim this code with the debrid key (POST /api/pairing/claim).
// Expired rows are purged opportunistically; codes are single-use and live
// for 10 minutes.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clientIp } from "@/lib/harbor/proxy-core";
import { rateLimit } from "@/lib/harbor/auth/ratelimit";
import { PAIRING_TTL_MS, genPairingCode, formatPairingCode } from "@/lib/harbor/pairing-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rl = await rateLimit(`pairing-create:${clientIp(req)}`, 8, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  // Opportunistic purge — keeps the table tiny without a cron.
  try {
    await db.pairingCode.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  } catch {
    /* purge is best-effort */
  }

  // Insert with collision retries (32^6 ≈ 1.07e9 space — retries are symbolic).
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = genPairingCode();
    const expiresAt = new Date(Date.now() + PAIRING_TTL_MS);
    try {
      await db.pairingCode.create({ data: { code, expiresAt } });
      return NextResponse.json({
        code,
        displayCode: formatPairingCode(code),
        expiresAt: expiresAt.getTime(),
        ttlMs: PAIRING_TTL_MS,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (!/unique|P2002/i.test(msg)) {
        return NextResponse.json({ error: "could not create pairing code" }, { status: 502 });
      }
      // duplicate code → loop and try another
    }
  }
  return NextResponse.json({ error: "could not create pairing code" }, { status: 502 });
}
