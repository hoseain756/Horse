// Harbor Web — Stremio account session + cloud sync (client)
// Login flows through /api/stremio/login (server-side to avoid CORS).
// Sync: addon collection merge + cloud library → watchlist/continue-watching merge.
"use client";

import { create } from "zustand";
import type { Addon, CloudLibraryItem, StremioAuth, StremioUser } from "./types";
import { parseAddonUrl } from "./types";
import { useAddons } from "./store";
import { getWatchlist, toggleWatchlist, upsertCw } from "./cw";

const AUTH_KEY = "harbor-web.auth";

type AuthState = {
  auth: StremioAuth | null;
  loaded: boolean;
  syncing: boolean;
  lastSyncAt: number | null;
  load: () => void;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  syncAll: () => Promise<{ addonsMerged: number; libraryPulled: number } | { error: string }>;
};

function readAuth(): StremioAuth | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StremioAuth;
    if (!parsed.authKey || !parsed.user?._id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export const useAuth = create<AuthState>((set, get) => ({
  auth: null,
  loaded: false,
  syncing: false,
  lastSyncAt: null,
  load: () => {
    const auth = readAuth();
    set({ auth, loaded: true, lastSyncAt: auth ? Date.now() : null });
  },
  login: async (email, password) => {
    try {
      const res = await fetch("/api/stremio/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as { authKey?: string; user?: StremioUser; error?: string };
      if (!res.ok || !data.authKey) {
        return { ok: false, error: data.error ?? "Login failed" };
      }
      const auth: StremioAuth = { authKey: data.authKey, user: data.user ?? { _id: "unknown" } };
      try {
        window.localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
      } catch {
        /* ignore */
      }
      set({ auth });
      return { ok: true };
    } catch {
      return { ok: false, error: "Network error — try again" };
    }
  },
  logout: () => {
    if (typeof window !== "undefined") window.localStorage.removeItem(AUTH_KEY);
    set({ auth: null });
  },
  syncAll: async () => {
    const auth = get().auth;
    if (!auth) return { error: "not signed in" };
    set({ syncing: true });
    let addonsMerged = 0;
    let libraryPulled = 0;
    try {
      // ---- Addon collection merge ----
      const addonsRes = await fetch("/api/stremio/addons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authKey: auth.authKey, action: "get" }),
      });
      const addonsData = (await addonsRes.json()) as { addons?: Addon[] };
      if (Array.isArray(addonsData.addons)) {
        const store = useAddons.getState();
        const existingUrls = new Set(store.addons.map((a) => a.transportUrl));
        for (const cloud of addonsData.addons) {
          if (!cloud.transportUrl || !cloud.manifest?.id) continue;
          const url = parseAddonUrl(cloud.transportUrl);
          if (!existingUrls.has(url)) {
            store.install(url, cloud.manifest);
            addonsMerged++;
          }
        }
      }

      // ---- Cloud library → watchlist + continue watching ----
      const libRes = await fetch("/api/stremio/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authKey: auth.authKey, action: "get" }),
      });
      const libData = (await libRes.json()) as { result?: CloudLibraryItem[] | { libraryItem?: CloudLibraryItem[] } };
      const items = Array.isArray(libData.result)
        ? libData.result
        : Array.isArray((libData.result as { libraryItem?: CloudLibraryItem[] })?.libraryItem)
          ? (libData.result as { libraryItem: CloudLibraryItem[] }).libraryItem
          : [];
      for (const item of items.slice(0, 500)) {
        if (!item?._id || item.removed) continue;
        if (item.type !== "movie" && item.type !== "series") continue;
        // watchlist merge (bookmarked = not removed, no meaningful progress, not temp)
        const state = item.state ?? {};
        const progress =
          state.timeOffset && state.duration ? state.timeOffset / state.duration : 0;
        const isCw = (state.timeOffset ?? 0) > 30 && progress < 0.92;
        if (!isCw && !item.temp) {
          const wl = getWatchlist();
          if (!wl.some((w) => w.id === item._id)) {
            toggleWatchlist({
              id: item._id,
              type: item.type,
              name: item.name,
              poster: item.poster,
              releaseInfo: undefined,
              imdbRating: undefined,
            });
            libraryPulled++;
          }
        }
        // continue watching merge
        if (isCw) {
          const videoId = state.video_id;
          let season: number | undefined;
          let episode: number | undefined;
          if (videoId && item.type === "series") {
            const parts = videoId.split(":");
            season = parseInt(parts[parts.length - 2], 10) || undefined;
            episode = parseInt(parts[parts.length - 1], 10) || undefined;
          }
          upsertCw({
            id: item._id,
            type: item.type,
            name: item.name,
            poster: item.poster,
            background: item.background,
            season,
            episode,
            videoId,
            positionMs: Math.round((state.timeOffset ?? 0) * 1000),
            durationMs: Math.round((state.duration ?? 0) * 1000),
            t: state.lastWatched ?? Date.now(),
          });
          libraryPulled++;
        }
      }
      set({ lastSyncAt: Date.now() });
      return { addonsMerged, libraryPulled };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "sync failed" };
    } finally {
      set({ syncing: false });
    }
  },
}));
