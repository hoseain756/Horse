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
  accountPasswordHint: { en: "Password: 8+ characters · stored hashed (scrypt)", ar: "كلمة المرور: 8 أحرف فأكثر · تُخزَّن مشفَّرة (scrypt)" },
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
