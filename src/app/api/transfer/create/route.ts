// Harbor Web — POST /api/transfer/create  { addons, senderHint? }
// Seals the sender's installed-addons list (AES-256-GCM, AAD-bound to the
// code) into a single-use XXX-XXX-XXX code with a 6-minute TTL. Expired rows
// are purged opportunistically. No auth — the sender may be sharing from any
// device; the payload itself is the secret and the code is the key.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ensureDb } from "@/lib/ensure-db";
import { rateLimit } from "@/lib/harbor/auth/ratelimit";
import { clientIp } from "@/lib/harbor/auth/util";
import {
  TRANSFER_TTL_MS,
  TransferAddonSchema,
  formatTransferCode,
  genTransferCode,
  sealTransferPayload,
  type TransferPayload,
} from "@/lib/harbor/transfer-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  addons: z.array(TransferAddonSchema).min(1).max(60),
  senderHint: z.string().trim().min(1).max(120).optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rl = await rateLimit(`transfer-create:${clientIp(req)}`, 8, 60_000);
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
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid addons payload" }, { status: 400 });
  }

  // Opportunistic purge — keeps the table tiny without a cron.
  try {
    await db.transferCode.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  } catch {
    /* purge is best-effort */
  }

  const payload: TransferPayload = {
    v: 1,
    addons: parsed.data.addons,
    ...(parsed.data.senderHint ? { senderHint: parsed.data.senderHint } : {}),
  };

  // Insert with collision retries (32^9 ≈ 3.5e13 space — retries are symbolic).
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = genTransferCode();
    const expiresAt = new Date(Date.now() + TRANSFER_TTL_MS);
    try {
      await db.transferCode.create({
        data: {
          code,
          payloadEnc: sealTransferPayload(code, payload),
          count: payload.addons.length,
          senderHint: payload.senderHint ?? null,
          expiresAt,
        },
      });
      return NextResponse.json({
        code,
        displayCode: formatTransferCode(code),
        expiresAt: expiresAt.getTime(),
        ttlMs: TRANSFER_TTL_MS,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (!/unique|P2002/i.test(msg)) {
        return NextResponse.json({ error: "could not create transfer code" }, { status: 502 });
      }
      // duplicate code → loop and try another
    }
  }
  return NextResponse.json({ error: "could not create transfer code" }, { status: 502 });
}
