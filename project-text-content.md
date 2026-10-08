# Horse — Project Text Content (Source-File Extraction)

> **Purpose:** a complete corpus of every user-facing text string in the Horse project, extracted directly from the source files, organized by area/file with structure preserved — prepared for **content review and translation**.
> **Generated:** 2026-10-08 · **Source:** project files at `/home/z/my-project` (not the rendered app)
> **Method:** full read of every assigned source file; strings captured verbatim (wording, capitalization, punctuation, emoji). Dynamic templates kept exactly as written and marked `(dynamic)`. Nothing was translated or paraphrased.

**Companion file:** `website-content.md` in the project root contains a *different* artifact — a DOM-walk extraction of the rendered app (visual order, page by page). This document instead goes file by file through the source, which also captures strings that are hard to reach in the running UI (error states, rarely shown toasts, API messages).

---

## How to read

- `## \`path/to/file.tsx\`` — every heading is a real source file.
- **Bold sub-labels** group strings by logical feature region (Header, Filters, Empty state, …).
- Bullet prefixes: `(aria)` accessibility label · `(placeholder)` input placeholder · `(toast)` notification · `(tooltip)` · `(sr-only)` screen-reader-only · `(dynamic)` template with runtime values · `(api: error)` JSON field the UI surfaces · `[internal]` consumed programmatically, not displayed.
- Bilingual entries appear as `EN / AR` (the app ships Arabic only in `src/lib/harbor/i18n.ts` and a handful of inline ternaries; everything else is English-only today).
- `(×N)` marks a string repeated N times within the same file.

## Coverage & stats

| Section | Files read | Strings (approx.) |
|---|---|---|
| 1 · Views (pages) | 22 | ~780 |
| 2 · Global chrome, common & player | 22 | ~550 |
| 3 · Library logic, system messages & API | 82 scanned (27 lib + torrent service + 36 routes with strings) | ~450 |
| 4 · Metadata, docs, history, inventory | docs + static assets | overview + verbatim docs |
| **Total** | **~140 source files** | **~1,800+ unique strings** |

Excluded by design: code identifiers, CSS classes, import paths, `console.*` output, code comments, localStorage keys, event names, non-visible URLs, icon names.

## Findings worth attention before translation

1. **Only `src/lib/harbor/i18n.ts` is bilingual** (≈60 keys, full EN/AR). A few components carry inline `lang === "ar" ? … : …` ternaries (quick-access, page-header, floating-search, player). All remaining strings are hardcoded English — a proper i18n pass is a prerequisite for full Arabic coverage.
2. **Pre-rename leftovers:** five user-visible strings still say **"Harbor"** after the Horse rebrand — live-view empty state, addons-view intro (×2), settings Basics + Player panels, integrations-strip heading, shortcuts-overlay subtitle, theme-studio toast. (The About-panel attribution to the Harbor desktop app is deliberate/legal and stays.)
3. **String density hotspots:** `settings-view.tsx` (~230 strings), `player-overlay.tsx` (player controls, menus, P2P/error states), `picker-overlay.tsx` (stream picker), `command-palette.tsx`.
4. **API layer:** 36 of 39 routes return human-readable `error`/`message` fields the UI surfaces; internal reason codes are tagged `[internal]`.

## Table of contents

1. Views — page-level UI (`src/components/harbor/views/`)
2. Global chrome & player (`src/components/harbor/chrome/` · `common/` · `player/`)
3. Library logic, system messages & API responses (`src/lib/harbor/` · torrent service · `src/app/api/`)
4. Project metadata, documentation & history (docs · PWA · schema · development timeline · file inventory)

---
# 1 · Views — page-level UI (src/components/harbor/views/)

Scope: all user-facing strings from the 22 view components listed in the task order. Source wording preserved verbatim (EN primary; AR given only where the source/i18n map contains it). i18n helper keys (`homeT(...)` from `src/lib/harbor/i18n.ts`) are expanded inline at first use as `KEY → EN / AR` and referenced afterwards. Strings interpolated at runtime are marked (dynamic). Text inside components *imported* by these views (chrome/, common/, player/, ui/) is intentionally NOT listed here — it belongs to the other extraction agents' files.

---

## `src/components/harbor/views/home-view.tsx`

**Rail titles (anchor rows, rendered as section headings)**
- Trending Movies
- In Theaters
- Trending Series
- Popular Series
- Top Rated Series

**Top 10 row**
- (aria) Top 10 today
- Top 10 Today
- trending on Stremio

**Addon rails (Rail component props — dynamic, addon-provided)**
- (dynamic) `catalog.name` — rail title
- (dynamic) `addon.manifest.name` — rail subtitle
- (dynamic, aria) `${row.title} loading` — loading section label (×5, one per anchor row)

**Empty state (all catalogs failed)**
- Unable to load catalog. Check your connection.
- Cinemeta provides the default catalog; install addons for more.

---

## `src/components/harbor/views/home-hero.tsx`

**i18n keys used (from src/lib/harbor/i18n.ts — EN / AR):**
- `featured` → Featured / مميز
- `viewDetails` → View details / عرض التفاصيل
- `pauseAutoplay` → Pause autoplay / إيقاف العرض التلقائي مؤقتاً
- `resumeAutoplay` → Resume autoplay / استئناف العرض التلقائي
- `loadingFeatured` → Loading featured titles / جارٍ تحميل المميزة
- `slideOf(i, total)` → `Slide {i} of {total}` / `الشريحة {i} من {total}` (dynamic)
- `goToSlideLabel(n)` → `Go to slide {n}` / `الانتقال إلى الشريحة {n}` (dynamic)
- `metaTypeLabel(...)` → Anime / أنمي · Movie / فيلم · Series / مسلسل (dynamic)

**Carousel region**
- (aria) Featured *(section aria-label via homeT("featured"))*
- (dynamic, aria) `Slide {i} of {total}` *(slide group aria-label via slideOf)*
- (dynamic, alt) active slide title / empty string for inactive *(HeroArt alt)*
- (dynamic, alt) `{meta.name}` *(title logo img alt)*
- View details *(hero CTA button via homeT("viewDetails"))*

**Indicator dots + autoplay control**
- (dynamic, aria) `Go to slide {n}` *(dot buttons via goToSlideLabel)*
- (aria) Pause autoplay / استئناف… → exact: Pause autoplay *(when playing)*; Resume autoplay *(when paused)*
- (dynamic, sr-only live region) `Slide {i} of {total}` *(slideOf, announced only while autoplay paused)*

**Skeleton**
- (aria) Loading featured titles *(role="status" label via homeT("loadingFeatured"))*

---

## `src/components/harbor/views/home-cw.tsx`

**i18n keys used (EN / AR):**
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

**Section header**
- (aria) Continue Watching
- Continue Watching *(h2 via homeT("continueWatching"), ×2 including skeleton aria)*

**CW card**
- (dynamic) `S{s} E{e}` *(episode tag, rendered LTR)*
- (dynamic) `{card.name}` *(title)*
- (dynamic) episode name / `Episode {n}` / `الحلقة {n}` *(series subtitle)*
- (dynamic) `{h}h {m}m left` / `تبقى …` *(movie remaining-time subtitle)*
- (dynamic, badge) Airs today / Airs tomorrow / In {n} day(s) (+ AR variants) *(upcoming badge)*
- (tooltip) New episode *(fresh-dot title via homeT("newEpisode"))*
- (dynamic, aria) composite card label: `Resume {name}, S{n} E{n}, {subtitle}, {pct}%` *(join with ", ")*
- (dynamic, aria) `{pct}%` *(progressbar aria-label)*

**Long-press / context menu (role="menu")**
- (dynamic, aria) `{card.name}` *(menu aria-label)*
- View details *(menu item via homeT("viewDetails"))*
- Mark as watched *(menu item via homeT("markWatched"))*
- Remove from Continue Watching *(menu item via homeT("removeFromCw"))*

**Toast**
- (toast) Marked as watched *(after "Mark as watched" action; via homeT("watchedToast"))*

---

## `src/components/harbor/views/hero-spotlight.tsx`

**Spotlight hero (section)**
- (aria) Spotlight
- (dynamic, alt) `{meta.name}` *(poster alt)*
- (dynamic, chip) `{meta.releaseInfo.split("–")[0]}` *(year)*
- (dynamic, chip) `{meta.imdbRating}` *(rating with star icon)*
- (dynamic, h1) `{meta.name}`
- Play
- Details
- (dynamic, aria) `Slide {i + 1}` *(dot buttons)*

---

## `src/components/harbor/views/section-rails.tsx`

**Shared rails engine (titles passed in by Movies/Shows/Anime/Discover views)**
- (dynamic) `{spec.title}` / `{catalog.name}` *(rail headings)*
- (dynamic) `{addon.manifest.name}` *(rail subtitle, addon rails)*
- Unable to load catalog content. *(empty state, all rails empty)*

---

## `src/components/harbor/views/discover-view.tsx`

**Rail titles (SPECS)**
- Trending Movies
- Trending Series
- Top Rated Movies
- Top Rated Series
- Family Picks
- Adventures
- Mystery Series
- Romance
- History & War
- Music & Musicals

---

## `src/components/harbor/views/movies-view.tsx`

**Rail titles (SPECS)**
- Popular Movies
- Top Rated
- Action
- Comedy
- Sci-Fi & Fantasy
- Horror
- Drama
- Animation
- Documentary

---

## `src/components/harbor/views/shows-view.tsx`

**Rail titles (SPECS)**
- Trending Series
- Top Rated Series
- Drama Series
- Comedy Series
- Crime & Mystery
- Sci-Fi & Fantasy
- Reality
- Documentary

---

## `src/components/harbor/views/anime-view.tsx`

**Header**
- Anime *(h1)*
- Catalog by AniList · click any title to resolve into your Stremio catalogs *(with "AniList" styled as inline emphasis)*
- Retry *(chip button, shown when all rows failed)*

**Rail titles (ROW_META)**
- Trending Now
- Popular This Season
- All-Time Best
- Anime Movies
- Upcoming Next Season
- (dynamic, aria) `{title} loading` *(loading section labels, ×5)*

**Stremio catalogs section**
- Stremio catalogs *(h2)*
- Anime catalogs from Cinemeta and your installed addons *(subtext)*
- From Stremio Catalogs *(Cinemeta rail title)*
- (dynamic) `{catalog.name}` *(addon rail titles)*

**Hero strip (top-5 trending banners)**
- (aria) Trending anime spotlight
- (dynamic, chip) `{averageScore / 10 toFixed(1)}` *(score)*
- (dynamic) `{seasonYear}`
- (dynamic, chip, uppercase) `{m.format}` *(e.g. TV / MOVIE)*
- (dynamic, chip) `EP {n} soon` *(next airing)*
- (dynamic, h2) `{title}`
- Find streams
- AniList page *(external link)*
- (dynamic, aria) `Spotlight {i + 1}` *(dot buttons)*

**Anime card**
- (dynamic, aria) `{title} (AniList)` *(card button)*
- Resolving… *(overlay while resolving)*
- Not in Cinemeta — showing search results *(miss overlay)*
- (dynamic, chip) `{averageScore / 10 toFixed(1)}`
- AniList *(badge chip)*
- (dynamic, chip) `EP {n}` *(next airing episode)*
- (dynamic) `{title}` *(card caption)*
- (dynamic) meta line joined with " · ": `{seasonYear}` · `Movie` · `{n} eps` · `{genre}` — fallback: Anime
  - Movie
  - (dynamic) `{n} eps`

---

## `src/components/harbor/views/kids-view.tsx`

**i18n keys used (EN / AR):**
- `kidsTitle` → Kids Corner / زاوية الأطفال
- `kidsSubtitle` → Fun and safe picks for the little ones. / اختيارات ممتعة وآمنة للصغار.
- `cardSize` → Card size / حجم البطاقة
- `cardSizeHint` → Poster size in Kids Corner — bigger cards are easier to tap. / حجم الملصقات في زاوية الأطفال — البطاقات الأكبر أسهل للمس.
- `sizeLarge` → Large / كبير
- `sizeMedium` → Medium / متوسط
- `sizeSmall` → Small / صغير

**Header**
- Kids Corner *(h1 via homeT("kidsTitle"))*
- Fun and safe picks for the little ones. *(subtitle)*

**Card size control**
- (tooltip) Poster size in Kids Corner — bigger cards are easier to tap. *(cardSizeHint)*
- Card size *(label + group aria-label, ×2)*
- Large *(segment button)*
- Medium *(segment button)*
- Small *(segment button)*

**Rail titles (specs)**
- Animated Movies
- Family Movies
- Kids TV
- Family Shows
- Sing-Along
- Adventures

**Empty state**
- No kids content available right now.

---

## `src/components/harbor/views/live-view.tsx`

**Header / toolbar**
- Add playlist *(button)*

**Add IPTV playlist dialog**
- Add IPTV playlist *(dialog title)*
- Name *(field label)*
- (placeholder) My playlist
- M3U / EPG URL *(field label)*
- (placeholder) https://example.com/playlist.m3u
- Add *(submit button)*

**Playlist chips**
- (dynamic) `{pl.name}`
- (dynamic, aria) `Remove {pl.name}`

**Channel search**
- (placeholder) Filter channels…
- (aria) Filter channels

**Group filter chips**
- (dynamic) `All ({channels.length})`
- (dynamic) `{group} ({count})`
- General *(fallback group name when a channel has none)*

**Status / errors**
- Failed to load playlists. *(error banner)*
- Unknown *(fallback channel name in M3U parser — not directly rendered unless data missing)*
- Program *(fallback EPG title — not directly rendered unless data missing)*
- (dynamic) `Playlist {n}` *(default name when adding a playlist without a name)*

**Empty state (no playlists)**
- No playlists yet. Add an M3U playlist to watch live TV.
- Harbor is a neutral client — bring your own playlists. *(NOTE: brand word "Harbor" — pre-rename leftover, likely should read "Horse")*

**Channel cards**
- (dynamic) `{ch.name}`
- (dynamic) `Now: {prog.title}` *(current EPG program)*
- Live *(fallback subtitle when no EPG/group)*
- (dynamic) `{ch.group}`

**Filtered-empty state**
- No channels match your filters.

---

## `src/components/harbor/views/calendar-view.tsx`

**Intro**
- Weekly airing schedule for series you track — from your watchlist, continue watching and history.

**Week navigation**
- (aria) Previous week
- Prev *(hidden on small screens)*
- Today
- (aria) Next week
- Next *(hidden on small screens)*
- (dynamic) `{Mon} {d} – {Mon} {d}, {year}` *(week range label; month names Jan–Dec)*
- (dynamic) Loading episodes…

**Missing-metas notice**
- (dynamic) `{n} tracked series could not be loaded from Cinemeta.` *(word "series" used for both singular/plural in source)*

**Mobile day chips**
- (aria) Day of week
- (dynamic, uppercase) Mon / Tue / Wed / Thu / Fri / Sat / Sun

**Day columns**
- (dynamic, aria) `{Day} {date}` *(section label)*
- (dynamic, uppercase) Mon / Tue / Wed / Thu / Fri / Sat / Sun *(column header)*
- No episodes
- (dynamic, title) `{ep.name ?? ep.seriesName}` *(episode button tooltip)*
- (dynamic) `S{n}:E{n}`
- (tooltip) Watched *(watched checkmark)*
- Soon *(badge for unaired episodes)*

**Anime airing this week**
- (aria) Anime airing this week
- Anime airing this week *(h2)*
- AniList *(chip)*
- No airing data for this week.
- (dynamic, chip) `EP {n}`
- Soon *(chip for future airings)*
- (dynamic, aria) `{title} episode {n}` *(card button)*
- (dynamic) `{Day} {hh}:{mm}` *(air time)*

**Discovery row**
- (aria) Series with new episodes this week
- New episodes this week *(h2)*

**Empty calendar state**
- No tracked series yet *(h2)*
- Add shows to your watchlist or start watching, and their weekly episode air dates will appear here automatically.
- Browse shows *(button)*

---

## `src/components/harbor/views/library-view.tsx`

**Tabs (filter chips)**
- (dynamic) `Watchlist ({count})`
- (dynamic) `Lists ({count})`
- (dynamic) `History ({count})`
- Watchlist · Lists · History *(labels inside the chips above)*

**Watchlist tab**
- Your watchlist is empty. Add titles from any detail page. *(empty state)*
- Open *(card button)*
- (dynamic, aria) `Remove {name} from watchlist`

**Lists tab**
- New list *(button)*
- No lists yet. Curate themed collections like “Comfort watches”. *(empty state; curly quotes in source)*
- (dynamic, aria) `Open list {list.name}`
- (dynamic) `{n} title` / `{n} titles` *(collage badge)*
- No description *(italic placeholder on cards without description)*
- (dynamic) `Updated {date}` *(toLocaleDateString)*
- (dynamic, aria) `Rename list {list.name}`
- Delete? *(inline delete confirm)*
- (aria) Confirm delete
- (aria) Cancel delete
- (dynamic, aria) `Delete list {list.name}`

