// Harbor Web — device pairing relay (server side)
//
// Lets a phone (which already holds the Debrid API key in its localStorage)
// hand it to a big screen (TV / laptop / iPad) through a short XXX-XXX code or
// a QR deep link (#pair=CODE). The server is a temporary postbox, never a
// store:
//   • the payload is AES-256-GCM encrypted at rest (vault.ts, AAD-bound to the
//     code so a ciphertext copied to another row is useless),
//   • single-use — the row is deleted the moment the waiting screen picks it up,
//   • 10-minute TTL, opportunistically purged,
//   • the API key is never logged and never returned to anyone who did not
//     present the exact code while the relay was live.
import crypto from "crypto";
import { encryptSecret, decryptSecret } from "@/lib/harbor/vault";
import type { DebridService } from "@/lib/harbor/debrid";

export const PAIRING_TTL_MS = 10 * 60_000;

/**
 * Services a pairing code can carry. Debrid keys live in the debrid store;
 * the TMDB credential lives in the settings store (tmdbUserKey) — same relay,
 * per-service pinning, fully independent flows.
 */
export type PairingService = DebridService | "tmdb";

export function isPairingService(v: unknown): v is PairingService {
  return v === "realdebrid" || v === "alldebrid" || v === "torbox" || v === "tmdb";
}
// 32-char alphabet without 0/O/1/I (never mistakable on a TV across the room).
// Exported so the QR-login + addon-transfer codes use the SAME unambiguous
// format (no conflicting display conventions across features).
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type PairingPayload = {
  service: PairingService;
  apiKey: string;
  username: string | null;
  premium: boolean;
  expiresAt: number | null;
  planName: string | null;
  /** TMDB only: which credential shape arrived (v3 API key | v4 read token). */
  kind?: "v3" | "v4" | null;
};

/** 6-char pairing code, e.g. "K7Q2XD" (displayed as "K7Q-2XD"). */
export function genPairingCode(): string {
  const bytes = crypto.randomBytes(6);
  let out = "";
  for (let i = 0; i < 6; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

/** Accepts "K7Q-2XD", "k7q2xd", "K7Q 2XD" → "K7Q2XD", or null when invalid. */
export function normalizePairingCode(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const up = v.toUpperCase().replace(/[\s-]/g, "");
  if (!/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(up)) return null;
  return up;
}

/** Display form "K7Q-2XD" (the code itself is always Latin → bidi-safe). */
export function formatPairingCode(code: string): string {
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}

export function pairingAad(code: string): string {
  return `pairing:${code}`;
}

export function sealPairingPayload(code: string, payload: PairingPayload): string {
  return encryptSecret(JSON.stringify(payload), pairingAad(code));
}

export function openPairingPayload(code: string, sealed: string): PairingPayload | null {
  const raw = decryptSecret(sealed, pairingAad(code));
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as Partial<PairingPayload>;
    if (!isPairingService(d.service) || typeof d.apiKey !== "string" || d.apiKey.length < 10) {
      return null;
    }
    return {
      service: d.service,
      apiKey: d.apiKey,
      username: typeof d.username === "string" ? d.username : null,
      premium: d.premium === true,
      expiresAt: typeof d.expiresAt === "number" ? d.expiresAt : null,
      planName: typeof d.planName === "string" ? d.planName : null,
      kind: d.kind === "v3" || d.kind === "v4" ? d.kind : null,
    };
  } catch {
    return null;
  }
}
