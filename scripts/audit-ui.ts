// Horse — Settings UI audit (Task 70, brief STEP 5).
// Matrix: 13 widths × 2 languages × 2 themes × 2 text scales = 104 combos.
// Per combo: seed settings in localStorage, load the settings surface,
// assert no horizontal overflow and no page errors, and (optionally) capture
// a screenshot. Designed for THIS sandbox: warm-before-browser cycles,
// resilient to the dev server dying (restarts it), zero-blocking output:
// prints a per-combo table + summary; exit 1 only on hard failures.
//
// Run: bun run audit:ui [--quick] [--shots]
//   --quick   8 representative widths instead of 13 (fast CI-ish pass)
//   --shots   save a screenshot per combo into qa-shots/audit/
"use client";

import { execSync } from "node:child_process";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";

const AB = "agent-browser";
const BASE = "http://localhost:3000";
const WIDTHS_FULL = [320, 360, 412, 480, 600, 768, 840, 1024, 1180, 1280, 1440, 1920, 2560];
const WIDTHS_QUICK = [320, 412, 768, 840, 1024, 1280, 1920, 2560];
const LANGS = ["en", "ar"] as const;
const THEMES = ["dark", "light"] as const;
const SCALES = [1, 1.5] as const;

const args = process.argv.slice(2);
const quick = args.includes("--quick");
const shots = args.includes("--shots");
// --widths=320,768,1920 → run only these widths (chunked runs survive the
// sandbox's background-process reaper; the TSV is rewritten per run).
const widthsArg = args.find((a) => a.startsWith("--widths="));
const allWidths = quick ? WIDTHS_QUICK : WIDTHS_FULL;
const widths = widthsArg
  ? allWidths.filter((w) => widthsArg.split("=")[1]!.split(",").map(Number).includes(w))
  : allWidths;

let failures = 0;
let passes = 0;
const rows: string[] = [];

function ab(cmd: string, timeout = 30000): string {
  try {
    return execSync(`${AB} ${cmd}`, { timeout, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    return `__AB_ERR__ ${(e as Error).message.split("\n")[0]}`;
  }
}

/** Dev-server caretaker: start + warm if :3000 is not answering. */
function ensureServer(): boolean {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const code = execSync(`curl -s -o /dev/null -w '%{http_code}' --max-time 4 ${BASE}`, {
        encoding: "utf8",
      });
      if (code.trim() === "200") return true;
    } catch {
      /* not up */
    }
    console.log(`[audit] dev server down — starting (attempt ${attempt + 1})…`);
    try {
      execSync(
        `(setsid bash -c 'export UV_THREADPOOL_SIZE=2 VIPS_CONCURRENCY=1 NODE_OPTIONS="--max-old-space-size=2048"; cd /home/z/my-project; exec bun run dev > dev.log 2>&1' < /dev/null > /dev/null 2>&1 &)`,
      );
      execSync("sleep 14");
      // warm two hits before the browser touches it
      execSync(`curl -s -o /dev/null --max-time 20 ${BASE} || true`);
      execSync(`curl -s -o /dev/null --max-time 20 ${BASE} || true`);
    } catch {
      /* retry */
    }
  }
  return false;
}

function seedSettings(lang: string, theme: string): void {
  const payload = JSON.stringify({
    uiLanguage: lang,
    appearance: theme,
    contrastLevel: "standard",
    kidsMode: false,
  }).replace(/'/g, "");
  ab(`storage local set harbor-web.settings '${payload}'`);
}

function checkCombo(w: number, lang: string, theme: string, scale: number): { ok: boolean; note: string } {
  const url = `${BASE}/#settings`;
  ab("errors --clear");
  ab(`set viewport ${w} 900`);
  seedSettings(lang, theme);
  const openRes = ab(`open "${url}"`, 60000);
  if (openRes.includes("__AB_ERR__")) return { ok: false, note: "nav-failed" };
  // Proven pattern (matches interactive QA): a fixed settle beat, then a
  // single-line eval — multiline promise evals are flaky through the CLI.
  try {
    execSync("sleep 6", { timeout: 10000 });
  } catch {
    /* keep going */
  }
  const evalRes = ab(
    `eval "(() => { document.documentElement.style.zoom = '${scale}'; return JSON.stringify({ shell: !!document.querySelector('.set-shell'), ov: document.documentElement.scrollWidth - window.innerWidth }); })()"`,
    30000,
  );
  let shell = false;
  let ov = -1;
  try {
    // agent-browser prints the eval result as a JSON string literal — the
    // first parse yields a STRING, the second yields the payload object.
    let parsed: unknown = JSON.parse(evalRes.trim().split("\n").at(-1) ?? "{}");
    if (typeof parsed === "string") parsed = JSON.parse(parsed);
    const payload = parsed as { shell: boolean; ov: number };
    shell = payload.shell === true;
    ov = Number(payload.ov ?? -1);
  } catch {
    return { ok: false, note: "eval-failed" };
  }
  const errRes = ab("errors", 20000);
  const pageErrors = errRes.trim().length > 0 && !errRes.startsWith("No page errors") ? errRes.trim().split("\n").filter(Boolean).length : 0;
  if (shots) {
    mkdirSync("qa-shots/audit", { recursive: true });
    ab(`screenshot qa-shots/audit/${w}-${lang}-${theme}-${String(scale).replace(".", "_")}.png`, 30000);
  }
  const problems: string[] = [];
  if (!shell) problems.push(`no-shell [${evalRes.trim().slice(0, 140)}]`);
  if (ov > 0) problems.push(`h-overflow+${ov}`);
  if (pageErrors > 0) problems.push(`page-errors:${pageErrors}`);
  return { ok: problems.length === 0, note: problems.join(",") || "ok" };
}

async function main() {
  if (!ensureServer()) {
    console.error("[audit] dev server could not be started — aborting");
    process.exit(2);
  }
  ab("close", 15000);
  console.log(
    `[audit] matrix: ${widths.length} widths × ${LANGS.length} langs × ${THEMES.length} themes × ${SCALES.length} scales = ${widths.length * 4} combos`,
  );
  const header = "width\tlang\ttheme\tscale\tresult\tnote";
  rows.push(header);
  for (const w of widths) {
    for (const lang of LANGS) {
      for (const theme of THEMES) {
        for (const scale of SCALES) {
          const r = checkCombo(w, lang, theme, scale);
          if (r.ok) passes++;
          else failures++;
          rows.push(`${w}\t${lang}\t${theme}\t${scale}\t${r.ok ? "PASS" : "FAIL"}\t${r.note}`);
          console.log(`${r.ok ? "✓" : "✗"} ${w} ${lang} ${theme} x${scale} → ${r.note}`);
        }
      }
    }
  }
  writeFileSync("qa-shots/audit-report-last.tsv", rows.join("\n") + "\n");
  // Chunked runs (--widths=...) append into the cumulative report.
  const append = args.some((a) => a.startsWith("--widths="));
  if (append) {
    appendFileSync("qa-shots/audit-report.tsv", rows.slice(1).join("\n") + "\n");
  } else {
    writeFileSync("qa-shots/audit-report.tsv", rows.join("\n") + "\n");
  }
  console.log(`\n[audit] ${passes} PASS · ${failures} FAIL — report: qa-shots/audit-report.tsv`);
  ab("close", 15000);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
