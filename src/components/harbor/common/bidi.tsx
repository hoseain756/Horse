"use client";

// Harbor Web — bidi helpers for mixed Arabic/Latin strings.
// Root cause fixed here: Arabic paragraphs containing Latin terms (ffmpeg,
// HTTP, mkv, P2P, Debrid, BitTorrent, URLs, versions) got their segments
// reordered and punctuation misplaced by the Unicode bidi algorithm because
// the Latin runs were bare text inside an RTL paragraph.
//
// <Bdi> isolates an inline Latin/technical segment (renders LTR, isolated).
// <RichBidi text> splits a translated string on Latin/number/URL runs and
// wraps each in <Bdi> automatically — never concatenate translated fragments.
import type { ReactNode } from "react";

/** Latin letters, digits, and URL/version/punctuation glue. */
const LATIN_RUN = /([A-Za-z0-9][A-Za-z0-9._:/+#%-]*(?:\s+[A-Za-z0-9][A-Za-z0-9._:/+#%-]*)*)/g;

/** True when the string mixes Arabic with Latin runs (needs isolation). */
export function isMixedBidi(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text) && /[A-Za-z0-9]/.test(text);
}

/** Inline bidi-isolated segment (logical, works in both directions). */
export function Bdi({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <bdi dir="ltr" className={className} style={{ unicodeBidi: "isolate" }}>
      {children}
    </bdi>
  );
}

/**
 * Render a (possibly Arabic, possibly mixed) string with every Latin run
 * bidi-isolated. Arabic-only and Latin-only strings pass through unchanged
 * (single text node, zero overhead).
 */
export function RichBidi({ text, className }: { text: string; className?: string }) {
  if (!isMixedBidi(text)) return <span className={className}>{text}</span>;
  const parts = text.split(LATIN_RUN).filter((p) => p !== "" && p !== undefined);
  return (
    <span className={className}>
      {parts.map((part, i) =>
        /^[A-Za-z0-9]/.test(part) ? (
          <Bdi key={i}>{part}</Bdi>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </span>
  );
}
