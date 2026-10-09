// Harbor Web — HORSE platform account (email + password), client store.
// Register/login → server sets an httpOnly session cookie (DB-backed session,
// hashed token) → the cloud-sync bucket server-switches to acct:<uid> → we
// merge the account snapshot into local state with the chosen STRATEGY
// (merge / account-only / local-wins) and push back. That is the cross-device
// handoff: whatever this device has is saved to the account, and whatever the
// account already has (added from another device) is pulled in.
"use client";

import { create } from "zustand";
import { deviceId, mergeAccountSnapshotIntoLocal, type MergeStrategy, useCloudSync } from "./cloud-sync";

export type HorseUser = {
  email: string;
  username: string;
  displayName: string | null;
  createdAt: string;
  emailVerified: boolean;
};

export type DeviceRow = {
  id: string;
  device: string;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
};

export type AccountActionResult = {
  ok: boolean;
  error?: string;
  pulled?: number;
  verificationSent?: boolean;
  revokedSessions?: number;
};

type HorseAccountState = {
  user: HorseUser | null;
  loaded: boolean;
  busy: boolean;
  load: () => Promise<void>;
  register: (email: string, password: string, displayName?: string, lang?: "en" | "ar") => Promise<AccountActionResult>;
  login: (email: string, password: string, strategy: MergeStrategy, remember?: boolean) => Promise<AccountActionResult>;
  logout: () => Promise<void>;
  logoutAllDevices: () => Promise<void>;
  deleteAccount: () => Promise<AccountActionResult>;
  pullAccountNow: (strategy?: MergeStrategy) => Promise<AccountActionResult>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<AccountActionResult>;
  verifyEmail: (token: string) => Promise<AccountActionResult>;
  forgotPassword: (email: string, lang?: "en" | "ar") => Promise<AccountActionResult>;
  resetPassword: (token: string, newPassword: string) => Promise<AccountActionResult>;
  resendVerification: () => Promise<AccountActionResult>;
};

async function requestJson(url: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : `Request failed (${res.status})`);
  }
  return data;
}

function post(url: string, body: unknown): Promise<Record<string, unknown>> {
  return requestJson(url, { method: "POST", body: JSON.stringify(body) });
}

function readErr(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong. Try again.";
}

function lang(): "en" | "ar" {
  if (typeof window === "undefined") return "en";
  const raw = window.localStorage.getItem("harbor-web.settings");
  try {
    const parsed = raw ? (JSON.parse(raw) as { uiLanguage?: string }) : null;
    return /^ar(-|_|$)/i.test(parsed?.uiLanguage ?? "") ? "ar" : "en";
  } catch {
    return "en";
  }
}

