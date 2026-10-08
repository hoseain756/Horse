// Harbor Web — theme engine (ported from Harbor desktop src/lib/theme.ts)
// M3 MIGRATION (foundation round): the color LAYER is now Material Design 3 —
// applyTheme derives the full md.sys color role set from the theme's seed via
// @material/material-color-utilities (see src/lib/harbor/md3/*) and writes it
// alongside the legacy Harbor semantic vars, which are re-derived FROM the M3
// roles. Everything downstream (bg-canvas, text-ink, bg-accent utilities,
// glass/bokeh/poster/TV-focus sections in globals.css) keeps working untouched.
// Layout / card-style / button-style / fonts / background image / user themes /
// share codes are UNCHANGED.

import { applyMd3Scheme, type MdThemeEnv } from "./md3/apply";

export type CustomColors = {
  canvas: string;
  surface: string;
  elevated: string;
  raised: string;
  ink: string;
  inkMuted: string;
  inkSubtle: string;
  edge: string;
  accent: string;
  danger: string;
};

export type CardStyle = "flat" | "glass" | "stremio" | "crunch" | "noir" | "glossy";
export type ButtonStyle = "flat" | "crunch" | "noir" | "glossy";

export type ThemePreset = {
  id: string;
  name: string;
  layout: ThemeLayout;
  cardStyle?: CardStyle;
  buttonStyle?: ButtonStyle;
  fontPair: FontPairId;
  bokeh?: boolean;
  accent: string;
  canvas: string;
  swatch: string[];
  featured?: boolean;
  beta?: boolean;
};

export type ThemeLayout =
  | "sidebar"
  | "stremio"
  | "topdock"
  | "rail"
  | "dracula"
  | "nord"
  | "forest"
  | "royal";

export type FontPairId =
  | "sentient-switzer"
  | "fraunces-inter"
  | "general-sans"
  | "cabinet-switzer"
  | "plex"
  | "plus-jakarta"
  | "system";

