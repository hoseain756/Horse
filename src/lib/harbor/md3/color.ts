// Harbor Web — Material Design 3 color engine (foundation layer)
// Generates the full md.sys.color role set from a seed color using Google's
// @material/material-color-utilities core math (Hct / TonalPalette / hexFromArgb)
// plus the published M3 baseline role→tone tables (developer.material.io /
// MCE MaterialDynamicColors defaults). Supports dark/light schemes and the
// standard/medium/high contrast levels. Pure functions — no DOM here.
import {
  argbFromHex,
  hexFromArgb,
  Hct,
  TonalPalette,
} from "@material/material-color-utilities";

export type MdAppearance = "dark" | "light";
export type MdContrast = "standard" | "medium" | "high";

// ---------- color parsing ----------

/** oklch(L C H) → sRGB bytes (Björn Ottosson's reference math). */
function oklchToRgbBytes(L: number, C: number, Hdeg: number): [number, number, number] {
  const hr = (Hdeg * Math.PI) / 180;
  const a = C * Math.cos(hr);
  const b = C * Math.sin(hr);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  let r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  let g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  let b2 = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const gam = (c: number) => {
    const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return Math.min(255, Math.max(0, Math.round(v * 255)));
  };
  return [gam(r), gam(g), gam(b2)];
}

function bytesToArgb(r: number, g: number, b: number): number {
  return (255 << 24) | (r << 16) | (g << 8) | b;
}

/** Parse any CSS color the app actually stores (hex / rgb() / oklch()) → ARGB.
 * Returns null for unparsable input so callers can fall back to the baseline seed. */
export function parseColorToArgb(css: string): number | null {
  const s = (css ?? "").trim().toLowerCase();
  if (!s) return null;
  // hex: #rgb #rgba #rrggbb #rrggbbaa
  const hex = s.match(/^#([0-9a-f]{3,8})$/);
  if (hex) {
    let h = hex[1];
    if (h.length === 3 || h.length === 4) {
      h = h
        .split("")
        .map((c) => c + c)
        .join("");
    }
    if (h.length === 6) h += "ff";
    if (h.length !== 8) return null;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const a = parseInt(h.slice(6, 8), 16);
    return (a << 24) | (r << 16) | (g << 8) | b;
  }
  // rgb()/rgba()
  const rgb = s.match(/^rgba?\(([^)]+)\)$/);
  if (rgb) {
    const parts = rgb[1].split(/[,/\s]+/).filter(Boolean).map(Number);
    if (parts.length >= 3 && parts.slice(0, 3).every((n) => Number.isFinite(n))) {
      return bytesToArgb(parts[0], parts[1], parts[2]);
    }
    return null;
  }
  // oklch(L C H)
  const ok = s.match(/^oklch\(([^)]+)\)$/);
  if (ok) {
    const parts = ok[1].split(/[\s/]+/).filter(Boolean);
    const L = parseFloat(parts[0]);
    const C = parseFloat(parts[1]);
    const H = parseFloat(parts[2]);
    if ([L, C, H].every(Number.isFinite)) {
      const [r, g, b] = oklchToRgbBytes(L, C, H);
      return bytesToArgb(r, g, b);
    }
    return null;
  }
  return null;
}

// ---------- M3 palette derivation (MCE tonal-spot formulas) ----------

type MdPalettes = {
  primary: TonalPalette;
  secondary: TonalPalette;
  tertiary: TonalPalette;
  neutral: TonalPalette;
  neutralVariant: TonalPalette;
  error: TonalPalette;
};

const ERROR_PALETTE = TonalPalette.fromHueAndChroma(25, 84);

/** MCE SchemeTonalSpot palette math: primary = seed; secondary clamps chroma
 * down; tertiary rotates hue +60; neutrals take a whisper of the hue. */
