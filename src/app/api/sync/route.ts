// Harbor Web — Prisma-backed device sync
// Persists a user's addons / settings / continue-watching / watchlist / history /
// custom themes into SQLite so data survives across browsers & devices.
//
// Storage model (mirrors the Prisma schema):
//   - AppSettings blob (profileId = "webdevice:<id>")  → canonical JSON snapshot
//   - Addon rows                                        → per-addon mirror
//   - LibraryItem rows                                  → watchlist + continue-watching mirror
// GET prefers the blob; if no blob exists the snapshot is reconstructed from the tables.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEVICE_RE = /^[A-Za-z0-9_-]{8,64}$/;
const MAX_SNAPSHOT_BYTES = 4_000_000; // 4 MB cap (history is capped client-side too)

type LocalCwEntry = {
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
  t: number;
};

type WatchlistEntry = {
  id: string;
  type: string;
  name: string;
  poster?: string;
  releaseInfo?: string;
  imdbRating?: string;
  t: number;
};

type AddonRecordSlim = {
  transportUrl: string;
  enabled: boolean;
  order: number;
  probe?: {
    ok: boolean;
    resource?: string;
    count?: number;
    ms?: number;
    error?: string;
    probedAt: number;
  } | null;
  manifest: {
    id: string;
    name: string;
    version?: string;
    logo?: string;
    description?: string;
    types?: string[];
    catalogs?: unknown[];
    resources?: unknown[];
    idPrefixes?: string[];
    background?: string;
    contactEmail?: string;
    behaviorHints?: Record<string, unknown>;
    flags?: Record<string, unknown>;
    [k: string]: unknown;
  };
};

type UserListItem = {
  id: string;
  type: string;
  name: string;
  poster?: string;
  releaseInfo?: string;
  imdbRating?: string;
  addedAt: number;
};

type UserList = {
  id: string;
  name: string;
  description?: string;
  items: UserListItem[];
  createdAt: number;
  updatedAt: number;
};

type Snapshot = {
  v: 1;
  settings: unknown | null;
  addons: AddonRecordSlim[] | null;
  cw: Record<string, LocalCwEntry>;
  watchlist: WatchlistEntry[];
  history: unknown[];
  userThemes: unknown | null;
  lists: UserList[];
  updatedAt: string;
};

const EMPTY: Snapshot = {
  v: 1,
  settings: null,
  addons: null,
  cw: {},
  watchlist: [],
  history: [],
  userThemes: null,
  lists: [],
  updatedAt: new Date(0).toISOString(),
};

function sanitizeLists(raw: unknown): UserList[] {
  if (!Array.isArray(raw)) return [];
  const out: UserList[] = [];
  for (const l of raw.slice(0, 40)) {
    const rec = l as Partial<UserList>;
    if (!rec || typeof rec.id !== "string" || typeof rec.name !== "string" || !Array.isArray(rec.items)) continue;
    out.push({
      id: rec.id.slice(0, 64),
      name: rec.name.slice(0, 80),
      description: typeof rec.description === "string" ? rec.description.slice(0, 200) : undefined,
      items: (rec.items as UserListItem[]).slice(0, 300),
      createdAt: typeof rec.createdAt === "number" ? rec.createdAt : Date.now(),
      updatedAt: typeof rec.updatedAt === "number" ? rec.updatedAt : Date.now(),
    });
  }
  return out;
}

function deviceKey(device: string): string {
  return `webdevice:${device}`;
}

function sanitizeSnapshot(raw: unknown): Snapshot {
  const s = (raw ?? {}) as Partial<Snapshot>;
  const out: Snapshot = { ...EMPTY, updatedAt: new Date().toISOString() };
  out.settings = s.settings ?? null;
  out.userThemes = s.userThemes ?? null;
  out.addons = Array.isArray(s.addons)
    ? (s.addons as AddonRecordSlim[]).slice(0, 60).map((a) => ({
        ...a,
        // Keep the health-probe result honest: only well-shaped objects survive.
        probe: sanitizeProbe(a?.probe),
      }))
    : null;
  out.cw = s.cw && typeof s.cw === "object" && !Array.isArray(s.cw) ? (s.cw as Record<string, LocalCwEntry>) : {};
  out.watchlist = Array.isArray(s.watchlist) ? (s.watchlist as WatchlistEntry[]) : [];
  out.history = Array.isArray(s.history) ? s.history.slice(0, 500) : [];
  out.lists = sanitizeLists(s.lists);
  return out;
}

