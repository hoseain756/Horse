// Transactional email — provider-abstracted (Resend by default; the interface
// is the swap point for any other provider).
//
// Graceful degradation:
//  - RESEND_API_KEY set        → real email (localized templates).
//  - Not set + development     → ConsoleProvider logs the message + link.
//  - Not set + production      → provider reports unavailable; callers return
//    honest, non-enumerating errors (the flow cannot work without email).
import crypto from "crypto";

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export interface MailProvider {
  readonly available: boolean;
  readonly name: string;
  send(msg: MailMessage): Promise<void>;
}

class ResendProvider implements MailProvider {
  readonly name = "resend";
  readonly available = true;
  constructor(private apiKey: string, private from: string) {}
  async send(msg: MailMessage): Promise<void> {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: this.from,
        to: [msg.to],
        subject: msg.subject,
        text: msg.text,
        html: msg.html,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      // Never log the message body (may contain tokens) — status + provider error only.
      throw new Error(`resend send failed: ${res.status} ${body.slice(0, 200)}`);
    }
  }
}

class ConsoleProvider implements MailProvider {
  readonly name = "console";
  readonly available = false; // "available" means real delivery
  async send(msg: MailMessage): Promise<void> {
    console.info(`[horse:mail] (dev console fallback) to=${msg.to} subject="${msg.subject}"\n${msg.text}`);
  }
}

let provider: MailProvider | null = null;

export function mailer(): MailProvider {
  if (!provider) {
    const key = process.env.RESEND_API_KEY?.trim();
    const from = process.env.MAIL_FROM?.trim() || "Horse <onboarding@resend.dev>";
    provider = key ? new ResendProvider(key, from) : new ConsoleProvider();
  }
  return provider;
}

export function mailAvailable(): boolean {
  return mailer().available;
}

// ---------- localized templates (ar/en) ----------

export type MailLang = "en" | "ar";

function shell(title: string, body: string, ctaLabel: string, url: string, lang: MailLang): { html: string; text: string } {
  const dir = lang === "ar" ? "rtl" : "ltr";
  const html = `<!doctype html><html dir="${dir}"><body style="margin:0;background:#0c0d10;font-family:system-ui,'Segoe UI',Roboto,sans-serif;color:#e8eaf0">
  <div style="max-width:480px;margin:0 auto;padding:32px 24px">
    <div style="font-size:20px;font-weight:700;margin-bottom:16px">🐎 Horse</div>
    <div style="background:#16181d;border:1px solid #2a2d35;border-radius:16px;padding:24px">
      <h1 style="margin:0 0 12px;font-size:18px">${title}</h1>
      <p style="margin:0 0 20px;line-height:1.6;color:#b9bdc9">${body}</p>
      <a href="${url}" style="display:inline-block;background:#e8eaf0;color:#0c0d10;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:999px">${ctaLabel}</a>
      <p style="margin:20px 0 0;font-size:12px;color:#7d8290;line-height:1.6">${lang === "ar" ? "إذا لم تطلب هذا البريد يمكنك تجاهله بأمان. الرابط صالح لفترة محدودة ويُستخدم مرة واحدة." : "If you didn't request this email you can safely ignore it. The link is single-use and expires shortly."}</p>
    </div>
  </div></body></html>`;
  const text = `${title}\n${body}\n\n${url}\n`;
  return { html, text };
}

export function verifyEmailMessage(to: string, url: string, lang: MailLang): MailMessage {
  const { html, text } = shell(
    lang === "ar" ? "تأكيد بريدك الإلكتروني" : "Verify your email",
    lang === "ar"
      ? "مرحبًا! أكد بريدك الإلكتروني لتفعيل كامل مزايا الحساب في Horse."
      : "Welcome! Confirm your email to unlock full account features in Horse.",
    lang === "ar" ? "تأكيد البريد" : "Verify email",
    url,
    lang,
  );
  return { to, subject: lang === "ar" ? "Horse — تأكيد البريد الإلكتروني" : "Horse — Verify your email", text, html };
}

export function resetPasswordMessage(to: string, url: string, lang: MailLang): MailMessage {
  const { html, text } = shell(
    lang === "ar" ? "إعادة تعيين كلمة المرور" : "Reset your password",
    lang === "ar"
      ? "تلقينا طلبًا لإعادة تعيين كلمة مرور حسابك. عند الضغط على الزر ستُسجَّل خروج جميع الأجهزة الأخرى."
      : "We received a request to reset your account password. Continuing will sign out all other devices.",
    lang === "ar" ? "إعادة التعيين" : "Reset password",
    url,
    lang,
  );
  return { to, subject: lang === "ar" ? "Horse — إعادة تعيين كلمة المرور" : "Horse — Reset your password", text, html };
}

// ---------- single-use, hashed email tokens ----------

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const RESET_TTL_MS = 60 * 60 * 1000; // 1h

export type TokenKind = "verify" | "reset";

function ttlFor(kind: TokenKind): number {
  return kind === "verify" ? VERIFY_TTL_MS : RESET_TTL_MS;
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Mint a single-use token (raw returned once; only the hash is stored).
 * Any previous token of the same kind for this user is invalidated. */
export async function issueEmailToken(uid: string, kind: TokenKind): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + ttlFor(kind));
  await db.emailToken.deleteMany({ where: { uid, kind } });
  await db.emailToken.create({ data: { uid, kind, tokenHash: hashToken(token), expiresAt } });
  return { token, expiresAt };
}

/** Consume a token: single-use + expiry checked atomically-ish (hash unique). */
export async function consumeEmailToken(
  rawToken: string,
  kind: TokenKind,
): Promise<{ uid: string } | null> {
  const row = await db.emailToken.findUnique({ where: { tokenHash: hashToken(rawToken) } });
  if (!row || row.kind !== kind || row.usedAt) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  await db.emailToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  return { uid: row.uid };
}
