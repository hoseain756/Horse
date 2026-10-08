// Harbor Web — language code ↔ name matching
// Addons and mirrors report ISO 639-2b/1 codes ("ara", "eng", "ar") while
// settings store display names ("Arabic", "English"). This module bridges both.

const ISO_TO_NAME: Record<string, string> = {
  ara: "arabic",
  eng: "english",
  spa: "spanish",
  fra: "french",
  fre: "french",
  ger: "german",
  deu: "german",
  jpn: "japanese",
  kor: "korean",
  chi: "chinese",
  zho: "chinese",
  hin: "hindi",
  por: "portuguese",
  rus: "russian",
  ita: "italian",
  tur: "turkish",
  per: "persian",
  fas: "persian",
  heb: "hebrew",
  dut: "dutch",
  nld: "dutch",
  pol: "polish",
  swe: "swedish",
  nor: "norwegian",
  dan: "danish",
  fin: "finnish",
  gre: "greek",
  ell: "greek",
  cze: "czech",
  ces: "czech",
  hun: "hungarian",
  ron: "romanian",
  rum: "romanian",
  tha: "thai",
  vie: "vietnamese",
  ind: "indonesian",
  ukr: "ukrainian",
  bul: "bulgarian",
  srb: "serbian",
  srp: "serbian",
  hrv: "croatian",
  sqi: "albanian",
  alb: "albanian",
  fil: "filipino",
  tgl: "tagalog",
  mal: "malayalam",
  tam: "tamil",
  tel: "telugu",
  kan: "kannada",
  mar: "marathi",
  ben: "bengali",
  urd: "urdu",
  arb: "arabic",
  ar: "arabic",
  en: "english",
  es: "spanish",
  fr: "french",
  de: "german",
  ja: "japanese",
  ko: "korean",
  zh: "chinese",
  hi: "hindi",
  pt: "portuguese",
  ru: "russian",
  it: "italian",
};

const NAME_TO_CODES: Record<string, string[]> = {};
for (const [code, name] of Object.entries(ISO_TO_NAME)) {
  (NAME_TO_CODES[name] ??= []).push(code);
}

/**
 * Match a subtitle lang field ("ara", "ar", "ara ", "ara|ar") against a
 * preferred language ("Arabic", "ar", "ara"). Bidirectional and forgiving.
 */
export function langMatches(langField: string | undefined, pref: string): boolean {
  if (!langField || !pref) return false;
  // Addons sometimes pack alternatives: "ara|ar" or "ara;ar"
  const first = langField.toLowerCase().trim().split(/[|;,]/)[0].trim();
  const p = pref.toLowerCase().trim();
  if (!first || !p) return false;
  if (first === p || first.includes(p) || p.includes(first)) return true;
  const nameOfFirst = ISO_TO_NAME[first];
  if (nameOfFirst && (nameOfFirst.includes(p) || p.includes(nameOfFirst))) return true;
  const codesOfPref = NAME_TO_CODES[p] ?? NAME_TO_CODES[nameOfFirst === p ? "" : p] ?? [];
  if (codesOfPref.some((c) => first === c || first.startsWith(c))) return true;
  // pref given as name, lang field as another code of the same name
  const name = ISO_TO_NAME[first];
  if (name) {
    for (const other of NAME_TO_CODES[name] ?? []) {
      if (p.includes(other) || other.includes(p)) return true;
    }
  }
  return false;
}

/** Uppercase display code for a chip: "ara" -> "ARA". */
export function langChip(langField: string | undefined): string {
  const first = (langField ?? "").toLowerCase().trim().split(/[|;,]/)[0].trim();
  if (!first) return "SUB";
  if (first.length <= 3 && /^[a-z]+$/.test(first)) return first.toUpperCase();
  const name = ISO_TO_NAME[first];
  if (name) return name.slice(0, 3).toUpperCase();
  return first.slice(0, 3).toUpperCase();
}