function palettesFromSeed(seedArgb: number): MdPalettes {
  const hct = Hct.fromInt(seedArgb);
  const hue = hct.hue;
  const chroma = hct.chroma;
  return {
    primary: TonalPalette.fromHueAndChroma(hue, Math.max(48, chroma)),
    secondary: TonalPalette.fromHueAndChroma(hue, Math.max(Math.round(chroma - 32), 16)),
    tertiary: TonalPalette.fromHueAndChroma(hue + 60, clamp(chroma / 2, 24, 48)),
    neutral: TonalPalette.fromHueAndChroma(hue, Math.max(4, Math.round(chroma / 8))),
    neutralVariant: TonalPalette.fromHueAndChroma(hue, Math.max(6, Math.round(chroma / 8) + 4)),
    error: ERROR_PALETTE,
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

// ---------- role → tone tables (published M3 baseline) ----------

// Tone picks per contrast level [standard, medium, high] (indices 0,1,2).
type Tone3 = [number, number, number];

const DARK: Record<string, Tone3> = {
  primary: [80, 90, 100],
  onPrimary: [20, 14, 10],
  primaryContainer: [30, 24, 18],
  onPrimaryContainer: [90, 94, 98],
  secondary: [80, 88, 96],
  onSecondary: [20, 14, 10],
  secondaryContainer: [30, 24, 18],
  onSecondaryContainer: [90, 94, 98],
  tertiary: [80, 88, 96],
  onTertiary: [20, 14, 10],
  tertiaryContainer: [30, 24, 18],
  onTertiaryContainer: [90, 94, 98],
  error: [80, 90, 100],
  onError: [20, 14, 10],
  errorContainer: [30, 24, 18],
  onErrorContainer: [90, 94, 98],
  surface: [6, 6, 6],
  surfaceDim: [6, 6, 6],
  surfaceBright: [24, 24, 24],
  surfaceContainerLowest: [4, 4, 4],
  surfaceContainerLow: [10, 10, 10],
  surfaceContainer: [12, 12, 12],
  surfaceContainerHigh: [17, 17, 17],
  surfaceContainerHighest: [22, 22, 22],
  onSurface: [90, 94, 98],
  onSurfaceVariant: [80, 85, 90],
  outline: [60, 68, 76],
  outlineVariant: [30, 27, 24],
  inverseSurface: [90, 90, 90],
  inverseOnSurface: [20, 20, 20],
  inversePrimary: [40, 40, 40],
  scrim: [0, 0, 0],
  shadow: [0, 0, 0],
};

const LIGHT: Record<string, Tone3> = {
  primary: [40, 34, 28],
  onPrimary: [100, 100, 100],
  primaryContainer: [90, 86, 80],
  onPrimaryContainer: [10, 8, 6],
  secondary: [40, 34, 28],
  onSecondary: [100, 100, 100],
  secondaryContainer: [90, 86, 80],
  onSecondaryContainer: [10, 8, 6],
  tertiary: [40, 34, 28],
  onTertiary: [100, 100, 100],
  tertiaryContainer: [90, 86, 80],
  onTertiaryContainer: [10, 8, 6],
  error: [40, 34, 28],
  onError: [100, 100, 100],
  errorContainer: [90, 86, 80],
  onErrorContainer: [10, 8, 6],
  surface: [98, 98, 98],
  surfaceDim: [87, 87, 87],
  surfaceBright: [98, 98, 98],
  surfaceContainerLowest: [100, 100, 100],
  surfaceContainerLow: [96, 96, 96],
  surfaceContainer: [94, 94, 94],
  surfaceContainerHigh: [92, 92, 92],
  surfaceContainerHighest: [90, 90, 90],
  onSurface: [10, 9, 8],
  onSurfaceVariant: [30, 26, 22],
  outline: [50, 42, 34],
  outlineVariant: [80, 74, 68],
  inverseSurface: [20, 20, 20],
  inverseOnSurface: [95, 95, 95],
  inversePrimary: [80, 80, 80],
  scrim: [0, 0, 0],
  shadow: [0, 0, 0],
};

export type MdColorRoles = Record<string, string>;

/** Build the complete md.sys.color role map (CSS color strings keyed by
 * lowerCamel M3 role names, i.e. `primaryContainer`).
 *
 * `seedArgb` drives primary/secondary/tertiary; `neutralSeedArgb` (optional)
 * drives neutral/neutral-variant so preset canvases keep their tinted identity
 * (Nord stays blue-grey, Dracula stays purple-grey, …) — an M3-idiomatic
 * two-scheme blend. */
export function buildMd3Colors(
  seedArgb: number,
  appearance: MdAppearance,
  contrast: MdContrast = "standard",
  neutralSeedArgb?: number,
): MdColorRoles {
  const acc = palettesFromSeed(seedArgb);
  const neu = palettesFromSeed(neutralSeedArgb ?? seedArgb);
  const idx = contrast === "high" ? 2 : contrast === "medium" ? 1 : 0;
  const table = appearance === "light" ? LIGHT : DARK;
  const pick = (p: TonalPalette, tones: Tone3): string => hexFromArgb(p.tone(clamp(tones[idx], 0, 100)));

  // Neutral-family roles read from the canvas-tinted neutral palettes;
  // everything else keys off the accent seed palettes.
  const NEUTRAL_KEYS = new Set([
    "surface", "surfaceDim", "surfaceBright",
    "surfaceContainerLowest", "surfaceContainerLow", "surfaceContainer",
    "surfaceContainerHigh", "surfaceContainerHighest",
    "onSurface", "inverseSurface", "inverseOnSurface", "scrim", "shadow",
  ]);
  const NV_KEYS = new Set(["onSurfaceVariant", "outline", "outlineVariant"]);

  const roles: MdColorRoles = {};
  for (const key of Object.keys(table)) {
    const tones = table[key];
    let src: TonalPalette;
    if (NEUTRAL_KEYS.has(key)) src = neu.neutral;
    else if (NV_KEYS.has(key)) src = neu.neutralVariant;
    else if (key.startsWith("error") || key.startsWith("onError")) src = acc.error;
    else if (key.startsWith("primary") || key === "onPrimary" || key === "inversePrimary") src = acc.primary;
    else if (key.startsWith("secondary") || key === "onSecondary") src = acc.secondary;
    else src = acc.tertiary;
    roles[key] = pick(src, tones);
  }
  return roles;
}

/** WCAG relative-luminance contrast ratio for the audit report. */
export function contrastRatio(hexA: string, hexB: string): number {
  const lum = (hex: string) => {
    const argb = parseColorToArgb(hex);
    if (argb == null) return 0;
    const ch = (v: number) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    const r = ch((argb >> 16) & 255);
    const g = ch((argb >> 8) & 255);
    const b = ch(argb & 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const a = lum(hexA);
  const b = lum(hexB);
  const [hi, lo] = a >= b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

export { argbFromHex, hexFromArgb };