export const FONT_PAIRS: Record<FontPairId, { name: string; display: string; sans: string }> = {
  "sentient-switzer": {
    name: "Sentient / Switzer",
    display: "'Sentient', 'Georgia', serif",
    sans: "'Switzer', 'Inter', system-ui, sans-serif",
  },
  "fraunces-inter": {
    name: "Fraunces / Inter",
    display: "'Fraunces', 'Georgia', serif",
    sans: "'Inter', system-ui, sans-serif",
  },
  "general-sans": {
    name: "General Sans",
    display: "'General Sans', 'Inter', system-ui, sans-serif",
    sans: "'General Sans', 'Inter', system-ui, sans-serif",
  },
  "cabinet-switzer": {
    name: "Cabinet / Switzer",
    display: "'Cabinet Grotesk', 'Inter', system-ui, sans-serif",
    sans: "'Switzer', 'Inter', system-ui, sans-serif",
  },
  plex: {
    name: "IBM Plex",
    display: "'IBM Plex Serif', Georgia, serif",
    sans: "'IBM Plex Sans', system-ui, sans-serif",
  },
  "plus-jakarta": {
    name: "Plus Jakarta",
    display: "'Plus Jakarta Sans', system-ui, sans-serif",
    sans: "'Plus Jakarta Sans', system-ui, sans-serif",
  },
  system: {
    name: "System",
    display: "system-ui, sans-serif",
    sans: "system-ui, sans-serif",
  },
};

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "cool-grey",
    name: "Horse",
    layout: "sidebar",
    cardStyle: "flat",
    buttonStyle: "flat",
    fontPair: "sentient-switzer",
    accent: "oklch(0.78 0.13 60)",
    canvas: "oklch(0.18 0.004 260)",
    swatch: ["#181a20", "#7dd3fc"],
  },
  {
    id: "nord",
    name: "Nord",
    layout: "nord",
    fontPair: "general-sans",
    accent: "#88c0d0",
    canvas: "#2e3440",
    swatch: ["#2e3440", "#88c0d0"],
  },
  {
    id: "stremio",
    name: "Stremio",
    layout: "stremio",
    cardStyle: "stremio",
    fontPair: "plus-jakarta",
    accent: "#7b5bf5",
    canvas: "#0c0b11",
    swatch: ["#0c0b11", "#7b5bf5"],
  },
  {
    id: "crunch",
    name: "Crunchy",
    layout: "topdock",
    cardStyle: "crunch",
    buttonStyle: "crunch",
    fontPair: "plus-jakarta",
    accent: "#ff640a",
    canvas: "#000000",
    swatch: ["#000000", "#ff640a"],
  },
  {
    id: "tokyo-night",
    name: "Royal",
    layout: "royal",
    fontPair: "general-sans",
    accent: "#f08032",
    canvas: "#0c1118",
    swatch: ["#0c1118", "#f08032"],
  },
  {
    id: "dracula",
    name: "Dracula",
    layout: "dracula",
    fontPair: "general-sans",
    accent: "#bd93f9",
    canvas: "#282a36",
    swatch: ["#282a36", "#bd93f9"],
  },
  {
    id: "forest",
    name: "Forest",
    layout: "forest",
    fontPair: "sentient-switzer",
    accent: "#6fbf73",
    canvas: "#141a14",
    swatch: ["#141a14", "#6fbf73"],
  },
  {
    id: "noir",
    name: "Noir",
    layout: "topdock",
    cardStyle: "noir",
    buttonStyle: "noir",
    fontPair: "general-sans",
    accent: "#ffffff",
    canvas: "#000000",
    swatch: ["#000000", "#ffffff"],
  },
  {
    id: "aurora",
    name: "Aurora",
    layout: "topdock",
    cardStyle: "glass",
    buttonStyle: "glossy",
    fontPair: "fraunces-inter",
    bokeh: true,
    accent: "#7ae0c3",
    canvas: "#06090f",
    swatch: ["#06090f", "#7ae0c3"],
    featured: true,
  },
  {
    id: "velvet",
    name: "Velvet",
    layout: "rail",
    fontPair: "fraunces-inter",
    accent: "#d46a9e",
    canvas: "#120b12",
    swatch: ["#120b12", "#d46a9e"],
  },
  {
    id: "minui",
    name: "MinUI",
    layout: "rail",
    cardStyle: "flat",
    fontPair: "system",
    accent: "#e8e2d6",
    canvas: "#101010",
    swatch: ["#101010", "#e8e2d6"],
    featured: true,
  },
];

export type ActiveTheme = {
  preset: string; // ThemePresetId | "custom" | "user:*"
  customColors: CustomColors | null;
  fontPair: FontPairId;
  customFontId?: string | null;
  backgroundImage: string | null; // dataURL
  backgroundDim: number; // 0..1
  // Theme Studio extensions (used when preset === "custom")
  customLayout?: ThemeLayout | null;
  customCardStyle?: CardStyle | null;
  customButtonStyle?: ButtonStyle | null;
  customName?: string | null;
};

export const DEFAULT_THEME: ActiveTheme = {
  preset: "cool-grey",
  customColors: null,
  fontPair: "sentient-switzer",
  customFontId: null,
  backgroundImage: null,
  backgroundDim: 0.65,
  customLayout: null,
  customCardStyle: null,
  customButtonStyle: null,
  customName: null,
};

function oklchToTokens(accent: string, canvas: string): CustomColors {
  return {
    canvas,
    surface: canvas,
    elevated: canvas,
    raised: canvas,
    ink: "#f4f4f6",
    inkMuted: "#b8bac2",
    inkSubtle: "#8f929c",
    edge: "rgba(255,255,255,0.14)",
    accent,
    danger: "#ef4444",
  };
}

