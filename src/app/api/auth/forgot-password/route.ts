// POST /api/auth/forgot-password {email} — always answers generically (no
// account enumeration). When the account exists AND mail is configured, a
// single-use reset link is emailed (1h expiry). Without a mail provider the
// response fails honestly with a clear message (503).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ensureDb } from "@/lib/ensure-db";
import { getAppUrl } from "@/lib/harbor/auth/app-url";
import { issueEmailToken, mailAvailable, mailer, resetPasswordMessage } from "@/lib/harbor/auth/mail";
import { rateLimit } from "@/lib/harbor/auth/ratelimit";
import { audit, clientIp } from "@/lib/harbor/auth/util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ email: z.string().trim().toLowerCase().email().max(254), lang: z.enum(["en", "ar"]).optional() });

export async function POST(req: NextRequest): Promise<NextResponse> {
  await ensureDb();
  const ip = clientIp(req);
  if (!(await rateLimit(`forgot:ip:${ip}`, 5, 60_000)).ok) {
    // Same generic answer as success — no signal to attackers.
    return NextResponse.json({ ok: true });
  }
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });

  // No mail provider → honest failure (the flow cannot complete).
  if (!mailAvailable()) {
    return NextResponse.json(
      { error: "Email delivery is not configured on this deployment. Contact the operator to reset your password." },
      { status: 503 },
    );
  }
  try {
    const user = await db.horseUser.findUnique({ where: { email: parsed.data.email }, select: { id: true } });
    if (user) {
      const { token } = await issueEmailToken(user.id, "reset");
      const url = `${getAppUrl(req)}/#reset=${encodeURIComponent(token)}`;
      await mailer().send(resetPasswordMessage(parsed.data.email, url, parsed.data.lang ?? "en"));
      await audit({ uid: user.id, event: "password_reset_requested", ip });
    }
    // Identical response whether or not the account exists.
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("forgot-password failed", e);
    return NextResponse.json({ ok: true }); // still generic
  }
}
