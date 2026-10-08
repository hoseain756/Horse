// Harbor Web — continue-watching + watchlist + history (localStorage-backed, mirrors Harbor local stores)
"use client";

import type { CwCard } from "./types";

const CW_KEY = "harbor-web.localcw.v1";
const WATCHLIST_KEY = "harbor-web.watchlist.v1";
const HISTORY_KEY = "harbor-web.history.v1";

export type LocalCwEntry = {
  id: string;
  type: "movie" | "series";
  name: string;
  poster?: string;
  background?: string;
  season?: number;
  episode?: number;
  videoId?: string;
  episodeName?: string;
  positionMs: number;
  durationMs: number;
  /** True when durationMs came from metadata runtime (approximate, "~"). */
  durationApprox?: boolean;
  t: number; // timestamp
};

type CwMap = Record<string, LocalCwEntry>;

function readMap<T>(key: string): Record<string, T> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? "{}") as Record<string, T>;
  } catch {
    return {};
  }
}

function writeMap(key: string, map: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

/** Fired whenever user data mutates — cloud sync + views listen for this. */
export function emitDataChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("harbor:data-changed"));
}

// ---------- Continue watching ----------
const MAX_CW = 60;

export function upsertCw(entry: LocalCwEntry) {
  const map = readMap<LocalCwEntry>(CW_KEY);
  map[entry.id] = { ...entry, t: Date.now() };
  // LRU cap
  const entries = Object.values(map).sort((a, b) => b.t - a.t);
  if (entries.length > MAX_CW) {
    for (const old of entries.slice(MAX_CW)) delete map[old.id];
  }
  writeMap(CW_KEY, map);
  emitDataChange();
}

export function removeCw(id: string) {
  const map = readMap<LocalCwEntry>(CW_KEY);
  delete map[id];
  writeMap(CW_KEY, map);
  emitDataChange();
}

export function getCwCards(): CwCard[] {
  const map = readMap<LocalCwEntry>(CW_KEY);
  return Object.values(map)
    .filter((e) => {
      const progress = e.durationMs > 0 ? e.positionMs / e.durationMs : 0;
      if (e.type === "movie" && progress >= 0.92) return false;
      return progress > 0.01;
    })
    .sort((a, b) => b.t - a.t)
    .map((e) => ({
      id: e.id,
      type: e.type,
      name: e.name,
      poster: e.poster,
      background: e.background,
      season: e.season,
      episode: e.episode,
      videoId: e.videoId,
      episodeName: e.episodeName,
      progress: e.durationMs > 0 ? Math.min(0.99, e.positionMs / e.durationMs) : 0,
    }));
}

export function getCwEntry(id: string): LocalCwEntry | null {
  return readMap<LocalCwEntry>(CW_KEY)[id] ?? null;
}

export function resumeMsFor(id: string, videoId?: string): number {
  const entry = getCwEntry(id);
  if (!entry) return 0;
  if (videoId && entry.videoId && entry.videoId !== videoId) {
    // different episode; check videoId suffix key
    return 0;
  }
  const progress = entry.durationMs > 0 ? entry.positionMs / entry.durationMs : 0;
  if (progress >= 0.92) return 0;
  return entry.positionMs;
}

// ---------- Watchlist ----------
export type WatchlistEntry = {
  id: string;
  type: string;
  name: string;
  poster?: string;
  releaseInfo?: string;
  imdbRating?: string;
  t: number;
};

export function getWatchlist(): WatchlistEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(WATCHLIST_KEY) ?? "[]") as WatchlistEntry[];
  } catch {
    return [];
  }
}

export function isInWatchlist(id: string): boolean {
  return getWatchlist().some((w) => w.id === id);
}

/** Cheap count for settings badges (no array mapping). */
export function getWatchlistLength(): number {
  if (typeof window === "undefined") return 0;
  try {
    const arr = JSON.parse(window.localStorage.getItem(WATCHLIST_KEY) ?? "[]") as unknown[];
    return Array.isArray(arr) ? arr.length : 0;
  } catch {
    return 0;
  }
}

