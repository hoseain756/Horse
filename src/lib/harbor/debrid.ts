// Harbor Web — debrid integration (client store, BYO API key)
// Privacy model mirrors Trakt: the API key lives in localStorage only
// (harbor-web.debrid) and is relayed per-request to our server routes,
// which forward it to the service. Nothing about the account or the
// resolutions is ever persisted server-side.
"use client";

import { create } from "zustand";

const DEBRID_KEY = "harbor-web.debrid";

export type DebridService = "realdebrid" | "alldebrid" | "torbox";

export type DebridResolveResult = { url: string; filename?: string } | { error: string };

type StoredDebrid = {
  service: DebridService;
  apiKey: string;
  username: string | null;
  premium: boolean;
  expiresAt: number | null;
  planName?: string | null;
};

type DebridState = {
  service: DebridService;
  apiKey: string | null;
  username: string | null;
  premium: boolean;
  expiresAt: number | null;
  planName: string | null;
  status: "idle" | "valid" | "invalid" | "checking";
  loaded: boolean;
  error: string | null;
  load: () => void;
  save: (service: DebridService, apiKey: string) => void;
  disconnect: () => void;
  validate: (service: DebridService, apiKey: string) => Promise<boolean>;
  resolve: (
    infoHash: string,
    filename?: string,
    filesize?: number,
  ) => Promise<DebridResolveResult>;
};

function readStored(): StoredDebrid | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DEBRID_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<StoredDebrid>;
    if (!d || typeof d.apiKey !== "string" || d.apiKey.length < 10) return null;
    return {
      service: d.service === "alldebrid" ? "alldebrid" : d.service === "torbox" ? "torbox" : "realdebrid",
      apiKey: d.apiKey,
      username: typeof d.username === "string" ? d.username : null,
      premium: d.premium === true,
      expiresAt: typeof d.expiresAt === "number" ? d.expiresAt : null,
      planName: typeof d.planName === "string" ? d.planName : null,
    };
  } catch {
    return null;
  }
}

function writeStored(d: StoredDebrid | null) {
  if (typeof window === "undefined") return;
  try {
    if (d) window.localStorage.setItem(DEBRID_KEY, JSON.stringify(d));
    else window.localStorage.removeItem(DEBRID_KEY);
  } catch {
    /* ignore */
  }
}

export const useDebrid = create<DebridState>((set, get) => ({
  service: "realdebrid",
  apiKey: null,
  username: null,
  premium: false,
  expiresAt: null,
  planName: null,
  status: "idle",
  loaded: false,
  error: null,

  load: () => {
    const stored = readStored();
    set({
      service: stored?.service ?? "realdebrid",
      apiKey: stored?.apiKey ?? null,
      username: stored?.username ?? null,
      premium: stored?.premium ?? false,
      expiresAt: stored?.expiresAt ?? null,
      planName: stored?.planName ?? null,
      status: stored ? "valid" : "idle",
      loaded: true,
      error: null,
    });
  },

  save: (service, apiKey) => {
    const { username, premium, expiresAt, planName } = get();
    const next: StoredDebrid = { service, apiKey, username, premium, expiresAt, planName };
    writeStored(next);
    set({ service, apiKey, error: null });
  },

  disconnect: () => {
    writeStored(null);
    set({
      service: get().service,
      apiKey: null,
      username: null,
      premium: false,
      expiresAt: null,
      planName: null,
      status: "idle",
      error: null,
    });
  },

  validate: async (service, apiKey) => {
    set({ status: "checking", error: null });
    try {
      const res = await fetch("/api/debrid/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service, apiKey }),
        signal: AbortSignal.timeout(20_000),
      });
      const data = (await res.json()) as {
        error?: string;
        username?: string | null;
        premium?: boolean;
        expiresAt?: number | null;
        planName?: string | null;
      };
      if (!res.ok || typeof data.username !== "string") {
        set({ status: "invalid", error: data.error ?? `Service responded ${res.status}` });
        return false;
      }
      const next: StoredDebrid = {
        service,
        apiKey,
        username: data.username,
        premium: data.premium === true,
        expiresAt: typeof data.expiresAt === "number" ? data.expiresAt : null,
        planName: typeof data.planName === "string" ? data.planName : null,
      };
      writeStored(next);
      set({
        service,
        apiKey,
        username: next.username,
        premium: next.premium,
        expiresAt: next.expiresAt,
        planName: next.planName,
        status: "valid",
        error: null,
      });
      return true;
    } catch (e) {
      set({
        status: "invalid",
        error: e instanceof Error ? e.message : "Could not reach the debrid service",
      });
      return false;
    }
  },

  resolve: async (infoHash, filename, filesize) => {
    const { service, apiKey } = get();
    if (!apiKey) {
      return { error: "Connect a debrid service in Settings → Integrations first" };
    }
    try {
      const res = await fetch("/api/debrid/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service,
          apiKey,
          infoHash,
          ...(filename ? { filename } : {}),
          ...(typeof filesize === "number" && filesize > 0 ? { filesize } : {}),
        }),
        signal: AbortSignal.timeout(50_000),
      });
      const data = (await res.json()) as { url?: string; filename?: string; error?: string };
      if (!res.ok || typeof data.url !== "string" || !data.url) {
        return { error: data.error ?? `Unlock failed (${res.status})` };
      }
      // Persist nothing about the resolution — the direct link is session-only.
      return { url: data.url, ...(data.filename ? { filename: data.filename } : {}) };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Unlock request failed" };
    }
  },
}));
