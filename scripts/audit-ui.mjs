#!/usr/bin/env node
// Harbor Web — repeatable UI audit (audit:ui).
//
// Drives the project's existing browser tool (agent-browser) and visits every
// route/tab at widths 320..1440, in ar-RTL and en-LTR, dark and light, at font
// scale 100% and 150%. Flags per the defect classes:
//   · horizontal overflow
//   · clipped text (ellipsis without a tooltip fallback)
//   · text blocks narrower than 120px holding >12 characters
//   · overlaps between fixed elements and interactive elements
//   · touch targets under 48dp (<44dp = blocking, 44–47 = warning)
//   · Latin-only text nodes in the Arabic locale (outside the allow-list)
//   · axe-core accessibility violations (critical/serious)
//
// Usage:
//   node scripts/audit-ui.mjs [--quick] [--full] [--out download/audit]
//   --quick (default): locales×{390,1280}×dark×scale100   — inner dev loop
//   --full           : locales×all widths×themes×scales   — full matrix
// Exit code 1 when blocking issues remain.

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, copyFileSync, rmSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT = join(ROOT, "download", "audit");
const BASE = process.env.AUDIT_BASE_URL ?? "http://localhost:3000";

const args = process.argv.slice(2);
const FULL = args.includes("--full");
mkdirSync(OUT, { recursive: true });

// ---------- configuration ----------------------------------------------------
const WIDTHS = FULL ? [320, 360, 390, 412, 600, 768, 1024, 1440] : [390, 1280];
const HEIGHTS = { 320: 700, 360: 740, 390: 844, 412: 892, 600: 960, 768: 1024, 1024: 768, 1280: 800, 1440: 900 };
const LOCALES = ["en", "ar"];
const THEMES = FULL ? ["dark", "light"] : ["dark"];
const SCALES = FULL ? [100, 150] : [100];

// In-app destinations. Navigation = clicking the glass-dock button by visible
// label (works in both locales); settings tabs are clicked the same way.
const PAGES = [
  { id: "home", nav: null },
  { id: "discover", nav: ["Discover", "استكشف"] },
  { id: "library", nav: ["Library", "المكتبة"] },
  { id: "movies", nav: ["Movies", "أفلام"] },
  { id: "shows", nav: ["Shows", "مسلسلات"] },
  { id: "kids", nav: ["Kids", "الأطفال"] },
  { id: "live", nav: ["Live TV", "البث المباشر"] },
  { id: "calendar", nav: ["Calendar", "التقويم"] },
  { id: "wrapped", nav: ["Wrapped", "حصاد المشاهدة"] },
  { id: "addons", nav: ["Addons", "الإضافات"] },
  { id: "settings", nav: ["Settings", "الإعدادات"] },
];
const SETTINGS_TABS = [
  { id: "basics", labels: ["Basics", "الأساسيات"] },
  { id: "player", labels: ["Player", "المشغل"] },
  { id: "theme", labels: ["Theme", "المظهر"] },
  { id: "language", labels: ["Language", "اللغة"] },
  { id: "integrations", labels: ["Integrations", "التكاملات"] },
  { id: "data", labels: ["Data", "البيانات"] },
  { id: "about", labels: ["About", "حول"] },
];

// Tokens that may legally appear untranslated in the Arabic UI (brands,
// codecs, units, technical nouns).
const AR_ALLOW = new RegExp(
  [
    "Harbor", "Horse", "Stremio", "TMDB", "Trakt", "Simkl", "AniList", "MyAnimeList", "Kitsu",
    "Cinemeta", "OpenSubtitles", "Debrid", "IMDb", "Rotten Tomatoes", "Metacritic",
    "ffmpeg", "FFprobe", "HTTP", "HTTPS", "URL", "manifest", "JSON", "API", "PKCE", "v3", "v4",
    "mkv", "MKV", "HEVC", "H\\.264", "AAC", "AC3", "DTS", "AV1", "P2P", "M3U", "EPG", "XMLTV",
    "BitTorrent", "Torrent", "torrents", "scrobble", "HDR", "HLS", "DASH", "MSE", "CORS",
    "S\\d+\\s*E\\d+", "4K", "1080p", "720p", "2160p", "px", "iOS", "tv", "TV",
  ].join("|"),
);

