// Harbor Web — Stremio addon protocol types
// Ported from Harbor desktop (src/lib/addons.ts, cinemeta.ts, streams/*)

export type CatalogExtra = {
  name: string;
  isRequired?: boolean;
  options?: string[];
  optionsLimit?: number;
};

export type CatalogDef = {
  id: string;
  type: string;
  name: string;
  genres?: string[];
  extra?: CatalogExtra[];
  extraSupported?: string[];
  extraRequired?: string[];
};

export type AddonResource =
  | string
  | { name: string; types?: string[]; idPrefixes?: string[] };

export type Manifest = {
  id: string;
  name: string;
  version?: string;
  description?: string;
  logo?: string;
  background?: string;
  contactEmail?: string;
  types?: string[];
  catalogs?: CatalogDef[];
  resources?: AddonResource[];
  idPrefixes?: string[];
  behaviorHints?: {
    adult?: boolean;
    p2p?: boolean;
    configurable?: boolean;
    configurationRequired?: boolean;
  };
};

export type Addon = {
  manifest: Manifest;
  transportUrl: string;
  installedAt?: number;
  enabled?: boolean;
  flags?: { official?: boolean; protected?: boolean };
};

export type MetaLink = { name: string; category: string; url: string };

export type MetaVideo = {
  id: string;
  name?: string;
  title?: string;
  /** Display name carried through episode-switch flows (switchEpisode → UpNext). */
  episodeName?: string;
  released?: string;
  season?: number;
  episode?: number;
  thumb?: string;
  overview?: string;
  description?: string;
  duration?: string;
  firstAired?: number;
  tvdbId?: string;
  videos?: MetaVideo[];
  streams?: Stream[];
  mood?: string[];
};

export type Meta = {
  id: string;
  type: string;
  name: string;
  releaseInfo?: string;
  poster?: string;
  background?: string;
  logo?: string;
  description?: string;
  runtime?: string;
  imdbRating?: string;
  genres?: string[];
  cast?: string[];
  director?: string[];
  writer?: string[];
  country?: string;
  awards?: string;
  trailers?: { source: string; type: string }[];
  trailer?: string;
  trailerStreams?: { source: string; type: string }[];
  videos?: MetaVideo[];
  links?: MetaLink[];
  behaviorHints?: { defaultVideoId?: string; hasScheduledVideos?: boolean };
  runtimeFormat?: string;
  popularities?: Record<string, number>;
  // Harbor-web extensions
  addonOrigin?: { id: string; name: string; logo?: string; base: string };
};

export type Stream = {
  url?: string;
  infoHash?: string;
  fileIdx?: number;
  title?: string;
  description?: string;
  behaviorHints?: {
    notWebReady?: boolean;
    proxyHeaders?: { request?: Record<string, string>; response?: Record<string, string> };
    filename?: string;
    videoSize?: number;
    bingeGroup?: string;
    openInBrowser?: boolean;
  };
  sources?: string[];
  subtitles?: { id?: string; url: string; lang?: string; label?: string }[];
  // Harbor-web parsed extensions
  addonId?: string;
  addonName?: string;
  addonUrl?: string;
  parsed?: ParsedStreamInfo;
  score?: number;
  cached?: Record<string, boolean>;
  /** Set when picked for playback via the server-side P2P torrent engine. */
  p2p?: { key: string; fileIdx: number; infoHash: string; mode: "native" | "remux" | "unknown" };
};

export type ParsedStreamInfo = {
  filename?: string;
  resolution?: string; // 4K | 1080p | 720p | 480p | SD
  hdrFormat?: string; // HDR10 | HDR10+ | DV
  codec?: string;
  source?: string; // BluRay | WEB-DL | CAM ...
  audioCodec?: string;
  audioChannels?: string;
  size?: number; // bytes
  seeders?: number;
  releaseGroup?: string;
  languages?: string[];
};

export type RawSubtitle = {
  id?: string;
  url: string;
  lang?: string;
  m?: string; // message / label
  format?: string;
  fps?: string;
  encoding?: string;
  // OpenSubtitles v3 mirror fields
  subtitleFileName?: string;
  movieReleaseName?: string;
  // SubSense / OpenSubtitles-v3-pro style fields
  label?: string;
  title?: string;
  fileName?: string;
  releaseName?: string;
  source?: string;
  ai_translated?: boolean | string;
  from_trusted?: boolean | string;
  // Harbor Web: display name of the addon (or mirror) this entry came from
  addonName?: string;
};