**History tab**
- No watch history yet. *(empty state)*
- (dynamic) `S{n}:E{n} · {toLocaleString()}` *(entry subtitle)*

**Create-list dialog**
- (aria) Create list
- Create a new list *(h2)*
- Name *(label)*
- (placeholder) e.g. Space epics
- Description (optional) *(label; "(optional)" is a styled span)*
- (placeholder) What belongs here?
- Cancel
- Create list

**List-card rename dialog**
- (aria) Edit list
- Edit list *(h2)*
- (aria) List name
- (aria) List description
- (placeholder) Description (optional)
- Cancel
- Save

**Toasts**
- (toast) Created “{list.name}” *(curly quotes in source)*
- (toast) List deleted *(×2: list card delete + list-detail delete path is in list-detail-view)*

---

## `src/components/harbor/views/list-detail-view.tsx`

**Error / loading**
- This list no longer exists. *(danger banner)*
- (sr-only) Loading list…

**Header**
- (dynamic) `Custom list · {n} title` / `Custom list · {n} titles` *(kicker line)*
- Edit *(button)*
- Share *(button)*
- (dynamic, aria) `Share list {list.name}`
- Delete list? *(inline confirm)*
- Yes *(confirm button)*
- (aria) Cancel delete
- (dynamic, aria) `Delete list {list.name}`

**Items grid**
- This list is empty. Open any title and choose “Add to list”. *(empty state; curly quotes in source)*
- Browse titles *(button)*
- (dynamic, aria) `Remove {item.name} from {list.name}`

**Share dialog (manual-copy fallback)**
- (aria) Share list link
- (dynamic) Share “{list.name}” *(h3; curly quotes in source)*
- Copy this link to share your list. It contains only titles and poster URLs — nothing is sent to any server.
- (aria) Share link
- Close
- Copy again

**Edit dialog**
- (aria) Edit list
- Edit list *(h2)*
- Name *(label)*
- (placeholder) e.g. Weekend sci-fi
- Description (optional) *(label)*
- (placeholder) What is this list about?
- Cancel
- Save

**Toasts**
- (toast) List updated
- (toast) Could not build share link
- (toast) Share link copied · (toast description) Anyone opening it can import this list.
- (toast) Copy blocked — copy the link manually
- (toast) Share link copied *(×2 — also in dialog "Copy again" success)*
- (toast) Still blocked — select the text and copy manually
- (toast) List deleted
- (toast, dynamic) `Removed from {list.name}`

---

## `src/components/harbor/views/grid-view.tsx`

**Header**
- (aria) Go back
- (dynamic) `{title}` *(h1, from nav frame)*
- (dynamic) `{type} · {catalogId with "-" → " "}` *(subtitle, capitalized)*
- (dynamic) `· {n} item` / `· {n} items`

**Filter bar**
- (aria) Filter by genre
- All *(genre reset chip)*
- (dynamic) `{genre}` *(genre chips from catalog manifest)*
- Fallback genre chips when no addon declares them — Movies: Action, Adventure, Animation, Comedy, Crime, Documentary, Drama, Family, Fantasy, History, Horror, Music, Mystery, Romance, Sci-Fi & Fantasy, Science Fiction, Thriller, War, Western
- Fallback genre chips — Series: Action, Adventure, Animation, Comedy, Crime, Documentary, Drama, Family, Fantasy, History, Horror, Mystery, Romance, Sci-Fi & Fantasy, Science Fiction, Thriller, War, Western, Kids, Reality, War & Politics
- (placeholder) Search catalog…
- (dynamic, aria) `Search {title}`
- (aria) Clear search
- Clear all *(chip; aria: Clear all filters)*
- (aria) Clear all filters

**Error / empty / end-of-catalog**
- (dynamic) `{error message}` *(error banner; fallback string below)*
- Failed to load catalog *(fallback error when thrown value is not an Error)*
- No items match the active filters. *(empty with filters)*
- This catalog returned no items. *(empty without filters)*
- Clear filters *(empty-state button)*
- (dynamic) `End of catalog · {n} item` / `End of catalog · {n} items` *(role="status")*

---

## `src/components/harbor/views/detail-view.tsx`

**Loading / errors**
- (sr-only) Loading details…
- (aria) Go back
- Title not found. It may not be in Cinemeta or your addons. *(error when meta missing)*
- Failed to load details *(fallback error when thrown value is not an Error)*
- Title not found. *(error display fallback)*
- (dynamic) `{error message}`

**Hero meta chips**
- (dynamic, chip) `{meta.releaseInfo}`
- (tooltip) Content rating *(certification chip)*
- (dynamic) `{tmdb.certification}`
- (dynamic, chip) `{meta.imdbRating}` *(with star icon)*
- (dynamic, chip) `{meta.runtime}`
- (dynamic, chips) `{genre}` *(up to 3)*
- (dynamic, chip) `via {meta.addonOrigin.name}`

**Action buttons**
- (dynamic) `Resume S{n}:E{n}` *(series resume button)*
- Play
- Streams *(button; tooltip below)*
- (tooltip) Choose a specific stream
- (aria-pressed toggle) In watchlist / Watchlist
- In watchlist
- Watchlist

**Cast & crew**
- Director *(label)*
- (dynamic) `{director names joined ", "}`
- Starring *(label)*
- (dynamic) `{cast names joined ", "}`

**Movie hint (no genres)**
- Press Play to fetch streams from your installed addons for this title.

**Episodes**
- No episode information available for this series.
- Episodes *(h2)*
- Newest first *(sort toggle)*
- Oldest first *(sort toggle)*
- (aria) Select season
- (dynamic) `Season {n}` *(chips)*
- (dynamic) `E{n}` *(episode number prefix)*
- (dynamic) `Episode {n}` *(fallback episode title)*
- (dynamic) `{toLocaleDateString()}` *(episode release date)*

**TMDB recommendations rail**
- (aria) Recommended by TMDB
- Recommended for you *(h2)*
- via TMDB *(chip)*

**More like this rail**
- (aria) More like this
- More like this *(h2)*
- (dynamic, chip) `{genre}`

---

## `src/components/harbor/views/addons-view.tsx`

**Intro**
- Harbor is a neutral client for the open Stremio addon protocol. Install catalogs, streams and subtitles addons by manifest URL. Harbor hosts no content — you bring your own addons. *(NOTE: "Harbor" wording — pre-rename leftover; likely should read "Horse")*

**Health summary strip**
- (aria) Addon health summary
- (dynamic) `{n} healthy`
- (dynamic) `{n} not responding`
- (dynamic) `· {checked}/{total} checked`
- Re-test all *(button)*
- (tooltip) Re-test every checked addon

**Install bar**
- (placeholder) https://my-addon.example.com/manifest.json
- (aria) Addon manifest URL
- Install *(button)*
- Installing… *(busy state)*

**Installed section**
- (dynamic) `Installed ({n})` *(section heading)*
- No addons installed yet. *(empty)*
- No addons match your filter. *(empty with filter)*
- (dynamic) `v{version}` *(version chip; fallback `v?`)*
- (aria) Testing addon *(spinner)*
- (aria) Addon healthy *(status dot)*
- (aria) Addon not responding *(status dot)*
- (dynamic, aria) `Test {name}` *(button)*
- (tooltip) Test addon
- (dynamic, aria) `Disable {name}` / `Enable {name}` *(toggle button)*
- (tooltip) Disable / Enable
- (dynamic, aria) `Configure {name}` *(button)*
- (tooltip) Configure
- (dynamic, aria) `Uninstall {name}` *(button)*
- (tooltip) Uninstall

**Probe status line (per addon)**
- HEALTHY *(verdict chip)*
- NO REPLY *(verdict chip)*
- (dynamic) `{count} streams` / `{count} subtitles` / `{count} catalog items` / `{count} items`
- (dynamic) `· {x.x}s` *(latency)*
- (dynamic) `· checked {ago}` where ago ∈: just now · `{m}m ago` · `{h}h ago` · `{d}d ago`
- (dynamic, tooltip) `Last check {toLocaleString()}`
- (dynamic, tooltip) `Last check {toLocaleString()} — {error}` / `… — no response`

**Community addons section**
- Community addons *(h2)*
- Cinemeta — Official Stremio catalog & metadata for movies and series. *(suggestion name + description)*
- OpenSubtitles v3 — Subtitles from the OpenSubtitles community addon. *(suggestion name + description)*
- Stremio Community Addons catalog — Meta-catalog of community addons. *(suggestion name + description)*
- Install *(suggestion button)*
- Installed *(suggestion button, disabled)*

**Toasts**
- (toast, dynamic) `{addon name} installed` · (toast description) Addon is ready to use.
- (toast) Install failed · (toast description, dynamic) `{error}` / fallback: Could not load manifest
- (toast, dynamic) `{addon name} removed`
- (toast, dynamic) probe result title/body *(from describeProbe in lib/harbor/addon-probe.ts — text defined there, rendered here)*

---

## `src/components/harbor/views/addon-detail.tsx`

**Missing addon**
- Addon not found.

**Header**
- (aria) Go back
- (dynamic) `{m.name}` *(h1)*
- (dynamic) `{m.id} · v{version}` *(version line; fallback `v?`)*
- (dynamic) `{m.description}`
- (dynamic, alt) empty *(logo alt="")*

**Info cards**
- Types *(card title)*
- Resources *(card title)*
- Catalogs *(card title)*
- Contact *(card title)*
- None *(empty info card)*
- (dynamic) `{type}` / `{resource}` / `{catalog name} ({type})` / `{contactEmail}` *(list items)*

**Transport URL**
- Transport URL: *(bold label)*
- (dynamic) `{addon.transportUrl}`

---

## `src/components/harbor/views/catalogs-view.tsx`

**Intro**
- Every catalog exposed by your installed addons, in one place.

**Empty state**
- No catalogs yet.
- Install addons *(button)*

**Catalog cards**
- (dynamic) `{catalog.name}` *(card title)*
- (dynamic) `{addon.manifest.name} · {catalog.type}` *(card subtitle; type capitalized)*
- Searchable *(chip)*
- (dynamic) `{n} genres` *(chip)*
- needs search term *(warning chip)*

---

## `src/components/harbor/views/wrapped-view.tsx`

**Loading**
- (sr-only) Loading your stats…

**Header / share**
- Couldn't generate card *(role="alert"; source uses &apos;)*
- (aria) Share stats
- Share stats *(button)*
- (toast) Share card downloaded
- Everything you've watched on this device, computed locally. *(intro; source uses &apos;)*
- (dynamic) download filename: `harbor-wrapped.png` *(share card file)*

**Stat tiles**
- Total watch time
- Movies
- Episodes
- Active days
- (dynamic) `{h}h {m}m` / `{m}m` / `{s}s` *(fmtDuration values)*

**Last 14 days card**
- Last 14 days *(h2)*
- (dynamic) `Best day: {duration}`
- (aria) Watch activity chart
- (dynamic, tooltip) `{date}: {duration}`

**365-day heatmap card**
- Last 365 days *(h2)*
- (dynamic) `{n} active days`
- (aria) 365-day watch activity heatmap
- (dynamic, tooltip) `{Mon} {date} · {duration}` *(per cell; months Jan–Dec)*
- (sr-only, dynamic) `Over the last 365 days you watched {duration} across {n} active days.`
- Less *(legend)*
- More *(legend)*
- Mon / Tue / Wed / Thu / Fri / Sat / Sun *(weekday gutter; only Mon, Wed, Fri visible, aria-hidden)*

**Achievements**
- Achievements *(h2)*
- (dynamic) `{earned}/{total} earned`
- First Steps — Watch your first title — progress: `1+ titles watched` / `0/1 titles`
- Binger — 3+ episodes of one series in a day — progress: `best: {n} episodes` / `{n}/3 episodes in a day`
- Night Owl — Watch between midnight and 5am — progress: `{n} late-night sessions` / `no late-night sessions yet`
- Explorer — Discover 10 different titles — progress: `{n} titles discovered` / `{n}/10 titles`
- Devoted — Watch one title in 5+ separate sessions — progress: `top: {n} sessions` / `{n}/5 sessions of one title`
- Marathoner — 8h+ of watch time in a single day — progress: `best day: {duration}` / `best day: {duration} of 8h`

**Most watched / Top genres**
- Most watched *(h2)*
- (dynamic) `{n} sessions · {duration}` *(title subtitle when count > 1)*
- Top genres *(h2)*
- (aria) Resolving genres *(skeleton state)*
- Genres unavailable — could not reach Cinemeta for these titles.
- No genre data for your watch history yet.

**Privacy footnote**
- Stats are computed locally from your watch history. Private by design — nothing leaves this device unless you sign in to Stremio.

**Empty state**
- Watch time *(preview label)*
- Active days *(preview label)*
- Top title *(preview label)*
- Your year in stories *(h2)*
- Watch time, active days, top titles and genres — computed locally from your watch history on this device. Nothing leaves your browser unless you sign in yourself.
- Browse Movies *(button)*
- Top Shows *(button)*
- Open Live TV *(button)*

---

## `src/components/harbor/views/picker-overlay.tsx`

**Dialog shell / header**
- (aria) Stream picker
- Choose a stream *(h2)*
- (dynamic) `Series · {targetId}` / `{targetId}` *(subtitle)*
- (dynamic) `· S{n}:E{n}` *(subtitle suffix)*
- (aria) Refresh streams · (tooltip) Refresh
- (aria) Close picker

**Filter chips**
- All
- Free
- Cached
- 4K
- 1080p
- Showing all *(visibility toggle when everything is shown; tooltip below)*
- Playable here *(visibility toggle default; tooltip below)*
- (dynamic) ` ({n} hidden)` *(suffix on "Playable here")*
- (tooltip) Showing every stream
- (tooltip, dynamic) `Showing streams that can play here` / `Showing streams that can play here — {n} hidden`
- (placeholder) Filter…
- (aria) Filter streams

**No-debrid hint**
- Torrent streams play through the built-in P2P engine — no account needed. Connect debrid for instant cached links. *(with "built-in P2P engine" bolded)*
- Connect *(inline button)*

**Body states**
- (dynamic) `Querying {progress}/{total} stream addons…` *(loading)*
- (dynamic) `{error message}` *(error banner)*
- No stream addons installed. Install a stream addon to watch titles. *(error when no stream addons)*
- Failed to fetch streams *(fallback error)*
- No streams match. Try refreshing or removing filters. *(empty state)*
- (dynamic) `{tier}` *(tier heading from lib/harbor/scoring.ts: e.g. 4K HDR, 4K, 1080p HDR, 1080p, 720p, SD)*
- (dynamic) `{n} streams` *(tier count)*

**Stream rows**
- (dynamic, aria) `{titleLine} — play stream`
- Stream *(fallback first line when a stream has no title/description)*
- (dynamic) `{p.resolution}` *(chip; fallback `—`)*
- (dynamic) `{p.hdrFormat}` *(HDR chip)*
- Compatibility badges (label / tooltip):
  - Plays here — (tooltip) Direct play — this stream matches your browser
  - Via proxy — (tooltip) Plays through the secure proxy (CORS/headers handled)
  - Convert — (tooltip) Needs on-demand conversion (MKV/HEVC/AC3-DTS) — server converts to H.264/AAC
  - External — (tooltip) Opens in a new tab (external link or YouTube)
  - Can't play — (tooltip) Cannot play in this browser with the current server settings
- (dynamic, tooltip) `{cls.reasons joined " · "}` *(shown instead of default tooltip when reasons exist)*
- (dynamic) `{p.codec}` · `{formatSize(p.size)}` · `{n} seeders` · `{p.source}` *(quality-info row)*
- DEBRID *(chip)*
- P2P *(chip)*
- (dynamic) `{stream.addonName}` / fallback: addon
- (dynamic, aria-live overlay) Preparing file… / Joining swarm…
- (dynamic) `{n} peers` / looking for peers · `· {s}s`
- Play *(P2P play button)*
- Connecting… *(P2P busy state)*
- (aria) Play via P2P *(when no debrid key)* / Play via P2P torrent engine
- (tooltip) Play free via the built-in P2P engine / Play via the built-in P2P engine (slower)
- Unlock *(debrid unlock button)*
- Unlocking… *(busy state)*
- Debrid *(unlock button when no key configured)*
- (aria) Unlock with debrid
- (tooltip) Connect a debrid service for instant links / Unlock with your debrid service

**Errors / toasts on rows**
- (toast) Stream unavailable · (toast description, dynamic) `{msg}`
- Unlock failed *(fallback unlock error)*
- P2P stream failed *(fallback P2P error)*
- Could not find peers for this torrent. The swarm may be dead or this network blocks BitTorrent — a debrid service would unlock it instantly.
- (dynamic) `This file uses {CODEC} video which browsers cannot play — unlock it with debrid instead.` *(e.g. HEVC)*

