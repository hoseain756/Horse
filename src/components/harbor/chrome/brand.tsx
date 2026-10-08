"use client";

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
