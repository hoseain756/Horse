// Harbor Web — parent PIN (Task 70, audit F1).
// UI-layer parental gate: a salted SHA-256 hash of a 4–8 digit PIN lives in
// localStorage (`harbor-web.parent-pin`). No settings key is added — the PIN
// must NEVER ride the cloud-sync blob. Unlock grants a short session grant
// (sessionStorage) so a parent isn't re-prompted for every pane interaction.
"use client";

const PIN_KEY = "harbor-web.parent-pin";
const GRANT_KEY = "harbor-web.parent-pin-grant";
/** How long an unlock stays valid in the current tab (ms). */
const GRANT_MS = 5 * 60_000;

function randomSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashPin(pin: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function isValidPinShape(pin: string): boolean {
  return /^\d{4,8}$/.test(pin);
}

/** A PIN exists AND is verified-able. */
export function hasParentPin(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(PIN_KEY);
    return typeof raw === "string" && /^[0-9a-f]{32}:[0-9a-f]{64}$/.test(raw);
  } catch {
    return false;
  }
}

export async function setParentPin(pin: string): Promise<void> {
  const salt = randomSalt();
  const hash = await hashPin(pin, salt);
  window.localStorage.setItem(PIN_KEY, `${salt}:${hash}`);
  // A fresh PIN counts as unlocked for this tab.
  window.sessionStorage.setItem(GRANT_KEY, String(Date.now()));
}

export async function clearParentPin(): Promise<void> {
  window.localStorage.removeItem(PIN_KEY);
  window.sessionStorage.removeItem(GRANT_KEY);
}

export async function verifyParentPin(pin: string): Promise<boolean> {
  try {
    const raw = window.localStorage.getItem(PIN_KEY);
    if (!raw) return false;
    const [salt, hash] = raw.split(":");
    if (!salt || !hash) return false;
    const candidate = await hashPin(pin, salt);
    // constant-time-ish compare (both are fixed-length hex)
    let diff = 0;
    for (let i = 0; i < hash.length; i++) diff |= candidate.charCodeAt(i) ^ hash.charCodeAt(i);
    if (diff !== 0) return false;
    window.sessionStorage.setItem(GRANT_KEY, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}

/** True when the current tab holds a fresh unlock grant (or no PIN exists). */
export function isParentUnlocked(): boolean {
  if (typeof window === "undefined") return true;
  try {
    if (!window.localStorage.getItem(PIN_KEY)) return true;
    const grant = Number(window.sessionStorage.getItem(GRANT_KEY) ?? "0");
    return Number.isFinite(grant) && grant > 0 && Date.now() - grant < GRANT_MS;
  } catch {
    return true;
  }
}

/** Revoke the session grant (e.g. when leaving the protected pane). */
export function lockParentAccess(): void {
  try {
    window.sessionStorage.removeItem(GRANT_KEY);
  } catch {
    /* ignore */
  }
}