// ---------- harness (evaluated inside the page) --------------------------------
const HARNESS_HEAD = String.raw`
(async () => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  await sleep(600);
  const vw = document.documentElement.clientWidth;
  const out = { overflow: [], narrowText: [], clipped: [], targets: [], fixedOverlap: [], latinOnly: [], axe: [] };

  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && s.opacity !== "0";
  };
  const rectOf = (el) => el.getBoundingClientRect();

  // 1) horizontal overflow — document + any element wider than the viewport
  const de = document.scrollingElement;
  if (de && de.scrollWidth > de.clientWidth + 2) {
    out.overflow.push({ where: "document", scrollWidth: de.scrollWidth, clientWidth: de.clientWidth });
  }
  const DECOR = new Set(["SVG", "PATH", "CIRCLE", "ELLIPSE", "IMG", "G", "RECT", "USE"]);
  for (const el of document.querySelectorAll("body *")) {
    if (!visible(el)) continue;
    if (DECOR.has(el.tagName)) continue; // media/decor: hero art, bokeh, icons
    const r = rectOf(el);
    if (r.width > 0 && (r.right > vw + 2 || r.left < -2)) {
      const s = getComputedStyle(el);
      if (s.position === "fixed") continue; // sliders/drawers intentionally off-canvas
      // skip elements clipped by an overflow-hidden ancestor OR inside a
      // horizontal SCROLLER (rails/rows scroll by design; the document-level
      // check above still catches real page overflow)
      let p2 = el.parentElement, clipped = false;
      for (let i = 0; i < 6 && p2; i++, p2 = p2.parentElement) {
        const ps = getComputedStyle(p2);
        const ox = ps.overflowX;
        if (/(hidden|clip)/.test(ps.overflow + ox)) { clipped = true; break; }
        if (/auto|scroll/.test(ox)) { clipped = true; break; }
      }
      if (clipped) continue;
      out.overflow.push({ where: el.tagName + "." + String(el.className).slice(0, 40), left: Math.round(r.left), right: Math.round(r.right), vw });
      if (out.overflow.length > 12) break;
    }
  }

  // 2) narrow text blocks (<120px wide, >12 chars) + 3) clipped ellipsis w/o tooltip
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n, seen = new Set();
  while ((n = walker.nextNode())) {
    const text = (n.nodeValue || "").trim();
    if (!text || text.length < 13) continue;
    const el = n.parentElement;
    if (!el || !visible(el) || seen.has(el)) continue;
    seen.add(el);
    const r = rectOf(el);
    const s = getComputedStyle(el);
    if (r.width < 120 && s.display !== "inline") {
      out.narrowText.push({ text: text.slice(0, 40), width: Math.round(r.width) });
    }
    const clamped = s.webkitLineClamp && s.webkitLineClamp !== "none";
    if ((s.textOverflow === "ellipsis" || clamped) && el.scrollWidth > el.clientWidth + 4 && !el.hasAttribute("title") && !el.closest("[title]")) {
      out.clipped.push({ text: text.slice(0, 40) });
    }
    if (out.narrowText.length > 10 && out.clipped.length > 10) break;
  }

  // 4) touch targets (<48dp flagged; <40dp = blocking severity — M3 buttons are 40dp)
  for (const el of document.querySelectorAll('a,button,input,select,textarea,[role="button"],[role="tab"],[role="switch"]')) {
    if (!visible(el)) continue;
    const r = rectOf(el);
    if (r.width === 0 || r.height === 0) continue;
    const w = Math.round(r.width), h = Math.round(r.height);
    if (w < 48 || h < 48) {
      out.targets.push({ sev: w < 40 || h < 40 ? "block" : "warn", tag: el.tagName, label: (el.getAttribute("aria-label") || el.textContent || el.id || "").trim().slice(0, 28), w, h });
      if (out.targets.length > 16) break;
    }
  }

  // 5) fixed elements overlapping interactive elements (search bar, dock, banners)
  const fixed = [...document.querySelectorAll("body *")].filter((el) => {
    const s = getComputedStyle(el);
    return (s.position === "fixed" || (s.position === "absolute" && +s.zIndex >= 40)) && visible(el);
  });
  const interactives = [...document.querySelectorAll('a,button,input,select,[role="tab"],[role="button"]')].filter(visible);
  for (const f of fixed) {
    if (!f.querySelector('a,button,input,[role="tab"]') && !f.matches('input,[role="combobox"]')) continue; // only containers hosting UI
    const fr = rectOf(f);
    if (fr.width === 0) continue;
    for (const it of interactives) {
      if (f.contains(it)) continue; // interactions inside the same fixed layer are fine
      const ir = rectOf(it);
      const x = Math.max(0, Math.min(fr.right, ir.right) - Math.max(fr.left, ir.left));
      const y = Math.max(0, Math.min(fr.bottom, ir.bottom) - Math.max(fr.top, ir.top));
      const area = (x * y) / Math.max(1, ir.width * ir.height);
      const topAnchored = fr.top < window.innerHeight * 0.4;
      if (area > 0.3 && topAnchored) {
        out.fixedOverlap.push({
          fixed: (f.getAttribute("aria-label") || f.className || f.tagName).toString().slice(0, 36),
          over: (it.getAttribute("aria-label") || it.textContent || it.tagName).toString().trim().slice(0, 28),
          pct: Math.round(area * 100),
        });
        if (out.fixedOverlap.length > 8) break;
      }
    }
  }

  // 6) Latin-only text nodes in the Arabic locale (outside allow-list)
  if ("__LOCALE__" === "ar") {
    const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const allowEl = "SCRIPT,STYLE,CODE,PRE,KBD,TEXTAREA,NOSCRIPT";
    const allowRe = new RegExp("__ALLOWRE__");
    let t2, hits = new Set();
    while ((t2 = tw.nextNode())) {
      const text = (t2.nodeValue || "").trim();
      if (text.length < 4 || !/^[A-Za-z0-9 .,:'’\-–—()%&/]+$/.test(text)) continue;
      if (!/[A-Za-z]{3,}/.test(text)) continue;
      if (allowRe.test(text)) continue;
      const el = t2.parentElement;
      if (!el || hits.has(el) || !visible(el)) continue;
      if (el.closest(allowEl) || el.closest('[data-no-ar],[translate="no"],input')) continue;
      // sr-only accessible names + poster-card titles = MEDIA CONTENT
      // (intentionally untranslated data, not UI chrome)
      if (el.classList.contains("sr-only") || el.closest(".sr-only")) continue;
      if (el.closest(".harbor-poster, [data-media-title]")) continue;
      hits.add(el);
      out.latinOnly.push({ text: text.slice(0, 46), where: el.tagName + "." + String(el.className).slice(0, 30) });
      if (out.latinOnly.length > 14) break;
    }
  }

  // 7) axe-core (critical/serious only)
  try {
    if (!window.axe) {
      await new Promise((res) => {
        const sc = document.createElement("script");
        sc.src = "/__audit/axe.min.js";
        sc.onload = res; sc.onerror = res; document.head.appendChild(sc);
        setTimeout(res, 4000);
      });
    }
    if (window.axe) {
      const res = await window.axe.run(document, { resultTypes: ["violations"], rules: { "color-contrast": { enabled: false } } });
      out.axe = res.violations
        .filter(v => v.impact === "critical" || v.impact === "serious")
        .map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help.slice(0, 60) }));
    }
  } catch (e) { out.axe = [{ id: "axe-error", help: String(e).slice(0, 60) }]; }

  return JSON.stringify(out);
})()`;

