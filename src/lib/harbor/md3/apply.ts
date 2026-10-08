// Harbor Web — M3 theme applier: computes the md.sys color roles from the
// active theme's seed(s) and writes them (plus the legacy Harbor semantic
// aliases) onto <html>. Single writer for all color CSS custom properties.
// The legacy Harbor vars (--color-*-var) are RE-DERIVED from M3 roles so every
// existing bg-canvas/text-ink/bg-accent utility inherits the M3 palette.
import { argbFromHex, buildMd3Colors, parseColorToArgb, type MdAppearance, type MdContrast } from "./color";

export const BASELINE_SEED = "#b57ee0"; // M3 baseline purple, Harbor-tuned
export const KIDS_SEED = "#f472b6"; // legacy kids accent — now seeds the WHOLE scheme

export type MdThemeEnv = {
  appearance: MdAppearance;
  contrast: MdContrast;
  kids?: boolean;
};

/** Map the generated M3 roles onto the legacy Harbor semantic variables. */
export function harborAliasesFromRoles(r: Record<string, string>): Record<string, string> {
  return {
    "--color-canvas-var": r.surface,
    "--color-surface-var": r.surfaceContainerLow,
    "--color-elevated-var": r.surfaceContainer,
    "--color-raised-var": r.surfaceContainerHigh,
    "--color-ink-var": r.onSurface,
    "--color-ink-muted-var": r.onSurfaceVariant,
    "--color-ink-subtle-var": r.outline,
    "--color-edge-var": r.outlineVariant,
    "--color-edge-soft-var": `color-mix(in srgb, ${r.outlineVariant} 55%, transparent)`,
    "--color-accent-var": r.primary,
    // M3 container role replaces the old 22% alpha tint — text-accent on
    // accent-soft chips now pairs primary-on-primary-container (AA+)
    "--color-accent-soft-var": r.primaryContainer,
    "--color-danger-var": r.error,
  };
}

/** Write the full M3 scheme + legacy aliases for the given seeds. Returns the
 * role map (for previews / tests). */
export function applyMd3Scheme(
  html: HTMLElement,
  accentSeedCss: string | null,
  canvasSeedCss: string | null,
  env: MdThemeEnv,
): Record<string, string> {
  const parseSeed = (s: string | null): number | null => (s ? parseColorToArgb(s) : null);
  const seed =
    parseSeed(accentSeedCss) ?? parseSeed(BASELINE_SEED) ?? argbFromHex(BASELINE_SEED);
  const neutralSeed =
    env.kids
      ? parseSeed(KIDS_SEED) ?? seed
      : parseSeed(canvasSeedCss) ?? seed;
  const accent = env.kids ? parseSeed(KIDS_SEED) ?? seed : seed;
  const roles = buildMd3Colors(accent, env.appearance, env.contrast, neutralSeed);

  const set = (k: string, v: string) => html.style.setProperty(k, v);
  for (const [role, value] of Object.entries(roles)) {
    set(`--md-sys-color-${kebab(role)}`, value);
  }
  for (const [k, v] of Object.entries(harborAliasesFromRoles(roles))) set(k, v);

  html.dataset.appearance = env.appearance;
  html.style.colorScheme = env.appearance;
  return roles;
}

function kebab(s: string): string {
  return s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}
