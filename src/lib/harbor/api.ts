// Harbor Web — client API layer: routes all addon/stremio requests through our SSRF-safe backend proxy
"use client";

import type {
  Addon,
  CatalogDef,
  Manifest,
  Meta,
  MetaVideo,
  ParseOpts,
  RawSubtitle,
  Stream,
} from "./types";
import { addonAccepts, addonBaseFromTransport, buildResourceUrl, parseAddonUrl } from "./types";

const TIMEOUT = 12_000;

export async function proxyFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/proxy?url=${encodeURIComponent(url)}`, {
    ...init,
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`proxy ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

// ---------- Manifests ----------
export async function fetchManifest(manifestUrl: string): Promise<{ addon: Addon; url: string }> {
  const url = parseAddonUrl(manifestUrl);
  const manifest = await proxyFetch<Manifest>(url);
  if (!manifest || typeof manifest.id !== "string" || typeof manifest.name !== "string") {
    throw new Error("Invalid addon manifest");
  }
  return { addon: { manifest, transportUrl: url }, url };
}

// ---------- Catalogs ----------
export async function fetchCatalog(
  addon: Addon,
  catalog: CatalogDef,
  extras?: ParseOpts,
): Promise<Meta[]> {
  const base = addonBaseFromTransport(addon.transportUrl);
  const url = buildResourceUrl(base, "catalog", catalog.type, catalog.id, extras);
  const data = await proxyFetch<{ metas?: Meta[] }>(url);
  const metas = data.metas ?? [];
  return metas.map((m) => ({
    ...m,
    addonOrigin: {
      id: addon.manifest.id,
      name: addon.manifest.name,
      logo: addon.manifest.logo,
      base,
    },
  }));
}

export async function fetchCinemetaCatalog(
  type: "movie" | "series",
  catalogId: string,
  extras?: ParseOpts,
): Promise<Meta[]> {
  const base = "https://v3-cinemeta.strem.io";
  const url = buildResourceUrl(base, "catalog", type, catalogId, extras);
  const data = await proxyFetch<{ metas?: Meta[] }>(url);
  return data.metas ?? [];
}

export async function fetchMeta(type: string, id: string): Promise<Meta | null> {
  if (id.startsWith("tmdb:") || /^[0-9]+$/.test(id)) {
    // Try cinemeta by converting tmdb->imdb via cinemeta search is unreliable; fetch directly
    const data = await proxyFetch<{ meta?: Meta }>(
      `https://v3-cinemeta.strem.io/meta/${type}/${encodeURIComponent(id)}.json`,
    );
    return data.meta ?? null;
  }
  const data = await proxyFetch<{ meta?: Meta }>(
    `https://v3-cinemeta.strem.io/meta/${type}/${encodeURIComponent(id)}.json`,
  );
  return data.meta ?? null;
}

export async function fetchAddonMeta(
  addon: Addon,
  type: string,
  id: string,
): Promise<Meta | null> {
  const base = addonBaseFromTransport(addon.transportUrl);
  const url = buildResourceUrl(base, "meta", type, id);
  const data = await proxyFetch<{ meta?: Meta }>(url);
  const meta = data.meta ?? null;
  if (meta) {
    meta.addonOrigin = {
      id: addon.manifest.id,
      name: addon.manifest.name,
      logo: addon.manifest.logo,
      base,
    };
  }
  return meta;
}

// ---------- Streams ----------
/**
 * Default episode for a series opened without an explicit video id.
 * Skips season-0 specials (Cinemeta lists them first; stream addons rarely
 * have torrents for them) and falls back to the first listed video.
 */
export function defaultVideoId(meta: { videos?: MetaVideo[] } | null): string | null {
  const vids = meta?.videos ?? [];
  const real = vids.find(
    (v) => typeof v.season === "number" && v.season >= 1 && typeof v.episode === "number",
  );
  return (real ?? vids[0])?.id ?? null;
}

