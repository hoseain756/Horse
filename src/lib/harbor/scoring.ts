// Harbor Web — stream parsing & scoring (TypeScript port of harbor-core parser.rs/scoring.rs, condensed)
import { Stream, ParsedStreamInfo } from "./types";

const RES_PATTERNS: [RegExp, string][] = [
  [/\b(2160p|4k|uhd)\b/i, "4K"],
  [/\b(1080p|1080i|fhd)\b/i, "1080p"],
  [/\b(720p|hd)\b/i, "720p"],
  [/\b(480p|sd)\b/i, "480p"],
];

const HDR_PATTERNS: [RegExp, string][] = [
  [/\b(dv|dolmy ?vision|dolby[\s-]?vision|do ?vi)\b/i, "DV"],
  [/\b(hdr10\+|hdrplus)\b/i, "HDR10+"],
  [/\bhdr\b/i, "HDR10"],
];

const CODEC_PATTERNS: [RegExp, string][] = [
  [/\b(hevc|h\.?265|x265)\b/i, "HEVC"],
  [/\b(av1)\b/i, "AV1"],
  [/\b(vp9)\b/i, "VP9"],
  [/\b(x264|h\.?264|avc)\b/i, "AVC"],
];

const SOURCE_PATTERNS: [RegExp, string][] = [
  [/\bremux\b/i, "REMUX"],
  [/\bblu-?ray\b|\bbdrip\b|\bbdmv\b/i, "BluRay"],
  [/\bweb[\s-]?dl\b/i, "WEB-DL"],
  [/\bweb[\s-]?rip\b|\bweb\b/i, "WEBRip"],
  [/\bdvd-?rip\b|\bdvdr\b/i, "DVDRip"],
  [/\bhdtv\b/i, "HDTV"],
  [/\bhdts\b|\btelesync\b|\bts\b/i, "TS"],
  [/\bcam\b|\bhdcam\b|\btelecine\b/i, "CAM"],
  [/\bscreener\b|\bscr\b/i, "SCR"],
];

const AUDIO_PATTERNS: [RegExp, string][] = [
  [/\batmos\b/i, "Atmos"],
  [/\btrue[\s-]?hd\b|\bthd\b/i, "TrueHD"],
  [/\bdts-?hd(\s?ma)?\b|\bdts\b/i, "DTS"],
  [/\b(e-?ac-?3|dd\+|ddp|dolby digital plus)\b/i, "DD+"],
  [/\bac-?3\b|\bdd\b(?!p)\b/i, "AC3"],
  [/\baac\b/i, "AAC"],
  [/\bflac\b/i, "FLAC"],
  [/\bopus\b/i, "Opus"],
];

const SIZE_RE = /(\d+(?:\.\d+)?)\s?(gb|gib|mb|mib)\b/i;
const SEEDERS_RE = /(?:👤|S:|\bseeders?:)\s*(\d[\d,.]*)/i;
const RELEASE_GROUP_RE = /[.[{(\-\[ ]([a-z0-9]{3,})[\])}\]]?$/i;

export function parseStreamFilename(stream: Stream): string {
  if (stream.behaviorHints?.filename) return stream.behaviorHints.filename;
  const desc = stream.description ?? "";
  const firstLine = desc.split("\n").find((l) => l.trim().length > 0) ?? "";
  const title = stream.title ?? "";
  // Prefer the line that looks like a filename
  for (const candidate of [title, firstLine]) {
    if (/\.(mkv|mp4|avi|ts|m2ts|mov|wmv|flv|webm)\b/i.test(candidate)) {
      const m = candidate.match(/[\w\-. ]+\.(?:mkv|mp4|avi|ts|m2ts|mov|wmv|flv|webm)/i);
      if (m) return m[0];
    }
  }
  return title || firstLine;
}

