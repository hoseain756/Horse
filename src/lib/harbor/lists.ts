// Harbor Web — custom user lists ("Collections")
// localStorage-backed (mirrors cw.ts pattern) and included in cloud sync.
// The Prisma CustomList table mirrors these rows server-side via /api/sync.
"use client";

import { emitDataChange } from "./cw";

const LISTS_KEY = "harbor-web.lists.v1";

export type ListItem = {
  id: string; // meta id, e.g. tt0111161
  type: string; // movie | series | other
  name: string;
  poster?: string;
  releaseInfo?: string;
  imdbRating?: string;
  addedAt: number;
};

export type UserList = {
  id: string; // local id
  name: string;
  description?: string;
  items: ListItem[];
  createdAt: number;
  updatedAt: number;
};

const MAX_LISTS = 40;
const MAX_ITEMS_PER_LIST = 300;

function readLists(): UserList[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LISTS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as UserList[];
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (l) => l && typeof l.id === "string" && typeof l.name === "string" && Array.isArray(l.items),
    );
  } catch {
    return [];
  }
}

function writeLists(lists: UserList[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LISTS_KEY, JSON.stringify(lists.slice(0, MAX_LISTS)));
  } catch {
    /* ignore */
  }
}

export function getLists(): UserList[] {
  return readLists().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getList(id: string): UserList | null {
  return readLists().find((l) => l.id === id) ?? null;
}

export function createList(name: string, description?: string): UserList {
  const cleanName = name.trim().slice(0, 80);
  if (!cleanName) throw new Error("List name is required");
  const now = Date.now();
  const list: UserList = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID().slice(0, 13)
        : `l${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: cleanName,
    description: description?.trim().slice(0, 200) || undefined,
    items: [],
    createdAt: now,
    updatedAt: now,
  };
  writeLists([...readLists(), list]);
  emitDataChange();
  return list;
}

export function renameList(id: string, name: string, description?: string): UserList[] {
  const cleanName = name.trim().slice(0, 80);
  if (!cleanName) return getLists();
  const next = readLists().map((l) =>
    l.id === id ? { ...l, name: cleanName, description: description?.trim().slice(0, 200) || undefined, updatedAt: Date.now() } : l,
  );
  writeLists(next);
  emitDataChange();
  return next;
}

export function deleteList(id: string): UserList[] {
  const next = readLists().filter((l) => l.id !== id);
  writeLists(next);
  emitDataChange();
  return next;
}

export function addToList(listId: string, item: Omit<ListItem, "addedAt">): boolean {
  const lists = readLists();
  const list = lists.find((l) => l.id === listId);
  if (!list) return false;
  if (list.items.some((i) => i.id === item.id)) return false; // already present
  if (list.items.length >= MAX_ITEMS_PER_LIST) return false;
  list.items.unshift({ ...item, addedAt: Date.now() });
  list.updatedAt = Date.now();
  writeLists(lists);
  emitDataChange();
  return true;
}

export function removeFromList(listId: string, itemId: string): boolean {
  const lists = readLists();
  const list = lists.find((l) => l.id === listId);
  if (!list) return false;
  const before = list.items.length;
  list.items = list.items.filter((i) => i.id !== itemId);
  if (list.items.length === before) return false;
  list.updatedAt = Date.now();
  writeLists(lists);
  emitDataChange();
  return true;
}

/** Toggle membership; returns true when the item is now in the list. */
export function toggleInList(listId: string, item: Omit<ListItem, "addedAt">): boolean {
  const lists = readLists();
  const list = lists.find((l) => l.id === listId);
  if (!list) return false;
  if (list.items.some((i) => i.id === item.id)) {
    removeFromList(listId, item.id);
    return false;
  }
  addToList(listId, item);
  return true;
}

/** All lists that currently contain the given item id. */
export function getListsContaining(itemId: string): UserList[] {
  return readLists().filter((l) => l.items.some((i) => i.id === itemId));
}

/** Poster URLs for a 3-slot collage (fills left→right, dedupes). */
export function listCollage(list: UserList): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list.items) {
    if (item.poster && !seen.has(item.poster)) {
      seen.add(item.poster);
      out.push(item.poster);
      if (out.length === 3) break;
    }
  }
  return out;
}

// ---------- List sharing via URL ----------
// Shareable code: "hblist1." + base64url(JSON {n: name, d?: description, i: [{id,type,name,poster?}]})
// Mirrors the theme-share pattern in themes.ts. Release info / ratings are dropped
// and poster URLs truncated so links stay compact; the recipient re-imports locally.

const LIST_SHARE_PREFIX = "hblist1.";
const SHARE_ID_MAX = 120;
const SHARE_NAME_MAX = 200;
const SHARE_POSTER_MAX = 600;

export type SharedListItem = {
  id: string;
  type: "movie" | "series";
  name: string;
  poster?: string;
};

export type SharedList = {
  name: string;
  description?: string;
  items: SharedListItem[];
};

type ListSharePayload = {
  n: string;
  d?: string;
  i: { id: string; type: string; name: string; poster?: string }[];
};

function jsonToBase64Url(json: string): string {
  if (typeof btoa === "function") {
    const bytes = new TextEncoder().encode(json);
    let binary = "";
    const chunk = 0x8000; // avoid spread-arg limits on large lists
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  return Buffer.from(json, "utf-8").toString("base64url");
}

function base64UrlToJson(b64: string): string {
  const std = b64.replace(/-/g, "+").replace(/_/g, "/");
  if (typeof atob === "function") {
    const binary = atob(std);
    return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
  }
  return Buffer.from(std, "base64").toString("utf-8");
}

/** Encode a user list as a portable share code, or null when nothing shareable exists. */
export function encodeListShare(list: UserList): string | null {
  try {
    const name = list.name.trim().slice(0, 80);
    if (!name) return null;
    const payload: ListSharePayload = {
      n: name,
      i: list.items
        .filter((i) => i.type === "movie" || i.type === "series")
        .slice(0, MAX_ITEMS_PER_LIST)
        .map((i) => ({
          id: i.id.trim().slice(0, SHARE_ID_MAX),
          type: i.type,
          name: i.name.trim().slice(0, SHARE_NAME_MAX),
          ...(i.poster ? { poster: i.poster.slice(0, SHARE_POSTER_MAX) } : {}),
        }))
        .filter((i) => i.id && i.name),
    };
    const description = list.description?.trim().slice(0, 200);
    if (description) payload.d = description;
    return LIST_SHARE_PREFIX + jsonToBase64Url(JSON.stringify(payload));
  } catch {
    return null;
  }
}

/** Decode + fully validate a share code (or a full link containing one). Null when invalid. */
export function decodeListShare(code: string): SharedList | null {
  try {
    const trimmed = code.trim();
    const b64part = trimmed.startsWith(LIST_SHARE_PREFIX)
      ? trimmed.slice(LIST_SHARE_PREFIX.length)
      : trimmed.includes(LIST_SHARE_PREFIX)
        ? trimmed.split(LIST_SHARE_PREFIX)[1]
        : null;
    if (!b64part) return null;
    const raw = JSON.parse(base64UrlToJson(b64part)) as Partial<ListSharePayload>;
    const name = typeof raw.n === "string" ? raw.n.trim().slice(0, 80) : "";
    if (!name) return null;
    if (!Array.isArray(raw.i)) return null;
    const description =
      typeof raw.d === "string" && raw.d.trim() ? raw.d.trim().slice(0, 200) : undefined;
    const items: SharedListItem[] = [];
    const seen = new Set<string>();
    for (const it of raw.i.slice(0, MAX_ITEMS_PER_LIST)) {
      if (!it || typeof it !== "object") continue;
      if (typeof it.id !== "string" || !it.id.trim()) continue;
      if (typeof it.name !== "string" || !it.name.trim()) continue;
      if (it.type !== "movie" && it.type !== "series") continue;
      if (seen.has(it.id)) continue;
      seen.add(it.id);
      // `poster` is the canonical key; `p` is a legacy alias from early codes
      const legacy = it as unknown as { p?: unknown };
      const poster =
        typeof it.poster === "string" && it.poster
          ? it.poster.slice(0, SHARE_POSTER_MAX)
          : typeof legacy.p === "string" && legacy.p
            ? legacy.p.slice(0, SHARE_POSTER_MAX)
            : undefined;
      items.push({
        id: it.id.trim().slice(0, SHARE_ID_MAX),
        type: it.type,
        name: it.name.trim().slice(0, SHARE_NAME_MAX),
        ...(poster ? { poster } : {}),
      });
    }
    return { name, description, items };
  } catch {
    return null;
  }
}

/** Create a local list from a shared one; colliding names get " (2)", " (3)"… suffixes. */
export function importSharedList(shared: SharedList): UserList {
  const existing = new Set(readLists().map((l) => l.name));
  let name = shared.name;
  for (let n = 2; existing.has(name); n++) {
    name = `${shared.name} (${n})`;
  }
  const list = createList(name, shared.description);
  for (const item of shared.items) {
    addToList(list.id, { id: item.id, type: item.type, name: item.name, poster: item.poster });
  }
  return getList(list.id) ?? list;
}
