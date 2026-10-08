# Horse — محتوى نصوص المشروع (استخراج من ملفات المصدر)

> **الغرض:** مجموعة كاملة من كل النصوص الظاهرة للمستخدم في مشروع Horse، مستخرجة مباشرةً من ملفات المصدر، ومنظمة حسب المنطقة/الملف مع الحفاظ على البنية — ومُعدة **لمراجعة المحتوى وترجمته**.
> **تاريخ الإنشاء:** 2026-10-08 · **المصدر:** ملفات المشروع في `/home/z/my-project` (وليس التطبيق المُعرض)
> **المنهجية:** قراءة كاملة لكل ملف مصدر مُكلّف به؛ تم التقاط النصوص كما هي حرفيًا (الصياغة، وحالة الأحرف، وعلامات الترقيم، والرموز التعبيرية). تم الإبقاء على القوالب الديناميكية كما هي تمامًا مع وسمها `(dynamic)`. لم تتم ترجمة أي شيء أو إعادة صياغته.

**الملف المرافق:** يحتوي `website-content.md` في جذر المشروع على *مُخرَج مختلف* — استخراج عبر فحص DOM للتطبيق المُعرض (بالترتيب المرئي، صفحة بصفحة). أما هذا المستند فيمر على ملفات المصدر ملفًا ملفًا، ولذلك يلتقط أيضًا النصوص التي يصعب الوصول إليها في واجهة التشغيل (حالات الخطأ، والإشعارات المنبثقة النادرة الظهور، ورسائل API).

---

## كيفية القراءة

- `## \`path/to/file.tsx\`` — كل عنوان يمثل ملف مصدر حقيقي.
- **العناوين الفرعية العريضة** تجمع النصوص حسب منطقة الميزة المنطقية (الرأس، عوامل التصفية، الحالة الفارغة، …).
- بادئات النقاط: `(aria)` تسمية إمكانية الوصول · `(placeholder)` نص الحقل الإرشادي · `(toast)` إشعار · `(tooltip)` تلميح · `(sr-only)` خاص بقارئ الشاشة فقط · `(dynamic)` قالب يحتوي على قيم وقت التشغيل · `(api: error)` حقل JSON تعرضه الواجهة · `[internal]` يُستهلك برمجيًا ولا يُعرض.
- تظهر الإدخالات ثنائية اللغة بالشكل `EN / AR` (التطبيق يشحن العربية فقط في `src/lib/harbor/i18n.ts` وفي عدد قليل من الشروط الثلاثية المضمنة؛ وكل ما عدا ذلك باللغة الإنجليزية فقط حاليًا).
- تشير `(×N)` إلى تكرار النص N مرة داخل الملف نفسه.

## التغطية والإحصاءات

| القسم | الملفات المقروءة | النصوص (تقريبًا) |
|---|---|---|
| 1 · الواجهات (الصفحات) | 22 | ~780 |
| 2 · الهيكل العام، المشترك ومشغل الفيديو | 22 | ~550 |
| 3 · منطق المكتبة، رسائل النظام وواجهات API | 82 تم فحصها (27 lib + خدمة التورنت + 36 مسارًا يحتوي نصوصًا) | ~450 |
| 4 · بيانات المشروع، التوثيق، السجل، والجرد | docs + الأصول الثابتة | نظرة عامة + مستندات حرفية |
| **الإجمالي** | **~140 ملف مصدر** | **~1,800+ نص فريد** |

المستبعد عمدًا: معرّفات الكود، وأصناف CSS، ومسارات الاستيراد، ومخرجات `console.*`، وتعليقات الكود، ومفاتيح localStorage، وأسماء الأحداث، وعناوين URL غير المرئية، وأسماء الأيقونات.

## نتائج مهمة قبل الترجمة

1. **الملف الوحيد `src/lib/harbor/i18n.ts` ثنائي اللغة** (نحو 60 مفتاحًا، EN/AR بالكامل). تحمل بعض المكونات شروطًا ثلاثية مضمّنة من الشكل `lang === "ar" ? … : …` (quick-access، page-header، floating-search، player). أما جميع النصوص الأخرى فمضمّنة بالإنجليزية — لذا فإن تطبيق i18n بشكل صحيح شرط أساسي لتغطية عربية كاملة.
2. **بقايا ما قبل إعادة التسمية:** لا تزال خمس نصوص ظاهرة للمستخدم تقول **"Harbor"** بعد إعادة تسمية المشروع إلى Horse — حالة الفراغ في live-view، ومقدمة addons-view (×2)، ولوحتا Basics + Player في الإعدادات، وعنوان integrations-strip، والعنوان الفرعي shortcuts-overlay، وإشعار theme-studio. (أما الإسناد في لوحة About إلى تطبيق Harbor المكتبي فهو مقصود/قانوني ويبقى كما هو.)
3. **مناطق كثافة النصوص:** `settings-view.tsx` (نحو 230 نصًا)، و`player-overlay.tsx` (عناصر تحكم المشغل والقوائم وحالات P2P/الخطأ)، و`picker-overlay.tsx` (منتقي التدفقات)، و`command-palette.tsx`.
4. **طبقة API:** يعيد 36 مسارًا من أصل 39 حقول `error`/`message` قابلة للقراءة البشرية وتعرضها الواجهة؛ أما رموز الأسباب الداخلية فموسومة بـ`[internal]`.

## جدول المحتويات

1. الواجهات — واجهة مستوى الصفحات (`src/components/harbor/views/`)
2. الهيكل العام والمشغل (`src/components/harbor/chrome/` · `common/` · `player/`)
3. منطق المكتبة، رسائل النظام واستجابات API (`src/lib/harbor/` · خدمة التورنت · `src/app/api/`)
4. بيانات المشروع، التوثيق والسجل (docs · PWA · schema · الخط الزمني للتطوير · جرد الملفات)

---
# 1 · الواجهات — واجهة مستوى الصفحات (src/components/harbor/views/)

النطاق: جميع النصوص الظاهرة للمستخدم من مكونات الواجهات الـ22 المدرجة بترتيب المهمة. تم الحفاظ على الصياغة المصدرية كما هي حرفيًا (EN أساسي؛ AR يُعطى فقط حيث يحتوي المصدر/خريطة i18n عليه). يتم توسيع مفاتيح مساعد i18n (`homeT(...)` من `src/lib/harbor/i18n.ts`) ضمن السطر عند أول استخدام لها بصيغة `KEY → EN / AR` ثم تتم الإشارة إليها لاحقًا. النصوص التي يتم إدخالها وقت التشغيل موسومة بـ`(dynamic)`. النص الموجود داخل المكونات *المستوردة* بواسطة هذه الواجهات (chrome/، common/، player/، ui/) غير مدرج هنا عمدًا — فهو يتبع ملفات وكلاء الاستخراج الأخرى.

---

## `src/components/harbor/views/home-view.tsx`

**عناوين الصفوف (anchor rows، معروضة كعناوين أقسام)**
- الأفلام الرائجة
- في دور العرض
- المسلسلات الرائجة
- المسلسلات الشائعة
- المسلسلات الأعلى تقييمًا

**صف أفضل 10**
- (aria) أفضل 10 اليوم
- أفضل 10 اليوم
- الرائج على Stremio

**صفوف الإضافات (خصائص مكون Rail — مقدمة من الإضافة، ديناميكية)**
- (dynamic) `catalog.name` — عنوان الصف
- (dynamic) `addon.manifest.name` — العنوان الفرعي للصف
- (dynamic, aria) `${row.title} loading` — تسمية قسم التحميل (×5، واحدة لكل صف أساسي)

**الحالة الفارغة (فشل جميع الكتالوجات)**
- تعذر تحميل الكتالوج. تحقق من اتصالك.
- يوفر Cinemeta الكتالوج الافتراضي؛ ثبّت إضافات للحصول على المزيد.

---

## `src/components/harbor/views/home-hero.tsx`

**مفاتيح i18n المستخدمة (من src/lib/harbor/i18n.ts — EN / AR):**
- `featured` → Featured / مميز
- `viewDetails` → View details / عرض التفاصيل
- `pauseAutoplay` → Pause autoplay / إيقاف العرض التلقائي مؤقتاً
- `resumeAutoplay` → Resume autoplay / استئناف العرض التلقائي
- `loadingFeatured` → Loading featured titles / جارٍ تحميل المميزة
- `slideOf(i, total)` → `Slide {i} of {total}` / `الشريحة {i} من {total}` (dynamic)
- `goToSlideLabel(n)` → `Go to slide {n}` / `الانتقال إلى الشريحة {n}` (dynamic)
- `metaTypeLabel(...)` → Anime / أنمي · Movie / فيلم · Series / مسلسل (dynamic)

**منطقة العرض الدائري**
- (aria) مميز *(section aria-label via homeT("featured"))*
- (dynamic, aria) `Slide {i} of {total}` *(slide group aria-label via slideOf)*
- (dynamic, alt) عنوان الشريحة النشطة / سلسلة فارغة للشريحة غير النشطة *(HeroArt alt)*
- (dynamic, alt) `{meta.name}` *(title logo img alt)*
- عرض التفاصيل *(hero CTA button via homeT("viewDetails"))*

**نقاط المؤشر + التحكم في التشغيل التلقائي**
- (dynamic, aria) `Go to slide {n}` *(dot buttons via goToSlideLabel)*
- (aria) إيقاف العرض التلقائي / استئناف… → exact: إيقاف العرض التلقائي *(when playing)*; استئناف العرض التلقائي *(when paused)*
- (dynamic, sr-only live region) `Slide {i} of {total}` *(slideOf, announced only while autoplay paused)*

**الهيكل العظمي**
- (aria) جارٍ تحميل المميزة *(role="status" label via homeT("loadingFeatured"))*

---

## `src/components/harbor/views/home-cw.tsx`

**مفاتيح i18n المستخدمة (EN / AR):**
- `continueWatching` → Continue Watching / متابعة المشاهدة
- `viewDetails` → View details / عرض التفاصيل *(already expanded in home-hero)*
- `markWatched` → Mark as watched / تحديد كمشاهد
- `removeFromCw` → Remove from Continue Watching / إزالة من متابعة المشاهدة
- `watchedToast` → Marked as watched / تم التحديد كمشاهد
- `resumeAria` → Resume / متابعة
- `newEpisode` → New episode / حلقة جديدة
- `episodeFallback(n)` → `Episode {n}` / `الحلقة {n}` (dynamic)
- `remainingLabel(ms)` → `{h}h {m}m left` / `تبقى {h}س {m}د` (dynamic)
- `upcomingLabel(ms)` → Airs today / يُعرض اليوم · Airs tomorrow / يُعرض غداً · `In {n} {unit}` → `In {n} day(s)` / `يُعرض بعد {n} {unit}` (with Arabic plurals يومين/أيام/يوم) (dynamic)
- `seasonEpisodeTag(s, e)` → `S{s} E{e}` (dynamic)

**رأس القسم**
- (aria) متابعة المشاهدة
- متابعة المشاهدة *(h2 via homeT("continueWatching"), ×2 including skeleton aria)*

**بطاقة المتابعة**
- (dynamic) `S{s} E{e}` *(episode tag, rendered LTR)*
- (dynamic) `{card.name}` *(title)*
- (dynamic) اسم الحلقة / `Episode {n}` / `الحلقة {n}` *(series subtitle)*
- (dynamic) `{h}h {m}m left` / `تبقى …` *(movie remaining-time subtitle)*
- (dynamic, badge) يُعرض اليوم / يُعرض غداً / يُعرض بعد {n} يوم/أيام (+ صيغ AR) *(upcoming badge)*
- (tooltip) حلقة جديدة *(fresh-dot title via homeT("newEpisode"))*
- (dynamic, aria) تسمية البطاقة المركبة: `Resume {name}, S{n} E{n}, {subtitle}, {pct}%` *(join with ", ")*
- (dynamic, aria) `{pct}%` *(progressbar aria-label)*

**قائمة الضغط المطول / السياق (role="menu")**
- (dynamic, aria) `{card.name}` *(menu aria-label)*
- عرض التفاصيل *(menu item via homeT("viewDetails"))*
- تحديد كمشاهد *(menu item via homeT("markWatched"))*
- إزالة من متابعة المشاهدة *(menu item via homeT("removeFromCw"))*

**الإشعار**
- (toast) تم التحديد كمشاهد *(after "Mark as watched" action; via homeT("watchedToast"))*

---

## `src/components/harbor/views/hero-spotlight.tsx`

**العرض الرئيسي Spotlight (القسم)**
- (aria) Spotlight
- (dynamic, alt) `{meta.name}` *(poster alt)*
- (dynamic, chip) `{meta.releaseInfo.split("–")[0]}` *(year)*
- (dynamic, chip) `{meta.imdbRating}` *(rating with star icon)*
- (dynamic, h1) `{meta.name}`
- تشغيل
- التفاصيل
- (dynamic, aria) `Slide {i + 1}` *(dot buttons)*

---

## `src/components/harbor/views/section-rails.tsx`

**محرك الصفوف المشترك (العناوين تمررها واجهات Movies/Shows/Anime/Discover)**
- (dynamic) `{spec.title}` / `{catalog.name}` *(rail headings)*
- (dynamic) `{addon.manifest.name}` *(rail subtitle, addon rails)*
- تعذر تحميل محتوى الكتالوج. *(empty state, all rails empty)*

---

## `src/components/harbor/views/discover-view.tsx`

**عناوين الصفوف (SPECS)**
- الأفلام الرائجة
- المسلسلات الرائجة
- الأفلام الأعلى تقييمًا
- المسلسلات الأعلى تقييمًا
- اختيارات العائلة
- المغامرات
- مسلسلات الغموض
- الرومانسية
- التاريخ والحرب
- الموسيقى والاستعراضات

---

## `src/components/harbor/views/movies-view.tsx`

**عناوين الصفوف (SPECS)**
- الأفلام الشائعة
- الأعلى تقييمًا
- أكشن
- كوميديا
- خيال علمي وفانتازيا
- رعب
- دراما
- رسوم متحركة
- وثائقي

---

## `src/components/harbor/views/shows-view.tsx`

**عناوين الصفوف (SPECS)**
- المسلسلات الرائجة
- المسلسلات الأعلى تقييمًا
- مسلسلات دراما
- مسلسلات كوميديا
- الجريمة والغموض
- خيال علمي وفانتازيا
- برامج الواقع
- وثائقي

---

## `src/components/harbor/views/anime-view.tsx`

**الرأس**
- أنمي *(h1)*
- كتالوج عبر AniList · انقر على أي عنوان لتحويله إلى كتالوجات Stremio الخاصة بك *(with "AniList" styled as inline emphasis)*
- إعادة المحاولة *(chip button, shown when all rows failed)*

**عناوين الصفوف (ROW_META)**
- الرائج الآن
- الشائع هذا الموسم
- الأفضل على الإطلاق
- أفلام الأنمي
- القادم في الموسم التالي
- (dynamic, aria) `{title} loading` *(loading section labels, ×5)*

**قسم كتالوجات Stremio**
- كتالوجات Stremio *(h2)*
- كتالوجات الأنمي من Cinemeta وإضافاتك المثبتة *(subtext)*
- من كتالوجات Stremio *(Cinemeta rail title)*
- (dynamic) `{catalog.name}` *(addon rail titles)*

**الشريط الرئيسي (أعلى 5 لافتات رائجة)**
- (aria) أبرز الأنمي الرائج
- (dynamic, chip) `{averageScore / 10 toFixed(1)}` *(score)*
- (dynamic) `{seasonYear}`
- (dynamic, chip, uppercase) `{m.format}` *(e.g. TV / MOVIE)*
- (dynamic, chip) `EP {n} soon` *(next airing)*
- (dynamic, h2) `{title}`
- البحث عن التدفقات
- صفحة AniList *(external link)*
- (dynamic, aria) `Spotlight {i + 1}` *(dot buttons)*

**بطاقة الأنمي**
- (dynamic, aria) `{title} (AniList)` *(card button)*
- جارٍ التحويل… *(overlay while resolving)*
- غير موجود في Cinemeta — يتم عرض نتائج البحث *(miss overlay)*
- (dynamic, chip) `{averageScore / 10 toFixed(1)}`
- AniList *(badge chip)*
- (dynamic, chip) `EP {n}` *(next airing episode)*
- (dynamic) `{title}` *(card caption)*
- (dynamic) سطر البيانات الوصفية مفصول بـ" · ": `{seasonYear}` · `Movie` · `{n} eps` · `{genre}` — البديل: أنمي
  - فيلم
  - (dynamic) `{n} eps`

---

## `src/components/harbor/views/kids-view.tsx`

**مفاتيح i18n المستخدمة (EN / AR):**
- `kidsTitle` → Kids Corner / زاوية الأطفال
- `kidsSubtitle` → Fun and safe picks for the little ones. / اختيارات ممتعة وآمنة للصغار.
- `cardSize` → Card size / حجم البطاقة
- `cardSizeHint` → Poster size in Kids Corner — bigger cards are easier to tap. / حجم الملصقات في زاوية الأطفال — البطاقات الأكبر أسهل للمس.
- `sizeLarge` → Large / كبير
- `sizeMedium` → Medium / متوسط
- `sizeSmall` → Small / صغير

**الرأس**
- زاوية الأطفال *(h1 via homeT("kidsTitle"))*
- اختيارات ممتعة وآمنة للصغار. *(subtitle)*

**التحكم بحجم البطاقة**
- (tooltip) حجم الملصقات في زاوية الأطفال — البطاقات الأكبر أسهل للمس. *(cardSizeHint)*
- حجم البطاقة *(label + group aria-label, ×2)*
- كبير *(segment button)*
- متوسط *(segment button)*
- صغير *(segment button)*

**عناوين الصفوف (specs)**
- أفلام الرسوم المتحركة
- أفلام عائلية
- تلفزيون الأطفال
- مسلسلات عائلية
- غنِّ معنا
- المغامرات

**الحالة الفارغة**
- لا يتوفر محتوى للأطفال حاليًا.

---

## `src/components/harbor/views/live-view.tsx`

**الرأس / شريط الأدوات**
- إضافة قائمة تشغيل *(button)*

**نافذة إضافة قائمة تشغيل IPTV**

- إضافة قائمة تشغيل IPTV *(dialog title)*
- الاسم *(field label)*
- (placeholder) قائمة التشغيل الخاصة بي
- عنوان URL لـ M3U / EPG *(field label)*
- (placeholder) https://example.com/playlist.m3u
- إضافة *(submit button)*

**شرائح قوائم التشغيل**
- (dynamic) `{pl.name}`
- (dynamic, aria) `إزالة {pl.name}`

**بحث القنوات**
- (placeholder) تصفية القنوات…
- (aria) تصفية القنوات

**شرائح تصفية المجموعات**
- (dynamic) `الكل ({channels.length})`
- (dynamic) `{group} ({count})`
- عام *(fallback group name when a channel has none)*

**الحالة / الأخطاء**
- فشل تحميل قوائم التشغيل. *(error banner)*
- غير معروف *(fallback channel name in M3U parser — not directly rendered unless data missing)*
- برنامج *(fallback EPG title — not directly rendered unless data missing)*
- (dynamic) `قائمة التشغيل {n}` *(default name when adding a playlist without a name)*

**الحالة الفارغة (لا توجد قوائم تشغيل)**
- لا توجد قوائم تشغيل بعد. أضف قائمة تشغيل M3U لمشاهدة التلفزيون المباشر.
- Horse هو عميل محايد — أضف قوائم التشغيل الخاصة بك. *(NOTE: brand word "Harbor" — pre-rename leftover, likely should read "Horse")*

**بطاقات القنوات**
- (dynamic) `{ch.name}`
- (dynamic) `الآن: {prog.title}` *(current EPG program)*
- مباشر *(fallback subtitle when no EPG/group)*
- (dynamic) `{ch.group}`

**الحالة الفارغة بعد التصفية**
- لا توجد قنوات تطابق عوامل التصفية.

---

## `src/components/harbor/views/calendar-view.tsx`

**المقدمة**
- جدول البث الأسبوعي للمسلسلات التي تتابعها — من قائمة المشاهدة، والمتابعة، والسجل.

**التنقل الأسبوعي**
- (aria) الأسبوع السابق
- السابق *(hidden on small screens)*
- اليوم
- (aria) الأسبوع التالي
- التالي *(hidden on small screens)*
- (dynamic) `{Mon} {d} – {Mon} {d}, {year}` *(week range label; month names Jan–Dec)*
- (dynamic) جارٍ تحميل الحلقات…

**إشعار البيانات الوصفية المفقودة**
- (dynamic) تعذر تحميل `{n}` من المسلسلات التي تتابعها من Cinemeta. *(word "series" used for both singular/plural in source)*

**شرائح أيام الأسبوع على الهاتف**
- (aria) يوم الأسبوع
- (dynamic, uppercase) الإثنين / الثلاثاء / الأربعاء / الخميس / الجمعة / السبت / الأحد

**أعمدة الأيام**
- (dynamic, aria) `{Day} {date}` *(section label)*
- (dynamic, uppercase) الإثنين / الثلاثاء / الأربعاء / الخميس / الجمعة / السبت / الأحد *(column header)*
- لا توجد حلقات
- (dynamic, title) `{ep.name ?? ep.seriesName}` *(episode button tooltip)*
- (dynamic) `S{n}:E{n}`
- (tooltip) تمت المشاهدة *(watched checkmark)*
- قريبًا *(badge for unaired episodes)*

**الأنمي الذي سيُعرض هذا الأسبوع**
- (aria) الأنمي الذي سيُعرض هذا الأسبوع
- الأنمي الذي سيُعرض هذا الأسبوع *(h2)*
- AniList *(chip)*
- لا توجد بيانات بث لهذا الأسبوع.
- (dynamic, chip) `EP {n}`
- قريبًا *(chip for future airings)*
- (dynamic, aria) `{title} الحلقة {n}` *(card button)*
- (dynamic) `{Day} {hh}:{mm}` *(air time)*

**صف الاكتشاف**
- (aria) المسلسلات ذات الحلقات الجديدة هذا الأسبوع
- حلقات جديدة هذا الأسبوع *(h2)*

**حالة التقويم الفارغة**
- لا توجد مسلسلات متابَعة بعد *(h2)*
- أضف مسلسلات إلى قائمة المشاهدة أو ابدأ المشاهدة، وستظهر مواعيد بث حلقاتها الأسبوعية هنا تلقائيًا.
- تصفح المسلسلات *(button)*

---

## `src/components/harbor/views/library-view.tsx`

**علامات التبويب (شرائح التصفية)**
- (dynamic) `قائمة المشاهدة ({count})`
- (dynamic) `القوائم ({count})`
- (dynamic) `السجل ({count})`
- قائمة المشاهدة · القوائم · السجل *(labels inside the chips above)*

**علامة تبويب قائمة المشاهدة**
- قائمة المشاهدة فارغة. أضف العناوين من أي صفحة تفاصيل. *(empty state)*
- فتح *(card button)*
- (dynamic, aria) `إزالة {name} من قائمة المشاهدة`

**علامة تبويب القوائم**
- قائمة جديدة *(button)*
- لا توجد قوائم بعد. أنشئ مجموعات ذات طابع خاص مثل «مشاهدات مريحة». *(empty state; curly quotes in source)*
- (dynamic, aria) `فتح القائمة {list.name}`
- (dynamic) `{n} عنوان` / `{n} عناوين` *(collage badge)*
- لا يوجد وصف *(italic placeholder on cards without description)*
- (dynamic) `تم التحديث {date}` *(toLocaleDateString)*
- (dynamic, aria) `إعادة تسمية القائمة {list.name}`
- حذف؟ *(inline delete confirm)*
- (aria) تأكيد الحذف
- (aria) إلغاء الحذف
- (dynamic, aria) `حذف القائمة {list.name}`

**علامة تبويب السجل**
- لا يوجد سجل مشاهدة بعد. *(empty state)*
- (dynamic) `S{n}:E{n} · {toLocaleString()}` *(entry subtitle)*

**نافذة إنشاء قائمة**
- (aria) إنشاء قائمة
- إنشاء قائمة جديدة *(h2)*
- الاسم *(label)*
- (placeholder) مثال: ملاحم الفضاء
- الوصف (اختياري) *(label; "(optional)" is a styled span)*
- (placeholder) ماذا يوجد هنا؟
- إلغاء
- إنشاء قائمة

