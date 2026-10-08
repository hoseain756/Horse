// Harbor Web — Arabic UI text layer engine.
// Pairs with the generated exact-match dictionary (ar-dict.ts, built from the
// user-approved translation corpus) plus ordered regex rules for dynamic
// templates (counts, durations, seasons, search queries…).
//
// Design contract:
//  - Exact full-node matching only (never rewrites partial sentences), so
//    dynamic data (titles, addon names, user input) can never be mangled.
//  - Originals are stashed on the node itself (symbols) so switching back to
//    English restores the DOM byte-for-byte.
//  - Our writes are recorded (lastWritten/lastWrittenAttrs) so React
//    re-renders are re-translated while our own changes never loop.
"use client";

import { AR_DICT } from "./ar-dict";

/** Original text/attributes stashed here before translating. */
export const ORIG_TEXT = Symbol("harborArOrigText");
export const ORIG_ATTRS = Symbol("harborArOrigAttrs");

/** Last value the engine wrote to a text node — distinguishes our own writes
 *  from React re-renders (a blind skip-set would leave re-rendered English
 *  untranslated forever). */
export const lastWritten = new WeakMap<object, string>();
/** Same idea for translated attributes: element → (attr → our value). */
export const lastWrittenAttrs = new WeakMap<object, Map<string, string>>();

const MAX_LEN = 400;

