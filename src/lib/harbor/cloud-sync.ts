// Harbor Web — cloud sync client (Prisma/Turso backend at /api/sync)
// Model: local-first. The device in active use is the source of truth; the
// server snapshot fills keys this browser is missing on boot; every local
// mutation is debounced-pushed. v2 additions:
//   - addon TOMBSTONES (removedAddons) so deletions propagate across devices
//     instead of resurrecting on boot-adopt / union merges
//   - freshness cursor (?since=<updatedAt> → {unchanged:true}) for cheap
//     background re-fetches
//   - background re-sync: tab focus, network regain, 90s interval while visible
//   - offline retry with backoff for failed pushes
//   - account login merge STRATEGIES (merge / account-only / local-wins)
"use client";

import { create } from "zustand";
import { useAddons, useSettings, type AddonRecord } from "./store";
import { loadSettings, saveSettings, type Settings } from "./settings";
import { useAuth } from "./auth";
import {
  readTombstones,
  tombstoneIds,
  mergeTombstones,
  gcTombstones,
} from "./tombstones";

const DEVICE_KEY = "harbor-web.device-id";
const LAST_SYNC_KEY = "harbor-web.last-cloud-sync";
const LAST_UPDATED_KEY = "harbor-web.last-server-updated";
const DEBOUNCE_MS = 2_500;
const POLL_INTERVAL_MS = 90_000; // background freshness while the tab is visible
const RETRY_BASE_MS = 15_000;
const RETRY_MAX = 3;
const TOMBSTONE_TTL_MS = 90 * 86_400_000;

// localStorage keys that participate in sync (harbor-web.auth is intentionally excluded)
const SYNCED_ADDONS = "harbor-web.installed-addons";
const SYNCED_CW = "harbor-web.localcw.v1";
const SYNCED_WATCHLIST = "harbor-web.watchlist.v1";
const SYNCED_HISTORY = "harbor-web.history.v1";
const SYNCED_USER_THEMES = "harbor-web.user-themes";
const SYNCED_LISTS = "harbor-web.lists.v1";

type SyncStatus = "off" | "idle" | "syncing" | "synced" | "error";