**نافذة إعادة تسمية بطاقة القائمة**
- (aria) تعديل القائمة
- تعديل القائمة *(h2)*
- (aria) اسم القائمة
- (aria) وصف القائمة
- (placeholder) الوصف (اختياري)
- إلغاء
- حفظ

**الإشعارات**
- (toast) تم إنشاء «{list.name}» *(curly quotes in source)*
- (toast) تم حذف القائمة *(×2: list card delete + list-detail delete path is in list-detail-view)*

---

## `src/components/harbor/views/list-detail-view.tsx`

**الخطأ / التحميل**
- هذه القائمة لم تعد موجودة. *(danger banner)*
- (sr-only) جارٍ تحميل القائمة…

**الرأس**
- (dynamic) `قائمة مخصصة · {n} عنوان` / `قائمة مخصصة · {n} عناوين` *(kicker line)*
- تعديل *(button)*
- مشاركة *(button)*
- (dynamic, aria) `مشاركة القائمة {list.name}`
- حذف القائمة؟ *(inline confirm)*
- نعم *(confirm button)*
- (aria) إلغاء الحذف
- (dynamic, aria) `حذف القائمة {list.name}`

**شبكة العناصر**
- هذه القائمة فارغة. افتح أي عنوان واختر «إضافة إلى القائمة». *(empty state; curly quotes in source)*
- تصفح العناوين *(button)*
- (dynamic, aria) `إزالة {item.name} من {list.name}`

**نافذة المشاركة (النسخ اليدوي كخيار احتياطي)**
- (aria) رابط مشاركة القائمة
- (dynamic) مشاركة «{list.name}» *(h3; curly quotes in source)*
- انسخ هذا الرابط لمشاركة قائمتك. يحتوي فقط على العناوين وروابط الملصقات — ولا يتم إرسال أي شيء إلى أي خادم.
- (aria) رابط المشاركة
- إغلاق
- نسخ مرة أخرى

**نافذة التعديل**
- (aria) تعديل القائمة
- تعديل القائمة *(h2)*
- الاسم *(label)*
- (placeholder) مثال: خيال علمي لعطلة نهاية الأسبوع
- الوصف (اختياري) *(label)*
- (placeholder) ما موضوع هذه القائمة؟
- إلغاء
- حفظ

**الإشعارات**
- (toast) تم تحديث القائمة
- (toast) تعذر إنشاء رابط المشاركة
- (toast) تم نسخ رابط المشاركة · (toast description) يمكن لأي شخص يفتحه استيراد هذه القائمة.
- (toast) تعذر النسخ — انسخ الرابط يدويًا
- (toast) تم نسخ رابط المشاركة *(×2 — also in dialog "Copy again" success)*
- (toast) لا يزال النسخ محظورًا — حدّد النص وانسخه يدويًا
- (toast) تم حذف القائمة
- (toast, dynamic) `تمت الإزالة من {list.name}`

---

## `src/components/harbor/views/grid-view.tsx`

**الرأس**
- (aria) رجوع
- (dynamic) `{title}` *(h1, from nav frame)*
- (dynamic) `{type} · {catalogId with "-" → " "}` *(subtitle, capitalized)*
- (dynamic) `· {n} عنصر` / `· {n} عناصر`

**شريط التصفية**
- (aria) تصفية حسب النوع
- الكل *(genre reset chip)*
- (dynamic) `{genre}` *(genre chips from catalog manifest)*
- شرائح الأنواع الاحتياطية عند عدم إعلان أي إضافة عنها — الأفلام: أكشن، مغامرات، رسوم متحركة، كوميديا، جريمة، وثائقي، دراما، عائلة، فانتازيا، تاريخ، رعب، موسيقى، غموض، رومانسي، خيال علمي وفانتازيا، خيال علمي، إثارة، حرب، ويسترن
- شرائح الأنواع الاحتياطية — المسلسلات: أكشن، مغامرات، رسوم متحركة، كوميديا، جريمة، وثائقي، دراما، عائلة، فانتازيا، تاريخ، رعب، غموض، رومانسي، خيال علمي وفانتازيا، خيال علمي، إثارة، حرب، ويسترن، أطفال، واقع، حرب وسياسة
- (placeholder) البحث في الكتالوج…
- (dynamic, aria) `بحث عن {title}`
- (aria) مسح البحث
- مسح الكل *(chip; aria: مسح جميع عوامل التصفية)*
- (aria) مسح جميع عوامل التصفية

**الخطأ / الحالة الفارغة / نهاية الكتالوج**
- (dynamic) `{error message}` *(error banner; fallback string below)*
- فشل تحميل الكتالوج *(fallback error when thrown value is not an Error)*
- لا توجد عناصر تطابق عوامل التصفية النشطة. *(empty with filters)*
- لم يُرجع هذا الكتالوج أي عناصر. *(empty without filters)*
- مسح عوامل التصفية *(empty-state button)*
- (dynamic) `نهاية الكتالوج · {n} عنصر` / `نهاية الكتالوج · {n} عناصر` *(role="status")*

---

## `src/components/harbor/views/detail-view.tsx`

**التحميل / الأخطاء**
- (sr-only) جارٍ تحميل التفاصيل…
- (aria) رجوع
- العنوان غير موجود. قد لا يكون موجودًا في Cinemeta أو إضافاتك. *(error when meta missing)*
- فشل تحميل التفاصيل *(fallback error when thrown value is not an Error)*
- العنوان غير موجود. *(error display fallback)*
- (dynamic) `{error message}`

**شرائح بيانات البطل**
- (dynamic, chip) `{meta.releaseInfo}`
- (tooltip) تصنيف المحتوى *(certification chip)*
- (dynamic) `{tmdb.certification}`
- (dynamic, chip) `{meta.imdbRating}` *(with star icon)*
- (dynamic, chip) `{meta.runtime}`
- (dynamic, chips) `{genre}` *(up to 3)*
- (dynamic, chip) عبر `{meta.addonOrigin.name}`

**أزرار الإجراءات**
- (dynamic) `متابعة S{n}:E{n}` *(series resume button)*
- تشغيل
- التدفقات *(button; tooltip below)*
- (tooltip) اختر تدفقًا محددًا
- (aria-pressed toggle) في قائمة المشاهدة / قائمة المشاهدة
- في قائمة المشاهدة
- قائمة المشاهدة

**طاقم العمل**
- المخرج *(label)*
- (dynamic) `{director names joined ", "}`
- بطولة *(label)*
- (dynamic) `{cast names joined ", "}`

**تلميح الفيلم (من دون أنواع)**
- اضغط على تشغيل لجلب التدفقات لهذا العنوان من الإضافات المثبتة لديك.

**الحلقات**
- لا تتوفر معلومات عن حلقات هذا المسلسل.
- الحلقات *(h2)*
- الأحدث أولًا *(sort toggle)*
- الأقدم أولًا *(sort toggle)*
- (aria) اختيار الموسم
- (dynamic) `الموسم {n}` *(chips)*
- (dynamic) `E{n}` *(episode number prefix)*
- (dynamic) `الحلقة {n}` *(fallback episode title)*
- (dynamic) `{toLocaleDateString()}` *(episode release date)*

**صف توصيات TMDB**
- (aria) موصى به من TMDB
- موصى به لك *(h2)*
- عبر TMDB *(chip)*

**صف المزيد من هذا النوع**
- (aria) المزيد مثل هذا
- المزيد مثل هذا *(h2)*
- (dynamic, chip) `{genre}`

---

## `src/components/harbor/views/addons-view.tsx`

**المقدمة**
- Horse هو عميل محايد لبروتوكول إضافات Stremio المفتوح. ثبّت إضافات الكتالوجات والتدفقات والترجمات عبر رابط manifest. لا يستضيف Horse أي محتوى — أنت تضيف إضافاتك بنفسك. *(NOTE: "Harbor" wording — pre-rename leftover; likely should read "Horse")*

**شريط ملخص الحالة**
- (aria) ملخص حالة الإضافة
- (dynamic) `{n} سليمة`
- (dynamic) `{n} لا تستجيب`
- (dynamic) `· تم فحص {checked}/{total}`
- إعادة اختبار الكل *(button)*
- (tooltip) إعادة اختبار كل إضافة تم فحصها
**شريط التثبيت**
- (placeholder) https://my-addon.example.com/manifest.json
- (aria) رابط manifest الخاص بالإضافة
- تثبيت *(button)*
- جارٍ التثبيت… *(busy state)*

**قسم الإضافات المثبتة**
- (dynamic) `مثبتة ({n})` *(section heading)*
- لا توجد إضافات مثبتة بعد. *(empty)*
- لا توجد إضافات تطابق عامل التصفية. *(empty with filter)*
- (dynamic) `v{version}` *(version chip; fallback `v?`)*
- (aria) جارٍ اختبار الإضافة *(spinner)*
- (aria) الإضافة سليمة *(status dot)*
- (aria) الإضافة لا تستجيب *(status dot)*
- (dynamic, aria) `اختبار {name}` *(button)*
- (tooltip) اختبار الإضافة
- (dynamic, aria) `تعطيل {name}` / `تمكين {name}` *(toggle button)*
- (tooltip) تعطيل / تمكين
- (dynamic, aria) `تهيئة {name}` *(button)*
- (tooltip) تهيئة
- (dynamic, aria) `إلغاء تثبيت {name}` *(button)*
- (tooltip) إلغاء التثبيت

**سطر حالة الفحص (لكل إضافة)**
- سليم *(verdict chip)*
- لا توجد استجابة *(verdict chip)*
- (dynamic) `{count} تدفقات` / `{count} ترجمات` / `{count} عناصر كتالوج` / `{count} عناصر`
- (dynamic) `· {x.x}ث` *(latency)*
- (dynamic) `· تم الفحص {ago}` حيث ago ∈: الآن · `{m}د مضت` · `{h}س مضت` · `{d}ي مضت`
- (dynamic, tooltip) `آخر فحص {toLocaleString()}`
- (dynamic, tooltip) `آخر فحص {toLocaleString()} — {error}` / `… — لا توجد استجابة`

**قسم إضافات المجتمع**
- إضافات المجتمع *(h2)*
- Cinemeta — كتالوج Stremio الرسمي والبيانات الوصفية للأفلام والمسلسلات. *(suggestion name + description)*
- OpenSubtitles v3 — ترجمات من إضافة مجتمع OpenSubtitles. *(suggestion name + description)*
- كتالوج إضافات مجتمع Stremio — كتالوج شامل لإضافات المجتمع. *(suggestion name + description)*
- تثبيت *(suggestion button)*
- مثبتة *(suggestion button, disabled)*

**الإشعارات**
- (toast, dynamic) `تم تثبيت {addon name}` · (toast description) الإضافة جاهزة للاستخدام.
- (toast) فشل التثبيت · (toast description, dynamic) `{error}` / البديل: تعذر تحميل manifest
- (toast, dynamic) `تمت إزالة {addon name}`
- (toast, dynamic) عنوان/نص نتيجة الفحص *(from describeProbe in lib/harbor/addon-probe.ts — text defined there, rendered here)*

---

## `src/components/harbor/views/addon-detail.tsx`

**الإضافة غير موجودة**
- الإضافة غير موجودة.

**الرأس**
- (aria) رجوع
- (dynamic) `{m.name}` *(h1)*
- (dynamic) `{m.id} · v{version}` *(version line; fallback `v?`)*
- (dynamic) `{m.description}`
- (dynamic, alt) فارغ *(logo alt="")*

**بطاقات المعلومات**
- الأنواع *(card title)*
- الموارد *(card title)*
- الكتالوجات *(card title)*
- جهة الاتصال *(card title)*
- لا شيء *(empty info card)*
- (dynamic) `{type}` / `{resource}` / `{catalog name} ({type})` / `{contactEmail}` *(list items)*

**عنوان URL للنقل**
- عنوان URL للنقل: *(bold label)*
- (dynamic) `{addon.transportUrl}`

---

## `src/components/harbor/views/catalogs-view.tsx`

**المقدمة**
- كل كتالوج توفره إضافاتك المثبتة، في مكان واحد.

**الحالة الفارغة**
- لا توجد كتالوجات بعد.
- تثبيت الإضافات *(button)*

**بطاقات الكتالوج**
- (dynamic) `{catalog.name}` *(card title)*
- (dynamic) `{addon.manifest.name} · {catalog.type}` *(card subtitle; type capitalized)*
- قابل للبحث *(chip)*
- (dynamic) `{n} أنواع` *(chip)*
- يحتاج إلى مصطلح بحث *(warning chip)*

---

## `src/components/harbor/views/wrapped-view.tsx`

**التحميل**
- (sr-only) جارٍ تحميل إحصاءاتك…

**الرأس / المشاركة**
- تعذر إنشاء البطاقة *(role="alert"; source uses &apos;)*
- (aria) مشاركة الإحصاءات
- مشاركة الإحصاءات *(button)*
- (toast) تم تنزيل بطاقة المشاركة
- كل ما شاهدته على هذا الجهاز، محسوب محليًا. *(intro; source uses &apos;)*
- (dynamic) اسم ملف التنزيل: `harbor-wrapped.png` *(share card file)*

**بطاقات الإحصاءات**
- إجمالي وقت المشاهدة
- الأفلام
- الحلقات
- الأيام النشطة
- (dynamic) `{h}س {m}د` / `{m}د` / `{s}ث` *(fmtDuration values)*

**بطاقة آخر 14 يومًا**
- آخر 14 يومًا *(h2)*
- (dynamic) `أفضل يوم: {duration}`
- (aria) مخطط نشاط المشاهدة
- (dynamic, tooltip) `{date}: {duration}`

**بطاقة خريطة آخر 365 يومًا**
- آخر 365 يومًا *(h2)*
- (dynamic) `{n} أيام نشطة`
- (aria) خريطة نشاط المشاهدة لآخر 365 يومًا
- (dynamic, tooltip) `{Mon} {date} · {duration}` *(per cell; months Jan–Dec)*
- (sr-only, dynamic) `خلال آخر 365 يومًا شاهدت {duration} على مدار {n} يومًا نشطًا.`
- أقل *(legend)*
- أكثر *(legend)*
- الإثنين / الثلاثاء / الأربعاء / الخميس / الجمعة / السبت / الأحد *(weekday gutter; only Mon, Wed, Fri visible, aria-hidden)*

**الإنجازات**
- الإنجازات *(h2)*
- (dynamic) `{earned}/{total} مكتسبة`
- الخطوات الأولى — شاهد أول عنوان لك — التقدم: `تمت مشاهدة عنوان واحد أو أكثر` / `0/1 عنوان`
- النهم — 3 حلقات أو أكثر من مسلسل واحد في يوم — التقدم: `الأفضل: {n} حلقات` / `{n}/3 حلقات في يوم`
- بومة الليل — شاهد بين منتصف الليل و5 صباحًا — التقدم: `{n} جلسات ليلية` / `لا توجد جلسات ليلية بعد`
- المستكشف — اكتشف 10 عناوين مختلفة — التقدم: `{n} عناوين مكتشفة` / `{n}/10 عناوين`
- المخلص — شاهد عنوانًا واحدًا في 5 جلسات منفصلة أو أكثر — التقدم: `الأعلى: {n} جلسات` / `{n}/5 جلسات لعنوان واحد`
- ماراثوني — 8 ساعات أو أكثر من المشاهدة في يوم واحد — التقدم: `أفضل يوم: {duration}` / `أفضل يوم: {duration} من 8 ساعات`

**الأكثر مشاهدة / أفضل الأنواع**
- الأكثر مشاهدة *(h2)*
- (dynamic) `{n} جلسات · {duration}` *(title subtitle when count > 1)*
- أفضل الأنواع *(h2)*
- (aria) جارٍ تحديد الأنواع *(skeleton state)*
- الأنواع غير متاحة — تعذر الوصول إلى Cinemeta لهذه العناوين.
- لا توجد بيانات أنواع لسجل مشاهدتك بعد.

**ملاحظة الخصوصية**
- تُحسب الإحصاءات محليًا من سجل المشاهدة لديك. الخصوصية مصممة بهذا الشكل — لا يغادر أي شيء هذا الجهاز إلا إذا سجلت الدخول إلى Stremio.

**الحالة الفارغة**
- وقت المشاهدة *(preview label)*
- الأيام النشطة *(preview label)*
- العنوان الأعلى *(preview label)*
- عامك في القصص *(h2)*
- وقت المشاهدة، والأيام النشطة، وأفضل العناوين والأنواع — تُحسب محليًا من سجل المشاهدة على هذا الجهاز. لا يغادر أي شيء متصفحك إلا إذا سجلت الدخول بنفسك.
- تصفح الأفلام *(button)*
- أفضل المسلسلات *(button)*
- فتح البث التلفزيوني المباشر *(button)*

---

## `src/components/harbor/views/picker-overlay.tsx`

**إطار النافذة / الرأس**
- (aria) منتقي التدفقات
- اختر تدفقًا *(h2)*
- (dynamic) `مسلسل · {targetId}` / `{targetId}` *(subtitle)*
- (dynamic) `· S{n}:E{n}` *(subtitle suffix)*
- (aria) تحديث التدفقات · (tooltip) تحديث
- (aria) إغلاق المنتقي

**شرائح التصفية**
- الكل
- مجاني
- مخزن مؤقتًا
- 4K
- 1080p
- عرض الكل *(visibility toggle when everything is shown; tooltip below)*
- قابل للتشغيل هنا *(visibility toggle default; tooltip below)*
- (dynamic) ` ({n} مخفي)` *(suffix on "Playable here")*
- (tooltip) عرض جميع التدفقات
- (tooltip, dynamic) `عرض التدفقات القابلة للتشغيل هنا` / `عرض التدفقات القابلة للتشغيل هنا — {n} مخفي`
- (placeholder) تصفية…
- (aria) تصفية التدفقات

**تلميح بدون debrid**
- تعمل تدفقات التورنت عبر محرك P2P المدمج — لا حاجة إلى حساب. اربط debrid للحصول على روابط مخزنة مؤقتًا بشكل فوري. *(with "built-in P2P engine" bolded)*
- اتصال *(inline button)*

**حالات المحتوى**
- (dynamic) `جارٍ الاستعلام من إضافات التدفقات {progress}/{total}…` *(loading)*
- (dynamic) `{error message}` *(error banner)*
- لا توجد إضافات تدفقات مثبتة. ثبّت إضافة تدفقات لمشاهدة العناوين. *(error when no stream addons)*
- فشل جلب التدفقات *(fallback error)*
- لا توجد تدفقات مطابقة. جرّب التحديث أو إزالة عوامل التصفية. *(empty state)*
- (dynamic) `{tier}` *(tier heading from lib/harbor/scoring.ts: e.g. 4K HDR, 4K, 1080p HDR, 1080p, 720p, SD)*
- (dynamic) `{n} تدفقات` *(tier count)*

**صفوف التدفقات**
- (dynamic, aria) `{titleLine} — تشغيل التدفق`
- تدفق *(fallback first line when a stream has no title/description)*
- (dynamic) `{p.resolution}` *(chip; fallback `—`)*
- (dynamic) `{p.hdrFormat}` *(HDR chip)*
- شارات التوافق (التسمية / التلميح):
  - يعمل هنا — (tooltip) تشغيل مباشر — هذا التدفق متوافق مع متصفحك
  - عبر الوكيل — (tooltip) يعمل عبر الوكيل الآمن (تتم معالجة CORS/headers)
  - تحويل — (tooltip) يحتاج إلى تحويل عند الطلب (MKV/HEVC/AC3-DTS) — يحول الخادم إلى H.264/AAC
  - خارجي — (tooltip) يفتح في علامة تبويب جديدة (رابط خارجي أو YouTube)
  - لا يمكن التشغيل — (tooltip) لا يمكن تشغيله في هذا المتصفح باستخدام إعدادات الخادم الحالية
- (dynamic, tooltip) `{cls.reasons joined " · "}` *(shown instead of default tooltip when reasons exist)*
- (dynamic) `{p.codec}` · `{formatSize(p.size)}` · `{n} مزودو اتصال` · `{p.source}` *(quality-info row)*
- DEBRID *(chip)*
- P2P *(chip)*
- (dynamic) `{stream.addonName}` / البديل: إضافة
- (dynamic, aria-live overlay) جارٍ تجهيز الملف… / جارٍ الانضمام إلى السرب…
- (dynamic) `{n} أقران` / جارٍ البحث عن أقران · `· {s}ث`
- تشغيل *(P2P play button)*
- جارٍ الاتصال… *(P2P busy state)*
- (aria) التشغيل عبر P2P *(when no debrid key)* / التشغيل عبر محرك تورنت P2P
- (tooltip) تشغيل مجاني عبر محرك P2P المدمج / التشغيل عبر محرك P2P المدمج (أبطأ)
- فتح القفل *(debrid unlock button)*
- جارٍ فتح القفل… *(busy state)*
- Debrid *(unlock button when no key configured)*
- (aria) فتح القفل باستخدام debrid
- (tooltip) اربط خدمة debrid للحصول على روابط فورية / افتح القفل باستخدام خدمة debrid

**الأخطاء / الإشعارات في الصفوف**
- (toast) التدفق غير متاح · (toast description, dynamic) `{msg}`
- فشل فتح القفل *(fallback unlock error)*
- فشل تدفق P2P *(fallback P2P error)*
- تعذر العثور على أقران لهذا التورنت. قد يكون السرب متوقفًا أو قد تحظر هذه الشبكة BitTorrent — ستفتح خدمة debrid القفل فورًا.
- (dynamic) `يستخدم هذا الملف فيديو {CODEC} لا يمكن للمتصفحات تشغيله — افتحه باستخدام debrid بدلًا من ذلك.` *(e.g. HEVC)*

**نافذة إعداد debrid المضمنة**
- (aria) ربط خدمة debrid
- ربط debrid *(h2)*
- تدفقات مخزنة مؤقتًا بشكل فوري — يبقى مفتاحك في هذا المتصفح.
- (aria) إغلاق
- (aria, radiogroup) خدمة Debrid
- Real-Debrid *(radio option; also used as serviceName)*
- AllDebrid *(radio option; also used as serviceName)*
- (dynamic) `مفتاح API لـ {serviceName}` *(field label)*
- (placeholder) ألصق مفتاح API الخاص بـ Real-Debrid / ألصق مفتاح API الخاص بـ AllDebrid
- يبدو مفتاح API قصيرًا جدًا — انسخ المفتاح الكامل من صفحة حسابك.
- تعذر التحقق من المفتاح. *(fallback validation error)*
- (toast) تم ربط Debrid · (toast description, dynamic) `تم التحقق من {serviceName} — يمكن فتح التدفقات المخزنة مؤقتًا فورًا الآن.`
- جارٍ التحقق… *(busy state)*
- ربط *(submit button)*
- الحصول على المفتاح *(external link button)*
- (tooltip) افتح صفحة حسابك للعثور على مفتاح API
- ليس لديك حساب debrid؟ لا تزال التورنتات تعمل مجانًا عبر محرك P2P المدمج — debrid يجعل التدفقات المخزنة مؤقتًا فورية فقط.

---

## `src/components/harbor/views/settings-view.tsx`

*(أكبر ملف — يحتوي على معظم نصوص الإعدادات. النصوص داخل مكونات chrome المستوردة — QuickAccess وUserChip وTmdbCard وTmdbAttribution وLinkAccountFlow وRatingsSettingsCard وThemeStudio — معرّفة في ملفاتها الخاصة ضمن src/components/harbor/chrome/ ولا تتكرر هنا.)*

**رأس الصفحة وعلامات تبويب الأقسام**
- الإعدادات *(h1)*
- (aria) أقسام الإعدادات
- الأساسيات *(tab)*
- المشغل *(tab)*
- المظهر *(tab)*
- اللغة *(tab)*
- التكاملات *(tab)*
- البيانات *(tab)*
- حول *(tab)*