export function parseStreamInfo(stream: Stream): ParsedStreamInfo {
  const filename = parseStreamFilename(stream);
  const text = `${filename} ${stream.title ?? ""} ${stream.description ?? ""}`;

  let resolution = "SD";
  for (const [re, label] of RES_PATTERNS) {
    if (re.test(text)) {
      resolution = label;
      break;
    }
  }
  let hdrFormat: string | undefined;
  for (const [re, label] of HDR_PATTERNS) {
    if (re.test(text)) {
      hdrFormat = label;
      break;
    }
  }
  let codec: string | undefined;
  for (const [re, label] of CODEC_PATTERNS) {
    if (re.test(text)) {
      codec = label;
      break;
    }
  }
  let source: string | undefined;
  for (const [re, label] of SOURCE_PATTERNS) {
    if (re.test(text)) {
      source = label;
      break;
    }
  }
  let audioCodec: string | undefined;
  for (const [re, label] of AUDIO_PATTERNS) {
    if (re.test(text)) {
      audioCodec = label;
      break;
    }
  }
  let audioChannels: string | undefined;
  const chMatch = text.match(/\b([579].[01])\b/);
  if (chMatch) audioChannels = chMatch[1];

  let size: number | undefined;
  const sizeMatch = text.match(SIZE_RE);
  if (sizeMatch) {
    const n = parseFloat(sizeMatch[1]);
    const unit = sizeMatch[2].toLowerCase();
    if (!Number.isNaN(n)) {
      if (unit === "gb" || unit === "gib") size = n * 1024 ** 3;
      else if (unit === "mb" || unit === "mib") size = n * 1024 ** 2;
      else if (unit === "tb" || unit === "tib") size = n * 1024 ** 4;
    }
  }
  if (!size && stream.behaviorHints?.videoSize) size = stream.behaviorHints.videoSize;

  let seeders: number | undefined;
  const seedMatch = text.match(SEEDERS_RE);
  if (seedMatch) {
    seeders = parseInt(seedMatch[1].replace(/[,.]/g, ""), 10);
    if (Number.isNaN(seeders)) seeders = undefined;
  }

  let releaseGroup: string | undefined;
  const rgMatch = filename.match(RELEASE_GROUP_RE);
  if (rgMatch && rgMatch[1] && !/^(mkv|mp4|avi|ts|web-?dl|bluray|hevc|x264|x265)$/i.test(rgMatch[1])) {
    releaseGroup = rgMatch[1].toUpperCase();
  }

  return {
    filename: filename || undefined,
    resolution,
    hdrFormat,
    codec,
    source,
    audioCodec,
    audioChannels,
    size,
    seeders,
    releaseGroup,
  };
}

// ---------- Trust filter (condensed from harbor-core trust.rs) ----------
const BAD_EXTENSIONS = /\.(exe|zip|rar|7z|lnk|scr|bat|iso|img|dll)\b/i;
const PLACEHOLDER_RE = /no (streams?|video) (available|found)|none available|0 streams/i;

export function trustFilter(stream: Stream): { keep: boolean; reason?: string } {
  const filename = stream.behaviorHints?.filename ?? "";
  if (PLACEHOLDER_RE.test(stream.title ?? "") || PLACEHOLDER_RE.test(stream.description ?? "")) {
    return { keep: false, reason: "placeholder" };
  }
  if (BAD_EXTENSIONS.test(filename)) return { keep: false, reason: "executable" };
  if (stream.url === "#") return { keep: false, reason: "not-configured" };
  const size = stream.parsed?.size ?? stream.behaviorHints?.videoSize;
  if (size !== undefined && size < 5 * 1024 * 1024 && !stream.url) {
    return { keep: false, reason: "stub" };
  }
  return { keep: true };
}

// ---------- Scoring (condensed from harbor-core scoring.rs) ----------
export type ScoreOptions = {
  preferredAddonId?: string;
  preferHevc?: boolean;
};

