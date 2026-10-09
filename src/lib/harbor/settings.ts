// Harbor Web — settings schema (ported/condensed from Harbor desktop src/lib/settings/*)
"use client";

import { DEFAULT_THEME, ActiveTheme } from "./themes";

export type Settings = {
  // Basics
  profileId: string;
  region: string;
  preferredLanguages: string[];
  uiLanguage: string;

  // Home
  homeMode: "harbor" | "classic";
  homeShowAllAddonRows: boolean;
  hideWatchedInCatalogs: boolean;

  // API keys (client-held; AI routed through server)
  tmdbKey: string;
  opensubtitlesEnabled: boolean;

  // TMDB metadata enrichment (server holds env creds; user key is optional)
  tmdbEnabled: boolean;
  tmdbLanguage: string;
  tmdbImageQuality: "low" | "medium" | "high";
  tmdbUserKey: string;

  // Ratings providers (Feature: ratings row on detail pages)
  ratingsProviders: string[]; // enabled provider ids in display order
  ratingsEnabled: boolean;

  // Badges
  showImdbBadge: boolean;
  showMalBadge: boolean;
  showQualityBadge: boolean;
  showCardBadges: boolean;
  cardBadgeLimit: number;

  // Poster look
  posterScale: number;
  posterRadius: number;
  hidePosterTitles: boolean;
  posterEffect: "blur" | "fade" | "off";

  // Episodes section (detail page)
  /** Episode list layout: auto = list on phones, grid on wider containers. */
  episodesView: "auto" | "list" | "grid";
  /** Spoiler protection: blur thumbnails of unwatched episodes. */
  blurEpisodeThumbnails: boolean;

  // Player
  instantPlay: boolean;
  autoPlayNextEpisode: boolean;
  resumePlayback: boolean;
  resumePrompt: boolean;
  playerConfirmLeave: boolean;
  seekBackStepSec: number;
  seekForwardStepSec: number;
  subFontSize: number;
  subFontColor: string;
  subBorderColor: string;
  subBorderSize: number;
  subBackgroundOpacity: number;
  subStyle: "shadow" | "outline" | "box";
  preferredSubLangs: string[];
  subtitlesOffByDefault: boolean;
  customPlaybackSpeeds: number[];
  showQualityInfo: boolean;
  videoFill: "fit" | "fill" | "zoom";
  playerTheme: "auto" | "default" | "stremio";

  // Streaming picker
  pickerLayout: "condensed" | "stremio";
  streamSort: "score" | "addon";
  // P2P torrent engine (server-side webtorrent)
  p2pEnabled: boolean;
  // In-browser torrent engine (WebTorrent/WebRTC — zero install). The user's
  // browser becomes the engine: one switch, no app, no hosting. Honest limits
  // documented in the P2P card (web peers only, no MKV/HEVC remux).
  browserEngineEnabled: boolean;

  // Playback pipeline (secure media proxy + conversion)
  /** When the media proxy kicks in: auto (probe), always, or never. */
  proxyMode: "auto" | "always" | "never";
  /** Convert incompatible streams: auto, ask (prompt first), never. */
  transcodeMode: "auto" | "ask" | "never";
  /** Picker default: only streams that can play in this browser. */
  playableOnly: boolean;
  /** Prefer H.264/AAC releases over HEVC when ranking the picker. */
  preferH264: boolean;

  // Kids
  /** Poster card size in Kids Corner. */
  kidsCardSize: "large" | "medium" | "small";

  // Library
  librarySort: "recent" | "title" | "year";
  libraryBookmarkedOnly: boolean;

  // Content visibility
  hideContent: { anime: boolean; liveTv: boolean; adult: boolean };

  // Kids
  kidsMode: boolean;

  // Theme
  theme: ActiveTheme;
  /** M3 dynamic-color appearance (light/dark scheme of the same seed) */
  appearance: "dark" | "light";
  /** M3 contrast level for the generated scheme */
  contrastLevel: "standard" | "medium" | "high";

  // Navigation customization
  navOrder: string[];
  navHidden: string[];
  navRenamed: Record<string, string>;

  // Glass dock (bottom nav) + Settings Quick Access hub
  /** Persisted order of Settings Quick Access entries (hub entry ids). */
  hubOrder: string[];
  /** Hidden Settings Quick Access entries (hub entry ids). */
  hubHidden: string[];
  /** Auto-hide the glass dock when scrolling down, reveal on scroll up. */
  dockAutoHide: boolean;
  /** Side rail (≥1024px): auto-hide at the inline-start edge and reveal on
   *  intent (edge hover / handle tap / focus). When false the compact rail is
   *  always visible. The rail has ONE compact form (A1 — no expanded mode). */
  railAutoHide: boolean;

  // IPTV
  iptvPlaylists: { id: string; name: string; url: string }[];

  // AI
  aiEnabled: boolean;
  aiStyle: "concise" | "playful";

  // Misc
  soundTheme: "none" | "modern" | "cinematic";
  wrappedButton: boolean;

  // Cloud
  cloudSyncEnabled: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  profileId: "default",
  region: "US",
  preferredLanguages: ["English"],
  uiLanguage: "en",

  homeMode: "harbor",
  homeShowAllAddonRows: false,
  hideWatchedInCatalogs: false,

  tmdbKey: "",
  opensubtitlesEnabled: true,

  tmdbEnabled: true,
  tmdbLanguage: "en-US",
  tmdbImageQuality: "medium",
  tmdbUserKey: "",

  ratingsEnabled: true,
  ratingsProviders: [], // empty = registry default order

  showImdbBadge: true,
  showMalBadge: true,
  showQualityBadge: true,
  showCardBadges: true,
  cardBadgeLimit: 3,

  posterScale: 1,
  posterRadius: 12,
  hidePosterTitles: false,
  posterEffect: "off",

  episodesView: "auto",
  blurEpisodeThumbnails: false,

  instantPlay: true,
  autoPlayNextEpisode: true,
  resumePlayback: true,
  resumePrompt: false,
  playerConfirmLeave: true,
  seekBackStepSec: 10,
  seekForwardStepSec: 10,
  subFontSize: 28,
  subFontColor: "#FFFFFF",
  subBorderColor: "#000000",
  subBorderSize: 0,
  subBackgroundOpacity: 0.35,
  subStyle: "shadow",
  preferredSubLangs: ["English"],
  subtitlesOffByDefault: false,
  customPlaybackSpeeds: [],
  showQualityInfo: false,
  videoFill: "fit",
  playerTheme: "auto",

  pickerLayout: "stremio",
  streamSort: "addon",
  p2pEnabled: true,
  // Zero-install path stays OFF until the user explicitly opts in (it uses
  // their bandwidth and only reaches web-peer swarms — consent required).
  browserEngineEnabled: false,

  proxyMode: "auto",
  transcodeMode: "ask",
  // Playable-only default ON: the picker hides streams this browser+server
  // cannot play (counted, with a "Show all" toggle) instead of teasing
  // torrents that would fail after pressing play on serverless hosts.
  playableOnly: true,
  preferH264: true,

  kidsCardSize: "medium",

  librarySort: "recent",
  libraryBookmarkedOnly: true,

  hideContent: { anime: false, liveTv: false, adult: true },
  kidsMode: false,

  theme: DEFAULT_THEME,
  appearance: "dark",
  contrastLevel: "standard",

  navOrder: [],
  navHidden: [],
  navRenamed: {},

  hubOrder: [],
  hubHidden: [],
  dockAutoHide: true,
  railAutoHide: true,

  iptvPlaylists: [],

  aiEnabled: true,
  aiStyle: "concise",

  soundTheme: "none",
  wrappedButton: true,

  cloudSyncEnabled: true,
};