**— لوحة الأساسيات —**
- التشغيل الفوري / افتح أفضل تدفق مباشرةً عند الضغط على تشغيل
- التشغيل التلقائي للحلقة التالية / انتقل إلى الحلقة التالية تلقائيًا
- استئناف التشغيل / تابع من حيث توقفت
- تأكيد مغادرة التشغيل / اسأل قبل إغلاق المشغل
- إظهار شارات البطاقات / شارات تقييم IMDb على الملصقات
- وضع الصفحة الرئيسية / تخطيط Harbor مع الواجهة الرئيسية، أو الصفوف الكلاسيكية فقط *(NOTE: "Harbor" wording — pre-rename leftover)*
- (segment options, raw ids rendered capitalized) harbor / classic
- إظهار جميع صفوف الإضافات في الصفحة الرئيسية / تضمين كل صف من كتالوجات الإضافات
- إخفاء المشاهَد في الكتالوجات / تصفية العناوين التي شاهدتها بالفعل
- إخفاء شريط التنقل تلقائيًا / إخفاء الرصيف الزجاجي أثناء التمرير لأسفل، وإظهاره أثناء التمرير لأعلى
- (dynamic) حجم الملصق / `{n}%`
- (dynamic) نصف قطر زوايا الملصق / `{n}px`

**— لوحة المشغل —**
- استخدام وكيل آمن عند الحاجة / توجيه التدفقات المحظورة عبر هذا الخادم (إصلاح CORS ورؤوس المصدر)
- (segment options) تلقائي / دائمًا / أبدًا
- تحويل التدفقات غير المتوافقة / MKV/HEVC/AC3-DTS → H.264/AAC على الخادم (يستخدم CPU) *(only when server supports transcode)*
- (segment options) تلقائي / سؤال / أبدًا
- إظهار التدفقات القابلة للتشغيل في المتصفح فقط / يخفي منتقي التدفقات المصادر غير القابلة للتشغيل افتراضيًا
- تفضيل H.264/AAC / ترتيب برامج الترميز الآمنة للمتصفح قبل HEVC عند فرز التدفقات
- (dynamic) خطوة التقديم / `تقدم مفاتيح الأسهم ±{n}ث` · عرض القيمة `{n}ث`
- (dynamic) حجم الترجمة / `{n}px`
- (dynamic) خلفية الترجمة / `{n}% شفافية خلف النص`
- (dynamic) إطار الترجمة / مخطط `{n}px`
- ملء الفيديو / كيفية ملاءمة الفيديو للشاشة
- (segment options, raw ids rendered capitalized) fit / fill / zoom
- هيكل المشغل / عناصر تحكم بأسلوب Stremio أو Harbor *(NOTE: "Harbor" wording — pre-rename leftover)*
- (segment options, raw ids rendered as-is) auto / default / stremio
- تخطيط منتقي التدفقات / صفوف مختصرة أو مستويات بأسلوب Stremio

- (segment options, raw ids rendered as-is) stremio / condensed
- معلومات الجودة في المنتقي / عرض برنامج الترميز والحجم وتفاصيل المصدر

**— لوحة المظهر —**
- المظهر / مخطط Material 3 فاتح أو داكن من لوحة الألوان الحالية
- (segment options) داكن / فاتح
- التباين / مستوى تباين المخطط — أعلى لتسهيل القراءة
- (segment options) قياسي / متوسط / عالٍ
- استوديو المظهر *(h2)*
- أنشئ لوحة ألوان وخطوطًا وتخطيطًا مخصصًا بالكامل — مع معاينة مباشرة. لونك المميز هو الأساس للوحة Material 3.
- (dynamic) ` نشط: {customName}` *(inline suffix when a custom theme is active)*
- فتح استوديو المظهر *(button)*
- السمات المحفوظة *(label)*
- (dynamic, aria) `تطبيق السمة {name}`
- (dynamic, aria) `حذف السمة {name}`
- (dynamic) `{layout} · {fontPair}` *(theme card caption, capitalized)*
- السمات الجاهزة *(h2)*
- لونك المميز هو الأساس للوحة Material 3.
- (dynamic) أسماء السمات المعروضة هنا والمُعرّفة في lib/harbor/themes.ts: Horse · Nord · Stremio · Crunchy · Royal · Dracula · Forest · Noir · Aurora · Velvet · MinUI
- (dynamic) `{layout} تخطيط` *(preset card caption, capitalized)*
- تنسيق الخطوط *(h2)*
- (dynamic) أسماء أزواج الخطوط المعروضة هنا والمُعرّفة في lib/harbor/themes.ts: Sentient / Switzer · Fraunces / Inter · General Sans · Cabinet / Switzer · IBM Plex · Plus Jakarta · System
- الخلفية المخصصة *(h2)*
- رفع صورة *(button)*
- إزالة *(button, when a background is set)*
- تعتيم *(slider label)*
- (aria) رفع صورة الخلفية
- (toast) الصورة كبيرة جدًا · (toast description) استخدم صورة أقل من 3 ميجابايت.

**— لوحة اللغة —**
- لغات الترجمة المفضلة *(headline)*
- فعّل اللغات أدناه ثم رتّبها — يختار المشغل أعلى تطابق حسب الأولوية أولًا.
- شرائح اللغات: الإنجليزية · الإسبانية · الفرنسية · الألمانية · اليابانية · الكورية · الصينية · العربية · الهندية · البرتغالية · الروسية · الإيطالية
- ترتيب الأولوية *(label)*
- (aria) أولوية لغة الترجمة
- (tooltip) اسحب لإعادة الترتيب
- الاختيار الأفضل *(badge on first language)*
- (dynamic, aria) `تحريك {lang} لأعلى` · (tooltip) تحريك لأعلى
- (dynamic, aria) `تحريك {lang} لأسفل` · (tooltip) تحريك لأسفل
- (dynamic, aria) `إزالة {lang}` · (tooltip) إزالة
- الترجمة متوقفة افتراضيًا / لا تفعّل مسارات الترجمة تلقائيًا

**— لوحة البيانات —**
- تصدير نسخة احتياطية / حفظ الإعدادات والإضافات وقائمة المشاهدة ({n} عناصر) في ملف .harbx *(description dynamic)*
- تصدير *(button)*
- استعادة نسخة احتياطية / استيراد ملف نسخة احتياطية .harbx
- استعادة *(button)*
- (aria) استيراد ملف النسخة الاحتياطية
- مسح البيانات المحلية / إزالة جميع بيانات Horse من هذا المتصفح
- مسح *(button)*
- (dynamic) حجم الإعدادات الحالي / `{x.x} KB في localStorage`
- (toast) تم تصدير النسخة الاحتياطية · (toast description, dynamic) `تم حفظ {n} مفاتيح.`
- (toast) تمت استعادة النسخة الاحتياطية · (toast description, dynamic) `تمت استعادة {n} مفاتيح. جارٍ إعادة التحميل…`
- (toast) فشلت الاستعادة · (toast description, dynamic) `{error}` / البديل: ملف غير صالح
- (toast) تم مسح البيانات المحلية · (toast description) جارٍ إعادة التحميل…
- ملف النسخة الاحتياطية ليس لبرنامج Horse *(thrown error shown in the Restore-failed toast)*
- (dynamic) اسم ملف النسخة الاحتياطية: `harbor-web-backup-{YYYY-MM-DD}.harbx`

**بطاقة المزامنة السحابية (داخل البيانات)**
- المزامنة السحابية *(h3)*
- شارة الحالة: متوقفة / محدثة / جارٍ المزامنة… / خطأ في المزامنة / خاملة
- (enabled) يتم تخزين الإضافات والإعدادات والسمات وقائمة المشاهدة والمتابعة والسجل على هذا الخادم (SQLite). سجّل الدخول إلى Stremio لاستعادتها في أي متصفح؛ بدون حساب، تتم مزامنة المفاتيح مع هذا الجهاز.
- (disabled) المزامنة معطلة. تبقى بياناتك في هذا المتصفح فقط — صدّر نسخة احتياطية إذا أردت نسخة ثانية.
- (dynamic) `مفتاح الجهاز المجهول {deviceId}` · ` · آخر مزامنة {toLocaleTimeString()}` / ` · لم تتم المزامنة بعد` · ` · {error}`
- (aria) تبديل المزامنة السحابية
- (toast) تم تفعيل المزامنة السحابية · (toast description) ستبدأ أول مزامنة الآن.
- (toast) تم تعطيل المزامنة السحابية · (toast description) ستبقى البيانات المحلية دون تغيير.
- مزامنة الآن *(button)*
- (toast) تمت المزامنة · (toast description) مكتبتك محدثة على الخادم.

**— لوحة حول —**
- (aria) شعار Horse *(brand mark label)*
- Horse *(h2)*
- تثبيت التطبيق *(button)*
- (toast) جارٍ تثبيت Horse… · (toast description) ستجده في قائمة تطبيقاتك.
- مثبت كتطبيق *(badge)*
- عميل ويب مستقل لبروتوكول إضافات Stremio — منفذ ويب لتطبيق Harbor المكتبي من مشروع Harbor (github.com/harborstremio/harbor)، مرخص بموجب MIT.
- Horse مركز وسائط مستقل ومفتوح المصدر لبروتوكول إضافات Stremio. ولا يرتبط بـStremio. لا يستضيف الوسائط ولا يفهرسها ولا يوزعها، ولا يضم إضافات محتوى — يثبت المستخدمون إضافاتهم بأنفسهم. *(with "not affiliated with Stremio" styled as emphasis)*
- مرخص بموجب MIT. الإسناد: Harbor desktop (github.com/harborstremio/harbor).
- (dynamic, via TmdbAttribution component) سطر إسناد TMDB — المكون معرّف في chrome/tmdb-card.tsx

**بطاقة اختصارات لوحة المفاتيح**
- اختصارات لوحة المفاتيح *(h3)*
- / — التركيز على البحث
- Space — تشغيل / إيقاف مؤقت
- F — ملء الشاشة
- ← / → — التقديم ±10ث
- ↑ / ↓ — مستوى الصوت
- M — كتم الصوت
- S / C — التنقل بين الترجمات
- N / B — الحلقة التالية / السابقة
- W — تبديل التدفق
- E — لوحة الحلقات
- Esc — إغلاق المشغل
- 0–9 — الانتقال إلى %
- Backspace — رجوع

**— لوحة التكاملات —**
- التكاملات *(h2)*
- اربط خدمات اختيارية من جهات خارجية. يحافظ الربط عبر رمز التفعيل على تشفير الرموز المميزة على خادم هذا التطبيق؛ ولا يراها المتصفح مطلقًا.
- لا يوزع Horse مفاتيح API مشتركة. يجلب كل مستخدم بيانات اعتماده الخاصة — وهذا يبقي التطبيق قابلًا للاستضافة ذاتيًا ويتجنب استخدام حصة أي شخص آخر عبر الوكيل. *(footer note with shield icon)*

**بطاقة Trakt**
- Trakt.tv *(h3)*
- (dynamic) `متصل باسم @{username}` / `متصل` / استيراد قائمة مشاهدة Trakt الخاصة بك *(status line)*
- قطع الاتصال *(button)*
- متقدم: استخدم بيانات اعتماد تطبيق Trakt الخاصة بك *(collapsed <details> summary)*
- معرّف العميل *(label)*
- (placeholder) معرّف تطبيق Trakt الخاص بك
- سر العميل (اختياري — تطبيقات PKCE لا تحتوي عليه) *(label)*
- (placeholder) سر تطبيق Trakt الخاص بك
- أنشئ تطبيقًا مجانيًا على trakt.tv/oauth/applications/new (سمّه بأي اسم؛ لا يُستخدم عنوان إعادة التوجيه في تدفق الجهاز). لا تغادر بيانات الاعتماد هذا المتصفح إلا للمصادقة مع Trakt نفسه. *(link text: trakt.tv/oauth/applications/new)*
- ربط *(button)*
- (dynamic) `انتقل إلى {verificationUrl} وأدخل هذا الرمز:` *(link text is the URL minus protocol)*
- (aria) رمز الجهاز
- بانتظار التفويض…
- إلغاء *(button)*
- استيراد قائمة المشاهدة *(button)*
- (dynamic) `آخر استيراد: +{n} جديد` / `تحتوي قائمة المشاهدة المحلية على {n} عناوين`
- استيراد السجل *(button)*
- (dynamic) `آخر استيراد: +{n} تشغيلات`
- دفع قائمة المشاهدة *(button)*
- (dynamic) `آخر دفع: +{n} · {n} غير موجودة على Trakt` / `آخر دفع: +{n}`
- تسجيل المشاهدة في Trakt أثناء التشغيل *(switch label + aria)*
- إبقاء قائمة المشاهدة متزامنة (دفع الإضافات إلى Trakt) *(switch label)*
- (aria) إبقاء قائمة المشاهدة متزامنة مع Trakt
- اتجاه واحد: تنتقل الإضافات إلى Trakt بعد بضع ثوانٍ من إضافتها. لا يتم دفع عمليات الاستيراد من Trakt مرة أخرى، ولا تتم إزالة أي شيء من قائمة Trakt الخاصة بك. *(hint)*
- (toast) تم ربط Trakt · (toast description) يمكنك الآن استيراد قائمة المشاهدة.
- (toast) معرّف العميل مطلوب
- (toast) أدخل الرمز في Trakt · (toast description) وافق على الوصول للمتابعة.
- (toast) تعذر بدء تدفق Trakt · (toast description, dynamic) `{error}`
- (toast, dynamic) `تم استيراد {n} عنوان` / `تم استيراد {n} عناوين` / قائمة المشاهدة محدثة بالفعل · (toast description) تم دمجها مع قائمة المشاهدة في مكتبتك.
- (toast) فشل الاستيراد · (toast description, dynamic) `{error}`
- (toast, dynamic) `تم استيراد {n} تشغيل` / `تم استيراد {n} تشغيلات` / السجل محدث بالفعل · (toast description) تم دمجه مع سجل التشغيل.
- (toast) فشل استيراد السجل · (toast description, dynamic) `{error}`
- (toast) فشل الدفع · (toast description, dynamic) `{error}`
- (toast) لا يوجد شيء لدفعه · (toast description) لا تحتوي قائمة المشاهدة على عناوين مرتبطة بـimdb — ثبّت بيانات Cinemeta الوصفية للحصول على معرّفات imdb.
- (toast, dynamic) `تم دفع {n} عنوان` / `تم دفع {n} عناوين` ` إلى Trakt` / قائمة مشاهدة Trakt محدثة بالفعل · (toast description, dynamic) `تعذر مطابقة {n} عنوان(عناوين) على Trakt.`
- (toast) تم قطع اتصال Trakt
- (toast) مزامنة قائمة المشاهدة مفعلة · (toast description) سيتم دفع العناوين التي تضيفها إلى قائمة المشاهدة من الآن فصاعدًا إلى Trakt تلقائيًا.
- (toast) تم إلغاء اتصال Trakt

**بطاقة Simkl** *(تحاكي بطاقة Trakt)*
- Simkl *(h3)*
- (dynamic) `متصل باسم @{username}` / `متصل` / استيراد قائمة مشاهدة Simkl الخاصة بك
- قطع الاتصال
- متقدم: استخدم بيانات اعتماد تطبيق Simkl الخاصة بك *(summary)*
- معرّف العميل *(label)*
- (placeholder) معرّف تطبيق Simkl الخاص بك
- سر العميل (اختياري) *(label)*
- (placeholder) فقط إذا كان تطبيق Simkl الخاص بك يحتوي عليه
- أنشئ تطبيقًا مجانيًا على simkl.com/apps/new (اختر أي اسم؛ تحتاج فقط إلى معرّف العميل). لا تغادر بيانات الاعتماد هذا المتصفح إلا للمصادقة مع Simkl نفسه. *(link text: simkl.com/apps/new)*
- ربط
- (dynamic) `انتقل إلى {verificationUrl} وأدخل هذا الرمز:`
- (aria) رمز PIN
- بانتظار التفويض…
- إلغاء
- استيراد قائمة المشاهدة
- (dynamic) `آخر استيراد: +{n} جديد` / `تحتوي قائمة المشاهدة المحلية على {n} عناوين`
- استيراد السجل
- (dynamic) `آخر استيراد: +{n} تشغيلات`
- (toast) تم ربط Simkl · (toast description) يمكنك الآن استيراد قائمة المشاهدة.
- (toast) معرّف العميل مطلوب
- (toast) أدخل الرمز في Simkl · (toast description) وافق على الوصول للمتابعة.
- (toast) تعذر بدء تدفق Simkl · (toast description, dynamic) `{error}`
- (toast, dynamic) `تم استيراد {n} عنوان` / `تم استيراد {n} عناوين` / قائمة المشاهدة محدثة بالفعل · (toast description) تم دمجها مع قائمة المشاهدة في مكتبتك.
- (toast) فشل الاستيراد
- (toast, dynamic) `تم استيراد {n} تشغيل` / `تم استيراد {n} تشغيلات` / السجل محدث بالفعل · (toast description) تم دمجه مع سجل التشغيل.
- (toast) فشل استيراد السجل
- (toast) تم قطع اتصال Simkl
- (toast) تم إلغاء اتصال Simkl

**بطاقة Debrid**
- Debrid *(h3)*
- (dynamic) `متصل باسم {username}` / `متصل` / فتح تدفقات التورنت المخزنة مؤقتًا فورًا *(status line)*
- مميز / غير مميز *(status badges, ×2 placements)*
- (aria, tablist) خدمة Debrid
- Real-Debrid / AllDebrid *(segment tabs; also serviceName)*
- (dynamic) `تنتهي الصلاحية {toLocaleDateString()}`
- قطع الاتصال *(button)*
- (toast, dynamic) `{serviceName} تم قطع الاتصال`
- (dynamic) `مفتاح API لـ {serviceName}` *(field label)*
- (placeholder) مفتاح API الخاص بـ Real-Debrid / مفتاح API الخاص بـ AllDebrid
- اعثر عليه في صفحة real-debrid.com/account / alldebrid.com/api، ثم تحقّق منه هنا. *(link text varies by service)*
- تحقق *(button)*
- (toast) ألصق مفتاح API أولًا
- (toast) تم ربط Debrid · (toast description, dynamic) `تم التحقق من حساب {serviceName}.`
- (toast) فشل التحقق · (toast description, dynamic) `{error}`
- يتم تخزين مفتاحك في هذا المتصفح فقط وتمريره من جهة الخادم لكل طلب. تُفتح تدفقات التورنت المخزنة مؤقتًا بواسطة الخدمة فورًا؛ أما التورنتات غير المخزنة مؤقتًا فتُتخطى (خطأ صريح).
- تدفقات مفتوحة باستخدام Debrid — تبقى الروابط المحلولة حية خلال الجلسة الحالية فقط؛ ولا يتم احتساب أي شيء أو تخزينه.

**بطاقة محرك تورنت P2P**
- محرك تورنت P2P *(h3)*
- تشغيل التورنتات دون أي حساب — BitTorrent من جهة الخادم *(subtitle)*
- (dynamic) شارة الحالة: جارٍ التحقق… / `متصل · المنفذ {P2P_PORT}` / غير متصل
- تشغيل التورنتات عبر P2P *(row title)*
- انضم إلى الأسراب مباشرةً عندما توفر إضافة التدفقات تورنتات فقط. يظل Debrid المسار الأسرع للإصدارات المخزنة مؤقتًا. *(row description)*
- (aria) تبديل تشغيل تورنت P2P
- (dynamic) لا توجد أسراب نشطة / `{n} سرب نشط` / `{n} أسراب نشطة` + اختياريًا ` · {formatted speed}`
- تحديث *(button)*
- (dynamic) `{n} أقران` · `{progress}%` · السرعة *(per-torrent rows)*
- محرك التورنت غير قابل للوصول — سيفشل تشغيل P2P حتى تعمل خدمة التورنت. تشغيل Debrid لا يتأثر. *(offline error box)*
- تُنزّل التورنتات إلى ذاكرة تخزين مؤقت على الخادم وتُبث عبر HTTP (حاويات أصلية) أو من خلال إعادة تغليف ffmpeg (mkv). تتم إزالة الأسراب الخاملة بعد 45 دقيقة؛ وتسقط الأسراب التي لا تجد أقرانًا بعد 90 ثانية.
- إيقاف الكل *(button)*
- مسح ذاكرة التخزين المؤقت *(button)*
- (toast) تم مسح ذاكرة تورنت التخزين المؤقت · (toast description) تم حذف جميع بيانات P2P التي تم تنزيلها.
- (toast) تم إيقاف التورنتات · (toast description) تم إغلاق الأسراب النشطة؛ وتم الاحتفاظ بذاكرة التخزين المؤقت للاستئناف.
- (toast) فشل التنظيف · (toast description, dynamic) `{error}`

 
النطاق: جميع النصوص الظاهرة للمستخدم من 22 ملفًا ضمن `src/components/harbor/` — chrome (هيكل التطبيق، والتنقل، والبحث، ولوحة الأوامر، والمحور، والحساب، والقوائم، والتكاملات، والتقييمات، والاختصارات، واستوديو المظهر، وبطاقات TMDB)، وcommon (الصف، والملصق، وبطاقة البيانات الوصفية)، ومشغل الفيديو الكامل. تظهر النصوص ثنائية اللغة بصيغة `EN / AR` عند أول استخدام. تُحفظ النصوص الديناميكية (المعتمدة على البيانات) كقوالب.

---

## `src/components/harbor/chrome/app-shell.tsx`

**زر الرجوع (عائم فوق صفحات التفاصيل)**
- (aria) رجوع
- رجوع

**التذييل — هوية العلامة وإخلاءات المسؤولية (على مستوى الصفحة الرئيسية فقط)**
- (aria, brand mark) شعار Horse
- Horse
- Horse — مركز وسائط مفتوح المصدر. غير تابع لـStremio. الإضافات يثبتها المستخدمون؛ ولا يستضيف Horse أي محتوى.
- مستوحى من تطبيق Harbor المكتبي: github.com/harborstremio/harbor (MIT). هذا منفذ ويب.
- TMDB *(badge text)*
- يستخدم هذا المنتج واجهة TMDB API، لكنه غير معتمد أو مصدّق من TMDB.

**شريط السمة المشتركة (رابط عميق `#theme=…`)**
- (aria, dialog) السمة المشتركة
- السمة المشتركة: {name} (dynamic — name falls back to `Shared custom theme` for unnamed custom presets, else the preset name)
- تجري المعاينة الآن — احتفظ بها أو استعد مظهرك السابق.
- الاحتفاظ بالسمة
- تجاهل

**شريط القائمة المشتركة (رابط عميق `#list=…`)**
- (aria, dialog) القائمة المشتركة
- القائمة المشتركة: {name} (dynamic)
- {n} عنصر|عناصر — {description} (dynamic — `{n} item` / `{n} items`, plus optional ` — {description}` when the list has one)
- إضافة إلى قوائمي
- تجاهل

**إشعار بعد قبول قائمة مشتركة**
- (toast) تم استيراد {n} عنصر|عناصر (dynamic — `Imported 1 item` / `Imported N items`)
- (toast, description) تمت إضافة «{list name}» إلى قوائمك. (dynamic)

**خطاف مشغل العرض التجريبي (`#/demo-player`، إدخال QA)**
- (dynamic) Big Buck Bunny (Demo) *(default demo title)*
- (dynamic) تدفق تجريبي عام *(default demo episodeName)*

---

## `src/components/harbor/chrome/nav-items.tsx`

**NAV_ITEMS — تسميات الوجهات الرئيسية (EN؛ تغذي لوحة الأوامر، ومنطق الرصيف، ومحور الإعدادات)**
- الرئيسية
- استكشف
- الكتالوجات
- الأفلام
- المسلسلات
- الأنمي
- الأطفال
- البث التلفزيوني المباشر
- التقويم
- المكتبة
- الإضافات
- حصاد المشاهدة
- الإعدادات

**DOCK_TABS — علامات تبويب الرصيف الزجاجي (أزواج EN + AR كاملة)**
- Settings / الإعدادات
- Kids / الأطفال
- Anime / الأنمي
- Home / الرئيسية

**HUB_ENTRIES — بطاقات محور الوصول السريع للإعدادات (أزواج EN + AR كاملة)**

- Discover — استكشف
  - EN desc: الأكثر رواجًا وأفضل الاختيارات عبر الأفلام والمسلسلات
  - AR desc: الأكثر رواجاً والأفضل تقييماً في الأفلام والمسلسلات
  - keywordsEN: discover, explore, trending, browse
  - keywordsAr: استكشف, اكتشف, الرائج, تصفح
