// Harbor Web — zero-config account linking client store (Trakt + Simkl)
// The user enters ONLY a short activation code on the provider's site; tokens
// live in the server-side vault (AES-256-GCM at rest) and this browser holds
// just an opaque linkId + profile info. Legacy BYO flows stay untouched.
"use client";

import { create } from "zustand";
import { mergeWatchlist, mergeHistory } from "./cw";

const STORE_KEY = "harbor-web.links";
const LASTSYNC_KEY = "harbor-web.links.lastsync";

export type ServiceId = "trakt" | "simkl";

export type LinkedAccount = {
  linkId: string;
  username: string | null;
  avatar: string | null;
  linkedAt: number;
};

export type LinkFlow = {
  service: ServiceId;
  pollId: string;
  userCode: string;
  verificationUrl: string;
  expiresAt: number;
  intervalSec: number;
  status: "waiting" | "authorized" | "expired" | "denied" | "failed";
  slowDown: boolean;
  error: string | null;
};

type Persisted = { trakt?: LinkedAccount | null; simkl?: LinkedAccount | null };

function readPersisted(): Persisted {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORE_KEY) ?? "{}") as Persisted;
  } catch {
    return {};
  }
}

function writePersisted(p: Persisted) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

export function readLastSync(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(LASTSYNC_KEY) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

function writeLastSync(service: ServiceId, t: number) {
  if (typeof window === "undefined") return;
  const all = readLastSync();
  all[service] = t;
  try {
    window.localStorage.setItem(LASTSYNC_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

type LinkingState = {
  trakt: LinkedAccount | null;
  simkl: LinkedAccount | null;
  loaded: boolean;
  flow: LinkFlow | null;
  lastSync: Record<string, number>;
  syncing: Record<string, boolean>;
  load: () => void;
  startLink: (service: ServiceId) => Promise<boolean>;
  regenerate: () => Promise<boolean>;
  pollOnce: () => Promise<"pending" | "authorized" | "terminal">;
  cancelFlow: () => void;
  unlink: (service: ServiceId) => Promise<void>;
  syncNow: (service: ServiceId) => Promise<{ watchlist: number; history: number } | null>;
  /** Server key configured? (checked once) */
  envConfigured: Record<ServiceId, boolean | null>;
  checkEnv: () => Promise<void>;
};

export const useLinking = create<LinkingState>((set, get) => ({
  trakt: null,
  simkl: null,
  loaded: false,
  flow: null,
  lastSync: {},
  syncing: {},
  envConfigured: { trakt: null, simkl: null },

  load: () => {
    const p = readPersisted();
    set({
      trakt: p.trakt ?? null,
      simkl: p.simkl ?? null,
      loaded: true,
      lastSync: readLastSync(),
    });
  },

  checkEnv: async () => {
    // Cheap probes: our link/start routes answer GET {configured:bool} without
    // creating anything. (The old POST-based probe would mint a REAL device
    // code on every Integrations mount once env keys exist — wasteful.)
    const check = async (url: string) => {
      try {
        const res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(10_000) });
        if (!res.ok) return true; // unexpected — stay optimistic
        const data = (await res.json()) as { configured?: boolean };
        return data.configured === true;
      } catch {
        return null; // unknown (network) — stay optimistic
      }
    };
    const [trakt, simkl] = await Promise.all([check("/api/trakt/link/start"), check("/api/simkl/link/start")]);
    set({ envConfigured: { trakt: trakt !== false, simkl: simkl !== false } });
  },

  startLink: async (service) => {
    set({ flow: null });
    try {
      const res = await fetch(`/api/${service}/link/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(20_000),
      });
      const data = (await res.json()) as {
        error?: string;
        configured?: boolean;
        pollId?: string;
        userCode?: string;
        verificationUrl?: string;
        expiresAt?: number;
        intervalSec?: number;
      };
      if (!res.ok || !data.pollId || !data.userCode) {
        set({
          flow: {
            service,
            pollId: "",
            userCode: "",
            verificationUrl: "",
            expiresAt: 0,
            intervalSec: 5,
            status: "failed",
            slowDown: false,
            error: data.error ?? `Server responded ${res.status}`,
          },
        });
        return false;
      }
      set({
        flow: {
          service,
          pollId: data.pollId,
          userCode: data.userCode,
          verificationUrl: data.verificationUrl ?? "",
          expiresAt: data.expiresAt ?? Date.now() + 600_000,
          intervalSec: data.intervalSec ?? 5,
          status: "waiting",
          slowDown: false,
          error: null,
        },
      });
      return true;
    } catch (e) {
      set({
        flow: {
          service,
          pollId: "",
          userCode: "",
          verificationUrl: "",
          expiresAt: 0,
          intervalSec: 5,
          status: "failed",
          slowDown: false,
          error: e instanceof Error ? e.message : "Could not reach the server",
        },
      });
      return false;
    }
  },

  regenerate: () => {
    const flow = get().flow;
    if (!flow) return Promise.resolve(false);
    return get().startLink(flow.service);
  },

  pollOnce: async () => {
    const flow = get().flow;
    if (!flow?.pollId) return "terminal";
    if (Date.now() > flow.expiresAt) {
      set({ flow: { ...flow, status: "expired" } });
      return "terminal";
    }
    try {
      const res = await fetch(`/api/${flow.service}/link/poll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pollId: flow.pollId }),
        signal: AbortSignal.timeout(20_000),
      });
      // Transient server/upstream hiccups (502/503/504, rate limit) must NOT
      // kill the flow — the user may have just approved on the provider's site.
      if (res.status >= 500 || res.status === 429) {
        set({ flow: { ...get().flow!, error: "Connection hiccup — still trying…" } });
        return "pending";
      }
      const data = (await res.json()) as {
        status?: "pending" | "authorized" | "expired" | "denied";
        linkId?: string;
        username?: string | null;
        avatar?: string | null;
        error?: string;
        slowDown?: boolean;
      };
      if (data.status === "authorized" && data.linkId) {
        const account: LinkedAccount = {
          linkId: data.linkId,
          username: data.username ?? null,
          avatar: data.avatar ?? null,
          linkedAt: Date.now(),
        };
        const p = readPersisted();
        p[flow.service] = account;
        writePersisted(p);
        set({ flow: { ...get().flow!, status: "authorized" }, [flow.service]: account } as Partial<LinkingState>);
        return "authorized";
      }
      if (data.status === "pending") {
        set({ flow: { ...get().flow!, slowDown: data.slowDown === true, error: null } });
        return "pending";
      }
      // terminal failure states
      const status = data.status === "expired" ? "expired" : data.status === "denied" ? "denied" : "failed";
      set({ flow: { ...get().flow!, status, error: data.error ?? null } });
      return "terminal";
    } catch (e) {
      // Transient network hiccup — keep waiting
      set({ flow: { ...get().flow!, error: e instanceof Error ? e.message : "poll failed" } });
      return "pending";
    }
  },

  cancelFlow: () => set({ flow: null }),

  unlink: async (service) => {
    const account = get()[service];
    if (!account) return;
    try {
      await fetch(`/api/${service}/link/unlink`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkId: account.linkId }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      /* row removal is best-effort client-side too */
    }
    const p = readPersisted();
    delete p[service];
    writePersisted(p);
    set({ [service]: null } as Partial<LinkingState>);
  },

  syncNow: async (service) => {
    const account = get()[service];
    if (!account) return null;
    set({ syncing: { ...get().syncing, [service]: true } });
    try {
      const body = JSON.stringify({ linkId: account.linkId });
      const headers = { "Content-Type": "application/json" };
      const [wlRes, histRes] = await Promise.allSettled([
        fetch(`/api/${service}/watchlist`, { method: "POST", headers, body, signal: AbortSignal.timeout(30_000) }),
        fetch(`/api/${service}/history`, { method: "POST", headers, body, signal: AbortSignal.timeout(30_000) }),
      ]);
      let watchlist = 0;
      let history = 0;
      if (wlRes.status === "fulfilled" && wlRes.value.ok) {
        const data = (await wlRes.value.json()) as { items?: { id: string; type: string; name: string; year?: string }[] };
        if (Array.isArray(data.items)) {
          watchlist = mergeWatchlist(
            data.items.map((it) => ({ id: it.id, type: it.type === "series" ? "series" : "movie", name: it.name, releaseInfo: it.year })),
          );
        }
      }
      if (histRes.status === "fulfilled" && histRes.value.ok) {
        const data = (await histRes.value.json()) as {
          items?: { id: string; type: string; name: string; videoId?: string; season?: number; episode?: number; episodeName?: string; watchedAt: number }[];
        };
        if (Array.isArray(data.items)) {
          history = mergeHistory(
            data.items.map((it) => ({
              id: it.id,
              type: it.type === "series" ? "series" : "movie",
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
        }
      }
      if (wlRes.status === "rejected" && histRes.status === "rejected") return null;
      writeLastSync(service, Date.now());
      set({ lastSync: readLastSync(), syncing: { ...get().syncing, [service]: false } });
      return { watchlist, history };
    } finally {
      set({ syncing: { ...get().syncing, [service]: false } });
    }
  },
}));

/**
 * Fan a playback scrobble out to every linked service (Trakt + Simkl).
 * Fire-and-forget — a sync failure must never disrupt playback.
 */
export async function scrobbleToLinkedServices(action: "start" | "pause" | "stop", payload: { progress: number; type: "movie" | "episode"; imdbId: string; season?: number; episode?: number }): Promise<void> {
  const { trakt, simkl } = useLinking.getState();
  const base = {
    action,
    progress: payload.progress,
    type: payload.type,
    imdbId: payload.imdbId,
    ...(payload.season !== undefined ? { season: payload.season } : {}),
    ...(payload.episode !== undefined ? { episode: payload.episode } : {}),
  };
  const jobs: Promise<unknown>[] = [];
  if (trakt) {
    jobs.push(
      fetch("/api/trakt/scrobble", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkId: trakt.linkId, ...base }),
        signal: AbortSignal.timeout(8_000),
      }).catch(() => undefined),
    );
  }
  if (simkl) {
    jobs.push(
      fetch("/api/simkl/scrobble", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkId: simkl.linkId, ...base }),
        signal: AbortSignal.timeout(8_000),
      }).catch(() => undefined),
    );
  }
  await Promise.allSettled(jobs);
}