type SnapshotWire = {
  settings: unknown | null;
  addons: unknown[] | null;
  removedAddons?: { id: string; t: number }[] | null;
  cw: Record<string, unknown>;
  watchlist: unknown[];
  history: unknown[];
  userThemes: unknown | null;
  lists: unknown[] | null;
  updatedAt: string;
};

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
    gcTombstones();
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
      const since = window.localStorage.getItem(LAST_UPDATED_KEY) ?? "";
      const res = await fetch(
        `/api/sync?device=${encodeURIComponent(syncKey())}${since ? `&since=${encodeURIComponent(since)}` : ""}`,
        { signal: AbortSignal.timeout(15_000) },
      );
      if (!res.ok) throw new Error(`GET /api/sync ${res.status}`);
      const payload = (await res.json()) as { snapshot?: SnapshotWire | null; unchanged?: boolean; updatedAt?: string };
      if (payload.unchanged) {
        // Server version matches what we already adopted — nothing to do.
        if (payload.updatedAt) window.localStorage.setItem(LAST_UPDATED_KEY, payload.updatedAt);
        set({ status: "synced", error: null });
        return true; // treat as "server has our data" so boot doesn't force a push
      }
      const snapshot = payload.snapshot;
      if (!snapshot) {
        set({ status: "idle" });
        return false;
      }
      if (snapshot.updatedAt) window.localStorage.setItem(LAST_UPDATED_KEY, snapshot.updatedAt);
      let adopted = false;

      // Addons: adopt server set only when this browser has none — and even
      // then strip tombstoned addons (removed on ANY device) so deletions hold.
      if (snapshot.addons && snapshot.addons.length > 0) {
        const local = window.localStorage.getItem(SYNCED_ADDONS);
        if (!local || local === "[]") {
          const tomb = tombstoneIds();
          const kept = (snapshot.addons as AddonRecord[]).filter(
            (a) => !(a?.manifest && typeof a.manifest.id === "string" && tomb.has(a.manifest.id)),
          );
          window.localStorage.setItem(SYNCED_ADDONS, JSON.stringify(kept));
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

      // Merge server tombstones into the local list (union).
      if (Array.isArray(snapshot.removedAddons) && snapshot.removedAddons.length > 0) {
        mergeTombstones(snapshot.removedAddons);
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
          removedAddons: readTombstones(),
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
      const json = (await res.json()) as { ok?: boolean; updatedAt?: string };
      if (json.updatedAt) window.localStorage.setItem(LAST_UPDATED_KEY, json.updatedAt);
      retryCount = 0;
      set({ status: "synced", lastSync: Date.now(), error: null });
      persistLastSync();
    } catch (e) {
      set({ status: "error", error: e instanceof Error ? e.message : "sync failed" });
      scheduleRetry();
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
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryCount = 0;
let pollTimer: ReturnType<typeof setInterval> | null = null;

/** Offline retry with capped exponential backoff. */
function scheduleRetry(): void {
  if (retryCount >= RETRY_MAX) return;
  retryCount += 1;
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void useCloudSync.getState().pushNow();
  }, RETRY_BASE_MS * 2 ** (retryCount - 1));
}

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
 * Sync bucket key. Signed-in Stremio users sync under their account
 * (hashed authKey); anonymous users get a per-device bucket. When a HORSE
 * session cookie is present the SERVER overrides the bucket to acct:<uid>.
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

export type MergeStrategy = "merge" | "account" | "local";

/**
 * HORSE account handoff (called after login). The session cookie makes the
 * server serve the acct:<uid> bucket. Strategy (spec's one-time dialog):
 *   - "merge"  (default): addons UNION (minus tombstones), adopt-when-missing
 *              for settings/cw/watchlist/history/themes/lists
 *   - "account": this device adopts the account data wholesale
 *   - "local":  keep this device's data; the caller pushes it over the account
 * Returns the number of addons pulled from the account.
 */
export async function mergeAccountSnapshotIntoLocal(strategy: MergeStrategy = "merge"): Promise<number> {
  const res = await fetch(`/api/sync?device=${encodeURIComponent(syncKey())}`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`GET /api/sync ${res.status}`);
  const { snapshot } = (await res.json()) as { snapshot: SnapshotWire | null };
  if (!snapshot) return 0;
  if (snapshot.updatedAt) window.localStorage.setItem(LAST_UPDATED_KEY, snapshot.updatedAt);
  const tombLocal = tombstoneIds();
  const tombServer = new Set((snapshot.removedAddons ?? []).map((t) => t.id));

  if (strategy === "account") {
    // Adopt the account data wholesale (minus tombstones), then remember
    // the account's tombstones.
    if (Array.isArray(snapshot.addons)) {
      const kept = (snapshot.addons as AddonRecord[]).filter(
        (a) => !(a?.manifest && typeof a.manifest.id === "string" && (tombLocal.has(a.manifest.id) || tombServer.has(a.manifest.id))),
      );
      window.localStorage.setItem(SYNCED_ADDONS, JSON.stringify(kept));
      useAddons.getState().load();
    }
    if (snapshot.settings && typeof snapshot.settings === "object") {
      const incoming = snapshot.settings as Partial<Settings>;
      saveSettings({ ...useSettings.getState().settings, ...incoming, cloudSyncEnabled: useSettings.getState().settings.cloudSyncEnabled });
      useSettings.getState().load();
    }
    const adopt: [string, string | null][] = [
      [SYNCED_CW, JSON.stringify(snapshot.cw ?? {})],
      [SYNCED_WATCHLIST, JSON.stringify(snapshot.watchlist ?? [])],
      [SYNCED_HISTORY, JSON.stringify(snapshot.history ?? [])],
      [SYNCED_USER_THEMES, snapshot.userThemes ? JSON.stringify(snapshot.userThemes) : null],
      [SYNCED_LISTS, JSON.stringify(snapshot.lists ?? [])],
    ];
    for (const [key, value] of adopt) {
      if (value) window.localStorage.setItem(key, value);
    }
    mergeTombstones(snapshot.removedAddons ?? []);
    return Array.isArray(snapshot.addons) ? snapshot.addons.length : 0;
  }

  if (strategy === "local") {
    // Keep this device's data as-is; the caller pushes it over the account.
    return 0;
  }

  // ---- strategy: merge (default) ----
  let pulled = 0;

  // Addons: union by transportUrl — keep the local set, append account-only
  // addons; drop anything tombstoned locally or on another device.
  if (Array.isArray(snapshot.addons) && snapshot.addons.length > 0) {
    const localArr = (readJson(SYNCED_ADDONS) as AddonRecord[] | null) ?? [];
    const localAfterRemoval = localArr.filter(
      (a) => !(a?.manifest && typeof a.manifest.id === "string" && tombServer.has(a.manifest.id)),
    );
    const seen = new Set(localAfterRemoval.map((a) => a.transportUrl));
    const additions: AddonRecord[] = [];
    for (const a of snapshot.addons as Array<Partial<AddonRecord> & { transportUrl?: unknown }>) {
      if (!a || typeof a.transportUrl !== "string" || !a.manifest || typeof a.manifest.id !== "string") continue;
      if (tombLocal.has(a.manifest.id) || tombServer.has(a.manifest.id)) continue;
      if (seen.has(a.transportUrl)) continue;
      seen.add(a.transportUrl);
      additions.push({
        manifest: a.manifest,
        transportUrl: a.transportUrl,
        enabled: a.enabled !== false,
        order: localAfterRemoval.length + additions.length,
        ...(a.probe ? { probe: a.probe } : {}),
      });
    }
    if (additions.length > 0 || localAfterRemoval.length !== localArr.length) {
      window.localStorage.setItem(SYNCED_ADDONS, JSON.stringify([...localAfterRemoval, ...additions]));
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
  // Union tombstones so the removals seen elsewhere survive our next push.
  mergeTombstones(snapshot.removedAddons ?? []);
  return pulled;
}

/**
 * Wire global listeners: zustand store mutations + data-change events from
 * cw.ts → debounced push; tab focus / network regain / 90s visible interval →
 * silent background re-pull with the freshness cursor. Call once from AppShell.
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
  const onVisible = () => {
    if (document.visibilityState === "visible" && useSettings.getState().settings.cloudSyncEnabled !== false) {
      void useCloudSync.getState().pull();
    }
  };
  const onOnline = () => {
    retryCount = 0;
    void useCloudSync.getState().pull().then(() => useCloudSync.getState().pushNow());
  };
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", onHide);
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("focus", onVisible);
  window.addEventListener("online", onOnline);
  if (!pollTimer) {
    pollTimer = setInterval(() => {
      if (document.visibilityState === "visible" && useSettings.getState().settings.cloudSyncEnabled !== false) {
        void useCloudSync.getState().pull();
      }
    }, POLL_INTERVAL_MS);
  }
  return () => {
    unsubAddons();
    unsubSettings();
    window.removeEventListener("harbor:data-changed", schedule);
    window.removeEventListener("pagehide", flush);
    document.removeEventListener("visibilitychange", onHide);
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("focus", onVisible);
    window.removeEventListener("online", onOnline);
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  };
}