export type SubtitleResult = RawSubtitle & {
  provider?: string;
  release?: string;
  hi?: boolean;
};

export type ParseOpts = { query?: string; genre?: string; skip?: number; [k: string]: unknown };

export type LibraryItemState = {
  timeOffset?: number;
  duration?: number;
  season?: number;
  episode?: number;
  video_id?: string;
  timeWatched?: number;
  flaggedWatched?: number;
  watched?: string; // stremio bitfield
  lastWatched?: number;
  overallTimeWatched?: number;
  lastVidTimeWatched?: number;
};

// ---- Stremio account API ----
export type StremioUser = {
  _id: string;
  email?: string;
  fullname?: string;
  avatar?: string | null;
};

export type StremioAuth = { authKey: string; user: StremioUser };

export type CloudLibraryItem = {
  _id: string;
  type: string;
  name: string;
  poster?: string;
  background?: string;
  logo?: string;
  releaseInfo?: string;
  imdbRating?: string;
  state?: LibraryItemState;
  removed?: boolean;
  temp?: boolean;
  _ctime?: string;
  _mtime?: string;
  favorite?: boolean;
};

// ---- CW card shape (from Harbor continue-watching.ts) ----
export type CwCard = {
  id: string;
  type: string;
  name: string;
  poster?: string;
  background?: string;
  season?: number;
  episode?: number;
  videoId?: string;
  /** Saved by the player when known (LocalCwEntry.episodeName). */
  episodeName?: string;
  progress: number; // 0..1
};

export function parseAddonUrl(input: string): string {
  let url = input.trim();
  url = url.replace(/^stremio:\/\//, "https://");
  url = url.replace(/\/configure\/?$/, "");
  url = url.replace(/\/+$/, "");
  if (!url.endsWith("manifest.json")) url = `${url}/manifest.json`;
  // Normalize percent-encoded config separators (%7C → |): Torrentio and friends expect a
  // literal pipe in the config path. A pasted manifest URL that already contains %7C would
  // otherwise reach the addon still encoded (our proxy is byte-faithful) and silently
  // return zero streams. Structural percent-escapes (%3A, %2F, …) are preserved.
  const qIdx = url.indexOf("?");
  const base = qIdx === -1 ? url : url.slice(0, qIdx);
  const query = qIdx === -1 ? "" : url.slice(qIdx);
  try {
    url = decodeURI(base) + query;
  } catch {
    /* keep original on malformed escape */
  }
  return url;
}

export function addonBaseFromTransport(transportUrl: string): string {
  return transportUrl.replace(/\/manifest\.json.*$/, "").replace(/\/+$/, "");
}

export function buildResourceUrl(
  base: string,
  resource: string,
  type: string,
  id: string,
  extras?: ParseOpts,
): string {
  let path = `${base}/${resource}/${type}/${encodeURIComponent(id)}`;
  if (extras && Object.keys(extras).length > 0) {
    const parts = Object.entries(extras)
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join("&") : String(v)}`);
    if (parts.length > 0) path += `/${parts.join("&")}`;
  }
  return `${path}.json`;
}

export function addonAccepts(
  addon: Addon,
  resource: string,
  type: string,
  id: string,
): boolean {
  const m = addon.manifest;
  if (m.id === "prefetch") return false;
  const res = m.resources ?? [];
  let matchesResource = false;
  let objectForm = false;
  for (const r of res) {
    if (typeof r === "string") {
      if (r === resource) matchesResource = true;
    } else {
      objectForm = true;
      if (r.name === resource) {
        const types = r.types ?? m.types ?? [];
        if (types.length === 0 || types.includes(type)) {
          if (
            r.idPrefixes &&
            r.idPrefixes.length > 0 &&
            !r.idPrefixes.some((p) => id.startsWith(p))
          ) {
            continue;
          }
          matchesResource = true;
        }
      }
    }
  }
  if (objectForm && res.some((r) => typeof r === "string")) {
    // mixed form: string match already handled
  }
  if (!matchesResource) return false;
  if (res.some((r) => typeof r === "string")) {
    const types = m.types ?? [];
    if (types.length > 0 && !types.includes(type) && resource !== "manifest") return false;
    const prefixes = m.idPrefixes ?? [];
    if (
      prefixes.length > 0 &&
      !prefixes.some((p) => id.startsWith(p)) &&
      resource !== "manifest"
    )
      return false;
  }
  return true;
}
