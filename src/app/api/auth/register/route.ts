// POST /api/auth/register {email, password, displayName?, username?}
// Creates a HORSE platform account (email + password), sets the httpOnly
// DB-backed session cookie, and (when mail is configured) sends a single-use
// verification email. Duplicate email/username handling is generic and
// timing-equalized so account existence is never revealed.
// The client then pulls/merges the (fresh) account bucket and pushes its
// local data up — seeding the account with this device's addons & library.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ensureDb } from "@/lib/ensure-db";
import { dummyVerify, hashPassword, isBreachedPassword, validatePassword } from "@/lib/harbor/auth/password";
import { createSession } from "@/lib/harbor/auth/session";
import { rateLimit } from "@/lib/harbor/auth/ratelimit";
import { clientIp, audit } from "@/lib/harbor/auth/util";
import { getAppUrl } from "@/lib/harbor/auth/app-url";
import { issueEmailToken, mailAvailable, mailer, verifyEmailMessage } from "@/lib/harbor/auth/mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string(),
  displayName: z.string().trim().max(40).optional(),
  username: z.string().trim().max(24).optional(),
  lang: z.enum(["en", "ar"]).optional(),
});

function normalizeUsername(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const u = raw.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9_.-]{2,23}$/.test(u) ? u : null;
}

function deriveUsername(email: string): string {
  const base = (email.split("@")[0] || "user").replace(/[^a-z0-9_.-]/g, "").slice(0, 16) || "user";
  // Pad to the 3-char minimum; the create-retry loop uniquifies on collision.
  return base.padEnd(3, "0").slice(0, 20);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  await ensureDb(); // create sqlite file + tables on cold serverless instances
  const ip = clientIp(req);
  if (!(await rateLimit(`register:ip:${ip}`, 10, 60_000)).ok) {
    return NextResponse.json({ error: "Too many attempts. Try again shortly." }, { status: 429 });
  }
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    const emailBad = parsed.error.issues.some((i) => i.path[0] === "email");
    return NextResponse.json(
      { error: emailBad ? "Please enter a valid email address." : "Please check the form and try again." },
      { status: 400 },
    );
  }
  const { email, displayName, lang = "en" } = parsed.data;
  const password = parsed.data.password;
  if (!validatePassword(password)) {
    return NextResponse.json({ error: "Password must be 10–128 characters." }, { status: 400 });
  }
  const explicitUsername = normalizeUsername(parsed.data.username);

  try {
    // Breach check (k-anonymity, fail-open) BEFORE any DB work.
    if (await isBreachedPassword(password)) {
      return NextResponse.json(
        { error: "This password has appeared in public data breaches. Please choose a stronger one." },
        { status: 400 },
      );
    }

    // Uniqueness + timing-equalization: when the email (or derived/explicit
    // username) is taken, burn a scrypt verify and return the GENERIC error.
    const emailTaken = await db.horseUser.findUnique({ where: { email }, select: { id: true } });
    let usernameTaken: { id: string } | null = null;
    if (explicitUsername) usernameTaken = await db.horseUser.findUnique({ where: { username: explicitUsername }, select: { id: true } });
    if (emailTaken || usernameTaken) {
      dummyVerify(password);
      await audit({ event: "signup_failed", ip, detail: { reason: "duplicate" } });
      return NextResponse.json(
        { error: "Could not create the account with these details." },
        { status: 409 },
      );
    }

    const passwordHash = hashPassword(password);
    const displayNameSafe = displayName || null;

    // Create the user, uniquifying a derived username on collision.
    let user: { id: string; email: string; username: string; displayName: string | null; createdAt: Date } | null = null;
    for (let attempt = 0; attempt < 6 && !user; attempt++) {
      const username = explicitUsername ?? (attempt === 0 ? deriveUsername(email) : `${deriveUsername(email)}-${attempt + 1}`);
      try {
        user = await db.horseUser.create({
          data: { email, username, displayName: displayNameSafe, passwordHash },
          select: { id: true, email: true, username: true, displayName: true, createdAt: true },
        });
      } catch (e) {
        if (typeof e === "object" && e && "code" in e && (e as { code?: string }).code === "P2002") {
          if (explicitUsername) {
            dummyVerify(password);
            await audit({ event: "signup_failed", ip, detail: { reason: "duplicate" } });
            return NextResponse.json({ error: "Could not create the account with these details." }, { status: 409 });
          }
          continue; // derived username collision — retry with suffix
        }
        throw e;
      }
    }
    if (!user) throw new Error("username derivation exhausted");

    // Session (rotated, DB-backed) + audit.
    const res = NextResponse.json({
      ok: true,
      user: {
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        createdAt: user.createdAt.toISOString(),
        emailVerified: false,
      },
      verificationSent: mailAvailable(),
    });
    await createSession(user.id, req, res);
    await audit({ uid: user.id, event: "signup", ip });

    // Verification email (single-use hashed token) — best effort.
    if (mailAvailable()) {
      try {
        const { token } = await issueEmailToken(user.id, "verify");
        const url = `${getAppUrl(req)}/#verify=${encodeURIComponent(token)}`;
        await mailer().send(verifyEmailMessage(user.email, url, lang));
      } catch (e) {
        console.error("[horse:auth] verification email failed", e instanceof Error ? e.message : e);
      }
    }
    return res;
  } catch (e) {
    console.error("auth register failed", e);
    return NextResponse.json({ error: "Could not create the account." }, { status: 500 });
  }
}
