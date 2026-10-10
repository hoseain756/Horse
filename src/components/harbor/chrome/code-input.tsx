"use client";

// Harbor Web — shared code primitives for the cross-device flows (QR login,
// addon transfer). Extracted so the big-screen panels and the phone-side
// dialogs render codes EXACTLY the same way:
//   • CodeInput      — auto-formatting XXX-XXX / XXX-XXX-XXX text field
//                      (uppercase, dash after every 3 chars, LTR, mono)
//   • CodeCountdown  — bare mm:ss tabular timer, red under 60s
//                      (clones PairCountdown from device-pairing.tsx)
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Bdi } from "../common/bidi";
import { cn } from "@/lib/utils";

/**
 * "ab12cd34e" → "AB1-2CD-34E" — uppercase, dashes every 3 Latin chars.
 * `groups` also caps the length (2 → 6 chars, 3 → 9 chars).
 */
export function formatCodeGroups(raw: string, groups: 2 | 3): string {
  const up = raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const clipped = up.slice(0, groups * 3);
  const parts: string[] = [];
  for (let i = 0; i < clipped.length; i += 3) parts.push(clipped.slice(i, i + 3));
  return parts.join("-");
}

/**
 * Auto-formatting code field. Codes are Latin-only, so the field is dir="ltr"
 * and renders LTR digits/letters in every language — never clipped or
 * reordered by the RTL bidi algorithm.
 */
export function CodeInput({
  id,
  value,
  onChange,
  groups,
  onSubmit,
  autoFocus,
  disabled,
  ariaLabel,
}: {
  id?: string;
  value: string;
  onChange: (formatted: string) => void;
  groups: 2 | 3;
  /** Enter pressed with a full code — caller decides whether to submit. */
  onSubmit?: () => void;
  autoFocus?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <Input
      id={id}
      value={value}
      onChange={(e) => onChange(formatCodeGroups(e.target.value, groups))}
      onKeyDown={(e) => {
        if (e.key === "Enter" && onSubmit) onSubmit();
      }}
      placeholder={groups === 2 ? "XXX-XXX" : "XXX-XXX-XXX"}
      dir="ltr"
      inputMode="text"
      autoCapitalize="characters"
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      autoFocus={autoFocus}
      disabled={disabled}
      maxLength={groups * 3 + (groups - 1)}
      aria-label={ariaLabel}
      className="md-field-outlined bg-transparent text-center font-mono text-xl tracking-[0.3em] uppercase"
    />
  );
}

/** mm:ss until `expiresAt` (ms epoch); turns red under 60s. Bare timer —
 *  the surrounding UI carries the label, exactly like PairCountdown. */
export function CodeCountdown({ expiresAt, className }: { expiresAt: number; className?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);
  const left = Math.max(0, Math.floor((expiresAt - now) / 1000));
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  return (
    <p className={cn("mt-1.5 text-xs text-ink-subtle tabular-nums", className)} role="timer">
      <Bdi className={cn("font-semibold", left < 60 && "text-danger")}>{mm}:{ss}</Bdi>
    </p>
  );
}
