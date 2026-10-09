// Harbor Web — HORSE platform account (native username/password), client store.
// Register/login → server sets an httpOnly session cookie → the cloud-sync
// bucket server-switches to acct:<uid> → we merge the account snapshot into
// local state (addons UNION + adopt-when-missing) and push back. That is the
// cross-device handoff: whatever this device has is saved to the account, and
// whatever the account already has (added from another device) is pulled in.
"use client";

import { create } from "zustand";
import { deviceId, mergeAccountSnapshotIntoLocal, useCloudSync } from "./cloud-sync";

export type HorseUser = {
  username: string;
  createdAt: string;
};

export type AccountActionResult = {
  ok: boolean;
  error?: string;
  pulled?: number;
};

type HorseAccountState = {
  user: HorseUser | null;
  loaded: boolean;
  busy: boolean;
  load: () => Promise<void>;
  register: (username: string, password: string) => Promise<AccountActionResult>;
  login: (username: string, password: string) => Promise<AccountActionResult>;
  logout: () => Promise<void>;
  pullAccountNow: () => Promise<AccountActionResult>;
};

async function postJson(url: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : `Request failed (${res.status})`);
  }
  return data;
}

function readErr(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong. Try again.";
}

export const useHorseAccount = create<HorseAccountState>((set) => ({
  user: null,
  loaded: false,
  busy: false,

  load: async () => {
    try {
      const res = await fetch("/api/auth/me", { signal: AbortSignal.timeout(10_000) });
      const data = (await res.json()) as { authenticated: boolean; user?: HorseUser };
      set({ user: data.authenticated && data.user ? data.user : null, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  register: async (username, password) => {
    set({ busy: true });
    try {
      const data = await postJson("/api/auth/register", { username, password });
      set({
        user: data.user as HorseUser,
        busy: false,
      });
      // Seed the fresh account with this device's current data.
      try {
        await useCloudSync.getState().pushNow(true);
      } catch {
        /* keep the session even if the first push hiccups */
      }
      return { ok: true, pulled: 0 };
    } catch (e) {
      set({ busy: false });
      return { ok: false, error: readErr(e) };
    }
  },

  login: async (username, password) => {
    set({ busy: true });
    try {
      const data = await postJson("/api/auth/login", { username, password });
      set({ user: data.user as HorseUser, busy: false });
      // Cross-device handoff: merge the account bucket (addons etc.) into
      // local state, then push the merged result back to the account.
      let pulled = 0;
      try {
        pulled = await mergeAccountSnapshotIntoLocal();
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
    // 2) Clear the session server-side.
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

  pullAccountNow: async () => {
    set({ busy: true });
    try {
      const pulled = await mergeAccountSnapshotIntoLocal();
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
}));

/** Stable identity hint for telemetry-free logs; matches the sync device param. */
export function currentDeviceId(): string {
  return deviceId();
}
