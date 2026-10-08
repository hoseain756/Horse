// Harbor Web — addon health probe
// Verifies an addon actually answers a declared resource with real data, so users
// can validate pasted manifest URLs (streams / subtitles / catalogs) in one click.
import { proxyFetch } from "./api";
import { addonAccepts, addonBaseFromTransport, buildResourceUrl } from "./types";
import type { Addon, Manifest } from "./types";

export type ProbeResult = {
  ok: boolean;
  resource?: "stream" | "subtitles" | "catalog";
  count?: number;
  ms?: number;
  error?: string;
};

/** ProbeResult plus when it was taken (epoch ms) — persisted per addon record. */
export type StoredProbe = ProbeResult & { probedAt: number };

export function sanitizeStoredProbe(raw: unknown): StoredProbe | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Partial<StoredProbe>;
  if (typeof r.ok !== "boolean") return undefined;
  const resource =
    r.resource === "stream" || r.resource === "subtitles" || r.resource === "catalog"
      ? r.resource
      : undefined;
  return {
    ok: r.ok,
    resource,
    count: typeof r.count === "number" ? r.count : undefined,
    ms: typeof r.ms === "number" ? r.ms : undefined,
    error: typeof r.error === "string" ? r.error.slice(0, 200) : undefined,
    probedAt: typeof r.probedAt === "number" && r.probedAt > 0 ? r.probedAt : Date.now(),
  };
}

// The Shawshank Redemption — near-universally indexed sample id (tt prefix)
const SAMPLE_MOVIE = "tt0111161";

function resourceSupported(manifest: Manifest, resource: string, id = SAMPLE_MOVIE): boolean {
  // Cheap check reusing the protocol rules (idPrefixes / types / object form)
  return addonAccepts({ manifest } as Addon, resource, "movie", id);
}

export function describeProbe(name: string, r: ProbeResult): { title: string; body: string } {
  if (r.ok) {
    const noun =
      r.resource === "stream" ? "streams" : r.resource === "subtitles" ? "subtitles" : "catalog items";
    return {
      title: `${name} is healthy`,
      body: `Responded with ${r.count ?? 0} ${noun} in ${((r.ms ?? 0) / 1000).toFixed(1)}s`,
    };
  }
  return {
    title: `${name} did not respond`,
    body: r.error ?? "The addon's resource endpoint timed out or returned an error.",
  };
}

export async function probeAddon(transportUrl: string, manifest: Manifest): Promise<ProbeResult> {
  const base = addonBaseFromTransport(transportUrl);
  const t0 = Date.now();
  const has = (r: string) =>
    (manifest.resources ?? []).some((x) => (typeof x === "string" ? x === r : x.name === r));

  try {
    if (has("stream") && resourceSupported(manifest, "stream")) {
      const d = await proxyFetch<{ streams?: unknown[] }>(
        buildResourceUrl(base, "stream", "movie", SAMPLE_MOVIE),
      );
      const streams = d.streams ?? [];
      if (streams.length === 0) return { ok: false, resource: "stream", ms: Date.now() - t0, error: "Endpoint replied with zero streams." };
      return { ok: true, resource: "stream", count: streams.length, ms: Date.now() - t0 };
    }
    if (has("subtitles") && resourceSupported(manifest, "subtitles")) {
      const d = await proxyFetch<{ subtitles?: unknown[] }>(
        buildResourceUrl(base, "subtitles", "movie", SAMPLE_MOVIE),
      );
      const subs = d.subtitles ?? [];
      if (subs.length === 0) return { ok: false, resource: "subtitles", ms: Date.now() - t0, error: "Endpoint replied with zero subtitles." };
      return { ok: true, resource: "subtitles", count: subs.length, ms: Date.now() - t0 };
    }
    const catalog = (manifest.catalogs ?? [])[0];
    if (catalog) {
      // Catalogs with extraRequired (genre/search) can't be probed without args —
      // a plain page request still proves reachability for those.
      const d = await proxyFetch<{ metas?: unknown[] }>(
        buildResourceUrl(base, "catalog", catalog.type ?? "movie", catalog.id ?? "top"),
      );
      const metas = d.metas ?? [];
      if (metas.length === 0) return { ok: false, resource: "catalog", ms: Date.now() - t0, error: "Endpoint replied with zero catalog items." };
      return { ok: true, resource: "catalog", count: metas.length, ms: Date.now() - t0 };
    }
    if (has("meta") && resourceSupported(manifest, "meta")) {
      const d = await proxyFetch<{ meta?: unknown }>(buildResourceUrl(base, "meta", "movie", SAMPLE_MOVIE));
      if (!d.meta) return { ok: false, ms: Date.now() - t0, error: "Meta endpoint replied without a meta object." };
      return { ok: true, resource: "catalog", count: 1, ms: Date.now() - t0 };
    }
    return { ok: false, error: "Manifest declares no testable resources (stream/subtitles/catalog/meta)." };
  } catch (e) {
    return {
      ok: false,
      ms: Date.now() - t0,
      error: e instanceof Error ? e.message : "Request failed",
    };
  }
}
