// Rewrites brand-asset.ts with the exact path, rewrites brand.tsx to import
// from it, and patches share-card.ts header block. Run once:
//   node scripts/inject-horse-path.mjs
import { readFileSync, writeFileSync } from "node:fs";

const D_RAW = readFileSync("/tmp/horse-d.txt", "utf8").trim();
// The SVG d attribute may contain newlines (valid path whitespace, invalid
// inside a JS string literal) — collapse all whitespace runs to single spaces.
const D = D_RAW.replace(/\s+/g, " ");

// 1) brand-asset.ts — single source of truth for the geometry
const asset = `// Horse — raw brand asset data (no JSX, safe for lib + canvas use).
// Geometry extracted verbatim from the user-supplied primary logo
// (upload/horse_logo.svg). Single source of truth for:
//   - src/components/harbor/chrome/brand.tsx (inline SVG mark)
//   - src/lib/harbor/share-card.ts (Path2D canvas rendering)
export const HORSE_VIEWBOX = "0 0 1106 785";
export const HORSE_VB_W = 1106;
export const HORSE_VB_H = 785;
export const HORSE_PATH_D =
  "${D}";
`;
writeFileSync("/home/z/my-project/src/lib/harbor/brand-asset.ts", asset);

// 2) brand.tsx — component imports the shared constant
const brand = `"use client";

// Horse — brand mark component. The galloping-horse geometry lives in
// lib/harbor/brand-asset.ts (verbatim from the user-supplied primary logo).
// Fill uses currentColor so the mark adapts to theme/appearance/accent
// contexts automatically — when the user provides more color variations,
// only the asset + this component change.

import { HORSE_PATH_D, HORSE_VIEWBOX } from "@/lib/harbor/brand-asset";

export function HorseMark({
  className,
  label,
}: {
  className?: string;
  /** When set, exposes the mark to assistive tech as a named image. */
  label?: string;
}) {
  return (
    <svg
      viewBox={HORSE_VIEWBOX}
      className={className}
      fill="currentColor"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <path d={HORSE_PATH_D} fillRule="evenodd" />
    </svg>
  );
}

/** Backwards-compatible alias (old boat-mark name). */
export const HarborMark = HorseMark;
`;
writeFileSync("/home/z/my-project/src/components/harbor/chrome/brand.tsx", brand);

console.log("brand-asset.ts + brand.tsx written; d length:", D.length);
