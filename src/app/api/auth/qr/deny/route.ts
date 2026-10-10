// Harbor Web — POST /api/auth/qr/deny  { code }
// The phone side, step 2b: refuse the login request. The row flips to
// "denied" (kept briefly so the TV's poll sees the denial instead of a
// generic expiry), then it is swept by the status route. Idempotent: denying
// a missing/expired/used code still answers { ok: true } — the outcome the
// phone wanted already holds.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ensureDb } from "@/lib/ensure-db";
import { rateLimit } from "@/lib/harbor/auth/ratelimit";
import { clientIp } from "@/lib/harbor/auth/util";
import { sessionUid } from "@/lib/harbor/auth/session";
import { normalizeQrCode } from "@/lib/harbor/qr-login-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ code: z.string().max(32) });

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rl = await rateLimit(`qr-deny:${clientIp(req)}`, 15, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }
  await ensureDb();

  const uid = await sessionUid(req);
  if (!uid) {
    return NextResponse.json({ error: "auth required" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const parsed = Body.safeParse(raw);
  const code = parsed.success ? normalizeQrCode(parsed.data.code) : null;
  if (!code) {
    return NextResponse.json({ ok: true });
  }

  try {
    await db.qrLogin.updateMany({
      where: { code, status: "waiting" },
      data: { status: "denied" },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "storage unavailable" }, { status: 502 });
  }
}