// ---------- GET: pull snapshot ----------
export async function GET(req: NextRequest): Promise<NextResponse> {
  const device = req.nextUrl.searchParams.get("device") ?? "";
  if (!DEVICE_RE.test(device)) {
    return NextResponse.json({ error: "invalid device id" }, { status: 400 });
  }
  const pid = deviceKey(device);
  try {
    const [blob, addons, library, listRows] = await Promise.all([
      db.appSettings.findUnique({ where: { profileId: pid } }),
      db.addon.findMany({ where: { profileId: pid }, orderBy: { order: "asc" } }),
      db.libraryItem.findMany({ where: { profileId: pid } }),
      db.customList.findMany({ where: { profileId: pid }, orderBy: { updatedAt: "desc" } }),
    ]);

    let snap: Snapshot;
    if (blob) {
      try {
        snap = sanitizeSnapshot(JSON.parse(blob.data));
      } catch {
        snap = { ...EMPTY };
      }
    } else {
      snap = { ...EMPTY };
    }

    // Reconstruct from mirrors when the blob is missing/empty but rows exist
    const hasBlobData =
      snap.settings !== null ||
      snap.addons !== null ||
      Object.keys(snap.cw).length > 0 ||
      snap.watchlist.length > 0 ||
      snap.lists.length > 0;
    if (!hasBlobData && (addons.length > 0 || library.length > 0 || listRows.length > 0)) {
      snap.addons = addons.map((a) => {
        // Rebuild the manifest object from the mirrored columns (the Prisma
        // model stores manifest fields separately, not as one JSON blob).
        const manifest: AddonRecordSlim["manifest"] = {
          id: a.id.startsWith(`${pid}:`) ? a.id.slice(pid.length + 1) : a.id,
          name: a.name,
          version: a.version ?? undefined,
          logo: a.logo ?? undefined,
          description: a.description ?? undefined,
          background: a.background ?? undefined,
          contactEmail: a.contactEmail ?? undefined,
          types: safeJson<string[]>(a.types, []),
          catalogs: safeJson<unknown[]>(a.catalogs, []),
          resources: safeJson<unknown[]>(a.resources, []),
          idPrefixes: safeJson<string[] | null>(a.idPrefixes, null) ?? undefined,
          behaviorHints:
            safeJson<Record<string, unknown> | null>(a.behaviorHints, null) ?? undefined,
          flags: safeJson<Record<string, unknown> | null>(a.flags, null) ?? undefined,
        };
        return {
          transportUrl: a.transportUrl,
          enabled: a.enabled,
          order: a.order,
          probe: a.probeOk === null ? undefined : {
            ok: a.probeOk,
            resource: a.probeResource ?? undefined,
            count: a.probeCount ?? undefined,
            ms: a.probeMs ?? undefined,
            error: a.probeError ?? undefined,
            probedAt: a.probedAt ? a.probedAt.getTime() : Date.now(),
          },
          manifest,
        };
      });
      for (const item of library) {
        const state = safeJson<{ cw?: LocalCwEntry | null; watchlist?: WatchlistEntry | null } | null>(item.state, null);
        if (state?.cw) {
          snap.cw[state.cw.id] = state.cw;
        }
        if (state?.watchlist) {
          snap.watchlist.push(state.watchlist);
        } else if (!state?.cw) {
          // Legacy row: fields only, no state payloads
          snap.watchlist.push({
            id: item.itemId,
            type: item.type,
            name: item.name,
            poster: item.poster ?? undefined,
            releaseInfo: item.releaseInfo ?? undefined,
            imdbRating: item.imdbRating ?? undefined,
            t: item.updatedAt.getTime(),
          });
        }
      }
      for (const row of listRows) {
        const parsed = safeJson<UserListItem[] | null>(row.items, null);
        snap.lists.push({
          id: row.id.startsWith(`${pid}:`) ? row.id.slice(pid.length + 1) : row.id,
          name: row.name,
          items: parsed ?? [],
          createdAt: row.createdAt.getTime(),
          updatedAt: row.updatedAt.getTime(),
        });
      }
    }

    return NextResponse.json({
      snapshot: { ...snap, updatedAt: blob?.updatedAt ?? new Date(0).toISOString() },
    });
  } catch (e) {
    console.error("sync GET failed", e);
    return NextResponse.json({ error: "sync read failed" }, { status: 500 });
  }
}

