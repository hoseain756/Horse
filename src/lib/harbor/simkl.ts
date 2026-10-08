// Harbor Web — Simkl integration (client store, BYO credentials)
// Flow: user pastes their own Simkl app client id (+ optional secret) →
// PIN-based OAuth flow (user visits simkl.com/pin) → token stored locally
// only. Import: Simkl watchlist (movies + shows) and watch history merge
// into the local library. Metadata/tracking only — no content.
"use client";

import { create } from "zustand";
import { mergeWatchlist, mergeHistory, type WatchlistEntry } from "./cw";

const SIMKL_KEY = "harbor-web.simkl";

export type SimklAuth = {
  clientId: string;
  /** Optional — Simkl only requires it for the PIN poll when the app has a secret. */
  clientSecret?: string;
  accessToken: string;
  username: string | null;
};

export type SimklPin = {
  deviceCode: string;
  userCode: string;
  verificationUrl: string;
  expiresAt: number;
  intervalSec: number;
};

/** Normalized history item returned by /api/simkl/history. */
export type SimklHistoryItem = {
  id: string;
  type: "movie" | "series";
  name: string;
  videoId?: string; // "<showImdb>:<s>:<e>" for episodes
  season?: number;
  episode?: number;
  episodeName?: string;
  watchedAt: number; // epoch ms
};

type SimklState = {
  auth: SimklAuth | null;
  loaded: boolean;
  phase: "idle" | "connecting" | "authorized";
  pin: SimklPin | null;
  error: string | null;
  importing: boolean;
  importingHistory: boolean;
  load: () => void;
  connect: (clientId: string, clientSecret?: string) => Promise<boolean>;
  pollOnce: () => Promise<"pending" | "authorized" | "failed">;
  cancelConnect: () => void;
  disconnect: () => void;
  importWatchlist: () => Promise<number>;
  importHistory: () => Promise<number>;
};

// Credentials for the in-flight PIN flow (auth is only persisted once the
// user authorizes; polling still needs the client id/secret meanwhile).
let pendingCreds: { clientId: string; clientSecret?: string } | null = null;

function readAuth(): SimklAuth | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SIMKL_KEY);
    if (!raw) return null;
    const a = JSON.parse(raw) as SimklAuth;
    if (!a || typeof a.accessToken !== "string" || a.accessToken.length < 16) return null;
    return a;
  } catch {
    return null;
  }
}

function writeAuth(auth: SimklAuth | null) {
  if (typeof window === "undefined") return;
  try {
    if (auth) window.localStorage.setItem(SIMKL_KEY, JSON.stringify(auth));
    else window.localStorage.removeItem(SIMKL_KEY);
  } catch {
    /* ignore */
  }
}

export const useSimkl = create<SimklState>((set, get) => ({
  auth: null,
  loaded: false,
  phase: "idle",
  pin: null,
  error: null,
  importing: false,
  importingHistory: false,

  load: () => {
    const auth = readAuth();
    set({ auth, loaded: true, phase: auth ? "authorized" : "idle" });
  },

  connect: async (clientId, clientSecret) => {
    const trimmedId = clientId.trim();
    const trimmedSecret = clientSecret?.trim() ? clientSecret.trim() : undefined;
    set({ error: null, phase: "connecting", pin: null });
    try {
      const res = await fetch("/api/simkl/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: trimmedId }),
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
        pendingCreds = null;
        set({ phase: "idle", error: data.error ?? `Simkl responded ${res.status}` });
        return false;
      }
      pendingCreds = { clientId: trimmedId, clientSecret: trimmedSecret };
      set({
        pin: {
          deviceCode: data.device_code,
          userCode: data.user_code,
          verificationUrl: data.verification_url || "https://simkl.com/pin",
          expiresAt: Date.now() + (data.expires_in ?? 600) * 1000,
          intervalSec: Math.max(3, data.interval ?? 5),
        },
      });
      return true;
    } catch (e) {
      pendingCreds = null;
      set({ phase: "idle", error: e instanceof Error ? e.message : "Could not reach Simkl" });
      return false;
    }
  },

  pollOnce: async () => {
    const { pin, auth } = get();
    if (!pin) return "failed";
    if (Date.now() > pin.expiresAt) {
      pendingCreds = null;
      set({ phase: "idle", pin: null, error: "PIN code expired — start again." });
      return "failed";
    }
    const clientId = auth?.clientId ?? pendingCreds?.clientId;
    const clientSecret = auth?.clientSecret ?? pendingCreds?.clientSecret;
    if (!clientId) {
      pendingCreds = null;
      set({ phase: "idle", pin: null, error: "Connection lost — start again." });
      return "failed";
    }
    try {
      const res = await fetch("/api/simkl/pin/poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, clientSecret, deviceCode: pin.deviceCode }),
        signal: AbortSignal.timeout(20_000),
      });
      const data = (await res.json()) as { error?: string; access_token?: string };
      if (res.ok && data.access_token) {
        const nextAuth: SimklAuth = {
          clientId,
          clientSecret,
          accessToken: data.access_token,
          username: null,
        };
        // Best-effort profile fetch for a friendly display name
        try {
          const me = await fetch("/api/simkl/user", {
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
        set({ auth: nextAuth, phase: "authorized", pin: null, error: null });
        return "authorized";
      }
      // While pending, Simkl answers 401 with an error body. Treat unknown
      // errors as "still pending"; only definitive text should fail.
      if (res.status === 401) {
        const errText = typeof data.error === "string" ? data.error.toLowerCase() : "";
        const definitive = errText.includes("bad_verification_code") || errText.includes("expired");
        if (!definitive) return "pending";
        pendingCreds = null;
        set({
          phase: "idle",
          pin: null,
          error: errText.includes("expired") ? "PIN code expired — start again." : "Simkl rejected this code — start again.",
        });
        return "failed";
      }
      pendingCreds = null;
      set({
        phase: "idle",
        pin: null,
        error: data.error ?? `Simkl responded ${res.status}`,
      });
      return "failed";
    } catch (e) {
      pendingCreds = null;
      set({ phase: "idle", pin: null, error: e instanceof Error ? e.message : "Token polling failed" });
      return "failed";
    }
  },

  cancelConnect: () => {
    pendingCreds = null;
    set({ phase: "idle", pin: null, error: null });
  },

  disconnect: () => {
    pendingCreds = null;
    writeAuth(null);
    set({ auth: null, phase: "idle", error: null });
  },

  importWatchlist: async () => {
    const { auth } = get();
    if (!auth) return -1;
    set({ importing: true, error: null });
    try {
      const res = await fetch("/api/simkl/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: auth.clientId, accessToken: auth.accessToken }),
        signal: AbortSignal.timeout(25_000),
      });
      const data = (await res.json()) as { items?: WatchlistEntry[]; error?: string };
      if (!res.ok || !Array.isArray(data.items)) {
        set({ importing: false, error: data.error ?? `Simkl responded ${res.status}` });
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
      const res = await fetch("/api/simkl/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: auth.clientId, accessToken: auth.accessToken }),
        signal: AbortSignal.timeout(25_000),
      });
      const data = (await res.json()) as { items?: SimklHistoryItem[]; error?: string };
      if (!res.ok || !Array.isArray(data.items)) {
        set({ importingHistory: false, error: data.error ?? `Simkl responded ${res.status}` });
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
}));
