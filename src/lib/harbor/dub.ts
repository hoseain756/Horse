// Harbor Web — dubbing/audio-source detection (T3 player feature).
//
// Heuristics only: addon stream titles/descriptions are free text, so a
// language tag is derived from the well-known Stremio release conventions
// (language words, ISO codes, "dub/dubbed/dual audio" keywords, Arabic dub
// markers). A stream with no recognizable marker still lists under
// "Dubbing sources" — the chip just reads "•" (unlabeled), and the panel
// never hides sources: it is an index, not a filter.
import type { Stream } from "./types";

export type DubTag = { code: string; label: string };

// Ordered: Arabic first (dub keywords are the strongest signal for the
// primary audience), then common dub-release languages by specificity.
const TAG_PATTERNS: [RegExp, DubTag][] = [
  [/مدبلج|دبلجة|دبلج|عربي\s*صوت|صوت\s*عربي/i, { code: "ar", label: "AR" }],
  [/\barabic\b|\bara\b|\bar\b.*(dub|audio)|(dub|audio).*\bar\b/i, { code: "ar", label: "AR" }],
  [/\beng(lish)?\b/i, { code: "en", label: "EN" }],
  [/\bhindi\b|\bhin\b/i, { code: "hi", label: "HI" }],
  [/\burdu\b|\burd\b/i, { code: "ur", label: "UR" }],
  [/\bturkish\b|\bturkce\b|\btur\b/i, { code: "tr", label: "TR" }],
  [/\bspanish\b|\bespañol\b|\bespanol\b|\bcastellano\b|\blatino\b|\bspa\b|\besl\b/i, { code: "es", label: "ES" }],
  [/\bfrench\b|\bfrançais\b|\bfrancais\b|\bfre\b|\bfra\b/i, { code: "fr", label: "FR" }],
  [/\bgerman\b|\bdeutsch\b|\bger\b|\bdeu\b/i, { code: "de", label: "DE" }],
  [/\bjapanese\b|\b日本語\b|\bjpn\b/i, { code: "ja", label: "JA" }],
  [/\bkorean\b|\bkor\b/i, { code: "ko", label: "KO" }],
  [/\bhindi-urdu\b|\bmulti\s*(audio|lang|sub)\b/i, { code: "multi", label: "MULTI" }],
];

/** True when the text carries an explicit dub/dual-audio marker. */
export function isDubText(s: string): boolean {
  return /\bdub(bed|bing|s)?\b|دبلجة|مدبلج|dual[-\s]?audio|multi[-\s]?audio/i.test(s);
}

/** Language tag for a stream's audio (null = no recognizable marker). */
export function dubTagOf(stream: Stream): DubTag | null {
  const text = `${stream.title ?? ""}\n${stream.description ?? ""}`;
  for (const [re, tag] of TAG_PATTERNS) {
    if (re.test(text)) {
      if (tag.code === "ar" && !isDubText(text)) {
        // Arabic WORD without a dub marker may be subtitles-only ("مترجم")
        // — still an audio-source candidate for the list, but the chip
        // stays honest: no false "AR dub" claim.
        return { code: "ar", label: "AR" };
      }
      return tag;
    }
  }
  return null;
}

/** Stable identity of a stream (switch decisions + active-row highlight). */
export function streamKeyOf(s: Partial<Stream> | null | undefined): string {
  if (!s) return "";
  return `${s.infoHash ?? ""}|${s.url ?? ""}`;
}