**Inline debrid setup dialog**
- (aria) Connect a debrid service
- Connect debrid *(h2)*
- Instant cached streams — your key stays in this browser.
- (aria) Close
- (aria, radiogroup) Debrid service
- Real-Debrid *(radio option; also used as serviceName)*
- AllDebrid *(radio option; also used as serviceName)*
- (dynamic) `{serviceName} API key` *(field label)*
- (placeholder) Paste your Real-Debrid API key / Paste your AllDebrid API key
- That API key looks too short — copy the full key from your account page.
- Could not verify the key. *(fallback validation error)*
- (toast) Debrid connected · (toast description, dynamic) `{serviceName} verified — cached streams unlock instantly now.`
- Verifying… *(busy state)*
- Connect *(submit button)*
- Get key *(external link button)*
- (tooltip) Open your account page to find the API key
- No debrid account? Torrents still play free via the built-in P2P engine — debrid just makes cached streams instant.

---

## `src/components/harbor/views/settings-view.tsx`

*(Largest file — holds most Settings text. Strings inside imported chrome components — QuickAccess, UserChip, TmdbCard, TmdbAttribution, LinkAccountFlow, RatingsSettingsCard, ThemeStudio — are defined in their own files under src/components/harbor/chrome/ and are not duplicated here.)*

**Page header & section tabs**
- Settings *(h1)*
- (aria) Settings sections
- Basics *(tab)*
- Player *(tab)*
- Theme *(tab)*
- Language *(tab)*
- Integrations *(tab)*
- Data *(tab)*
- About *(tab)*

**— Basics panel —**
- Instant play / Open the best stream immediately when clicking Play
- Auto-play next episode / Continue to the next episode automatically
- Resume playback / Pick up where you left off
- Confirm leaving playback / Ask before closing the player
- Show card badges / IMDb rating badges on posters
- Home mode / Harbor layout with hero, or classic rows only *(NOTE: "Harbor" wording — pre-rename leftover)*
- (segment options, raw ids rendered capitalized) harbor / classic
- Show all addon rows on home / Include every addon catalog row
- Hide watched in catalogs / Filter titles you already watched
- Auto-hide navigation bar / Hide the glass dock scrolling down, reveal scrolling up
- (dynamic) Poster size / `{n}%`
- (dynamic) Poster corner radius / `{n}px`

**— Player panel —**
- Use secure proxy when needed / Routes blocked streams through this server (fixes CORS and source headers)
- (segment options) Auto / Always / Never
- Convert incompatible streams / MKV/HEVC/AC3-DTS → H.264/AAC on the server (uses CPU) *(only when server supports transcode)*
- (segment options) Auto / Ask / Never
- Show only streams that play in the browser / The stream picker hides unplayable sources by default
- Prefer H.264/AAC / Rank browser-safe codecs above HEVC when sorting streams
- (dynamic) Seek step / `Arrow keys seek ±{n}s` · value display `{n}s`
- (dynamic) Subtitles size / `{n}px`
- (dynamic) Subtitle background / `{n}% opacity behind text`
- (dynamic) Subtitle border / `{n}px outline`
- Video fill / How video fits the screen
- (segment options, raw ids rendered capitalized) fit / fill / zoom
- Player chrome / Stremio-style or Harbor-style controls *(NOTE: "Harbor" wording — pre-rename leftover)*
- (segment options, raw ids rendered as-is) auto / default / stremio
- Stream picker layout / Condensed rows or Stremio-style tiers
- (segment options, raw ids rendered as-is) stremio / condensed
- Quality info in picker / Show codec, size and source details

**— Theme panel —**
- Appearance / Light or dark Material 3 scheme of your current palette
- (segment options) Dark / Light
- Contrast / Scheme contrast level — higher for stronger legibility
- (segment options) Standard / Medium / High
- Theme Studio *(h2)*
- Build a fully custom palette, fonts and layout — with live preview. Your accent color seeds the Material 3 palette.
- (dynamic) ` Active: {customName}` *(inline suffix when a custom theme is active)*
- Open Theme Studio *(button)*
- Your saved themes *(label)*
- (dynamic, aria) `Apply theme {name}`
- (dynamic, aria) `Delete theme {name}`
- (dynamic) `{layout} · {fontPair}` *(theme card caption, capitalized)*
- Theme presets *(h2)*
- Your accent color seeds the Material 3 palette.
- (dynamic) preset display names rendered here but defined in lib/harbor/themes.ts: Horse · Nord · Stremio · Crunchy · Royal · Dracula · Forest · Noir · Aurora · Velvet · MinUI
- (dynamic) `{layout} layout` *(preset card caption, capitalized)*
- Font pairing *(h2)*
- (dynamic) font-pair names rendered here but defined in lib/harbor/themes.ts: Sentient / Switzer · Fraunces / Inter · General Sans · Cabinet / Switzer · IBM Plex · Plus Jakarta · System
- Custom background *(h2)*
- Upload image *(button)*
- Remove *(button, when a background is set)*
- Dim *(slider label)*
- (aria) Upload background image
- (toast) Image too large · (toast description) Use an image under 3 MB.

**— Language panel —**
- Preferred subtitle languages *(headline)*
- Toggle languages below, then order them — the player picks the highest-priority match first.
- Language chips: English · Spanish · French · German · Japanese · Korean · Chinese · Arabic · Hindi · Portuguese · Russian · Italian
- Priority order *(label)*
- (aria) Subtitle language priority
- (tooltip) Drag to reorder
- TOP PICK *(badge on first language)*
- (dynamic, aria) `Move {lang} up` · (tooltip) Move up
- (dynamic, aria) `Move {lang} down` · (tooltip) Move down
- (dynamic, aria) `Remove {lang}` · (tooltip) Remove
- Subtitles off by default / Don't auto-enable subtitle tracks

**— Data panel —**
- Export backup / Save settings, addons, watchlist ({n} items) to a .harbx file *(description dynamic)*
- Export *(button)*
- Restore backup / Import a .harbx backup file
- Restore *(button)*
- (aria) Import backup file
- Clear local data / Remove all Horse data from this browser
- Clear *(button)*
- (dynamic) Current settings size / `{x.x} KB in localStorage`
- (toast) Backup exported · (toast description, dynamic) `{n} keys saved.`
- (toast) Backup restored · (toast description, dynamic) `{n} keys restored. Reloading…`
- (toast) Restore failed · (toast description, dynamic) `{error}` / fallback: Invalid file
- (toast) Local data cleared · (toast description) Reloading…
- Not a Horse backup file *(thrown error shown in the Restore-failed toast)*
- (dynamic) backup filename: `harbor-web-backup-{YYYY-MM-DD}.harbx`

**Cloud sync card (inside Data)**
- Cloud sync *(h3)*
- Status badge: Off / Up to date / Syncing… / Sync error / Idle
- (enabled) Addons, settings, themes, watchlist, continue-watching and history are stored on this server (SQLite). Sign in to Stremio to restore them in any browser; without an account, sync keys to this device.
- (disabled) Sync is disabled. Your data stays in this browser only — export a backup if you want a second copy.
- (dynamic) `Anonymous device key {deviceId}` · ` · last sync {toLocaleTimeString()}` / ` · not synced yet` · ` · {error}`
- (aria) Toggle cloud sync
- (toast) Cloud sync enabled · (toast description) A first sync will start now.
- (toast) Cloud sync disabled · (toast description) Local data stays untouched.
- Sync now *(button)*
- (toast) Synced · (toast description) Your library is up to date on the server.

**— About panel —**
- (aria) Horse logo *(brand mark label)*
- Horse *(h2)*
- Install app *(button)*
- (toast) Installing Horse… · (toast description) Find it in your apps list.
- Installed as app *(badge)*
- An independent web client for the Stremio addon protocol — a web port of the Harbor desktop app by the Harbor project (github.com/harborstremio/harbor), MIT licensed.
- Horse is an independent, open-source media center for the Stremio addon protocol. It is not affiliated with Stremio. It hosts, indexes, and ships no media and bundles no content addons — users install their own addons. *(with "not affiliated with Stremio" styled as emphasis)*
- Licensed MIT. Attribution: Harbor desktop (github.com/harborstremio/harbor).
- (dynamic, via TmdbAttribution component) TMDB attribution line — component defined in chrome/tmdb-card.tsx

**Keyboard shortcuts card**
- Keyboard shortcuts *(h3)*
- / — Focus search
- Space — Play / pause
- F — Fullscreen
- ← / → — Seek ±10s
- ↑ / ↓ — Volume
- M — Mute
- S / C — Cycle subtitles
- N / B — Next / prev episode
- W — Stream switcher
- E — Episodes panel
- Esc — Close player
- 0–9 — Seek to %
- Backspace — Back

**— Integrations panel —**
- Integrations *(h2)*
- Connect optional third-party services. Activation-code linking keeps tokens encrypted on this app's server; the browser never sees them.
- Horse never ships shared API keys. Each user brings their own credentials — this keeps the app self-hostable and avoids proxying anyone else's quota. *(footer note with shield icon)*

**Trakt card**
- Trakt.tv *(h3)*
- (dynamic) `Connected as @{username}` / `Connected` / Import your Trakt watchlist *(status line)*
- Disconnect *(button)*
- Advanced: use your own Trakt app credentials *(collapsed <details> summary)*
- Client ID *(label)*
- (placeholder) Your Trakt app client id
- Client secret (optional — PKCE apps have none) *(label)*
- (placeholder) Your Trakt app client secret
- Create a free app at trakt.tv/oauth/applications/new (name it anything; redirect URI is unused for device flow). Credentials never leave this browser except to authenticate with Trakt itself. *(link text: trakt.tv/oauth/applications/new)*
- Connect *(button)*
- (dynamic) `Visit {verificationUrl} and enter this code:` *(link text is the URL minus protocol)*
- (aria) Device code
- Waiting for authorization…
- Cancel *(button)*
- Import watchlist *(button)*
- (dynamic) `Last import: +{n} new` / `Local watchlist has {n} titles`
- Import history *(button)*
- (dynamic) `Last import: +{n} plays`
- Push watchlist *(button)*
- (dynamic) `Last push: +{n} · {n} not on Trakt` / `Last push: +{n}`
- Scrobble to Trakt while playing *(switch label + aria)*
- Keep watchlist in sync (push additions to Trakt) *(switch label)*
- (aria) Keep watchlist in sync with Trakt
- One-way: additions flow to Trakt a few seconds after you add them. Imports from Trakt are never pushed back, and nothing is ever removed from your Trakt list. *(hint)*
- (toast) Trakt connected · (toast description) You can now import your watchlist.
- (toast) Client ID is required
- (toast) Enter the code on Trakt · (toast description) Approve access to continue.
- (toast) Could not start Trakt flow · (toast description, dynamic) `{error}`
- (toast, dynamic) `Imported {n} title` / `Imported {n} titles` / Watchlist already up to date · (toast description) Merged into your Library watchlist.
- (toast) Import failed · (toast description, dynamic) `{error}`
- (toast, dynamic) `Imported {n} play` / `Imported {n} plays` / History already up to date · (toast description) Merged into your playback history.
- (toast) History import failed · (toast description, dynamic) `{error}`
- (toast) Push failed · (toast description, dynamic) `{error}`
- (toast) Nothing to push · (toast description) Your watchlist has no imdb-backed titles — install Cinemeta metadata to get imdb ids.
- (toast, dynamic) `Pushed {n} title` / `Pushed {n} titles` ` to Trakt` / Trakt watchlist already up to date · (toast description, dynamic) `{n} title(s) couldn't be matched on Trakt.`
- (toast) Trakt disconnected
- (toast) Watchlist sync on · (toast description) Titles you add to your watchlist from now on are pushed to Trakt automatically.
- (toast) Trakt connection cancelled

**Simkl card** *(mirrors the Trakt card)*
- Simkl *(h3)*
- (dynamic) `Connected as @{username}` / `Connected` / Import your Simkl watchlist
- Disconnect
- Advanced: use your own Simkl app credentials *(summary)*
- Client ID *(label)*
- (placeholder) Your Simkl app client id
- Client secret (optional) *(label)*
- (placeholder) Only if your Simkl app has one
- Create a free app at simkl.com/apps/new (pick any name; you only need the client id). Credentials never leave this browser except to authenticate with Simkl itself. *(link text: simkl.com/apps/new)*
- Connect
- (dynamic) `Visit {verificationUrl} and enter this code:`
- (aria) PIN code
- Waiting for authorization…
- Cancel
- Import watchlist
- (dynamic) `Last import: +{n} new` / `Local watchlist has {n} titles`
- Import history
- (dynamic) `Last import: +{n} plays`
- (toast) Simkl connected · (toast description) You can now import your watchlist.
- (toast) Client ID is required
- (toast) Enter the code on Simkl · (toast description) Approve access to continue.
- (toast) Could not start Simkl flow · (toast description, dynamic) `{error}`
- (toast, dynamic) `Imported {n} title` / `Imported {n} titles` / Watchlist already up to date · (toast description) Merged into your Library watchlist.
- (toast) Import failed
- (toast, dynamic) `Imported {n} play` / `Imported {n} plays` / History already up to date · (toast description) Merged into your playback history.
- (toast) History import failed
- (toast) Simkl disconnected
- (toast) Simkl connection cancelled

**Debrid card**
- Debrid *(h3)*
- (dynamic) `Connected as {username}` / `Connected` / Unlock cached torrent streams instantly *(status line)*
- Premium / Non-premium *(status badges, ×2 placements)*
- (aria, tablist) Debrid service
- Real-Debrid / AllDebrid *(segment tabs; also serviceName)*
- (dynamic) `Expires {toLocaleDateString()}`
- Disconnect *(button)*
- (toast, dynamic) `{serviceName} disconnected`
- (dynamic) `{serviceName} API key` *(field label)*
- (placeholder) Your Real-Debrid API key / Your AllDebrid API key
- Find it on your real-debrid.com/account / alldebrid.com/api page, then validate it here. *(link text varies by service)*
- Validate *(button)*
- (toast) Paste your API key first
- (toast) Debrid connected · (toast description, dynamic) `{serviceName} account verified.`
- (toast) Validation failed · (toast description, dynamic) `{error}`
- Your key is stored in this browser only and relayed server-side per request. Torrent streams cached by the service unlock instantly; uncached torrents are skipped (honest error).
- Streams unlocked with Debrid — resolved links live only for the current session; nothing is counted or stored.

**P2P torrent engine card**
- P2P Torrent Engine *(h3)*
- Play torrents without any account — server-side BitTorrent *(subtitle)*
- (dynamic) status badge: Checking… / `Online · port {P2P_PORT}` / Offline
- Play torrents via P2P *(row title)*
- Join swarms directly when a stream addon only offers torrents. Debrid stays the faster path for cached releases. *(row description)*
- (aria) Toggle P2P torrent playback
- (dynamic) No active swarms / `{n} active swarm` / `{n} active swarms` + optional ` · {formatted speed}`
- Refresh *(button)*
- (dynamic) `{n} peers` · `{progress}%` · speed *(per-torrent rows)*
- Torrent engine is not reachable — P2P playback will fail until the torrent-service is running. Debrid playback is unaffected. *(offline error box)*
- Torrents download to a server-side cache and stream over HTTP (native containers) or through an ffmpeg remux (mkv). Idle swarms are evicted after 45 minutes; swarms that never find peers are dropped after 90 seconds.
- Stop all *(button)*
- Wipe cache *(button)*
- (toast) Torrent cache wiped · (toast description) All downloaded P2P data has been deleted.
- (toast) Torrents stopped · (toast description) Active swarms were closed; cache kept for resume.
- (toast) Cleanup failed · (toast description, dynamic) `{error}`
# 2 · Global chrome & player (src/components/harbor/chrome/ · common/ · player/)

Scope: all user-facing strings from 22 files under `src/components/harbor/` — chrome (app shell, nav, search, palette, hub, account, lists, integrations, ratings, shortcuts, theme studio, TMDB cards), common (rail/poster/meta-card) and the full video player. Bilingual strings shown as `EN / AR` at first use. Dynamic (data-driven) strings kept as templates.

---

## `src/components/harbor/chrome/app-shell.tsx`

**Back button (floating, over detail pages)**
- (aria) Go back
- Back

**Footer — brand lockup & disclaimers (home level only)**
- (aria, brand mark) Horse logo
- Horse
- Horse — an open-source media center. Not affiliated with Stremio. Addons are user-installed; Horse hosts no content.
- Inspired by the Harbor desktop app: github.com/harborstremio/harbor (MIT). This is a web port.
- TMDB *(badge text)*
- This product uses the TMDB API but is not endorsed or certified by TMDB.

**Shared theme banner (deep link `#theme=…`)**
- (aria, dialog) Shared theme
- Shared theme: {name} (dynamic — name falls back to `Shared custom theme` for unnamed custom presets, else the preset name)
- Previewing now — keep it or restore your previous look.
- Keep theme
- Discard

**Shared list banner (deep link `#list=…`)**
- (aria, dialog) Shared list
- Shared list: {name} (dynamic)
- {n} item|items — {description} (dynamic — `{n} item` / `{n} items`, plus optional ` — {description}` when the list has one)
- Add to my lists
- Discard

**Toast after accepting a shared list**
- (toast) Imported {n} item|items (dynamic — `Imported 1 item` / `Imported N items`)
- (toast, description) “{list name}” was added to your lists. (dynamic)

