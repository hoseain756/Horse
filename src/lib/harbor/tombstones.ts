// Addon tombstones — deletion propagation across devices.
// Uninstalling an addon records a tombstone (manifest id + timestamp); boot
// adoption and account union-merges skip tombstoned ids, so a removed addon
// does not resurrect from another device's snapshot. Tombstones expire after
// 90 days (re-installing the addon clears its tombstone immediately).
// Stored client-side under its own localStorage key AND synced as part of
// the snapshot (removedAddons) so other devices honor the same removals.
"use client";

export const REMOVED_ADDONS_KEY = "harbor-web.removed-addons";
const TOMBSTONE_TTL_MS = 90 * 86_400_000;
const MAX_TOMBSTONES = 200;

export type RemovedAddonTomb = { id: string; t: number };

export function readTombstones(): RemovedAddonTomb[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(REMOVED_ADDONS_KEY);
    const arr = raw ? (JSON.parse(raw) as RemovedAddonTomb[]) : [];
    return Array.isArray(arr) ? arr.filter((t) => t && typeof t.id === "string" && typeof t.t === "number") : [];
  } catch {
    return [];
  }
}

export function writeTombstones(list: RemovedAddonTomb[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(REMOVED_ADDONS_KEY, JSON.stringify(list.slice(-MAX_TOMBSTONES)));
  } catch {
    /* ignore */
  }
}

export function tombstoneIds(): Set<string> {
  return new Set(readTombstones().map((t) => t.id));
}

export function mergeTombstones(incoming: RemovedAddonTomb[]): void {
  const byId = new Map(readTombstones().map((t) => [t.id, t]));
  for (const t of incoming) {
    const prev = byId.get(t.id);
    if (!prev || prev.t < t.t) byId.set(t.id, t);
  }
  writeTombstones([...byId.values()].sort((a, b) => a.t - b.t));
}

export function recordAddonRemoval(manifestId: string): void {
  if (!manifestId) return;
  const list = readTombstones().filter((t) => t.id !== manifestId);
  list.push({ id: manifestId, t: Date.now() });
  writeTombstones(list);
}

export function clearAddonRemoval(manifestId: string): void {
  if (!manifestId) return;
  writeTombstones(readTombstones().filter((t) => t.id !== manifestId));
}

/** Expire tombstones older than 90 days (called on boot). */
export function gcTombstones(): void {
  const cutoff = Date.now() - TOMBSTONE_TTL_MS;
  writeTombstones(readTombstones().filter((t) => t.t >= cutoff).sort((a, b) => a.t - b.t));
}
