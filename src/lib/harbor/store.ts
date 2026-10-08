// Harbor Web — global client state (zustand)
// View stack mirrors Harbor desktop frame-stack navigation; settings persisted to localStorage.
"use client";

import { create } from "zustand";
import { useEffect } from "react";
import {
  DEFAULT_SETTINGS,
  Settings,
  loadSettings,
  saveSettings,
  sanitizeSettings,
} from "./settings";
import { Addon, parseAddonUrl } from "./types";
import { sanitizeStoredProbe, type StoredProbe } from "./addon-probe";

// ---------- View / navigation ----------
export type View =
  | "home"
  | "discover"
  | "catalogs"
  | "movies"
  | "shows"
  | "kids"
  | "anime"
  | "live"
  | "calendar"
  | "library"
  | "addons"
  | "wrapped"
  | "settings"
  | "search";

export type Frame =
  | { kind: "view"; view: View }
  | { kind: "detail"; type: string; id: string; from?: string }
  | {
      kind: "picker";
      type: string;
      id: string;
      videoId?: string;
      season?: number;
      episode?: number;
      /** Approximate title length (seconds) — forwarded to the player timeline. */
      runtimeSeconds?: number;
    }
  | { kind: "player"; payload: PlayerPayload }
  | { kind: "person"; id: string; name?: string }
  | { kind: "addon-detail"; addonId: string }
  | { kind: "collection"; name: string; query: string }
  | { kind: "list-detail"; listId: string }
  | { kind: "grid"; title: string; query: CatalogQuery };

export type PlayerPayload = {
  url: string;
  title: string;
  type: string;
  metaId: string;
  poster?: string;
  season?: number;
  episode?: number;
  videoId?: string;
  episodeName?: string;
  streamDescription?: string;
  streamTitle?: string;
  deepLink?: { type: string; id: string; videoId?: string };
  resumeAt?: number;
  /** Set when the source is the server-side P2P torrent engine (drives the stats HUD). */
  p2p?: { key: string; fileIdx: number; infoHash: string; mode: "native" | "remux" | "unknown" };
  /** The originating addon stream object — powers the proxy/convert ladder and fallback. */
  stream?: import("./types").Stream;
  /**
   * Known title length in seconds from metadata (Stremio meta.runtime or TMDB
   * runtime / episode runtime, normalized). Approximate — the playback
   * timeline marks it with "~" until a real duration arrives.
   */
  runtimeSeconds?: number;
};

export type CatalogQuery = {
  type: string;
  catalogId: string;
  addonId?: string;
  extra?: Record<string, string>;
};

export function frameKey(f: Frame): string {
  switch (f.kind) {
    case "view":
      return `view:${f.view}`;
    case "detail":
      return `detail:${f.type}:${f.id}`;
    case "picker":
      return `picker:${f.type}:${f.id}:${f.videoId ?? ""}`;
    case "player":
      return "player";
    case "person":
      return `person:${f.id}`;
    case "addon-detail":
      return `addon:${f.addonId}`;
    case "list-detail":
      return `list:${f.listId}`;
    case "collection":
      return `collection:${f.query}`;
    case "grid":
      return `grid:${f.query.catalogId}:${JSON.stringify(f.query.extra ?? {})}`;
  }
}

type NavState = {
  stack: Frame[];
  backStack: Frame[];
  forwardStack: Frame[];
  searchOpen: boolean;
  push: (f: Frame) => void;
  pop: () => void;
  replace: (f: Frame) => void;
  resetTo: (f: Frame) => void;
  setSearchOpen: (open: boolean) => void;
  top: () => Frame | undefined;
};

export const useNav = create<NavState>((set, get) => ({
  stack: [{ kind: "view", view: "home" }],
  backStack: [],
  forwardStack: [],
  searchOpen: false,
  push: (f) => {
    const { stack, backStack } = get();
    set({
      stack: [...stack, f],
      backStack: [...backStack, stack[stack.length - 1]],
      forwardStack: [],
    });
  },
  pop: () => {
    const { stack, backStack, forwardStack } = get();
    if (stack.length <= 1) return;
    const current = stack[stack.length - 1];
    const prev = backStack[backStack.length - 1];
    set({
      stack: stack.slice(0, -1),
      backStack: backStack.slice(0, -1),
      forwardStack: [...forwardStack, current],
      ...(prev?.kind === "view" && stack.length === 2 ? {} : {}),
    });
  },
  replace: (f) => {
    const { stack, backStack } = get();
    set({ stack: [...stack.slice(0, -1), f], backStack, forwardStack: [] });
  },
  resetTo: (f) => set({ stack: [f], backStack: [], forwardStack: [] }),
  setSearchOpen: (open) => set({ searchOpen: open }),
  top: () => {
    const { stack } = get();
    return stack[stack.length - 1];
  },
}));