// ---------- POST: push snapshot ----------
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { device?: unknown; snapshot?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const device = typeof body.device === "string" ? body.device : "";
  if (!DEVICE_RE.test(device)) {
    return NextResponse.json({ error: "invalid device id" }, { status: 400 });
  }
  const raw = JSON.stringify(body.snapshot ?? {});
  if (raw.length > MAX_SNAPSHOT_BYTES) {
    return NextResponse.json({ error: "snapshot too large" }, { status: 413 });
  }
  const snap = sanitizeSnapshot(body.snapshot);
  const pid = deviceKey(device);
  const now = new Date();

  try {
    // 1) Canonical blob
    await db.appSettings.upsert({
      where: { profileId: pid },
      create: { profileId: pid, data: JSON.stringify(snap) },
      update: { data: JSON.stringify(snap) },
    });

    // 2) Mirror addons (replace-all per device)
    const incoming = (snap.addons ?? []).slice(0, 60);
    await db.addon.deleteMany({ where: { profileId: pid } });
    if (incoming.length > 0) {
      await db.addon.createMany({
        data: incoming.map((a, i) => ({
          id: `${pid}:${a.manifest.id}`,
          transportUrl: a.transportUrl,
          name: a.manifest.name,
          version: a.manifest.version ?? null,
          logo: a.manifest.logo ?? null,
          description: (a.manifest.description ?? null)?.slice(0, 1000) ?? null,
          background: a.manifest.background ?? null,
          contactEmail: a.manifest.contactEmail ?? null,
          types: JSON.stringify(a.manifest.types ?? []),
          catalogs: JSON.stringify(a.manifest.catalogs ?? []),
          resources: JSON.stringify(a.manifest.resources ?? []),
          idPrefixes: a.manifest.idPrefixes ? JSON.stringify(a.manifest.idPrefixes) : null,
          behaviorHints: a.manifest.behaviorHints ? JSON.stringify(a.manifest.behaviorHints) : null,
          flags: a.manifest.flags ? JSON.stringify(a.manifest.flags) : null,
          enabled: a.enabled !== false,
          profileId: pid,
          order: typeof a.order === "number" ? a.order : i,
          probeOk: a.probe ? a.probe.ok : null,
          probeResource: a.probe?.resource ?? null,
          probeCount: a.probe?.count ?? null,
          probeMs: a.probe?.ms ?? null,
          probeError: a.probe?.error ?? null,
          probedAt: a.probe?.probedAt ? new Date(a.probe.probedAt) : null,
        })),
      });
    }

    // 3) Mirror library (watchlist + CW, merged per item so ids stay unique).
    // An item can be in the watchlist AND continue-watching at the same time;
    // both payloads are stored in the same row's state JSON.
    await db.libraryItem.deleteMany({ where: { profileId: pid } });
    type LibDraft = {
      itemId: string;
      type: string;
      name: string;
      poster: string | null;
      background: string | null;
      releaseInfo: string | null;
      imdbRating: string | null;
      watchlist?: WatchlistEntry;
      cw?: LocalCwEntry;
    };
    const libById = new Map<string, LibDraft>();
    for (const w of snap.watchlist.slice(0, 500)) {
      const existing = libById.get(w.id);
      if (existing) {
        existing.watchlist = w;
        continue;
      }
      libById.set(w.id, {
        itemId: w.id,
        type: w.type,
        name: w.name,
        poster: w.poster ?? null,
        background: null,
        releaseInfo: w.releaseInfo ?? null,
        imdbRating: w.imdbRating ?? null,
        watchlist: w,
      });
    }
    for (const c of Object.values(snap.cw).slice(0, 60)) {
      const existing = libById.get(c.id);
      if (existing) {
        existing.cw = c;
        existing.background = c.background ?? existing.background;
        continue;
      }
      libById.set(c.id, {
        itemId: c.id,
        type: c.type,
        name: c.name,
        poster: c.poster ?? null,
        background: c.background ?? null,
        releaseInfo: null,
        imdbRating: null,
        cw: c,
      });
    }
    const libRows = Array.from(libById.values()).map((d) => ({
      id: `${pid}:${d.itemId}`,
      profileId: pid,
      itemId: d.itemId,
      type: d.type,
      name: d.name,
      poster: d.poster,
      background: d.background,
      releaseInfo: d.releaseInfo,
      imdbRating: d.imdbRating,
      state: JSON.stringify({ watchlist: d.watchlist ?? null, cw: d.cw ?? null }),
      watched: false,
      lastWatched: d.cw ? new Date(d.cw.t || now.getTime()) : null,
    }));
    if (libRows.length > 0) {
      await db.libraryItem.createMany({ data: libRows });
    }

    // 4) Mirror custom lists (replace-all per device)
    await db.customList.deleteMany({ where: { profileId: pid } });
    if (snap.lists.length > 0) {
      await db.customList.createMany({
        data: snap.lists.slice(0, 40).map((l) => ({
          id: `${pid}:${l.id}`,
          profileId: pid,
          name: l.name,
          items: JSON.stringify(l.items.slice(0, 300)),
          createdAt: new Date(l.createdAt || now.getTime()),
          updatedAt: new Date(l.updatedAt || now.getTime()),
        })),
      });
    }

    return NextResponse.json({ ok: true, updatedAt: now.toISOString() });
  } catch (e) {
    console.error("sync POST failed", e);
    return NextResponse.json({ error: "sync write failed" }, { status: 500 });
  }
}

function safeJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

function sanitizeProbe(raw: unknown): AddonRecordSlim["probe"] {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Partial<NonNullable<AddonRecordSlim["probe"]>>;
  if (typeof r.ok !== "boolean" || typeof r.probedAt !== "number") return undefined;
  return {
    ok: r.ok,
    resource: typeof r.resource === "string" ? r.resource.slice(0, 20) : undefined,
    count: typeof r.count === "number" ? Math.min(1_000_000, Math.max(0, Math.round(r.count))) : undefined,
    ms: typeof r.ms === "number" ? Math.min(600_000, Math.max(0, Math.round(r.ms))) : undefined,
    error: typeof r.error === "string" ? r.error.slice(0, 200) : undefined,
    probedAt: r.probedAt,
  };
}
