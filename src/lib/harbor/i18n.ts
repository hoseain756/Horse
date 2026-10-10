// Harbor Web — minimal EN/AR string map for the Home rebuild (hero + continue
// watching). Extends the established labelEn/labelAr pattern from
// chrome/nav-items.tsx: no framework, just a typed dictionary keyed off
// settings.uiLanguage. Add new screens' strings here as they need them.
"use client";

export function isArabic(lang: string | undefined | null): boolean {
  return /^ar(-|_|$)/i.test(lang ?? "");
}

type Entry = { en: string; ar: string };

const STRINGS = {
  continueWatching: { en: "Continue Watching", ar: "متابعة المشاهدة" },
  // ---- playback pipeline ----
  tryingProxy: { en: "Retrying through the secure proxy…", ar: "إعادة المحاولة عبر الوسيط الآمن…" },
  tryingConvert: { en: "Converting this stream for your browser…", ar: "جارٍ تحويل هذا البث لمتصفحك…" },
  convertingNeeds: { en: "This format needs conversion", ar: "هذه الصيغة تحتاج إلى تحويل" },
  convertAndPlay: { en: "Convert and play", ar: "حوّل وشغّل" },
  pickAnother: { en: "Pick another stream", ar: "اختر بثاً آخر" },
  linkExpired: { en: "The link expired or is unavailable", ar: "انتهت صلاحية الرابط أو أنه غير متاح" },
  sourceBlocks: { en: "The source blocks playback.", ar: "المصدر يمنع التشغيل." },
  networkRetry: { en: "Network hiccup — retrying…", ar: "انقطاع في الشبكة — إعادة المحاولة…" },
  tryingAnother: { en: "Trying another source…", ar: "جرب مصدراً آخر…" },
  torrentNotPlayable: {
    en: "Torrents can't play natively in browsers. This one needs the built-in P2P engine or a debrid unlock.",
    ar: "لا يمكن للمتصفحات تشغيل التورنت مباشرة. يحتاج هذا البث إلى محرك P2P المدمج أو فتح عبر Debrid.",
  },
  showTechnical: { en: "Show technical details", ar: "إظهار التفاصيل التقنية" },
  copyDiagnostics: { en: "Copy diagnostics", ar: "نسخ التشخيص" },
  diagnosticsCopied: { en: "Diagnostics copied", ar: "تم نسخ التشخيص" },
  retry: { en: "Retry", ar: "إعادة المحاولة" },
  playbackErrorTitle: { en: "Playback problem", ar: "مشكلة في التشغيل" },
  errClass: { en: "Failure class", ar: "نوع الخطأ" },
  errCode: { en: "Error code", ar: "رمز الخطأ" },
  sourceHost: { en: "Source host", ar: "مصدر البث" },
  // ---- audio / dub switcher (player) ----
  audioPanelTitle: { en: "Audio / Dub", ar: "الصوت / الدبلجة" },
  audioSwitching: { en: "Switching audio…", ar: "جارٍ تبديل الصوت…" },
  audioTrackFallback: { en: "Track", ar: "مسار" },
  audioOriginal: { en: "Original", ar: "الأصلي" },
  audioCurrentGroup: { en: "Current audio track", ar: "مسار الصوت الحالي" },
  audioNoTracks: { en: "Single fixed audio track", ar: "مسار صوتي واحد ثابت" },
  dubbingSources: { en: "Dubbing sources", ar: "مصادر الدبلجة" },
  dubLoading: { en: "Fetching all dubbing sources…", ar: "جارٍ جلب جميع مصادر الدبلجة…" },
  dubNone: { en: "No other dubbing sources found for this title", ar: "لا توجد مصادر دبلجة أخرى لهذا العمل" },
  dubUnavailable: {
    en: "This dubbing source needs a debrid key or the P2P engine (Settings → Integrations)",
    ar: "يحتاج مصدر الدبلجة هذا إلى مفتاح Debrid أو محرك P2P (الإعدادات ← التكاملات)",
  },
  audioPanelHint: {
    en: "In-stream tracks switch instantly · other sources resume at the current position",
    ar: "المسارات المدمجة تتبدل فوراً · والمصادر الأخرى تكمل من نفس الموضع",
  },
  // ---- kids ----
  kidsTitle: { en: "Kids Corner", ar: "زاوية الأطفال" },
  kidsSubtitle: { en: "Fun and safe picks for the little ones.", ar: "اختيارات ممتعة وآمنة للصغار." },
  cardSize: { en: "Card size", ar: "حجم البطاقة" },
  sizeLarge: { en: "Large", ar: "كبير" },
  sizeMedium: { en: "Medium", ar: "متوسط" },
  sizeSmall: { en: "Small", ar: "صغير" },
  cardSizeHint: { en: "Poster size in Kids Corner — bigger cards are easier to tap.", ar: "حجم الملصقات في زاوية الأطفال — البطاقات الأكبر أسهل للمس." },
  // ---- home (existing) ----
  viewDetails: { en: "View details", ar: "عرض التفاصيل" },
  featured: { en: "Featured", ar: "مميز" },
  loadingFeatured: { en: "Loading featured titles", ar: "جارٍ تحميل المميزة" },
  pauseAutoplay: { en: "Pause autoplay", ar: "إيقاف العرض التلقائي مؤقتاً" },
  resumeAutoplay: { en: "Resume autoplay", ar: "استئناف العرض التلقائي" },
  upNext: { en: "Up next", ar: "التالي" },
  resumeAria: { en: "Resume", ar: "متابعة" },
  markWatched: { en: "Mark as watched", ar: "تحديد كمشاهد" },
  removeFromCw: { en: "Remove from Continue Watching", ar: "إزالة من متابعة المشاهدة" },
  watchedToast: { en: "Marked as watched", ar: "تم التحديد كمشاهد" },
  episode: { en: "Episode", ar: "الحلقة" },
  left: { en: "left", ar: "تبقى" },
  hUnit: { en: "h", ar: "س" },
  mUnit: { en: "m", ar: "د" },
  airToday: { en: "Airs today", ar: "يُعرض اليوم" },
  airTomorrow: { en: "Airs tomorrow", ar: "يُعرض غداً" },
  airIn: { en: "In {n} {unit}", ar: "يُعرض بعد {n} {unit}" },
  newEpisode: { en: "New episode", ar: "حلقة جديدة" },
  loadingMore: { en: "Loading", ar: "جارٍ التحميل" },
  // ---- player transport (episode navigation) ----
  prevEpisode: { en: "Previous episode", ar: "الحلقة السابقة" },
  nextEpisode: { en: "Next episode", ar: "الحلقة التالية" },
} as const satisfies Record<string, Entry>;

export type HomeStringKey = keyof typeof STRINGS;

export function homeT(key: HomeStringKey, lang: string): string {
  return isArabic(lang) ? STRINGS[key].ar : STRINGS[key].en;
}

/** "{Series|Movie|Anime}" for the hero meta line. Animation-genre series are
 *  labelled Anime (matches the app's Anime section semantics). */
export function metaTypeLabel(type: string, genres: string[] | undefined, lang: string): string {
  const ar = isArabic(lang);
  const list = (genres ?? []).map((g) => g.toLowerCase());
  if (type !== "movie" && (list.includes("anime") || list.includes("animation"))) {
    return ar ? "أنمي" : "Anime";
  }
  if (type === "movie") return ar ? "فيلم" : "Movie";
  return ar ? "مسلسل" : "Series";
}

/** Localized "S1 E2"-style tag stays Latin (rendered dir="ltr" by callers). */
export function seasonEpisodeTag(season: number | undefined, episode: number | undefined): string | null {
  if (!season || !episode) return null;
  return `S${season} E${episode}`;
}

/** Episode subtitle fallback: "الحلقة {n}" / "Episode {n}". */
export function episodeFallback(n: number | undefined, lang: string): string | null {
  if (!n) return null;
  return isArabic(lang) ? `الحلقة ${n}` : `Episode ${n}`;
}

