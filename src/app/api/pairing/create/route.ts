// Harbor Web — POST /api/pairing/create
// A big screen (TV / laptop / iPad) asks for a short pairing code. The phone
// will later claim this code with the debrid key (POST /api/pairing/claim).
// Optional JSON body { service } pins the code to ONE debrid service
// (torbox | realdebrid | alldebrid) — the per-service QR linking flows: a QR
// generated on the TorBox tab can only ever be satisfied with a TorBox key,
// completely independent of the other services' flows. Omitted body → legacy
// any-service code (the phone picks the service, as before).
// Expired rows are purged opportunistically; codes are single-use and live
// for 10 minutes.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clientIp } from "@/lib/harbor/proxy-core";
import { rateLimit } from "@/lib/harbor/auth/ratelimit";
import { PAIRING_TTL_MS, genPairingCode, formatPairingCode } from "@/lib/harbor/pairing-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parsePinnedService(raw: unknown): string | null | undefined {
  // undefined → no body / no service field (legacy). null → invalid literal.
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (raw === "torbox" || raw === "realdebrid" || raw === "alldebrid") return raw;
  return null;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rl = await rateLimit(`pairing-create:${clientIp(req)}`, 8, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  // Optional {service} pin — invalid service literal → 400 (never a silent
  // downgrade to any-service: the QR must link exactly what the screen shows).
  let pinnedService: string | null = null;
  if (req.headers.get("content-length") !== "0") {
    try {
      const body = (await req.json()) as { service?: unknown };
      const parsed = parsePinnedService(body?.service);
      if (parsed === null) {
        return NextResponse.json(
          { error: "invalid service (torbox | realdebrid | alldebrid)" },
          { status: 400 },
        );
      }
      pinnedService = parsed ?? null;
    } catch {
      // Empty/invalid JSON body → legacy code (no pin). Matches old callers.
      pinnedService = null;
    }
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
      await db.pairingCode.create({
        data: { code, expiresAt, ...(pinnedService ? { pinnedService } : {}) },
      });
      return NextResponse.json({
        code,
        displayCode: formatPairingCode(code),
        ...(pinnedService ? { service: pinnedService } : {}),
        expiresAt: expiresAt.getTime(),
        ttlMs: PAIRING_TTL_MS,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message ?? "" : "";
      if (!/unique|P2002/i.test(msg)) {
        return NextResponse.json({ error: "could not create pairing code" }, { status: 502 });
      }
      // duplicate code → loop and try another
    }
  }
  return NextResponse.json({ error: "could not create pairing code" }, { status: 502 });
}