export function scoreStream(stream: Stream, opts: ScoreOptions = {}): number {
  const p = stream.parsed;
  if (!p) return 0;
  let score = 0;

  // Cached/direct
  const hasUrl = !!stream.url && stream.url !== "#";
  const cachedAny = stream.cached && Object.values(stream.cached).some(Boolean);
  if (cachedAny) score += 60;
  else if (hasUrl) score += 25;

  // Resolution
  switch (p.resolution) {
    case "4K": score += 25; break;
    case "1080p": score += 20; break;
    case "720p": score += 8; break;
    case "480p": score += 2; break;
  }

  // HDR
  if (p.hdrFormat === "DV") score += 6;
  else if (p.hdrFormat) score += 5;

  // Codec
  if (p.codec === "HEVC" || p.codec === "AV1") score += 1;

  // Audio
  if (p.audioCodec === "Atmos") score += 3;
  else if (p.audioCodec === "TrueHD" || p.audioCodec === "DTS") score += 2;
  else if (p.audioCodec === "DD+") score += 1;
  if (p.audioChannels && parseInt(p.audioChannels[0], 10) >= 6) score += 2;

  // Seeders
  if (p.seeders !== undefined && !cachedAny) {
    score += Math.min(Math.floor(p.seeders / 10), 10);
    if (p.seeders === 0 && stream.infoHash) score -= 15;
  }

  // Release group
  if (p.releaseGroup && TRUSTED_GROUPS.has(p.releaseGroup)) score += 2;
  if (p.source === "REMUX") score += 3;

  // Penalties
  switch (p.source) {
    case "CAM": score -= 80; break;
    case "TS": score -= 60; break;
    case "SCR": score -= 40; break;
  }
  if (p.size) {
    if (p.resolution === "4K" && p.size < 1.5 * 1024 ** 3) score -= 60;
    if (p.resolution === "1080p" && p.size < 0.5 * 1024 ** 3) score -= 40;
  }

  // Not web ready penalty (needs transcode in browser)
  if (stream.behaviorHints?.notWebReady) score -= 30;

  if (opts.preferredAddonId && stream.addonId === opts.preferredAddonId) score += 250;

  return score;
}

const TRUSTED_GROUPS = new Set([
  "FRDS", "FLUX", "EVO", "JUDAS", "EMBER", "ERAI", "SMURF", "HONE", "NTb", "RTFM",
  "CHD", "WEBDL", "D-Z0N3", "SaM", "GECKOS", "PEPINO", "CREEPSHOW", "SPiRiT", "KOGi",
]);

export function tierOf(stream: Stream): string {
  const p = stream.parsed;
  if (!p) return "OTHER";
  if (p.source === "CAM" || p.source === "TS" || p.source === "SCR") return "ROUGH";
  const isHdr = !!p.hdrFormat;
  if (p.resolution === "4K") return isHdr ? "4K HDR" : "4K";
  if (p.resolution === "1080p") return isHdr ? "1080p HDR" : "1080p";
  if (p.resolution === "720p") return "720p";
  return "SD";
}

export const TIER_ORDER = ["4K HDR", "4K", "1080p HDR", "1080p", "720p", "SD", "ROUGH", "OTHER"];

export function runPipeline(streams: Stream[], opts: ScoreOptions = {}): Stream[] {
  const enriched = streams
    .map((s) => ({ ...s, parsed: s.parsed ?? parseStreamInfo(s) }))
    .filter((s) => {
      const t = trustFilter(s);
      return t.keep;
    })
    .map((s) => ({ ...s, score: scoreStream(s, opts) }));
  // stable sort: score desc, addon order preserved within ties
  return enriched.map((s, i) => ({ s, i }))
    .sort((a, b) => (b.s.score ?? 0) - (a.s.score ?? 0) || a.i - b.i)
    .map((x) => x.s);
}

export function formatSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)} MB`;
  return `${bytes} B`;
}

// Browser-playability check for a stream
export function isPlayableInBrowser(stream: Stream): boolean {
  if (!stream.url) return false; // torrents require WebTorrent (not bundled)
  if (stream.behaviorHints?.notWebReady) return true; // may still play via transcode proxy; allow attempt
  return true;
}