**Demo player hash hook (`#/demo-player`, QA entry)**
- (dynamic) Big Buck Bunny (Demo) *(default demo title)*
- (dynamic) Public demo stream *(default demo episodeName)*

---

## `src/components/harbor/chrome/nav-items.tsx`

**NAV_ITEMS — primary destination labels (EN; feed command palette, dock logic, Settings hub)**
- Home
- Discover
- Catalogs
- Movies
- Shows
- Anime
- Kids
- Live TV
- Calendar
- Library
- Addons
- Wrapped
- Settings

**DOCK_TABS — glass dock tabs (full EN + AR pairs)**
- Settings / الإعدادات
- Kids / الأطفال
- Anime / الأنمي
- Home / الرئيسية

**HUB_ENTRIES — Settings Quick Access hub cards (full EN + AR pairs)**

- Discover — استكشف
  - EN desc: Trending and top picks across movies & series
  - AR desc: الأكثر رواجاً والأفضل تقييماً في الأفلام والمسلسلات
  - keywordsEN: discover, explore, trending, browse
  - keywordsAr: استكشف, اكتشف, الرائج, تصفح
- Library — المكتبة
  - EN desc: Watchlist, continue watching and your collection
  - AR desc: قائمة المشاهدة ومتابعة المشاهدة ومجموعتك
  - keywordsEN: library, watchlist, collection, saved
  - keywordsAr: المكتبة, قائمة المشاهدة, المجموعة, المحفوظات
- Movies — أفلام
  - EN desc: Popular, top rated and every movie genre
  - AR desc: الأكثر شعبية والأعلى تقييماً وكل تصنيفات الأفلام
  - keywordsEN: movies, films, cinema
  - keywordsAr: أفلام, فيلم, سينما
- Shows — مسلسلات
  - EN desc: Popular series, top rated shows and genres
  - AR desc: أشهر المسلسلات والأعلى تقييماً وتصنيفاتها
  - keywordsEN: shows, series, tv
  - keywordsAr: مسلسلات, مسلسل, برامج
- Live TV — البث المباشر
  - EN desc: IPTV playlists and live channels
  - AR desc: قوائم IPTV والقنوات المباشرة
  - keywordsEN: live tv, live, iptv, channels
  - keywordsAr: البث المباشر, مباشر, قنوات, آي بي تي في
- Calendar — التقويم
  - EN desc: Airing schedule for your series
  - AR desc: جدول عرض مسلسلاتك
  - keywordsEN: calendar, schedule, airing
  - keywordsAr: التقويم, الجدول, مواعيد العرض
- Addons — الإضافات
  - EN desc: Install and manage catalog & stream addons
  - AR desc: تثبيت وإدارة إضافات الكتالوج والمصادر
  - keywordsEN: addons, extensions, plugins, install
  - keywordsAr: الإضافات, إضافة, إضافات, تثبيت
- Catalogs — الكتالوجات
  - EN desc: Browse every catalog your addons provide
  - AR desc: تصفح كل الكتالوجات التي توفرها إضافاتك
  - keywordsEN: catalogs, catalog, browse addons
  - keywordsAr: الكتالوجات, كتالوج, تصفح الإضافات
- Wrapped — حصاد المشاهدة
  - EN desc: Your viewing stats and yearly highlights
  - AR desc: إحصاءات مشاهدتك وأبرز لحظات العام
  - keywordsEN: wrapped, stats, statistics, history
  - keywordsAr: حصاد المشاهدة, إحصائيات, السجل, ملخص

---

## `src/components/harbor/chrome/brand.tsx`

— (no user-facing text of its own; renders the horse SVG. When the `label` prop is set it becomes `aria-label` — callers pass `Horse logo`)

---

## `src/components/harbor/chrome/glass-dock.tsx`

**Dock landmarks & tabs**
- (aria, nav) Primary navigation
- (aria, tablist) Primary
- (aria, sr-only per tab + native `title` tooltip) tab labels — bilingual, from DOCK_TABS: Settings / الإعدادات · Kids / الأطفال · Anime / الأنمي · Home / الرئيسية (dynamic per UI language)

---

## `src/components/harbor/chrome/floating-search.tsx`

**Search bar (desktop) & phone trigger**
- (aria, phone trigger button) Search
- (placeholder) Search…
- (aria, input) Search movies, series, people and addons
- AI *(chip text)*
- (tooltip) AI search: describe what you feel like watching
- / *(kbd hint, visible when idle)*
- (aria) Clear search

**Dropdown (listbox)**
- (aria, listbox) Search suggestions
- Search failed — check your connection and try again. *(error line)*

**Idle groups (recents / trending)**
- Recent *(group heading)*
- Trending now *(group heading)*
- Type to search, or press `/` anytime. *(empty idle; the `/` is styled as a kbd chip)*
- Series|Movie *(dynamic per meta type, row subtitle)*
- · {releaseInfo} (dynamic)
- ? *(placeholder glyph inside a round person thumbnail with no image)*

