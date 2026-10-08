// Build the EN→AR UI dictionary by pairing the two text corpora positionally.
//   EN: /home/z/my-project/project-text-content.md        (ground-truth source strings)
//   AR: /home/z/my-project/upload/project-text-content-ar.md (user-approved translation)
// Pairing rule: sections are keyed by the backticked file path in ##/### headings;
// bullets inside a section pair 1:1 by order. Dynamic templates (backticks/${})
// are excluded from the exact-match dictionary and dumped for pattern review.
// Run: bun scripts/build-ar-dict.mjs
import { readFileSync, writeFileSync } from "node:fs";

const EN_PATH = "/home/z/my-project/project-text-content.md";
const AR_PATH = "/home/z/my-project/upload/project-text-content-ar.md";
const OUT_PATH = "/home/z/my-project/src/lib/harbor/ar-dict.ts";
const REPORT_PATH = "/home/z/my-project/scripts/ar-dict-report.txt";

// ---------- helpers ----------
const TAG_RE =
  /^\((?:aria|placeholder|toast|toast description|tooltip|sr-only|dynamic[^)]*|api:[^)]*|internal|en\/ar|action|error[^)]*|button|link|chip|field|reason|spoken[^)]*)\)\s*/i;

function cleanBullet(raw) {
  let s = raw;
  // strip leading "- "
  s = s.replace(/^-\s+/, "");
  // strip trailing italic annotations like *(button)* / *(per-torrent rows)*
  s = s.replace(/\s*\*[^*]+\*\s*$/, "");
  // strip trailing repeat markers like (×5, one per anchor row)
  s = s.replace(/\s*\(×[^)]*\)\s*$/g, "");
  // strip leading tag markers, repeatedly (max 3)
  for (let i = 0; i < 3; i++) s = s.replace(TAG_RE, "");
  // strip wrapping backticks around the whole string
  s = s.replace(/^`(.*)`$/, "$1");
  // unescape markdown underscores/pipes minimally
  s = s.replace(/\\([_|*`])/g, "$1");
  // collapse whitespace
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function isDynamic(s) {
  return s.includes("${") || s.includes("`") || /\{[a-z]+\}/i.test(s);
}

function parseSections(md) {
  const lines = md.split("\n");
  const sections = new Map(); // path -> string[] (raw bullets)
  let current = null;
  let headingRe = /^#{2,3}\s+`([^`]+)`/;
  for (const line of lines) {
    const m = line.match(headingRe);
    if (m) {
      current = m[1];
      if (!sections.has(current)) sections.set(current, []);
      continue;
    }
    // any other heading ends the current section's bullet stream
    if (/^#{1,6}\s/.test(line)) {
      continue; // keep collecting? bullets only belong under their path heading;
      // a new non-path heading means the section is over
    }
    if (current && /^-\s+/.test(line)) {
      sections.get(current).push(line);
    }
  }
  return sections;
}

// ---------- parse both ----------
const en = parseSections(readFileSync(EN_PATH, "utf8"));
const ar = parseSections(readFileSync(AR_PATH, "utf8"));

const SKIP_PATHS = new Set([
  "src/lib/harbor/i18n.ts", // already bilingual at runtime
]);

const dict = new Map();
const dynamicDump = []; // { path, en }
const skippedIdentity = [];
const mismatched = []; // { path, enCount, arCount }
let paired = 0;

for (const [path, enBulletsRaw] of en) {
  if (!/^(src\/|mini-services\/)/.test(path)) continue; // only source sections
  if (SKIP_PATHS.has(path)) continue;
  const arBulletsRaw = ar.get(path);
  if (!arBulletsRaw) {
    mismatched.push({ path, enCount: enBulletsRaw.length, arCount: -1 });
    continue;
  }
  const enItems = enBulletsRaw.map(cleanBullet);
  const arItems = arBulletsRaw.map(cleanBullet);
  if (enItems.length !== arItems.length) {
    mismatched.push({ path, enCount: enItems.length, arCount: arItems.length });
  }
  const n = Math.min(enItems.length, arItems.length);
  let sectionPaired = 0;
  for (let i = 0; i < n; i++) {
    const e = enItems[i];
    const a = arItems[i];
    if (!e || !a) continue;
    if (isDynamic(e) || isDynamic(a)) {
      if (!isDynamic(a) && !isDynamic(e)) { /* unreachable */ }
      dynamicDump.push({ path, en: e, ar: a });
      continue;
    }
    if (e === a) {
      skippedIdentity.push({ path, s: e });
      continue;
    }
    if (!/[\p{L}]/u.test(e) || !/[\p{L}]/u.test(a)) continue;
    if (dict.has(e) && dict.get(e) !== a) {
      // conflicting translation for the same EN string — keep first, note it
      continue;
    }
    dict.set(e, a);
    sectionPaired++;
  }
  paired += sectionPaired;
}

// ---------- emit ----------
const entries = [...dict.entries()];
const esc = (s) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
const body = entries
  .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
  .join("\n");

const ts = `// GENERATED FILE — do not edit by hand.
// Source of truth: project-text-content.md (EN) × upload/project-text-content-ar.md (AR)
// Rebuild with: bun scripts/build-ar-dict.mjs
// Exact-match EN→AR dictionary for the Arabic UI text layer (ar-text.ts).
// Dynamic templates are handled by pattern rules in ar-text.ts, not here.

export const AR_DICT: Record<string, string> = {
${body}
};
`;

writeFileSync(OUT_PATH, ts, "utf8");

// ---------- report ----------
let rep = "";
rep += `sections parsed: EN=${en.size} AR=${ar.size}\n`;
rep += `paired strings: ${paired} (unique dict entries: ${dict.size})\n`;
rep += `skipped identity (AR==EN): ${skippedIdentity.length}\n`;
rep += `dynamic templates dumped: ${dynamicDump.length}\n`;
rep += `\n== SECTION COUNT MISMATCHES ==\n`;
for (const m of mismatched) rep += `${m.path}: EN=${m.enCount} AR=${m.arCount}\n`;
rep += `\n== DYNAMIC TEMPLATES (all) ==\n`;
for (const d of dynamicDump) rep += `[${d.path}] ${d.en}  =>  ${d.ar}\n`;
rep += `\n== SAMPLE PAIRS (every 97th) ==\n`;
for (let i = 0; i < entries.length; i += 97) rep += `${entries[i][0]}  =>  ${entries[i][1]}\n`;
writeFileSync(REPORT_PATH, rep, "utf8");
console.log(rep.split("\n").slice(0, 14).join("\n"));
console.log(`\nwrote ${OUT_PATH} (${dict.size} entries) and ${REPORT_PATH}`);