export function normalizeKey(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Supplementary pairs — standalone DOM nodes whose text the corpus only
// captured as part of a composite line (e.g. "TMDB — Better artwork, …"), so
// the generated exact-match dictionary can't hit them. Wording reuses the
// approved composite translations verbatim.
// ---------------------------------------------------------------------------
const AR_SUPPLEMENT: Record<string, string> = {
  "Better artwork, title logos, cast & recommendations":
    "أعمال فنية أفضل، وشعارات العناوين، وطاقم العمل والتوصيات",
  "IMDb, Rotten Tomatoes, Metacritic & Trakt scores on every title":
    "تقييمات IMDb وRotten Tomatoes وMetacritic وTrakt على كل عنوان",
  "Sync scrobbles, watchlist & history with link a code":
    "مزامنة scrobbles وقائمة المشاهدة والسجل عبر ربط رمز",
  "Track what you watch across devices with a PIN code":
    "تتبع ما تشاهده عبر الأجهزة باستخدام رمز PIN",
  "Not set up": "لم يتم الإعداد",
  "Active": "نشط",
  "integrations not active yet — free keys take about a minute to add.":
    "تكاملات غير مفعلة بعد — تستغرق المفاتيح المجانية نحو دقيقة لإضافتها.",
  "integration not active yet — free keys take about a minute to add.":
    "تكامل واحد غير مفعل بعد — يستغرق المفتاح المجاني نحو دقيقة لإضافته.",
  // --- Round 32: statuses seen untranslated in the Arabic UI ---
  "Offline": "غير متصل",
  "Checking…": "جارٍ التحقق…",
  // --- Round 32 sweep batch: Data / About / Theme panels & PWA ---
  "Export backup": "تصدير نسخة احتياطية",
  "Save settings, addons, watchlist": "حفظ الإعدادات والإضافات وقائمة المشاهدة",
  "Export": "تصدير",
  "Restore backup": "استعادة نسخة احتياطية",
  "Import a .harbx backup file": "استيراد ملف نسخة احتياطية ‎.harbx",
  "Restore": "استعادة",
  "Clear local data": "مسح البيانات المحلية",
  "Remove all Horse data from this browser": "إزالة جميع بيانات Horse من هذا المتصفح",
  "Clear": "مسح",
  "Backup exported": "تم تصدير النسخة الاحتياطية",
  "Backup restored": "تمت استعادة النسخة الاحتياطية",
  "Restore failed": "فشلت الاستعادة",
  "Local data cleared": "تم مسح البيانات المحلية",
  "keys saved.": "مفتاحاً تم حفظه.",
  "keys restored. Reloading…": "مفتاحاً تمت استعادته. جارٍ إعادة التحميل…",
  "Not a Horse backup file": "ليس ملف نسخة احتياطية من Horse",
  "Invalid file": "ملف غير صالح",
  "Reloading…": "جارٍ إعادة التحميل…",
  "Cloud sync": "المزامنة السحابية",
  "Install app": "تثبيت التطبيق",
  "Installed as app": "مثبت كتطبيق",
  "Installing Horse…": "جارٍ تثبيت Horse…",
  "Find it in your apps list.": "ستجده في قائمة تطبيقاتك.",
  "Keyboard shortcuts": "اختصارات لوحة المفاتيح",
  "Focus search": "التركيز على البحث",
  "Play / pause": "تشغيل / إيقاف مؤقت",
  "Fullscreen": "ملء الشاشة",
  "Volume": "مستوى الصوت",
  "Mute": "كتم",
  "Cycle subtitles": "تبديل الترجمات",
  "Next / prev episode": "الحلقة التالية / السابقة",
  "Stream switcher": "مبدّل البث",
  "Episodes panel": "لوحة الحلقات",
  "Close player": "إغلاق المشغّل",
  "Seek to %": "الانتقال إلى نسبة مئوية",
  "Appearance": "المظهر",
  "Light or dark Material 3 scheme of your current palette":
    "مخطط Material 3 الفاتح أو الداكن للوحة الحالية",
  "Contrast": "التباين",
  "Scheme contrast level — higher for stronger legibility":
    "مستوى تباين المخطط — أعلى لوضوح أقوى",
  "Theme Studio": "استوديو المظهر",
  "Build a fully custom palette, fonts and layout — with live preview. Your accent color seeds the Material 3 palette.":
    "ابنِ لوحة ألوان وخطوط وتخطيطاً مخصصة بالكامل — مع معاينة حية. لون التمييز يولّد لوحة Material 3.",
  "Open Theme Studio": "افتح استوديو المظهر",
  "Your saved themes": "سماتك المحفوظة",
  "Theme presets": "أنماط المظهر الجاهزة",
  "Your accent color seeds the Material 3 palette.": "لون التمييز لديك يولّد لوحة Material 3.",
  "Font pairing": "أزواج الخطوط",
  "Custom background": "خلفية مخصصة",
  "Upload image": "تحميل صورة",
  "Dim": "تعتيم",
  "Image too large": "الصورة كبيرة جداً",
  "Use an image under 3 MB.": "استخدم صورة أصغر من 3 ميغابايت.",
  "Import your Simkl watchlist": "استورد قائمة مشاهداتك من Simkl",
  "Unlink account": "إلغاء ربط الحساب",
  "Connected": "متصل",
  "Disconnect": "قطع الاتصال",
  "default position": "الموضع الافتراضي",
};

// ---------------------------------------------------------------------------
// Dynamic pattern rules (ordered: most specific first).
// Built from the (dynamic) entries of the approved translation corpus.
// ---------------------------------------------------------------------------
type Rule = { re: RegExp; fn: (...g: string[]) => string };

const arPluralTitles = (n: string) =>
  n === "1" ? "عنوان واحد" : `${n} عناوين`;
const arPluralItems = (n: string) => (n === "1" ? "عنصر واحد" : `${n} عناوين`);
const arPluralAddons = (n: string) => (n === "1" ? "إضافة واحدة" : `${n} إضافات`);
const arInDays = (n: string) => {
  const x = parseInt(n, 10);
  if (x === 1) return "يُعرض بعد يوم";
  if (x === 2) return "يُعرض بعد يومين";
  if (x >= 3 && x <= 10) return `يُعرض بعد ${n} أيام`;
  return `يُعرض بعد ${n} يومًا`;
};
const arDur = (h: string | undefined, m: string | undefined, s?: string) => {
  const parts: string[] = [];
  if (h) parts.push(`${h}س`);
  if (m) parts.push(`${m}د`);
  if (s) parts.push(`${s}ث`);
  return parts.join(" ");
};

const PROBE_NOUN: Record<string, string> = {
  streams: "تدفقات",
  subtitles: "ترجمات",
  "catalog items": "عناصر كتالوج",
};

const RULES: Rule[] = [
  // --- player ---
  { re: /^Finding peers… \((\d+)s\)$/, fn: (n) => `جارٍ العثور على أقران… (${n}ث)` },
  { re: /^Finding peers… \((\d+) found\)$/, fn: (n) => `جارٍ العثور على أقران… (تم العثور على ${n})` },
  { re: /^Back (\d+)s$/, fn: (n) => `رجوع ${n}ث` },
  { re: /^Forward (\d+)s$/, fn: (n) => `تقديم ${n}ث` },
  { re: /^Load more \((\d+) more\)$/, fn: (n) => `تحميل المزيد (${n} إضافية)` },
  { re: /^No subtitles match “(.+)”\.$/, fn: (q) => `لا توجد ترجمات تطابق “${q}”.` },
  { re: /^in (\d+)s$/, fn: (n) => `خلال ${n}ث` },
  { re: /^Next episode in (\d+)s$/, fn: (n) => `الحلقة التالية خلال ${n}ث` },

  // --- search / palette ---
  { re: /^No results for “(.+)”\.$/, fn: (q) => `لا توجد نتائج لـ“${q}”.` },
  { re: /^See all results for “(.+)”$/, fn: (q) => `عرض جميع النتائج لـ“${q}”` },
  { re: /^No matches for “(.+)”$/, fn: (q) => `لا توجد مطابقات لـ“${q}”` },
  { re: /^Search everywhere for “(.+)”$/, fn: (q) => `البحث في كل مكان عن “${q}”` },
  { re: /^Search (.+)$/, fn: (q) => `بحث عن ${q}` },

  // --- detail / library ---
  { re: /^Playing (.+)$/, fn: (t) => `جارٍ تشغيل ${t}` },
  { re: /^Resume S(\d+):E(\d+)$/, fn: (s, e) => `متابعة S${s}:E${e}` },
  { re: /^Season (\d+)$/, fn: (n) => `الموسم ${n}` },
  { re: /^Episode (\d+)$/, fn: (n) => `الحلقة ${n}` },
  { re: /^Remove (.+) from watchlist$/, fn: (t) => `إزالة ${t} من قائمة المشاهدة` },
  { re: /^via (.+)$/, fn: (x) => `عبر ${x}` },
  { re: /^Updated (.+)$/, fn: (d) => `تم التحديث ${d}` },
  { re: /^Watchlist \((\d+)\)$/, fn: (n) => `قائمة المشاهدة (${n})` },
  { re: /^Lists \((\d+)\)$/, fn: (n) => `القوائم (${n})` },
  { re: /^History \((\d+)\)$/, fn: (n) => `السجل (${n})` },
  { re: /^Installed \((\d+)\)$/, fn: (n) => `مثبتة (${n})` },
  { re: /^\((\d+) hidden\)$/, fn: (n) => `(${n} مخفي)` },
  { re: /^Playlist (\d+)$/, fn: (n) => `قائمة التشغيل ${n}` },
  { re: /^In (\d+) lists?$/, fn: (n) => (n === "1" ? "في قائمة واحدة" : `في ${n} قوائم`) },
  { re: /^Imported (\d+) items?$/, fn: (n) => (n === "1" ? "تم استيراد عنصر واحد" : `تم استيراد ${n} عناصر`) },

  // --- counts ---
  { re: /^(\d+) titles?$/, fn: arPluralTitles },
  { re: /^(\d+) items?$/, fn: arPluralItems },
  { re: /^(\d+) addons?$/, fn: arPluralAddons },
  { re: /^(\d+) streams?$/, fn: (n) => (n === "1" ? "تدفق واحد" : `${n} تدفقات`) },
  { re: /^(\d+) eps$/, fn: (n) => `${n} حلقات` },
  { re: /^(\d+) genres$/, fn: (n) => `${n} أنواع` },
  { re: /^(\d+) healthy$/, fn: (n) => `${n} سليمة` },
  { re: /^(\d+) not responding$/, fn: (n) => `${n} لا تستجيب` },
  { re: /^(\d+) sessions?$/, fn: (n) => `${n} جلسات` },
  { re: /^(\d+) active days?$/, fn: (n) => `${n} أيام نشطة` },
  { re: /^(\d+) integrations? not active yet — free keys take about a minute to add\.$/, fn: (n) =>
      n === "1"
        ? "تكامل واحد غير مفعل بعد — يستغرق المفتاح المجاني نحو دقيقة لإضافته."
        : `${n} تكاملات غير مفعلة بعد — تستغرق المفاتيح المجانية نحو دقيقة لإضافتها.` },

  // --- addons ---
  { re: /^(.{2,40}) installed$/, fn: (t) => `تم تثبيت ${t}` },
  { re: /^(.{2,40}) removed$/, fn: (t) => `تمت إزالة ${t}` },
  { re: /^(.{2,60}) is healthy$/, fn: (t) => `${t} سليمة` },
  { re: /^(.{2,60}) did not respond$/, fn: (t) => `${t} لم تستجب` },
  { re: /^Test (.+)$/, fn: (t) => `اختبار ${t}` },
  { re: /^Configure (.+)$/, fn: (t) => `تهيئة ${t}` },
  { re: /^Uninstall (.+)$/, fn: (t) => `إلغاء تثبيت ${t}` },
  { re: /^Disable (.+)$/, fn: (t) => `تعطيل ${t}` },
  { re: /^Enable (.+)$/, fn: (t) => `تمكين ${t}` },
  { re: /^Responded with (\d+) (streams|subtitles|catalog items) in (\d+(?:\.\d+)?)s$/, fn: (c, noun, s) =>
      `استجابت بـ${c} ${PROBE_NOUN[noun] ?? noun} خلال ${s}ث` },
  { re: /^(\w{2,6}) container will be remuxed to MP4$/, fn: (ext) => `سيتم إعادة تغليف حاوية ${ext} إلى MP4` },

  // --- themes / accounts ---
  { re: /^Load theme (.+)$/, fn: (t) => `تحميل السمة ${t}` },
  { re: /^Share theme (.+)$/, fn: (t) => `مشاركة السمة ${t}` },
  { re: /^Delete theme (.+)$/, fn: (t) => `حذف السمة ${t}` },
  { re: /^Shared theme: (.+)$/, fn: (t) => `السمة المشتركة: ${t}` },
  { re: /^Shared list: (.+)$/, fn: (t) => `القائمة المشتركة: ${t}` },
  { re: /^“(.+)” link copied$/, fn: (t) => `تم نسخ رابط “${t}”` },
  { re: /^Last sync: (.+)$/, fn: (d) => `آخر مزامنة: ${d}` },
  { re: /^Linked as @(.+)$/, fn: (u) => `تم الربط باسم @${u}` },
  { re: /^Linked (.+)$/, fn: (d) => `تم الربط في ${d}` },

  // --- home / time ---
  { re: /^Slide (\d+) of (\d+)$/, fn: (i, t) => `الشريحة ${i} من ${t}` },
  { re: /^Go to slide (\d+)$/, fn: (n) => `الانتقال إلى الشريحة ${n}` },
  { re: /^Airs today$/, fn: () => "يُعرض اليوم" },
  { re: /^Airs tomorrow$/, fn: () => "يُعرض غداً" },
  { re: /^In (\d+) days?$/, fn: arInDays },
  { re: /^just now$/, fn: () => "الآن" },
  { re: /^(\d+)m ago$/, fn: (n) => `${n}د مضت` },
  { re: /^(\d+)h ago$/, fn: (n) => `${n}س مضت` },
  { re: /^(\d+)d ago$/, fn: (n) => `${n}ي مضت` },

  // --- durations (bare) ---
  { re: /^Best day: (\d+)h\s*(\d+)m$/, fn: (h, m) => `أفضل يوم: ${arDur(h, m)}` },
  { re: /^Best day: (\d+)h$/, fn: (h) => `أفضل يوم: ${arDur(h, undefined)}` },
  { re: /^Best day: (\d+)m$/, fn: (m) => `أفضل يوم: ${arDur(undefined, m)}` },
  { re: /^(\d+)h (\d+)m left$/, fn: (h, m) => `تبقى ${arDur(h, m)}` },
  { re: /^(\d+)h left$/, fn: (h) => `تبقى ${arDur(h, undefined)}` },
  { re: /^(\d+)m left$/, fn: (m) => `تبقى ${arDur(undefined, m)}` },
  { re: /^(\d+)h (\d+)m (\d+)s$/, fn: (h, m, s) => arDur(h, m, s) },
  { re: /^(\d+)h (\d+)m$/, fn: (h, m) => arDur(h, m) },
  { re: /^(\d+)m (\d+)s$/, fn: (m, s) => arDur(undefined, m, s) },
  { re: /^(\d+)h$/, fn: (h) => arDur(h, undefined) },
  { re: /^(\d+)m$/, fn: (m) => arDur(undefined, m) },
  { re: /^(\d+)s$/, fn: (s) => arDur(undefined, undefined, s) },

  // --- Round 32: link-account flow, integrations status, addons fleet pill ---
  { re: /^Link (Trakt\.tv|Simkl) with a code$/, fn: (s) => `ربط ${s} برمز` },
  { re: /^No account setup needed — you'll get a short code to enter on (\S+)\.$/, fn: (h) =>
      `لا حاجة لإعداد حساب — ستحصل على رمز قصير لإدخاله في ${h}.` },
  { re: /^Online · port (\d+)$/, fn: (n) => `متصل · المنفذ ${n}` },
  { re: /^· (\d+)\/(\d+) checked$/, fn: (a, b) => `· تم فحص ${a}/${b}` },
  { re: /^(\d+) healthy$/, fn: (n) => `${n} سليمة` },
  { re: /^(\d+) peers$/, fn: (n) => `${n} أقران` },
  { re: /^Import your Trakt watchlist$/, fn: () => "استورد قائمة مشاهداتك من Trakt" },
  { re: /^Import your Simkl watchlist$/, fn: () => "استورد قائمة مشاهداتك من Simkl" },
  { re: /^checked (\d+)([smhd]) ago$/, fn: (n, u) =>
      `تم الفحص ${u === "m" ? `قبل ${n} دقائق` : u === "h" ? `قبل ${n} ساعة` : u === "d" ? `قبل ${n} يوم` : `قبل ${n} ثانية`}` },
];

/** Translate a normalized string. Returns null when no rule applies. */
export function translateText(raw: string): string | null {
  if (raw.length > MAX_LEN) return null;
  const key = normalizeKey(raw);
  if (!key || !/[\p{L}]/u.test(key)) return null;
  const hit = AR_DICT[key] ?? AR_SUPPLEMENT[key];
  if (hit !== undefined) return isolateBidiRuns(hit);
  for (const r of RULES) {
    const m = key.match(r.re);
    if (m) return isolateBidiRuns(r.fn(...m.slice(1)));
  }
  return null;
}

// ---------------------------------------------------------------------------
// Bidi isolation (shared fix — mixed-language scramble)
// ---------------------------------------------------------------------------
// Arabic strings containing Latin terms (ffmpeg, HTTP, mkv, P2P, Debrid,
// BitTorrent, URLs, versions, "5/5") render with reversed segments and
// misplaced punctuation because the Latin runs participate in the surrounding
// RTL bidi run. Wrapping EVERY Latin run in FSI…PDI (first-strong isolate)
// keeps punctuation in the Arabic run and renders Latin segments in order —
// without any DOM restructuring (text nodes accept Unicode controls).
const FSI = "\u2068";
const PDI = "\u2069";
// A Latin run: starts alnum, continues with alnum + URL/version glue.
const LATIN_RUN_RE = /[A-Za-z][A-Za-z0-9._:/+#%-]*(?:[ ]?[A-Za-z0-9][A-Za-z0-9._:/+#%-]*)*|[0-9][A-Za-z0-9._:/+#%-]*/g;

/** Add FSI…PDI around Latin runs inside strings that also contain Arabic. */
export function isolateBidiRuns(text: string): string {
  if (!/[\u0600-\u06FF]/.test(text) || !/[A-Za-z0-9]/.test(text)) return text;
  if (text.includes(FSI)) return text; // already isolated
  return text.replace(LATIN_RUN_RE, (run) => FSI + run + PDI);
}

/** Translate a text node's value, preserving surrounding whitespace. */
export function translateTextNodeValue(raw: string): string | null {
  const m = raw.match(/^(\s*)([\s\S]*?)(\s*)$/);
  if (!m || !m[2]) return null;
  const t = translateText(m[2]);
  if (t == null) return null;
  return m[1] + t + m[3];
}

// ---------------------------------------------------------------------------
// DOM walking
// ---------------------------------------------------------------------------
// Text inside these is code/data — never rewritten. (Inputs have no text
// nodes; their placeholder attribute IS translated — see ATTR_SKIP_TAGS.)
const TEXT_SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE", "TEXTAREA", "KBD"]);
// Only true non-UI containers are excluded from attribute translation.
const ATTR_SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT"]);

const TRANSLATABLE_ATTRS = ["placeholder", "title", "aria-label", "aria-description"] as const;

function skipEl(el: Element | null, forAttrs = false): boolean {
  if (!el) return true;
  if ((forAttrs ? ATTR_SKIP_TAGS : TEXT_SKIP_TAGS).has(el.tagName)) return true;
  if (el.closest('[data-no-ar], [translate="no"], [contenteditable="true"]')) return true;
  return false;
}

/** Translate one text node (stashes the original for later restore). */
export function translateTextNode(t: Text): void {
  if (skipEl(t.parentElement)) return;
  const last = lastWritten.get(t);
  if (last !== undefined) {
    if ((t.nodeValue ?? "") === last) return; // still our own write — nothing to do
    lastWritten.delete(t); // React/framework rewrote it — translate the new content
  }
  const v = t.nodeValue ?? "";
  const tv = translateTextNodeValue(v);
  if (tv != null && tv !== v) {
    const holder = t as unknown as Record<symbol, unknown>;
    if (!(ORIG_TEXT in holder)) holder[ORIG_TEXT] = v;
    t.nodeValue = tv;
    lastWritten.set(t, tv);
  }
}

/** Translate translatable attributes of a single element. */
export function translateElementAttrs(el: Element): void {
  if (skipEl(el, true)) return;
  const written = lastWrittenAttrs.get(el);
  for (const name of TRANSLATABLE_ATTRS) {
    const val = el.getAttribute(name);
    if (!val) continue;
    if (written && written.get(name) === val) continue; // still our own write
    const t = translateText(val);
    if (t == null || t === val) continue;
    const store = (el as unknown as Record<symbol, unknown>)[ORIG_ATTRS] as Record<string, string> | undefined;
    if (!store) {
      (el as unknown as Record<symbol, unknown>)[ORIG_ATTRS] = { [name]: val };
    } else if (!(name in store)) {
      store[name] = val;
    }
    el.setAttribute(name, t);
    if (written) written.set(name, t);
    else lastWrittenAttrs.set(el, new Map([[name, t]]));
  }
}

export function translateSubtree(root: ParentNode): void {
  if (typeof document === "undefined") return;
  // text nodes
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  let n = walker.nextNode();
  while (n) {
    texts.push(n as Text);
    n = walker.nextNode();
  }
  for (const t of texts) {
    translateTextNode(t);
  }
  // Split-run stitching: React breaks strings like `{n} integration${s} not
  // active yet…` across several adjacent text nodes, so per-node matching
  // fails. Join each run of consecutive text-node siblings and translate the
  // whole sentence into the first node (rest blanked; originals stashed).
  if (root instanceof Element) translateSplitRuns(root);
  const all = root.querySelectorAll("*");
  for (const el of all) {
    translateElementAttrs(el);
    translateSplitRuns(el);
  }
}

/** Join consecutive text-node children and translate the sentence as one. */
export function translateSplitRuns(el: Element): void {
  const kids = [...el.childNodes];
  let run: Text[] = [];
  const flush = () => {
    if (run.length > 1) {
      const joined = run.map((t) => t.nodeValue ?? "").join("");
      const tv = translateTextNodeValue(joined);
      if (tv != null && tv !== joined) {
        for (const t of run) {
          const holder = t as unknown as Record<symbol, unknown>;
          if (!(ORIG_TEXT in holder)) holder[ORIG_TEXT] = t.nodeValue ?? "";
        }
        run[0].nodeValue = tv;
        lastWritten.set(run[0], tv);
        for (let i = 1; i < run.length; i++) {
          run[i].nodeValue = "";
          lastWritten.set(run[i], "");
        }
      }
    }
    run = [];
  };
  for (const k of kids) {
    if (k.nodeType === Node.TEXT_NODE && (k.nodeValue ?? "").length > 0) run.push(k as Text);
    else flush();
  }
  flush();
}

export function restoreSubtree(root: ParentNode): void {
  if (typeof document === "undefined") return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  let n = walker.nextNode();
  while (n) {
    texts.push(n as Text);
    n = walker.nextNode();
  }
  for (const t of texts) {
    const holder = t as unknown as Record<symbol, unknown>;
    if (ORIG_TEXT in holder) {
      t.nodeValue = holder[ORIG_TEXT] as string;
      delete holder[ORIG_TEXT];
      lastWritten.delete(t);
    }
  }
  const all = root.querySelectorAll("*");
  for (const el of all) {
    const holder = el as unknown as Record<symbol, unknown>;
    const store = holder[ORIG_ATTRS] as Record<string, string> | undefined;
    if (store) {
      for (const [name, val] of Object.entries(store)) el.setAttribute(name, val);
      delete holder[ORIG_ATTRS];
      lastWrittenAttrs.delete(el);
    }
  }
  if (root instanceof Element) {
    // root itself may hold attr originals too (handled above only via querySelectorAll)
    const holder = root as unknown as Record<symbol, unknown>;
    const store = holder[ORIG_ATTRS] as Record<string, string> | undefined;
    if (store) {
      for (const [name, val] of Object.entries(store)) root.setAttribute(name, val);
      delete holder[ORIG_ATTRS];
    }
  }
}
