// Harbor Web — cloud sync client (Prisma/SQLite backend at /api/sync)
// Model: the device in active use is the source of truth. On boot, the server
// snapshot fills keys this browser is missing (fresh browser / new device).
// Every subsequent local mutation is debounced-pushed to the server.
"use client";

import { create } from "zustand";
import { useAddons, useSettings, type AddonRecord } from "./store";
import { loadSettings, saveSettings, type Settings } from "./settings";
import { useAuth } from "./auth";

const DEVICE_KEY = "harbor-web.device-id";
const LAST_SYNC_KEY = "harbor-web.last-cloud-sync";
const DEBOUNCE_MS = 2_500;

// localStorage keys that participate in sync (harbor-web.auth is intentionally excluded)
const SYNCED_ADDONS = "harbor-web.installed-addons";
const SYNCED_CW = "harbor-web.localcw.v1";
const SYNCED_WATCHLIST = "harbor-web.watchlist.v1";
const SYNCED_HISTORY = "harbor-web.history.v1";
const SYNCED_USER_THEMES = "harbor-web.user-themes";
const SYNCED_LISTS = "harbor-web.lists.v1";

type SyncStatus = "off" | "idle" | "syncing" | "synced" | "error";

type CloudSyncState = {
  status: SyncStatus;
  lastSync: number | null;
  error: string | null;
  boot: () => Promise<void>;
  pull: () => Promise<boolean>;
  pushNow: (force?: boolean) => Promise<void>;
  schedulePush: () => void;
};

export const useCloudSync = create<CloudSyncState>((set, get) => ({
  status: "idle",
  lastSync: null,
  error: null,

  boot: async () => {
    const settings = useSettings.getState().settings;
    if (settings.cloudSyncEnabled === false) {
      set({ status: "off" });
      return;
    }
    const adopted = await get().pull();
    if (!adopted) {
      // First run on the server: register this device's current data
      await get().pushNow();
    }
  },

  pull: async () => {
    const settings = useSettings.getState().settings;
    if (settings.cloudSyncEnabled === false) return false;
    set((s) => ({ status: s.status === "error" ? "error" : "syncing" }));
    try {
      const res = await fetch(`/api/sync?device=${encodeURIComponent(syncKey())}`, {
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`GET /api/sync ${res.status}`);
      const { snapshot } = (await res.json()) as {
        snapshot: {
          settings: unknown | null;
          addons: unknown[] | null;
          cw: Record<string, unknown>;
          watchlist: unknown[];
          history: unknown[];
          userThemes: unknown | null;
          lists: unknown[] | null;
          updatedAt: string;
        } | null;
      };
      if (!snapshot) {
        set({ status: "idle" });
        return false;
      }
      let adopted = false;

      // Addons: adopt server set only when this browser has none
      if (snapshot.addons && snapshot.addons.length > 0) {
        const local = window.localStorage.getItem(SYNCED_ADDONS);
        if (!local || local === "[]") {
          window.localStorage.setItem(SYNCED_ADDONS, JSON.stringify(snapshot.addons));
          useAddons.getState().load();
          adopted = true;
        }
      }

      // Settings: adopt only when absent locally
      if (snapshot.settings && typeof snapshot.settings === "object") {
        const local = window.localStorage.getItem("harbor-web.settings");
        if (!local) {
          const incoming = snapshot.settings as Partial<Settings>;
          // never let the server flip sync back on/off mid-boot or clobber cloudSync pref
          saveSettings({
            ...useSettings.getState().settings,
            ...incoming,
            cloudSyncEnabled: useSettings.getState().settings.cloudSyncEnabled,
          });
          useSettings.getState().load();
          adopted = true;
        }
      }

      // Simple keys: adopt when the local key is missing entirely
      const simpleAdopt: [string, string | null][] = [
        [SYNCED_CW, snapshot.cw && Object.keys(snapshot.cw).length > 0 ? JSON.stringify(snapshot.cw) : null],
        [SYNCED_WATCHLIST, snapshot.watchlist && snapshot.watchlist.length > 0 ? JSON.stringify(snapshot.watchlist) : null],
        [SYNCED_HISTORY, snapshot.history && snapshot.history.length > 0 ? JSON.stringify(snapshot.history) : null],
        [SYNCED_USER_THEMES, snapshot.userThemes ? JSON.stringify(snapshot.userThemes) : null],
        [SYNCED_LISTS, snapshot.lists && snapshot.lists.length > 0 ? JSON.stringify(snapshot.lists) : null],
      ];
      for (const [key, value] of simpleAdopt) {
        if (value && !window.localStorage.getItem(key)) {
          window.localStorage.setItem(key, value);
          adopted = true;
        }
      }

      set({ status: "synced", lastSync: Date.now(), error: null });
      persistLastSync();
      return adopted;
    } catch (e) {
      set({ status: "error", error: e instanceof Error ? e.message : "sync failed" });
      return false;
    }
  },

  pushNow: async (force?: boolean) => {
    const settings = useSettings.getState().settings;
    if (settings.cloudSyncEnabled === false && !force) return;
    set((s) => ({ status: s.status === "error" ? "error" : "syncing" }));
    try {
      const body = {
        device: syncKey(),
        snapshot: {
          v: 1,
          settings: readJson("harbor-web.settings"),
          addons: readJson(SYNCED_ADDONS) ?? [],
          cw: readJson(SYNCED_CW) ?? {},
          watchlist: readJson(SYNCED_WATCHLIST) ?? [],
          history: readJson(SYNCED_HISTORY) ?? [],
          userThemes: readJson(SYNCED_USER_THEMES),
          lists: readJson(SYNCED_LISTS) ?? [],
        },
      };
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`POST /api/sync ${res.status}`);
      set({ status: "synced", lastSync: Date.now(), error: null });
      persistLastSync();
    } catch (e) {
      set({ status: "error", error: e instanceof Error ? e.message : "sync failed" });
    }
  },

  schedulePush: () => {
    const settings = useSettings.getState().settings;
    if (settings.cloudSyncEnabled === false) return;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      pushTimer = null;
      void get().pushNow();
    }, DEBOUNCE_MS);
  },
}));