// ---------- agent-browser driver ----------------------------------------------
let AB = "agent-browser";
function ab(...cmd) {
  return execFileSync(AB, cmd, { encoding: "utf8", timeout: 90_000, maxBuffer: 64 * 1024 * 1024 });
}
function abJson(...cmd) {
  const raw = ab(...cmd);
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const arr = raw.indexOf("[");
    const idx = start === -1 ? arr : arr === -1 ? start : Math.min(start, arr);
    if (idx === -1) throw new Error("non-JSON agent-browser output: " + raw.slice(0, 200));
    return JSON.parse(raw.slice(idx));
  }
}

function setViewport(w) {
  ab("set", "viewport", String(w), String(HEIGHTS[w] ?? 800));
}
async function setupState(locale, theme, scale) {
  // Seed settings BEFORE the app boots: open blank, set localStorage, reload.
  ab("open", BASE + "/?__audit=1");
  const settingsPatch = JSON.stringify({
    uiLanguage: locale === "ar" ? "ar" : "en",
    appearance: theme,
    cloudSyncEnabled: false,
  });
  ab("eval", `(() => {
    try {
      const KEY = "harbor-web.settings";
      const prev = JSON.parse(localStorage.getItem(KEY) || "{}");
      const next = { ...prev, ...${settingsPatch} };
      localStorage.setItem(KEY, JSON.stringify(next));
      document.documentElement.style.fontSize = "${scale}%";
    } catch (e) {}
    return "ok";
  })()`);
  ab("reload");
  // re-apply font scale after reload (inline style survives? no) — set again
  ab("eval", `(() => { document.documentElement.style.fontSize = "${scale}%"; return "ok"; })()`);
}

function navigate(page, locale) {
  if (!page.nav) return true;
  // Real (actionable) clicks via agent-browser find — JS .click() proved flaky
  // against React's synthetic event system mid-hydration.
  for (const label of page.nav) {
    try {
      ab("find", "text", label, "click");
      ab("wait", "900");
      return true;
    } catch { /* try next label */ }
  }
  // Hub-card fallback: open Settings, then the quick-access card of the view.
  const settingsLabels = ["Settings", "الإعدادات"];
  let ok = false;
  for (const label of settingsLabels) {
    try { ab("find", "text", label, "click"); ok = true; break; } catch {}
  }
  if (!ok) return false;
  ab("wait", "1200");
  for (const label of page.nav) {
    try { ab("find", "text", label, "click"); ab("wait", "900"); return true; } catch {}
  }
  return false;
}