export function presetTokens(presetId: string): { colors: CustomColors; preset: ThemePreset } | null {
  const preset = THEME_PRESETS.find((t) => t.id === presetId);
  if (!preset) return null;
  const colors = oklchToTokens(preset.accent, preset.canvas);
  // Lighten elevated surfaces per-preset flavor
  if (preset.id === "nord") {
    colors.surface = "#333b4a";
    colors.elevated = "#3b4252";
    colors.raised = "#434c5e";
  } else if (preset.id === "stremio") {
    colors.surface = "#151319";
    colors.elevated = "#1b1922";
    colors.raised = "#221f2b";
  } else if (preset.id === "dracula") {
    colors.surface = "#2f313f";
    colors.elevated = "#343746";
    colors.raised = "#3b3e4e";
  } else if (preset.id === "forest") {
    colors.surface = "#1a231a";
    colors.elevated = "#202b20";
    colors.raised = "#263326";
  } else if (preset.id === "tokyo-night") {
    colors.surface = "#111823";
    colors.elevated = "#161e2c";
    colors.raised = "#1c2536";
  } else if (preset.id === "crunch" || preset.id === "noir") {
    colors.surface = "#0a0a0a";
    colors.elevated = "#111111";
    colors.raised = "#181818";
    colors.edge = "rgba(255,255,255,0.16)";
  } else if (preset.id === "cool-grey") {
    colors.surface = "oklch(0.22 0.005 260)";
    colors.elevated = "oklch(0.26 0.006 260)";
    colors.raised = "oklch(0.31 0.007 260)";
  } else if (preset.id === "aurora") {
    colors.surface = "#0b1119";
    colors.elevated = "#101826";
    colors.raised = "#152033";
  } else if (preset.id === "velvet") {
    colors.surface = "#181018";
    colors.elevated = "#201422";
    colors.raised = "#28192c";
  } else if (preset.id === "minui") {
    colors.surface = "#161616";
    colors.elevated = "#1d1d1d";
    colors.raised = "#252525";
    colors.ink = "#e8e2d6";
    colors.inkMuted = "#a8a296";
  }
  return { colors, preset };
}

export function customColorsToTokens(c: CustomColors): Record<string, string> {
  const edge =
    c.edge.startsWith("#") && (c.edge.length === 7 || c.edge.length === 9)
      ? hexToRgba(c.edge, 0.16)
      : c.edge;
  // Translucent accent tint (22%). Hex accents get a plain rgba; any other
  // color syntax (oklch presets, custom themes) goes through color-mix so
  // bg-accent-soft stays a TINT — a solid accent here made text-accent icons
  // and labels invisible on every accent-soft chip in the app.
  const accentSoft =
    c.accent.startsWith("#") && (c.accent.length === 7 || c.accent.length === 9)
      ? hexToRgba(c.accent, 0.22)
      : `color-mix(in srgb, ${c.accent} 22%, transparent)`;
  // Tailwind v4 `@theme inline` maps utilities to the `-var` suffixed custom
  // properties (e.g. --color-canvas-var), so the engine overrides those.
  return {
    "--color-canvas-var": c.canvas,
    "--color-surface-var": c.surface,
    "--color-elevated-var": c.elevated,
    "--color-raised-var": c.raised,
    "--color-ink-var": c.ink,
    "--color-ink-muted-var": c.inkMuted,
    "--color-ink-subtle-var": c.inkSubtle,
    "--color-edge-var": edge,
    "--color-edge-soft-var": edge,
    "--color-accent-var": c.accent,
    "--color-accent-soft-var": accentSoft,
    "--color-danger-var": c.danger,
  };
}

