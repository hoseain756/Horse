// Harbor Web — addon transfer codes (server side).
//
// A user seals their installed-addons list (transportUrl + manifest snapshot)
// into a XXX-XXX-XXX code; anyone with the code claims it ONCE within 6
// minutes and the row is deleted on handover. The server is a temporary
// postbox, never a store:
//   • the payload is AES-256-GCM encrypted at rest (vault.ts, AAD-bound to
//     the code so a ciphertext copied to another row is useless) — addon
//     transportUrls can embed debrid tokens, so plaintext is never stored,
//   • single-shot — the claim is an atomic updateMany (claimedAt must still
//     be null) and the row is deleted the moment the payload is handed over,
//   • 6-minute TTL, opportunistically purged.
import crypto from "crypto";
import { z } from "zod";
import { encryptSecret, decryptSecret } from "@/lib/harbor/vault";
import { CODE_ALPHABET } from "@/lib/harbor/pairing-server";

export const TRANSFER_TTL_MS = 6 * 60_000;

/** 9-char transfer code, same unambiguous alphabet as the pairing codes. */
export function genTransferCode(): string {
  const bytes = crypto.randomBytes(9);
  let out = "";
  for (let i = 0; i < 9; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

/** Accepts "XXX-XXX-XXX", "xxxxxxxxx", "XXX XXX XXX" → "XXXXXXXXX", or null. */
export function normalizeTransferCode(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const up = v.toUpperCase().replace(/[\s-]/g, "");
  if (!/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{9}$/.test(up)) return null;
  return up;
}

/** Display form "XXX-XXX-XXX" (always Latin → bidi-safe). */
export function formatTransferCode(code: string): string {
  return `${code.slice(0, 3)}-${code.slice(3, 6)}-${code.slice(6)}`;
}

// ---- payload shape (what travels inside the sealed envelope) ----

export type TransferAddon = {
  transportUrl: string;
  enabled: boolean;
  order: number;
  /** Manifest snapshot — extra fields are preserved verbatim. */
  manifest: { id: string; name: string } & Record<string, unknown>;
};

export type TransferPayload = {
  v: 1;
  addons: TransferAddon[];
  senderHint?: string;
};

const urlIsh = (v: string) => /^[a-z][a-z0-9+.-]*:/i.test(v) && !/[\s\u0000-\u001f]/.test(v);

export const TransferAddonSchema = z.object({
  // "url-ish": any scheme (https:, magnet:, …) + no whitespace/control chars —
  // Stremio transportUrls are usually https but never worth over-restricting.
  transportUrl: z
    .string()
    .min(8)
    .max(2048)
    .refine(urlIsh, { message: "not a URL" }),
  enabled: z.boolean().default(true),
  order: z.number().int().min(0).max(100_000),
  manifest: z
    .looseObject({
      id: z.string().trim().min(1).max(200),
      name: z.string().trim().min(1).max(300),
    })
    .transform((m) => m as TransferAddon["manifest"]),
});

export const TransferPayloadSchema = z.object({
  v: z.literal(1),
  addons: z.array(TransferAddonSchema).min(1).max(60),
  senderHint: z.string().trim().min(1).max(120).optional(),
});

export function transferAad(code: string): string {
  return `transfer:${code}`;
}

/** Seal the payload into the versioned AES-256-GCM envelope, AAD-bound to the code.
 * Argument order mirrors sealPairingPayload(code, payload). */
export function sealTransferPayload(code: string, payload: TransferPayload): string {
  return encryptSecret(JSON.stringify(payload), transferAad(code));
}

/** Open a sealed payload; returns null on ANY failure (wrong AAD, tampered,
 * malformed shape) — callers must treat that as "code unusable". */
export function openTransferPayload(code: string, sealed: string): TransferPayload | null {
  const raw = decryptSecret(sealed, transferAad(code));
  if (!raw) return null;
  try {
    const parsed = TransferPayloadSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    for (const a of parsed.data.addons) {
      if (!a.manifest.id || !a.manifest.name) return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}