export function toggleWatchlist(entry: Omit<WatchlistEntry, "t">): boolean {
  const list = getWatchlist();
  const idx = list.findIndex((w) => w.id === entry.id);
  if (idx >= 0) {
    list.splice(idx, 1);
    try {
      window.localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list));
    } catch { /* ignore */ }
    emitDataChange();
    return false;
  }
  list.unshift({ ...entry, t: Date.now() });
  try {
    window.localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list));
  } catch { /* ignore */ }
  emitDataChange();
  return true;
}

/**
 * Merge external entries (e.g. Trakt watchlist import) into the local
 * watchlist. Existing entries are never overwritten; returns how many
 * entries were actually added.
 */
export function mergeWatchlist(entries: Omit<WatchlistEntry, "t">[]): number {
  if (typeof window === "undefined" || entries.length === 0) return 0;
  const list = getWatchlist();
  const known = new Set(list.map((w) => w.id));
  let added = 0;
  for (const e of entries) {
    if (!e.id || known.has(e.id)) continue;
    list.push({ ...e, t: Date.now() + added });
    known.add(e.id);
    added++;
  }
  if (added > 0) {
    try {
      window.localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list));
    } catch {
      return 0;
    }
    emitDataChange();
  }
  return added;
}

// ---------- Playback history ----------
export type HistoryEntry = {
  id: string;
  type: string;
  name: string;
  poster?: string;
  videoId?: string;
  season?: number;
  episode?: number;
  episodeName?: string;
  positionMs: number;
  durationMs: number;
  t: number;
};

export function pushHistory(entry: Omit<HistoryEntry, "t">) {
  if (typeof window === "undefined") return;
  try {
    const list = JSON.parse(
      window.localStorage.getItem(HISTORY_KEY) ?? "[]",
    ) as HistoryEntry[];
    list.unshift({ ...entry, t: Date.now() });
    window.localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(list.slice(0, 500)),
    );
    emitDataChange();
  } catch {
    /* ignore */
  }
}

export function getHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(HISTORY_KEY) ?? "[]") as HistoryEntry[];
  } catch {
    return [];
  }
}

export function episodeWatchedSet(): Set<string> {
  const set = new Set<string>();
  for (const h of getHistory()) {
    if (h.videoId) {
      const progress = h.durationMs > 0 ? h.positionMs / h.durationMs : 0;
      if (progress >= 0.85) set.add(h.videoId);
    }
  }
  return set;
}

/**
 * Merge external playback-history entries (e.g. Trakt history import).
 * Idempotent: an entry is skipped when an exact (id + videoId + t) record
 * already exists. Entries with positionMs === durationMs === 0 are stored as
 * 1ms/1ms so they count as fully-watched for episodeWatchedSet()/Wrapped.
 * Newest entries first; at most 250 entries are merged per call; a single
 * data-change event is emitted; returns how many entries were added.
 * Entries may carry their own `t` (epoch ms) — otherwise "now" is used.
 */
export function mergeHistory(entries: (Omit<HistoryEntry, "t"> & { t?: number })[]): number {
  if (typeof window === "undefined" || entries.length === 0) return 0;
  const list = getHistory();
  const known = new Set(list.map((h) => `${h.id}|${h.videoId ?? ""}|${h.t}`));
  const additions: HistoryEntry[] = [];
  for (const e of entries.slice(0, 250)) {
    const t = typeof e.t === "number" && Number.isFinite(e.t) && e.t > 0 ? e.t : Date.now();
    const key = `${e.id}|${e.videoId ?? ""}|${t}`;
    if (known.has(key)) continue;
    known.add(key);
    const bothZero = (e.positionMs ?? 0) === 0 && (e.durationMs ?? 0) === 0;
    additions.push({
      ...e,
      t,
      positionMs: bothZero ? 1 : e.positionMs,
      durationMs: bothZero ? 1 : e.durationMs,
    });
  }
  if (additions.length === 0) return 0;
  additions.sort((a, b) => b.t - a.t);
  list.unshift(...additions);
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 500)));
  } catch {
    return 0;
  }
  emitDataChange();
  return additions.length;
}