export async function fetchStreams(
  addons: Addon[],
  type: string,
  id: string,
): Promise<Stream[]> {
  const eligible = addons.filter(
    (a) => a.enabled !== false && addonAccepts(a, "stream", type, id),
  );
  const results = await Promise.allSettled(
    eligible.map(async (addon) => {
      const base = addonBaseFromTransport(addon.transportUrl);
      const url = buildResourceUrl(base, "stream", type, id);
      const data = await proxyFetch<{ streams?: Stream[] }>(url);
      return (data.streams ?? []).map((s) => ({
        ...s,
        addonId: addon.manifest.id,
        addonName: addon.manifest.name,
        addonUrl: base,
      }));
    }),
  );
  const all: Stream[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") all.push(...r.value);
  }
  // dedupe by url/infoHash+fileIdx
  const seen = new Set<string>();
  return all.filter((s) => {
    const key = s.url ?? `hash:${(s.infoHash ?? "").toLowerCase()}:${s.fileIdx ?? "?"}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ---------- Subtitles ----------
export async function fetchSubtitles(
  addons: Addon[],
  type: string,
  id: string,
  videoId?: string,
): Promise<RawSubtitle[]> {
  // OpenSubtitles v3 public mirrors (same as Harbor desktop)
  const mirrorBases = [
    "https://opensubtitles-v3.strem.io",
    "https://opensubtitles.strem.io",
    "https://opensubtitles.stremio.homes",
  ];
  const targetId = videoId ?? id;
  const results = await Promise.allSettled(
    mirrorBases.map((base) =>
      proxyFetch<{ subtitles?: RawSubtitle[] }>(
        `${base}/subtitles/${type}/${encodeURIComponent(targetId)}.json`,
      ),
    ),
  );
  const merged: RawSubtitle[] = [];
  const seen = new Set<string>();
  const push = (s: RawSubtitle, addonName: string) => {
    const key = `${s.lang}|${s.url}`;
    if (seen.has(key)) return;
    seen.add(key);
    merged.push({ ...s, addonName });
  };
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    for (const s of r.value.subtitles ?? []) push(s, "OpenSubtitles");
  }
  // addon subtitles
  const eligible = addons.filter(
    (a) => a.enabled !== false && addonAccepts(a, "subtitles", type, id),
  );
  const addonResults = await Promise.allSettled(
    eligible.map(async (addon) => {
      const base = addonBaseFromTransport(addon.transportUrl);
      const url = buildResourceUrl(base, "subtitles", type, id);
      const data = await proxyFetch<{ subtitles?: RawSubtitle[] }>(url);
      return data.subtitles ?? [];
    }),
  );
  addonResults.forEach((r, i) => {
    if (r.status === "fulfilled") {
      const name = eligible[i]?.manifest.name ?? "Addon";
      for (const s of r.value) push(s, name);
    }
  });
  return merged;
}

// ---------- Search ----------
export async function searchCinemeta(query: string): Promise<{ movies: Meta[]; series: Meta[] }> {
  const [movies, series] = await Promise.allSettled([
    fetchCinemetaCatalog("movie", "top", { search: query }),
    fetchCinemetaCatalog("series", "top", { search: query }),
  ]);
  return {
    movies: movies.status === "fulfilled" ? movies.value.slice(0, 12) : [],
    series: series.status === "fulfilled" ? series.value.slice(0, 12) : [],
  };
}

export async function searchAddonCatalogs(
  addons: Addon[],
  query: string,
  maxCatalogs = 12,
): Promise<Meta[]> {
  const catalogJobs: { addon: Addon; catalog: CatalogDef }[] = [];
  for (const addon of addons) {
    if (addon.enabled === false) continue;
    const catalogs = (addon.manifest.catalogs ?? []).filter(
      (c) =>
        (c.type === "movie" || c.type === "series") &&
        (c.extra ?? []).some((e) => e.name === "search"),
    );
    for (const c of catalogs) {
      if (catalogJobs.length >= maxCatalogs) break;
      catalogJobs.push({ addon, catalog: c });
    }
    if (catalogJobs.length >= maxCatalogs) break;
  }
  const results = await Promise.allSettled(
    catalogJobs.map(({ addon, catalog }) =>
      fetchCatalog(addon, catalog, { search: query }),
    ),
  );
  const merged: Meta[] = [];
  const seen = new Set<string>();
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    for (const m of r.value) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      merged.push(m);
    }
  }
  return merged.slice(0, 20);
}

// ---------- Catalog paging helper ----------
export function parseCatalogStep(metas: unknown[], page: number): number {
  return metas.length > 0 ? metas.length / page : 20;
}
