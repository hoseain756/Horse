// Harbor Web — Trakt.tv integration (client store, BYO credentials)
// Flow: user pastes their own Trakt app client id + secret → OAuth device-code
// flow (user visits trakt.tv/activate) → tokens stored locally only.
// Import: Trakt watchlist (movies + shows) merges into the local watchlist.
"use client";

import { create } from "zustand";
import { mergeWatchlist, mergeHistory, getWatchlist, type WatchlistEntry } from "./cw";

const TRAKT_KEY = "harbor-web.trakt";

export type TraktAuth = {
  clientId: string;
  clientSecret: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
  username: string | null;
  /** Optional so older persisted objects stay readable; defaults to true. */
  scrobbleEnabled?: boolean;
  /** Optional so older persisted objects stay readable; defaults to false. */
  pushEnabled?: boolean;
};

export type TraktDevice = {
  deviceCode: string;
  userCode: string;
  verificationUrl: string;
  expiresAt: number;
  intervalSec: number;
};

/** Normalized history item returned by /api/trakt/history. */
export type TraktHistoryItem = {
  id: string;
  type: "movie" | "series";
  name: string;
  videoId?: string; // "<showImdb>:<s>:<e>" for episodes
  season?: number;
  episode?: number;
  episodeName?: string;
  watchedAt: number; // epoch ms
};

export type ScrobblePayload = {
  progress: number; // 0-100
  type: "movie" | "episode";
  imdbId: string;
  season?: number;
  episode?: number;
};

export type PushResult = { pushed: number; notFound: number };

export type PushItem = { id: string; type: "movie" | "series" };

// Credentials captured from the connect form live here until the device flow
// completes — auth is only persisted AFTER authorization, so pollOnce must
// not depend on it for the client id (first-time flow otherwise 400s).
let pendingCreds: { clientId: string; clientSecret: string } | null = null;

const PUSHED_KEY = "harbor-web.trakt.pushed";
const IMDB_ID_RE = /^tt\d+$/;

function readPushedIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const arr = JSON.parse(window.localStorage.getItem(PUSHED_KEY) ?? "[]") as unknown;
    return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

function writePushedIds(ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    // Cap the mirror so localStorage can't grow unbounded
    const arr = Array.from(ids).slice(-2000);
    window.localStorage.setItem(PUSHED_KEY, JSON.stringify(arr));
  } catch {
    /* ignore */
  }
}

type TraktState = {
  auth: TraktAuth | null;
  loaded: boolean;
  phase: "idle" | "connecting" | "authorized";
  device: TraktDevice | null;
  error: string | null;
  importing: boolean;
  importingHistory: boolean;
  scrobbleEnabled: boolean;
  pushing: boolean;
  pushEnabled: boolean;
  load: () => void;
  connect: (clientId: string, clientSecret?: string) => Promise<boolean>;
  pollOnce: () => Promise<"pending" | "authorized" | "failed">;
  cancelConnect: () => void;
  disconnect: () => void;
  importWatchlist: () => Promise<number>;
  importHistory: () => Promise<number>;
  setScrobbleEnabled: (v: boolean) => void;
  scrobble: (action: "start" | "pause" | "stop", payload: ScrobblePayload) => Promise<void>;
  pushIds: (items: PushItem[]) => Promise<PushResult | null>;
  pushWatchlist: () => Promise<PushResult | "empty" | null>;
  setPushEnabled: (v: boolean) => void;
};

function readAuth(): TraktAuth | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(TRAKT_KEY);
    if (!raw) return null;
    const a = JSON.parse(raw) as TraktAuth;
    if (!a || typeof a.accessToken !== "string" || a.accessToken.length < 16) return null;
    // Backwards-compat: older stored objects have no scrobbleEnabled field.
    a.scrobbleEnabled = a.scrobbleEnabled !== false;
    a.pushEnabled = a.pushEnabled === true;
    return a;
  } catch {
    return null;
  }
}