**Live result groups**
- Movies *(group heading)*
- Series *(group heading)*
- Go to / انتقال سريع *(group heading — explicit AR ternary)*
- People *(group heading)*
- From your addons *(group heading)*
- {meta name} (dynamic)
- Series|Movie · {releaseInfo} · ★ {imdbRating} (dynamic row subtitle)
- {hub label} + {hub description} (dynamic — destination rows from nav-items HUB_ENTRIES, EN/AR per language)
- Person *(fallback text when a person's `known_for_department` is missing)*
- No quick matches — press Enter for full results. *(no results)*
- See all results for “{query}” (dynamic)
- Enter *(kbd hint on the see-all row)*

---

## `src/components/harbor/chrome/search-overlay.tsx`

**Dialog shell & header**
- (aria, dialog) Search
- (aria) Close search *(×2 — mobile back arrow + desktop X; dedupe ×2)*
- (aria, input) Search query
- (placeholder) Search movies, series, addons…
- (placeholder, AI mode) Describe what you feel like watching… (Enter)
- AI *(chip text)*
- (tooltip) AI mode: describe what you want to watch
- (aria) Clear query

**Errors**
- Search failed. Check your connection and try again.
- Something went wrong. Try again.

**Result sections**
- AI Picks
- Movies
- Series
- Go to *(section heading + aria)*
- From your addons
- {hub label} / {hub description} (dynamic destination rows — EN/AR per language)

**Section rows (mobile list items)**
- Series|Movie · {releaseInfo} · ★ {imdbRating} (dynamic row subtitle)

**Empty results (search done, nothing found)**
- No results for “{query}”. (dynamic)
- Install more addons to expand your catalog coverage.

**Idle state**
- (aria, brand mark) Horse logo
- Horse
- Recent *(heading; section aria: Recent searches)*
- Trending now *(section heading when trending loaded)*
- Type to search Cinemeta and your installed addons. *(idle, no trending)*
- Tip: toggle AI mode to describe what you feel like watching. *(AI is an inline icon here — no word)*

---

## `src/components/harbor/chrome/command-palette.tsx`

**Dialog shell**
- (aria, dialog) Command palette
- (placeholder) Type a command or search…
- (aria, input) Command palette search
- (aria, spinner status) Searching content
- esc *(kbd chip)*
- (aria) Close command palette
- (aria, listbox) Commands

**Empty state**
- No matches for “{query}” (dynamic)
- Try “settings” or a title from your library

**“Search everywhere” hand-off row**
- Search everywhere for “{query}” (dynamic)
- ↵ *(kbd hint)*

**Groups (shown as right-aligned row tags)**
- Recent · Navigate · Settings · Actions · Library · Movies · Series · Addon results · Addons · Search

**Navigate items** — labels from NAV_ITEMS (`Home, Discover, Catalogs, Movies, Shows, Anime, Kids, Live TV, Calendar, Library, Addons, Wrapped`), overridden by user renames (dynamic)

**Settings sections** (each rendered as `Settings · {label}`)
- Settings · Basics
- Settings · Player
- Settings · Theme
- Settings · Language
- Settings · Integrations
- Settings · Data
- Settings · About

**Actions**
- Toggle Kids Mode *(meta chip: `On` / `Off` dynamic)*
- Shuffle theme
- Sync now
- Search content
- Install app *(only when PWA install is available)*

**Library items** — titles from watchlist / continue watching / history (dynamic); type chip renders the raw type string (`movie` / `series`)

**Remote content items**
- {title name} (dynamic)
- {releaseInfo} · ★ {imdbRating} (dynamic meta line)

**Addons group**
- Addon: {addon name} (dynamic)

**Footer hints**
- ↑ ↓ navigate
- ↵ select
- esc close
- ≥2 chars searches Cinemeta + addons
- ctrl K toggle

---

## `src/components/harbor/chrome/quick-access.tsx`

**Header**
- Quick Access / الوصول السريع
- Everything that used to live in the sidebar / كل الصفحات التي كانت في القائمة الجانبية
- Edit / تعديل *(chip when not editing)*
- Done / تم *(chip when editing)*

**Hub cards**
- (aria, card) {label} — {description} (dynamic, EN/AR from HUB_ENTRIES)
- (aria, edit: move up) Move earlier / تحريك لأعلى
- (aria, edit: move down) Move later / تحريك لأسفل
- (aria, edit: hide) Hide / إخفاء

**Badges**
- {n} addon|{n} addons / {n} إضافة (dynamic)
- Trakt
- Simkl
- LIVE
- {n} *(library count badge — bare number)*

**Hidden cards (edit mode)**
- Show / إظهار

**Edit hint row**
- Use the arrows to reorder and the eye to hide — changes save automatically. / استخدم الأسهم لإعادة الترتيب وعلامة العين للإخفاء — يتم الحفظ تلقائياً.
- Reset to default / استعادة الافتراضي

---

## `src/components/harbor/chrome/page-header.tsx`

- (aria, back button) Back / رجوع
- (aria, breadcrumb nav) Breadcrumb
- Settings / الإعدادات *(breadcrumb parent link)*
- {page title} (dynamic — hub label, EN/AR per language; falls back to raw view id)

---

## `src/components/harbor/chrome/account.tsx`

**Auth modal**
- Sign in to Stremio *(dialog title)*
- Your credentials go only to Stremio's official API through our server-side proxy — they are never stored or logged. Syncing imports your addons, watchlist and continue watching.
- Email *(field label)*
- (placeholder) you@example.com
- Password *(field label)*
- (placeholder) ••••••••
- {error} (dynamic inline alert; fallback text: `Login failed`)
- Sign in & sync *(button; while busy: `Signing in…`)*
- Not affiliated with Stremio. You can also use Horse without an account.

**Toasts (auth/sync)**
- (toast) Signed in to Stremio
- (toast, description) Syncing your addons and library…
- (toast) Sync complete
- (toast, description) {n} addons merged · {n} library items pulled (dynamic)
- (toast) Sync failed *(description: raw error, destructive)*
- (toast) Signed out

**User chip (signed out)**
- Sign in *(inline/compact variant)*
- Sign in to sync *(full variant)*
- (aria, mobile icon button) Sign in to Stremio

**User chip (signed in)**
- (aria) Account menu
- {fullname|email} (dynamic; fallback `Stremio user`)
- Stremio account *(subtitle)*
- {initial} (dynamic — avatar fallback letter; fallback letter `S` when name/email empty)
- (aria, menu) Account actions
- Sync now *(menu item)*
- Sign out *(menu item)*
- (toast, description) {n} addons · {n} items (dynamic)

---

## `src/components/harbor/chrome/add-to-list.tsx`

**Trigger button**
- Add to list *(when in 0 lists)*
- In {n} list|lists (dynamic — `In 1 list` / `In N lists`)

**Popover menu**
- (aria, menu) Lists
- Your lists *(header)*
- No lists yet — create your first one below. *(empty state)*
- {list name} (dynamic)
- {n} titles (dynamic per list row)
- (toast) Created “{list name}” (dynamic)
- (toast, description) {item name} added. (dynamic)
- (toast) Added to {list name} (dynamic)
- (toast) Removed from {list name} (dynamic)

**Create row**
- New list
- (placeholder) List name…
- Create

**Footer button**
- (tooltip) Open library lists

---

## `src/components/harbor/chrome/integrations-strip.tsx`

- (aria, section) Optional integrations to complete your setup
- Complete your Harbor setup *(heading — NOTE: still says “Harbor”, not “Horse”, after the rebrand)*
- {n} integration|integrations not active yet — free keys take about a minute to add. (dynamic — `1 integration` / `N integrations`)
- TMDB — Better artwork, title logos, cast & recommendations
- Ratings — IMDb, Rotten Tomatoes, Metacritic & Trakt scores on every title
- Trakt — Sync scrobbles, watchlist & history with link a code
- Simkl — Track what you watch across devices with a PIN code
- Active / Not set up *(status text per service)*
- Set up in Settings → Integrations *(CTA button)*
- Anime ratings (AniList · MyAnimeList · Kitsu) work without any keys.
- (aria, dismiss) Dismiss setup suggestions

---

## `src/components/harbor/chrome/link-account-flow.tsx`

**Idle (not linked, no active flow)**
- Link {service name} with a code (dynamic — service name is `Trakt.tv` or `Simkl`)
- No account setup needed — you'll get a short code to enter on {host}. (dynamic — host is `trakt.tv/activate` or `simkl.com/pin`)

**Waiting state**
- Visit {verification URL host} and enter this code: (dynamic — URL rendered as link text)
- (tooltip, code button) Click to copy
- Expires in {mm:ss} (dynamic countdown)
- (aria, timer) Code expires in
- (tooltip, QR) Scan to open the verification page
- (alt, QR image) QR code linking to {verification URL} (dynamic)
- Open {host} (dynamic button)
- Waiting (provider asked us to slow down)… / Waiting for authorization… / {error} (dynamic status line)
- Approve on the provider's site and this connects automatically within seconds.
- New code
- Cancel

**Success**
- {Service name} connected (dynamic — also a toast title)
- Linked as @{username} (dynamic)
- (toast, description) Tokens are stored securely on your server.
- (toast) Synced {Service name} (dynamic)
- (toast, description) +{n} watchlist · +{n} plays merged into your library. (dynamic)

**Failure states**
- The code expired — generate a new one.
- Access was denied on the provider's site. You can start again.
- Something went wrong — try again. *(fallback; otherwise raw provider error)*
- Generate new code
- Cancel

**Copy failure toast**
- (toast) Copy failed
- (toast, description) Select the code and copy it manually.
- (toast) Sync failed
- (toast, description) Check your connection and try again.

**Linked card**
- @{username} (dynamic; fallback `Linked to {Service name}`)
- Last sync: {date} (dynamic)
- Linked {date} (dynamic)
- Sync now
- Unlink

---

## `src/components/harbor/chrome/ratings-row.tsx`

**Ratings chips (detail pages)**
- (aria, group) Ratings
- (tooltip) {provider label}: {display}{originalScale} · {votes} votes (dynamic — e.g. `IMDb: 8.5/10 · 1.2M votes`)
- No ratings available *(empty-state chip, with star icon)*
- Provider labels rendered on chips (registry): IMDb · Rotten Tomatoes · Metacritic · TMDB · Trakt · MDBList · AniList · MyAnimeList · Kitsu

**RatingsSettingsCard (Settings → Integrations)**
- Ratings *(heading)*
- Scores shown on detail pages. Providers without a configured key are hidden automatically; anime titles also pull AniList / MAL / Kitsu.
- Enabled *(checkbox label; aria: `Show ratings on detail pages`)*
- (aria, list) Ratings providers (order = display order)
- default position *(shown for providers not yet ordered)*
- needs {key name} (dynamic — values: `OMDB_API_KEY`, `TMDB key`, `TRAKT_CLIENT_ID`, `MDBLIST_API_KEY`)
- (aria) Move {provider label} up (dynamic)
- (aria) Move {provider label} down (dynamic)
- Ordered / Default *(toggle button states)*
- “Ordered” providers appear first in the given sequence; everything else follows in default order. Hidden automatically when a provider has no data or no key.

---

## `src/components/harbor/chrome/shortcuts-overlay.tsx`

**Dialog**
- (aria, dialog) Keyboard shortcuts
- Keyboard shortcuts *(title)*
- Work anywhere in Harbor. *(subtitle — NOTE: still says “Harbor” after the rebrand)*
- (aria) Close shortcuts help

**Section: Anywhere** *(title: `Anywhere`)*
- Search (instant results) — Ctrl K
- Search — /
- Command palette (navigate & settings) — Ctrl Shift P
- This shortcuts help — ?
- Close overlays / dialogs — Esc
- Go back — Backspace, Alt+←

**Section: While watching** *(heading: `While watching`)*
- Play / pause — Space
- Seek back / forward — ← →
- Volume up / down — ↑ ↓
- Mute — M
- Fullscreen (double-click also works) — F
- Picture-in-picture — U
- Cycle subtitles — S C
- Switch stream — W
- Next episode (series) — N
- Jump to 0–90% of the video — 0 … 9
- Jump to start / end — Home End

**Footer tip**
- Tip: press Ctrl K for instant search results, or Ctrl Shift P for the command palette — together they search everywhere.

---

## `src/components/harbor/chrome/theme-studio.tsx`

**Dialog**
- Theme Studio *(title)*
- Design your own theme with live preview. Save it to reuse, or export and share it. Your accent color seeds the Material 3 palette. *(description)*

**Saved themes strip**
- (aria, strip) Saved themes
- (aria) Load theme {name} (dynamic)
- (aria) Share theme {name} (dynamic)
- (tooltip) Copy share link
- (aria) Delete theme {name} (dynamic)
- {theme name} (dynamic)

**Palette section**
- Palette *(heading)*
- Your accent color seeds the Material 3 palette — tones, containers and surfaces are derived from it.
- Color field labels + hints (10 rows):
  - Canvas — App background
  - Surface — Panels & rails
  - Elevated — Cards & dialogs
  - Raised — Buttons & chips
  - Text — Primary text
  - Text muted — Secondary text
  - Text subtle — Captions & hints
  - Edge — Borders & dividers
  - Accent — Highlights & actions
  - Danger — Destructive actions
- (tooltip, swatch) Pick {label lowercased} color (dynamic — e.g. `Pick canvas color`)
- (aria, color input) {label} color picker (dynamic)
- (aria, text input) {label} color value (dynamic)

**Typography section**
- Typography *(heading)*
- Font pair chips (from FONT_PAIRS registry): Sentient / Switzer · Fraunces / Inter · General Sans · Cabinet / Switzer · IBM Plex · Plus Jakarta · System

**Structure section**
- Structure *(heading)*
- Layout *(select label)* — options: sidebar, stremio, topdock, rail, dracula, nord, forest, royal
- Cards *(select label)* — options: flat, glass, stremio, crunch, noir, glossy
- Buttons *(select label)* — options: flat, crunch, noir, glossy

**Footer actions**
- (placeholder, name input) Theme name *(aria: `Theme name`)*
- Save theme
- Export
- Share
- From link
- Import
- Reset preview
- (aria, hidden file input) Import theme file

**Paste-a-theme-link mini dialog**
- (aria, dialog) Import theme from link
- Theme link *(title)*
- Paste a shared theme link (or the raw hbtheme1 code). Nothing is sent to any server.
- (placeholder) https://…/#hbtheme1.…
- Cancel
- Apply link

**Toasts / errors**
- (toast) Invalid colors
- (toast, description) Fix the highlighted color values before saving.
- (toast) Theme saved
- (toast, description) "{name}" is now your active theme. (dynamic)
- (toast) Could not build share link
- (toast) Share link copied
- (toast) “{name}” link copied (dynamic)
- (toast, description) Anyone opening it can preview the theme.
- (toast) Copy blocked — copy the link manually
- (toast) Invalid theme link
- (toast, description) Paste a harbor theme link you received.
- (toast) Theme link applied
- (toast, description) Previewing — save it to keep it.
- (toast) Theme imported
- (toast, description) Previewing imported theme — save it to keep it.
- (toast) Import failed
- (toast, description) {error message} (dynamic; fallback `Invalid file`)
- Not a Horse theme file *(thrown error text, surfaces in the Import failed toast)*
- Theme file contains invalid colors *(thrown error text)*

**Fallback names**
- My theme *(default draft/saved name — rendered in the name input and saved-theme chips)*
- Shared theme *(fallback name when an imported link carries no customName)*

---

## `src/components/harbor/chrome/tmdb-card.tsx`

**Card header**
- TMDB metadata *(heading)*
- Posters, backdrops, logos, cast, certifications and better search — layered on top of your addons.
- (aria, switch) Enable TMDB metadata

**Server key status**
- Checking server key…
- Server TMDB key active (set via environment).
- No server key — add your own below to enable TMDB.

**Metadata language**
- Metadata language
- Titles, overviews and images returned by TMDB.
- (aria, select) TMDB metadata language
- Option labels: English · العربية (Arabic) · Español · Français · Deutsch · Português (BR) · Italiano · Türkçe · Русский · 日本語 · 한국어 · 简体中文

**Image quality**
- Image quality
- Higher looks sharper but downloads more bytes.
- (aria, group) Image quality
- low / medium / high *(segment options — raw strings; visually capitalized via CSS)*

**Bring-your-own key**
- Your own TMDB API key (optional) *(field label)*
- (placeholder) v3 key (32 hex chars) or v4 Read Access Token
- Valid v4 Read Access Token / Valid v3 API key *(validation success; rendered as `{label} — saved.`)*
- — saved. *(suffix on success line)*
- TMDB rejected this key. *(validation failure fallback; otherwise server-provided error)*
- Could not reach TMDB to validate — check your connection.

**Key help box**
- Get a free key in ~1 minute:
- Create a free account at themoviedb.org. *(link text: `themoviedb.org`)*
- Open Settings → API and copy the API Key (v3) — or the longer API Read Access Token (v4). *(link text: `Settings → API`)*
- Paste it above. It is validated live, stays in this browser only, and TMDB features switch on immediately.

**Attribution**
- TMDB *(badge)*
- This product uses the TMDB API but is not endorsed or certified by TMDB. *(appears in-card and again in the `TmdbAttribution` export — dedupe ×2 within file)*

---

## `src/components/harbor/chrome/tmdb-enrich.tsx`

- Unknown *(fallback title for TMDB recommendation cards when TMDB returns no title)*
- (everything else is data plumbing; no other user-facing text)

---

## `src/components/harbor/common/rail.tsx`

- View all *(header chip when `onViewAll` set)*
- (aria, scroll left) Scroll {title} left (dynamic)
- (aria, scroll right) Scroll {title} right (dynamic)
- {title} / {subtitle} (dynamic — rendered in the rail header)
- RailSkeleton: aria-hidden, no text

---

## `src/components/harbor/common/poster.tsx`

- (aria, PosterCard) {name} (dynamic)
- (alt, PosterImage) {alt} (dynamic — usually the title or empty)
- — (no static user-facing text)

---

## `src/components/harbor/common/meta-card.tsx`

- {rating} *(IMDb score chip — dynamic)*
- {addon origin name} *(top-end chip — dynamic)*
- {release year} *(bottom chip on hover — dynamic, year part of releaseInfo)*
- {meta.name} / {meta.releaseInfo ?? meta.type} (dynamic — title + subtitle line)
- — (no static user-facing text)

---

## `src/components/harbor/player/player-overlay.tsx`

**Dialog shell**
- (aria, dialog) Playing {title} (dynamic)

**Resolving screen** *(spinner + status line, aria-live polite)*
- Finding the best stream…
- Joining the torrent swarm… (dynamic)
- Finding peers… ({n}s) (dynamic)
- Finding peers… ({n} found) (dynamic)
- Checking video codecs… (dynamic)

**Resolve-path errors** *(feed the error panel below)*
- No streams found from your addons. (×2 — no-candidates + torrent-without-P2P paths)
- No browser-playable stream found. Open the stream picker to choose manually — torrent streams play via P2P or unlock with debrid.
- No peers responded for the best torrent. Open the stream picker to pick another source, or connect debrid for instant cached streams.
- Torrent engine could not serve this file. Try another stream in the picker. *(tech panel then shows code `P2P_NO_PLAN`, host `P2P swarm`)*
- P2P swarm *(rendered as the “Source host” value for torrent errors)*
- Failed to resolve streams *(catch-all fallback)*

**Top bar**
- (aria) Close player (Esc)
- Leave playback? *(native `window.confirm` when playerConfirmLeave is on)*
- {title} (dynamic)
- S{season}:E{episode} · {episodeName} (dynamic)
- Streams *(button)*
- (tooltip) Switch stream (W)

**Ladder toasts (EN / AR via homeT)**
- (toast) Retrying through the secure proxy… / إعادة المحاولة عبر الوسيط الآمن…
- (toast) Converting this stream for your browser… / جارٍ تحويل هذا البث لمتصفحك…
- (toast) Trying another source… / جرب مصدراً آخر…

**Classified error panel**
- Playback problem / مشكلة في التشغيل *(title)*
- {error message} (dynamic — one of the localized messages below)
- Convert and play / حوّل وشغّل
- Retry / إعادة المحاولة
- Pick another stream / اختر بثاً آخر
- Back
- Show technical details / إظهار التفاصيل التقنية *(expand toggle)*
- Failure class / نوع الخطأ: {cls} (dynamic)
- Error code / رمز الخطأ: {code} (dynamic; fallback `n/a`)
- Source host / مصدر البث: {host} (dynamic; fallback `n/a`)
- Copy diagnostics / نسخ التشخيص
- (toast) Diagnostics copied / تم نسخ التشخيص
- (clipboard, on copy) `class: {cls}` / `code: {code}` / `host: {host}` / `user-agent: …` / `page: …` (diagnostic block copied to clipboard)

**Final error messages (localized, EN / AR via homeT)**
- This format needs conversion / هذه الصيغة تحتاج إلى تحويل
- The link expired or is unavailable / انتهت صلاحية الرابط أو أنه غير متاح
- Network hiccup — retrying… / انقطاع في الشبكة — إعادة المحاولة…
- The source blocks playback. / المصدر يمنع التشغيل.
- Torrents can't play natively in browsers. This one needs the built-in P2P engine or a debrid unlock. / لا يمكن للمتصفحات تشغيل التورنت مباشرة. يحتاج هذا البث إلى محرك P2P المدمج أو فتح عبر Debrid.

**Convert-ask dialog** *(transcodeMode="ask")*
- (aria, alertdialog) This format needs conversion / هذه الصيغة تحتاج إلى تحويل
- This format needs conversion *(dialog title)*
- The server can convert this stream to a browser-friendly format (H.264/AAC). Conversion takes time and CPU. / يمكن للخادم تحويل هذا البث إلى صيغة متوافقة (H.264/AAC). قد يستهلك التحويل وقتاً ومعالجة.
- Convert and play / حوّل وشغّل
- Pick another stream / اختر بثاً آخر

**Buffering overlay (P2P block)**
- Downloading via P2P…
- {percent}% · {peers} peers · {formatted speed} (dynamic stats line)
- transmuxed — seeking restarts the transcoder at the target position *(HUD note in remux mode)*

**P2P status pill** *(persistent while a torrent stream plays)*
- (tooltip) Server-side P2P torrent stream
- P2P {percent}% · {formatted speed} · {peers} peers (dynamic)
- · transmux *(suffix in remux mode)*

**Volume HUD** *(aria-hidden, visual only)*
- {percent}% (dynamic)

**Up Next card** *(series, near end of episode)*
- (aria, alert) Up next episode
- Up next
- in {n}s (dynamic countdown; `0` renders `now`)
- now
- Next episode
- Cancel
- S{season}:E{episode} · {episodeName} (dynamic)

**Bottom transport — primary buttons**
- (aria) Pause (Space) / Play (Space) *(dynamic by state)*
- (aria) Back {n}s (dynamic — seekBackStepSec)
- (aria) Forward {n}s (dynamic — seekForwardStepSec)
- (aria) Mute (M) / Unmute (M) *(dynamic)*
- (aria, volume slider) Volume

**Subtitles menu** *(opened by the Subtitles button)*
- (aria, button) Subtitles (S)
- Subtitles *(menu header)*
- {loaded}/{effective} loaded (dynamic counter)
- (aria, group) Filter subtitles by language
- All *(language chip reset)*
- {lang chip} {count} (dynamic — language chips with counts)
- (placeholder) Filter subtitles…
- (aria, filter input) Filter subtitles by name, language or provider
- (aria, clear filter) Clear subtitle filter
- Off *(subtitles-off row)*
- {subtitle label} (dynamic)
- {lang chip} (dynamic — e.g. `EN`)
- {source / provider name} (dynamic row subtitle)
- AI *(badge on AI-translated tracks)*
- No subtitles match “{query}”. (dynamic)
- No subtitles found for this title.
- Load more ({n} more) (dynamic — suffix only when more remain)
- Load local file (.srt / .vtt) *(file-picker label; accepts .srt/.vtt/.ass/.ssa)*
- (toast) No readable cues found in that file.
- (toast) This subtitle is already loaded.
- Local file *(source label shown for locally loaded subtitles)*

**Settings menu** *(playback settings)*
- (aria, button) Playback settings
- Speed *(heading, with gauge icon)*
- 0.5× · 0.75× · 1× · 1.25× · 1.5× · 2× *(speed chips — rendered from the numeric list as `{value}×`)*
- Quality *(heading, with layers icon; shown when multiple HLS levels exist)*
- Auto *(adaptive chip)*
- (tooltip) Adaptive bitrate *(Auto chip when nothing is pinned)*
- (tooltip) Now playing {level label} (dynamic — Auto chip while auto mode plays a level)
- {height}p / {bitrate} kbps (dynamic quality level labels, e.g. `1080p`, `3200 kbps`)
- Audio *(heading, with audio-lines icon; shown when multiple audio tracks exist)*
- {track label} (dynamic; fallbacks `Audio {n}` / `Track {n}`)
- Video fit *(heading)*
- Fit / Fill / Zoom *(video-fit chips)*

**Misc buttons**
- (aria) Picture in picture (U)
- (aria) Fullscreen (F) / Exit fullscreen (F) *(dynamic)*

**Seek bar** *(slider; always LTR)*
- (aria, slider label) Seek
- (aria, valuetext) {spoken time} of {spoken duration} (dynamic — spokenDuration format: `{h} hour(s) {m} minute(s) {s} second(s)`, e.g. `1 minute 30 seconds of 46 minutes`)
- (aria, valuetext, unknown length) Elapsed {spoken time}, total length unknown (dynamic)
- (tooltip) Seek — click, drag, or use arrow keys
- (tooltip, unknown length) Total length unknown for this stream — showing elapsed time; seeking may be limited
- {clock} (dynamic drag tooltip — `formatClock`, e.g. `12:34`; `--:--` placeholder when value unknown)

**Time display** *(elapsed / remaining toggle)*
- (tooltip) Toggle elapsed / remaining time
- (tooltip, unknown length) Total length unknown — showing elapsed time
- (aria) Time: {spoken time} of {spoken duration}. Activate to toggle remaining time display. (dynamic)
- (aria, unknown length) Time: Elapsed {spoken time}, total length unknown. Activate to toggle remaining time display. (dynamic)
- ~ *(prefix marker when duration is approximate — dynamic)*
- / {clock} (dynamic total; remaining mode renders `-{clock}`)
- length unknown / المدة غير معروفة *(shown instead of the total when duration is unknown — explicit AR ternary)*

---

*End of section 2. Files processed: 22/22. No project source files were modified.*
# 3 · Library logic, system messages & API responses

Scope: all user-facing strings found in `src/lib/harbor/*` (client stores, playback/subtitle logic, integrations, theme engine, share card), the torrent mini-service, and every `route.ts` under `src/app/api/`. Strings are verbatim (EN source; `src/lib/harbor/i18n.ts` entries show the shipped AR translation too). `(api: error)` = JSON body field the UI surfaces (integrations panels, player error panel, toasts). Marked `[internal]` where a string/code is consumed programmatically rather than displayed.

## `src/lib/harbor/i18n.ts`
*Central bilingual EN/AR string map (not in the assigned list — included because it is the project's main UI-text source; AR shown for translation-review context).*

- (en/ar) "Continue Watching" / "متابعة المشاهدة"
- (toast, en/ar) "Retrying through the secure proxy…" / "إعادة المحاولة عبر الوسيط الآمن…"
- (toast, en/ar) "Converting this stream for your browser…" / "جارٍ تحويل هذا البث لمتصفحك…"
- (error, en/ar) "This format needs conversion" / "هذه الصيغة تحتاج إلى تحويل"
- (action, en/ar) "Convert and play" / "حوّل وشغّل"
- (action, en/ar) "Pick another stream" / "اختر بثاً آخر"
- (error, en/ar) "The link expired or is unavailable" / "انتهت صلاحية الرابط أو أنه غير متاح"
- (error, en/ar) "The source blocks playback." / "المصدر يمنع التشغيل."
- (toast, en/ar) "Network hiccup — retrying…" / "انقطاع في الشبكة — إعادة المحاولة…"
- (toast, en/ar) "Trying another source…" / "جرب مصدراً آخر…"
- (error, en/ar) "Torrents can't play natively in browsers. This one needs the built-in P2P engine or a debrid unlock." / "لا يمكن للمتصفحات تشغيل التورنت مباشرة. يحتاج هذا البث إلى محرك P2P المدمج أو فتح عبر Debrid."
- (toggle, en/ar) "Show technical details" / "إظهار التفاصيل التقنية"
- (action, en/ar) "Copy diagnostics" / "نسخ التشخيص"
- (toast, en/ar) "Diagnostics copied" / "تم نسخ التشخيص"
- (action, en/ar) "Retry" / "إعادة المحاولة"
- (title, en/ar) "Playback problem" / "مشكلة في التشغيل"
- (label, en/ar) "Failure class" / "نوع الخطأ"
- (label, en/ar) "Error code" / "رمز الخطأ"
- (label, en/ar) "Source host" / "مصدر البث"
- (title, en/ar) "Kids Corner" / "زاوية الأطفال"
- (subtitle, en/ar) "Fun and safe picks for the little ones." / "اختيارات ممتعة وآمنة للصغار."
- (label, en/ar) "Card size" / "حجم البطاقة"
- (option, en/ar) "Large" / "كبير"
- (option, en/ar) "Medium" / "متوسط"
- (option, en/ar) "Small" / "صغير"
- (hint, en/ar) "Poster size in Kids Corner — bigger cards are easier to tap." / "حجم الملصقات في زاوية الأطفال — البطاقات الأكبر أسهل للمس."
- (action, en/ar) "View details" / "عرض التفاصيل"
- (badge, en/ar) "Featured" / "مميز"
- (loading, en/ar) "Loading featured titles" / "جارٍ تحميل المميزة"
- (action, en/ar) "Pause autoplay" / "إيقاف العرض التلقائي مؤقتاً"
- (action, en/ar) "Resume autoplay" / "استئناف العرض التلقائي"
- (action/aria, en/ar) "Resume" / "متابعة"
- (action, en/ar) "Mark as watched" / "تحديد كمشاهد"
- (action, en/ar) "Remove from Continue Watching" / "إزالة من متابعة المشاهدة"
- (toast, en/ar) "Marked as watched" / "تم التحديد كمشاهد"
- (label, en/ar) "Episode" / "الحلقة"
- (label, en/ar) "left" / "تبقى"
- (unit, en/ar) "h" / "س"
- (unit, en/ar) "m" / "د"
- (badge, en/ar) "Airs today" / "يُعرض اليوم"
- (badge, en/ar) "Airs tomorrow" / "يُعرض غداً"
- (dynamic, en/ar) "In {n} {unit}" / "يُعرض بعد {n} {unit}"
- (badge, en/ar) "New episode" / "حلقة جديدة"
- (loading, en/ar) "Loading" / "جارٍ التحميل"
- (dynamic, en/ar) "Anime" / "أنمي" (hero meta type label)
- (dynamic, en/ar) "Movie" / "فيلم"
- (dynamic, en/ar) "Series" / "مسلسل"
- (dynamic) `S${season} E${episode}` (S/E tag, kept Latin)
- (dynamic, en/ar) `الحلقة ${n}` / `Episode ${n}` (episode subtitle fallback)
- (dynamic, en/ar) `تبقى ${h}س ${m}د` / `${h}h ${m}m left` (remaining-time label)
- (dynamic, en/ar) `يومين` / `يوم` / `أيام` / `day` / `days` (plural units inside "In {n} {unit}")
- (dynamic, en/ar) `الشريحة ${i} من ${total}` / `Slide ${i} of ${total}`
- (dynamic, en/ar) `الانتقال إلى الشريحة ${n}` / `Go to slide ${n}`

## `src/lib/harbor/store.ts`
No user-facing text (zustand nav/settings/addons stores; only localStorage keys and view ids).

## `src/lib/harbor/settings.ts`
No user-facing text (schema + defaults only; note: default value `preferredLanguages: ["English"]` is a stored data value that can surface as a language chip).

## `src/lib/harbor/cloud-sync.ts`
- (error) "sync failed" — cloud-sync status error fallback (shown in Settings sync status)
- (dynamic) `GET /api/sync ${res.status}` — error state string (Settings sync status)
- (dynamic) `POST /api/sync ${res.status}` — error state string
- (dynamic) `Stremio · ${hash4}` — device-id display form in Settings (`Stremio · ` literal + 4 hex chars)
- (dynamic) `${id.slice(0,4)}…${id.slice(-4)}` — anonymous device-id display form (literal `…` separator)

## `src/lib/harbor/auth.ts`
*Adjacent lib file (Stremio account store) — included for completeness.*
- (error) "Login failed" — account modal login error fallback
- (error) "Network error — try again" — account modal
- (error) "not signed in" — syncAll guard result `[internal → surfaced by caller]`
- (error) "sync failed" — syncAll catch fallback

## `src/lib/harbor/playback.ts`
*Stream classifier — `reasons` strings appear in the picker/technical details; MEDIA_ERR_* appear in the player technical-details panel.*
- (error/reason) "HEVC/DoVi video needs conversion, which is disabled on this server" (×2 branches)
- (reason) "HEVC/DoVi video will be converted to H.264" (×2 branches)
- (reason) "no playable source in this stream object"
- (reason) "addon marked this stream not-web-ready"
- (reason) "http source on an https page — mixed content is blocked"
- (reason) "audio (AC3/DTS/TrueHD) will be converted to AAC"
- (dynamic) `${ext.toUpperCase()} container will be remuxed to MP4` (e.g. "MKV container will be remuxed to MP4"; `?` when unknown)
- (error) "signing failed" — fallback when /api/media/sign returns no error field
- (technical) "MEDIA_ERR_ABORTED" / "MEDIA_ERR_NETWORK" / "MEDIA_ERR_DECODE" / "MEDIA_ERR_SRC_NOT_SUPPORTED" / "UNKNOWN" — classified failure message fallbacks (technical-details panel)
- Badge keys (resolved to localized labels by the picker, not literal text here): "plays-here" | "plays-proxy" | "plays-convert" | "external" | "not-playable" `[internal]`

## `src/lib/harbor/playback-timeline.ts`
- (ui) "--:--" — unknown-duration clock display
- (dynamic) `${h}:${mm}:${ss}` / `${m}:${ss}` — formatClock output
- (aria, dynamic) `${h} hour${s}` / `${m} minute${s}` / `${s} second${s}` — spokenDuration ("12 minutes 30 seconds of 1 hour 45 minutes"; English only by design)

## `src/lib/harbor/p2p.ts`
*P2P torrent client — HUD stats + errors relayed from torrent-service.*
- (ui) "0 KB/s" — formatSpeed zero state
- (dynamic) `${n.toFixed(1)} MB/s` / `${n} KB/s` — formatSpeed
- (ui) "—" — formatEta zero state
- (dynamic) `${h}h ${m}m` / `${m}m ${s}s` / `${s}s` — formatEta
- (error) throws `String(data.error)` — error text from torrent-service verbatim (see torrent-service section)

## `src/lib/harbor/subtitles.ts`
- (label) "Subtitle" — final fallback label in subLabel() (subtitle menu entry)
- (error) "gzipped subtitle unsupported" — subtitle load failure
- (dynamic) `subtitle fetch ${res.status}` — subtitle load failure
- (dynamic) uppercase lang code e.g. "ARA", "ENG" — subLabel fallback `(s.lang ?? "").toUpperCase()`; langChip() likewise returns uppercase 3-letter codes (e.g. "ARA") for chips

## `src/lib/harbor/languages.ts`
- (ui) "SUB" — langChip fallback chip when no language can be derived

## `src/lib/harbor/api.ts`
- (error) "Invalid addon manifest" — thrown when an installed manifest lacks id/name (toast in addon install flow)
- (dynamic) `proxy ${res.status}: ${body.slice(0, 200)}` — proxyFetch error (surfaces in toasts/technical details)
- (label) "OpenSubtitles" — `addonName` attached to mirror subtitle entries (shown as subtitle source)
- (label) "Addon" — fallback source name when an addon manifest has no name

## `src/lib/harbor/addon-probe.ts`
*Diagnostics copy shown in the addon health-probe dialog.*
- (dynamic) `${name} is healthy` — probe success title
- (dynamic) `Responded with ${count} ${noun} in ${s}s` — probe success body (noun = "streams" | "subtitles" | "catalog items"; e.g. "Responded with 41 streams in 1.2s")
- (dynamic) `${name} did not respond` — probe failure title
- (error) "The addon's resource endpoint timed out or returned an error." — probe failure body fallback
- (error) "Endpoint replied with zero streams."
- (error) "Endpoint replied with zero subtitles."
- (error) "Endpoint replied with zero catalog items."
- (error) "Meta endpoint replied without a meta object."
- (error) "Manifest declares no testable resources (stream/subtitles/catalog/meta)."
- (error) "Request failed" — probe catch fallback

## `src/lib/harbor/debrid.ts`
*Debrid client store — errors shown in picker rows / Settings → Integrations.*
- (error) "Connect a debrid service in Settings → Integrations first" — resolve without a key
- (error) "Could not reach the debrid service" — validate catch fallback
- (error) "Unlock request failed" — resolve catch fallback
- (dynamic) `Service responded ${res.status}` — validate failure fallback
- (dynamic) `Unlock failed (${res.status})` — resolve failure fallback
- (dynamic) any `error` field from /api/debrid/* relayed verbatim (see API routes)

## `src/lib/harbor/debrid-server.ts`
*UpstreamError messages (become the `error` JSON field of /api/debrid/* responses; step names are prefixed dynamically).*
- (dynamic) `${step}: rate limited upstream — retry in a minute`
- (dynamic) `${step}: upstream returned a non-JSON response`
- (dynamic) `${step}: timed out`
- (dynamic) `${step}: service unreachable`
- (dynamic) `${step}: exceeded total time budget`
- (dynamic) step literals composed by routes: "Real-Debrid cache check", "Real-Debrid add magnet", "Real-Debrid torrent info", "Real-Debrid select files", "Real-Debrid select files (all)", "Real-Debrid unrestrict link", "AllDebrid upload", "AllDebrid status", "AllDebrid unlock", "Real-Debrid user", "AllDebrid user" `[internal prefixes]`

## `src/lib/harbor/trakt.ts`
*Trakt client store — error strings displayed in Settings → Integrations.*
- (dynamic) `Trakt responded ${res.status}` (×5 flows: device-code, device-token, watchlist import, history import, push)
- (error) "Could not reach Trakt" — connect catch fallback
- (error) "Device code expired — start again."
- (error) "Connection lost — start again."
- (error) "Token polling failed" — pollOnce catch fallback
- (error) "Import failed" — watchlist import catch fallback
- (error) "History import failed" — history import catch fallback
- (error) "Push failed" — pushIds catch fallback
- (dynamic) any `error` field from /api/trakt/* relayed verbatim

## `src/lib/harbor/trakt-server.ts`
- (api: error) "rate limited" — 429 guard
- (api: error) "Trakt blocked this request (Cloudflare). If you self-host, check your server's egress IP." — non-JSON 403 upstream
- (api: error) "Trakt returned a non-JSON response" — non-JSON upstream
- (api: error) "upstream timeout" — 504
- (api: error) "trakt unreachable" — 502
- (fallback) "Unknown title" — watchlist item name fallback (displayed in watchlist)

## `src/lib/harbor/simkl.ts`
*Simkl client store — same surface as Trakt.*
- (dynamic) `Simkl responded ${res.status}` (×4 flows: pin, pin/poll, watchlist import, history import)
- (error) "Could not reach Simkl" — connect catch fallback
- (error) "PIN code expired — start again." (×2: local expiry + definitive expired poll)
- (error) "Connection lost — start again."
- (error) "Simkl rejected this code — start again."
- (error) "Token polling failed" — pollOnce catch fallback
- (error) "Import failed" — watchlist import catch fallback
- (error) "History import failed" — history import catch fallback
- (dynamic) any `error` field from /api/simkl/* relayed verbatim

## `src/lib/harbor/simkl-server.ts`
- (api: error) "rate limited" — 429 guard
- (api: error) "Simkl returned a non-JSON response" — non-JSON upstream
- (api: error) "Simkl rejected the client id" — 412 envelope fallback
- (api: error) "authorization_pending" — PIN-poll pending marker `[internal, pattern-matched by client]`
- (api: error) "token expired or revoked" — 401
- (api: error) "upstream timeout" — 504
- (api: error) "Simkl unreachable" — 502
- (fallback) "Unknown title" — watchlist/history name fallback (×2)
- (fallback) "Unknown show" — history show-name fallback

## `src/lib/harbor/anilist.ts`
- (dynamic) `AniList #${m.id}` — mediaTitle fallback (displayed as card title)
- (error) "empty anilist response" — thrown (caught upstream; may surface in view error states)
- (dynamic) `anilist ${res.status}` — thrown (caught upstream) `[internal]`
- (dynamic) AniList GraphQL `errors[0].message` relayed as error `[internal]`

## `src/lib/harbor/tmdb.ts`
- (error) "TMDB disabled in settings" — TmdbUnavailableError when settings toggle off `[internal, caught]`
- (dynamic) `tmdb ${res.status}` — default error before body error is read `[internal, caught]`
- (fallback) "Unknown" — trending item title fallback (displayed)
- (dynamic) `Person ${r.id}` — search person-name fallback (displayed in search results)

## `src/lib/harbor/tmdb-server.ts`
- (api: error) "TMDB is not configured on this server. Set TMDB_ACCESS_TOKEN (or TMDB_API_KEY) in the environment, or add your own key in Settings → Integrations." — 501 unconfigured
- (api: error) "TMDB rate limit reached" — 429 after retries
- (dynamic) `TMDB responded ${res.status}` (×2)
- (api: error) "TMDB returned non-JSON"
- (dynamic) upstream `status_message` relayed verbatim when TMDB replies with one
- (dynamic) "tmdb request failed" / "tmdb unreachable" / "tmdb failed" — internal fallback error texts `[internal]`

## `src/lib/harbor/linking.ts`
*Zero-config account linking store — errors shown in the Integrations link flow.*
- (dynamic) `Server responded ${res.status}` — link/start failure fallback
- (error) "Could not reach the server" — link/start catch fallback
- (error) "Connection hiccup — still trying…" — poll 5xx/429 transient message
- (error) "poll failed" — poll catch fallback `[internal, transient]`
- (dynamic) any `error`/`error_description` from /api/*/link/poll relayed verbatim

## `src/lib/harbor/link-resolve.ts`
No user-facing text (server-side vault resolution; silent nulls).

## `src/lib/harbor/lists.ts`
- (error) "List name is required" — createList throws (caught + shown by the list-creation dialog)
- (dynamic) `${shared.name} (${n})` — imported-list name suffix " (2)", " (3)"… (literal parenthesized number)

## `src/lib/harbor/cw.ts`
No user-facing text (localStorage CW/watchlist/history stores).

## `src/lib/harbor/tvnav.ts`
No user-facing text (spatial-navigation engine).

## `src/lib/harbor/pwa.ts`
No user-facing text (SW registration + install-prompt capture; the visible install copy lives in components).

## `src/lib/harbor/themes.ts`
*Theme preset + font-pair display names (shown in Settings → Appearance / Theme Studio; proper nouns — flagged DO-NOT-TRANSLATE candidates).*
- (label) "Horse" — preset cool-grey display name
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
- (label) "Sentient / Switzer" — font pair name
- (label) "Fraunces / Inter"
- (label) "General Sans"
- (label) "Cabinet / Switzer"
- (label) "IBM Plex"
- (label) "Plus Jakarta"
- (label) "System"

## `src/lib/harbor/share-card.ts`
*Canvas-drawn Wrapped share card (EN only by design).*
- (canvas) "MY HORSE WRAPPED" — card header
- (dynamic) `SHARED BY ${name.toUpperCase().slice(0, 30)}` — top-right name badge
- (canvas) "TOTAL WATCH TIME" — hero stat caption
- (canvas) "MOVIES" / "EPISODES" / "ACTIVE DAYS" — stat block captions
- (dynamic) `${h}h ${m}m` / `${m}m` / `${s}s` — fmtDuration (watch-time value)
- (canvas) "horse — local stats · private by design" — card footer
- (error) "canvas.toBlob returned null (likely a tainted canvas)" / "Canvas 2D unavailable" / "share card requires a browser document" `[internal, caught → silent retry]`

## `src/lib/harbor/scoring.ts`
*Technical labels parsed from release names and shown verbatim as picker chips/tier badges (DO-NOT-TRANSLATE technical vocabulary).*
- (badge) "4K" / "1080p" / "720p" / "480p" / "SD" — resolution labels
- (badge) "DV" / "HDR10+" / "HDR10" — HDR labels
- (badge) "HEVC" / "AV1" / "VP9" / "AVC" — codec labels
- (badge) "REMUX" / "BluRay" / "WEB-DL" / "WEBRip" / "DVDRip" / "HDTV" / "TS" / "CAM" / "SCR" — source labels
- (badge) "Atmos" / "TrueHD" / "DTS" / "DD+" / "AC3" / "AAC" / "FLAC" / "Opus" — audio labels
- (tier) "4K HDR" / "1080p HDR" / "ROUGH" / "OTHER" — tierOf labels (TIER_ORDER)
- (dynamic) `${n.toFixed(2)} GB` / `${n} MB` / `${n} B` — formatSize
- (reason) "placeholder" / "executable" / "not-configured" / "stub" — trustFilter reasons `[internal codes]`

## `src/lib/harbor/media-proxy.ts`
*SSRF/permission error strings (surface via /api/media/sign `/api/media` JSON `error` → player technical details).*
- (error) "blocked host" (×5 SSRF checks)
- (error) "dns resolve failed" (×2)
- (error) "host not allowed" (×2 — allow/denylist)
- (error) "invalid url"
- (error) "unsupported protocol"
- (error) "credentials in url not allowed"
- (error) "too many redirects"
- (dynamic) `blocked: ${message}` — route-level wrapper (also in proxy-core/media routes)

## `src/lib/harbor/proxy-core.ts`
- (api: error) "rate limited" — /api/proxy 429
- (api: error) "missing url"
- (api: error) "invalid url"
- (api: error) "unsupported protocol"
- (dynamic) `blocked: ${message}` / fallback "ssrf"
- (api: error) "upstream timeout" — 504
- (api: error) "upstream fetch failed" — 502

## `src/lib/harbor/transcode-core.ts`
No user-facing text (only programmatic probe error codes consumed by routes/UI: "ffprobe-missing", "transcode-disabled", "ffprobe-spawn-failed", "probe-parse", "probe-timeout").

## `src/lib/harbor/types.ts`, `src/lib/harbor/vault.ts`, `src/lib/harbor/server-config.ts`, `src/lib/harbor/brand-asset.ts`, `src/lib/harbor/md3/apply.ts`, `src/lib/harbor/md3/color.ts`, `src/lib/harbor/md3/window-class.ts`
No user-facing text (see closing list for details).

## `mini-services/torrent-service/index.ts`
Stub file (`console.log("Hello via Bun!")`) — no user-facing text. All logic lives in `index.mjs`.

## `mini-services/torrent-service/index.mjs`
*JSON `error` fields reach the client via p2p.ts (`throw new Error(String(data.error))`) → player technical details / picker rows.*
- (api: error) "Invalid infoHash (expected 40-char v1 hex)" — /prepare 400
- (api: error) "Torrent engine is paused in Settings" — /prepare,/stream,/remux 503 (×3)
- (dynamic) `Could not join swarm: ${e.message}` — /prepare 500
- (api: error) "Torrent has no files" — /prepare 404
- (api: error) "Video conversion is disabled on this server (TRANSCODE_ENABLED)." — /remux?vtrans 503
- (api: error) "Remux busy — try again in a moment" — /remux 503
- (api: error) "torrent-not-active" — /status,/codec,/stream,/remux 404 `[code, surfaced raw]`
- (api: error) "file-not-found" — /codec 404 + probe report `[code, surfaced raw]`
- (api: error) "metadata-timeout" — prepare metadata wait `[code, surfaced raw]`
- (api: error) "read-error" / "tmp-error" / "ffprobe-missing" / "probe-parse" — codec-probe report codes `[internal]`
- (api: error) "not-found" (+ `path`) — 404 catch-all `[internal]`
- (dynamic) `internal` / upstream `e.message` — 500 handler fallback

## API routes (src/app/api/...)

### `/api/route.ts` (root)
- (api: message) "Hello, world!" — scaffold default `[internal]`

### `/api/tmdb`
- (api: error) "rate limited"
- (api: error) "invalid path"
- (dynamic) `error` + `configured` relayed from tmdb-server.ts (see lib section) — surfaced in search/detail degradation and Settings

### `/api/tmdb/validate`
- (api: error) "rate limited"
- (api: error) "invalid body" `[internal]`
- (api: error) "That doesn't look like a TMDB key. A v3 API key is 32 hex characters; a v4 Read Access Token starts with “ey”." — Settings live validation
- (api: error) "TMDB rejected this key (401 unauthorized)."
- (dynamic) `TMDB responded ${res.status}. Try again in a moment.`
- (api: error) "Validation timed out."
- (api: error) "Could not reach TMDB."

### `/api/stremio/login`
- (api: error) "invalid credentials format" — 400
- (dynamic) upstream `data.error.message` relayed verbatim — 401 (shown in account modal)
- (api: error) "login failed" — 401 fallback
- (api: error) "login request failed" — 502

### `/api/stremio/library`
- (api: error) "missing authKey" — 400 `[internal]`
- (api: error) "datastoreGet failed" — 401 (surfaces via account sync)
- (api: error) "missing changes" — 400 `[internal]`
- (api: error) "datastorePut failed" — 401
- (api: error) "library request failed" — 502

### `/api/stremio/addons`
- (api: error) "missing authKey" — 400 `[internal]`
- (api: error) "addonCollectionGet failed" — 401
- (api: error) "missing addons" — 400 `[internal]`
- (api: error) "addonCollectionSet failed" — 401
- (api: error) "addon collection request failed" — 502

### `/api/sync`
- (api: error) "invalid device id" (GET + POST)
- (api: error) "sync read failed" — GET 500 (cloud-sync error state → Settings)
- (api: error) "invalid JSON" — POST 400 `[internal]`
- (api: error) "snapshot too large" — POST 413
- (api: error) "sync write failed" — POST 500

### `/api/ai/search`
- (api: error) "missing query" — 400 `[internal]`
- (api: error) "no suggestions" — empty model answer (UI shows "no results" state)
- (api: error) "parse error" — model reply not JSON `[internal]`
- (dynamic) SDK `e.message` / fallback "ai error" — 500 `[internal]`
- (system prompt, not rendered to users) 'You are a movie and TV show recommendation engine inside a media center app. The user describes what they want to watch in natural language. Respond with ONLY a JSON array of 8-15 real movie or series titles (exact official titles, no years unless needed to disambiguate, no explanations). Example: ["Inception", "Breaking Bad", "Interstellar"]. Pick diverse, real, well-known titles that best match the request.' `[internal — LLM instruction, listed for reviewer awareness only]`

### `/api/anilist`
- (api: error) "invalid JSON" `[internal]`
- (api: error) "invalid query" `[internal]`
- (api: error) "query not allowed" `[internal]`
- (api: error) "anilist request failed" — 504 (client throws `anilist ${status}`)

### `/api/debrid/user`
- (api: error) "rate limited"
- (api: error) "invalid JSON" `[internal]`
- (api: error) "invalid service (realdebrid | alldebrid)"
- (api: error) "invalid API key (10-200 characters required)"
- (api: error) "Invalid Real-Debrid API key"
- (dynamic) `Real-Debrid responded ${status}`
- (api: error) "Real-Debrid returned no username"
- (api: error) "Invalid AllDebrid API key"
- (dynamic) `AllDebrid responded ${status}`
- (dynamic) `AllDebrid: ${message}` / fallbacks "rejected by AllDebrid", "upload rejected"
- (api: error) "AllDebrid returned no username"
- (dynamic) UpstreamError texts from debrid-server.ts (see lib section)
- (api: error) "debrid service unreachable" — 502 fallback

### `/api/debrid/resolve`
- (api: error) "rate limited"
- (api: error) "invalid JSON" `[internal]`
- (api: error) "invalid service (realdebrid | alldebrid)"
- (api: error) "invalid API key (10-200 characters required)"
- (api: error) "invalid infoHash (expected 40-char hex)"
- (api: error) "Invalid Real-Debrid API key" (×4 call sites)
- (dynamic) `Real-Debrid cache check failed (HTTP ${status})`
- (api: error) "Not cached on Real-Debrid — instant playback unavailable" (×2)
- (dynamic) `Real-Debrid addMagnet failed (HTTP ${status})`
- (dynamic) `Real-Debrid addMagnet returned no torrent id`
- (dynamic) `Real-Debrid torrent info failed (HTTP ${status})` (×2)
- (dynamic) `Real-Debrid no links produced — the torrent may still be downloading`
- (dynamic) `Real-Debrid no usable links produced`
- (dynamic) `Real-Debrid unrestrict failed (HTTP ${status})`
- (dynamic) `Real-Debrid unrestrict returned no download URL`
- (dynamic) `AllDebrid upload failed (HTTP ${status})`
- (dynamic) `AllDebrid: ${message}` / fallback "upload rejected"
- (api: error) "Invalid AllDebrid API key"
- (dynamic) `AllDebrid: upload returned no magnet id`
- (dynamic) `AllDebrid status failed (HTTP ${status})`
- (api: error) "AllDebrid: magnet not found"
- (api: error) "AllDebrid could not process this torrent (dead or unsupported)"
- (api: error) "AllDebrid is still processing this torrent — not ready yet. Try again shortly."
- (dynamic) `AllDebrid unlock failed (HTTP ${status})`
- (dynamic) `AllDebrid: ${message}` / fallback "unlock failed"
- (dynamic) UpstreamError texts from debrid-server.ts (see lib section)
- (api: error) "debrid service unreachable" — 502 fallback

### `/api/integrations/status`
No user-facing text (booleans only).

### `/api/media/sign`
- (api: error) "rate limited"
- (api: error) "invalid body" `[internal]`
- (api: error) "missing or oversized url"
- (api: error) "unsupported protocol" (+ `reason: "torrent-or-stream-protocol"`)
- (dynamic) `blocked: ${message}` (+ `reason: "blocked-host"`) — surfaced via playback.ts "signing failed" path
- (api: field) `host` — source host shown in the player technical-details panel (diagnostic value, not a literal)

### `/api/media/probe`
- (api: error) "rate limited"
- (api: error) "invalid body" `[internal]`
- (api: error) "missing url"
- (dynamic) `blocked: ${message}`
- (api: field) `durationVia` — diagnostic labels: "direct", "signed-invalid", `${via} (cached)`, `${via} blocked`, `${via} ffprobe`, `${via} (${probeError})` `[internal diagnostics]`

### `/api/media` (streaming proxy)
- (api: error) "invalid or expired signature" — 403
- (api: error) "transcode mode must be requested from /api/transcode" — 400
- (api: error) "upstream timeout" — 504
- (dynamic) `upstream failed: ${msg}` — 502
- (dynamic) `upstream status ${status}` — 403/404/502 relay
- (api: error) "manifest read failed" — 502
- (api: error) "too many active streams" — 503
- (api: error) "upstream has no body" — 502

### `/api/transcode`
- (api: error) "Conversion is disabled on this server (TRANSCODE_ENABLED)." (+ `reason: "transcode-disabled"`)
- (api: error) "invalid or expired signature" — 403
- (api: error) "All conversion slots are busy — try again shortly." (+ `reason: "transcode-busy"`)
- (dynamic) `Source is not reachable (HTTP ${status}).` (+ `reason: "upstream-status"`)
- (dynamic) `Source unreachable: ${msg}`
- (api: error) "ffmpeg could not be started on the host." (+ `reason: "ffmpeg-missing"`)
- (api: error) "ffmpeg produced no output" — 500

### `/api/proxy`
- (api: error) "response too large" — 413
- (dynamic) `invalid json from upstream` (+ `status`) — 502
- plus all proxy-core.ts guard errors (rate limited / missing url / invalid url / unsupported protocol / blocked: … / upstream timeout / upstream fetch failed)

### `/api/proxy/raw`
- (api: error) "response too large" — 413
- (api: error) "upstream read failed" — 502
- plus proxy-core.ts guard errors (as above)

### `/api/ratings`
- (api: error) "rate limited"
- (api: error) "title or imdb required" `[internal]`
- (api: error) "invalid imdb id" `[internal]`

### `/api/trakt/device-code`
- (api: error) "invalid JSON" `[internal]`
- (api: error) "Provide a valid Trakt client id (from trakt.tv/settings/applications)." — Settings BYO form
- (api: error) "Invalid client secret."
- plus trakt-server.ts guard/relay errors ("rate limited", "Trakt blocked this request (Cloudflare). If you self-host, check your server's egress IP.", "Trakt returned a non-JSON response", "upstream timeout", "trakt unreachable")

### `/api/trakt/device-token`
- (api: error) "invalid JSON" `[internal]`
- (api: error) "invalid client credentials" (×2)
- (api: error) "invalid device code"
- (api: error) "authorization_pending" / "slow_down" — synthesized pending markers `[internal, pattern-matched]`
- (api: error) "expired_token" — 410/404/409 mapping
- (api: error) "denied" — 418 mapping
- (api: error) "Device code is invalid or already used." — error_description for 404/409
- plus trakt-server.ts guard/relay errors

### `/api/trakt/me`
- (api: error) "invalid JSON" `[internal]`
- (api: error) "missing or invalid credentials" — 401
- plus trakt-server.ts guard/relay errors

### `/api/trakt/watchlist`
- (api: error) "invalid JSON" `[internal]`
- (api: error) "missing or invalid credentials" — 401
- (api: error) "token expired or revoked" — 401
- (fallback) "Unknown title" — normalized item name (see trakt-server.ts)
- plus trakt-server.ts guard/relay errors

### `/api/trakt/history`
- (api: error) "invalid JSON" `[internal]`
- (api: error) "missing or invalid credentials" — 401
- (api: error) "token expired or revoked" — 401
- (fallback) "Unknown title" / "Unknown show" — normalized item names (shown in history import)
- plus trakt-server.ts guard/relay errors

### `/api/trakt/push-watchlist`
- (api: error) "invalid JSON" `[internal]`
- (api: error) "missing or invalid credentials" — 401
- (api: error) "items must be an array" `[internal]`
- (api: error) "token expired or revoked" — 401
- (api: error) "Trakt request failed" — ≥400 fallback
- plus trakt-server.ts guard errors ("rate limited")

### `/api/trakt/scrobble`
- (api: error) "rate limited"
- (api: error) "invalid JSON" `[internal]`
- (api: error) "missing or invalid credentials"
- (api: error) "invalid action (start | pause | stop)"
- (api: error) "invalid progress (0-100)"
- (api: error) "invalid type (movie | episode)"
- (api: error) "invalid imdbId (expected tt<digits>)"
- (api: error) "invalid season" / "invalid episode"
- (api: error) "token expired or revoked" — 401
- (dynamic) `Trakt responded ${status}` — ≥400 fallback
- plus trakt-server.ts relay errors

### `/api/trakt/link/start`
- (api: error) "rate limited"
- (api: error) "Trakt linking is not configured on this server (missing TRAKT_CLIENT_ID)." (+ `configured: false`) — Integrations panel
- (dynamic) `Trakt responded ${status}` — 502
- (api: error) "upstream timeout" / "trakt unreachable" — 502
- GET returns `{ configured, pkceOnly }` booleans only

### `/api/trakt/link/poll`
- (api: error) "rate limited"
- (api: error) "invalid JSON" `[internal]`
- (api: error) "Trakt is not configured on this server." — 501
- (status values, no text): "pending" (+`retryInMs`,`slowDown`) / "authorized" / "expired" / "denied" `[internal states]`
- (dynamic) `error` / `error_description` relayed verbatim on failure (e.g. "Device code is invalid or already used.")
- (dynamic) `Trakt responded ${status}` — 502 fallback
- (api: error) "upstream timeout" / "trakt unreachable" — 502

### `/api/trakt/link/unlink`
- (api: error) "rate limited"
- (api: error) "invalid JSON" `[internal]`
- (api: note) "already unlinked" — idempotent note `[internal]`

### `/api/simkl/pin`
- (api: error) "invalid JSON" `[internal]`
- (api: error) "invalid client id"
- plus simkl-server.ts guard/relay errors ("rate limited", "Simkl returned a non-JSON response", "Simkl rejected the client id", "token expired or revoked", "upstream timeout", "Simkl unreachable"); upstream 412 `message` relayed verbatim (e.g. "Your client_id is wrong. Try another one")

### `/api/simkl/pin/poll`
- (api: error) "invalid JSON" `[internal]`
- (api: error) "invalid client id"
- (api: error) "invalid client secret"
- (api: error) "invalid device code"
- upstream 401 error bodies relayed verbatim (pinPoll mode; client pattern-matches "bad_verification_code"/"expired") `[internal]`
- plus simkl-server.ts guard/relay errors

### `/api/simkl/user`
- (api: error) "invalid JSON" `[internal]`
- (api: error) "missing or invalid credentials" — 401
- plus simkl-server.ts guard/relay errors

### `/api/simkl/watchlist`
- (api: error) "invalid JSON" `[internal]`
- (api: error) "missing or invalid credentials" — 401
- (fallback) "Unknown title" — normalized item name
- plus simkl-server.ts guard/relay errors

### `/api/simkl/history`
- (api: error) "invalid JSON" `[internal]`
- (api: error) "missing or invalid credentials" — 401
- (fallback) "Unknown title" / "Unknown show" — normalized item names
- plus simkl-server.ts guard/relay errors

### `/api/simkl/scrobble`
- (api: error) "rate limited"
- (api: error) "invalid JSON" `[internal]`
- (api: error) "missing or invalid credentials"
- (api: error) "invalid action (start | pause | stop)"
- (api: error) "invalid progress (0-100)"
- (api: error) "invalid type (movie | episode)"
- (api: error) "invalid imdbId (expected tt<digits>)"
- (api: error) "invalid season/episode"
- (api: error) "token expired or revoked" — 401
- plus simkl-server.ts relay errors

### `/api/simkl/link/start`
- (api: error) "rate limited"
- (api: error) "Simkl linking is not configured on this server (missing SIMKL_CLIENT_ID)." (+ `configured: false`) — Integrations panel
- (dynamic) `Simkl responded ${status}` — 502
- (api: error) "upstream timeout" / "simkl unreachable" — 502
- GET returns `{ configured }` boolean only

### `/api/simkl/link/poll`
- (api: error) "rate limited"
- (api: error) "invalid JSON" `[internal]`
- (api: error) "Simkl is not configured on this server." — 501
- (status values, no text): "pending" / "authorized" / "expired" / "denied" `[internal states]`
- (dynamic) `data.message` / `data.error` relayed verbatim — 502 fallback (e.g. Simkl envelope messages)
- (api: error) "upstream timeout" / "simkl unreachable" — 502

### `/api/simkl/link/unlink`
- (api: error) "rate limited"
- (api: error) "invalid JSON" `[internal]`
- (api: note) "already unlinked" `[internal]`

## Files with no user-facing text
`src/lib/harbor/`: store.ts, settings.ts, vault.ts, subtitle-manager.ts (console.warn only), link-resolve.ts, tvnav.ts, cw.ts, pwa.ts, types.ts, transcode-core.ts (programmatic codes only), server-config.ts, brand-asset.ts (SVG path data), md3/apply.ts, md3/color.ts, md3/window-class.ts · `mini-services/torrent-service/`: index.ts (stub) · `src/app/api/`: route.ts has only the scaffold "Hello, world!", integrations/status/route.ts and media/capabilities/route.ts return booleans only.

## Appendix: extraction notes
- Method: line-counted all 82 target files (39 assigned lib files + i18n.ts + auth.ts bonus, torrent-service index.ts/index.mjs, 39 API route.ts files), then ran ripgrep sweeps (`toast|message:|error:|label|title:|…`, quoted-capital patterns, template literals, `throw new Error(`) and deep-read every file with hits; zero-string files were verified by full read or targeted string grep rather than skipped blindly.
- `src/lib/harbor/i18n.ts` and `auth.ts` were not in the assigned list but are lib/harbor files that could otherwise fall between parallel agents; i18n.ts is the project's central EN/AR map so both languages are quoted verbatim above.
- Verbatim policy: template literals kept with their placeholders; punctuation/em-dashes/ellipses (`…`), arrows (`→` none in user text), and the curly quotes in the TMDB-validate message (“ey”) are preserved exactly. `×N` counts marked where identical literals repeat within a file.
- Surfacing rule: JSON `error` fields are included when a client path displays them (client stores set `error` state rendered in Settings/Integrations; player throws them into the technical-details panel; toast sources). Purely internal markers (`authorization_pending`, `slow_down`, trustFilter reasons, reason codes like "transcode-disabled") are kept but tagged `[internal]` because they are pattern-matched, not displayed.
- Excluded as instructed: console.* output (only logging), localStorage keys (`harbor-web.*`), event names (`harbor:data-changed`), URLs/User-Agent strings, CSS custom-property names, header names (X-Content-Duration etc.), regexes, and the AI system prompt is quoted once only as `[internal]` for reviewer awareness (never rendered).
- Bilingual note: only i18n.ts carries AR today; everything else in lib/API is EN-only, so translation review should treat this file's EN strings + all other sections as the EN source corpus. Proper nouns (theme/font names, provider labels like IMDb/Trakt/Simkl, technical badges like 4K/WEB-DL/HEVC) are flagged in-place as do-not-translate candidates.
# 4 · Project metadata, documentation & history

## 4.1 Project overview (derived from worklog)

**Horse** (formerly "Harbor Web") is an open-source, bilingual (EN primary / AR) media-center web client for the **Stremio addon protocol**, rebuilt from the MIT-licensed **Harbor** desktop app (Tauri 2 + React 19 + Rust) as a **Next.js 16 App Router** application (TypeScript, Tailwind 4, shadcn/ui, Prisma/SQLite). It ships no content of its own — users bring their own Stremio addons for catalogs, streams and subtitles.

- **Views**: home (hero carousel, continue-watching, Top 10, addon rails), discover/movies/shows/anime rails, catalogs with extras filter bar, infinite-scroll grid, detail pages, library (watchlist/history), calendar, custom lists, live TV (M3U+EPG), kids mode (age filters, PIN, curfew), addons manager, Wrapped stats, settings.
- **Playback**: HLS/MP4/fMP4/MKV via a robust pipeline — P2P torrent engine (`mini-services/torrent-service`, WebTorrent-based), debrid (Real-Debrid/AllDebrid BYO key), server transcode/remux ladder, signed media proxy, multi-language subtitles, real-time playback timeline with honest duration sources.
- **Integrations**: Stremio account cloud sync, Trakt (PKCE, history/scrobble/watchlist), Simkl (PIN link), AniList, TMDB enrichment, ratings adapters (Trakt/OMDb/MDBList), AI search.
- **UX**: Material Design 3 theming (OKLCH, presets + Theme Studio, shareable theme URLs), floating glass bottom dock navigation, command palette (Ctrl/Cmd+K), TV spatial navigation, floating search, PWA installable + offline shell.

## 4.2 Development history (condensed)

| Round / Task | What was done |
|---|---|
| Task 1 | Reverse-engineered Harbor desktop codebase via 4 explore agents (protocol · settings/kids · Rust backend · views/player) |
| Task 2–6 | Built Harbor Web — Next.js 16 port: Prisma schema, lib/harbor core, SSRF-safe proxy API, app shell + sidebar, all major views, player, themes |
| cron-round-2 | QA fixes (row dedupe, history flush) + Stremio account sync, Wrapped view, Top 10 row, PWA manifest |
| cron-round-3 | Calendar view, Theme Studio, TV spatial navigation |
| cron-round-4 | Prisma-backed cloud sync, AniList integration, PWA install prompt |
| cron-round-5 | Custom Lists, theme sharing via URL, Trakt integration, mobile layout fix |
| Task 6-a | Debrid integration (Real-Debrid/AllDebrid BYO key) + Trakt history import + scrobble |
| Task 6-b | Custom-list share links + app-wide styling polish |
| cron-round-6 | QA round consolidating debrid / Trakt / list-share work |
| cron-round-7 (ph.1) | Fixed all latent TypeScript errors blocking production build |
| Task 7-b | TV-nav picker polish + Wrapped empty-state redesign |
| cron-round-7 (ph.2) | Simkl integration, Trakt watchlist push, styling pass |
| Task 8-b | Command palette (VS Code style, Ctrl/Cmd+K + "/") |
| Task 8-a | Catalog filter bar (Stremio extras) in grid view + catalogs polish |
| cron-round-8 | QA; filter bar + palette shipped, accent-soft theme fix, catalog empty states |
| cron-round-9 | Universal content search in palette; Wrapped upgrade (365-day heatmap + achievements + share card) |
| cron-round-10 | Verified user's addon battery (Torrentio + 4 Arabic subtitle addons); subtitle pipeline fixes |
| cron-round-11 | Subtitle panel search, persisted addon probes, multi-language subtitle priority |
| cron-round-12 | P2P torrent engine (`mini-services/torrent-service`) — fixed "can't play anything" for uncached torrents |
| feat-round-13 | Duplicate-subtitle rendering fix; roadmap F2–F5 defined |
| feat-round-13b | Floating search + TMDB core |
| feat-round-14 | TMDB integration + activation-code linking + ratings adapters |
| cron-round-15 | ONE unified search bar, visible integrations strip, stale-SW heal |
| cron-round-16 | Trakt PKCE-only app linking activated with user's Client ID |
| cron-round-17 | Scroll UX cleanup (hide/reveal search bar) + Trakt "authorized but never detected" root-cause fix |
| m3-foundation | Material Design 3 migration audit + foundations |
| m3-3a | M3 adaptive navigation shell (compact bottom nav bar + drawer) |
| m3-round-complete | M3 steps 3–6: component migration, adaptive layout, a11y, verification |
| round-19 | Fixed rail carousel arrows position regression |
| round-20 | Navigation redesign — sidebar removed, floating glass bottom dock, Settings Quick Access |
| round-21 | Mobile Home top rebuild — full-bleed hero carousel + Continue Watching row (RTL-first) |
| round-21b | Hero logo enlarged + proportional scaling to all screens (`--home-scale` ladder) |
| round-22 | Glass dock sizing fix + floating search working on phones |
| Task 23 | Robust playback pipeline (streams failing in browser) + Kids page stray controls removed |
| Task 24 | **Rebrand to "Horse"** — galloping-horse logo everywhere, metadata/icons, SW cache v3→v4 |
| Task 25 | Real playback timeline — true elapsed/total/duration per stream class, new SeekBar + TimeDisplay |
| Task 26 | Detail-page hero reorder (logo → ratings → description → buttons) + `--details-content-offset` |

## 4.3 Known open issues (from worklog)

Unresolved items and risks surfaced in the final rounds (25–26) and standing candidates:

- **Detail-view sync flicker** (pre-existing, R26): detail view intermittently remounts to skeleton when periodic `/api/sync` changes the addons store identity — brief flicker every sync cycle; fix = memoize addons identity or gate the refetch.
- **TMDB logo branch unverified** (R26): with a TMDB key configured, the `tmdb.logo` img branch in the detail hero needs visual re-verification (sandbox has no key; only the `h1` text fallback was verified).
- **Live UI not built** (R25): static no-ENDLIST playlists still end in the error panel; a true live UI (LIVE badge, elapsed-only, no seekbar) is not implemented.
- **P2P remux restart-seek missing** (R25): `-ss` session restarts not implemented in torrent-service (clamped no-op; UI note updated honestly).
- **Browser coverage** (R25): Firefox/Safari/iOS/Android not testable in the sandbox (single headless Chromium); iOS soft-keyboard / Android back-gesture / notch insets verified structurally only (R21b).
- **Round-21b feature candidates still open**: hero "My List" quick action + Continue-Watching TMDB stills.
- **Environmental constraints** (recurring): real debrid keys and real Trakt/Simkl OAuth credentials can't be exercised in the sandbox (validation/error paths verified only); Cloudflare egress can block Trakt/RD from some server IPs; headless hover states can't be visually triggered.

## 4.4 App metadata (layout.tsx · manifest.ts)

### From `src/app/layout.tsx` (`export const metadata`)

| Field | Value |
|---|---|
| title | `Horse — A Stremio Client Built for Adventure` |
| description | `Horse is an open-source media center and client for the Stremio addon protocol. Bring your own addons: catalogs, streams, subtitles. A faithful web port of the Harbor desktop app.` |
| keywords | `Horse` · `Stremio` · `addon protocol` · `media center` · `streaming` · `open source` |
| authors | `{ name: "Horse" }` |
| robots | index: true, follow: true |
| icons.icon | `/favicon-64.png` (64×64 PNG) · `/icon.svg` (SVG) |
| icons.apple | `/apple-touch-icon.png` (180×180) |

Viewport: `width=device-width, initial-scale=1, viewportFit=cover, themeColor=#000000` (comment: hero is full-bleed under status bar in installed PWA mode; OLED black).

### From `src/app/manifest.ts` (`MetadataRoute.Manifest`)

| Field | Value |
|---|---|
| name | `Horse — Stremio Client` |
| short_name | `Horse` |
| description | `Open-source media center and client for the Stremio addon protocol. Bring your own addons: catalogs, streams, subtitles.` |
| start_url / display | `/` · `standalone` |
| background_color / theme_color | `#181a20` / `#181a20` |
| orientation | `any` |
| categories | `entertainment`, `video` |
| icons | `/icon.svg` (any) · `/icon-192.png` (192, any) · `/icon-512.png` (512, any) · `/icon-512.png` (512, maskable) |

## 4.5 PWA service worker & robots (public/sw.js · robots.txt)

### `public/sw.js` — user-visible strings

The service worker contains **no notification titles/bodies and no rich offline page** — its only user-visible output is the bare offline fallback response. Header banner (code comment):

> Horse — service worker
> Progressive enhancement: offline app shell + static asset caching.
> Never caches API responses (/api/*) or cross-origin media.

| Context | String |
|---|---|
| Offline navigation fallback (HTTP 503 response body) | `Offline` |

Behavior notes (not user-facing text): precaches `/`, `/manifest.webmanifest`, `/icon.svg`; cache-first for `/_next/static/*`, icon and manifest; network-first with cached-shell fallback for navigations; API responses and cross-origin media never cached. Cache name `harbor-web-v4` (rebrand assets — intentionally omitted per instructions).

### `public/robots.txt` — verbatim

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

### Other `public/` files checked

No `.well-known/` directory and no other `.txt` text-bearing files exist. Remaining files are binary/asset or QA fixtures only: `logo.svg`, `icon.svg`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `favicon-64.png`, plus playback QA fixtures `test-ac3.mkv` (binary) and `test-noendlist.m3u8` (HLS playlist fixture, not user-facing copy).

## 4.6 Documentation — torrent-service README (verbatim)

Source: `/home/z/my-project/mini-services/torrent-service/README.md`. Headings demoted two levels; content otherwise unchanged.

### torrent-service

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.3.14. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

## 4.7 Documentation — QA screenshots README (verbatim)

Source: `/home/z/my-project/download/README.md`. The file contains a single line with no headings:

> Here are all the generated files.

## 4.8 Database schema (prisma/schema.prisma)

SQLite datasource at `db/harbor.db`; generator `prisma-client-js`. Models (8) with their schema comments and one-line field summaries:

| Model | Schema comment | Fields (one-liner) |
|---|---|---|
| `Profile` | "Multi-profile support (mirrors Harbor's profiles system)" | id, name, color (default `#7dd3fc`), avatar?, isKid, kidAge?, pinHash? *(SHA-256 of parental PIN)*, curfewMin? *(daily minutes budget for kids)*, isPrimary, createdAt |
| `Addon` | "Installed Stremio addons per profile" | id (manifest id), transportUrl, name, version?, logo?, description?, background?, contactEmail?, types/catalogs/resources/idPrefixes/behaviorHints/flags (JSON strings), enabled, installedAt, profileId, order, probe fields (probeOk/probeResource/probeCount/probeMs/probeError/probedAt — "mirrors the client-side AddonRecord.probe"), updatedAt; unique(profileId, transportUrl) |
| `LibraryItem` | "Library items: watchlist bookmarks + continue-watching + watch history" | id (composite profileId+itemId), profileId, itemId *(e.g. tt1234567 or kitsu:123)*, type *(movie \| series \| other)*, name, poster?, background?, logo?, releaseInfo?, imdbRating?, state? *(JSON watch-progress blob)*, removed, temp, favorite, watched, lastWatched?, timestamps |
| `WatchEvent` | "Episode-level watch history" | id, profileId, itemId, videoId? *(tt:s:e for episodes)*, season?, episode?, position/duration (seconds), completed, createdAt |
| `CustomList` | "Custom user lists (\"My Lists\")" | id, profileId, name, items (JSON array, default `[]`), timestamps |
| `LinkedAccount` | "OAuth account links (Trakt / Simkl) — tokens encrypted at rest (AES-256-GCM, see src/lib/harbor/vault.ts). The browser only ever receives `id` (opaque)." | id, provider *(trakt \| simkl)*, accessTokenEnc, refreshTokenEnc?, expiresAt?, username?, avatar?, timestamps; unique(provider) |
| `AppSettings` | "App settings per profile (JSON blob, mirrors Harbor settings)" | profileId (PK), data (JSON settings blob), updatedAt |
| `ServerConfig` | "Server-wide key/value config (survives .env resets in sandboxed deploys). Used e.g. for TRAKT_CLIENT_ID fallback: env var wins, DB row is the backup." | key (PK), value, updatedAt |

Trailing schema comment (no model): "Cached catalogs/metas for performance (skipped in v1; in-memory LRU used instead)".

## 4.9 Appendix: file inventory

Recursive listing of source/text files (`.ts .tsx .css .js .mjs .prisma .md .txt .svg`), excluding `node_modules`, `.next`, `.git`, `db`, `download`, `upload`, `tool-results`, QA images. **Total: 191 files.**

### Counts by folder

- `src/components/` — 92 files (chrome 18 · harbor/common 3 · harbor/player 1 · harbor/views 22 · ui 48)
- `src/lib/` — 44 files (harbor core 39 · harbor/md3 3 · db.ts, utils.ts)
- `src/app/` — 43 files (root 4 · api routes 39)
- `mini-services/torrent-service/` — 3 files
- `src/hooks/` — 2 files
- `scripts/` — 2 files
- `prisma/` — 1 file
- `public/` — 4 files

### Full paths

**src/app (43)**
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

**src/components/ui (48, shadcn/ui primitives)**
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

**Root-level config & doc files (for completeness; not in the find scope)**
```
Caddyfile · components.json · eslint.config.mjs · next-env.d.ts · next.config.ts
package.json · postcss.config.mjs · tailwind.config.ts · tsconfig.json
website-content.md · worklog.md
```
Generated/other (not inventoried as source): `bun.lock`, `dev.log`, `tsconfig.tsbuildinfo`, `qa-r26-desktop.png`, `qa-r26-rtl-mobile.png`, `.extract/`, `agent-ctx/`, `examples/`, `skills/`, `tests/` (3 shell scripts, no matching text extensions), `db/`, `download/`, `upload/`, `tool-results/`.