let pushTimer: ReturnType<typeof setTimeout> | null = null;

/** Stable per-browser device id (no PII, generated locally). */
export function deviceId(): string {
  if (typeof window === "undefined") return "server";
  let id = window.localStorage.getItem(DEVICE_KEY);
  if (!id || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID().replace(/-/g, "")
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
    window.localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

/** FNV-1a 32-bit hash as hex — used to avoid storing the raw Stremio authKey server-side. */
function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/**
 * Sync bucket key. Signed-in users sync under their Stremio account
 * (hashed authKey) so any browser can restore; anonymous users get a
 * per-device bucket.
 */
export function syncKey(): string {
  const auth = useAuth.getState().auth;
  if (auth?.authKey) return `st${fnv1a(auth.authKey)}`;
  return deviceId();
}

/** Short display form for settings UI. */
export function deviceIdShort(): string {
  const auth = useAuth.getState().auth;
  if (auth?.authKey) return `Stremio · ${fnv1a(auth.authKey).slice(0, 4)}`;
  const id = deviceId();
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

export function lastSyncFromStorage(): number | null {
  if (typeof window === "undefined") return null;
  const n = Number(window.localStorage.getItem(LAST_SYNC_KEY));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function persistLastSync() {
  try {
    window.localStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

function readJson(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * HORSE account handoff (called right after login/register).
 * The session cookie makes the server serve the acct:<uid> bucket; we merge
 * it into local state with generous semantics so nothing is lost:
 *   - addons: UNION by transportUrl (local set kept, account-only appended)
 *   - settings / cw / watchlist / history / themes / lists: adopt-when-missing
 * Returns the number of addons pulled from the account.
 */
export async function mergeAccountSnapshotIntoLocal(): Promise<number> {
  const res = await fetch(`/api/sync?device=${encodeURIComponent(syncKey())}`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`GET /api/sync ${res.status}`);
  const { snapshot } = (await res.json()) as {
    snapshot: {
      settings: unknown | null;
      addons: unknown[] | null;
      cw: Record<string, unknown>;
      watchlist: unknown[];
      history: unknown[];
      userThemes: unknown | null;
      lists: unknown[] | null;
      updatedAt: string;
    } | null;
  };
  if (!snapshot) return 0;
  let pulled = 0;

  // Addons: union — keep the local set, append account-only addons.
  if (Array.isArray(snapshot.addons) && snapshot.addons.length > 0) {
    const localArr = (readJson(SYNCED_ADDONS) as AddonRecord[] | null) ?? [];
    const seen = new Set(localArr.map((a) => a.transportUrl));
    const additions: AddonRecord[] = [];
    for (const a of snapshot.addons as Array<Partial<AddonRecord> & { transportUrl?: unknown }>) {
      if (!a || typeof a.transportUrl !== "string" || !a.manifest || typeof a.manifest.id !== "string") continue;
      if (seen.has(a.transportUrl)) continue;
      seen.add(a.transportUrl);
      additions.push({
        manifest: a.manifest,
        transportUrl: a.transportUrl,
        enabled: a.enabled !== false,
        order: localArr.length + additions.length,
        ...(a.probe ? { probe: a.probe } : {}),
      });
    }
    if (additions.length > 0) {
      window.localStorage.setItem(SYNCED_ADDONS, JSON.stringify([...localArr, ...additions]));
      useAddons.getState().load();
      pulled = additions.length;
    }
  }

  // Settings + simple keys: adopt only when absent locally (same as boot).
  if (snapshot.settings && typeof snapshot.settings === "object") {
    if (!window.localStorage.getItem("harbor-web.settings")) {
      const incoming = snapshot.settings as Partial<Settings>;
      saveSettings({
        ...useSettings.getState().settings,
        ...incoming,
        cloudSyncEnabled: useSettings.getState().settings.cloudSyncEnabled,
      });
      useSettings.getState().load();
    }
  }
  const simpleAdopt: [string, string | null][] = [
    [SYNCED_CW, snapshot.cw && Object.keys(snapshot.cw).length > 0 ? JSON.stringify(snapshot.cw) : null],
    [SYNCED_WATCHLIST, snapshot.watchlist && snapshot.watchlist.length > 0 ? JSON.stringify(snapshot.watchlist) : null],
    [SYNCED_HISTORY, snapshot.history && snapshot.history.length > 0 ? JSON.stringify(snapshot.history) : null],
    [SYNCED_USER_THEMES, snapshot.userThemes ? JSON.stringify(snapshot.userThemes) : null],
    [SYNCED_LISTS, snapshot.lists && snapshot.lists.length > 0 ? JSON.stringify(snapshot.lists) : null],
  ];
  for (const [key, value] of simpleAdopt) {
    if (value && !window.localStorage.getItem(key)) {
      window.localStorage.setItem(key, value);
    }
  }
  return pulled;
}

/**
 * Wire global listeners: zustand store mutations + data-change events from cw.ts
 * → debounced push. Call once from AppShell.
 */
export function installCloudSyncListeners(): () => void {
  const schedule = () => useCloudSync.getState().schedulePush();
  const unsubAddons = useAddons.subscribe((state, prev) => {
    if (state.addons !== prev.addons) schedule();
  });
  const unsubSettings = useSettings.subscribe((state, prev) => {
    if (state.settings !== prev.settings) schedule();
  });
  window.addEventListener("harbor:data-changed", schedule);
  const flush = () => {
    if (useCloudSync.getState().status === "syncing") return;
    void useCloudSync.getState().pushNow();
  };
  const onHide = () => {
    if (document.visibilityState === "hidden") flush();
  };
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", onHide);
  return () => {
    unsubAddons();
    unsubSettings();
    window.removeEventListener("harbor:data-changed", schedule);
    window.removeEventListener("pagehide", flush);
    document.removeEventListener("visibilitychange", onHide);
  };
}