function writeAuth(auth: TraktAuth | null) {
  if (typeof window === "undefined") return;
  try {
    if (auth) window.localStorage.setItem(TRAKT_KEY, JSON.stringify(auth));
    else window.localStorage.removeItem(TRAKT_KEY);
  } catch {
    /* ignore */
  }
}

export const useTrakt = create<TraktState>((set, get) => ({
  auth: null,
  loaded: false,
  phase: "idle",
  device: null,
  error: null,
  importing: false,
  importingHistory: false,
  scrobbleEnabled: true,
  pushing: false,
  pushEnabled: false,

  load: () => {
    const auth = readAuth();
    set({
      auth,
      loaded: true,
      phase: auth ? "authorized" : "idle",
      scrobbleEnabled: auth?.scrobbleEnabled !== false,
      pushEnabled: auth?.pushEnabled === true,
    });
  },

  connect: async (clientId, clientSecret) => {
    set({ error: null, phase: "connecting", device: null });
    // PKCE-era Trakt apps have no client secret — empty string is allowed and
    // the server omits the field entirely in that case.
    pendingCreds = { clientId: clientId.trim(), clientSecret: (clientSecret ?? "").trim() };
    try {
      const res = await fetch("/api/trakt/device-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: clientId.trim(), clientSecret: (clientSecret ?? "").trim() }),
        signal: AbortSignal.timeout(20_000),
      });
      const data = (await res.json()) as {
        error?: string;
        device_code?: string;
        user_code?: string;
        verification_url?: string;
        expires_in?: number;
        interval?: number;
      };
      if (!res.ok || !data.device_code || !data.user_code) {
        set({ phase: "idle", error: data.error ?? `Trakt responded ${res.status}` });
        return false;
      }
      set({
        device: {
          deviceCode: data.device_code,
          userCode: data.user_code,
          verificationUrl: data.verification_url || "https://trakt.tv/activate",
          expiresAt: Date.now() + (data.expires_in ?? 600) * 1000,
          intervalSec: Math.max(3, data.interval ?? 5),
        },
      });
      return true;
    } catch (e) {
      set({ phase: "idle", error: e instanceof Error ? e.message : "Could not reach Trakt" });
      return false;
    }
  },

  pollOnce: async () => {
    const { device, auth } = get();
    if (!device) return "failed";
    if (Date.now() > device.expiresAt) {
      pendingCreds = null;
      set({ phase: "idle", device: null, error: "Device code expired — start again." });
      return "failed";
    }
    // First-time flow: auth is not persisted until authorization succeeds,
    // so fall back to the credentials captured by connect().
    const creds = auth?.clientId
      ? { clientId: auth.clientId, clientSecret: auth.clientSecret }
      : pendingCreds;
    if (!creds) {
      pendingCreds = null;
      set({ phase: "idle", device: null, error: "Connection lost — start again." });
      return "failed";
    }
    try {
      const res = await fetch("/api/trakt/device-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: creds.clientId,
          clientSecret: creds.clientSecret,
          deviceCode: device.deviceCode,
        }),
        signal: AbortSignal.timeout(20_000),
      });
      const data = (await res.json()) as {
        error?: string;
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
      };
      if (res.ok && data.access_token) {
        const clientId = creds.clientId;
        const clientSecret = creds.clientSecret;
        const nextAuth: TraktAuth = {
          clientId,
          clientSecret,
          accessToken: data.access_token,
          refreshToken: data.refresh_token ?? "",
          expiresAt: Date.now() + (data.expires_in ?? 90 * 24 * 3600) * 1000,
          username: null,
          scrobbleEnabled: get().scrobbleEnabled,
          pushEnabled: get().pushEnabled,
        };
        // Best-effort profile fetch for a friendly display name
        try {
          const me = await fetch("/api/trakt/me", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clientId, accessToken: nextAuth.accessToken }),
            signal: AbortSignal.timeout(15_000),
          });
          if (me.ok) {
            const profile = (await me.json()) as { username?: string | null };
            nextAuth.username = profile.username ?? null;
          }
        } catch {
          /* username stays null — non-fatal */
        }
        pendingCreds = null;
        writeAuth(nextAuth);
        set({ auth: nextAuth, phase: "authorized", device: null, error: null });
        return "authorized";
      }
      if (res.status === 400 && (data.error === "authorization_pending" || data.error === "slow_down")) {
        return "pending";
      }
      pendingCreds = null;
      set({
        phase: "idle",
        device: null,
        error: data.error ?? `Trakt responded ${res.status}`,
      });
      return "failed";
    } catch (e) {
      pendingCreds = null;
      set({ phase: "idle", device: null, error: e instanceof Error ? e.message : "Token polling failed" });
      return "failed";
    }
  },

  cancelConnect: () => {
    pendingCreds = null;
    set({ phase: "idle", device: null, error: null });
  },

  disconnect: () => {
    writeAuth(null);
    set({ auth: null, phase: "idle", error: null });
  },

  importWatchlist: async () => {
    const { auth } = get();
    if (!auth) return -1;
    set({ importing: true, error: null });
    try {
      const res = await fetch("/api/trakt/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: auth.clientId, accessToken: auth.accessToken }),
        signal: AbortSignal.timeout(25_000),
      });
      const data = (await res.json()) as { items?: WatchlistEntry[]; error?: string };
      if (!res.ok || !Array.isArray(data.items)) {
        set({ importing: false, error: data.error ?? `Trakt responded ${res.status}` });
        return -1;
      }
      const imported = mergeWatchlist(
        data.items.map((it) => ({
          id: it.id,
          type: it.type,
          name: it.name,
          releaseInfo: "year" in it && typeof (it as { year?: string }).year === "string" ? (it as { year?: string }).year : undefined,
        })),
      );
      set({ importing: false });
      return imported;
    } catch (e) {
      set({ importing: false, error: e instanceof Error ? e.message : "Import failed" });
      return -1;
    }
  },

  importHistory: async () => {
    const { auth } = get();
    if (!auth) return -1;
    set({ importingHistory: true, error: null });
    try {
      const res = await fetch("/api/trakt/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: auth.clientId, accessToken: auth.accessToken }),
        signal: AbortSignal.timeout(25_000),
      });
      const data = (await res.json()) as { items?: TraktHistoryItem[]; error?: string };
      if (!res.ok || !Array.isArray(data.items)) {
        set({ importingHistory: false, error: data.error ?? `Trakt responded ${res.status}` });
        return -1;
      }
      const added = mergeHistory(
        data.items.map((it) => ({
          id: it.id,
          type: it.type,
          name: it.name,
          videoId: it.videoId,
          season: it.season,
          episode: it.episode,
          episodeName: it.episodeName,
          positionMs: 0,
          durationMs: 0,
          t: it.watchedAt,
        })),
      );
      set({ importingHistory: false });
      return added;
    } catch (e) {
      set({
        importingHistory: false,
        error: e instanceof Error ? e.message : "History import failed",
      });
      return -1;
    }
  },

  setScrobbleEnabled: (v) => {
    const { auth } = get();
    if (auth) {
      const next = { ...auth, scrobbleEnabled: v };
      writeAuth(next);
      set({ auth: next, scrobbleEnabled: v });
    } else {
      set({ scrobbleEnabled: v });
    }
  },

  scrobble: async (action, payload) => {
    const { auth, scrobbleEnabled } = get();
    if (!auth || !scrobbleEnabled) return;
    try {
      // Fire-and-forget: a scrobble failure must never disrupt playback.
      await fetch("/api/trakt/scrobble", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: auth.clientId,
          accessToken: auth.accessToken,
          action,
          progress: payload.progress,
          type: payload.type,
          imdbId: payload.imdbId,
          ...(payload.season !== undefined ? { season: payload.season } : {}),
          ...(payload.episode !== undefined ? { episode: payload.episode } : {}),
        }),
        signal: AbortSignal.timeout(8_000),
      });
    } catch {
      /* swallow silently */
    }
  },

  pushIds: async (items) => {
    const { auth } = get();
    if (!auth || items.length === 0) return null;
    try {
      const res = await fetch("/api/trakt/push-watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: auth.clientId,
          accessToken: auth.accessToken,
          items,
        }),
        signal: AbortSignal.timeout(25_000),
      });
      const data = (await res.json()) as {
        added?: { movies?: number; shows?: number };
        notFound?: number;
        error?: string;
      };
      if (!res.ok) {
        set({ error: data.error ?? `Trakt responded ${res.status}` });
        return null;
      }
      const pushed = (data.added?.movies ?? 0) + (data.added?.shows ?? 0);
      return { pushed, notFound: data.notFound ?? 0 };
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Push failed" });
      return null;
    }
  },

  pushWatchlist: async () => {
    const { auth } = get();
    if (!auth) return null;
    const entries = getWatchlist().filter((w) => IMDB_ID_RE.test(w.id));
    if (entries.length === 0) return "empty";
    set({ pushing: true, error: null });
    const res = await get().pushIds(
      entries.map((e) => ({ id: e.id, type: e.type === "movie" ? ("movie" as const) : ("series" as const) })),
    );
    set({ pushing: false });
    if (res) {
      // Remember everything we pushed so auto-sync only sends future additions
      const pushed = readPushedIds();
      for (const e of entries) pushed.add(e.id);
      writePushedIds(pushed);
    }
    return res;
  },

  setPushEnabled: (v) => {
    const { auth } = get();
    if (auth) {
      const next = { ...auth, pushEnabled: v };
      writeAuth(next);
      set({ auth: next, pushEnabled: v });
    } else {
      set({ pushEnabled: v });
    }
    if (v) {
      // Seed the pushed-mirror with the current watchlist so enabling sync
      // never mass-pushes old items — only future additions flow to Trakt.
      const pushed = readPushedIds();
      for (const e of getWatchlist()) {
        if (IMDB_ID_RE.test(e.id)) pushed.add(e.id);
      }
      writePushedIds(pushed);
    }
  },
}));