- Library — المكتبة
  - EN desc: قائمة المشاهدة، والمتابعة، ومجموعتك
  - AR desc: قائمة المشاهدة ومتابعة المشاهدة ومجموعتك
  - keywordsEN: library, watchlist, collection, saved
  - keywordsAr: المكتبة, قائمة المشاهدة, المجموعة, المحفوظات
- Movies — أفلام
  - EN desc: الشائعة، والأعلى تقييمًا، وكل أنواع الأفلام
  - AR desc: الأكثر شعبية والأعلى تقييماً وكل تصنيفات الأفلام
  - keywordsEN: movies, films, cinema
  - keywordsAr: أفلام, فيلم, سينما
- Shows — مسلسلات
  - EN desc: المسلسلات الشائعة، والأعلى تقييمًا، والأنواع
  - AR desc: أشهر المسلسلات والأعلى تقييماً وتصنيفاتها
  - keywordsEN: shows, series, tv
  - keywordsAr: مسلسلات, مسلسل, برامج
- Live TV — البث المباشر
  - EN desc: قوائم IPTV والقنوات المباشرة
  - AR desc: قوائم IPTV والقنوات المباشرة
  - keywordsEN: live tv, live, iptv, channels
  - keywordsAr: البث المباشر, مباشر, قنوات, آي بي تي في
- Calendar — التقويم
  - EN desc: جدول بث مسلسلاتك
  - AR desc: جدول عرض مسلسلاتك
  - keywordsEN: calendar, schedule, airing
  - keywordsAr: التقويم, الجدول, مواعيد العرض
- Addons — الإضافات
  - EN desc: تثبيت وإدارة إضافات الكتالوج والتدفقات
  - AR desc: تثبيت وإدارة إضافات الكتالوج والمصادر
  - keywordsEN: addons, extensions, plugins, install
  - keywordsAr: الإضافات, إضافة, إضافات, تثبيت
- Catalogs — الكتالوجات
  - EN desc: تصفح كل كتالوج توفره إضافاتك
  - AR desc: تصفح كل الكتالوجات التي توفرها إضافاتك
  - keywordsEN: catalogs, catalog, browse addons
  - keywordsAr: الكتالوجات, كتالوج, تصفح الإضافات
- Wrapped — حصاد المشاهدة
  - EN desc: إحصاءات مشاهدتك وأبرز لحظات العام
  - AR desc: إحصاءات مشاهدتك وأبرز لحظات العام
  - keywordsEN: wrapped, stats, statistics, history
  - keywordsAr: حصاد المشاهدة, إحصائيات, السجل, ملخص

---

## `src/components/harbor/chrome/brand.tsx`

— (لا يحتوي على نص ظاهر للمستخدم بحد ذاته؛ يعرض SVG الحصان. عند ضبط الخاصية `label` تصبح `aria-label` — ويمرر المستدعون `Horse logo`)

---

## `src/components/harbor/chrome/glass-dock.tsx`

**معالم الرصيف وعلامات التبويب**
- (aria, nav) التنقل الرئيسي
- (aria, tablist) الرئيسية
- (aria, sr-only لكل علامة تبويب + تلميح `title` الأصلي) تسميات علامات التبويب — ثنائية اللغة، من DOCK_TABS: Settings / الإعدادات · Kids / الأطفال · Anime / الأنمي · Home / الرئيسية (ديناميكية حسب لغة الواجهة)

---

## `src/components/harbor/chrome/floating-search.tsx`

**شريط البحث (سطح المكتب) ومشغل الهاتف**
- (aria, phone trigger button) بحث
- (placeholder) بحث…
- (aria, input) البحث عن الأفلام والمسلسلات والأشخاص والإضافات
- AI *(chip text)*
- (tooltip) بحث بالذكاء الاصطناعي: صف ما ترغب في مشاهدته
- / *(kbd hint, visible when idle)*
- (aria) مسح البحث

**القائمة المنسدلة (listbox)**
- (aria, listbox) اقتراحات البحث
- فشل البحث — تحقق من اتصالك وحاول مرة أخرى. *(error line)*

**المجموعات الخاملة (الأخيرة / الرائجة)**
- الأخيرة *(group heading)*
- الرائج الآن *(group heading)*
- اكتب للبحث، أو اضغط `/` في أي وقت. *(empty idle; the `/` is styled as a kbd chip)*
- مسلسل|فيلم *(dynamic per meta type, row subtitle)*
- · {releaseInfo} (dynamic)
- ? *(placeholder glyph inside a round person thumbnail with no image)*