// Convenience hooks
export function useCurrentView(): View {
  const stack = useNav((s) => s.stack);
  const top = stack[stack.length - 1];
  return top?.kind === "view" ? top.view : "home";
}

// ---------- Settings ----------
type SettingsState = {
  settings: Settings;
  loaded: boolean;
  update: (patch: Partial<Settings>) => void;
  load: () => void;
};

export const useSettings = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  load: () => {
    const s = loadSettings();
    set({ settings: s, loaded: true });
  },
  update: (patch) => {
    const next = sanitizeSettings({ ...get().settings, ...patch });
    saveSettings(next);
    set({ settings: next });
  },
}));

export function useSettingsInit() {
  const load = useSettings((s) => s.load);
  const loaded = useSettings((s) => s.loaded);
  useEffect(() => {
    if (!loaded) load();
  }, [loaded, load]);
}

// ---------- Addons ----------
const ADDONS_KEY = "harbor-web.installed-addons";

export type AddonRecord = Addon & {
  enabled: boolean;
  order: number;
  /** Last health-probe result — persisted with the record and synced via cloud snapshot. */
  probe?: StoredProbe;
};

type AddonsState = {
  addons: AddonRecord[];
  loaded: boolean;
  load: () => void;
  install: (manifestUrl: string, manifest: Addon["manifest"]) => void;
  uninstall: (addonId: string) => void;
  setEnabled: (addonId: string, enabled: boolean) => void;
  reorder: (ids: string[]) => void;
  setProbe: (addonId: string, probe: StoredProbe | null) => void;
};

function readStoredAddons(): AddonRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ADDONS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as AddonRecord[];
    return arr.map((a, i) => ({
      ...a,
      // Heal addons installed with percent-encoded config separators (%7C → |) —
      // otherwise Torrentio-style manifests silently return zero streams.
      transportUrl: parseAddonUrl(a.transportUrl),
      enabled: a.enabled !== false,
      order: a.order ?? i,
      probe: sanitizeStoredProbe(a.probe),
    }));
  } catch {
    return [];
  }
}

export const useAddons = create<AddonsState>((set, get) => ({
  addons: [],
  loaded: false,
  load: () => set({ addons: readStoredAddons(), loaded: true }),
  install: (manifestUrl, manifest) => {
    const url = parseAddonUrl(manifestUrl);
    const existing = get().addons.filter((a) => a.manifest.id !== manifest.id);
    const rec: AddonRecord = {
      manifest,
      transportUrl: url,
      installedAt: Date.now(),
      enabled: true,
      order: existing.length,
    };
    const next = [...existing, rec];
    persistAddons(next);
    set({ addons: next });
  },
  uninstall: (addonId) => {
    const next = get().addons.filter((a) => a.manifest.id !== addonId);
    persistAddons(next);
    set({ addons: next });
  },
  setEnabled: (addonId, enabled) => {
    const next = get().addons.map((a) =>
      a.manifest.id === addonId ? { ...a, enabled } : a,
    );
    persistAddons(next);
    set({ addons: next });
  },
  reorder: (ids) => {
    const map = new Map(get().addons.map((a) => [a.manifest.id, a]));
    const next = ids
      .map((id, i) => {
        const a = map.get(id);
        return a ? { ...a, order: i } : null;
      })
      .filter((x): x is AddonRecord => x !== null);
    persistAddons(next);
    set({ addons: next });
  },
  setProbe: (addonId, probe) => {
    const next = get().addons.map((a) => {
      if (a.manifest.id !== addonId) return a;
      const rec: AddonRecord = { ...a };
      if (probe) rec.probe = probe;
      else delete rec.probe;
      return rec;
    });
    persistAddons(next);
    set({ addons: next });
  },
}));

function persistAddons(addons: AddonRecord[]) {
  if (typeof window === "undefined") return;
  try {
    const slim = addons.map((a, i) => ({
      ...a,
      order: i,
      manifest: {
        ...a.manifest,
        description: a.manifest.description?.slice(0, 400),
      },
    }));
    window.localStorage.setItem(ADDONS_KEY, JSON.stringify(slim));
  } catch {
    /* ignore */
  }
}

export function useAddonsInit() {
  const load = useAddons((s) => s.load);
  const loaded = useAddons((s) => s.loaded);
  useEffect(() => {
    if (!loaded) load();
  }, [loaded, load]);
}

export function installedAddons(): AddonRecord[] {
  return useAddons.getState().addons;
}