export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6 && h.length !== 8) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function isValidColor(c: string): boolean {
  const s = c.trim();
  if (/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(s)) return true;
  if (/^(rgba?|hsla?|oklch|oklab|color)\(/i.test(s)) return true;
  return false;
}

/**
 * Apply a theme. `env` carries the M3 scheme knobs (appearance / contrast /
 * kids re-seed); callers that don't pass it get the classic dark scheme.
 * Custom themes keep their EXACT tuned colors on the legacy vars (Theme Studio
 * compatibility) while the M3 role layer is derived from their seeds.
 */
export function applyTheme(theme: ActiveTheme, env?: MdThemeEnv): void {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  let colors: CustomColors | null = null;
  let layout: ThemeLayout = "sidebar";
  let bokeh = false;
  let fontPair = theme.fontPair;

  const preset = THEME_PRESETS.find((t) => t.id === theme.preset);
  if (theme.preset === "custom" && theme.customColors && isValidThemeColors(theme.customColors)) {
    colors = theme.customColors;
    layout = theme.customLayout ?? "sidebar";
  } else if (preset) {
    const t = presetTokens(preset.id);
    if (t) colors = t.colors;
    layout = preset.layout;
    bokeh = !!preset.bokeh;
    fontPair = preset.fontPair ?? theme.fontPair;
  } else {
    const fallback = presetTokens("cool-grey");
    if (fallback) colors = fallback.colors;
  }

  // ---- M3 layer (colors): full md.sys role set + re-derived legacy aliases
  const schemeEnv: MdThemeEnv = env ?? { appearance: "dark", contrast: "standard" };
  const isCustom = theme.preset === "custom" && !!theme.customColors;
  const accentSeed = isCustom && colors ? colors.accent : (preset?.accent ?? null);
  const canvasSeed = isCustom && colors ? colors.canvas : (preset?.canvas ?? null);
  applyMd3Scheme(html, accentSeed, canvasSeed, schemeEnv);

  // Custom themes: honor the user's EXACT tuned colors on the legacy vars so
  // Theme Studio's 10-color picker still has the final word.
  if (isCustom && colors) {
    const tokens = customColorsToTokens(colors);
    for (const [k, v] of Object.entries(tokens)) html.style.setProperty(k, v);
  }

  html.dataset.themeLayout = layout;
  html.dataset.themeCard =
    theme.preset === "custom" ? (theme.customCardStyle ?? "flat") : (preset?.cardStyle ?? "flat");
  html.dataset.themeButton =
    theme.preset === "custom"
      ? (theme.customButtonStyle ?? "flat")
      : (preset?.buttonStyle ?? "flat");
  html.dataset.themeBokeh = bokeh ? "on" : "off";
  const pair = FONT_PAIRS[fontPair] ?? FONT_PAIRS["sentient-switzer"];
  html.style.setProperty("--font-display-var", pair.display);
  html.style.setProperty("--font-sans-var", pair.sans);
  if (theme.backgroundImage) {
    html.style.setProperty("--theme-bg-image", `url("${theme.backgroundImage}")`);
    html.style.setProperty("--theme-bg-dim", String(theme.backgroundDim));
  } else {
    html.style.removeProperty("--theme-bg-image");
  }
}

export function isValidThemeColors(c: CustomColors): boolean {
  return Object.values(c).every((v) => typeof v === "string" && isValidColor(v));
}

export function nextColorTheme(current: string): string {
  const ids = THEME_PRESETS.filter((t) => t.id !== "crunch").map((t) => t.id);
  const idx = ids.indexOf(current);
  return ids[(idx + 1) % ids.length] ?? "cool-grey";
}

// ---------- Theme Studio: saved user themes ----------

export type UserTheme = {
  id: string;
  name: string;
  colors: CustomColors;
  fontPair: FontPairId;
  layout: ThemeLayout;
  cardStyle: CardStyle;
  buttonStyle: ButtonStyle;
  t: number;
};

const USER_THEMES_KEY = "harbor-web.user-themes";

export function loadUserThemes(): UserTheme[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(USER_THEMES_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as UserTheme[];
    if (!Array.isArray(arr)) return [];
    return arr.filter((t) => t && typeof t.id === "string" && t.colors && isValidThemeColors(t.colors));
  } catch {
    return [];
  }
}

function writeUserThemes(themes: UserTheme[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(USER_THEMES_KEY, JSON.stringify(themes.slice(0, 24)));
  } catch {
    /* ignore */
  }
}

export function putUserTheme(theme: Omit<UserTheme, "t">): UserTheme[] {
  const list = loadUserThemes().filter((t) => t.id !== theme.id);
  const next = [{ ...theme, t: Date.now() }, ...list];
  writeUserThemes(next);
  return next;
}

export function deleteUserTheme(id: string): UserTheme[] {
  const next = loadUserThemes().filter((t) => t.id !== id);
  writeUserThemes(next);
  return next;
}

// ---------- Theme sharing via URL ----------
// Shareable codes encode everything except the background image (dataURLs are
// too large for a URL). Format: hbtheme1.<base64url JSON>

const SHARE_PREFIX = "hbtheme1.";

export type ShareableTheme = Pick<
  ActiveTheme,
  "preset" | "customColors" | "fontPair" | "customLayout" | "customCardStyle" | "customButtonStyle" | "customName"
> & { backgroundDim?: number };

export function encodeThemeShare(theme: ActiveTheme): string | null {
  try {
    const payload: ShareableTheme = {
      preset: theme.preset,
      customColors: theme.customColors,
      fontPair: theme.fontPair,
      customLayout: theme.customLayout ?? null,
      customCardStyle: theme.customCardStyle ?? null,
      customButtonStyle: theme.customButtonStyle ?? null,
      customName: theme.customName ?? null,
      backgroundDim: theme.backgroundDim,
    };
    const json = JSON.stringify(payload);
    const b64 =
      typeof btoa === "function"
        ? btoa(String.fromCharCode(...new TextEncoder().encode(json)))
        : Buffer.from(json, "utf-8").toString("base64");
    return SHARE_PREFIX + b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  } catch {
    return null;
  }
}

const LAYOUTS: ThemeLayout[] = ["sidebar", "stremio", "topdock", "rail", "dracula", "nord", "forest", "royal"];
const CARD_STYLES: CardStyle[] = ["flat", "glass", "stremio", "crunch", "noir", "glossy"];
const BUTTON_STYLES: ButtonStyle[] = ["flat", "crunch", "noir", "glossy"];

export function decodeThemeShare(code: string): ActiveTheme | null {
  try {
    const trimmed = code.trim();
    const b64part = trimmed.startsWith(SHARE_PREFIX)
      ? trimmed.slice(SHARE_PREFIX.length)
      : trimmed.includes("hbtheme1.")
        ? trimmed.split("hbtheme1.")[1]
        : null;
    if (!b64part) return null;
    const b64 = b64part.replace(/-/g, "+").replace(/_/g, "/");
    const json =
      typeof atob === "function"
        ? new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)))
        : Buffer.from(b64, "base64").toString("utf-8");
    const raw = JSON.parse(json) as Partial<ShareableTheme>;
    const preset = typeof raw.preset === "string" ? raw.preset : null;
    if (!preset) return null;
    const fontPair = (raw.fontPair && raw.fontPair in FONT_PAIRS ? raw.fontPair : "sentient-switzer") as FontPairId;
    const customLayout = raw.customLayout && LAYOUTS.includes(raw.customLayout) ? raw.customLayout : null;
    const customCardStyle = raw.customCardStyle && CARD_STYLES.includes(raw.customCardStyle) ? raw.customCardStyle : null;
    const customButtonStyle =
      raw.customButtonStyle && BUTTON_STYLES.includes(raw.customButtonStyle) ? raw.customButtonStyle : null;
    const customColors =
      raw.customColors && typeof raw.customColors === "object" && isValidThemeColors(raw.customColors as CustomColors)
        ? (raw.customColors as CustomColors)
        : null;
    // Custom themes must carry valid colors; presets are self-describing
    if (preset === "custom" && !customColors) return null;
    const knownPreset = THEME_PRESETS.some((t) => t.id === preset);
    if (!knownPreset && preset !== "custom" && !preset.startsWith("user:")) return null;
    return {
      preset,
      customColors,
      fontPair,
      customFontId: null,
      backgroundImage: null, // intentionally not shared
      backgroundDim:
        typeof raw.backgroundDim === "number" && raw.backgroundDim >= 0 && raw.backgroundDim <= 1
          ? raw.backgroundDim
          : 0.65,
      customLayout,
      customCardStyle,
      customButtonStyle,
      customName: typeof raw.customName === "string" ? raw.customName.slice(0, 40) : null,
    };
  } catch {
    return null;
  }
}
