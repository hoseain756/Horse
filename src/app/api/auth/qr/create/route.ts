// Harbor Web — POST /api/auth/qr/create
// A TV / laptop that is not signed in yet asks for a short QR-login code.
// The phone will later approve it (POST /api/auth/qr/approve after a peek).
// Expired rows are purged opportunistically; codes are single-use and live
// for 5 minutes. The TV keeps the returned pollToken SECRET (256-bit) — only
// its sha256 is stored — and polls /api/auth/qr/status with it.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureDb } from "@/lib/ensure-db";
import { rateLimit } from "@/lib/harbor/auth/ratelimit";
import { clientIp } from "@/lib/harbor/auth/util";
import {
  QR_TTL_MS,
  deviceHintFromUa,
  formatQrCode,
  genPollToken,
  genQrCode,
  hashPollToken,
} from "@/lib/harbor/qr-login-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rl = await rateLimit(`qr-create:${clientIp(req)}`, 8, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }
  await ensureDb();

  // Opportunistic purge — keeps the table tiny without a cron.
  try {
    await db.qrLogin.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  } catch {
    /* purge is best-effort */
  }

  const deviceHint = deviceHintFromUa(req.headers.get("user-agent") ?? "");
  const pollToken = genPollToken();
  const pollHash = hashPollToken(pollToken);
  const expiresAt = new Date(Date.now() + QR_TTL_MS);

  // Insert with collision retries (32^6 ≈ 1.07e9 space — retries are symbolic).
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = genQrCode();
    try {
      await db.qrLogin.create({ data: { code, pollHash, deviceHint, expiresAt } });
      return NextResponse.json({
        code,
        displayCode: formatQrCode(code),
        pollToken,
        deviceHint,
        expiresAt: expiresAt.getTime(),
        ttlMs: QR_TTL_MS,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (!/unique|P2002/i.test(msg)) {
        return NextResponse.json({ error: "could not create login code" }, { status: 502 });
      }
      // duplicate code → loop and try another
    }
  }
  return NextResponse.json({ error: "could not create login code" }, { status: 502 });
}