**مجموعات النتائج المباشرة**
- الأفلام *(group heading)*
- المسلسلات *(group heading)*
- انتقال إلى / انتقال سريع *(group heading — explicit AR ternary)*
- الأشخاص *(group heading)*
- من إضافاتك *(group heading)*
- {meta name} (dynamic)
- مسلسل|فيلم · {releaseInfo} · ★ {imdbRating} (dynamic row subtitle)
- {hub label} + {hub description} (dynamic — destination rows from nav-items HUB_ENTRIES, EN/AR per language)
- شخص *(fallback text when a person's `known_for_department` is missing)*
- لا توجد مطابقات سريعة — اضغط Enter للحصول على النتائج الكاملة. *(no results)*
- عرض جميع النتائج لـ“{query}” (dynamic)
- Enter *(kbd hint on the see-all row)*

---

## `src/components/harbor/chrome/search-overlay.tsx`

**إطار النافذة والرأس**
- (aria, dialog) بحث
- (aria) إغلاق البحث *(×2 — mobile back arrow + desktop X; dedupe ×2)*
- (aria, input) استعلام البحث
- (placeholder) البحث عن الأفلام والمسلسلات والإضافات…
- (placeholder, AI mode) صف ما ترغب في مشاهدته… (Enter)
- AI *(chip text)*
- (tooltip) وضع الذكاء الاصطناعي: صف ما تريد مشاهدته
- (aria) مسح الاستعلام

**الأخطاء**
- فشل البحث. تحقق من اتصالك وحاول مرة أخرى.
- حدث خطأ ما. حاول مرة أخرى.

**أقسام النتائج**
- اختيارات الذكاء الاصطناعي
- الأفلام
- المسلسلات
- انتقال إلى *(section heading + aria)*
- من إضافاتك
- {hub label} / {hub description} (dynamic destination rows — EN/AR per language)

**صفوف الأقسام (عناصر قائمة الهاتف)**
- مسلسل|فيلم · {releaseInfo} · ★ {imdbRating} (dynamic row subtitle)

**النتائج الفارغة (اكتمل البحث ولم يُعثر على شيء)**
- لا توجد نتائج لـ“{query}”. (dynamic)
- ثبّت المزيد من الإضافات لتوسيع نطاق تغطية الكتالوج.

**الحالة الخاملة**
- (aria, brand mark) شعار Horse
- Horse
- الأخيرة *(heading; section aria: Recent searches)*
- الرائج الآن *(section heading when trending loaded)*
- اكتب للبحث في Cinemeta وإضافاتك المثبتة. *(idle, no trending)*
- نصيحة: فعّل وضع الذكاء الاصطناعي لوصف ما ترغب في مشاهدته. *(AI is an inline icon here — no word)*

---

## `src/components/harbor/chrome/command-palette.tsx`

**إطار النافذة**
- (aria, dialog) لوحة الأوامر
- (placeholder) اكتب أمرًا أو ابحث…
- (aria, input) البحث في لوحة الأوامر
- (aria, spinner status) جارٍ البحث في المحتوى
- esc *(kbd chip)*
- (aria) إغلاق لوحة الأوامر
- (aria, listbox) الأوامر

**الحالة الفارغة**
- لا توجد مطابقات لـ“{query}” (dynamic)
- جرّب “settings” أو عنوانًا من مكتبتك

**صف التسليم إلى «البحث في كل مكان»**
- البحث في كل مكان عن “{query}” (dynamic)
- ↵ *(kbd hint)*

**المجموعات (تظهر كعلامات محاذاة إلى اليمين في الصفوف)**
- الأخيرة · التنقل · الإعدادات · الإجراءات · المكتبة · الأفلام · المسلسلات · نتائج الإضافات · الإضافات · البحث

**عناصر التنقل** — التسميات من NAV_ITEMS (`Home, Discover, Catalogs, Movies, Shows, Anime, Kids, Live TV, Calendar, Library, Addons, Wrapped`)، مع استبدالها بأسماء المستخدمين (ديناميكي)

**أقسام الإعدادات** (كل منها يُعرض بصيغة `Settings · {label}`)
- الإعدادات · الأساسيات
- الإعدادات · المشغل
- الإعدادات · المظهر
- الإعدادات · اللغة
- الإعدادات · التكاملات
- الإعدادات · البيانات
- الإعدادات · حول

**الإجراءات**
- تبديل وضع الأطفال *(meta chip: `On` / `Off` dynamic)*
- تبديل السمة
- مزامنة الآن
- البحث في المحتوى
- تثبيت التطبيق *(only when PWA install is available)*

**عناصر المكتبة** — العناوين من قائمة المشاهدة / المتابعة / السجل (ديناميكية)؛ تعرض شريحة النوع سلسلة النوع الخام (`movie` / `series`)

**عناصر المحتوى البعيد**
- {title name} (dynamic)
- {releaseInfo} · ★ {imdbRating} (dynamic meta line)

**مجموعة الإضافات**
- إضافة: {addon name} (dynamic)

**تلميحات التذييل**
- ↑ ↓ للتنقل
- ↵ للتحديد
- esc للإغلاق
- ≥2 أحرف للبحث في Cinemeta + الإضافات
- ctrl K للتبديل

---

## `src/components/harbor/chrome/quick-access.tsx`

**الرأس**
- الوصول السريع / Quick Access
- كل الصفحات التي كانت موجودة سابقًا في الشريط الجانبي / Everything that used to live in the sidebar
- تعديل / Edit *(chip when not editing)*
- تم / Done *(chip when editing)*

**بطاقات المحور**
- (aria, card) {label} — {description} (dynamic, EN/AR from HUB_ENTRIES)
- (aria, edit: move up) تحريك لأعلى / Move earlier
- (aria, edit: move down) تحريك لأسفل / Move later
- (aria, edit: hide) إخفاء / Hide

**الشارات**
- {n} إضافة|{n} إضافات / {n} إضافة (dynamic)
- Trakt
- Simkl
- LIVE
- {n} *(library count badge — bare number)*

**البطاقات المخفية (وضع التعديل)**

- إظهار / Show

**صف تلميح التعديل**
- استخدم الأسهم لإعادة الترتيب والعين للإخفاء — يتم حفظ التغييرات تلقائيًا. / Use the arrows to reorder and the eye to hide — changes save automatically.
- استعادة الافتراضي / Reset to default

---

## `src/components/harbor/chrome/page-header.tsx`

- (aria, back button) رجوع / Back
- (aria, breadcrumb nav) مسار التنقل
- Settings / الإعدادات *(breadcrumb parent link)*
- {page title} (dynamic — hub label, EN/AR per language; falls back to raw view id)

---

## `src/components/harbor/chrome/account.tsx`

**نافذة المصادقة**
- تسجيل الدخول إلى Stremio *(dialog title)*
- تذهب بيانات اعتمادك فقط إلى واجهة Stremio الرسمية عبر وكيلنا من جهة الخادم — ولا يتم تخزينها أو تسجيلها مطلقًا. تستورد المزامنة إضافاتك وقائمة المشاهدة والمتابعة.
- البريد الإلكتروني *(field label)*
- (placeholder) you@example.com
- كلمة المرور *(field label)*
- (placeholder) ••••••••
- {error} (dynamic inline alert; fallback text: `فشل تسجيل الدخول`)
- تسجيل الدخول والمزامنة *(button; while busy: `جارٍ تسجيل الدخول…`)*
- غير تابع لـStremio. يمكنك أيضًا استخدام Horse بدون حساب.

**الإشعارات (المصادقة/المزامنة)**
- (toast) تم تسجيل الدخول إلى Stremio
- (toast, description) جارٍ مزامنة إضافاتك ومكتبتك…
- (toast) اكتملت المزامنة
- (toast, description) تم دمج {n} إضافات · تم جلب {n} عناصر من المكتبة (dynamic)
- (toast) فشلت المزامنة *(description: raw error, destructive)*
- (toast) تم تسجيل الخروج

**شريحة المستخدم (تم تسجيل الخروج)**
- تسجيل الدخول *(inline/compact variant)*
- تسجيل الدخول للمزامنة *(full variant)*
- (aria, mobile icon button) تسجيل الدخول إلى Stremio

**شريحة المستخدم (تم تسجيل الدخول)**
- (aria) قائمة الحساب
- {fullname|email} (dynamic; fallback `مستخدم Stremio`)
- حساب Stremio *(subtitle)*
- {initial} (dynamic — avatar fallback letter; fallback letter `S` when name/email empty)
- (aria, menu) إجراءات الحساب
- مزامنة الآن *(menu item)*
- تسجيل الخروج *(menu item)*
- (toast, description) {n} إضافات · {n} عناصر (dynamic)

---

## `src/components/harbor/chrome/add-to-list.tsx`

**زر التشغيل**
- إضافة إلى القائمة *(when in 0 lists)*
- في قائمة واحدة|قوائم (dynamic — `In 1 list` / `In N lists`)

**قائمة النافذة المنبثقة**
- (aria, menu) القوائم
- قوائمك *(header)*
- لا توجد قوائم بعد — أنشئ أول قائمة لك أدناه. *(empty state)*
- {list name} (dynamic)
- {n} عناوين (dynamic per list row)
- (toast) تم إنشاء «{list name}» (dynamic)
- (toast, description) تمت إضافة {item name}. (dynamic)
- (toast) تمت الإضافة إلى {list name} (dynamic)
- (toast) تمت الإزالة من {list name} (dynamic)

**صف الإنشاء**
- قائمة جديدة
- (placeholder) اسم القائمة…
- إنشاء

**زر التذييل**
- (tooltip) فتح قوائم المكتبة

---

## `src/components/harbor/chrome/integrations-strip.tsx`

- (aria, section) تكاملات اختيارية لإكمال إعدادك
- إكمال إعداد Harbor *(heading — NOTE: still says “Harbor”, not “Horse”, after the rebrand)*
- {n} تكامل|تكاملات غير مفعلة بعد — تستغرق المفاتيح المجانية نحو دقيقة لإضافتها. (dynamic — `1 integration` / `N integrations`)
- TMDB — أعمال فنية أفضل، وشعارات العناوين، وطاقم العمل والتوصيات
- Ratings — تقييمات IMDb وRotten Tomatoes وMetacritic وTrakt على كل عنوان
- Trakt — مزامنة scrobbles وقائمة المشاهدة والسجل عبر ربط رمز
- Simkl — تتبع ما تشاهده عبر الأجهزة باستخدام رمز PIN
- نشط / لم يتم الإعداد *(status text per service)*
- الإعداد في الإعدادات ← التكاملات *(CTA button)*
- تعمل تقييمات الأنمي (AniList · MyAnimeList · Kitsu) بدون أي مفاتيح.
- (aria, dismiss) تجاهل اقتراحات الإعداد

---

## `src/components/harbor/chrome/link-account-flow.tsx`

**الخمول (غير مرتبط، ولا يوجد تدفق نشط)**
- ربط {service name} باستخدام رمز (dynamic — service name is `Trakt.tv` or `Simkl`)
- لا حاجة لإعداد حساب — ستحصل على رمز قصير لإدخاله في {host}. (dynamic — host is `trakt.tv/activate` or `simkl.com/pin`)

**حالة الانتظار**
- انتقل إلى {verification URL host} وأدخل هذا الرمز: (dynamic — URL rendered as link text)
- (tooltip, code button) انقر للنسخ
- تنتهي الصلاحية خلال {mm:ss} (dynamic countdown)
- (aria, timer) تنتهي صلاحية الرمز خلال
- (tooltip, QR) امسح لفتح صفحة التحقق
- (alt, QR image) رمز QR المرتبط بـ{verification URL} (dynamic)
- فتح {host} (dynamic button)
- بانتظار التفويض… / {error} (dynamic status line)
- وافق على موقع الخدمة وسيتصل تلقائيًا خلال ثوانٍ.
- رمز جديد
- إلغاء

**النجاح**
- تم ربط {Service name} (dynamic — also a toast title)
- تم الربط باسم @{username} (dynamic)
- (toast, description) يتم تخزين الرموز المميزة بأمان على خادمك.
- (toast) تمت مزامنة {Service name} (dynamic)
- (toast, description) +{n} من قائمة المشاهدة · +{n} تشغيلات تم دمجها في مكتبتك. (dynamic)

**حالات الفشل**
- انتهت صلاحية الرمز — أنشئ رمزًا جديدًا.
- تم رفض الوصول من موقع الخدمة. يمكنك البدء من جديد.
- حدث خطأ ما — حاول مرة أخرى. *(fallback; otherwise raw provider error)*
- إنشاء رمز جديد
- إلغاء

**إشعار فشل النسخ**
- (toast) فشل النسخ
- (toast, description) حدّد الرمز وانسخه يدويًا.
- (toast) فشلت المزامنة
- (toast, description) تحقق من اتصالك وحاول مرة أخرى.

**البطاقة المرتبطة**
- @{username} (dynamic; fallback `مرتبط بـ{Service name}`)
- آخر مزامنة: {date} (dynamic)
- تم الربط في {date} (dynamic)
- مزامنة الآن
- إلغاء الربط

---

## `src/components/harbor/chrome/ratings-row.tsx`

**شرائح التقييمات (صفحات التفاصيل)**
- (aria, group) التقييمات
- (tooltip) {provider label}: {display}{originalScale} · {votes} صوتًا (dynamic — e.g. `IMDb: 8.5/10 · 1.2M votes`)
- لا تتوفر تقييمات *(empty-state chip, with star icon)*
- تسميات المزودين المعروضة على الشرائح (السجل): IMDb · Rotten Tomatoes · Metacritic · TMDB · Trakt · MDBList · AniList · MyAnimeList · Kitsu

**RatingsSettingsCard (الإعدادات ← التكاملات)**
- التقييمات *(heading)*
- التقييمات المعروضة في صفحات التفاصيل. يتم إخفاء المزودين الذين لا يحتويون على مفتاح مهيأ تلقائيًا؛ كما تجلب عناوين الأنمي AniList / MAL / Kitsu.
- مفعّل *(checkbox label; aria: `إظهار التقييمات في صفحات التفاصيل`)*
- (aria, list) مزودو التقييمات (الترتيب = ترتيب العرض)
- الموضع الافتراضي *(shown for providers not yet ordered)*
- يحتاج إلى {key name} (dynamic — values: `OMDB_API_KEY`, `TMDB key`, `TRAKT_CLIENT_ID`, `MDBLIST_API_KEY`)
- (aria) تحريك {provider label} لأعلى (dynamic)
- (aria) تحريك {provider label} لأسفل (dynamic)
- مرتب / افتراضي *(toggle button states)*
- يظهر المزودون «المرتّبون» أولًا بالترتيب المحدد؛ ويتبعهم كل ما عدا ذلك بالترتيب الافتراضي. ويتم إخفاؤهم تلقائيًا عند عدم توفر بيانات أو مفتاح للمزود.

---

## `src/components/harbor/chrome/shortcuts-overlay.tsx`

**النافذة**
- (aria, dialog) اختصارات لوحة المفاتيح
- اختصارات لوحة المفاتيح *(title)*
- اعمل في أي مكان داخل Harbor. *(subtitle — NOTE: still says “Harbor” after the rebrand)*
- (aria) إغلاق مساعدة الاختصارات

**القسم: في أي مكان** *(title: `Anywhere`)*
- البحث (نتائج فورية) — Ctrl K
- البحث — /
- لوحة الأوامر (التنقل والإعدادات) — Ctrl Shift P
- مساعدة الاختصارات هذه — ?
- إغلاق النوافذ / الحوارات — Esc
- رجوع — Backspace، Alt+←

**القسم: أثناء المشاهدة** *(heading: `While watching`)*
- تشغيل / إيقاف مؤقت — Space
- تقديم للخلف / للأمام — ← →
- رفع / خفض مستوى الصوت — ↑ ↓
- كتم الصوت — M
- ملء الشاشة (النقر المزدوج يعمل أيضًا) — F
- صورة داخل صورة — U
- التنقل بين الترجمات — S C
- تبديل التدفق — W
- الحلقة التالية (المسلسل) — N
- الانتقال إلى 0–90% من الفيديو — 0 … 9
- الانتقال إلى البداية / النهاية — Home End

**تلميح التذييل**
- نصيحة: اضغط Ctrl K للحصول على نتائج بحث فورية، أو Ctrl Shift P لفتح لوحة الأوامر — معًا يبحثان في كل مكان.

---

## `src/components/harbor/chrome/theme-studio.tsx`

**النافذة**
- استوديو المظهر *(title)*
- صمّم مظهرك الخاص مع معاينة مباشرة. احفظه لإعادة استخدامه، أو صدّره وشاركه. لونك المميز هو الأساس للوحة Material 3. *(description)*

**شريط السمات المحفوظة**
- (aria, strip) السمات المحفوظة
- (aria) تحميل السمة {name} (dynamic)
- (aria) مشاركة السمة {name} (dynamic)
- (tooltip) نسخ رابط المشاركة
- (aria) حذف السمة {name} (dynamic)
- {theme name} (dynamic)

**قسم لوحة الألوان**
- لوحة الألوان *(heading)*
- لونك المميز هو الأساس للوحة Material 3 — وتُشتق منه الدرجات والحاويات والأسطح.
- تسميات وتلميحات حقول الألوان (10 صفوف):
  - Canvas — خلفية التطبيق
  - Surface — اللوحات والصفوف
  - Elevated — البطاقات والنوافذ
  - Raised — الأزرار والشرائح
  - Text — النص الأساسي
  - Text muted — النص الثانوي
  - Text subtle — التسميات والتلميحات
  - Edge — الحدود والفواصل
  - Accent — الإبرازات والإجراءات
  - Danger — الإجراءات المدمرة
- (tooltip, swatch) اختر لون {label lowercased} (dynamic — e.g. `Pick canvas color`)
- (aria, color input) منتقي لون {label} (dynamic)
- (aria, text input) قيمة لون {label} (dynamic)

**قسم الخطوط**
- الخطوط *(heading)*
- شرائح أزواج الخطوط (من سجل FONT_PAIRS): Sentient / Switzer · Fraunces / Inter · General Sans · Cabinet / Switzer · IBM Plex · Plus Jakarta · System

**قسم البنية**
- البنية *(heading)*
- التخطيط *(select label)* — الخيارات: sidebar, stremio, topdock, rail, dracula, nord, forest, royal
- البطاقات *(select label)* — الخيارات: flat, glass, stremio, crunch, noir, glossy
- الأزرار *(select label)* — الخيارات: flat, crunch, noir, glossy

**إجراءات التذييل**
- (placeholder, name input) اسم السمة *(aria: `اسم السمة`)*
- حفظ السمة
- تصدير
- مشاركة
- من رابط
- استيراد
- إعادة ضبط المعاينة
- (aria, hidden file input) استيراد ملف السمة

**نافذة لصق رابط السمة المصغرة**
- (aria, dialog) استيراد السمة من رابط
- رابط السمة *(title)*
- ألصق رابط سمة مشتركة (أو رمز hbtheme1 الخام). لا يتم إرسال أي شيء إلى أي خادم.
- (placeholder) https://…/#hbtheme1.…
- إلغاء
- تطبيق الرابط

**الإشعارات / الأخطاء**
- (toast) ألوان غير صالحة
- (toast, description) أصلح قيم الألوان المميزة قبل الحفظ.
- (toast) تم حفظ السمة
- (toast, description) أصبحت "{name}" سمتك النشطة الآن. (dynamic)
- (toast) تعذر إنشاء رابط المشاركة
- (toast) تم نسخ رابط المشاركة
- (toast) تم نسخ رابط “{name}” (dynamic)
- (toast, description) يمكن لأي شخص يفتحه معاينة السمة.
- (toast) تعذر النسخ — انسخ الرابط يدويًا
- (toast) رابط سمة غير صالح
- (toast, description) ألصق رابط سمة Harbor الذي استلمته.
- (toast) تم تطبيق رابط السمة
- (toast, description) تجري المعاينة — احفظها للاحتفاظ بها.
- (toast) تم استيراد السمة
- (toast, description) تجري معاينة السمة المستوردة — احفظها للاحتفاظ بها.
- (toast) فشل الاستيراد
- (toast, description) {error message} (dynamic; fallback `ملف غير صالح`)
- ملف السمة ليس لبرنامج Horse *(thrown error text, surfaces in the Import failed toast)*
- يحتوي ملف السمة على ألوان غير صالحة *(thrown error text)*

**أسماء احتياطية**
- سمتي *(default draft/saved name — rendered in the name input and saved-theme chips)*
- السمة المشتركة *(fallback name when an imported link carries no customName)*

---

## `src/components/harbor/chrome/tmdb-card.tsx`

**رأس البطاقة**
- بيانات TMDB الوصفية *(heading)*
- ملصقات وخلفيات وشعارات وطاقم عمل وشهادات وتصحيح بحث أفضل — مضافة فوق إضافاتك.
- (aria, switch) تفعيل بيانات TMDB الوصفية

**حالة مفتاح الخادم**
- جارٍ التحقق من مفتاح الخادم…
- مفتاح TMDB للخادم نشط (تم تعيينه عبر البيئة).
- لا يوجد مفتاح خادم — أضف مفتاحك أدناه لتفعيل TMDB.

 
**لغة البيانات الوصفية**
- لغة البيانات الوصفية
- العناوين والملخصات والصور التي يعيدها TMDB.
- (aria, select) لغة بيانات TMDB الوصفية
- تسميات الخيارات: الإنجليزية · العربية · الإسبانية · الفرنسية · الألمانية · البرتغالية (BR) · الإيطالية · التركية · الروسية · اليابانية · الكورية · الصينية المبسطة

**جودة الصور**
- جودة الصورة
- الجودة الأعلى تبدو أكثر حدة لكنها تنزّل عددًا أكبر من وحدات البايت.
- (aria, group) جودة الصورة
- منخفضة / متوسطة / عالية *(segment options — raw strings; visually capitalized via CSS)*

**استخدام مفتاحك الخاص**
- مفتاح TMDB API الخاص بك (اختياري) *(field label)*
- (placeholder) مفتاح v3 (32 حرفًا سداسيًا عشريًا) أو رمز وصول القراءة v4
- رمز وصول قراءة v4 صالح / مفتاح API v3 صالح *(validation success; rendered as `{label} — saved.`)*
- — تم الحفظ. *(suffix on success line)*
- رفض TMDB هذا المفتاح. *(validation failure fallback; otherwise server-provided error)*
- تعذر الوصول إلى TMDB للتحقق — تحقق من اتصالك.

**مربع المساعدة للمفتاح**
- احصل على مفتاح مجاني في نحو دقيقة واحدة:
- أنشئ حسابًا مجانيًا على themoviedb.org. *(link text: `themoviedb.org`)*
- افتح الإعدادات ← API وانسخ مفتاح API (v3) — أو رمز وصول API للقراءة الأطول (v4). *(link text: `Settings → API`)*
- ألصقه أعلاه. يتم التحقق منه مباشرةً، ويبقى في هذا المتصفح فقط، وتعمل ميزات TMDB فورًا.

**الإسناد**
- TMDB *(badge)*
- يستخدم هذا المنتج واجهة TMDB API، لكنه غير معتمد أو مصدّق من TMDB. *(appears in-card and again in the `TmdbAttribution` export — dedupe ×2 within file)*

---

## `src/components/harbor/chrome/tmdb-enrich.tsx`

- غير معروف *(fallback title for TMDB recommendation cards when TMDB returns no title)*
- (كل ما عدا ذلك معالجة بيانات؛ لا توجد نصوص أخرى ظاهرة للمستخدم)

---

## `src/components/harbor/common/rail.tsx`

- عرض الكل *(header chip when `onViewAll` set)*
- (aria, scroll left) تمرير {title} لليسار (dynamic)
- (aria, scroll right) تمرير {title} لليمين (dynamic)
- {title} / {subtitle} (dynamic — rendered in the rail header)
- RailSkeleton: aria-hidden، لا يوجد نص

---

## `src/components/harbor/common/poster.tsx`

- (aria, PosterCard) {name} (dynamic)
- (alt, PosterImage) {alt} (dynamic — usually the title or empty)
- — (لا يوجد نص ثابت ظاهر للمستخدم)

---

## `src/components/harbor/common/meta-card.tsx`

- {rating} *(شريحة تقييم IMDb — dynamic)*
- {addon origin name} *(شريحة الطرف العلوي — dynamic)*
- {release year} *(شريحة سفلية عند التمرير — dynamic، جزء السنة من releaseInfo)*
- {meta.name} / {meta.releaseInfo ?? meta.type} (dynamic — title + subtitle line)
- — (لا يوجد نص ثابت ظاهر للمستخدم)

---

## `src/components/harbor/player/player-overlay.tsx`

**إطار النافذة**
- (aria, dialog) جارٍ تشغيل {title} (dynamic)

**شاشة البحث عن التدفق** *(مؤشر تحميل + سطر حالة، aria-live polite)*
- جارٍ العثور على أفضل تدفق…
- جارٍ الانضمام إلى سرب التورنت… (dynamic)
- جارٍ العثور على أقران… ({n}ث) (dynamic)
- جارٍ العثور على أقران… ({n} تم العثور عليهم) (dynamic)
- جارٍ التحقق من برامج ترميز الفيديو… (dynamic)

**أخطاء مسار الحل** *(تغذي لوحة الخطأ أدناه)*
- لم يتم العثور على تدفقات من إضافاتك. (×2 — no-candidates + torrent-without-P2P paths)
- لم يتم العثور على تدفق قابل للتشغيل في المتصفح. افتح منتقي التدفقات للاختيار يدويًا — تعمل تدفقات التورنت عبر P2P أو تُفتح باستخدام debrid.
- لم يستجب أي نظير لأفضل تورنت. افتح منتقي التدفقات لاختيار مصدر آخر، أو اربط debrid للحصول على تدفقات مخزنة مؤقتًا بشكل فوري.
- تعذر على محرك التورنت تقديم هذا الملف. جرّب تدفقًا آخر في المنتقي. *(tech panel then shows code `P2P_NO_PLAN`, host `P2P swarm`)*
- سرب P2P *(rendered as the “Source host” value for torrent errors)*
- فشل حل التدفقات *(catch-all fallback)*

**الشريط العلوي**
- (aria) إغلاق المشغل (Esc)
- مغادرة التشغيل؟ *(native `window.confirm` when playerConfirmLeave is on)*
- {title} (dynamic)
- S{season}:E{episode} · {episodeName} (dynamic)
- التدفقات *(button)*
- (tooltip) تبديل التدفق (W)

**إشعارات السلم (EN / AR عبر homeT)**
- (toast) جارٍ إعادة المحاولة عبر الوكيل الآمن… / إعادة المحاولة عبر الوسيط الآمن…
- (toast) جارٍ تحويل هذا التدفق لمتصفحك… / جارٍ تحويل هذا البث لمتصفحك…
- (toast) جارٍ تجربة مصدر آخر… / جرب مصدراً آخر…

**لوحة الخطأ المصنفة**
- مشكلة في التشغيل / مشكلة في التشغيل *(title)*
- {error message} (dynamic — one of the localized messages below)
- تحويل وتشغيل / حوّل وشغّل
- إعادة المحاولة / إعادة المحاولة
- اختيار تدفق آخر / اختر بثاً آخر
- رجوع
- إظهار التفاصيل التقنية / إظهار التفاصيل التقنية *(expand toggle)*
- نوع الخطأ / نوع الخطأ: {cls} (dynamic)
- رمز الخطأ / رمز الخطأ: {code} (dynamic; fallback `n/a`)
- مضيف المصدر / مصدر البث: {host} (dynamic; fallback `n/a`)
- نسخ بيانات التشخيص / نسخ التشخيص
- (toast) تم نسخ بيانات التشخيص / تم نسخ التشخيص
- (clipboard, on copy) `class: {cls}` / `code: {code}` / `host: {host}` / `user-agent: …` / `page: …` (diagnostic block copied to clipboard)

**رسائل الخطأ النهائية (مترجمة، EN / AR عبر homeT)**
- هذه الصيغة تحتاج إلى تحويل / هذه الصيغة تحتاج إلى تحويل
- انتهت صلاحية الرابط أو أنه غير متاح / انتهت صلاحية الرابط أو أنه غير متاح
- انقطاع في الشبكة — إعادة المحاولة… / انقطاع في الشبكة — إعادة المحاولة…
- المصدر يمنع التشغيل. / المصدر يمنع التشغيل.
- لا يمكن للمتصفحات تشغيل التورنت مباشرة. يحتاج هذا البث إلى محرك P2P المدمج أو فتح عبر Debrid. / لا يمكن للمتصفحات تشغيل التورنت مباشرة. يحتاج هذا البث إلى محرك P2P المدمج أو فتح عبر Debrid.

**نافذة طلب التحويل** *(transcodeMode="ask")*
- (aria, alertdialog) هذه الصيغة تحتاج إلى تحويل / هذه الصيغة تحتاج إلى تحويل
- هذه الصيغة تحتاج إلى تحويل *(dialog title)*
- يمكن للخادم تحويل هذا التدفق إلى صيغة متوافقة مع المتصفح (H.264/AAC). يستغرق التحويل وقتًا ويستهلك CPU. / يمكن للخادم تحويل هذا البث إلى صيغة متوافقة (H.264/AAC). قد يستهلك التحويل وقتاً ومعالجة.
- تحويل وتشغيل / حوّل وشغّل
- اختيار تدفق آخر / اختر بثاً آخر

**طبقة التخزين المؤقت (كتلة P2P)**
- جارٍ التنزيل عبر P2P…
- {percent}% · {peers} أقران · {formatted speed} (dynamic stats line)
- تم إجراء transmux — يؤدي التقديم إلى إعادة تشغيل المحوّل عند الموضع المستهدف *(HUD note in remux mode)*

**شارة حالة P2P** *(مستمرة أثناء تشغيل تدفق تورنت)*
- (tooltip) تدفق تورنت P2P من جهة الخادم
- P2P {percent}% · {formatted speed} · {peers} أقران (dynamic)
- · transmux *(suffix in remux mode)*

**واجهة مستوى الصوت** *(aria-hidden، مرئية فقط)*
- {percent}% (dynamic)

**بطاقة التالي** *(مسلسل، قرب نهاية الحلقة)*
- (aria, alert) الحلقة التالية
- التالي
- خلال {n}ث (dynamic countdown; `0` renders `now`)
- الآن
- الحلقة التالية
- إلغاء
- S{season}:E{episode} · {episodeName} (dynamic)

**شريط النقل السفلي — الأزرار الأساسية**
- (aria) إيقاف مؤقت (Space) / تشغيل (Space) *(dynamic by state)*
- (aria) رجوع {n}ث (dynamic — seekBackStepSec)
- (aria) تقديم {n}ث (dynamic — seekForwardStepSec)
- (aria) كتم (M) / إلغاء الكتم (M) *(dynamic)*
- (aria, volume slider) مستوى الصوت

**قائمة الترجمات** *(تفتح بواسطة زر الترجمات)*
- (aria, button) الترجمات (S)
- الترجمات *(menu header)*
- {loaded}/{effective} محملة (dynamic counter)
- (aria, group) تصفية الترجمات حسب اللغة
- الكل *(language chip reset)*
- {lang chip} {count} (dynamic — language chips with counts)
- (placeholder) تصفية الترجمات…
- (aria, filter input) تصفية الترجمات حسب الاسم أو اللغة أو المزود
- (aria, clear filter) مسح عامل تصفية الترجمة
- إيقاف *(subtitles-off row)*
- {subtitle label} (dynamic)
- {lang chip} (dynamic — e.g. `EN`)
- {source / provider name} (dynamic row subtitle)
- AI *(badge on AI-translated tracks)*
- لا توجد ترجمات تطابق “{query}”. (dynamic)
- لم يتم العثور على ترجمات لهذا العنوان.
- تحميل المزيد ({n} إضافية) (dynamic — suffix only when more remain)
- تحميل ملف محلي (.srt / .vtt) *(file-picker label; accepts .srt/.vtt/.ass/.ssa)*
- (toast) لم يتم العثور على أسطر قابلة للقراءة في هذا الملف.
- (toast) هذه الترجمة محملة بالفعل.
- ملف محلي *(source label shown for locally loaded subtitles)*

**قائمة الإعدادات** *(إعدادات التشغيل)*
- (aria, button) إعدادات التشغيل
- السرعة *(heading, with gauge icon)*
- 0.5× · 0.75× · 1× · 1.25× · 1.5× · 2× *(speed chips — rendered from the numeric list as `{value}×`)*
- الجودة *(heading, with layers icon; shown when multiple HLS levels exist)*
- تلقائي *(adaptive chip)*
- (tooltip) معدل البت التكيفي *(Auto chip when nothing is pinned)*
- (tooltip) يُشغّل الآن {level label} (dynamic — Auto chip while auto mode plays a level)
- {height}p / {bitrate} kbps (dynamic quality level labels, e.g. `1080p`, `3200 kbps`)
- الصوت *(heading, with audio-lines icon; shown when multiple audio tracks exist)*
- {track label} (dynamic; fallbacks `Audio {n}` / `Track {n}`)
- ملاءمة الفيديو *(heading)*
- احتواء / ملء / تكبير *(video-fit chips)*

**أزرار متنوعة**
- (aria) صورة داخل صورة (U)
- (aria) ملء الشاشة (F) / الخروج من ملء الشاشة (F) *(dynamic)*

**شريط التقديم** *(slider; always LTR)*
- (aria, slider label) تقديم
- (aria, valuetext) {spoken time} من {spoken duration} (dynamic — spokenDuration format: `{h} hour(s) {m} minute(s) {s} second(s)`, e.g. `1 minute 30 seconds of 46 minutes`)
- (aria, valuetext, unknown length) المنقضي {spoken time}، المدة الإجمالية غير معروفة (dynamic)
- (tooltip) تقديم — انقر أو اسحب أو استخدم مفاتيح الأسهم
- (tooltip, unknown length) المدة الإجمالية غير معروفة لهذا التدفق — يتم عرض الوقت المنقضي؛ وقد يكون التقديم محدودًا
- {clock} (dynamic drag tooltip — `formatClock`, e.g. `12:34`; `--:--` placeholder when value unknown)

**عرض الوقت** *(تبديل المنقضي / المتبقي)*
- (tooltip) تبديل الوقت المنقضي / المتبقي
- (tooltip, unknown length) المدة الإجمالية غير معروفة — يتم عرض الوقت المنقضي
- (aria) الوقت: {spoken time} من {spoken duration}. فعّل لتبديل عرض الوقت المتبقي. (dynamic)
- (aria, unknown length) الوقت: المنقضي {spoken time}، المدة الإجمالية غير معروفة. فعّل لتبديل عرض الوقت المتبقي. (dynamic)
- ~ *(prefix marker when duration is approximate — dynamic)*
- / {clock} (dynamic total; remaining mode renders `-{clock}`)
- المدة غير معروفة / المدة غير معروفة *(shown instead of the total when duration is unknown — explicit AR ternary)*

---

*نهاية القسم 2. الملفات المعالجة: 22/22. لم يتم تعديل أي ملفات مصدر للمشروع.*
# 3 · منطق المكتبة، رسائل النظام واستجابات API

النطاق: جميع النصوص الظاهرة للمستخدم الموجودة في `src/lib/harbor/*` (مخازن العميل، ومنطق التشغيل/الترجمات، والتكاملات، ومحرك السمات، وبطاقة المشاركة)، وخدمة التورنت المصغرة، وكل `route.ts` ضمن `src/app/api/`. النصوص حرفية (مصدر EN؛ وتعرض إدخالات `src/lib/harbor/i18n.ts` ترجمة AR المشحونة أيضًا). تشير `(api: error)` إلى حقل جسم JSON تعرضه الواجهة (لوحات التكامل، ولوحة أخطاء المشغل، والإشعارات). وتُوسم `[internal]` عندما يكون النص/الرمز مستهلكًا برمجيًا بدلًا من عرضه.

## `src/lib/harbor/i18n.ts`
*خريطة النصوص المركزية ثنائية اللغة EN/AR (ليست ضمن القائمة المخصصة — أُدرجت لأنها المصدر الرئيسي لنصوص واجهة المشروع؛ وتظهر AR لسياق مراجعة الترجمة).*

- (en/ar) "متابعة المشاهدة" / "Continue Watching"
- (toast, en/ar) "جارٍ إعادة المحاولة عبر الوسيط الآمن…" / "Retrying through the secure proxy…"
- (toast, en/ar) "جارٍ تحويل هذا البث لمتصفحك…" / "Converting this stream for your browser…"
- (error, en/ar) "هذه الصيغة تحتاج إلى تحويل" / "This format needs conversion"
- (action, en/ar) "حوّل وشغّل" / "Convert and play"
- (action, en/ar) "اختر بثاً آخر" / "Pick another stream"
- (error, en/ar) "انتهت صلاحية الرابط أو أنه غير متاح" / "The link expired or is unavailable"
- (error, en/ar) "المصدر يمنع التشغيل." / "The source blocks playback."
- (toast, en/ar) "انقطاع في الشبكة — إعادة المحاولة…" / "Network hiccup — retrying…"
- (toast, en/ar) "جرب مصدراً آخر…" / "Trying another source…"
- (error, en/ar) "لا يمكن للمتصفحات تشغيل التورنت مباشرة. يحتاج هذا البث إلى محرك P2P المدمج أو فتح عبر Debrid." / "Torrents can't play natively in browsers. This one needs the built-in P2P engine or a debrid unlock."
- (toggle, en/ar) "إظهار التفاصيل التقنية" / "Show technical details"
- (action, en/ar) "نسخ التشخيص" / "Copy diagnostics"
- (toast, en/ar) "تم نسخ التشخيص" / "Diagnostics copied"
- (action, en/ar) "إعادة المحاولة" / "Retry"
- (title, en/ar) "مشكلة في التشغيل" / "Playback problem"
- (label, en/ar) "نوع الخطأ" / "Failure class"
- (label, en/ar) "رمز الخطأ" / "Error code"
- (label, en/ar) "مصدر البث" / "Source host"
- (title, en/ar) "زاوية الأطفال" / "Kids Corner"
- (subtitle, en/ar) "اختيارات ممتعة وآمنة للصغار." / "Fun and safe picks for the little ones."
- (label, en/ar) "حجم البطاقة" / "Card size"
- (option, en/ar) "كبير" / "Large"
- (option, en/ar) "متوسط" / "Medium"
- (option, en/ar) "صغير" / "Small"
- (hint, en/ar) "حجم الملصقات في زاوية الأطفال — البطاقات الأكبر أسهل للمس." / "Poster size in Kids Corner — bigger cards are easier to tap."
- (action, en/ar) "عرض التفاصيل" / "View details"
- (badge, en/ar) "مميز" / "Featured"
- (loading, en/ar) "جارٍ تحميل المميزة" / "Loading featured titles"
- (action, en/ar) "إيقاف العرض التلقائي مؤقتاً" / "Pause autoplay"
- (action, en/ar) "استئناف العرض التلقائي" / "Resume autoplay"
- (action/aria, en/ar) "متابعة" / "Resume"
- (action, en/ar) "تحديد كمشاهد" / "Mark as watched"
- (action, en/ar) "إزالة من متابعة المشاهدة" / "Remove from Continue Watching"
- (toast, en/ar) "تم التحديد كمشاهد" / "Marked as watched"
- (label, en/ar) "الحلقة" / "Episode"
- (label, en/ar) "تبقى" / "left"
- (unit, en/ar) "س" / "h"
- (unit, en/ar) "د" / "m"
- (badge, en/ar) "يُعرض اليوم" / "Airs today"
- (badge, en/ar) "يُعرض غداً" / "Airs tomorrow"
- (dynamic, en/ar) "يُعرض بعد {n} {unit}" / "In {n} {unit}"
- (badge, en/ar) "حلقة جديدة" / "New episode"
- (loading, en/ar) "جارٍ التحميل" / "Loading"
- (dynamic, en/ar) "أنمي" / "Anime" (hero meta type label)
- (dynamic, en/ar) "فيلم" / "Movie"
- (dynamic, en/ar) "مسلسل" / "Series"
- (dynamic) `S${season} E${episode}` (S/E tag, kept Latin)
- (dynamic, en/ar) `الحلقة ${n}` / `Episode ${n}` (episode subtitle fallback)
- (dynamic, en/ar) `تبقى ${h}س ${m}د` / `${h}h ${m}m left` (remaining-time label)
- (dynamic, en/ar) `يومين` / `يوم` / `أيام` / `day` / `days` (plural units inside "In {n} {unit}")
- (dynamic, en/ar) `الشريحة ${i} من ${total}` / `Slide ${i} of {total}`
- (dynamic, en/ar) `الانتقال إلى الشريحة ${n}` / `Go to slide ${n}`

## `src/lib/harbor/store.ts`
لا توجد نصوص ظاهرة للمستخدم (مخازن zustand للتنقل/الإعدادات/الإضافات؛ فقط مفاتيح localStorage ومعرّفات العرض).

## `src/lib/harbor/settings.ts`
لا توجد نصوص ظاهرة للمستخدم (المخطط والقيم الافتراضية فقط؛ ملاحظة: القيمة الافتراضية `preferredLanguages: ["English"]` هي قيمة بيانات مخزنة يمكن أن تظهر كشريحة لغة).

## `src/lib/harbor/cloud-sync.ts`
- (error) "فشلت المزامنة" — البديل لحالة خطأ cloud-sync (يظهر في حالة مزامنة الإعدادات)
- (dynamic) `GET /api/sync ${res.status}` — نص حالة الخطأ (حالة مزامنة الإعدادات)
- (dynamic) `POST /api/sync ${res.status}` — نص حالة الخطأ
- (dynamic) `Stremio · ${hash4}` — صيغة عرض معرّف الجهاز في الإعدادات (`Stremio · ` حرفي + 4 محارف سداسية عشرية)
- (dynamic) `${id.slice(0,4)}…${id.slice(-4)}` — صيغة عرض معرّف الجهاز المجهول (الفاصل الحرفي `…`)

## `src/lib/harbor/auth.ts`
*ملف lib مجاور (مخزن حساب Stremio) — أُدرج للاكتمال.*
- (error) "فشل تسجيل الدخول" — البديل لخطأ تسجيل الدخول في نافذة الحساب
- (error) "خطأ في الشبكة — حاول مرة أخرى" — نافذة الحساب
- (error) "لم يتم تسجيل الدخول" — نتيجة حارس syncAll `[internal → surfaced by caller]`
- (error) "فشلت المزامنة" — البديل لخطأ syncAll

 
## `src/lib/harbor/playback.ts`
*مصنف التدفقات — تظهر نصوص `reasons` في المنتقي/التفاصيل التقنية؛ وتظهر MEDIA_ERR_* في لوحة التفاصيل التقنية للمشغل.*
- (error/reason) "فيديو HEVC/DoVi يحتاج إلى تحويل، وهو معطل على هذا الخادم" (×2 branches)
- (reason) "سيتم تحويل فيديو HEVC/DoVi إلى H.264" (×2 branches)
- (reason) "لا يوجد مصدر قابل للتشغيل في كائن التدفق هذا"
- (reason) "وضعت الإضافة علامة على هذا التدفق بأنه غير جاهز للويب"
- (reason) "مصدر http على صفحة https — تم حظر المحتوى المختلط"
- (reason) "سيتم تحويل الصوت (AC3/DTS/TrueHD) إلى AAC"
- (dynamic) `${ext.toUpperCase()} سيتم إعادة تغليف الحاوية إلى MP4` (مثل "سيتم إعادة تغليف حاوية MKV إلى MP4"؛ و`?` عند عدم المعرفة)
- (error) "فشل التوقيع" — البديل عند عدم إرجاع /api/media/sign لحقل خطأ
- (technical) "MEDIA_ERR_ABORTED" / "MEDIA_ERR_NETWORK" / "MEDIA_ERR_DECODE" / "MEDIA_ERR_SRC_NOT_SUPPORTED" / "UNKNOWN" — بدائل رسائل الفشل المصنفة (لوحة التفاصيل التقنية)
- مفاتيح الشارات (تُحوّل إلى تسميات محلية بواسطة المنتقي، وليست نصوصًا حرفية هنا): "plays-here" | "plays-proxy" | "plays-convert" | "external" | "not-playable" `[internal]`

## `src/lib/harbor/playback-timeline.ts`
- (ui) "--:--" — عرض ساعة المدة غير المعروفة
- (dynamic) `${h}:${mm}:${ss}` / `${m}:${ss}` — مخرجات formatClock
- (aria, dynamic) `${h} hour${s}` / `${m} minute${s}` / `${s} second${s}` — spokenDuration ("12 minutes 30 seconds of 1 hour 45 minutes"؛ بالإنجليزية فقط عن قصد)

## `src/lib/harbor/p2p.ts`
*عميل تورنت P2P — إحصاءات HUD + الأخطاء المرحّلة من torrent-service.*
- (ui) "0 KB/s" — حالة formatSpeed الصفرية
- (dynamic) `${n.toFixed(1)} MB/s` / `${n} KB/s` — formatSpeed
- (ui) "—" — حالة formatEta الصفرية
- (dynamic) `${h}h ${m}m` / `${m}m ${s}s` / `${s}s` — formatEta
- (error) يرمي `String(data.error)` — نص الخطأ من torrent-service حرفيًا (انظر قسم torrent-service)

## `src/lib/harbor/subtitles.ts`
- (label) "ترجمة" — التسمية الاحتياطية النهائية في subLabel() (عنصر قائمة الترجمة)
- (error) "الترجمة المضغوطة بصيغة gzip غير مدعومة" — فشل تحميل الترجمة
- (dynamic) `جلب الترجمة ${res.status}` — فشل تحميل الترجمة
- (dynamic) رمز اللغة بأحرف كبيرة، مثل "ARA"، "ENG" — البديل في subLabel() `(s.lang ?? "").toUpperCase()`؛ كما يعيد langChip() رموزًا مكونة من 3 أحرف كبيرة (مثل "ARA") للشرائح

## `src/lib/harbor/languages.ts`
- (ui) "SUB" — شريحة بديلة عندما يتعذر اشتقاق أي لغة

## `src/lib/harbor/api.ts`
- (error) "بيان الإضافة غير صالح" — يُرمى عندما يفتقد manifest المثبت إلى id/name (إشعار في تدفق تثبيت الإضافة)
- (dynamic) `proxy ${res.status}: ${body.slice(0, 200)}` — خطأ proxyFetch (يظهر في الإشعارات/التفاصيل التقنية)
- (label) "OpenSubtitles" — `addonName` المرفق بإدخالات ترجمة المرآة (يظهر كمصدر للترجمة)
- (label) "إضافة" — اسم المصدر الاحتياطي عندما لا يحتوي manifest الخاص بالإضافة على اسم

## `src/lib/harbor/addon-probe.ts`
*نسخة التشخيص التي تظهر في نافذة فحص صحة الإضافة.*
- (dynamic) `${name} سليمة` — عنوان نجاح الفحص
- (dynamic) `استجابت بـ${count} ${noun} خلال ${s}ث` — نص نجاح الفحص (noun = "تدفقات" | "ترجمات" | "عناصر كتالوج"؛ مثل "استجابت بـ41 تدفقًا خلال 1.2ث")
- (dynamic) `${name} لم تستجب` — عنوان فشل الفحص
- (error) "انتهت مهلة نقطة موارد الإضافة أو أعادت خطأ." — البديل لنص فشل الفحص
- (error) "أعادت نقطة النهاية صفرًا من التدفقات."
- (error) "أعادت نقطة النهاية صفرًا من الترجمات."
- (error) "أعادت نقطة النهاية صفرًا من عناصر الكتالوج."
- (error) "أعادت نقطة نهاية البيانات الوصفية استجابة دون كائن بيانات وصفية."
- (error) "لا يعلن manifest عن موارد قابلة للاختبار (stream/subtitles/catalog/meta)."
- (error) "فشل الطلب" — بديل catch للفحص

## `src/lib/harbor/debrid.ts`
*مخزن عميل Debrid — الأخطاء المعروضة في صفوف المنتقي / الإعدادات ← التكاملات.*
- (error) "اربط خدمة debrid من الإعدادات ← التكاملات أولًا" — الحل بدون مفتاح
- (error) "تعذر الوصول إلى خدمة debrid" — بديل catch للتحقق
- (error) "فشل طلب فتح القفل" — بديل catch للحل
- (dynamic) `استجابت الخدمة ${res.status}` — بديل فشل التحقق
- (dynamic) `فشل فتح القفل (${res.status})` — بديل فشل الحل
- (dynamic) أي حقل `error` من /api/debrid/* يُرحّل حرفيًا (انظر مسارات API)

## `src/lib/harbor/debrid-server.ts`
*رسائل UpstreamError (تصبح حقل JSON `error` في استجابات /api/debrid/*؛ وتُضاف أسماء الخطوات ديناميكيًا).*
- (dynamic) `${step}: تم تقييد الطلب من الخادم الأعلى — أعد المحاولة بعد دقيقة`
- (dynamic) `${step}: أعاد الخادم الأعلى استجابة غير JSON`
- (dynamic) `${step}: انتهت المهلة`
- (dynamic) `${step}: الخدمة غير قابلة للوصول`
- (dynamic) `${step}: تم تجاوز إجمالي الميزانية الزمنية`
- (dynamic) قيم الخطوات التي تُركّبها المسارات: "فحص ذاكرة Real-Debrid المؤقتة"، "إضافة magnet إلى Real-Debrid"، "معلومات تورنت Real-Debrid"، "اختيار ملفات Real-Debrid"، "اختيار ملفات Real-Debrid (الكل)"، "إلغاء تقييد رابط Real-Debrid"، "رفع AllDebrid"، "حالة AllDebrid"، "فتح قفل AllDebrid"، "مستخدم Real-Debrid"، "مستخدم AllDebrid" `[internal prefixes]`

## `src/lib/harbor/trakt.ts`
*مخزن عميل Trakt — نصوص الأخطاء المعروضة في الإعدادات ← التكاملات.*
- (dynamic) `استجاب Trakt بـ${res.status}` (×5 تدفقات: device-code، device-token، استيراد قائمة المشاهدة، استيراد السجل، الدفع)
- (error) "تعذر الوصول إلى Trakt" — بديل catch للاتصال
- (error) "انتهت صلاحية رمز الجهاز — ابدأ من جديد."
- (error) "انقطع الاتصال — ابدأ من جديد."
- (error) "فشل استقصاء الرمز" — بديل catch لـpollOnce
- (error) "فشل الاستيراد" — بديل catch لاستيراد قائمة المشاهدة
- (error) "فشل استيراد السجل" — بديل catch لاستيراد السجل
- (error) "فشل الدفع" — بديل catch لـpushIds
- (dynamic) أي حقل `error` من /api/trakt/* يُرحّل حرفيًا

## `src/lib/harbor/trakt-server.ts`
- (api: error) "تم تقييد الطلب" — حارس 429
- (api: error) "حظر Trakt هذا الطلب (Cloudflare). إذا كنت تستضيف ذاتيًا، فتحقق من عنوان IP للخروج الخاص بخادمك." — upstream 403 غير JSON
- (api: error) "أعاد Trakt استجابة غير JSON" — upstream غير JSON
- (api: error) "انتهت مهلة الخادم الأعلى" — 504
- (api: error) "Trakt غير قابل للوصول" — 502
- (fallback) "عنوان غير معروف" — البديل لاسم عنصر قائمة المشاهدة (المعروض في قائمة المشاهدة)

## `src/lib/harbor/simkl.ts`
*مخزن عميل Simkl — نفس واجهة Trakt.*
- (dynamic) `استجاب Simkl بـ${res.status}` (×4 تدفقات: PIN، PIN/poll، استيراد قائمة المشاهدة، استيراد السجل)
- (error) "تعذر الوصول إلى Simkl" — بديل catch للاتصال
- (error) "انتهت صلاحية رمز PIN — ابدأ من جديد." (×2: انتهاء محلي + استقصاء منتهي نهائيًا)
- (error) "انقطع الاتصال — ابدأ من جديد."
- (error) "رفض Simkl هذا الرمز — ابدأ من جديد."
- (error) "فشل استقصاء الرمز" — بديل catch لـpollOnce
- (error) "فشل الاستيراد" — بديل catch لاستيراد قائمة المشاهدة
- (error) "فشل استيراد السجل" — بديل catch لاستيراد السجل
- (dynamic) أي حقل `error` من /api/simkl/* يُرحّل حرفيًا

## `src/lib/harbor/simkl-server.ts`
- (api: error) "تم تقييد الطلب" — حارس 429
- (api: error) "أعاد Simkl استجابة غير JSON" — upstream غير JSON
- (api: error) "رفض Simkl معرّف العميل" — بديل envelope 412
- (api: error) "authorization_pending" — علامة انتظار PIN-poll `[internal, pattern-matched by client]`
- (api: error) "انتهت صلاحية الرمز أو تم إلغاؤه" — 401
- (api: error) "انتهت مهلة الخادم الأعلى" — 504
- (api: error) "Simkl غير قابل للوصول" — 502
- (fallback) "عنوان غير معروف" — بديل اسم قائمة المشاهدة/السجل (×2)
- (fallback) "عرض غير معروف" — بديل اسم العرض في السجل

## `src/lib/harbor/anilist.ts`
- (dynamic) `AniList #${m.id}` — بديل mediaTitle (المعروض كعنوان البطاقة)
- (error) "استجابة anilist فارغة" — تُرمى (تُلتقط أعلى السلسلة؛ وقد تظهر في حالات خطأ الواجهة)
- (dynamic) `anilist ${res.status}` — تُرمى (تُلتقط أعلى السلسلة) `[internal]`
- (dynamic) رسالة `errors[0].message` من AniList GraphQL تُرحّل كخطأ `[internal]`

## `src/lib/harbor/tmdb.ts`
- (error) "TMDB معطل في الإعدادات" — TmdbUnavailableError عند إيقاف مفتاح الإعدادات `[internal, caught]`
- (dynamic) `tmdb ${res.status}` — الخطأ الافتراضي قبل قراءة خطأ الجسم `[internal, caught]`
- (fallback) "غير معروف" — البديل لعنوان عنصر رائج (المعروض)
- (dynamic) `Person ${r.id}` — البديل لاسم الشخص في البحث (المعروض في نتائج البحث)

## `src/lib/harbor/tmdb-server.ts`
- (api: error) "لم يتم تهيئة TMDB على هذا الخادم. عيّن TMDB_ACCESS_TOKEN (أو TMDB_API_KEY) في البيئة، أو أضف مفتاحك الخاص في الإعدادات ← التكاملات." — 501 غير مهيأ
- (api: error) "تم الوصول إلى حد طلبات TMDB" — 429 بعد المحاولات
- (dynamic) `استجاب TMDB بـ${res.status}` (×2)
- (api: error) "أعاد TMDB استجابة غير JSON"
- (dynamic) يتم ترحيل `status_message` من الخادم الأعلى حرفيًا عندما يجيب TMDB به
- (dynamic) "فشل طلب tmdb" / "tmdb غير قابل للوصول" / "فشل tmdb" — نصوص أخطاء بديلة داخلية `[internal]`

## `src/lib/harbor/linking.ts`
*مخزن ربط الحسابات دون إعداد — الأخطاء المعروضة في تدفق ربط التكاملات.*
- (dynamic) `استجاب الخادم بـ${res.status}` — بديل فشل link/start
- (error) "تعذر الوصول إلى الخادم" — بديل catch لـlink/start
- (error) "انقطاع في الاتصال — لا تزال المحاولة جارية…" — رسالة مؤقتة لـpoll 5xx/429
- (error) "فشل الاستقصاء" — بديل catch للاستقصاء `[internal, transient]`
- (dynamic) أي `error`/`error_description` من /api/*/link/poll يُرحّل حرفيًا

## `src/lib/harbor/link-resolve.ts`
لا توجد نصوص ظاهرة للمستخدم (حل الخزنة من جهة الخادم؛ قيم null صامتة).

## `src/lib/harbor/lists.ts`
- (error) "اسم القائمة مطلوب" — createList يرمي (يُلتقط + يُعرض بواسطة نافذة إنشاء القائمة)
- (dynamic) `${shared.name} (${n})` — لاحقة اسم القائمة المستوردة " (2)"، " (3)"… (رقم حرفي بين قوسين)

## `src/lib/harbor/cw.ts`
لا توجد نصوص ظاهرة للمستخدم (مخازن CW/قائمة المشاهدة/السجل في localStorage).

## `src/lib/harbor/tvnav.ts`
لا توجد نصوص ظاهرة للمستخدم (محرك التنقل المكاني).

## `src/lib/harbor/pwa.ts`
لا توجد نصوص ظاهرة للمستخدم (تسجيل SW + التقاط مطالبة التثبيت؛ نص التثبيت الظاهر موجود في المكونات).

## `src/lib/harbor/themes.ts`
*أسماء السمات الجاهزة وأزواج الخطوط (تظهر في الإعدادات ← المظهر / استوديو المظهر؛ أسماء علم — مرشحة لعدم الترجمة).*
- (label) "Horse" — اسم عرض سمة رمادية باردة
- (label) "Nord"
- (label) "Stremio"
- (label) "Crunchy"
- (label) "Royal"
- (label) "Dracula"
- (label) "Forest"
- (label) "Noir"
- (label) "Aurora"
- (label) "Velvet"
- (label) "MinUI"
- (label) "Sentient / Switzer" — اسم زوج الخطوط
- (label) "Fraunces / Inter"
- (label) "General Sans"
- (label) "Cabinet / Switzer"
- (label) "IBM Plex"
- (label) "Plus Jakarta"
- (label) "System"

## `src/lib/harbor/share-card.ts`
*بطاقة مشاركة Wrapped المرسومة على Canvas (بالإنجليزية فقط عن قصد).*
- (canvas) "MY HORSE WRAPPED" — عنوان البطاقة
- (dynamic) `SHARED BY ${name.toUpperCase().slice(0, 30)}` — شارة الاسم أعلى اليمين
- (canvas) "TOTAL WATCH TIME" — تسمية إحصائية رئيسية
- (canvas) "MOVIES" / "EPISODES" / "ACTIVE DAYS" — تسميات كتل الإحصاءات
- (dynamic) `${h}h ${m}m` / `${m}m` / `${s}s` — fmtDuration (قيمة وقت المشاهدة)
- (canvas) "horse — local stats · private by design" — تذييل البطاقة
- (error) "canvas.toBlob returned null (likely a tainted canvas)" / "Canvas 2D unavailable" / "share card requires a browser document" `[internal, caught → silent retry]`

## `src/lib/harbor/scoring.ts`
*تسميات تقنية مستخرجة من أسماء الإصدارات وتُعرض حرفيًا كشرائح/شارات مستويات في المنتقي (مصطلحات تقنية — لا تُترجم).*
- (badge) "4K" / "1080p" / "720p" / "480p" / "SD" — تسميات الدقة
- (badge) "DV" / "HDR10+" / "HDR10" — تسميات HDR
- (badge) "HEVC" / "AV1" / "VP9" / "AVC" — تسميات برامج الترميز
- (badge) "REMUX" / "BluRay" / "WEB-DL" / "WEBRip" / "DVDRip" / "HDTV" / "TS" / "CAM" / "SCR" — تسميات المصادر
- (badge) "Atmos" / "TrueHD" / "DTS" / "DD+" / "AC3" / "AAC" / "FLAC" / "Opus" — تسميات الصوت
- (tier) "4K HDR" / "1080p HDR" / "ROUGH" / "OTHER" — تسميات tierOf (TIER_ORDER)
- (dynamic) `${n.toFixed(2)} GB` / `${n} MB` / `${n} B` — formatSize
- (reason) "placeholder" / "executable" / "not-configured" / "stub" — أسباب trustFilter `[internal codes]`

## `src/lib/harbor/media-proxy.ts`
*نصوص أخطاء SSRF/الصلاحيات (تظهر عبر JSON `error` الخاص بـ /api/media/sign `/api/media` → التفاصيل التقنية للمشغل).*
- (error) "تم حظر المضيف" (×5 فحوص SSRF)
- (error) "فشل حل DNS" (×2)
- (error) "المضيف غير مسموح" (×2 — allow/denylist)
- (error) "عنوان URL غير صالح"
- (error) "البروتوكول غير مدعوم"
- (error) "بيانات الاعتماد في عنوان URL غير مسموح بها"
- (error) "عمليات إعادة التوجيه كثيرة جدًا"
- (dynamic) `محظور: ${message}` — غلاف مستوى المسار (أيضًا في مسارات proxy-core/media)

## `src/lib/harbor/proxy-core.ts`
- (api: error) "تم تقييد الطلب" — /api/proxy 429
- (api: error) "عنوان URL مفقود"
- (api: error) "عنوان URL غير صالح"
- (api: error) "البروتوكول غير مدعوم"
- (dynamic) `محظور: ${message}` / البديل "ssrf"
- (api: error) "انتهت مهلة الخادم الأعلى" — 504
- (api: error) "فشل جلب الخادم الأعلى" — 502

## `src/lib/harbor/transcode-core.ts`
لا توجد نصوص ظاهرة للمستخدم (فقط رموز أخطاء الفحص البرمجية التي تستهلكها المسارات/الواجهة: "ffprobe-missing"، "transcode-disabled"، "ffprobe-spawn-failed"، "probe-parse"، "probe-timeout").

## `src/lib/harbor/types.ts`, `src/lib/harbor/vault.ts`, `src/lib/harbor/server-config.ts`, `src/lib/harbor/brand-asset.ts`, `src/lib/harbor/md3/apply.ts`, `src/lib/harbor/md3/color.ts`, `src/lib/harbor/md3/window-class.ts`
لا توجد نصوص ظاهرة للمستخدم (انظر القائمة الختامية للتفاصيل).

## `mini-services/torrent-service/index.ts`
ملف هيكلي (`console.log("Hello via Bun!")`) — لا توجد نصوص ظاهرة للمستخدم. كل المنطق موجود في `index.mjs`.

## `mini-services/torrent-service/index.mjs`
*تصل حقول JSON `error` إلى العميل عبر p2p.ts (`throw new Error(String(data.error))`) → التفاصيل التقنية للمشغل / صفوف المنتقي.*
- (api: error) "Invalid infoHash (expected 40-char v1 hex)" — /prepare 400
- (api: error) "Torrent engine is paused in Settings" — /prepare,/stream,/remux 503 (×3)
- (dynamic) `تعذر الانضمام إلى السرب: ${e.message}` — /prepare 500
- (api: error) "لا يحتوي التورنت على ملفات" — /prepare 404
- (api: error) "تحويل الفيديو معطل على هذا الخادم (TRANSCODE_ENABLED)." — /remux?vtrans 503
- (api: error) "إعادة التغليف مشغولة — حاول مرة أخرى بعد لحظة" — /remux 503
- (api: error) "torrent-not-active" — /status,/codec,/stream,/remux 404 `[code, surfaced raw]`
- (api: error) "file-not-found" — /codec 404 + تقرير الفحص `[code, surfaced raw]`
- (api: error) "metadata-timeout" — انتظار البيانات الوصفية في prepare `[code, surfaced raw]`
- (api: error) "read-error" / "tmp-error" / "ffprobe-missing" / "probe-parse" — رموز تقرير فحص الترميز `[internal]`
- (api: error) "not-found" (+ `path`) — بديل 404 catch-all `[internal]`
- (dynamic) `internal` / رسالة `e.message` من الخادم الأعلى — بديل معالج 500

## مسارات API (src/app/api/...)

### `/api/route.ts` (الجذر)
- (api: message) "مرحبًا بالعالم!" — الإعداد الافتراضي للمخطط `[internal]`

### `/api/tmdb`
- (api: error) "تم تقييد الطلب"
- (api: error) "مسار غير صالح"
- (dynamic) `error` + `configured` مُرحّلان من tmdb-server.ts (انظر قسم lib) — يظهران في تدهور البحث/التفاصيل والإعدادات

### `/api/tmdb/validate`
- (api: error) "تم تقييد الطلب"
- (api: error) "جسم غير صالح" `[internal]`
- (api: error) "هذا لا يبدو كمفتاح TMDB. مفتاح API v3 يتكون من 32 حرفًا سداسيًا عشريًا؛ ويبدأ رمز وصول القراءة v4 بـ“ey”." — التحقق المباشر في الإعدادات
- (api: error) "رفض TMDB هذا المفتاح (401 غير مصرح)."
- (dynamic) `استجاب TMDB بـ${res.status}. حاول مرة أخرى بعد لحظات.`
- (api: error) "انتهت مهلة التحقق."
- (api: error) "تعذر الوصول إلى TMDB."

### `/api/stremio/login`
- (api: error) "تنسيق بيانات الاعتماد غير صالح" — 400
- (dynamic) يتم ترحيل `data.error.message` من الخادم الأعلى حرفيًا — 401 (المعروض في نافذة الحساب)
- (api: error) "فشل تسجيل الدخول" — بديل 401
- (api: error) "فشل طلب تسجيل الدخول" — 502

### `/api/stremio/library`
- (api: error) "authKey مفقود" — 400 `[internal]`
- (api: error) "فشل datastoreGet" — 401 (يظهر عبر مزامنة الحساب)
- (api: error) "التغييرات مفقودة" — 400 `[internal]`
- (api: error) "فشل datastorePut" — 401
- (api: error) "فشل طلب المكتبة" — 502

### `/api/stremio/addons`
- (api: error) "authKey مفقود" — 400 `[internal]`
- (api: error) "فشل addonCollectionGet" — 401
- (api: error) "الإضافات مفقودة" — 400 `[internal]`
- (api: error) "فشل addonCollectionSet" — 401
- (api: error) "فشل طلب مجموعة الإضافات" — 502

### `/api/sync`
- (api: error) "معرّف الجهاز غير صالح" (GET + POST)
- (api: error) "فشل قراءة المزامنة" — GET 500 (حالة خطأ cloud-sync → الإعدادات)
- (api: error) "JSON غير صالح" — POST 400 `[internal]`
- (api: error) "اللقطة كبيرة جدًا" — POST 413
- (api: error) "فشل كتابة المزامنة" — POST 500

### `/api/ai/search`
- (api: error) "الاستعلام مفقود" — 400 `[internal]`
- (api: error) "لا توجد اقتراحات" — إجابة نموذج فارغة (تعرض الواجهة حالة "لا توجد نتائج")
- (api: error) "خطأ في التحليل" — رد النموذج ليس JSON `[internal]`
- (dynamic) SDK `e.message` / البديل "خطأ في الذكاء الاصطناعي" — 500 `[internal]`
- (system prompt, not rendered to users) 'أنت محرك توصية للأفلام والمسلسلات داخل تطبيق مركز وسائط. يصف المستخدم ما يريد مشاهدته بلغة طبيعية. أجب فقط بمصفوفة JSON تحتوي على 8-15 عنوانًا حقيقيًا للأفلام أو المسلسلات (العناوين الرسمية الدقيقة، دون السنوات إلا عند الحاجة لإزالة الالتباس، ودون شروحات). مثال: ["Inception", "Breaking Bad", "Interstellar"]. اختر عناوين متنوعة وحقيقية ومعروفة وتطابق الطلب بأفضل شكل.' `[internal — LLM instruction, listed for reviewer awareness only]`

### `/api/anilist`

### `/api/anilist`
- (api: error) "JSON غير صالح" `[internal]`
- (api: error) "استعلام غير صالح" `[internal]`
- (api: error) "الاستعلام غير مسموح به" `[internal]`
- (api: error) "فشل طلب anilist" — 504 (العميل يرمي `anilist ${status}`)

### `/api/debrid/user`
- (api: error) "تم تقييد الطلب"
- (api: error) "JSON غير صالح" `[internal]`
- (api: error) "خدمة غير صالحة (realdebrid | alldebrid)"
- (api: error) "مفتاح API غير صالح (يجب أن يتكون من 10-200 حرف)"
- (api: error) "مفتاح Real-Debrid API غير صالح"
- (dynamic) `استجاب Real-Debrid بـ${status}`
- (api: error) "لم يُرجع Real-Debrid اسم مستخدم"
- (api: error) "مفتاح AllDebrid API غير صالح"
- (dynamic) `استجاب AllDebrid بـ${status}`
- (dynamic) `AllDebrid: ${message}` / البدائل "تم الرفض من AllDebrid"، "تم رفض الرفع"
- (api: error) "لم يُرجع AllDebrid اسم مستخدم"
- (dynamic) نصوص UpstreamError من debrid-server.ts (انظر قسم lib)
- (api: error) "خدمة debrid غير قابلة للوصول" — بديل 502

### `/api/debrid/resolve`
- (api: error) "تم تقييد الطلب"
- (api: error) "JSON غير صالح" `[internal]`
- (api: error) "خدمة غير صالحة (realdebrid | alldebrid)"
- (api: error) "مفتاح API غير صالح (يجب أن يتكون من 10-200 حرف)"
- (api: error) "infoHash غير صالح (يجب أن يكون 40 حرفًا سداسيًا عشريًا)"
- (api: error) "مفتاح Real-Debrid API غير صالح" (×4 call sites)
- (dynamic) `فشل فحص ذاكرة Real-Debrid المؤقتة (HTTP ${status})`
- (api: error) "غير مخزن مؤقتًا على Real-Debrid — التشغيل الفوري غير متاح" (×2)
- (dynamic) `فشل addMagnet في Real-Debrid (HTTP ${status})`
- (dynamic) `أعاد addMagnet في Real-Debrid دون معرّف تورنت`
- (dynamic) `فشل الحصول على معلومات التورنت من Real-Debrid (HTTP ${status})` (×2)
- (dynamic) `لم ينتج Real-Debrid أي روابط — قد لا يزال التورنت قيد التنزيل`
- (dynamic) `لم ينتج Real-Debrid روابط قابلة للاستخدام`
- (dynamic) `فشل unrestrict في Real-Debrid (HTTP ${status})`
- (dynamic) `لم يُرجع unrestrict في Real-Debrid عنوان URL للتنزيل`
- (dynamic) `فشل رفع AllDebrid (HTTP ${status})`
- (dynamic) `AllDebrid: ${message}` / البديل "تم رفض الرفع"
- (api: error) "مفتاح AllDebrid API غير صالح"
- (dynamic) `AllDebrid: لم يُرجع الرفع معرّف magnet`
- (dynamic) `فشلت حالة AllDebrid (HTTP ${status})`
- (api: error) "AllDebrid: لم يتم العثور على magnet"
- (api: error) "تعذر على AllDebrid معالجة هذا التورنت (متوقف أو غير مدعوم)"
- (api: error) "لا يزال AllDebrid يعالج هذا التورنت — ليس جاهزًا بعد. حاول مرة أخرى قريبًا."
- (dynamic) `فشل فتح قفل AllDebrid (HTTP ${status})`
- (dynamic) `AllDebrid: ${message}` / البديل "فشل فتح القفل"
- (dynamic) نصوص UpstreamError من debrid-server.ts (انظر قسم lib)
- (api: error) "خدمة debrid غير قابلة للوصول" — بديل 502

### `/api/integrations/status`
لا توجد نصوص ظاهرة للمستخدم (قيم منطقية فقط).

### `/api/media/sign`
- (api: error) "تم تقييد الطلب"
- (api: error) "جسم غير صالح" `[internal]`
- (api: error) "عنوان URL مفقود أو كبير جدًا"
- (api: error) "البروتوكول غير مدعوم" (+ `reason: "torrent-or-stream-protocol"`)
- (dynamic) `محظور: ${message}` (+ `reason: "blocked-host"`) — يظهر عبر مسار "فشل التوقيع" في playback.ts
- (api: field) `host` — مضيف المصدر المعروض في لوحة التفاصيل التقنية للمشغل (قيمة تشخيصية، وليست نصًا حرفيًا)

### `/api/media/probe`
- (api: error) "تم تقييد الطلب"
- (api: error) "جسم غير صالح" `[internal]`
- (api: error) "عنوان URL مفقود"
- (dynamic) `محظور: ${message}`
- (api: field) `durationVia` — تسميات التشخيص: "مباشر"، "توقيع-غير صالح"، `${via} (مخزن مؤقتًا)`، `${via} محظور`، `${via} ffprobe`، `${via} (${probeError})` `[internal diagnostics]`

### `/api/media` (وكيل البث)
- (api: error) "التوقيع غير صالح أو منتهي الصلاحية" — 403
- (api: error) "يجب طلب وضع التحويل من /api/transcode" — 400
- (api: error) "انتهت مهلة الخادم الأعلى" — 504
- (dynamic) `فشل الخادم الأعلى: ${msg}` — 502
- (dynamic) `حالة الخادم الأعلى ${status}` — ترحيل 403/404/502
- (api: error) "فشل قراءة manifest" — 502
- (api: error) "عدد كبير جدًا من التدفقات النشطة" — 503
- (api: error) "الخادم الأعلى لا يحتوي على جسم" — 502

### `/api/transcode`
- (api: error) "التحويل معطل على هذا الخادم (TRANSCODE_ENABLED)." (+ `reason: "transcode-disabled"`)
- (api: error) "التوقيع غير صالح أو منتهي الصلاحية" — 403
- (api: error) "جميع فتحات التحويل مشغولة — حاول مرة أخرى قريبًا." (+ `reason: "transcode-busy"`)
- (dynamic) `المصدر غير قابل للوصول (HTTP ${status}).` (+ `reason: "upstream-status"`)
- (dynamic) `المصدر غير قابل للوصول: ${msg}`
- (api: error) "تعذر تشغيل ffmpeg على المضيف." (+ `reason: "ffmpeg-missing"`)
- (api: error) "لم ينتج ffmpeg أي مخرجات" — 500

### `/api/proxy`
- (api: error) "الاستجابة كبيرة جدًا" — 413
- (dynamic) `JSON غير صالح من الخادم الأعلى` (+ `status`) — 502
- بالإضافة إلى جميع أخطاء الحماية في proxy-core.ts (تم تقييد الطلب / عنوان URL مفقود / عنوان URL غير صالح / بروتوكول غير مدعوم / محظور: … / انتهت مهلة الخادم الأعلى / فشل جلب الخادم الأعلى)

### `/api/proxy/raw`
- (api: error) "الاستجابة كبيرة جدًا" — 413
- (api: error) "فشل قراءة الخادم الأعلى" — 502
- بالإضافة إلى أخطاء الحماية في proxy-core.ts (كما سبق)

### `/api/ratings`
- (api: error) "تم تقييد الطلب"
- (api: error) "العنوان أو imdb مطلوب" `[internal]`
- (api: error) "معرّف imdb غير صالح" `[internal]`

### `/api/trakt/device-code`
- (api: error) "JSON غير صالح" `[internal]`
- (api: error) "أدخل معرّف عميل Trakt صالحًا (من trakt.tv/settings/applications)." — نموذج بيانات الاعتماد الخاصة في الإعدادات
- (api: error) "سر العميل غير صالح."
- بالإضافة إلى أخطاء الحماية/الترحيل في trakt-server.ts ("تم تقييد الطلب"، "حظر Trakt هذا الطلب (Cloudflare). إذا كنت تستضيف ذاتيًا، فتحقق من عنوان IP للخروج الخاص بخادمك."، "أعاد Trakt استجابة غير JSON"، "انتهت مهلة الخادم الأعلى"، "Trakt غير قابل للوصول")

### `/api/trakt/device-token`
- (api: error) "JSON غير صالح" `[internal]`
- (api: error) "بيانات اعتماد العميل غير صالحة" (×2)
- (api: error) "رمز الجهاز غير صالح"
- (api: error) "authorization_pending" / "slow_down" — علامات انتظار مُنشأة `[internal, pattern-matched]`
- (api: error) "expired_token" — مطابقة 410/404/409
- (api: error) "denied" — مطابقة 418
- (api: error) "رمز الجهاز غير صالح أو مستخدم بالفعل." — error_description لـ404/409
- بالإضافة إلى أخطاء الحماية/الترحيل في trakt-server.ts

### `/api/trakt/me`
- (api: error) "JSON غير صالح" `[internal]`
- (api: error) "بيانات اعتماد مفقودة أو غير صالحة" — 401
- بالإضافة إلى أخطاء الحماية/الترحيل في trakt-server.ts

### `/api/trakt/watchlist`
- (api: error) "JSON غير صالح" `[internal]`
- (api: error) "بيانات اعتماد مفقودة أو غير صالحة" — 401
- (api: error) "انتهت صلاحية الرمز أو تم إلغاؤه" — 401
- (fallback) "عنوان غير معروف" — اسم العنصر المطبّع (انظر trakt-server.ts)
- بالإضافة إلى أخطاء الحماية/الترحيل في trakt-server.ts

### `/api/trakt/history`
- (api: error) "JSON غير صالح" `[internal]`
- (api: error) "بيانات اعتماد مفقودة أو غير صالحة" — 401
- (api: error) "انتهت صلاحية الرمز أو تم إلغاؤه" — 401
- (fallback) "عنوان غير معروف" / "عرض غير معروف" — أسماء العناصر المطبّعة (المعروضة في استيراد السجل)
- بالإضافة إلى أخطاء الحماية/الترحيل في trakt-server.ts

### `/api/trakt/push-watchlist`
- (api: error) "JSON غير صالح" `[internal]`
- (api: error) "بيانات اعتماد مفقودة أو غير صالحة" — 401
- (api: error) "يجب أن تكون العناصر مصفوفة" `[internal]`
- (api: error) "انتهت صلاحية الرمز أو تم إلغاؤه" — 401
- (api: error) "فشل طلب Trakt" — البديل عند ≥400
- بالإضافة إلى أخطاء الحماية في trakt-server.ts ("تم تقييد الطلب")

### `/api/trakt/scrobble`
- (api: error) "تم تقييد الطلب"
- (api: error) "JSON غير صالح" `[internal]`
- (api: error) "بيانات اعتماد مفقودة أو غير صالحة"
- (api: error) "إجراء غير صالح (start | pause | stop)"
- (api: error) "تقدم غير صالح (0-100)"
- (api: error) "نوع غير صالح (movie | episode)"
- (api: error) "imdbId غير صالح (المتوقع tt<digits>)"
- (api: error) "موسم غير صالح" / "حلقة غير صالحة"
- (api: error) "انتهت صلاحية الرمز أو تم إلغاؤه" — 401
- (dynamic) `استجاب Trakt بـ${status}` — البديل عند ≥400
- بالإضافة إلى أخطاء الترحيل في trakt-server.ts

### `/api/trakt/link/start`
- (api: error) "تم تقييد الطلب"
- (api: error) "ربط Trakt غير مهيأ على هذا الخادم (TRAKT_CLIENT_ID مفقود)." (+ `configured: false`) — لوحة التكاملات
- (dynamic) `استجاب Trakt بـ${status}` — 502
- (api: error) "انتهت مهلة الخادم الأعلى" / "Trakt غير قابل للوصول" — 502
- يعيد GET القيم المنطقية `{ configured, pkceOnly }` فقط

### `/api/trakt/link/poll`
- (api: error) "تم تقييد الطلب"
- (api: error) "JSON غير صالح" `[internal]`
- (api: error) "Trakt غير مهيأ على هذا الخادم." — 501
- (قيم الحالة، بلا نص): "pending" (+`retryInMs`,`slowDown`) / "authorized" / "expired" / "denied" `[internal states]`
- (dynamic) يتم ترحيل `error` / `error_description` حرفيًا عند الفشل (مثل "رمز الجهاز غير صالح أو مستخدم بالفعل.")
- (dynamic) `استجاب Trakt بـ${status}` — بديل 502
- (api: error) "انتهت مهلة الخادم الأعلى" / "Trakt غير قابل للوصول" — 502

### `/api/trakt/link/unlink`
- (api: error) "تم تقييد الطلب"
- (api: error) "JSON غير صالح" `[internal]`
- (api: note) "تم إلغاء الربط بالفعل" — ملاحظة idempotent `[internal]`

### `/api/simkl/pin`
- (api: error) "JSON غير صالح" `[internal]`
- (api: error) "معرّف العميل غير صالح"
- بالإضافة إلى أخطاء الحماية/الترحيل في simkl-server.ts ("تم تقييد الطلب"، "أعاد Simkl استجابة غير JSON"، "رفض Simkl معرّف العميل"، "انتهت صلاحية الرمز أو تم إلغاؤه"، "انتهت مهلة الخادم الأعلى"، "Simkl غير قابل للوصول")؛ يتم ترحيل `message` من upstream 412 حرفيًا (مثل "معرّف client_id الخاص بك خاطئ. جرّب واحدًا آخر")

### `/api/simkl/pin/poll`
- (api: error) "JSON غير صالح" `[internal]`
- (api: error) "معرّف العميل غير صالح"
- (api: error) "سر العميل غير صالح"
- (api: error) "رمز الجهاز غير صالح"
- يتم ترحيل أجسام أخطاء upstream 401 حرفيًا (وضع pinPoll؛ يطابق العميل "bad_verification_code"/"expired") `[internal]`
- بالإضافة إلى أخطاء الحماية/الترحيل في simkl-server.ts

### `/api/simkl/user`
- (api: error) "JSON غير صالح" `[internal]`
- (api: error) "بيانات اعتماد مفقودة أو غير صالحة" — 401
- بالإضافة إلى أخطاء الحماية/الترحيل في simkl-server.ts

### `/api/simkl/watchlist`
- (api: error) "JSON غير صالح" `[internal]`
- (api: error) "بيانات اعتماد مفقودة أو غير صالحة" — 401
- (fallback) "عنوان غير معروف" — اسم العنصر المطبّع
- بالإضافة إلى أخطاء الحماية/الترحيل في simkl-server.ts

### `/api/simkl/history`
- (api: error) "JSON غير صالح" `[internal]`
- (api: error) "بيانات اعتماد مفقودة أو غير صالحة" — 401
- (fallback) "عنوان غير معروف" / "عرض غير معروف" — أسماء العناصر المطبّعة
- بالإضافة إلى أخطاء الحماية/الترحيل في simkl-server.ts

### `/api/simkl/scrobble`
- (api: error) "تم تقييد الطلب"
- (api: error) "JSON غير صالح" `[internal]`
- (api: error) "بيانات اعتماد مفقودة أو غير صالحة"
- (api: error) "إجراء غير صالح (start | pause | stop)"
- (api: error) "تقدم غير صالح (0-100)"
- (api: error) "نوع غير صالح (movie | episode)"
- (api: error) "imdbId غير صالح (المتوقع tt<digits>)"
- (api: error) "موسم/حلقة غير صالح"
- (api: error) "انتهت صلاحية الرمز أو تم إلغاؤه" — 401
- بالإضافة إلى أخطاء الترحيل في simkl-server.ts

### `/api/simkl/link/start`
- (api: error) "تم تقييد الطلب"
- (api: error) "ربط Simkl غير مهيأ على هذا الخادم (SIMKL_CLIENT_ID مفقود)." (+ `configured: false`) — لوحة التكاملات
- (dynamic) `استجاب Simkl بـ${status}` — 502
- (api: error) "انتهت مهلة الخادم الأعلى" / "simkl غير قابل للوصول" — 502
- يعيد GET قيمة `{ configured }` المنطقية فقط

### `/api/simkl/link/poll`
- (api: error) "تم تقييد الطلب"
- (api: error) "JSON غير صالح" `[internal]`
- (api: error) "Simkl غير مهيأ على هذا الخادم." — 501
- (قيم الحالة، بلا نص): "pending" / "authorized" / "expired" / "denied" `[internal states]`
- (dynamic) يتم ترحيل `data.message` / `data.error` حرفيًا — بديل 502 (مثل رسائل غلاف Simkl)
- (api: error) "انتهت مهلة الخادم الأعلى" / "simkl غير قابل للوصول" — 502

### `/api/simkl/link/unlink`
- (api: error) "تم تقييد الطلب"
- (api: error) "JSON غير صالح" `[internal]`
- (api: note) "تم إلغاء الربط بالفعل" `[internal]`

## الملفات التي لا تحتوي على نص ظاهر للمستخدم
`src/lib/harbor/`: store.ts, settings.ts, vault.ts, subtitle-manager.ts (console.warn فقط)، link-resolve.ts, tvnav.ts, cw.ts, pwa.ts, types.ts, transcode-core.ts (رموز برمجية فقط)، server-config.ts, brand-asset.ts (بيانات مسار SVG)، md3/apply.ts, md3/color.ts, md3/window-class.ts · `mini-services/torrent-service/`: index.ts (ملف هيكلي) · `src/app/api/`: route.ts يحتوي فقط على المخطط "Hello, world!"، بينما integrations/status/route.ts وmedia/capabilities/route.ts يعيدان قيمًا منطقية فقط.

## الملحق: ملاحظات الاستخراج
- المنهجية: تم عدّ أسطر جميع الملفات المستهدفة وعددها 82 (39 ملف lib مخصص + i18n.ts + auth.ts الإضافيان، وtorrent-service index.ts/index.mjs، و39 ملف API route.ts)، ثم تنفيذ عمليات ripgrep (`toast|message:|error:|label|title:|…`، وأنماط الأحرف الكبيرة المقتبسة، والقوالب النصية، و`throw new Error(`) وقراءة عميقة لكل ملف يحتوي على نتائج؛ وتم التحقق من الملفات الخالية من النصوص عبر القراءة الكاملة أو بحث نصي موجه بدلًا من تجاوزها.
- لم يكن `src/lib/harbor/i18n.ts` و`auth.ts` ضمن القائمة المخصصة، لكنهما من ملفات lib/harbor التي قد تفوت بين وكلاء العمل المتوازيين؛ وi18n.ts هو خريطة EN/AR المركزية للمشروع، لذلك تم اقتباس اللغتين حرفيًا أعلاه.
- سياسة الحفاظ على النص الحرفي: تم الإبقاء على القوالب النصية مع متغيراتها؛ وعلامات الترقيم والشرطات الطويلة والنقاط (`…`) والأسهم (`→` لا توجد في نص المستخدم) وعلامات الاقتباس المنحنية في رسالة التحقق من TMDB (“ey”) كما هي تمامًا. وتم وضع أعداد `×N` عند تكرار النصوص المتطابقة داخل الملف.
- قاعدة الإظهار: أُدرجت حقول JSON `error` عندما يعرضها مسار العميل (تخزن المتاجر حالة `error` المعروضة في الإعدادات/التكاملات؛ ويرميها المشغل إلى لوحة التفاصيل التقنية؛ ومصادر الإشعارات). أما العلامات الداخلية البحتة (`authorization_pending`، `slow_down`، وأسباب trustFilter، ورموز مثل "transcode-disabled") فتم الإبقاء عليها مع وسم `[internal]` لأنها تُطابق برمجيًا ولا تُعرض.
- المستبعد حسب التعليمات: مخرجات console.* (للتسجيل فقط)، ومفاتيح localStorage (`harbor-web.*`)، وأسماء الأحداث (`harbor:data-changed`)، وعناوين URL/سلاسل User-Agent، وأسماء خصائص CSS المخصصة، وأسماء الرؤوس (X-Content-Duration وغيرها)، والتعبيرات النمطية، كما تم اقتباس موجه نظام الذكاء الاصطناعي مرة واحدة فقط كـ`[internal]` لغرض اطلاع المراجع (ولا يُعرض).
- ملاحظة ثنائية اللغة: يحمل i18n.ts العربية حاليًا فقط؛ أما كل ما عدا ذلك في lib/API فهو بالإنجليزية فقط، لذا يجب أن تتعامل مراجعة الترجمة مع نصوص EN في هذا الملف وجميع الأقسام الأخرى باعتبارها مجموعة المصدر الإنجليزية. تم تمييز أسماء العلم (أسماء السمات/الخطوط، وتسميات المزودين مثل IMDb/Trakt/Simkl، والشارات التقنية مثل 4K/WEB-DL/HEVC) في مواضعها كمرشحات لعدم الترجمة.
# 4 · بيانات المشروع، التوثيق والسجل

## 4.1 نظرة عامة على المشروع (مستمدة من سجل العمل)

**Horse** (المعروف سابقًا باسم "Harbor Web") هو عميل ويب مفتوح المصدر وثنائي اللغة (EN أساسي / AR) لمركز وسائط يعتمد على **بروتوكول إضافات Stremio**، أُعيد بناؤه من تطبيق **Harbor** المكتبي المرخص بـMIT (Tauri 2 + React 19 + Rust) كتطبيق **Next.js 16 App Router** (TypeScript، Tailwind 4، shadcn/ui، Prisma/SQLite). لا يضم أي محتوى خاص به — يجلب المستخدمون إضافاتهم الخاصة بـStremio للكتالوجات والتدفقات والترجمات.

- **الواجهات**: الصفحة الرئيسية (عرض دائري رئيسي، والمتابعة، وأفضل 10، وصفوف الإضافات)، وصفوف الاستكشاف/الأفلام/المسلسلات/الأنمي، والكتالوجات مع شريط تصفية الإضافات، وشبكة التمرير اللانهائي، وصفحات التفاصيل، والمكتبة (قائمة المشاهدة/السجل)، والتقويم، والقوائم المخصصة، والتلفزيون المباشر (M3U+EPG)، ووضع الأطفال (فلاتر العمر، وPIN، وحظر أوقات الاستخدام)، ومدير الإضافات، وإحصاءات Wrapped، والإعدادات.
- **التشغيل**: HLS/MP4/fMP4/MKV عبر خط معالجة قوي — محرك تورنت P2P (`mini-services/torrent-service`، مبني على WebTorrent)، وdebrid (مفتاح Real-Debrid/AllDebrid الخاص بالمستخدم)، وسُلّم تحويل/إعادة تغليف من جهة الخادم، ووكيل وسائط موقّع، وترجمات متعددة اللغات، وخط زمني للتشغيل في الوقت الفعلي مع مصادر مدة موثوقة.
- **التكاملات**: مزامنة حساب Stremio السحابية، وTrakt (PKCE، والسجل/scrobble/قائمة المشاهدة)، وSimkl (ربط PIN)، وAniList، وإثراء TMDB، ومحولات التقييمات (Trakt/OMDb/MDBList)، والبحث بالذكاء الاصطناعي.
- **تجربة المستخدم**: سمات Material Design 3 (OKLCH، وسمات جاهزة + Theme Studio، وروابط سمات قابلة للمشاركة)، وتنقل عائم عبر رصيف سفلي زجاجي، ولوحة أوامر (Ctrl/Cmd+K)، وتنقل مكاني للتلفزيون، وبحث عائم، وPWA قابل للتثبيت + هيكل للعمل دون اتصال.

## 4.2 سجل التطوير (مختصر)

| الجولة / المهمة | ما تم إنجازه |
|---|---|
| المهمة 1 | عكس هندسة قاعدة كود Harbor المكتبي عبر 4 وكلاء استكشاف (البروتوكول · الإعدادات/الأطفال · خلفية Rust · الواجهات/المشغل) |
| المهمة 2–6 | بناء Harbor Web — منفذ Next.js 16: مخطط Prisma، ونواة lib/harbor، وواجهة API آمنة ضد SSRF، وهيكل التطبيق + الشريط الجانبي، وجميع الواجهات الرئيسية، والمشغل، والسمات |
| cron-round-2 | إصلاحات QA (إزالة تكرار الصفوف، وتفريغ السجل) + مزامنة حساب Stremio، وواجهة Wrapped، وصف أفضل 10، وبيان PWA |
| cron-round-3 | واجهة التقويم، واستوديو المظهر، والتنقل المكاني للتلفزيون |
| cron-round-4 | المزامنة السحابية المعتمدة على Prisma، وتكامل AniList، ومطالبة تثبيت PWA |
| cron-round-5 | القوائم المخصصة، ومشاركة السمات عبر URL، وتكامل Trakt، وإصلاح تخطيط الهاتف |
| المهمة 6-a | تكامل Debrid (مفتاح Real-Debrid/AllDebrid الخاص بالمستخدم) + استيراد سجل Trakt + scrobble |
| المهمة 6-b | روابط مشاركة القوائم المخصصة + تحسين التصميم على مستوى التطبيق |
| cron-round-6 | جولة QA لتجميع أعمال debrid / Trakt / مشاركة القوائم |
| cron-round-7 (ph.1) | إصلاح جميع أخطاء TypeScript الكامنة التي تمنع بناء الإنتاج |
| المهمة 7-b | تحسين منتقي التنقل التلفزيوني + إعادة تصميم الحالة الفارغة في Wrapped |
| cron-round-7 (ph.2) | تكامل Simkl، ودفع قائمة مشاهدة Trakt، وتحسين التصميم |
| المهمة 8-b | لوحة الأوامر (بأسلوب VS Code، Ctrl/Cmd+K + "/") |
| المهمة 8-a | شريط تصفية الكتالوج (إضافات Stremio) في عرض الشبكة + تحسين الكتالوجات |
| cron-round-8 | QA؛ شحن شريط التصفية + لوحة الأوامر، وإصلاح سمة accent-soft، وحالات الكتالوج الفارغة |
| cron-round-9 | بحث شامل عن المحتوى في لوحة الأوامر؛ ترقية Wrapped (خريطة 365 يومًا + الإنجازات + بطاقة المشاركة) |
| cron-round-10 | التحقق من مجموعة إضافات المستخدم (Torrentio + 4 إضافات ترجمة عربية)؛ إصلاحات مسار الترجمة |
| cron-round-11 | بحث لوحة الترجمة، وفحوص الإضافات المستمرة، وأولوية الترجمات متعددة اللغات |
| cron-round-12 | محرك تورنت P2P (`mini-services/torrent-service`) — إصلاح مشكلة "لا يمكن تشغيل أي شيء" للتورنتات غير المخزنة مؤقتًا |
| feat-round-13 | إصلاح عرض الترجمات المكررة؛ تحديد خارطة الطريق F2–F5 |
| feat-round-13b | البحث العائم + نواة TMDB |
| feat-round-14 | تكامل TMDB + الربط برمز التفعيل + محولات التقييمات |
| cron-round-15 | شريط بحث واحد موحد، وشريط تكاملات ظاهر، وإصلاح SW القديم |
| cron-round-16 | تفعيل ربط تطبيق Trakt باستخدام PKCE فقط عبر معرّف العميل الخاص بالمستخدم |
| cron-round-17 | تنظيف تجربة التمرير (إخفاء/إظهار شريط البحث) + إصلاح السبب الجذري لمشكلة Trakt "تم التفويض ولكن لم يتم اكتشافه مطلقًا" |
| m3-foundation | تدقيق الانتقال إلى Material Design 3 + الأساسات |
| m3-3a | هيكل تنقل M3 متكيف (شريط تنقل سفلي مدمج + درج) |
| m3-round-complete | خطوات M3 من 3–6: ترحيل المكونات، والتخطيط المتكيف، وإمكانية الوصول، والتحقق |
| round-19 | إصلاح تراجع موضع أسهم الرف الدائري |
| round-20 | إعادة تصميم التنقل — إزالة الشريط الجانبي، ورصيف سفلي زجاجي عائم، والوصول السريع للإعدادات |
| round-21 | إعادة بناء أعلى الصفحة الرئيسية للهاتف — عرض دائري رئيسي ممتد بالكامل + صف المتابعة (RTL أولًا) |
| round-21b | تكبير شعار الواجهة الرئيسية + تحجيم نسبي لجميع الشاشات (`--home-scale` ladder) |
| round-22 | إصلاح حجم الرصيف الزجاجي + تشغيل البحث العائم على الهواتف |
| المهمة 23 | خط معالجة تشغيل قوي (التدفقات التي تفشل في المتصفح) + إزالة عناصر التحكم الزائدة من صفحة الأطفال |
| المهمة 24 | **إعادة التسمية إلى "Horse"** — شعار حصان راكض في كل مكان، والبيانات الوصفية/الأيقونات، وذاكرة SW المؤقتة من v3→v4 |

| المهمة 25 | خط زمني حقيقي للتشغيل — الوقت المنقضي/الإجمالي/المدة الحقيقية لكل نوع تدفق، وSeekBar + TimeDisplay جديدان |
| المهمة 26 | إعادة ترتيب واجهة البطل في صفحة التفاصيل (الشعار → التقييمات → الوصف → الأزرار) + `--details-content-offset` |

## 4.3 المشكلات المفتوحة المعروفة (من سجل العمل)

العناصر والمخاطر غير المحلولة التي ظهرت في الجولات النهائية (25–26) والمرشحة المستمرة:

- **وميض مزامنة عرض التفاصيل** (موجود مسبقًا، R26): يعاد تركيب عرض التفاصيل بشكل متقطع إلى الهيكل العظمي عندما تغيّر `/api/sync` الدورية هوية مخزن الإضافات — وميض قصير في كل دورة مزامنة؛ الإصلاح = memoize لهوية الإضافات أو التحكم في إعادة الجلب.
- **فرع شعار TMDB غير متحقق منه** (R26): عند تهيئة مفتاح TMDB، يحتاج فرع صورة `tmdb.logo` في بطل التفاصيل إلى إعادة تحقق بصري (لا يحتوي sandbox على مفتاح؛ تم التحقق فقط من البديل النصي `h1`).
- **واجهة البث المباشر غير مبنية** (R25): لا تزال قوائم التشغيل الثابتة بدون ENDLIST تنتهي في لوحة الخطأ؛ ولم يتم تنفيذ واجهة بث مباشر حقيقية (شارة LIVE، الوقت المنقضي فقط، دون شريط تقديم).
- **إعادة تشغيل التقديم في P2P remux مفقودة** (R25): لم يتم تنفيذ إعادة تشغيل الجلسة باستخدام `-ss` في torrent-service (لا عملية؛ تم تحديث ملاحظة الواجهة بصدق).
- **تغطية المتصفحات** (R25): لا يمكن اختبار Firefox/Safari/iOS/Android في sandbox (Chromium headless واحد فقط)؛ تم التحقق من لوحة مفاتيح iOS البرمجية / إيماءة الرجوع في Android / هوامش النوتش بنيويًا فقط (R21b).
- **مرشحات ميزات Round-21b لا تزال مفتوحة**: إجراء سريع «قائمتي» في البطل + لقطات TMDB الثابتة لـContinue Watching.
- **القيود البيئية** (متكررة): لا يمكن اختبار مفاتيح debrid الحقيقية وبيانات اعتماد OAuth الحقيقية لـTrakt/Simkl في sandbox (تم التحقق من مسارات التحقق/الخطأ فقط)؛ قد يمنع خروج Cloudflare Trakt/RD من بعض عناوين IP للخوادم؛ ولا يمكن تشغيل حالات hover بصريًا في headless.

## 4.4 بيانات التطبيق الوصفية (layout.tsx · manifest.ts)

### من `src/app/layout.tsx` (`export const metadata`)

| الحقل | القيمة |
|---|---|
| title | `Horse — عميل Stremio مصمم للمغامرة` |
| description | `Horse هو مركز وسائط وعميل مفتوح المصدر لبروتوكول إضافات Stremio. أحضر إضافاتك الخاصة: الكتالوجات والتدفقات والترجمات. منفذ ويب وفيّ لتطبيق Harbor المكتبي.` |
| keywords | `Horse` · `Stremio` · `بروتوكول الإضافات` · `مركز وسائط` · `بث` · `مفتوح المصدر` |
| authors | `{ name: "Horse" }` |
| robots | index: true, follow: true |
| icons.icon | `/favicon-64.png` (64×64 PNG) · `/icon.svg` (SVG) |
| icons.apple | `/apple-touch-icon.png` (180×180) |

Viewport: `width=device-width, initial-scale=1, viewportFit=cover, themeColor=#000000` (ملاحظة: البطل ممتد بالكامل تحت شريط الحالة في وضع PWA المثبت؛ أسود OLED).

### من `src/app/manifest.ts` (`MetadataRoute.Manifest`)

| الحقل | القيمة |
|---|---|
| name | `Horse — عميل Stremio` |
| short_name | `Horse` |
| description | `مركز وسائط وعميل مفتوح المصدر لبروتوكول إضافات Stremio. أحضر إضافاتك الخاصة: الكتالوجات والتدفقات والترجمات.` |
| start_url / display | `/` · `standalone` |
| background_color / theme_color | `#181a20` / `#181a20` |
| orientation | `any` |
| categories | `entertainment`, `video` |
| icons | `/icon.svg` (any) · `/icon-192.png` (192, any) · `/icon-512.png` (512, any) · `/icon-512.png` (512, maskable) |

## 4.5 عامل خدمة PWA وrobots (public/sw.js · robots.txt)

### `public/sw.js` — النصوص الظاهرة للمستخدم

لا يحتوي عامل الخدمة على **عناوين/أجسام إشعارات ولا صفحة غنية للعمل دون اتصال** — ومخرجه الوحيد الظاهر للمستخدم هو استجابة البديل البسيطة عند عدم الاتصال. شريط العنوان (تعليق الكود):

> Horse — عامل الخدمة
> تحسين تدريجي: هيكل تطبيق للعمل دون اتصال + تخزين الأصول الثابتة مؤقتًا.
> لا يتم تخزين استجابات API (`/api/*`) أو الوسائط من مصادر خارجية مؤقتًا.

| السياق | النص |
|---|---|
| بديل التنقل دون اتصال (جسم استجابة HTTP 503) | `غير متصل` |

ملاحظات السلوك (ليست نصوصًا ظاهرة للمستخدم): يتم التخزين المسبق لـ`/` و`/manifest.webmanifest` و`/icon.svg`؛ استراتيجية cache-first لـ`/_next/static/*` والأيقونات وmanifest؛ واستراتيجية network-first مع بديل الهيكل المخزن مؤقتًا لعمليات التنقل؛ ولا يتم تخزين استجابات API أو الوسائط من مصادر خارجية مؤقتًا. اسم ذاكرة التخزين المؤقت `harbor-web-v4` (أصول إعادة التسمية — تم حذفه عمدًا وفق التعليمات).

### `public/robots.txt` — حرفيًا

```text
User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

User-agent: Twitterbot
Allow: /

User-agent: facebookexternalhit
Allow: /

User-agent: *
Allow: /
```

### ملفات `public/` الأخرى التي تم فحصها

لا يوجد مجلد `.well-known/` ولا توجد ملفات `.txt` أخرى تحتوي على نصوص. الملفات المتبقية ثنائية/أصول أو ملفات اختبار QA فقط: `logo.svg` و`icon.svg` و`icon-192.png` و`icon-512.png` و`apple-touch-icon.png` و`favicon-64.png`، بالإضافة إلى ملفات اختبار تشغيل `test-ac3.mkv` (ثنائي) و`test-noendlist.m3u8` (ملف اختبار لقائمة تشغيل HLS، وليس نصًا ظاهرًا للمستخدم).

## 4.6 التوثيق — README الخاص بـtorrent-service (حرفيًا)

المصدر: `/home/z/my-project/mini-services/torrent-service/README.md`. تم خفض مستوى العناوين درجتين؛ أما المحتوى فبقي دون تغيير.

### torrent-service

لتثبيت الاعتمادات:

```bash
bun install
```

للتشغيل:

```bash
bun run index.ts
```

تم إنشاء هذا المشروع باستخدام `bun init` في bun v1.3.14. [Bun](https://bun.com) هو بيئة تشغيل JavaScript سريعة ومتكاملة.

## 4.7 التوثيق — README الخاص بلقطات QA (حرفيًا)

المصدر: `/home/z/my-project/download/README.md`. يحتوي الملف على سطر واحد فقط دون عناوين:

> جميع الملفات المُنشأة هنا.

## 4.8 مخطط قاعدة البيانات (prisma/schema.prisma)

مصدر SQLite في `db/harbor.db`؛ والمولّد `prisma-client-js`. النماذج (8) مع تعليقات المخطط وملخصات الحقول في سطر واحد:

| النموذج | تعليق المخطط | الحقول (في سطر واحد) |
|---|---|---|
| `Profile` | "دعم الملفات الشخصية المتعددة (يحاكي نظام ملفات Harbor الشخصية)" | id, name, color (default `#7dd3fc`), avatar?, isKid, kidAge?, pinHash? *(SHA-256 لرقم PIN الأبوي)*, curfewMin? *(ميزانية الدقائق اليومية للأطفال)*, isPrimary, createdAt |
| `Addon` | "إضافات Stremio المثبتة لكل ملف شخصي" | id (manifest id), transportUrl, name, version?, logo?, description?, background?, contactEmail?, types/catalogs/resources/idPrefixes/behaviorHints/flags (JSON strings), enabled, installedAt, profileId, order, probe fields (probeOk/probeResource/probeCount/probeMs/probeError/probedAt — "يحاكي AddonRecord.probe من جهة العميل"), updatedAt; unique(profileId, transportUrl) |
| `LibraryItem` | "عناصر المكتبة: إشارات قائمة المشاهدة + المتابعة + سجل المشاهدة" | id (composite profileId+itemId), profileId, itemId *(مثل tt1234567 أو kitsu:123)*, type *(movie \| series \| other)*, name, poster?, background?, logo?, releaseInfo?, imdbRating?, state? *(كائن تقدم المشاهدة بصيغة JSON)*, removed, temp, favorite, watched, lastWatched?, timestamps |
| `WatchEvent` | "سجل مشاهدة على مستوى الحلقة" | id, profileId, itemId, videoId? *(tt:s:e للحلقات)*, season?, episode?, position/duration (seconds), completed, createdAt |
| `CustomList` | "قوائم المستخدم المخصصة (\"قوائمي\")" | id, profileId, name, items (JSON array, default `[]`), timestamps |
| `LinkedAccount` | "روابط حساب OAuth (Trakt / Simkl) — الرموز المميزة مشفرة أثناء التخزين (AES-256-GCM، انظر src/lib/harbor/vault.ts). لا يستقبل المتصفح إلا `id` (غير مكشوف)." | id, provider *(trakt \| simkl)*, accessTokenEnc, refreshTokenEnc?, expiresAt?, username?, avatar?, timestamps; unique(provider) |
| `AppSettings` | "إعدادات التطبيق لكل ملف شخصي (كائن JSON، يحاكي إعدادات Harbor)" | profileId (PK), data (JSON settings blob), updatedAt |
| `ServerConfig` | "إعدادات الخادم العامة بنظام المفتاح/القيمة (تبقى بعد إعادة ضبط .env في عمليات النشر المعزولة). تُستخدم مثلًا كبديل لـTRAKT_CLIENT_ID: يتغلب متغير البيئة، ويكون صف DB نسخة احتياطية." | key (PK), value, updatedAt |

تعليق المخطط الختامي (دون نموذج): "كتالوجات/بيانات وصفية مخزنة مؤقتًا لتحسين الأداء (تم تجاوزها في v1؛ يُستخدم LRU داخل الذاكرة بدلًا منها)".

## 4.9 الملحق: جرد الملفات

قائمة متكررة لملفات المصدر/النصوص (`.ts .tsx .css .js .mjs .prisma .md .txt .svg`)، مع استبعاد `node_modules` و`.next` و`.git` و`db` و`download` و`upload` و`tool-results` وصور QA. **الإجمالي: 191 ملفًا.**

### الأعداد حسب المجلد

- `src/components/` — 92 ملفًا (chrome 18 · harbor/common 3 · harbor/player 1 · harbor/views 22 · ui 48)
- `src/lib/` — 44 ملفًا (نواة harbor 39 · harbor/md3 3 · db.ts, utils.ts)
- `src/app/` — 43 ملفًا (الجذر 4 · مسارات api عددها 39)
- `mini-services/torrent-service/` — 3 ملفات
- `src/hooks/` — ملفان
- `scripts/` — ملفان
- `prisma/` — ملف واحد
- `public/` — 4 ملفات

### المسارات الكاملة

**src/app (43)**
```
```
src/app/globals.css
src/app/layout.tsx
src/app/manifest.ts
src/app/page.tsx
src/app/api/ai/search/route.ts
src/app/api/anilist/route.ts
src/app/api/debrid/resolve/route.ts
src/app/api/debrid/user/route.ts
src/app/api/integrations/status/route.ts
src/app/api/media/capabilities/route.ts
src/app/api/media/probe/route.ts
src/app/api/media/route.ts
src/app/api/media/sign/route.ts
src/app/api/proxy/raw/route.ts
src/app/api/proxy/route.ts
src/app/api/ratings/route.ts
src/app/api/route.ts
src/app/api/simkl/history/route.ts
src/app/api/simkl/link/poll/route.ts
src/app/api/simkl/link/start/route.ts
src/app/api/simkl/link/unlink/route.ts
src/app/api/simkl/pin/poll/route.ts
src/app/api/simkl/pin/route.ts
src/app/api/simkl/scrobble/route.ts
src/app/api/simkl/user/route.ts
src/app/api/simkl/watchlist/route.ts
src/app/api/stremio/addons/route.ts
src/app/api/stremio/library/route.ts
src/app/api/stremio/login/route.ts
src/app/api/sync/route.ts
src/app/api/tmdb/route.ts
src/app/api/tmdb/validate/route.ts
src/app/api/trakt/device-code/route.ts
src/app/api/trakt/device-token/route.ts
src/app/api/trakt/history/route.ts
src/app/api/trakt/link/poll/route.ts
src/app/api/trakt/link/start/route.ts
src/app/api/trakt/link/unlink/route.ts
src/app/api/trakt/me/route.ts
src/app/api/trakt/push-watchlist/route.ts
src/app/api/trakt/scrobble/route.ts
src/app/api/trakt/watchlist/route.ts
src/app/api/transcode/route.ts
```
```

**src/components/harbor — chrome (18) · common (3) · player (1) · views (22)**
```
src/components/harbor/chrome/account.tsx
src/components/harbor/chrome/add-to-list.tsx
src/components/harbor/chrome/app-shell.tsx
src/components/harbor/chrome/brand.tsx
src/components/harbor/chrome/command-palette.tsx
src/components/harbor/chrome/floating-search.tsx
src/components/harbor/chrome/glass-dock.tsx
src/components/harbor/chrome/integrations-strip.tsx
src/components/harbor/chrome/link-account-flow.tsx
src/components/harbor/chrome/nav-items.tsx
src/components/harbor/chrome/page-header.tsx
src/components/harbor/chrome/quick-access.tsx
src/components/harbor/chrome/ratings-row.tsx
src/components/harbor/chrome/search-overlay.tsx
src/components/harbor/chrome/shortcuts-overlay.tsx
src/components/harbor/chrome/theme-studio.tsx
src/components/harbor/chrome/tmdb-card.tsx
src/components/harbor/chrome/tmdb-enrich.tsx
src/components/harbor/common/meta-card.tsx
src/components/harbor/common/poster.tsx
src/components/harbor/common/rail.tsx
src/components/harbor/player/player-overlay.tsx
src/components/harbor/views/addon-detail.tsx
src/components/harbor/views/addons-view.tsx
src/components/harbor/views/anime-view.tsx
src/components/harbor/views/calendar-view.tsx
src/components/harbor/views/catalogs-view.tsx
src/components/harbor/views/detail-view.tsx
src/components/harbor/views/discover-view.tsx
src/components/harbor/views/grid-view.tsx
src/components/harbor/views/hero-spotlight.tsx
src/components/harbor/views/home-cw.tsx
src/components/harbor/views/home-hero.tsx
src/components/harbor/views/home-view.tsx
src/components/harbor/views/kids-view.tsx
src/components/harbor/views/library-view.tsx
src/components/harbor/views/list-detail-view.tsx
src/components/harbor/views/live-view.tsx
src/components/harbor/views/movies-view.tsx
src/components/harbor/views/picker-overlay.tsx
src/components/harbor/views/section-rails.tsx
src/components/harbor/views/settings-view.tsx
src/components/harbor/views/shows-view.tsx
src/components/harbor/views/wrapped-view.tsx
```
```

**src/components/ui (48، أساسيات shadcn/ui)**
```
src/components/ui/accordion.tsx        src/components/ui/alert-dialog.tsx    src/components/ui/alert.tsx
src/components/ui/aspect-ratio.tsx     src/components/ui/avatar.tsx          src/components/ui/badge.tsx
src/components/ui/breadcrumb.tsx       src/components/ui/button.tsx          src/components/ui/calendar.tsx
src/components/ui/card.tsx             src/components/ui/carousel.tsx        src/components/ui/chart.tsx
src/components/ui/checkbox.tsx         src/components/ui/collapsible.tsx     src/components/ui/command.tsx
src/components/ui/context-menu.tsx     src/components/ui/dialog.tsx          src/components/ui/drawer.tsx
src/components/ui/dropdown-menu.tsx    src/components/ui/form.tsx            src/components/ui/hover-card.tsx
src/components/ui/input-otp.tsx        src/components/ui/input.tsx           src/components/ui/label.tsx
src/components/ui/menubar.tsx          src/components/ui/navigation-menu.tsx src/components/ui/pagination.tsx
src/components/ui/popover.tsx          src/components/ui/progress.tsx        src/components/ui/radio-group.tsx
src/components/ui/resizable.tsx        src/components/ui/scroll-area.tsx     src/components/ui/select.tsx
src/components/ui/separator.tsx        src/components/ui/sheet.tsx           src/components/ui/sidebar.tsx
src/components/ui/skeleton.tsx         src/components/ui/slider.tsx          src/components/ui/sonner.tsx
src/components/ui/switch.tsx           src/components/ui/table.tsx           src/components/ui/tabs.tsx
src/components/ui/textarea.tsx         src/components/ui/toast.tsx           src/components/ui/toaster.tsx
src/components/ui/toggle-group.tsx     src/components/ui/toggle.tsx          src/components/ui/tooltip.tsx
```
```

**src/lib (44) · src/hooks (2)**
```
src/lib/db.ts
src/lib/utils.ts
src/lib/harbor/addon-probe.ts
src/lib/harbor/anilist.ts
src/lib/harbor/api.ts
src/lib/harbor/auth.ts
src/lib/harbor/brand-asset.ts
src/lib/harbor/cloud-sync.ts
src/lib/harbor/cw.ts
src/lib/harbor/debrid-server.ts
src/lib/harbor/debrid.ts
src/lib/harbor/i18n.ts
src/lib/harbor/languages.ts
src/lib/harbor/link-resolve.ts
src/lib/harbor/linking.ts
src/lib/harbor/lists.ts
src/lib/harbor/media-proxy.ts
src/lib/harbor/p2p.ts
src/lib/harbor/playback-timeline.ts
src/lib/harbor/playback.ts
src/lib/harbor/proxy-core.ts
src/lib/harbor/pwa.ts
src/lib/harbor/ratings/adapters.ts
src/lib/harbor/scoring.ts
src/lib/harbor/server-config.ts
src/lib/harbor/settings.ts
src/lib/harbor/share-card.ts
src/lib/harbor/simkl-server.ts
src/lib/harbor/simkl.ts
src/lib/harbor/store.ts
src/lib/harbor/subtitle-manager.ts
src/lib/harbor/subtitles.ts
src/lib/harbor/themes.ts
src/lib/harbor/tmdb-server.ts
src/lib/harbor/tmdb.ts
src/lib/harbor/trakt-server.ts
src/lib/harbor/trakt.ts
src/lib/harbor/transcode-core.ts
src/lib/harbor/tvnav.ts
src/lib/harbor/types.ts
src/lib/harbor/vault.ts
src/lib/harbor/md3/apply.ts
src/lib/harbor/md3/color.ts
src/lib/harbor/md3/window-class.ts
src/hooks/use-mobile.ts
src/hooks/use-toast.ts
```
```

**prisma · public · scripts · mini-services (10)**
```
prisma/schema.prisma
public/icon.svg
public/logo.svg
public/robots.txt
public/sw.js
scripts/build-horse-assets.mjs
scripts/inject-horse-path.mjs
mini-services/torrent-service/README.md
mini-services/torrent-service/index.mjs
mini-services/torrent-service/index.ts
```
```

**ملفات إعداد وتوثيق الجذر (للاستكمال؛ ليست ضمن نطاق البحث)**
```
Caddyfile · components.json · eslint.config.mjs · next-env.d.ts · next.config.ts
package.json · postcss.config.mjs · tailwind.config.ts · tsconfig.json
website-content.md · worklog.md
```

مُنشأ/أخرى (غير مدرجة في جرد المصدر): `bun.lock`, `dev.log`, `tsconfig.tsbuildinfo`, `qa-r26-desktop.png`, `qa-r26-rtl-mobile.png`, `.extract/`, `agent-ctx/`, `examples/`, `skills/`, `tests/` (3 نصوص shell برمجية، دون امتدادات نصية مطابقة), `db/`, `download/`, `upload/`, `tool-results/`.
