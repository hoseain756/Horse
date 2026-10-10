// Harbor Web — QR login relay (server side).
//
// A TV / laptop that is NOT signed in yet asks for a short XXX-XXX code
// (POST /api/auth/qr/create) and polls /api/auth/qr/status with a long random
// poll token. A phone that already has a session peeks at the code (sees what
// device is asking), then approves or denies it. On approval the TV's next
// poll is handed a real DB session (cookie set by createSession) — the row is
// consumed exactly once.
//
// Security posture (mirrors the debrid pairing relay):
//   • the poll token is 256-bit random and only its sha256 (pollHash) is
//     stored — a DB leak cannot be replayed as poll tokens,
//   • the code alone can do nothing: approving/denying requires a session,
//     collecting the session requires the poll token,
//   • 5-minute TTL, opportunistically purged, single-use consumption,
//   • deviceHint is a coarse UA summary ("Chrome · Windows") — never the raw
//     UA, so the approval dialog on the phone stays readable and private.
import crypto from "crypto";
import { CODE_ALPHABET } from "@/lib/harbor/pairing-server";

export const QR_TTL_MS = 5 * 60_000;

/** 6-char QR code, same unambiguous alphabet as the pairing codes. */
export function genQrCode(): string {
  const bytes = crypto.randomBytes(6);
  let out = "";
  for (let i = 0; i < 6; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

/** Accepts "K7Q-2XD", "k7q2xd", "K7Q 2XD" → "K7Q2XD", or null when invalid. */
export function normalizeQrCode(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const up = v.toUpperCase().replace(/[\s-]/g, "");
  if (!/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(up)) return null;
  return up;
}

/** Display form "K7Q-2XD" (the code itself is always Latin → bidi-safe). */
export function formatQrCode(code: string): string {
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}

/** 256-bit opaque poll token for the TV (raw value never stored — hashed). */
export function genPollToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/** sha256 hex of a poll token — the only form persisted in the DB. */
export function hashPollToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Coarse device description for the approval dialog ("Chrome · Windows").
 * Family-level only: browser engine family + OS family, ≤40 chars, English. */
export function deviceHintFromUa(ua: string): string {
  const u = (ua || "").slice(0, 300);
  const browser = /Edg(?:e|A|iOS)?\//.test(u)
    ? "Edge"
    : /Firefox\//.test(u)
      ? "Firefox"
      : /Chrome\/|CrMo\/|CriOS\//.test(u)
        ? "Chrome"
        : /AppleWebKit\//.test(u)
          ? /Version\/[\d.]+/.test(u)
            ? "Safari"
            : "WebView"
          : /Gecko\//.test(u)
            ? "Firefox"
            : "Unknown";
  const tv =
    /SMART-TV|SmartTV|Apple ?TV|GoogleTV|Bravia|AFT[BM\s]|Netcast|WebOS|Tizen|CrKey|Android TV|Fire TV|\bTV\b/i.test(u);
  const os = tv
    ? "TV"
    : /Windows/.test(u)
      ? "Windows"
      : /CrOS/.test(u)
        ? "Linux"
        : /Android/.test(u)
          ? "Android"
          : /iPad/.test(u)
            ? "iPadOS"
            : /iPhone|iPod/.test(u)
              ? "iOS"
              : /Mac OS X|Macintosh/.test(u)
                ? "macOS"
                : /Linux|X11/.test(u)
                  ? "Linux"
                  : "Unknown";
  return `${browser} · ${os}`.slice(0, 40);
}
