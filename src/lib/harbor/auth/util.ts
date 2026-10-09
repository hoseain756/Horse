// Shared auth utilities: client IP extraction, privacy-preserving IP hash,
// user-agent summary, and the audit-log writer (security events only — never
// credentials, tokens, or full IPs).
import crypto from "crypto";
import { db } from "@/lib/db";

export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "local";
}

export function ipHash(ip: string): string {
  const secret = process.env.HORSE_TOKEN_SECRET?.trim() || "harbor-dev-fallback-secret";
  return crypto.createHash("sha256").update(`${ip}:${secret}`).digest("hex").slice(0, 16);
}

/** Compact, privacy-friendly UA summary for the devices list. */
export function uaSummary(uaRaw: string): string {
  const ua = uaRaw || "";
  const browser =
    /Edg(?:e|A|iOS)?\/([\d.]+)/.exec(ua)?.[1] ??
    /OPR\/([\d.]+)/.exec(ua)?.[1] ??
    /Firefox\/([\d.]+)/.exec(ua)?.[1] ??
    /Chrome\/([\d.]+)/.exec(ua)?.[1] ??
    /Version\/([\d.]+).*Safari/.exec(ua)?.[1] ??
    /Safari\/[\d.]+/.exec(ua)?.[0] ??
    "Unknown browser";
  const os =
    /Windows NT 10/.test(ua)
      ? "Windows"
      : /Windows/.test(ua)
        ? "Windows (old)"
        : /Android ([\d.]+)/.exec(ua)?.[0]
          ? `Android ${/Android ([\d.]+)/.exec(ua)![1].split(".")[0]}`
          : /iPhone|iPad|iPod/.test(ua)
            ? "iOS"
            : /Mac OS X/.test(ua)
              ? "macOS"
              : /CrOS/.test(ua)
                ? "ChromeOS"
                : /Linux/.test(ua)
                  ? "Linux"
                  : "Unknown OS";
  const major = browser.match(/\d+/)?.[0] ?? "";
  const name = browser.replace(/\/[\d.]+$/, "");
  return `${name}${major ? " " + major : ""} · ${os}`;
}

export function truncateUa(uaRaw: string): string {
  return (uaRaw || "").slice(0, 180);
}

export type AuditInput = {
  uid?: string | null;
  event: string;
  ip?: string | null;
  detail?: Record<string, unknown>;
};

export async function audit(input: AuditInput): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        uid: input.uid ?? null,
        event: input.event,
        ipHash: input.ip ? ipHash(input.ip) : null,
        detail: input.detail ? JSON.stringify(input.detail) : null,
      },
    });
  } catch (e) {
    console.error("[horse:auth] audit write failed", input.event, e instanceof Error ? e.message : e);
  }
}