const STORAGE_KEY = "harbor-web.settings";

export function loadSettings(): Settings {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return sanitizeSettings(parsed);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function sanitizeSettings(s: Partial<Settings>): Settings {
  const out: Settings = { ...DEFAULT_SETTINGS, ...s };
  // Deep-merge objects that must never be partially undefined
  out.theme = { ...DEFAULT_THEME, ...(s.theme ?? {}) };
  if (out.appearance !== "light" && out.appearance !== "dark") out.appearance = "dark";
  if (out.contrastLevel !== "standard" && out.contrastLevel !== "medium" && out.contrastLevel !== "high")
    out.contrastLevel = "standard";
  out.hideContent = { ...DEFAULT_SETTINGS.hideContent, ...(s.hideContent ?? {}) };
  if (!Array.isArray(out.preferredLanguages)) out.preferredLanguages = ["English"];
  if (!Array.isArray(out.customPlaybackSpeeds)) out.customPlaybackSpeeds = [];
  if (!Array.isArray(out.iptvPlaylists)) out.iptvPlaylists = [];
  if (!Array.isArray(out.navOrder)) out.navOrder = [];
  if (!Array.isArray(out.navHidden)) out.navHidden = [];
  if (!out.navRenamed || typeof out.navRenamed !== "object") out.navRenamed = {};
  if (!Array.isArray(out.hubOrder)) out.hubOrder = [];
  if (!Array.isArray(out.hubHidden)) out.hubHidden = [];
  out.dockAutoHide = out.dockAutoHide !== false;
  out.railAutoHide = out.railAutoHide !== false;
  // Migration: the expanded rail mode was removed (A1) — drop the stale key
  // so old persisted payloads do not resurrect dead UI state.
  delete (out as Partial<Settings> & { railExpanded?: boolean }).railExpanded;
  out.posterScale = clampNum(out.posterScale, 0.6, 1.6, 1);
  out.posterRadius = clampNum(out.posterRadius, 0, 28, 12);
  if (out.episodesView !== "list" && out.episodesView !== "grid") out.episodesView = "auto";
  out.blurEpisodeThumbnails = out.blurEpisodeThumbnails === true;
  out.subFontSize = clampNum(out.subFontSize, 12, 64, 28);
  out.subBorderSize = clampNum(out.subBorderSize, 0, 10, 0);
  out.subBackgroundOpacity = clampNum(out.subBackgroundOpacity, 0, 1, 0.35);
  out.seekBackStepSec = clampNum(out.seekBackStepSec, 5, 60, 10);
  out.seekForwardStepSec = clampNum(out.seekForwardStepSec, 5, 60, 10);
  out.cardBadgeLimit = clampNum(out.cardBadgeLimit, 0, 6, 3);
  if (!/^[0-9A-Fa-f]{6}$/.test(out.subFontColor)) out.subFontColor = "#FFFFFF";
  if (!/^[0-9A-Fa-f]{6}$/.test(out.subBorderColor)) out.subBorderColor = "#000000";
  out.cloudSyncEnabled = out.cloudSyncEnabled !== false;
  out.p2pEnabled = out.p2pEnabled !== false;
  out.browserEngineEnabled = out.browserEngineEnabled === true;
  if (out.proxyMode !== "auto" && out.proxyMode !== "always" && out.proxyMode !== "never") out.proxyMode = "auto";
  if (out.transcodeMode !== "auto" && out.transcodeMode !== "ask" && out.transcodeMode !== "never") out.transcodeMode = "ask";
  out.playableOnly = out.playableOnly !== false;
  out.preferH264 = out.preferH264 !== false;
  if (out.kidsCardSize !== "large" && out.kidsCardSize !== "medium" && out.kidsCardSize !== "small") out.kidsCardSize = "medium";
  // Legacy migration: older builds stored sizes under a removed generic key —
  // ignore unknown values safely (defaults already applied above).
  out.tmdbEnabled = out.tmdbEnabled !== false;
  out.tmdbLanguage = typeof out.tmdbLanguage === "string" && /^[a-z]{2}(-[A-Z]{2})?$/.test(out.tmdbLanguage) ? out.tmdbLanguage : "en-US";
  if (out.tmdbImageQuality !== "low" && out.tmdbImageQuality !== "medium" && out.tmdbImageQuality !== "high") out.tmdbImageQuality = "medium";
  out.tmdbUserKey = typeof out.tmdbUserKey === "string" ? out.tmdbUserKey.slice(0, 400) : "";
  out.ratingsEnabled = out.ratingsEnabled !== false;
  if (!Array.isArray(out.ratingsProviders)) out.ratingsProviders = [];
  out.ratingsProviders = out.ratingsProviders.filter((p) => typeof p === "string").slice(0, 12);
  return out;
}

function clampNum(v: unknown, min: number, max: number, dflt: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? v : dflt;
  return Math.min(max, Math.max(min, n));
}

export function saveSettings(s: Settings): void {
  if (typeof window === "undefined") return;
  try {
    // backgroundImage can be large; persist it separately in IndexedDB-less localStorage under cap
    const clone: Settings = { ...s };
    if (clone.theme.backgroundImage && clone.theme.backgroundImage.length > 2_000_000) {
      clone.theme = { ...clone.theme, backgroundImage: null };
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(clone));
  } catch {
    // quota exceeded — drop background image and retry
    try {
      const clone = { ...s, theme: { ...s.theme, backgroundImage: null } };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(clone));
    } catch {
      /* ignore */
    }
  }
}