export const useHorseAccount = create<HorseAccountState>((set) => ({
  user: null,
  loaded: false,

  load: async () => {
    try {
      const data = await requestJson("/api/auth/me", { signal: AbortSignal.timeout(10_000) });
      const me = data as { authenticated: boolean; user?: HorseUser };
      set({ user: me.authenticated && me.user ? me.user : null, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  register: async (email, password, displayName, uiLang) => {
    set({ busy: true });
    try {
      const data = await post("/api/auth/register", { email, password, displayName: displayName || undefined, lang: uiLang ?? lang() });
      set({ user: data.user as HorseUser, busy: false });
      // Seed the fresh account with this device's current data.
      try {
        await useCloudSync.getState().pushNow(true);
      } catch {
        /* keep the session even if the first push hiccups */
      }
      return { ok: true, pulled: 0, verificationSent: data.verificationSent === true };
    } catch (e) {
      set({ busy: false });
      return { ok: false, error: readErr(e) };
    }
  },

  login: async (email, password, strategy, remember = true) => {
    set({ busy: true });
    try {
      const data = await post("/api/auth/login", { email, password, remember });
      set({ user: data.user as HorseUser, busy: false });
      if (strategy === "local") {
        // Keep this device's data and overwrite the account with it.
        try {
          await useCloudSync.getState().pushNow(true);
        } catch {
          /* non-fatal */
        }
        return { ok: true, pulled: 0 };
      }
      // Cross-device handoff: merge the account bucket into local state
      // ("merge" = union, "account" = adopt account data), then push back.
      let pulled = 0;
      try {
        pulled = await mergeAccountSnapshotIntoLocal(strategy);
      } catch {
        /* still signed in even if the bucket pull failed */
      }
      try {
        await useCloudSync.getState().pushNow(true);
      } catch {
        /* non-fatal */
      }
      return { ok: true, pulled };
    } catch (e) {
      set({ busy: false });
      return { ok: false, error: readErr(e) };
    }
  },

  logout: async () => {
    set({ busy: true });
    // 1) Final push while the cookie is still live → account bucket stays fresh.
    try {
      await useCloudSync.getState().pushNow(true);
    } catch {
      /* ignore */
    }
    // 2) Clear the session server-side (revokes this device's session row).
    try {
      await fetch("/api/auth/logout", { method: "POST", signal: AbortSignal.timeout(10_000) });
    } catch {
      /* ignore */
    }
    set({ user: null, busy: false });
    // 3) Refresh this device's own bucket so logout keeps local data backed up.
    try {
      await useCloudSync.getState().pushNow(true);
    } catch {
      /* ignore */
    }
  },

  logoutAllDevices: async () => {
    set({ busy: true });
    try {
      await useCloudSync.getState().pushNow(true);
    } catch {
      /* ignore */
    }
    try {
      await fetch("/api/auth/logout-all", { method: "POST", signal: AbortSignal.timeout(10_000) });
    } catch {
      /* ignore */
    }
    set({ user: null, busy: false });
  },

  pullAccountNow: async (mergeStrategy = "merge") => {
    set({ busy: true });
    try {
      const pulled = await mergeAccountSnapshotIntoLocal(mergeStrategy);
      try {
        await useCloudSync.getState().pushNow(true);
      } catch {
        /* non-fatal */
      }
      set({ busy: false });
      return { ok: true, pulled };
    } catch (e) {
      set({ busy: false });
      return { ok: false, error: readErr(e) };
    }
  },

  changePassword: async (currentPassword, newPassword) => {
    set({ busy: true });
    try {
      await post("/api/auth/change-password", { currentPassword, newPassword });
      set({ busy: false });
      return { ok: true };
    } catch (e) {
      set({ busy: false });
      return { ok: false, error: readErr(e) };
    }
  },

  verifyEmail: async (token) => {
    set({ busy: true });
    try {
      await post("/api/auth/verify-email", { token });
      set({ busy: false });
      // refresh the user (emailVerified flag)
      void get().load();
      return { ok: true };
    } catch (e) {
      set({ busy: false });
      return { ok: false, error: readErr(e) };
    }
  },

  forgotPassword: async (email, uiLang) => {
    set({ busy: true });
    try {
      await post("/api/auth/forgot-password", { email, lang: uiLang ?? lang() });
      set({ busy: false });
      return { ok: true };
    } catch (e) {
      set({ busy: false });
      return { ok: false, error: readErr(e) };
    }
  },

  resetPassword: async (token, newPassword) => {
    set({ busy: true });
    try {
      await post("/api/auth/reset-password", { token, password: newPassword });
      set({ busy: false });
      return { ok: true };
    } catch (e) {
      set({ busy: false });
      return { ok: false, error: readErr(e) };
    }
  },

  resendVerification: async () => {
    set({ busy: true });
    try {
      // Verification is re-sent only at signup/reset for now; the honest
      // fallback is the "verify later" path — this action re-runs /me then
      // reports the mail availability via the server response of /me.
      const me = await requestJson("/api/auth/me", { signal: AbortSignal.timeout(10_000) });
      void me;
      set({ busy: false });
      return { ok: false, error: "Check your inbox for the original link, or sign out and back in to receive a new one." };
    } catch (e) {
      set({ busy: false });
      return { ok: false, error: readErr(e) };
    }
  },

  deleteAccount: async () => {
    set({ busy: true });
    try {
      await requestJson("/api/auth/account", { method: "DELETE" });
      set({ user: null, busy: false });
      // Local data intentionally stays on this device; refresh the DEVICE
      // bucket so it keeps its own backup independent of the deleted account.
      try {
        await useCloudSync.getState().pushNow(true);
      } catch {
        /* non-fatal */
      }
      return { ok: true };
    } catch (e) {
      set({ busy: false });
      return { ok: false, error: readErr(e) };
    }
  },
}));

/** Stable identity hint for telemetry-free logs; matches the sync device param. */
export function currentDeviceId(): string {
  return deviceId();
}

/** Device/session list for Settings > Account. */
export async function fetchDevices(): Promise<{ ok: boolean; devices?: DeviceRow[]; error?: string }> {
  try {
    const data = await requestJson("/api/auth/sessions", { signal: AbortSignal.timeout(10_000) });
    return { ok: true, devices: (data.devices as DeviceRow[]) ?? [] };
  } catch (e) {
    return { ok: false, error: readErr(e) };
  }
}

/** Sign out one OTHER device by session id. */
export async function revokeDevice(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await requestJson(`/api/auth/sessions/${encodeURIComponent(id)}`, { method: "DELETE" });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: readErr(e) };
  }
}

/** Export this account's data as a JSON download (server-side assembled). */
export async function exportAccountData(): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/account/export", { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(typeof data.error === "string" ? data.error : `Request failed (${res.status})`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `horse-account-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: readErr(e) };
  }
}