/** "1h 20m left" / "تبقى ١س ٢٠د"-style remaining time (movies). */
export function remainingLabel(ms: number, lang: string): string | null {
  if (!Number.isFinite(ms) || ms <= 60_000) return null;
  const totalMin = Math.round(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const ar = isArabic(lang);
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}${ar ? "س" : "h"}`);
  if (m > 0 || h === 0) parts.push(`${m}${ar ? "د" : "m"}`);
  return ar ? `تبقى ${parts.join(" ")}` : `${parts.join(" ")} left`;
}

function daysUntil(releasedMs: number, now: number): number {
  return Math.max(0, Math.ceil((releasedMs - now) / 86_400_000));
}

/**
 * "Upcoming" badge text with correct plurals via Intl.PluralRules.
 * Arabic: اليوم (0) / غداً (1) / يومان (2) / أيام (3-10) / يوم (11+).
 * English: today / tomorrow / "In {n} day(s)".
 */
export function upcomingLabel(releasedMs: number, lang: string): string | null {
  if (!Number.isFinite(releasedMs)) return null;
  const now = Date.now();
  if (releasedMs <= now) return null;
  const days = daysUntil(releasedMs, now);
  const ar = isArabic(lang);
  if (days === 0) return homeT("airToday", lang);
  if (days === 1) return homeT("airTomorrow", lang);
  if (ar) {
    const cat = new Intl.PluralRules("ar").select(days);
    const unit = cat === "two" ? "يومين" : cat === "few" ? "أيام" : "يوم";
    return homeT("airIn", lang).replace("{n}", String(days)).replace("{unit}", unit);
  }
  const unit = new Intl.PluralRules("en").select(days) === "one" ? "day" : "days";
  return homeT("airIn", lang).replace("{n}", String(days)).replace("{unit}", unit);
}

export { daysUntil };

/** Localized "{n} of {total}" slide announcer / labels. */
export function slideOf(i: number, total: number, lang: string): string {
  return isArabic(lang) ? `الشريحة ${i} من ${total}` : `Slide ${i} of ${total}`;
}

export function goToSlideLabel(n: number, lang: string): string {
  return isArabic(lang) ? `الانتقال إلى الشريحة ${n}` : `Go to slide ${n}`;
}

// ---------------------------------------------------------------------------
// App-wide string dictionary (complete ar/en). Every user-visible string of
// the shared components lives here; ICU-style plurals come via Intl.PluralRules
// helpers below, numbers via Intl.NumberFormat (latin digits everywhere so the
// digit style stays consistent across the app), relative times via
// Intl.RelativeTimeFormat.
// ---------------------------------------------------------------------------

/** Interpolation values: `{name}` → values.name. */
type Vars = Record<string, string | number>;

/**
 * English → Arabic. Keys are stable identifiers (camelCase), NOT English text,
 * so a dev-time check can fail loudly on missing keys.
 */
export const APP_STRINGS = {
  // ---- shared actions / states ----
  cancel: { en: "Cancel", ar: "إلغاء" },
  save: { en: "Save", ar: "حفظ" },
  delete: { en: "Delete", ar: "حذف" },
  remove: { en: "Remove", ar: "إزالة" },
  refresh: { en: "Refresh", ar: "تحديث" },
  back: { en: "Back", ar: "رجوع" },
  install: { en: "Install", ar: "تثبيت" },
  installing: { en: "Installing…", ar: "جارٍ التثبيت…" },
  installed: { en: "Installed", ar: "مثبتة" },
  enable: { en: "Enable", ar: "تمكين" },
  disable: { en: "Disable", ar: "تعطيل" },
  configure: { en: "Configure", ar: "تهيئة" },
  uninstall: { en: "Uninstall", ar: "إلغاء التثبيت" },
  disconnect: { en: "Disconnect", ar: "قطع الاتصال" },
  unlink: { en: "Unlink", ar: "إلغاء الربط" },
  syncNow: { en: "Sync now", ar: "مزامنة الآن" },
  open: { en: "Open", ar: "افتح" },
  offline: { en: "Offline", ar: "غير متصل" },
  online: { en: "Online · port {n}", ar: "متصل · المنفذ {n}" },
  checking: { en: "Checking…", ar: "جارٍ التحقق…" },
  copyFailed: { en: "Copy failed", ar: "فشل النسخ" },
  copyFailedBody: { en: "Select the code and copy it manually.", ar: "حدد الرمز وانسخه يدوياً." },
  syncedTitle: { en: "Synced {name}", ar: "تمت مزامنة {name}" },
  syncFailed: { en: "Sync failed", ar: "فشلت المزامنة" },
  syncFailedBody: { en: "Check your connection and try again.", ar: "تحقق من اتصالك وحاول مجدداً." },
  connectedAs: { en: "Connected as @{name}", ar: "متصل باسم @{name}" },
  connectedTitle: { en: "{name} connected", ar: "تم ربط {name}" },
  linkedAs: { en: "Linked as @{name}", ar: "تم الربط باسم @{name}" },
  lastSync: { en: "Last sync: {d}", ar: "آخر مزامنة: {d}" },
  tokensSecure: { en: "Tokens are stored securely on your server.", ar: "تُخزَّن الرموز بأمان على خادمك." },

  // ---- settings shell ----
  settingsTitle: { en: "Settings", ar: "الإعدادات" },
  tabBasics: { en: "Basics", ar: "الأساسيات" },
  tabPlayer: { en: "Player", ar: "المشغل" },
  tabTheme: { en: "Theme", ar: "المظهر" },
  tabLanguage: { en: "Language", ar: "اللغة" },
  tabIntegrations: { en: "Integrations", ar: "التكاملات" },
  tabData: { en: "Data", ar: "البيانات" },
  tabAbout: { en: "About", ar: "حول" },
  settingsSections: { en: "Settings sections", ar: "أقسام الإعدادات" },

  // ---- segmented shared options ----
  optAuto: { en: "Auto", ar: "تلقائي" },
  optAlways: { en: "Always", ar: "دائماً" },
  optNever: { en: "Never", ar: "أبداً" },
  optAsk: { en: "Ask", ar: "اسأل" },
  optDark: { en: "Dark", ar: "داكن" },
  optLight: { en: "Light", ar: "فاتح" },
  optStandard: { en: "Standard", ar: "قياسي" },
  optMedium: { en: "Medium", ar: "متوسط" },
  optHigh: { en: "High", ar: "مرتفع" },
  optHarbor: { en: "Horse", ar: "Horse" },
  optClassic: { en: "Classic", ar: "كلاسيكي" },
  optFit: { en: "Fit", ar: "احتواء" },
  optFill: { en: "Fill", ar: "ملء" },
  optZoom: { en: "Zoom", ar: "تكبير" },
  optDefault: { en: "Default", ar: "افتراضي" },
  optStremio: { en: "Stremio", ar: "Stremio" },
  optCondensed: { en: "Condensed", ar: "مضغوط" },

  // ---- basics rows ----
  instantPlay: { en: "Instant play", ar: "التشغيل الفوري" },
  instantPlayDesc: { en: "Open the best stream immediately when clicking Play", ar: "افتح أفضل بث فور النقر على تشغيل" },
  autoPlayNext: { en: "Auto-play next episode", ar: "تشغيل الحلقة التالية تلقائياً" },
  autoPlayNextDesc: { en: "Continue to the next episode automatically", ar: "الانتقال إلى الحلقة التالية تلقائياً" },
  resumePlayback: { en: "Resume playback", ar: "استئناف التشغيل" },
  resumePlaybackDesc: { en: "Pick up where you left off", ar: "تابع من حيث توقفت" },
  confirmLeave: { en: "Confirm leaving playback", ar: "تأكيد مغادرة التشغيل" },
  confirmLeaveDesc: { en: "Ask before closing the player", ar: "اسأل قبل إغلاق المشغّل" },
  showCardBadges: { en: "Show card badges", ar: "إظهار شارات البطاقات" },
  showCardBadgesDesc: { en: "IMDb rating badges on posters", ar: "شارات تقييم IMDb على الملصقات" },
  homeMode: { en: "Home mode", ar: "وضع الصفحة الرئيسية" },
  homeModeDesc: { en: "Horse layout with hero, or classic rows only", ar: "تخطيط Horse مع الواجهة الرئيسية، أو الصفوف الكلاسيكية فقط" },
  showAllAddonRows: { en: "Show all addon rows on home", ar: "إظهار جميع صفوف الإضافات في الرئيسية" },
  showAllAddonRowsDesc: { en: "Include every addon catalog row", ar: "تضمين كل صفوف كتالوج الإضافات" },
  hideWatched: { en: "Hide watched in catalogs", ar: "إخفاء ما شاهدته في الكتالوجات" },
  hideWatchedDesc: { en: "Filter titles you already watched", ar: "تصفية العناوين التي شاهدتها مسبقاً" },
  autoHideNav: { en: "Auto-hide navigation bar", ar: "الإخفاء التلقائي لشريط التنقل" },
  autoHideNavDesc: { en: "Hide the glass dock scrolling down, reveal scrolling up", ar: "أخفِ شريط الأزرار عند التمرير للأسفل وأظهِره عند التمرير للأعلى" },
  railMode: { en: "Navigation rail", ar: "شريط التنقل الجانبي" },
  railModeDesc: {
    en: "Large screens: the side rail hides at the edge and reveals on intent (edge hover, handle tap, or keyboard focus)",
    ar: "الشاشات الكبيرة: يختبئ الشريط الجانبي عند الحافة ويظهر عند الحاجة (التمرير على الحافة، لمس المقبض، أو التركيز بلوحة المفاتيح)",
  },
  optRailAutoHide: { en: "Auto-hide", ar: "إخفاء تلقائي" },
  optRailAlways: { en: "Always visible", ar: "ظاهر دائمًا" },
  posterSize: { en: "Poster size", ar: "حجم الملصق" },
  posterRadius: { en: "Poster corner radius", ar: "استدارة زوايا الملصق" },

  // ---- player rows ----
  secureProxy: { en: "Use secure proxy when needed", ar: "استخدام الوسيط الآمن عند الحاجة" },
  secureProxyDesc: { en: "Routes blocked streams through this server (fixes CORS and source headers)", ar: "يوجّه البثوث المحجوبة عبر هذا الخادم (يصلح CORS وترويسات المصدر)" },
  convertStreams: { en: "Convert incompatible streams", ar: "تحويل البثوث غير المتوافقة" },
  convertStreamsDesc: { en: "MKV/HEVC/AC3-DTS → H.264/AAC on the server (uses CPU)", ar: "تحويل MKV/HEVC/AC3-DTS إلى H.264/AAC على الخادم (يستهلك المعالج)" },
  playableOnly: { en: "Show only streams that play in the browser", ar: "إظهار البثوث القابلة للتشغيل في المتصفح فقط" },
  playableOnlyDesc: { en: "The stream picker hides unplayable sources by default", ar: "يخفي منتقي البثوث المصادر غير القابلة للتشغيل افتراضياً" },
  preferH264: { en: "Prefer H.264/AAC", ar: "تفضيل H.264/AAC" },
  preferH264Desc: { en: "Rank browser-safe codecs above HEVC when sorting streams", ar: "ترتيب الترميزات المتوافقة مع المتصفح فوق HEVC عند الفرز" },
  seekStep: { en: "Seek step", ar: "خطوة التنقل" },
  seekStepDesc: { en: "Arrow keys seek ±{n}s", ar: "أسهم لوحة المفاتيح تنقل ±{n}ث" },
  subSize: { en: "Subtitles size", ar: "حجم الترجمات" },
  subBackground: { en: "Subtitle background", ar: "خلفية الترجمات" },
  subBackgroundDesc: { en: "{n}% opacity behind text", ar: "شفافية {n}% خلف النص" },
  subBorder: { en: "Subtitle border", ar: "حدود الترجمات" },
  subBorderDesc: { en: "{n}px outline", ar: "تحديد بسماكة {n}بكسل" },
  videoFill: { en: "Video fill", ar: "ملء الفيديو" },
  videoFillDesc: { en: "How video fits the screen", ar: "كيفية ملاءمة الفيديو للشاشة" },
  playerChrome: { en: "Player chrome", ar: "مظهر المشغّل" },
  playerChromeDesc: { en: "Stremio-style or Horse-style controls", ar: "أزرار بأسلوب Stremio أو Horse" },
  pickerLayout: { en: "Stream picker layout", ar: "تخطيط منتقي البثوث" },
  pickerLayoutDesc: { en: "Condensed rows or Stremio-style tiers", ar: "صفوف مضغوطة أو فئات بأسلوب Stremio" },
  qualityInfo: { en: "Quality info in picker", ar: "معلومات الجودة في المنتقي" },
  qualityInfoDesc: { en: "Show codec, size and source details", ar: "إظهار الترميز والحجم وتفاصيل المصدر" },

  // ---- P2P card ----
  p2pTitle: { en: "P2P Torrent Engine", ar: "محرك تورنت P2P" },
  p2pSubtitle: { en: "Play torrents without any account — server-side BitTorrent", ar: "شغّل التورنتات دون أي حساب — BitTorrent من جهة الخادم" },
  p2pToggle: { en: "Play torrents via P2P", ar: "تشغيل التورنتات عبر P2P" },
  p2pToggleDesc: { en: "Join swarms directly when a stream addon only offers torrents. Debrid stays the faster path for cached releases.", ar: "انضم إلى الأسراب مباشرة عندما يقدّم ملحق البث ملفات تورنت فقط. ويبقى Debrid المسار الأسرع للإصدارات المخزَّنة مؤقتاً." },
  p2pAria: { en: "Toggle P2P torrent playback", ar: "تبديل تشغيل التورنت عبر P2P" },
  p2pNoSwarms: { en: "No active swarms", ar: "لا توجد أسراب نشطة" },
  p2pSwarms: { en: "{n} active swarm · {speed}", ar: "سرب نشط واحد · {speed}", arOther: "{n} أسراب نشطة · {speed}" },
  p2pError: { en: "Torrent engine is not reachable — P2P playback will fail until the torrent-service is running. Debrid playback is unaffected.", ar: "محرك التورنت غير قابل للوصول — لن يعمل تشغيل P2P حتى تشغيل خدمة التورنت. تشغيل Debrid غير متأثر." },
  p2pNote: { en: "Torrents download to a server-side cache and stream over HTTP (native containers) or through an ffmpeg remux (mkv). Idle swarms are evicted after 45 minutes; swarms that never find peers are dropped after 90 seconds.", ar: "تُنزَّل التورنتات إلى ذاكرة تخزين على الخادم وتُبث عبر HTTP (للحاويات المدعومة أصلاً) أو عبر إعادة تغليف بواسطة ffmpeg (لملفات mkv). تُطرد الأسراب الخاملة بعد 45 دقيقة؛ وتُهجر الأسراب التي لا تجد أقراناً بعد 90 ثانية." },
  p2pStopAll: { en: "Stop all", ar: "إيقاف الكل" },
  p2pWipe: { en: "Wipe cache", ar: "مسح ذاكرة التخزين" },
  p2pPeers: { en: "{n} peers", ar: "{n} أقران" },
  cacheWiped: { en: "Torrent cache wiped", ar: "تم مسح ذاكرة التورنت" },
  cacheWipedBody: { en: "All downloaded P2P data has been deleted.", ar: "تم حذف جميع بيانات P2P التي تم تنزيلها." },
  torrentsStopped: { en: "Torrents stopped", ar: "تم إيقاف التورنتات" },
  torrentsStoppedBody: { en: "Active swarms were closed; cache kept for resume.", ar: "أُغلقت الأسراب النشطة؛ واحتُفظ بالذاكرة للاستئناف." },
  cleanupFailed: { en: "Cleanup failed", ar: "فشل التنظيف" },
  engineChipNone: { en: "Not available on this host", ar: "غير متاح على هذا المضيف" },
  engineChipExternal: { en: "External engine", ar: "محرك خارجي" },
  engineServerlessTitle: { en: "Torrent playback on serverless hosting", ar: "تشغيل التورنتات على استضافة serverless" },
  engineServerlessBody: {
    en: "This deployment (e.g. Vercel) cannot run the BitTorrent engine, so torrent-only results are refused here. Three ways to enable them:",
    ar: "هذا النشر (مثل Vercel) لا يستطيع تشغيل محرك BitTorrent، لذلك تُرفض النتائج المعتمدة على التورنت فقط. هناك ثلاث طرق لتفعيلها:",
  },
  engineDebridOption: {
    en: "Debrid (easiest) — add your API key in the Debrid card above; cached torrents unlock instantly as direct HTTPS streams.",
    ar: "Debrid (الأسهل) — أضف مفتاح API في بطاقة Debrid أعلاه؛ تُفتح التورنتات المخزنة مؤقتاً فوراً كروابط HTTPS مباشرة.",
  },
  engineSelfhostOption: {
    en: "Self-hosted engine (full P2P) — run the engine on any always-on server, then set these variables in your Vercel project and redeploy:",
    ar: "محرك ذاتي الاستضافة (P2P كامل) — شغّل المحرك على أي خادم دائم التشغيل، ثم عيّن هذه المتغيرات في مشروع Vercel وأعد النشر:",
  },
  engineLocalOption: {
    en: "Free, no server needed — run the engine on THIS device (or any computer on your network) with one command, then connect it below. The browser talks to it directly.",
    ar: "مجاناً ودون خادم — شغّل المحرك على هذا الجهاز (أو أي جهاز في شبكتك) بأمر واحد، ثم اربطه أدناه. يتواصل المتصفح معه مباشرة.",
  },
  localEngineTitle: { en: "Engine on this device", ar: "المحرك على هذا الجهاز" },
  localEngineBody: {
    en: "Point Horse at the engine running on your own computer (mini-services/torrent-service). Stay running while you watch; the setting is kept on this device only.",
    ar: "وجّه Horse إلى المحرك العامل على جهازك (mini-services/torrent-service). أبقِه يعمل أثناء المشاهدة؛ ويُحفظ هذا الإعداد على هذا الجهاز فقط.",
  },
  localEngineHowLabel: {
    en: "One-time setup on your computer (needs Node 18+ and ffmpeg):",
    ar: "إعداد لمرة واحدة على جهازك (يتطلب Node 18+ و ffmpeg):",
  },
  localEngineUrlLabel: { en: "Engine address", ar: "عنوان المحرك" },
  localEngineKeyLabel: { en: "Engine key (optional)", ar: "مفتاح المحرك (اختياري)" },
  localEngineSave: { en: "Save & test", ar: "حفظ واختبار" },
  localEngineSaved: { en: "Local engine connected — torrents now play on this device.", ar: "تم ربط المحرك المحلي — تعمل التورنتات الآن على هذا الجهاز." },
  localEngineRemove: { en: "Remove", ar: "إزالة" },
  localEngineRemoved: { en: "Local engine removed.", ar: "تمت إزالة المحرك المحلي." },
  localEngineChip: { en: "Local engine", ar: "محرك محلي" },
  localEngineTestOk: {
    en: "Local engine connected — torrent streams will play through it on this device.",
    ar: "المحرك المحلي يستجيب — ستُشغَّل تدفقات التورنت عبره على هذا الجهاز.",
  },
  localEngineTestUnreachable: {
    en: "No engine answered at that address — start it there (npm install && npm start), check the address/port, and that this browser may reach it.",
    ar: "لا يوجد محرك يستجيب على هذا العنوان — شغّله هناك (npm install && npm start)، وتحقق من العنوان/المنفذ ومن أن هذا المتصفح يمكنه الوصول إليه.",
  },
  localEngineTestUnauthorized: {
    en: "Key mismatch — the key must equal the engine's ENGINE_API_KEY (leave empty when the engine has none).",
    ar: "عدم تطابق المفتاح — يجب أن يساوي المفتاح قيمة ENGINE_API_KEY في المحرك (اتركه فارغاً إذا لم يضبط المحرك مفتاحاً).",
  },
  localEngineTestBad: {
    en: "That is not a valid engine address — use something like http://localhost:3031",
    ar: "عنوان المحرك غير صالح — استخدم شيئاً مثل http://localhost:3031",
  },
  engineSetupGuide: { en: "Deployment guide", ar: "دليل النشر" },
  freeHostingGuide: { en: "Free 24/7 hosting guide", ar: "دليل الاستضافة المجانية 24/7" },
  freeHostingHint: {
    en: "Want it always-on without leaving your computer on? Oracle's free tier runs the engine 24/7 for $0 — step-by-step guide inside.",
    ar: "تريده دائماً في الخدمة دون إبقاء كمبيوترك شغّالاً؟ الطبقة المجانية من Oracle تشغّل المحرك 24/7 بـ $0 — الدليل خطوة بخطوة بالداخل.",
  },
  // ---- in-browser engine (WebTorrent — zero install) ----
  browserEngineTitle: { en: "In-browser engine — zero install", ar: "محرك داخل المتصفح — بدون تثبيت" },
  browserEngineBody: {
    en: "Turn this browser itself into the torrent engine: nothing to install, nothing to host, one switch. It joins the swarm over WebRTC and plays straight in the player.",
    ar: "حوّل هذا المتصفح نفسه إلى محرك تورنت: لا شيء لتثبيته ولا شيء لاستضافته — مفتاح واحد فقط. ينضم إلى السرب عبر WebRTC ويشغّل الفيديو داخل المشغّل مباشرة.",
  },
  browserEngineToggle: { en: "Play torrents in this browser", ar: "تشغيل التورنتات داخل هذا المتصفح" },
  browserEngineChip: { en: "Browser engine", ar: "محرك المتصفح" },
  browserEngineTest: { en: "Test it now (one click)", ar: "جرّبه الآن (بضغطة واحدة)" },
  browserEngineTestLoading: { en: "Loading the engine and contacting trackers…", ar: "جارٍ تحميل المحرك والاتصال بالتتبّعات…" },
  browserEngineTestSwarm: { en: "Joining a real swarm — web peers so far:", ar: "جارٍ الانضمام إلى سرب حقيقي — أقران الويب حتى الآن:" },
  browserEngineTestOk: {
    en: "It works — reached real web peers from this network. Torrent streams with web peers will now play right here.",
    ar: "يعمل — تم الوصول إلى أقران ويب حقيقيين من هذه الشبكة. تدفقات التورنت التي لديها أقران ويب ستُشغَّل هنا مباشرة.",
  },
  browserEngineTestNoPeers: {
    en: "No web peers answered within 25s — the network may block WebRTC or the probe swarm is quiet. Real torrents may still work; the player shows live peer counts either way.",
    ar: "لم يستجب أي أقران ويب خلال 25 ثانية — قد تحجب الشبكة WebRTC أو أن سرب الاختبار هادئ. قد تعمل التورنتات الحقيقية مع ذلك؛ سيعرض المشغّل عدّاد الأقران مباشرة في الحالتين.",
  },
  browserEngineTestLoadFailed: {
    en: "Could not load the engine script (CDN blocked by network/filtering?) — check the connection and try again.",
    ar: "تعذّر تحميل سكربت المحرك (شبكة/فلترة تحجب CDN؟) — تحقق من الاتصال وحاول مجدداً.",
  },
  browserEngineDeviceUnsupported: {
    en: "This browser doesn't expose WebRTC data channels + MSE, so the in-browser engine can't run here (typical for PlayStation and older TV browsers).",
    ar: "متصفح هذا الجهاز لا يوفر قنوات WebRTC و MSE، لذا لا يمكن تشغيل المحرك داخل المتصفح هنا (الشائع في بلايستيشن ومتصفحات التلفاز القديمة).",
  },
  browserEngineConsoleNote: {
    en: "Console/TV browsers are limited: this may or may not work here — the test button is the truth. A computer or Android in the same home is the reliable engine host.",
    ar: "متصفحات الكونسول/التلفاز محدودة: قد يعمل هذا هنا أو لا — زر الاختبار هو الفيصل. كمبيوتر أو أندرويد في المنزل نفسه هو المضيف الموثوق للمحرك.",
  },
  browserEngineLimits: {
    en: "Honest limits: a browser only reaches “web peers” (WebRTC/WSS) — a subset of every swarm — and can't remux MKV or decode HEVC. The file downloads fully before playback starts (live progress shown). mp4/H.264 works best; MKV/HEVC need the engine app or debrid.",
    ar: "حدود صادقة: المتصفح يصل فقط إلى «أقران الويب» (WebRTC/WSS) — جزء من كل سرب — ولا يستطيع تحويل MKV أو فك ترميز HEVC. يكتمل تنزيل الملف قبل بدء التشغيل (مع عرض التقدم مباشرة). إصدارات mp4/H.264 تعمل بأفضل شكل؛ أما MKV/HEVC فتحتاج تطبيق المحرك أو debrid.",
  },
  browserEngineJoining: { en: "Starting the in-browser engine…", ar: "جارٍ تشغيل المحرك داخل المتصفح…" },
  browserEngineHevc: {
    en: "This release is HEVC — the in-browser engine can't decode it. Debrid or the engine app unlocks it.",
    ar: "هذا الإصدار بصيغة HEVC — المحرك داخل المتصفح لا يستطيع فك ترميزها. debrid أو تطبيق المحرك يفتحها.",
  },
  browserEngineContainer: {
    en: "This file is MKV/AVI — the in-browser engine can't remux containers. mp4 releases play; MKV needs the engine app or debrid.",
    ar: "هذا الملف بصيغة MKV/AVI — المحرك داخل المتصفح لا يستطيع تحويل الحاويات. إصدارات mp4 تعمل؛ أما MKV فتحتاج تطبيق المحرك أو debrid.",
  },
  browserEngineErrNoWebrtc: {
    en: "This browser can't run the in-browser engine (no WebRTC data channels).",
    ar: "لا يمكن لهذا المتصفح تشغيل المحرك داخل المتصفح (لا توجد قنوات WebRTC).",
  },
  browserEngineErrLoadFailed: {
    en: "Couldn't load the in-browser engine script — the network may block the CDN.",
    ar: "تعذّر تحميل سكربت المحرك داخل المتصفح — قد تحجب الشبكة CDN.",
  },
  browserEngineErrNoPeers: {
    en: "No web peers answered — this torrent has no browser-reachable peers right now. Try the engine app or debrid.",
    ar: "لم يستجب أي أقران ويب — لا يوجد لهذا التورنت أقران يمكن للمتصفح الوصول إليهم حالياً. جرّب تطبيق المحرك أو debrid.",
  },
  browserEngineErrMetadataTimeout: {
    en: "Peers connected but the torrent metadata never arrived — the swarm is too quiet for the in-browser engine.",
    ar: "اتصل أقران لكن بيانات التورنت لم تصل — السرب هادئ جداً بالنسبة للمحرك داخل المتصفح.",
  },
  browserEngineErrUnsupportedContainer: {
    en: "This file's container can't play in the browser — only mp4/webm streams without remux.",
    ar: "لا يمكن تشغيل حاوية هذا الملف في المتصفح — البث المباشر لملفات mp4/webm فقط.",
  },
  browserEngineErrNoVideoFile: {
    en: "No video file found in this torrent.",
    ar: "لم يُعثر على ملف فيديو في هذا التورنت.",
  },
  browserEngineErrRenderFailed: {
    en: "The browser couldn't render this stream — the codecs may be unsupported.",
    ar: "لم يستطع المتصفح عرض هذا البث — قد تكون الترميزات غير مدعومة.",
  },
  p2pBannerBrowser: {
    en: "Torrents play through the in-browser engine (web peers over WebRTC) — zero install. Connect debrid for instant cached links.",
    ar: "تعمل التورنتات عبر المحرك داخل المتصفح (أقران ويب عبر WebRTC) — بدون أي تثبيت. اربط debrid للحصول على روابط مخزنة فورية.",
  },
  oneClickTitle: { en: "One-click start (computers)", ar: "تشغيل بضغطة واحدة (أجهزة الكمبيوتر)" },
  oneClickDesc: {
    en: "First time only: download the installer and run it once — it installs a small engine on this computer and registers the horse-engine:// trigger. After that, the Start button launches it and tests it automatically.",
    ar: "المرة الأولى فقط: نزّل المُثبّت وشغّله مرة واحدة — يثبّت محركاً صغيراً على هذا الكمبيوتر ويسجّل رابط التشغيل horse-engine://. بعدها يكفي زر «تشغيل المحرك» ليبدأ المحرك ويُختبر تلقائياً.",
  },
  oneClickDownload: { en: "Download installer (once)", ar: "تنزيل المُثبّت (مرة واحدة)" },
  oneClickRun: { en: "Start engine", ar: "تشغيل المحرك" },
  oneClickRunHint: {
    en: "Nothing happened? The installer hasn't been run on this computer yet — download it above and run it once, then press Start again.",
    ar: "لم يحدث شيء؟ المُثبّت لم يُشغَّل على هذا الكمبيوتر بعد — نزّله بالأعلى وشغّله مرة واحدة، ثم اضغط «تشغيل المحرك» مجدداً.",
  },
  oneClickTerminalHint: {
    en: "macOS / Linux: after downloading, run it once from the terminal: bash ~/Downloads/install-…",
    ar: "ماك / لينكس: بعد التنزيل، شغّله مرة واحدة من الطرفية: bash ~/Downloads/install-…",
  },
  oneClickConsoleNote: {
    en: "This screen (console / TV) can't install the engine — Xbox and PlayStation browsers are sealed and accept no installed apps. Use debrid for instant playback here, or run the engine on another device at home (a computer, or Android via Termux) and reach it over an HTTPS address.",
    ar: "هذه الشاشة (كونسول / تلفاز) لا يمكنها تثبيت المحرك — متصفحات الإكس بوكس وبلايستيشن مغلقة ولا تقبل تثبيت أي تطبيقات. استخدم debrid للتشغيل الفوري هنا، أو شغّل المحرك على جهاز آخر في منزلك (كمبيوتر، أو أندرويد عبر Termux) واقتبسه عبر رابط HTTPS.",
  },
  oneClickMobileNote: {
    en: "Phones can't run the desktop engine from the browser — on Android you can host it with Termux, or watch through an engine running on a computer in the same home (via an HTTPS address).",
    ar: "الجوالات لا تشغّل محرك الكمبيوتر من المتصفح — على أندرويد يمكنك استضافته عبر Termux، أو المشاهدة عبر محرك يعمل على كمبيوتر في المنزل نفسه (عبر رابط HTTPS).",
  },
  engineTest: { en: "Test engine", ar: "اختبار المحرك" },
  engineTestOk: { en: "Engine reachable — torrent streams will play through it.", ar: "المحرك يستجيب — ستُشغَّل تدفقات التورنت عبره." },
  engineTestUnset: { en: "ENGINE_URL is not set on this deployment yet — add it in Vercel and redeploy.", ar: "المتغير ENGINE_URL غير معيّن على هذا النشر بعد — أضفه في Vercel وأعد النشر." },
  engineTestUnreachable: { en: "Engine unreachable — check ENGINE_URL and that the engine process is running.", ar: "المحرك لا يستجيب — تحقق من ENGINE_URL ومن أن عملية المحرك تعمل." },
  engineTestUnauthorized: { en: "Key mismatch — ENGINE_API_KEY differs between the app and the engine.", ar: "عدم تطابق المفتاح — ENGINE_API_KEY مختلف بين التطبيق والمحرك." },
  engineHostLabel: { en: "Engine host", ar: "مضيف المحرك" },
  p2pChecking: { en: "Checking the torrent engine…", ar: "جارٍ فحص محرك التورنت…" },
  p2pUnavailable: {
    en: "P2P playback is not available on this deployment — the torrent engine can't run here (serverless hosting). Torrents unlock instantly with a debrid key (Settings → Integrations), or pick a direct (HTTP) stream from the picker.",
    ar: "تشغيل P2P غير متاح في هذه البيئة — لا يمكن تشغيل محرك التورنت هنا (استضافة serverless). تُفتح التورنتات فوراً بمفتاح debrid (الإعدادات ← التكاملات)، أو اختر بثاً مباشراً (HTTP) من المنتقي.",
  },
  errTryDirect: { en: "Try a direct stream", ar: "جرّب بثاً مباشراً" },
  errSetupDebrid: { en: "Set up debrid", ar: "إعداد debrid" },
  p2pBannerBuiltin: {
    en: "Torrent streams play through the built-in P2P engine — no account needed. Connect debrid for instant cached links.",
    ar: "تعمل تدفقات التورنت عبر محرك P2P المدمج — لا حاجة إلى حساب. اربط debrid للحصول على روابط مخزنة مؤقتًا بشكل فوري.",
  },
  p2pBannerServerless: {
    en: "Torrents can't play on this serverless host — a debrid key unlocks them instantly (cached torrents skip the download entirely).",
    ar: "لا يمكن تشغيل التورنتات على هذا المضيف serverless — يفتحها مفتاح debrid فوراً (التورنتات المخزنة مؤقتاً تتخطى التنزيل بالكامل).",
  },
  debridUnlocking: { en: "Unlocking with debrid…", ar: "جارٍ الفتح عبر debrid…" },
  debridUnlockFailed: { en: "Debrid unlock failed", ar: "فشل الفتح عبر debrid" },
  debridTorboxFreeNote: {
    en: "TorBox works on the FREE plan: cached torrents play instantly; uncached ones download on TorBox first (free = 1 active download slot) — press play again in a few minutes. Watched torrents stay in your TorBox dashboard.",
    ar: "يعمل TorBox على الخطة المجانية: التورنتات المخزّنة مؤقتًا تُشغَّل فورًا؛ أما غير المخزّنة فيُحمَّل أولًا على TorBox (المجانية = خانة تنزيل نشطة واحدة) — اضغط تشغيل من جديد بعد بضع دقائق. تبقى التورنتات التي شاهدتها في لوحة حسابك على TorBox.",
  },
  // ---- debrid key management (set / delete from settings) ----
  debridDeleteKey: { en: "Delete key from this device", ar: "مسح المفتاح من هذا الجهاز" },
  debridDeleteKeyTitle: { en: "Delete your API key from this browser?", ar: "مسح مفتاح API من هذا المتصفح؟" },
  debridDeleteKeyBody: {
    en: "This device forgets your {name} key immediately. Your {name} account is untouched — paste the key again anytime, or send it here from your phone.",
    ar: "سينسى هذا الجهاز مفتاح {name} فوراً. حسابك في {name} لا يتأثر — يمكنك لصق المفتاح مجدداً في أي وقت، أو إرساله من جوالك إلى هنا.",
  },
  debridKeyDeleted: { en: "Key deleted from this browser", ar: "تم مسح المفتاح من هذا المتصفح" },
  debridKeyHintFind: { en: "Paste the key, then validate it — it is checked against the service before it is saved.", ar: "الصق المفتاح ثم تحقق منه — يُفحص عند الخدمة نفسها قبل حفظه." },
  // ---- device pairing (big screen ↔ phone) ----
  pairCardTitle: { en: "Link a screen via phone", ar: "اربط شاشة عبر الجوال" },
  pairCardDesc: {
    en: "Watching on a TV, laptop or iPad? Show a code here, then send your key from the phone in one tap — no typing on the big screen.",
    ar: "تشاهد على تلفزيون أو لابتوب أو آيباد؟ أظهر الكود هنا ثم أرسل مفتاحك من الجوال بضغطة واحدة — بدون كتابة على الشاشة الكبيرة.",
  },
  pairStart: { en: "Show pairing code", ar: "إظهار كود الربط" },
  pairStarting: { en: "Generating…", ar: "جارٍ الإنشاء…" },
  pairScanTitle: { en: "Scan with your phone", ar: "امسح بجوالك" },
  pairScanHint: {
    en: "Scan the QR with the phone camera — Horse opens ready to send the key. No QR? On the phone open Horse → Settings → Integrations → Debrid → \u00abSend key to a screen\u00bb and type the code.",
    ar: "امسح رمز QR بكاميرا الجوال — يفتح Horse جاهزاً لإرسال المفتاح. لا يوجد QR؟ على الجوال افتح Horse ← الإعدادات ← التكاملات ← Debrid ← «أرسل المفتاح إلى شاشة» واكتب الكود.",
  },
  pairCodeLabel: { en: "Pairing code", ar: "كود الربط" },
  pairWaiting: { en: "Waiting for your phone…", ar: "بانتظار جوالك…" },
  pairExpired: { en: "Code expired — generate a new one.", ar: "انتهت صلاحية الكود — أنشئ كوداً جديداً." },
  pairNewCode: { en: "New code", ar: "كود جديد" },
  pairCancel: { en: "Cancel pairing", ar: "إلغاء الربط" },
  pairLinkedTitle: { en: "Screen linked!", ar: "تم ربط الشاشة!" },
  pairLinkedDesc: {
    en: "This screen now uses {name} ({plan}). Press play on any torrent title.",
    ar: "هذه الشاشة تستخدم {name} ({plan}) الآن. اضغط تشغيل على أي عنوان تورنت.",
  },
  pairReceiveOpen: { en: "Send key to a screen", ar: "أرسل المفتاح إلى شاشة" },
  pairReceiveTitle: { en: "Send key to the screen?", ar: "إرسال المفتاح إلى الشاشة؟" },
  pairReceiveDesc: {
    en: "A screen is waiting for code {code}. Send your saved {name} key to it?",
    ar: "شاشة بانتظار الكود {code}. أرسل مفتاح {name} المحفوظ لديك إليها؟",
  },
  pairReceiveEnterCode: { en: "Screen code", ar: "كود الشاشة" },
  pairReceiveNoKey: {
    en: "No debrid key is saved on this device. Paste it below — it will be sent to the screen and saved here too.",
    ar: "لا يوجد مفتاح Debrid محفوظ على هذا الجهاز. الصقه أدناه — سيُرسل إلى الشاشة ويُحفظ هنا أيضاً.",
  },
  pairReceiveSavedKey: { en: "Send my saved key", ar: "أرسل مفتاحي المحفوظ" },
  pairSend: { en: "Send", ar: "إرسال" },
  pairSending: { en: "Sending…", ar: "جارٍ الإرسال…" },
  pairSent: { en: "Key sent — the screen is ready.", ar: "تم إرسال المفتاح — الشاشة جاهزة." },
  pairFailed: { en: "Could not send the key", ar: "تعذّر إرسال المفتاح" },
  pairWrongCode: { en: "Wrong or expired code — check the screen and try again.", ar: "كود خاطئ أو منتهٍ — تحقق من الشاشة وحاول مجدداً." },
  pairAlreadyUsed: { en: "This code was already used — generate a new one on the screen.", ar: "هذا الكود مستخدم بالفعل — أنشئ كوداً جديداً على الشاشة." },
  pairSecurity: {
    en: "Codes are single-use and expire in 10 minutes. The key travels encrypted and is never logged — the relay deletes it the moment the screen receives it.",
    ar: "الكود للاستخدام مرة واحدة وتنتهي صلاحيته بعد 10 دقائق. ينتقل المفتاح مشفراً ولا يُسجَّل أبداً — يحذفه الوسيط لحظة استلام الشاشة له.",
  },
  // ---- Per-service debrid QR linking (laptop / tablet / TV) ----
  // Each debrid service gets its OWN QR flow, fully independent: the QR born
  // on the TorBox tab is pinned to TorBox server-side and can only be
  // satisfied with a TorBox key — AllDebrid / Real-Debrid flows never touch it.
  pairQrStart: { en: "Link {name} via QR", ar: "اربط {name} عبر QR" },
  pairQrLinkedTitle: { en: "{name} linked on this screen!", ar: "تم ربط {name} على هذه الشاشة!" },
  pairQrLinkedDesc: {
    en: "{name} ({plan}) is ready — press play on any torrent title.",
    ar: "{name} ({plan}) جاهز — اضغط تشغيل على أي عنوان تورنت.",
  },
  pairReceivePinned: {
    en: "The screen is waiting for your {name} key.",
    ar: "الشاشة بانتظار مفتاح {name}.",
  },
  pairReceivePinnedSaved: {
    en: "Send the saved {name} key to the screen?",
    ar: "إرسال مفتاح {name} المحفوظ إلى الشاشة؟",
  },
  pairReceivePinnedNoKey: {
    en: "No {name} key is saved on this device — paste it below and it will be sent to the screen and saved here too.",
    ar: "لا يوجد مفتاح {name} محفوظ على هذا الجهاز — ألصقه بالأسفل ليُرسَل إلى الشاشة ويُحفَظ هنا أيضاً.",
  },
  pairReceivePinnedNote: {
    en: "This QR is bound to {name} — other debrid services can't claim it.",
    ar: "رمز QR هذا مرتبط بـ {name} — خدمات ديبريد الأخرى لا يمكنها استخدامه.",
  },
  pairServiceMismatch: {
    en: "This code belongs to a different debrid service.",
    ar: "هذا الكود يخص خدمة ديبريد مختلفة.",
  },
  pairPeekFailed: {
    en: "Could not check the code — make sure the screen is still showing it.",
    ar: "تعذّر التحقق من الكود — تأكد أن الشاشة لا تزال تعرضه.",
  },
  pairKeyFind: { en: "Get it from {url}", ar: "تجده في {url}" },
  // ---- Integration toasts (previously hardcoded English — now real i18n) ----
  debridValidateFirst: { en: "Paste your API key first", ar: "ألصق مفتاح API أولاً" },
  debridConnected: { en: "{name} connected", ar: "تم ربط {name}" },
  debridConnectedDesc: { en: "{name} account verified.", ar: "تم التحقق من حساب {name}." },
  debridValidateFailed: { en: "Validation failed", ar: "فشل التحقق" },
  debridPickerConnectedDesc: {
    en: "{name} verified — cached streams unlock instantly now.",
    ar: "تم التحقق من {name} — ستعمل البثوث المخزنة مؤقتاً فوراً الآن.",
  },
  traktToastConnected: { en: "Trakt connected", ar: "تم ربط Trakt" },
  traktToastConnectedDesc: {
    en: "You can now import your watchlist.",
    ar: "يمكنك الآن استيراد قائمة المشاهدة.",
  },
  traktToastDisconnected: { en: "Trakt disconnected", ar: "تم قطع اتصال Trakt" },
  traktToastCancelled: { en: "Trakt connection cancelled", ar: "تم إلغاء اتصال Trakt" },
  simklToastConnected: { en: "Simkl connected", ar: "تم ربط Simkl" },
  simklToastConnectedDesc: {
    en: "You can now import your watchlist.",
    ar: "يمكنك الآن استيراد قائمة المشاهدة.",
  },
  simklToastDisconnected: { en: "Simkl disconnected", ar: "تم قطع اتصال Simkl" },
  simklToastCancelled: { en: "Simkl connection cancelled", ar: "تم إلغاء اتصال Simkl" },
  integrImportFailed: { en: "Import failed", ar: "فشل الاستيراد" },
  integrHistoryImportFailed: { en: "History import failed", ar: "فشل استيراد السجل" },
  integrPushFailed: { en: "Push failed", ar: "فشل الدفع" },
  // ---- QR sign-in (big screen ↔ logged-in phone) ----
  // A TV/laptop/tablet that isn't signed in shows XXX-XXX + QR (#qrlogin=CODE);
  // the signed-in phone approves, the screen's next status poll carries the
  // session cookie, then the SAME merge-strategy handoff as password login runs.
  qrTabTitle: { en: "Sign in with phone", ar: "الدخول عبر الجوال" },
  qrLoginHint: {
    en: "Scan this code with your logged-in phone — approving there signs this screen in automatically.",
    ar: "امسح الرمز بجوالك المسجَّل فيه — عند الموافقة من الجوال يسجّل هذا الجهاز الدخول تلقائياً.",
  },
  qrLoginStep1: { en: "Open Horse on your phone", ar: "افتح Horse على جوالك" },
  qrLoginStep2: { en: "Scan the QR or enter the code", ar: "امسح رمز QR أو أدخل الرمز" },
  qrLoginStep3: { en: "Approve the sign-in", ar: "وافق على تسجيل الدخول" },
  qrCodeLabel: { en: "Sign-in code", ar: "رمز الدخول" },
  qrWaiting: { en: "Waiting for approval from your phone…", ar: "بانتظار الموافقة من جوالك…" },
  qrApproved: { en: "Signed in!", ar: "تم تسجيل الدخول!" },
  qrDenied: { en: "The sign-in was declined on the phone.", ar: "تم رفض تسجيل الدخول من الجوال." },
  qrExpired: { en: "The code expired — generate a new one.", ar: "انتهت صلاحية الرمز — أنشئ رمزاً جديداً." },
  qrTryAgain: { en: "Try again", ar: "حاول مجدداً" },
  qrNewCode: { en: "New code", ar: "رمز جديد" },
  qrCreateFailed: {
    en: "Could not generate a code — check your connection and try again.",
    ar: "تعذّر إنشاء رمز — تحقق من الاتصال وحاول مجدداً.",
  },
  qrCodeCopied: { en: "Code copied", ar: "تم نسخ الرمز" },
  qrApproveTitle: { en: "Approve sign-in?", ar: "الموافقة على تسجيل الدخول؟" },
  qrApproveEnterCode: { en: "Or enter the code", ar: "أو أدخل الرمز" },
  qrApproveDesc: {
    en: "A device is asking to sign in to your HORSE account:",
    ar: "يطلب جهازٌ تسجيل الدخول إلى حسابك في Horse:",
  },
  qrApproveConfirm: { en: "Approve", ar: "موافقة" },
  qrApproveDeny: { en: "Deny", ar: "رفض" },
  qrApproveNeedLogin: { en: "Sign in on this phone first", ar: "سجِّل الدخول في هذا الجوال أولاً" },
  qrApproveNeedLoginDesc: {
    en: "Approving a sign-in request needs a signed-in HORSE account on this device.",
    ar: "الموافقة على طلب تسجيل الدخول تتطلب حساب Horse مسجَّلاً على هذا الجهاز.",
  },
  qrApproveGoLogin: { en: "Go to sign in", ar: "الانتقال إلى تسجيل الدخول" },
  qrApproveCheck: { en: "Check code", ar: "تحقق من الرمز" },
  qrApproveChecking: { en: "Checking…", ar: "جارٍ التحقق…" },
  qrApproveSuccess: {
    en: "Approved — the other screen is signing in.",
    ar: "تمت الموافقة — الشاشة الأخرى تسجّل الدخول الآن.",
  },
  qrApproveInvalid: {
    en: "Wrong or expired code — check the screen and try again.",
    ar: "رمز خاطئ أو منتهي الصلاحية — تحقق من الشاشة وحاول مجدداً.",
  },
  qrApproveUsed: { en: "This code was already used.", ar: "هذا الرمز مستخدم بالفعل." },
  qrApproveFailed: { en: "Something went wrong — try again.", ar: "حدث خطأ ما — حاول مجدداً." },
  qrApproveOpenRow: { en: "Approve a sign-in code", ar: "الموافقة على رمز دخول" },
  // ---- addon transfer codes (device ↔ device, 6-minute single-use code) ----
  transferAction: { en: "Transfer addons", ar: "نقل الإضافات" },
  transferSendTitle: { en: "Transfer your addons", ar: "نقل إضافاتك" },
  transferSendDesc: {
    en: "Scan the QR with the other device, or enter the code there — every addon on this device moves over. The code is single-use and valid for 6 minutes.",
    ar: "امسح رمز QR بالجهاز الآخر أو أدخل الرمز هناك — ستُنقل كل إضافات هذا الجهاز. الرمز للاستخدام مرة واحدة وصالح لمدة ٦ دقائق.",
  },
  transferSendCount: {
    en: "{n} addons on this device will move over.",
    ar: "ستنتقل {n} من إضافات هذا الجهاز.",
  },
  transferReceiverTitle: { en: "Receive addons", ar: "استلام الإضافات" },
  transferReceiverDesc: {
    en: "Enter the code shown on the other device — its addons are copied here. Addons you already have stay untouched.",
    ar: "أدخل الرمز الظاهر على الجهاز الآخر — تُنسخ إضافاته إلى هنا. الإضافات الموجودة لديك تبقى كما هي.",
  },
  transferEnterCode: { en: "Transfer code", ar: "رمز النقل" },
  transferWaiting: { en: "Waiting for the other device…", ar: "بانتظار الجهاز الآخر…" },
  transferClaimBtn: { en: "Transfer here", ar: "انقلها إلى هنا" },
  transferClaiming: { en: "Receiving…", ar: "جارٍ الاستلام…" },
  transferSuccess: {
    en: "{count} addon(s) transferred to this device.",
    ar: "تم نقل إضافة واحدة إلى هذا الجهاز.",
    arOther: "تم نقل {count} من الإضافات إلى هذا الجهاز.",
  },
  transferPartial: {
    en: "{added} added · {skipped} already present.",
    ar: "أُضيف واحد · {skipped} موجودة مسبقاً.",
    arOther: "{added} أُضيفت · {skipped} موجودة مسبقاً.",
  },
  transferInvalid: { en: "Wrong or expired code.", ar: "رمز خاطئ أو منتهي الصلاحية." },
  transferAlready: { en: "This code was already used.", ar: "هذا الرمز مستخدم بالفعل." },
  transferCopied: { en: "Code copied", ar: "تم نسخ الرمز" },
  transferCancel: { en: "Cancel transfer", ar: "إلغاء النقل" },
  transferCreateFailed: {
    en: "Could not generate a code — check your connection and try again.",
    ar: "تعذّر إنشاء رمز — تحقق من الاتصال وحاول مجدداً.",
  },
  transferFailed: { en: "Something went wrong — try again.", ar: "حدث خطأ ما — حاول مجدداً." },
  transferEmpty: {
    en: "No addons to transfer yet — install one first.",
    ar: "لا توجد إضافات لنقلها بعد — ثبّت إضافة أولاً.",
  },
  noPlayableStream: {
    en: "No browser-playable stream found. Open the stream picker to choose manually — torrent streams unlock with debrid, or play via the P2P engine when available.",
    ar: "لم يُعثر على بث قابل للتشغيل في المتصفح. افتح منتقي البثوث للاختيار يدوياً — تُفتح التورنتات عبر debrid، أو تُشغَّل عبر محرك P2P عند توافره.",
  },
  noPeersFound: {
    en: "No peers responded for the best torrent. The swarm may be dead or this network blocks BitTorrent. Open the picker to try another source, or connect debrid for instant cached streams.",
    ar: "لم يستجب أي أقران لأفضل تورنت. قد يكون السرب ميتاً أو أن الشبكة تحجب BitTorrent. افتح المنتقي لتجربة مصدر آخر، أو اربط debrid للحصول على بثوث مخزّنة فورية.",
  },
  engineNoServe: {
    en: "Torrent engine could not serve this file. Try another stream in the picker.",
    ar: "لم يتمكن محرك التورنت من تقديم هذا الملف. جرّب بثاً آخر من المنتقي.",
  },
  engineStartingHint: {
    en: "Torrent engine offline — P2P unavailable here. Use debrid or direct streams.",
    ar: "محرك التورنت غير متصل — P2P غير متاح هنا. استخدم debrid أو البثوث المباشرة.",
  },
  noStreamsFound: {
    en: "No streams found from your addons.",
    ar: "لم يُعثر على أي بثوث من إضافاتك.",
  },

  // ---- integrations / link flow ----
  integrationsTitle: { en: "Integrations", ar: "التكاملات" },
  integrationsIntro: { en: "Connect optional third-party services. Activation-code linking keeps tokens encrypted on this app's server; the browser never sees them.", ar: "اربط خدمات طرفية ثالثة اختيارية. يُبقي الربط برمز التنشيط الرموز مشفَّرة على خادم هذا التطبيق؛ والمتصفح لا يراها أبداً." },
  privacyNote: { en: "Horse links Trakt/Simkl with built-in server-side app credentials — activation-code linking keeps your tokens encrypted on this app's server, and the browser never sees them. Optional keys (debrid, metadata) stay yours.", ar: "يربط Horse حسابَي Trakt وSimkl عبر بيانات تطبيق مدمجة في الخادم — يُبقي الربط برمز التنشيط رموزك مشفَّرة على خادم هذا التطبيق، ولا يراها المتصفح أبداً. أما المفاتيح الاختيارية (ديبريد، البيانات الوصفية) فتبقى لك." },
  linkWithCode: { en: "Link {name} with a code", ar: "ربط {name} برمز" },
  noAccountNeeded: { en: "No account setup needed — you'll get a short code to enter on {host}.", ar: "لا حاجة لإعداد حساب — ستحصل على رمز قصير لإدخاله في {host}." },
  visitEnterCode: { en: "Visit {url} and enter this code:", ar: "زر {url} وأدخل هذا الرمز:" },
  waitingAuth: { en: "Waiting for authorization…", ar: "في انتظار التفويض…" },
  waitingSlowDown: { en: "Waiting (provider asked us to slow down)…", ar: "في الانتظار (طلب المزوّد التمهُّل)…" },
  generateNewCode: { en: "Generate new code", ar: "توليد رمز جديد" },
  newCode: { en: "New code", ar: "رمز جديد" },
  openHost: { en: "Open {host}", ar: "افتح {host}" },
  approveAuto: { en: "Approve on the provider's site and this connects automatically within seconds.", ar: "وافق على موقع المزوّد وسيتم الربط تلقائياً خلال ثوانٍ." },
  expiresIn: { en: "Expires in", ar: "ينتهي خلال" },
  clickToCopy: { en: "Click to copy", ar: "انقر للنسخ" },
  codeExpiresAria: { en: "Code expires in", ar: "ينتهي الرمز خلال" },
  scanQr: { en: "Scan to open the verification page", ar: "امسح لفتح صفحة التحقق" },
  importTraktWatchlist: { en: "Import your Trakt watchlist", ar: "استورد قائمة مشاهداتك من Trakt" },
  importSimklWatchlist: { en: "Import your Simkl watchlist", ar: "استورد قائمة مشاهداتك من Simkl" },
  importWatchlist: { en: "Import watchlist", ar: "استيراد قائمة المشاهدة" },
  importHistory: { en: "Import history", ar: "استيراد السجل" },
  pushWatchlist: { en: "Push watchlist", ar: "دفع قائمة المشاهدة" },
  scrobbleWhilePlaying: { en: "Scrobble to Trakt while playing", ar: "تسجيل المشاهدة إلى Trakt أثناء التشغيل" },
  lastImportNew: { en: "Last import: +{n} new", ar: "آخر استيراد: +{n} جديد" },
  localWatchlistHas: { en: "Local watchlist has {n} titles", ar: "قائمة المشاهدة المحلية تضم {n} عنواناً" },
  lastImportPlays: { en: "Last import: +{n} plays", ar: "آخر استيراد: +{n} تشغيل" },

  // ---- addons page ----
  addonsIntro: { en: "Horse is a neutral client for the open Stremio addon protocol. Install catalogs, streams and subtitles addons by manifest URL. Horse hosts no content — you bring your own addons.", ar: "Horse عميل محايد لبروتوكول إضافات Stremio المفتوح. ثبّت إضافات الكتالوجات والبثوث والترجمات عبر رابط manifest. لا يستضيف Horse أي محتوى — أنت توفّر إضافاتك." },
  manifestLabel: { en: "Addon manifest URL", ar: "رابط manifest للإضافة" },
  manifestPlaceholder: { en: "https://my-addon.example.com/manifest.json", ar: "https://my-addon.example.com/manifest.json" },
  installFailed: { en: "Install failed", ar: "فشل التثبيت" },
  addonReady: { en: "Addon is ready to use.", ar: "الإضافة جاهزة للاستخدام." },
  installedCount: { en: "Installed ({n})", ar: "مثبتة ({n})" },
  noAddonsYet: { en: "No addons installed yet.", ar: "لا توجد إضافات مثبتة بعد." },
  noAddonsMatch: { en: "No addons match your filter.", ar: "لا توجد إضافات تطابق عامل التصفية." },
  communityAddons: { en: "Community addons", ar: "إضافات المجتمع" },
  healthSummary: { en: "Addon health summary", ar: "ملخص صحة الإضافات" },
  nHealthy: { en: "{n} healthy", ar: "{n} سليمة" },
  nNotResponding: { en: "{n} not responding", ar: "{n} لا تستجيب" },
  checkedRatio: { en: "· {a}/{b} checked", ar: "· تم فحص {a}/{b}" },
  retestAll: { en: "Re-test all", ar: "إعادة اختبار الكل" },
  retestAllTitle: { en: "Re-test every checked addon", ar: "إعادة اختبار كل إضافة تم فحصها" },
  testAddon: { en: "Test addon", ar: "اختبار الإضافة" },
  testAria: { en: "Test {name}", ar: "اختبار {name}" },
  enableAria: { en: "Enable {name}", ar: "تمكين {name}" },
  disableAria: { en: "Disable {name}", ar: "تعطيل {name}" },
  configureAria: { en: "Configure {name}", ar: "تهيئة {name}" },
  uninstallAria: { en: "Uninstall {name}", ar: "إلغاء تثبيت {name}" },
  uninstallConfirmTitle: { en: "Uninstall {name}?", ar: "إلغاء تثبيت {name}؟" },
  uninstallConfirmBody: { en: "This removes the addon from this browser. You can reinstall it any time with its manifest URL.", ar: "سيؤدي هذا إلى إزالة الإضافة من هذا المتصفح. يمكنك إعادة تثبيتها في أي وقت عبر رابط manifest الخاص بها." },
  healthyChip: { en: "HEALTHY", ar: "سليمة" },
  noReplyChip: { en: "NO REPLY", ar: "لا استجابة" },
  addonHealthyAria: { en: "Addon healthy", ar: "الإضافة سليمة" },
  addonDownAria: { en: "Addon not responding", ar: "الإضافة لا تستجيب" },
  testingAria: { en: "Testing addon", ar: "جارٍ اختبار الإضافة" },
  nStreams: { en: "{n} streams", ar: "{n} تدفقات" },
  nSubtitles: { en: "{n} subtitles", ar: "{n} ترجمات" },
  nCatalogItems: { en: "{n} catalog items", ar: "{n} عنصر كتالوج" },
  nItems: { en: "{n} items", ar: "{n} عنصر" },
  checkedAgo: { en: "checked {time}", ar: "فُحصت {time}" },
  removedToast: { en: "{name} removed", ar: "تمت إزالة {name}" },
  installedToast: { en: "{name} installed", ar: "تم تثبيت {name}" },

  // ---- detail page (Task 30 redesign) ----
  watchNow: { en: "Watch Now", ar: "مشاهدة" },
  resumeSE: { en: "Resume S{s}:E{e}", ar: "متابعة S{s}:E{e}" },
  moreOptions: { en: "More options", ar: "خيارات أخرى" },
  addToWatchlist: { en: "Add to watchlist", ar: "أضف إلى قائمة المشاهدة" },
  inWatchlistItem: { en: "In watchlist", ar: "في قائمة المشاهدة" },
  availableStreams: { en: "Available streams", ar: "البثوث المتاحة" },
  streamsHint: { en: "Choose a specific stream", ar: "اختر بثاً محدداً" },
  share: { en: "Share", ar: "مشاركة" },
  linkCopied: { en: "Link copied to clipboard", ar: "تم نسخ الرابط إلى الحافظة" },
  director: { en: "Director", ar: "المخرج" },
  starring: { en: "Starring", ar: "بطولة" },
  episodesTitle: { en: "Episodes", ar: "الحلقات" },
  seasonN: { en: "Season {n}", ar: "الموسم {n}" },
  selectSeason: { en: "Select season", ar: "اختر الموسم" },
  newestFirst: { en: "Newest first", ar: "الأحدث أولاً" },
  oldestFirst: { en: "Oldest first", ar: "الأقدم أولاً" },
  noEpisodes: { en: "No episode information available for this series.", ar: "لا تتوفر معلومات حلقات لهذا المسلسل." },
  episodeN: { en: "Episode {n}", ar: "الحلقة {n}" },
  // Episodes rebuild (Task: episodes section)
  specialsSeason: { en: "Specials", ar: "حلقات خاصة" },
  watchedBadge: { en: "Watched", ar: "تمت المشاهدة" },
  upcomingBadge: { en: "Upcoming", ar: "لم تُعرض بعد" },
  viewList: { en: "List view", ar: "عرض قائمة" },
  viewGrid: { en: "Grid view", ar: "عرض شبكة" },
  episodesLayoutLabel: { en: "Switch between list and grid", ar: "التبديل بين القائمة والشبكة" },
  minutesShort: { en: "{n} min", ar: "{n} دقيقة" },
  episodesCount: { en: "{n} episodes", ar: "{n} حلقة" },
  watchedOfEpisodes: { en: "{w} of {c} watched", ar: "شوهد {w} من {c}" },
  blurEpisodeThumbs: { en: "Blur episode thumbnails", ar: "طمس صور الحلقات" },
  blurEpisodeThumbsDesc: { en: "Spoiler protection: episodes you haven't watched show a blurred thumbnail.", ar: "حماية من حرق الأحداث: تظهر صور الحلقات التي لم تشاهدها مطموسة." },
  recommendedTitle: { en: "Recommended for you", ar: "مقترح لك" },
  recommendedByTmdb: { en: "Recommended by TMDB", ar: "مقترح من TMDB" },
  viaTmdb: { en: "via TMDB", ar: "عبر TMDB" },
  moreLikeThis: { en: "More like this", ar: "أعمال مشابهة" },
  viaAddon: { en: "via {name}", ar: "عبر {name}" },
  loadingDetails: { en: "Loading details…", ar: "جارٍ تحميل التفاصيل…" },
  titleNotFound: { en: "Title not found. It may not be in Cinemeta or your addons.", ar: "لم يتم العثور على العنوان. قد لا يكون موجوداً في Cinemeta أو في إضافاتك." },
  fetchFailed: { en: "Failed to load details", ar: "فشل تحميل التفاصيل" },
  goBack: { en: "Go back", ar: "رجوع" },
  contentRating: { en: "Content rating", ar: "التصنيف العمري" },
  pressPlayHint: { en: "Press Play to fetch streams from your installed addons for this title.", ar: "اضغط تشغيل لجلب البثوث من إضافاتك المثبتة لهذا العنوان." },

  // ---- footer ----
  footerTagline: { en: "Horse — an open-source media center. Not affiliated with Stremio. Addons are user-installed; Horse hosts no content.", ar: "Horse — مركز وسائط مفتوح المصدر. غير تابع لـ Stremio. الإضافات يثبّتها المستخدم؛ ولا يستضيف Horse أي محتوى." },
  footerCredit: { en: "Inspired by the Harbor desktop app: github.com/harborstremio/harbor (MIT). This is a web port.", ar: "مستوحى من تطبيق Harbor لسطح المكتب: github.com/harborstremio/harbor (‏MIT). هذه نسخة ويب." },

  // ---- HORSE platform account (settings → data) ----
  accountTitle: { en: "HORSE account", ar: "حساب HORSE" },
  accountSignedInChip: { en: "Signed in", ar: "مسجّل الدخول" },
  accountNotSignedInChip: { en: "Not signed in", ar: "غير مسجّل الدخول" },
  accountSignedInDesc: { en: "Your addons, settings, watchlist and history are stored on this account. Sign in on any device and they arrive automatically.", ar: "إضافاتك وإعداداتك وقائمة مشاهدتك وسجلّك محفوظة على هذا الحساب. سجّل الدخول من أي جهاز وتصلك تلقائيًا." },
  accountLoggedOutDesc: { en: "Create an account or sign in — the addons and library you add on any device are restored here automatically after sign-in.", ar: "أنشئ حسابًا أو سجّل الدخول — الإضافات والمكتبة التي تضيفها على أي جهاز تُستعاد هنا تلقائيًا بعد تسجيل الدخول." },
  accountUsername: { en: "Username", ar: "اسم المستخدم" },
  accountUsernamePlaceholder: { en: "e.g. horse_rider", ar: "مثال: horse_rider" },
  accountPassword: { en: "Password", ar: "كلمة المرور" },
  accountModeLabel: { en: "Account mode", ar: "نمط الحساب" },
  accountTabSignIn: { en: "Sign in", ar: "تسجيل الدخول" },
  accountTabCreate: { en: "Create account", ar: "إنشاء حساب" },
  accountBtnSignIn: { en: "Sign in & pull my data", ar: "دخول وجلب بياناتي" },
  accountBtnCreate: { en: "Create account & save this device", ar: "إنشاء حساب وحفظ هذا الجهاز" },
  accountSyncNow: { en: "Sync now", ar: "مزامنة الآن" },
  accountSignOut: { en: "Sign out", ar: "تسجيل الخروج" },
  accountPasswordHint: { en: "Password: 10+ characters · stored hashed (scrypt)", ar: "كلمة المرور: 10 أحرف فأكثر · تُخزَّن مشفَّرة (scrypt)" },
  accountLoading: { en: "Loading account…", ar: "جارٍ تحميل الحساب…" },
  accountToastSignedIn: { en: "Signed in as {name}", ar: "تم تسجيل الدخول باسم {name}" },
  accountToastPulled: { en: "Pulled {n} new addon(s) from your account.", ar: "تم جلب إضافة واحدة جديدة من حسابك.", arOther: "تم جلب {n} إضافات جديدة من حسابك." },
  accountToastUpToDate: { en: "Your account is up to date.", ar: "حسابك محدَّث بالكامل." },
  accountToastCreated: { en: "Account created", ar: "تم إنشاء الحساب" },
  accountToastCreatedDesc: { en: "This device's addons and library are now saved to your account.", ar: "أُضيفت إضافات ومكتبة هذا الجهاز إلى حسابك." },
  accountToastSignedOut: { en: "Signed out", ar: "تم تسجيل الخروج" },
  accountToastSignedOutDesc: { en: "A final sync was saved to your account.", ar: "حُفظت مزامنة أخيرة في حسابك." },
  accountToastSyncedTitle: { en: "Synced from account", ar: "تمت المزامنة من الحساب" },
  accountToastSyncFailed: { en: "Sync failed", ar: "فشلت المزامنة" },
  accountTryAgain: { en: "Try again.", ar: "حاول مجددًا." },
  accountErrSignIn: { en: "Sign-in failed.", ar: "فشل تسجيل الدخول." },
  accountErrRegister: { en: "Could not create the account.", ar: "تعذر إنشاء الحساب." },
  accountDelete: { en: "Delete account", ar: "حذف الحساب" },
  accountDeleteConfirmTitle: { en: "Delete this account?", ar: "حذف هذا الحساب؟" },
  accountDeleteConfirmDesc: { en: "This cannot be undone. The account and everything synced to it (addons, library, history) will be erased from the server. Data on this device stays.", ar: "لا يمكن التراجع عن ذلك. سيُمحى الحساب وكل بياناته المتزامنة (الإضافات والمكتبة والسجل) من الخادم. تبقى البيانات على هذا الجهاز." },
  accountDeleteConfirmBtn: { en: "Yes, delete permanently", ar: "نعم، احذف نهائيًا" },
  accountCancel: { en: "Cancel", ar: "إلغاء" },
  accountToastDeleted: { en: "Account deleted", ar: "تم حذف الحساب" },
  accountToastDeletedDesc: { en: "The account and its server data were erased. Local data on this device was kept.", ar: "مُحي الحساب وبياناته من الخادم. أُبقيت البيانات المحلية على هذا الجهاز." },
  accountToastDeleteFailed: { en: "Could not delete the account", ar: "تعذر حذف الحساب" },

  // ---- HORSE account v2 (email auth, devices, export, verify) ----
  accountEmail: { en: "Email", ar: "البريد الإلكتروني" },
  accountEmailPlaceholder: { en: "you@example.com", ar: "you@example.com" },
  accountDisplayName: { en: "Display name (optional)", ar: "الاسم المعروض (اختياري)" },
  accountDisplayNamePlaceholder: { en: "How we greet you", ar: "كيف نناديك" },
  accountBtnSignInGeneric: { en: "Sign in", ar: "تسجيل الدخول" },
  accountRememberDevice: { en: "Keep me signed in on this device", ar: "أبقني مسجّلًا على هذا الجهاز" },
  accountForgotPassword: { en: "Forgot password?", ar: "نسيت كلمة المرور؟" },
  accountShowPassword: { en: "Show password", ar: "إظهار كلمة المرور" },
  accountHidePassword: { en: "Hide password", ar: "إخفاء كلمة المرور" },
  accountStrengthWeak: { en: "Weak", ar: "ضعيفة" },
  accountStrengthFair: { en: "Fair", ar: "مقبولة" },
  accountStrengthGood: { en: "Good", ar: "جيدة" },
  accountStrengthStrong: { en: "Strong", ar: "قوية" },
  accountStrengthLabel: { en: "Password strength", ar: "قوة كلمة المرور" },
  accountErrPasswordShort: { en: "Password must be at least 10 characters.", ar: "يجب ألا تقل كلمة المرور عن 10 أحرف." },
  accountErrEmailInvalid: { en: "Please enter a valid email address.", ar: "أدخل بريدًا إلكترونيًا صحيحًا." },
  accountErrPasswordMismatch: { en: "Passwords do not match.", ar: "كلمتا المرور غير متطابقتين." },
  accountErrGeneric: { en: "Something went wrong. Try again.", ar: "حدث خطأ ما. حاول مجددًا." },
  accountErrTaken: { en: "Could not create the account with these details — the email may already be registered.", ar: "تعذر إنشاء الحساب بهذه البيانات — قد يكون البريد مسجلًا مسبقًا." },
  accountErrBreached: { en: "This password appeared in public breaches. Pick a stronger one.", ar: "ظهرت كلمة المرور هذه في تسريبات عامة. اختر كلمة أقوى." },
  accountErrLocked: { en: "Too many attempts. Please wait and try again.", ar: "محاولات كثيرة جدًا. انتظر قليلًا ثم أعد المحاولة." },
  // forgot / reset / verify
  accountForgotTitle: { en: "Reset your password", ar: "إعادة تعيين كلمة المرور" },
  accountForgotDesc: { en: "Enter your account email and we will send a single-use reset link (valid 1 hour).", ar: "أدخل بريد حسابك وسنرسل رابط إعادة تعيين يُستخدم مرة واحدة (صالح ساعة واحدة)." },
  accountForgotSend: { en: "Send reset link", ar: "أرسل رابط الإعادة" },
  accountForgotDone: { en: "If that email belongs to an account, a reset link is on its way.", ar: "إذا كان البريد تابعًا لحساب، فإن رابط الإعادة في طريقه إليك." },
  accountForgotUnavailable: { en: "Email delivery is not configured on this deployment. Contact the operator.", ar: "إرسال البريد غير مهيأ على هذا النشر. تواصل مع مشغّل الموقع." },
  accountResetTitle: { en: "Choose a new password", ar: "اختر كلمة مرور جديدة" },
  accountResetDesc: { en: "Setting a new password signs out all other devices.", ar: "تعيين كلمة مرور جديدة يُسجّل خروج كل الأجهزة الأخرى." },
  accountResetBtn: { en: "Set new password", ar: "تعيين كلمة المرور" },
  accountResetDone: { en: "Password updated. Sign in again on this device.", ar: "تم تحديث كلمة المرور. سجّل الدخول مجددًا على هذا الجهاز." },
  accountResetInvalid: { en: "This reset link is invalid, used, or has expired.", ar: "رابط الإعادة غير صالح أو مستخدم أو منتهٍ." },
  accountVerifyNotice: { en: "Email not verified — check your inbox for the verification link.", ar: "البريد غير موثّق — افحص صندوق الوارد لرابط التوثيق." },
  accountVerifyDone: { en: "Email verified ✓", ar: "تم توثيق البريد ✓" },
  accountVerifyInvalid: { en: "Verification link is invalid or expired.", ar: "رابط التوثيق غير صالح أو منتهٍ." },
  // merge dialog (first login on a device with local data)
  mergeTitle: { en: "Merge this device's data into your account?", ar: "دمج بيانات هذا الجهاز مع حسابك؟" },
  mergeDesc: { en: "This device has local addons/data. Choose how to combine them with what's already on your account.", ar: "يحتوي هذا الجهاز على بيانات محلية. اختر طريقة دمجها مع ما هو محفوظ في حسابك." },
  mergeOptMerge: { en: "Merge (recommended)", ar: "دمج (موصى به)" },
  mergeOptMergeDesc: { en: "Keep this device's addons and pull in the account's ones — nothing is lost.", ar: "أبقِ إضافات هذا الجهاز وأضِف إضافات الحساب — لا يُفقد شيء." },
  mergeOptAccount: { en: "Use account data only", ar: "استخدام بيانات الحساب فقط" },
  mergeOptAccountDesc: { en: "Replace this device's local data with what's on the account.", ar: "استبدل البيانات المحلية لهذا الجهاز بما هو على الحساب." },
  mergeOptLocal: { en: "Keep this device's data", ar: "أبقِ بيانات هذا الجهاز" },
  mergeOptLocalDesc: { en: "Overwrite the account with this device's current data (confirmation shown).", ar: "اكتب بيانات هذا الجهاز فوق الحساب (سيُطلب تأكيد)." },
  mergeOverwriteConfirm: { en: "Overwrite account data?", ar: "الكتابة فوق بيانات الحساب؟" },
  mergeOverwriteDesc: { en: "The account's synced addons/library will be replaced by this device's data. This cannot be undone.", ar: "ستُستبدل إضافات الحساب ومكتبته ببيانات هذا الجهاز. لا يمكن التراجع." },
  mergeOverwriteBtn: { en: "Yes, overwrite", ar: "نعم، اكتب فوقها" },
  mergeConfirm: { en: "Continue", ar: "متابعة" },
  // devices
  devicesTitle: { en: "Devices & sessions", ar: "الأجهزة والجلسات" },
  devicesDesc: { en: "Where you're signed in. Sign out any device you don't recognize.", ar: "الأجهزة المسجَّل فيها دخولك. سجّل خروج أي جهاز لا تعرفه." },
  devicesCurrent: { en: "This device", ar: "هذا الجهاز" },
  devicesSignOut: { en: "Sign out", ar: "خروج" },
  devicesSignOutAll: { en: "Sign out all devices", ar: "تسجيل الخروج من كل الأجهزة" },
  devicesEmpty: { en: "No other sessions.", ar: "لا جلسات أخرى." },
  devicesLastSeen: { en: "Last active {when}", ar: "آخر نشاط {when}" },
  devicesToastRevoked: { en: "Device signed out", ar: "تم تسجيل خروج الجهاز" },
  // password change + export
  passwordTitle: { en: "Change password", ar: "تغيير كلمة المرور" },
  passwordCurrent: { en: "Current password", ar: "كلمة المرور الحالية" },
  passwordNew: { en: "New password", ar: "كلمة المرور الجديدة" },
  passwordConfirm: { en: "Confirm new password", ar: "تأكيد كلمة المرور الجديدة" },
  passwordBtn: { en: "Change password", ar: "تغيير كلمة المرور" },
  passwordDone: { en: "Password changed. Other devices were signed out.", ar: "تم تغيير كلمة المرور. سُجّل خروج الأجهزة الأخرى." },
  exportBtn: { en: "Export my data", ar: "تصدير بياناتي" },
  exportDone: { en: "Account data exported as JSON.", ar: "صُدّرت بيانات الحساب كملف JSON." },
  exportFailed: { en: "Could not export the data.", ar: "تعذر تصدير البيانات." },
  // session expired
  sessionExpired: { en: "Your session has expired. Please sign in again.", ar: "انتهت صلاحية جلستك. سجّل الدخول مجددًا." },
  // guest prompt (addons page)
  guestPromptTitle: { en: "Sign in to keep your addons on all your devices", ar: "سجّل الدخول لحفظ إضافاتك على كل أجهزتك" },
  guestPromptCta: { en: "Sign in / Create account", ar: "دخول / إنشاء حساب" },
  guestPromptDismiss: { en: "Not now", ar: "ليس الآن" },
  syncStatusIdle: { en: "Idle", ar: "خامل" },
  syncStatusSyncing: { en: "Syncing…", ar: "جارٍ المزامنة…" },
  syncStatusSynced: { en: "Up to date", ar: "محدَّث" },
  syncStatusError: { en: "Sync error", ar: "خطأ مزامنة" },
  syncStatusOff: { en: "Off", ar: "متوقف" },
  cloudSyncTitle: { en: "Cloud sync", ar: "المزامنة السحابية" },
  // floating search bar (B1/B3: localized, bidi-safe placeholder)
  searchPlaceholder: { en: "Search…", ar: "ابحث…" },
  searchAria: { en: "Search movies, series, people and addons", ar: "ابحث عن أفلام ومسلسلات وأشخاص وإضافات" },
  searchShow: { en: "Show search", ar: "إظهار البحث" },

  // ================= Settings redesign (Task 70) =================
  // ---- shell ----
  setSearch: { en: "Search settings", ar: "ابحث في الإعدادات" },
  setSearchHint: { en: "Type a setting name — results jump straight to the row", ar: "اكتب اسم الإعداد — تنقلك النتائج إلى صفه مباشرة" },
  setSearchEmpty: { en: "No settings match “{q}”", ar: "لا إعدادات مطابقة لـ«{q}»" },
  setHome: { en: "Settings home", ar: "الرئيسية الإعدادات" },
  setGroupsGeneral: { en: "General", ar: "عام" },
  setGroupsContent: { en: "Library & content", ar: "المكتبة والمحتوى" },
  setGroupsSystem: { en: "System", ar: "النظام" },
  setCategoryList: { en: "Categories", ar: "الفئات" },
  setOverview: { en: "Overview", ar: "نظرة عامة" },
  setAll: { en: "All settings", ar: "جميع الإعدادات" },
  setArrived: { en: "Setting highlighted", ar: "تم تمييز الإعداد" },
  setResetSection: { en: "Reset section", ar: "إعادة ضبط القسم" },
  setResetSectionDesc: { en: "Restore every setting in this section to its default", ar: "إعادة كل إعدادات هذا القسم إلى قيمها الافتراضية" },
  setResetConfirmTitle: { en: "Reset this section?", ar: "إعادة ضبط هذا القسم؟" },
  setResetConfirmBody: { en: "Every setting in {name} returns to its default value. Other sections are untouched.", ar: "تعود جميع إعدادات {name} إلى قيمتها الافتراضية. الأقسام الأخرى لا تتأثر." },
  setResetConfirm: { en: "Reset", ar: "إعادة الضبط" },
  setResetDone: { en: "{name} reset to defaults", ar: "تمت إعادة ضبط {name}" },
  // ---- categories ----
  catAccount: { en: "Account & sync", ar: "الحساب والمزامنة" },
  catAccountSum: { en: "Horse account, devices, cloud sync", ar: "حساب Horse والأجهزة والمزامنة السحابية" },
  catAppearance: { en: "Appearance", ar: "المظهر" },
  catAppearanceSum: { en: "Theme, posters, home screen, language", ar: "السمة والملصقات والرئيسية واللغة" },
  catPlayback: { en: "Playback", ar: "التشغيل" },
  catPlaybackSum: { en: "Player behavior, streams, proxy, P2P engine", ar: "سلوك المشغّل والبثوث والوسيط ومحرك P2P" },
  catSubtitles: { en: "Subtitles", ar: "الترجمات" },
  catSubtitlesSum: { en: "Languages, size, colors, live preview", ar: "اللغات والحجم والألوان ومعاينة حية" },
  catIntegrations: { en: "Integrations", ar: "التكاملات" },
  catIntegrationsSum: { en: "Trakt, Simkl, TMDB, ratings, debrid", ar: "Trakt وSimkl وTMDB والتقييمات وDebrid" },
  catAddons: { en: "Addons", ar: "الإضافات" },
  catAddonsSum: { en: "Install, configure and manage stream addons", ar: "تثبيت وتهيئة وإدارة إضافات البث" },
  catKids: { en: "Kids & parental", ar: "الأطفال والرقابة الأبوية" },
  catKidsSum: { en: "Kids mode, parent PIN, content limits", ar: "وضع الأطفال ورمز الوالدين وحدود المحتوى" },
  catData: { en: "Data & privacy", ar: "البيانات والخصوصية" },
  catDataSum: { en: "Backups, region, languages, clear data", ar: "النسخ الاحتياطي والمنطقة واللغات ومسح البيانات" },
  catAbout: { en: "About", ar: "حول" },
  catAboutSum: { en: "Version, attributions, shortcuts", ar: "الإصدار والإسنادات والاختصارات" },
  // ---- subtitles preview + new subtitle controls ----
  subPreview: { en: "Live preview", ar: "معاينة حية" },
  subPreviewDesc: { en: "Exactly how subtitles render in the player", ar: "الشكل نفسه الذي تظهر به الترجمات في المشغّل" },
  subPreviewLine: { en: "This is how your subtitles will look", ar: "هكذا ستبدو الترجمات لديك" },
  subFontColor: { en: "Text color", ar: "لون النص" },
  subFontColorDesc: { en: "Subtitle text color", ar: "لون نص الترجمة" },
  subBorderColor: { en: "Border color", ar: "لون الحدود" },
  subBorderColorDesc: { en: "Outline color behind the text", ar: "لون التحديد خلف النص" },
  subStyle: { en: "Text style", ar: "نمط النص" },
  subStyleDesc: { en: "Shadow, outline or box behind the text", ar: "ظل أو تحديد أو صندوق خلف النص" },
  optShadow: { en: "Shadow", ar: "ظل" },
  optOutline: { en: "Outline", ar: "تحديد" },
  optBox: { en: "Box", ar: "صندوق" },
  // ---- playback new controls ----
  streamSort: { en: "Stream sorting", ar: "ترتيب البثوث" },
  streamSortDesc: { en: "By quality score or by addon order", ar: "حسب درجة الجودة أو حسب ترتيب الإضافة" },
  optScore: { en: "Quality score", ar: "درجة الجودة" },
  optAddonOrder: { en: "Addon order", ar: "ترتيب الإضافة" },
  customSpeeds: { en: "Custom playback speeds", ar: "سرعات تشغيل مخصصة" },
  customSpeedsDesc: { en: "Comma-separated speeds between 0.25 and 4", ar: "سرعات مفصولة بفواصل بين 0.25 و4" },
  customSpeedsInvalid: { en: "Use numbers between 0.25 and 4, separated by commas", ar: "استخدم أرقاماً بين 0.25 و4 مفصولة بفواصل" },
  resumePrompt: { en: "Ask before resuming", ar: "اسأل قبل الاستئناف" },
  resumePromptDesc: { en: "Confirm the resume position instead of jumping straight in", ar: "أكّد موضع الاستئناف بدلاً من الدخول مباشرة" },
  // ---- appearance new controls / wiring ----
  hidePosterTitles: { en: "Hide titles under posters", ar: "إخفاء العناوين أسفل الملصقات" },
  hidePosterTitlesDesc: { en: "Posters only — cleaner walls", ar: "الملصقات فقط — جدران أنظف" },
  episodesViewRow: { en: "Episodes layout", ar: "تخطيط الحلقات" },
  episodesViewRowDesc: { en: "List, grid, or automatic by screen width", ar: "قائمة أو شبكة أو تلقائي حسب عرض الشاشة" },
  optAutoLayout: { en: "Auto", ar: "تلقائي" },
  optList: { en: "List", ar: "قائمة" },
  optGrid: { en: "Grid", ar: "شبكة" },
  uiLanguageRow: { en: "Interface language", ar: "لغة الواجهة" },
  uiLanguageRowDesc: { en: "Arabic applies the approved translation, right-to-left layout and the Tajawal font", ar: "تطبّق العربية الترجمة المعتمدة والاتجاه من اليمين إلى اليسار وخط Tajawal" },
  // ---- kids & parental ----
  kidsModeRow: { en: "Kids mode", ar: "وضع الأطفال" },
  kidsModeRowDesc: { en: "A safe, simple corner: kids content only, grown-up sections hidden", ar: "زاوية آمنة وبسيطة: محتوى الأطفال فقط وإخفاء أقسام الكبار" },
  kidsPinSet: { en: "Parent PIN", ar: "رمز الوالدين" },
  kidsPinSetDesc: { en: "Required to open Kids settings and to leave Kids mode", ar: "مطلوب لفتح إعدادات الأطفال وللخروج من وضع الأطفال" },
  kidsPinCreate: { en: "Create PIN", ar: "إنشاء الرمز" },
  kidsPinChange: { en: "Change PIN", ar: "تغيير الرمز" },
  kidsPinRemove: { en: "Remove PIN", ar: "إزالة الرمز" },
  kidsPinEnter: { en: "Enter parent PIN", ar: "أدخل رمز الوالدين" },
  kidsPinEnterDesc: { en: "This section is protected while Kids mode is on", ar: "هذا القسم محمي أثناء تفعيل وضع الأطفال" },
  kidsPinChoose: { en: "Choose a 4–8 digit PIN", ar: "اختر رمزاً من 4 إلى 8 أرقام" },
  kidsPinConfirm: { en: "Confirm the PIN", ar: "أكّد الرمز" },
  kidsPinMismatch: { en: "PINs don't match — try again", ar: "الرمزان غير متطابقين — حاول مجدداً" },
  kidsPinWrong: { en: "Wrong PIN", ar: "الرمز خاطئ" },
  kidsPinSaved: { en: "Parent PIN saved", ar: "تم حفظ رمز الوالدين" },
  kidsPinRemoved: { en: "Parent PIN removed", ar: "تمت إزالة رمز الوالدين" },
  kidsPinDigits: { en: "PIN must be 4–8 digits", ar: "يجب أن يتكون الرمز من 4 إلى 8 أرقام" },
  kidsPinProtected: { en: "Protected by parent PIN", ar: "محمي برمز الوالدين" },
  kidsUnlock: { en: "Unlock", ar: "فتح" },
  hideAnime: { en: "Hide anime", ar: "إخفاء الأنمي" },
  hideAnimeDesc: { en: "Remove anime from navigation and search", ar: "إزالة الأنمي من التنقل والبحث" },
  hideLiveTv: { en: "Hide live TV", ar: "إخفاء البث المباشر" },
  hideLiveTvDesc: { en: "Remove live TV channels from navigation", ar: "إزالة قنوات البث المباشر من التنقل" },
  hideAdult: { en: "Hide adult content", ar: "إخفاء المحتوى للبالغين" },
  hideAdultDesc: { en: "Filter adult catalogs everywhere", ar: "تصفية كتالوجات البالغين في كل مكان" },
  // ---- data & privacy ----
  regionRow: { en: "Region", ar: "المنطقة" },
  regionRowDesc: { en: "Filters catalogs and release dates by country", ar: "تصفية الكتالوجات وتواريخ الإصدار حسب الدولة" },
  prefLangRow: { en: "Preferred audio languages", ar: "لغات الصوت المفضلة" },
  prefLangRowDesc: { en: "The player picks streams matching these first", ar: "يفضّل المشغّل البثوث المطابقة لهذه اللغات" },
  exportBackupRow: { en: "Export backup", ar: "تصدير نسخة احتياطية" },
  exportBackupDesc: { en: "Save settings, addons and watchlist ({n} items) to a .harbx file", ar: "حفظ الإعدادات والإضافات وقائمة المشاهدة ({n} عنصراً) في ملف .harbx" },
  restoreBackupRow: { en: "Restore backup", ar: "استعادة نسخة احتياطية" },
  restoreBackupDesc: { en: "Import a .harbx backup file", ar: "استيراد ملف نسخة احتياطية .harbx" },
  clearDataRow: { en: "Clear local data", ar: "مسح البيانات المحلية" },
  clearDataDesc: { en: "Remove all Horse data from this browser — including your debrid key and addons", ar: "إزالة جميع بيانات Horse من هذا المتصفح — بما فيها مفتاح Debrid والإضافات" },
  clearDataTitle: { en: "Clear all local data?", ar: "مسح جميع البيانات المحلية؟" },
  clearDataBody: { en: "Every Horse key in this browser is wiped: settings, addons, watchlist, debrid key. This cannot be undone.", ar: "سيُمسح كل ما يخص Horse في هذا المتصفح: الإعدادات والإضافات وقائمة المشاهدة ومفتاح Debrid. لا يمكن التراجع." },
  clearDataConfirm: { en: "Clear everything", ar: "امسح الكل" },
  backupExported: { en: "Backup exported", ar: "تم تصدير النسخة الاحتياطية" },
  backupExportedDesc: { en: "{n} keys saved.", ar: "تم حفظ {n} مفتاحاً." },
  backupRestored: { en: "Backup restored", ar: "تمت استعادة النسخة الاحتياطية" },
  backupRestoredDesc: { en: "{n} keys restored. Reloading…", ar: "استُعيد {n} مفتاحاً. جارٍ إعادة التحميل…" },
  restoreFailed: { en: "Restore failed", ar: "فشلت الاستعادة" },
  restoreFailedBody: { en: "Not a Horse backup file", ar: "ليست ملف نسخة احتياطية من Horse" },
  dataCleared: { en: "Local data cleared", ar: "تم مسح البيانات المحلية" },
  settingsSize: { en: "Current settings size", ar: "حجم الإعدادات الحالي" },
  settingsSizeDesc: { en: "{kb} KB in localStorage", ar: "{kb} كيلوبايت في التخزين المحلي" },
  privacyNoteData: { en: "Backups and cloud sync carry your data over HTTPS; synced blobs are encrypted at rest on the server (AES-256-GCM). Your debrid key never leaves this device.", ar: "تُنقل النسخ الاحتياطية والمزامنة السحابية عبر HTTPS؛ وتُشفَّر البيانات المتزامنة على الخادم (AES-256-GCM). مفتاح Debrid لا يترك هذا الجهاز أبداً." },
  // ---- search index (row titles for deep links) ----
  rowInstantPlay: { en: "Instant play", ar: "التشغيل الفوري" },
  rowAutoPlayNext: { en: "Auto-play next episode", ar: "تشغيل الحلقة التالية تلقائياً" },
  rowResume: { en: "Resume playback", ar: "استئناف التشغيل" },
  rowConfirmLeave: { en: "Confirm leaving playback", ar: "تأكيد مغادرة التشغيل" },
  rowSeekStep: { en: "Seek step", ar: "خطوة التنقل" },
  rowProxy: { en: "Secure proxy", ar: "الوسيط الآمن" },
  rowTranscode: { en: "Convert streams", ar: "تحويل البثوث" },
  rowVideoFill: { en: "Video fill", ar: "ملء الفيديو" },
  rowPlayerChrome: { en: "Player chrome", ar: "مظهر المشغّل" },
  rowPickerLayout: { en: "Stream picker layout", ar: "تخطيط منتقي البثوث" },
  rowQualityInfo: { en: "Quality info", ar: "معلومات الجودة" },
  rowPlayableOnly: { en: "Playable streams only", ar: "البثوث القابلة للتشغيل فقط" },
  rowPreferH264: { en: "Prefer H.264", ar: "تفضيل H.264" },
  rowP2p: { en: "P2P torrent engine", ar: "محرك تورنت P2P" },
  rowSubLangs: { en: "Preferred subtitle languages", ar: "لغات الترجمة المفضلة" },
  rowSubOff: { en: "Subtitles off by default", ar: "إيقاف الترجمات افتراضياً" },
  rowSubSize: { en: "Subtitles size", ar: "حجم الترجمات" },
  rowTheme: { en: "Theme presets", ar: "سمات جاهزة" },
  rowAppearanceMode: { en: "Dark or light", ar: "داكن أو فاتح" },
  rowContrast: { en: "Contrast level", ar: "مستوى التباين" },
  rowLanguage: { en: "Interface language", ar: "لغة الواجهة" },
  rowPosterScale: { en: "Poster size", ar: "حجم الملصق" },
  rowPosterRadius: { en: "Poster corner radius", ar: "استدارة زوايا الملصق" },
  rowBadges: { en: "Card badges", ar: "شارات البطاقات" },
  rowHomeMode: { en: "Home mode", ar: "وضع الصفحة الرئيسية" },
  rowDock: { en: "Auto-hide navigation", ar: "الإخفاء التلقائي للتنقل" },
  rowRail: { en: "Navigation rail", ar: "شريط التنقل الجانبي" },
  rowRegion: { en: "Region", ar: "المنطقة" },
  rowCloudSync: { en: "Cloud sync", ar: "المزامنة السحابية" },
  rowClear: { en: "Clear local data", ar: "مسح البيانات المحلية" },
  rowPin: { en: "Parent PIN", ar: "رمز الوالدين" },
  rowCardSize: { en: "Kids card size", ar: "حجم بطاقات الأطفال" },
} as const satisfies Record<string, { en: string; ar: string; arOther?: string }>;

export type AppStringKey = keyof typeof APP_STRINGS;

/** Dev-time missing-key guard: renders the key itself and fails loudly. */
function warnMissing(key: string): string {
  if (process.env.NODE_ENV !== "production") {
    console.error(`[i18n] Missing translation key: "${key}"`);
  }
  return key;
}

/** Interpolate `{var}` placeholders. */
function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, k: string) =>
    k in vars ? String(vars[k]) : m,
  );
}

/** Translate an app string. Unknown keys fail loudly in dev. */
export function t(key: AppStringKey, lang: string, vars?: Vars): string {
  const entry = APP_STRINGS[key] as { en: string; ar: string; arOther?: string } | undefined;
  if (!entry) return warnMissing(String(key));
  if (!isArabic(lang)) return interpolate(entry.en, vars);
  // Simple English plural shape for Arabic via arOther when {n} ≠ 1
  if (entry.arOther && vars?.n !== undefined && Number(vars.n) !== 1) {
    return interpolate(entry.arOther, vars);
  }
  return interpolate(entry.ar, vars);
}

// ---------------------------------------------------------------------------
// Intl helpers — consistent digits (latn) + real relative time
// ---------------------------------------------------------------------------

const NUM_FMT: Record<string, Intl.NumberFormat> = {};
/** Latin-digit number formatting in every locale (digit style stays consistent). */
export function formatNumber(n: number, lang: string): string {
  const tag = isArabic(lang) ? "ar-u-nu-latn" : "en";
  NUM_FMT[tag] ??= new Intl.NumberFormat(tag);
  return NUM_FMT[tag].format(n);
}

const REL_FMT: Record<string, Intl.RelativeTimeFormat> = {};
const REL_UNITS: { limit: number; div: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { limit: 45_000, div: 1_000, unit: "second" },
  { limit: 45 * 60_000, div: 60_000, unit: "minute" },
  { limit: 22 * 3_600_000, div: 3_600_000, unit: "hour" },
  { limit: 21 * 86_400_000, div: 86_400_000, unit: "day" },
  { limit: 300 * 86_400_000, div: 7 * 86_400_000, unit: "week" },
  { limit: 18 * 31_536_000_000, div: 30 * 86_400_000, unit: "month" },
  { limit: Infinity, div: 365 * 86_400_000, unit: "year" },
];

/** Localized "منذ 8 دقائق" / "8 minutes ago" via Intl.RelativeTimeFormat. */
export function formatTimeAgo(ms: number, lang: string): string {
  const diff = ms - Date.now(); // negative → past
  const abs = Math.abs(diff);
  const { div, unit } = REL_UNITS.find((u) => abs < u.limit) ?? REL_UNITS[REL_UNITS.length - 1];
  const value = Math.round(diff / div);
  const tag = isArabic(lang) ? "ar" : "en";
  REL_FMT[tag] ??= new Intl.RelativeTimeFormat(tag, { numeric: "auto" });
  return REL_FMT[tag].format(value, unit);
}