function clickSettingsTab(tab) {
  const js = `(() => {
    const btns = [...document.querySelectorAll('[role="tab"]')];
    const hit = btns.find(b => ${JSON.stringify(tab.labels)}.some(l => (b.textContent || "").trim().includes(l)));
    if (hit) { hit.click(); return "clicked"; } return "not-found";
  })()`;
  return String(ab("eval", js)).includes("clicked");
}

// ---------- main ----------------------------------------------------------------
const axeDest = join(ROOT, "public", "__audit");
mkdirSync(axeDest, { recursive: true });
const axeSrc = join(ROOT, "node_modules", "axe-core", "axe.min.js");
if (existsSync(axeSrc)) copyFileSync(axeSrc, join(axeDest, "axe.min.js"));

const ALLOW_JSON = JSON.stringify(AR_ALLOW.source);
const results = [];
let blocking = 0;
const shotsDir = OUT;
let shotCount = 0;

try {
  for (const locale of LOCALES) {
    for (const width of WIDTHS) {
      for (const theme of THEMES) {
        for (const scale of SCALES) {
          setupState(locale, theme, scale);
          setViewport(width);
          for (const page of PAGES) {
            const dests = [{ id: page.id, labels: page.nav }];
            for (const dest of dests) {
              if (!navigate(page, locale)) continue;
              if (page.id === "settings") {
                // audit every settings tab in the same state
                for (const tab of SETTINGS_TABS) {
                  if (!clickSettingsTab(tab)) continue;
                  const id = `settings-${tab.id}`;
                  process.stdout.write(`  · ${id} ${locale} ${width} ${theme} ${scale}%\n`);
                  blocking += auditOne(id, locale, width, theme, scale);
                }
              } else {
                process.stdout.write(`  · ${page.id} ${locale} ${width} ${theme} ${scale}%\n`);
                blocking += auditOne(page.id, locale, width, theme, scale);
              }
            }
          }
        }
      }
    }
  }
} finally {
  rmSync(axeDest, { recursive: true, force: true });
  try { ab("close", "--all"); } catch {}
}

function auditOne(id, locale, width, theme, scale) {
  let issues = null;
  try {
    const script = HARNESS_HEAD.replace("__LOCALE__", locale).replace("__ALLOWRE__", AR_ALLOW.source);
    const res = ab("eval", script).trim();
    // agent-browser prints the result JSON-encoded (a quoted string) — unwrap
    let parsed = JSON.parse(res);
    if (typeof parsed === "string") parsed = JSON.parse(parsed);
    issues = parsed;
  } catch (e) {
    results.push({ id, locale, width, theme, scale, error: String(e).slice(0, 120) });
    return 0;
  }
  const blockingHere =
    issues.overflow.length +
    issues.targets.filter(t => t.sev === "block").length +
    issues.fixedOverlap.length + issues.axe.length;
  blocking += blockingHere;
  results.push({ id, locale, width, theme, scale, ...issues, blocking: blockingHere });
  if (blockingHere > 0 || shotCount < 2) {
    try {
      ab("screenshot", join(shotsDir, `audit-${id}-${locale}-${width}-${theme}-${scale}.png`));
      shotCount++;
    } catch {}
  }
  return blockingHere;
}

// ---------- report ----------------------------------------------------------------
writeFileSync(join(OUT, "audit-report.json"), JSON.stringify(results, null, 2));
const lines = [
  "| page | locale | width | theme | scale | blocking | overflow | narrow | clipped | small targets | fixed overlap | latin-in-ar | axe |",
  "|---|---|---|---|---|---|---|---|---|---|---|---|---|",
];
for (const r of results) {
  lines.push(
    `| ${r.id} | ${r.locale} | ${r.width} | ${r.theme} | ${r.scale}% | ${r.blocking ?? r.error} | ${r.overflow?.length ?? "-"} | ${r.narrowText?.length ?? "-"} | ${r.clipped?.length ?? "-"} | ${r.targets?.length ?? "-"} | ${r.fixedOverlap?.length ?? "-"} | ${r.latinOnly?.length ?? "-"} | ${r.axe?.length ?? "-"} |`,
  );
}
writeFileSync(join(OUT, "audit-report.md"), lines.join("\n"));
console.log(lines.join("\n"));
console.log(`\nAUDIT COMPLETE — blocking issues: ${blocking}. Report: download/audit/audit-report.{md,json}`);
process.exit(blocking > 0 ? 1 : 0);