// ---------- Auto-sync (push additions to Trakt) ----------
// Listens for local watchlist mutations and pushes only the ids that were
// never pushed before. Debounced, import-aware, and fully silent on failure
// (the error surfaces in Settings on the next manual push).
let pushListenerInstalled = false;

export function installTraktPushSync(): () => void {
  if (pushListenerInstalled || typeof window === "undefined") return () => {};
  pushListenerInstalled = true;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const schedule = () => {
    const s = useTrakt.getState();
    if (!s.auth?.accessToken || !s.auth.pushEnabled) return;
    // Skip while an import is merging items — those came FROM Trakt.
    if (s.importing || s.importingHistory) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      void (async () => {
        const st = useTrakt.getState();
        if (!st.auth?.accessToken || !st.auth.pushEnabled) return;
        if (st.importing || st.importingHistory) return;
        const pushed = readPushedIds();
        const additions = getWatchlist().filter((w) => IMDB_ID_RE.test(w.id) && !pushed.has(w.id));
        if (additions.length === 0) return;
        const res = await st.pushIds(
          additions.map((a) => ({ id: a.id, type: a.type === "movie" ? ("movie" as const) : ("series" as const) })),
        );
        if (res) {
          for (const a of additions) pushed.add(a.id);
          writePushedIds(pushed);
        }
      })();
    }, 6000);
  };

  window.addEventListener("harbor:data-changed", schedule);
  return () => {
    window.removeEventListener("harbor:data-changed", schedule);
    if (timer) clearTimeout(timer);
    pushListenerInstalled = false;
  };
}
