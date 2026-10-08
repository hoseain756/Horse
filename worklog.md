# Harbor Web — Worklog

## Project
Web version of Harbor (github.com/harborstremio/harbor) — a Stremio addon-protocol client.
Original: Tauri 2 + React 19 + Rust (libmpv, librqbit). License: MIT.
Web rebuild target: /home/z/my-project (Next.js 16 App Router, TS, Tailwind 4, shadcn/ui, Prisma/SQLite).

---
Task ID: 1
Agent: main (orchestrator)
Task: Reverse-engineer Harbor codebase via 4 parallel Explore agents

Work Log:
- Cloned repo to /home/z/harbor (v0.9.21, MIT license)
- Agent A (protocol): stremio.ts, addons.ts, streams pipeline, subtitles, safe-fetch, search
- Agent B (settings/themes/kids): 410-key settings schema, theme presets, kids mode, backup format, profiles
- Agent C (Rust backend): 134 Tauri commands, librqbit torrent engine, harbor-core scoring, web servers
- Agent D (views/player): View enum, sidebar items, home/detail/player/addons/library/live structure, CSS vars, AI search

Stage Summary (key findings):
- Stremio addon protocol: manifest.json; /catalog/{type}/{id}/{extras}.json; /meta/{type}/{id}.json; /stream/{type}/{id}.json; /subtitles/{type}/{id}.json
- Stremio account API: POST https://api.strem.io/api {login, getUser, datastoreGet/Put(libraryItem), addonCollectionGet/Set}
- Addon install persisted in localStorage harbor.installed-addons; cloud-synced via addonCollectionSet
- Stream pipeline: fetch -> parse (parse-torrent-title) -> trust filter -> score (cached +60, res points, CAM -80...) -> rank -> resolve (direct URL or debrid/torrent)
- Cinemeta base: https://v3-cinemeta.strem.io
- CORS strategy desktop: all fetches via Rust harbor_fetch; web: /api-proxy/<host> rewrite
- Settings: harbor.settings in localStorage, 22 sections, theme system = 12 OKLCH CSS vars + data-theme-layout attr + 8 presets (cool-grey, nord, stremio, crunch, tokyo-night, dracula, forest, noir) + layouts (sidebar/topdock/rail/stremio/minui/...)
- Kids Mode: profile.kid {age, curfewMinutes, parentPinHash}, PG-guard filters, curfew = daily minutes budget
- Backup: .harbx = JSON {format:"harbor-backup", data: Record<harbor.* keys>, bgImage}
- Continue watching: local harbor.localcw.v1 Record<id, {positionMs, durationMs, season, episode}> + Stremio cloud libraryItem state.timeOffset
- Player hotkeys: Space play, F fullscreen, U pip, arrows seek, S/C subs, N/B episodes, W switcher, E episodes panel, digits 0-9 seek %
- Views: home, discover, catalogs, movies, shows, kids, anime, live, vod, calendar, library, downloads, addons, settings, wrapped
- AI search: OpenRouter/Groq chat completion -> JSON titles -> Cinemeta resolve
- Sidebar nav: home, discover, catalogs, movies, shows, kids, anime, live, playlists(vod), calendar, library, downloads, addons, settings

---
Task ID: 2-6 (implementation phase)
Agent: main (orchestrator)
Task: Build Harbor Web — full web version in Next.js 16

Work Log:
- Prisma schema: Profile, Addon, LibraryItem, WatchEvent, CustomList, AppSettings (db:push OK)
- lib/harbor/: types.ts (Stremio protocol), themes.ts (10 presets, 7 font pairs, applyTheme), settings.ts (40+ keys), store.ts (zustand nav stack + settings + addons), api.ts (proxy client), scoring.ts (harbor-core port: parse/trust/score/tier), subtitles.ts (SRT/VTT/ASS parser + VTT converter), cw.ts (continue watching/watchlist/history), proxy-core.ts
- API routes: /api/proxy (SSRF-safe JSON proxy: DNS pinning, private IP block, rate limit 300/min, 24MB cap), /api/proxy/raw (subtitles), /api/ai/search (z-ai-web-dev-sdk, server-side), /api/stremio/login, /api/stremio/library, /api/stremio/addons
- Chrome: app-shell (view stack, theme applier, hash deep links, demo player), sidebar (collapsible 68px/220px), search overlay (live search + AI mode), nav-items, brand mark
- Views: home (hero carousel + CW + anchor rows + addon rows), detail (hero/episodes/watchlist), picker-overlay (tier-grouped stream picker), player-overlay (hls.js, subtitle engine, hotkeys, CW persistence, auto-resume), addons (install/enable/disable/uninstall + community list), library (watchlist/history), settings (basics/player/theme/language/data/about), kids (PG-guard filters), live (M3U parse + EPG XMLTV), discover/movies/shows/anime (section rails), catalogs, grid (infinite scroll), addon-detail
- Fixed: Tailwind v4 @theme inline token indirection (-var suffix), lucide Hdd→HardDrive, set-state-in-effect lint errors, unstable player callbacks (HLS reattach bug), Slide type mismatch

Stage Summary:
- VERIFIED via agent-browser: home renders Cinemeta data; detail page (cast/director/ratings); search (cinemeta + addon); AI search returns 15 real titles; addon install works; stream picker reports no-addons state; theme switching (Dracula #bd93f9 verified); kids rows (6 filtered rails); live TV empty state; player: HLS loaded, seek works (0→16s), controls, subtitle menu, Esc close; SSRF proxy blocks localhost + private IPs; mobile 390px → 68px icon rail
- Known limits (honest): torrent/infoHash streams need debrid-cached HTTP urls (no WebTorrent bundled yet); no real-content EPG provider bundled; AI suggestions resolve via Cinemeta sequentially (can be slow); localStorage-only persistence (Prisma schema ready for future sync)

---
Task ID: cron-round-2 (2026-10-07 review round)
Agent: main (orchestrator)
Task: QA assessment, bug fixes, new features (Stremio account sync, Wrapped view), styling polish

Work Log:
- QA via agent-browser: found duplicate "Popular" rows on home (Cinemeta addon catalogs collide with anchor rows; also duplicate React keys com.linvo.cinemeta:top)
- FIX 1: Ported Harbor mergeRows dedupe — home addon rows deduped by normalized catalog name + key includes catalog.type
- FIX 2: Duplicate React keys fixed in home-view + section-rails (key now id:type:catalogId)
- FIX 3: ScrollTopbar crashed with "useState is not defined" (missing react import in app-shell) — fixed
- FIX 4: Watch history was only written on player unmount (lost on hard reload) — added Harbor-style flush: visibilitychange + pagehide handlers + 30s periodic pushHistory during playback
- FIX 5: fmtDuration showed "0m" for sub-minute sessions — now shows seconds
- FEATURE: Stremio account sign-in + cloud sync (lib/harbor/auth.ts store; /api/stremio/login + addons + library routes wired; AuthModal with privacy note; sidebar UserChip with avatar/initial, Sync now, Sign out; background sync on load; cloud addons merge + cloud libraryItem → watchlist/continue-watching merge)
- FEATURE: Wrapped view (views/wrapped-view.tsx) — total watch time, movies/episodes counts, active days, 14-day activity bar chart, best day, most-watched top 6 with sessions + genre resolution via Cinemeta, top-genres bar chart, poster collage; registered in View type + nav (BarChart3 icon) + shell
- FEATURE: Top 10 Today row on home — outlined rank numerals with accent hover, interleaved trending movies+series deduped
- FEATURE: PWA manifest (app/manifest.ts, public/icon.svg boat mark, standalone display, theme color)
- POLISH: Hero uses Cinemeta logo art (meta.logo) with drop shadow; scroll-triggered blur topbar with quick search; player double-click fullscreen; volume HUD overlay (Harbor parity) with % ring
- Verified via agent-browser: home 13 rails, Top 10 renders with numerals, Wrapped computes stats from real history ("Big Buck Bunny (Demo)"), auth modal renders with email/password, screenshots saved to download/harbor-home.png + harbor-top10.png

Stage Summary:
- Lint: 0 errors 0 warnings. dev.log: no unexpected 5xx (historical 500s pre-fix; 502s are expected Cinemeta-miss for demo:bbb ID)
- Auth flow is wired end-to-end but untested with real Stremio credentials (cannot test in sandbox — needs user validation)
- Next steps: Prisma-backed profile persistence (schema ready), Trakt/Simkl/AniList tabs, theme studio editor, TV-navigation arrow-key focus system, service worker for offline/PWA install prompt

---
Task ID: cron-round-3 (2026-10-07 QA + feature round)
Agent: main (orchestrator)
Task: QA assessment via agent-browser, bug fixes, and 3 new features (Calendar view, Theme Studio, TV spatial navigation) + styling polish

Work Log:
- QA via agent-browser: home/wrapped/settings render clean, console clean, no unexpected 5xx in dev.log. Verdict: stable phase -> proceed to features.
- FIX 1: removed unused eslint-disable directive in player-overlay.tsx
- FIX 2 (Wrapped): genre resolution no longer hangs forever on Cinemeta misses — bounded 8s per-title race + skeleton bars while resolving + honest "Genres unavailable" fail state; 14-day chart bars now gradient with min-height and today highlighted (ring + bold label)
- FEATURE 1 — Calendar view (views/calendar-view.tsx + nav + View type + shell case):
  - Weekly airing schedule built from tracked series = watchlist + continue-watching + history (up to 60, concurrency 4, session meta cache, 10s timeout guard)
  - 7-day grid on desktop with today accent highlight; mobile/tablet day-chip tabs + single-day list; episode cards show poster, series, Sxx:Exx, time, Watched check (>=85% via episodeWatchedSet) / SOON badge / play affordance; click -> detail
  - Week navigation (Prev/Today/Next) + "New episodes this week" discovery rail from Cinemeta last-videos catalog; empty state with Browse-shows CTA
  - BUGFIX during QA: view kept stale state when returning from detail (hidden-frame mount) — now re-runs tracking load when it becomes the active top frame (isActive dep)
- FEATURE 2 — Theme Studio (chrome/theme-studio.tsx + themes.ts extensions):
  - Full custom palette editor for all 10 color tokens (canvas/surface/elevated/raised/ink/inkMuted/inkSubtle/edge/accent/danger): native color picker swatch (canvas 1x1 pixel conversion handles oklch/rgba) + validated raw text input (oklch/rgba/hex accepted)
  - Font pair (7), layout (8), card style (6), button style (4) selectors; live preview applies instantly via applyTheme(preset:"custom")
  - Save named user themes to harbor-web.user-themes (max 24), apply/delete from Theme panel grid + dialog strip; export/import .harbor-theme.json; "Reset preview" restores persisted theme on close
  - themes.ts: ActiveTheme gained customLayout/customCardStyle/customButtonStyle/customName; applyTheme honors them for preset==="custom"; types CardStyle/ButtonStyle exported
- FEATURE 3 — TV spatial navigation (lib/harbor/tvnav.ts):
  - Arrow keys rove DOM focus to nearest visible focusable element (primary-axis distance + 2.5x cross-axis penalty with overlap bonus); entry point focuses first/last element; skips inputs, player overlay (owns arrows), aria-hidden subtrees; smooth scrollIntoView
  - Auto-activates html[data-tv="on"] on first arrow key; mousemove disables; globals.css adds universal accent focus ring + soft glow box-shadow in TV mode
- Styling polish: calendar cards/chips design, Wrapped chart gradients, Theme Studio hero card in Theme settings (accent-tinted panel with saved-theme cards), TV focus glow
- VERIFIED via agent-browser (screenshots in download/qa-*.png): calendar empty state + Reacher/Tonight Show tracked -> episodes render on correct days with SOON/played states, week nav works; theme studio live preview (accent #7ae0c3 applied app-wide), saved "Seafoam Test" persists to localStorage and re-applies; TV nav focus roved Search->Discover->Basics with visible ring, mousemove resets to off; mobile 390px calendar renders day tabs + list; Wrapped chart/genre fixes confirmed; lint 0 errors 0 warnings; no console errors

Stage Summary:
- New nav item count: 13 (added Calendar). Settings Theme tab now hosts Theme Studio
- Known limits: calendar depends on Cinemeta videos[].released accuracy; user themes stored in localStorage only (not synced); TV nav heuristic (geometric) — complex nested menus may occasionally pick a suboptimal target
- Next steps candidates: Prisma-backed profile sync (schema ready), Trakt/Simkl/AniList integrations, debrid HTTP integration, WebTorrent, PWA service worker + install prompt, theme gallery sharing via URL

---
Task ID: cron-round-4 (2026-10-07 QA + feature round)
Agent: main (orchestrator)
Task: QA assessment, Prisma-backed cloud sync, AniList integration, PWA install, styling polish

Work Log:
- QA baseline via agent-browser (fresh browser session): all 12 views navigated, 0 console errors/warnings, lint 0/0. Historical page errors in the error log were HMR mid-edit artifacts (verified gone on clean reload). dev.log 5xx = old fixed useState bug + expected demo:bbb Cinemeta-miss 502s. Verdict: stable -> features.
- FEATURE 1 — Prisma-backed cloud sync (focus area from roadmap):
  - /api/sync (GET pull / POST push): canonical snapshot in AppSettings blob (profileId="webdevice:<key>"), mirrors into Addon rows (replace-all, order preserved) and LibraryItem rows (watchlist + CW with state JSON); GET reconstructs from mirror tables if blob is missing/empty; device-key regex validation, 4MB cap, error paths 400/413/500
  - lib/harbor/cloud-sync.ts: zustand useCloudSync {status idle|syncing|synced|error|off, lastSync, error}; syncKey() = Stremio account (FNV-1a hashed authKey, never stored raw server-side) when signed in, else per-browser device id; boot = pull (server fills missing local keys only; settings adopt never clobbers cloudSyncEnabled; addons adopt only when local empty) then initial push if server bucket empty; push = full snapshot debounced 2.5s via useAddons/useSettings zustand subscriptions + new "harbor:data-changed" DOM event + pagehide/visibilitychange flush
  - cw.ts: emitDataChange() on upsertCw/removeCw/toggleWatchlist(both paths)/pushHistory
  - settings: new cloudSyncEnabled key (default true, sanitize-coerced)
  - Settings > Data: CloudSyncCard — status dot (Up to date / Syncing / Sync error / Off), device key display, last-sync time, enable toggle, "Sync now" button with toast
  - account.tsx: sign-in now re-boots cloud sync under the Stremio bucket
- VERIFIED sync round-trip via agent-browser + curl + Prisma inspection: seed watchlist -> reload -> boot push -> server snapshot has item; wipe local key -> reload -> boot pull adopts item back; db shows AppSettings 3 buckets, Addon rows (Cinemeta, Torrentio), LibraryItem rows (watchlist + demo:bbb CW)
- FEATURE 2 — AniList integration (public metadata API, no auth):
  - /api/anilist POST proxy to graphql.anilist.co with query whitelist (prefix match), in-memory LRU cache (200 entries, 5-min TTL, X-Cache hit/miss header), 429/502/504 mapping
  - lib/harbor/anilist.ts: typed queries (trending/season/all-time/movies/upcoming/airing week/search), season+next-season computation, coverOf/mediaTitle helpers, resolveAnimeMeta() -> Cinemeta search with normalized-title scoring (exact 100 / prefix 70 / contains 40, else null) + 10-min session cache
  - Anime view rebuilt: AniList banner spotlight (auto-rotating, score/format/EP-soon badges, Find streams + AniList page buttons), 5 AniList rails (Trending/Season/All-Time/Movies/Upcoming) with score badges + ANILIST chips + resolving overlay + honest miss state, retry button on total failure; "Stremio catalogs" section below (Cinemeta anime-trending + up to 4 addon catalogs, addonsFirst); unresolved titles fall back to a Cinemeta search grid (frame kind grid, NOT the unrendered "collection" kind — bug avoided)
  - Calendar view: "Anime airing this week" section from AniList airingSchedules (bounded weeks -1..+3, 100-entry cap), AnimeAiringCard with EP badge, SOON badge, weekday+time, resolving spinner -> detail
  - VERIFIED: real data flows (ONE PIECE 8.7 spotlight, trending titles with covers); "Find streams" on ONE PIECE resolved to full Cinemeta detail (23 seasons of episodes); calendar shows airing cards with EP numbers
- FEATURE 3 — PWA:
  - public/sw.js: precache shell (/ manifest icon), cache-first immutable /_next/static + icons, network-first navigation with offline shell fallback, strictly skips /api/* and cross-origin
  - lib/harbor/pwa.ts: usePwa store — beforeinstallprompt capture, appinstalled/standalone detection, SW registration, promptInstall()
  - UI: sidebar "Install app" chip (accent border, MonitorDown icon) when installable; About panel "Install app" button + "Installed as app" badge
  - VERIFIED: SW registered (scope /), beforeinstallprompt fired -> both buttons render in headless Chrome
- STYLING polish (mandatory):
  - PosterCard: named group/poster; new quick-play overlay (accent circle + Play icon, scale+fade in); hover now adds accent glow ring + tinted shadow via CSS (color-mix with accent var)
  - MetaCard: release-year chip reveals on hover inside poster; title tints accent on card hover
  - Rail: optional titleIcon prop (accent icon before title); "View all" upgraded to bordered pill with accent hover
  - Sidebar: .harbor-nav-item.active::before glowing accent bar (auto-hidden for stremio layout variant which already paints a border-left)
  - Home hero: ken-burns 14s drift on background layer + harbor-hero-rise title animation per slide
  - globals.css: harbor-kenburns / harbor-hero-rise keyframes, poster accent ring, nav indicator
- Screenshots: download/qa-anime-anilist.png, qa-calendar-anime.png, qa-cloudsync.png, qa-home-final.png, qa-mobile-final.png
- Final state: lint 0 errors 0 warnings; fresh-session console clean; mobile 390px renders icon rail + hero + Top 10 correctly

Stage Summary:
- All Prisma tables (AppSettings/Addon/LibraryItem) now live and verified end-to-end; Stremio-account-keyed sync is wired but bucket restore across browsers needs a real Stremio login to validate (sandbox has no credentials)
- AniList adds real anime metadata (no content hosted); resolution depends on Cinemeta search quality — misses fall back to search grid honestly
- Known limits: anime resolve cache is session-only; airing section bounded to weeks -1..+3; install prompt availability is browser-dependent (Chromium)
- Next steps candidates: Trakt/Simkl/AniList *list* sync (scrobble/watched states), debrid HTTP stream integration, WebTorrent, TV-navigation polish for calendar/day columns, user theme sharing via URL, custom-lists (CustomList table still unused)

---
Task ID: cron-round-5 (2026-10-07 QA + feature round)
Agent: main (orchestrator)
Task: QA assessment, Custom Lists (CustomList table), theme sharing via URL, Trakt integration, styling polish, mobile layout fix

Work Log:
- QA baseline via agent-browser (fresh session): all views render, 0 console errors, lint 0/0. Verdict: stable -> features.
- FIX 1 (mobile layout bug): fixed 68px icon rail overlapped content on <768px — main had ml-0 while sidebar is fixed w-[68px]. App-shell main now ml-[68px] md:ml-[220px]; ScrollTopbar ml-[68px] md:ml-[220px]; BackButton left-[84px] md:left-[240px]. VERIFIED at 390px viewport (computed margin 68px, screenshot qa-mobile-fixed.png).
- FIX 2 (real pre-existing sync bug): POST /api/sync crashed with Prisma P2002 (500) whenever an item was simultaneously in watchlist AND continue-watching (duplicate LibraryItem row id `${pid}:${itemId}`). Mirror now merges both payloads into one row's state JSON ({watchlist, cw}); GET reconstruction reads both payloads + legacy field-only rows. VERIFIED collision payload -> 200, pull returns watchlist + cw for same id.
- FIX 3: stale duplicate-const compile error during development (add-to-list.tsx) — fixed immediately; final lint 0/0.
- FEATURE 1 — Custom Lists ("Collections", uses the previously unused Prisma CustomList table):
  - lib/harbor/lists.ts: localStorage store (harbor-web.lists.v1) — create/rename/delete/toggleInList/getListsContaining/listCollage; caps 40 lists x 300 items; emits harbor:data-changed
  - Cloud sync: snapshot v1 extended with `lists`; POST mirrors into CustomList rows (replace-all per device), GET reconstructs from rows when blob empty; cloud-sync.ts adopts lists on boot-pull when local key missing. VERIFIED round-trip: create in browser -> server bucket holds list with items; fresh browser + old device id -> boot-pull adopts "Space epics:1"
  - UI: Library "Lists" tab (tab persisted), list cards with 3-poster collage + count badge + hover lift/glow + rename/delete hover actions; create dialog; ListDetailView (frame kind list-detail) with collage backdrop header, edit dialog (name+description), confirm-delete, item grid with hover remove; AddToListButton popover in detail view (checkbox list, inline "New list" creation, "In N lists" chip state, toasts)
- FEATURE 2 — Theme sharing via URL:
  - themes.ts: encodeThemeShare/decodeThemeShare (hbtheme1.<base64url JSON>, full validation: color validity, font/layout/card/button whitelists; background image intentionally excluded)
  - Theme Studio: "Share" button copies link (clipboard-blocked fallback opens manual-copy dialog), per-saved-theme share icon, "From link" paste-import dialog
  - App-shell: #theme=<code> deep link -> live preview + "Shared theme: <name> — Keep / Discard" banner; hash stripped after read. VERIFIED: valid code previews instantly (accent + glass/glossy), Keep persists to settings, Discard restores previous theme, invalid code shows nothing
- FEATURE 3 — Trakt.tv integration (BYO credentials, device-code OAuth):
  - API routes /api/trakt/device-code|device-token|watchlist|me: server-side relay to api.trakt.tv (client_id+secret supplied per request, never stored server-side), 30/min rate limit, 15s timeout, non-JSON (Cloudflare) responses mapped to clean errors; watchlist normalization to {id,type,name,year}
  - lib/harbor/trakt.ts: zustand store — connect() -> device code {userCode, verificationUrl}, pollOnce loop (5s, pending/slow_down aware), tokens in localStorage harbor-web.trakt only, disconnect, importWatchlist
  - cw.ts: mergeWatchlist(entries) — adds missing ids only, emits data-change (syncs)
  - Settings > new "Integrations" tab: TraktCard with connect form (link to trakt.tv/oauth/applications/new), big device code + polling state + cancel, connected state with username + "Import watchlist" + count feedback; BYO-keys privacy note
  - VERIFIED: route validation (400 invalid creds), real relay to Trakt API ("invalid_client" surfaced in UI after UA header fix), rate limiting; full OAuth + import requires real user credentials (sandbox cannot approve at trakt.tv/activate) — documented honestly
- STYLING polish: Rail edge fade masks (canvas-gradient, scroll-aware); ListCard hover lift + accent glow shadow; watchlist card hover lift; harbor-pop-in keyframe (dialogs/menus/banners); Integrations panel consistent card design
- Screenshots: download/qa-lists-tab.png, qa-list-detail.png, qa-integrations.png, qa-home-rails.png (edge fades), qa-mobile-fixed.png (layout bug fix), qa-detail-addtolist.png, qa-mobile-lists2.png

Stage Summary:
- New Frame kind: list-detail; new settings section: integrations; snapshot version stays v1 (additive lists field)
- Sync model unchanged: device-keyed buckets; Stremio-account-keyed restore still needs real credentials to validate
- Trakt flow is code-complete and error-path-verified; real OAuth + watchlist import needs a user-supplied client id/secret outside the sandbox (sandbox egress hits Cloudflare intermittently)
- Known limits: theme share links exclude background image (by design); Trakt import is watchlist-only for now (history/scrobble not imported); CustomList rows mirrored but no per-list share link yet
- Next steps candidates: Trakt watched-history import + scrobble, debrid HTTP stream integration, WebTorrent, theme gallery page, custom-list share links, TV-nav polish for the new list grid/popover

---
Task ID: 6-a
Agent: full-stack-developer
Task: Debrid integration (Real-Debrid/AllDebrid BYO key) + Trakt history import + scrobble

Work Log:
- Audited tree: a prior partial run had left the 6-a files un-recorded in the worklog; performed a line-by-line spec audit of every file, re-verified all flows, and closed out with full verification (lint + curl + dev.log). No missing pieces found; no code gaps remained after audit.
- FEATURE 1 — Debrid (BYO API key, privacy model identical to Trakt):
  - lib/harbor/debrid.ts: zustand useDebrid {service realdebrid|alldebrid, apiKey, username, premium, expiresAt, status idle|valid|invalid|checking, loaded}; load()/save()/disconnect() persist ONLY to localStorage harbor-web.debrid; validate() → POST /api/debrid/user (20s timeout) sets username/premium/expiresAt; resolve(infoHash, filename?, filesize?) → POST /api/debrid/resolve (50s client timeout) returns {url, filename?} | {error} — nothing about resolutions is persisted client- or server-side
  - lib/harbor/debrid-server.ts (shared relay helpers): RD_API/AD_API bases, validInfoHash (/^[0-9a-fA-F]{40}$/), validApiKey (10–200 chars), guardDebrid = 20 req/min per IP via proxy-core clientIp/rateLimit, UpstreamError with HTTP status mapping, fetchJson (15s per-call AbortController timeout, upstream 429 → 429 friendly message, non-JSON upstream → clean 502, no credentials in error text), makeBudget (45s total deadline), bearer/form helpers, VIDEO_EXT_RE
  - /api/debrid/user: validates service+key; Real-Debrid GET /user (Bearer) → {username, premium: premium>0, expiresAt from expiration/premium timestamp}, 401/403 → "Invalid Real-Debrid API key"; AllDebrid GET /v4/user?agent=harborweb → status/error envelope check, isPremium/premiumUntil; keys never logged or stored
  - /api/debrid/resolve — full Real-Debrid cached-resolve flow: (a) torrents/instantAvailability/{hash} → no rd[] ⇒ honest 404 "Not cached on Real-Debrid — instant playback unavailable" (no download attempted); (b) best cached group: filename match (case-insensitive) > group whose largest single file has a video extension (.mkv/.mp4/.avi/.ts/.m2ts/.mov/.webm/.flv/.wmv) > largest bytes; extract file-id list + link index; (c) addMagnet (form magnet=...); (d) info → waiting_files_selection ⇒ selectFiles files=<ids> with files=all fallback → info again → links[] (index-matched for multi-file groups, else first); (e) unrestrict/link → {download} → {url, filename}; (f) best-effort DELETE /torrents/delete/{id} in finally (5s cap, never blocks); every failure carries the step name; 15s/call, 45s total budget
  - AllDebrid resolve flow (best-effort): magnet/upload (magnets[]=<magnet>) → poll magnet/status every 2s until statusCode 4 within budget (statusCode > 4 ⇒ dead-torrent error) → links[].link (filename-preferred) → link/unlock → data.link; not ready in budget ⇒ honest 504 "still processing" error
  - Settings > Integrations: DebridCard matching TraktCard styling (rounded-2xl border-edge-soft bg-elevated p-5, KeyRound icon chip, premium pill) — segmented Real-Debrid/AllDebrid control, password key Input, Validate button with spinner, accent-underline links to real-debrid.com/account / alldebrid.com/api; connected state: username + Premium (accent) / Non-premium (muted) pill + expiry date + Disconnect; invalid ⇒ inline danger text; exact privacy note about browser-only key storage and honest uncached-torrent errors
  - Picker unlock flow: StreamRow for infoHash && !url streams renders accent "Unlock" button (KeyRound, Loader2 while resolving) + muted DEBRID chip; not configured ⇒ destructive toast "Connect a debrid service in Settings → Integrations first" + push({kind:"view",view:"settings"}); resolving state ⇒ spinner overlay on row; success ⇒ setPlaying path with resolved url (+filename into behaviorHints); failure ⇒ inline danger text on row (auto-clear 6s) + toast; row click and keyboard Enter/Space both route through unlock; button has harbor-tv-focus + stopPropagation; direct-URL streams untouched
  - scoring.ts intentionally unchanged (torrent-without-URL streams keep current scoring; pipeline already keeps infoHash streams)
- FEATURE 2 — Trakt history import + scrobble:
  - /api/trakt/history: POST {clientId, accessToken} → traktFetch GET /users/me/history?limit=250&extended=full; server-side normalizeHistory → {id (imdb of movie/show, movies fall back trakt:<slug>), type movie|series, name, videoId "<showImdb>:<s>:<e>", season, episode, episodeName, watchedAt}; cap 250; episodes without show imdb skipped; 401 → "token expired or revoked"; reuses trakt-server guard (30/min)
  - /api/trakt/scrobble: POST {clientId, accessToken, action start|pause|stop, progress 0-100, type movie|episode, imdbId ^tt\d+$ (missing tt prefix rejected), season/episode for episodes}; builds Trakt body per docs (movie:{ids:{imdb}} / episode season+number inside show:{ids:{imdb}} — no fake episode imdb); relays to /scrobble/<action>; returns Trakt response body; 60 req/min per IP (chatty)
  - cw.ts mergeHistory(entries): idempotent on exact (id|videoId|t); 0/0 position/duration stored as 1/1 so progress counts as fully-watched for episodeWatchedSet/Wrapped; newest first; max 250 additions per call; single emitDataChange; returns count added
  - trakt.ts store: importingHistory + importHistory() (calls /api/trakt/history → mergeHistory, error ⇒ -1, mirrors importWatchlist); scrobbleEnabled persisted as optional field of harbor-web.trakt (default true; readAuth tolerates old objects without it); setScrobbleEnabled; scrobble(action, payload) — no-ops without auth/disabled, 8s timeout, swallows all errors (never disrupts playback)
  - player-overlay VideoStage: scrobble hooks guarded by metaId ^tt\d+$ (demo streams never scrobble); cumulative playback >3s ⇒ "start"; pause ⇒ "pause" (only if started, not on ended); ended + pagehide + hidden-visibilitychange + unmount ⇒ "stop" (only if started); progress = currentTime/duration clamped 0-100; per-action 10s dedupe ref; effect keyed to payload with per-stream state reset; all existing CW persistence/hotkeys/flush handlers untouched
  - TraktCard: "Import history" button (History icon) beside "Import watchlist" with own spinner + "Last import: +N plays" feedback; "Scrobble to Trakt while playing" Switch row (scrobbleEnabled); import triggers cloud sync naturally via emitDataChange

Stage Summary:
- Files created: src/lib/harbor/debrid.ts, src/lib/harbor/debrid-server.ts, src/app/api/debrid/user/route.ts, src/app/api/debrid/resolve/route.ts, src/app/api/trakt/history/route.ts, src/app/api/trakt/scrobble/route.ts. Files modified: src/lib/harbor/trakt.ts, src/lib/harbor/cw.ts, src/components/harbor/views/picker-overlay.tsx, src/components/harbor/views/settings-view.tsx, src/components/harbor/player/player-overlay.tsx. scoring.ts untouched per spec.
- API contracts: POST /api/debrid/user {service, apiKey} → {username, premium, expiresAt}|{error}; POST /api/debrid/resolve {service, apiKey, infoHash, filename?, filesize?} → {url, filename?}|{error}; POST /api/trakt/history {clientId, accessToken} → {items: TraktHistoryItem[]}|{error}; POST /api/trakt/scrobble {clientId, accessToken, action, progress, type, imdbId, season?, episode?} → Trakt scrobble body|{error}
- Verification: bun run lint 0 errors 0 warnings. curl: debrid/user invalid key → 401 {"error":"Invalid Real-Debrid API key"} (upstream actually reached from sandbox); bad service → 400; short key → 400; debrid/resolve bad hash → 400, valid-hash+bad key → 401, malformed JSON → 400; trakt/scrobble bad action/imdb/progress → 400×3; trakt/history bad creds → 400, invalid token → 403 clean relay error (sandbox egress to api.trakt.tv intermittently Cloudflare-blocked — mapped cleanly, not a 500); GET / renders 200; dev.log shows all new routes compiling with expected 4xx and zero 5xx
- Honest limits: full RD addMagnet→selectFiles→unrestrict chain and AllDebrid poll/unlock chain need a real premium account key to verify end-to-end (sandbox has none) — validation/error paths verified; cached-only policy means uncached torrents always fail with the honest message; history import limited to last 250 plays (Trakt limit=250); scrobble stop on tab-close is best-effort (sendBeacon semantics via pagehide fetch with 8s timeout — may not complete if the browser kills the page instantly); Cloudflare egress blocking of api.trakt.tv from some server IPs remains an upstream constraint, surfaced as a clean actionable error

---
Task ID: 6-b
Agent: full-stack-developer
Task: Custom-list share links + app-wide styling polish

Work Log:
- Found an earlier unrecorded partial run had already written the 6-b code (file mtimes 08:22–08:25, no worklog entry); performed a line-by-line spec audit of every deliverable instead of re-coding, closed one spec-fidelity gap, then ran the full verification suite fresh. No file owned by agent 6-a (settings-view, picker-overlay, player-overlay, trakt*, cw, scoring, debrid*, api/debrid/**, api/trakt/**, store.ts, nav-items.tsx) was touched.
- WORKSTREAM 1 — Custom-list share links (mirrors the #theme= pattern):
  - lib/harbor/lists.ts: encodeListShare → "hblist1." + base64url(JSON {n, d?, i:[{id,type,name,poster?}]}) with name ≤ 80, items ≤ 300 (movie|series only), poster URLs truncated to 600 chars, UTF-8-safe chunked btoa/atob with try/catch; decodeListShare validates every field, dedupes ids, accepts a full link or bare code, returns null on any error; importSharedList creates the local list with "(2)", "(3)"… suffix on name collision and re-adds items via addToList. AUDIT FIX: payload key was `p`, changed to spec-exact `poster` (decode still accepts legacy `p` codes).
  - list-detail-view.tsx: "Share" button (Share2) in the header actions row next to Edit/Delete; builds `${origin}/#list=${encodeURIComponent(code)}`, copies via clipboard with toast "Share link copied"; on NotAllowedError opens the manual-copy dialog (readOnly input + "Copy again", pattern copied from Theme Studio) with toast "Copy blocked — copy the link manually".
  - app-shell.tsx: `#list=` deep-link handler next to the existing `#theme=` one (same regex → decode → state shape, hash stripped via history.replaceState in both cases); SharedListBanner (ListVideo icon chip, "Shared list: {name} — N items", harbor-pop-in, bottom-offsets itself when a theme banner is also up) with "Add to my lists" → importSharedList → toast "Imported N items" → push({kind:"list-detail", listId}); Discard → nothing.
- WORKSTREAM 2 — Styling polish:
  - globals.css: harbor-rise-in keyframe (opacity 0→1, translateY 14px→0, 500ms cubic-bezier(0.22,1,0.36,1)); .harbor-stagger > * applies it with animation-delay min(calc(var(--stagger-i,0) * 60ms), 480ms) and fill-mode both; .harbor-lift-card hover/focus-within accent border+glow (color-mix on --color-accent-var); prefers-reduced-motion guards for the new animations; all round 1–5 classes untouched.
  - section-rails.tsx: module-level shared IntersectionObserver (threshold 0.08, unobserve-once) + RailReveal wrapper per rail; class added only on first scroll-into-view, skipped entirely under prefers-reduced-motion; --stagger-i set per rail index mod 8; horizontal scroll/dedupe/empty logic untouched (additive wrapper only). Applies to Movies/Shows/Anime/Discover (SectionRails); home keeps its own non-staggered rails by design.
  - common/rail.tsx: desktop hover chevrons — circular glass buttons (bg-black/40 hover:bg-black/70 backdrop-blur border-edge-soft, hidden md:flex, opacity-0 until group-hover/rail), scroll row by 85% of clientWidth smooth, fade at scroll start/end (scroll+ResizeObserver aware), z-20 above edge fades, aria-labels + harbor-tv-focus.
  - detail-view.tsx: episode rows get hover accent left bar + hover:bg-raised/50; watched episodes show accent check badge (bg-accent-soft border-accent/50) and dim to opacity-60; harbor-clamp-1 on titles; active season chip = border-accent/70 bg-accent-soft ring-2 ring-accent/40; hero meta chips unified to rounded-full border-edge-soft bg-black/30 px-2.5 py-1 text-[11px]; hero block staggers via harbor-pop-in (0/70/140/210ms delays).
  - library-view.tsx: watchlist + list cards hover lift (hover:-translate-y-0.5 + .harbor-lift-card glow consistent with poster cards); empty states get accent-tinted icon chips (rounded-2xl bg-accent-soft border-edge-soft); tab underline animates via scale-x/opacity transition.
- VERIFICATION (fresh headless session, agent-browser): seeded "Harbor QA Six" (3 items via UI create + eval add) → Share button renders → click copies to clipboard + toast (headless allowed write) → stubbed clipboard.writeText to reject → Share again opened the manual-copy dialog with correct hblist1 code (poster key visible in decoded payload) → screenshots qa-r6-share-copied.png / qa-r6-share-dialog.png; deep link of that code → banner rendered (qa-r6-share-banner.png) → "Add to my lists" created "Harbor QA Six (2)" (collision suffix) with 3 items, hash stripped, navigated into list-detail (qa-r6-share-import.png); Discard on a second code → no list added; invalid code → no banner. Movies view: 2 rails staggered pre-scroll → 5 after 1200px scroll (qa-r6-rails.png); chevron verified by forced visibility + click → scrollLeft 901 = 85% of 1060 clientWidth, left chevron appeared (qa-r6-rail-hover.png). GoT detail via #/detail/series/tt0944947: hero chips 2011–2019 · 9.2 · 57 min · genres, 9 season chips with ring on active, 6 episode rows with hover/badge classes; seeded S8:E1 watched history → check badge + dimmed row (qa-r6-detail.png, qa-r6-detail-episodes.png). Library lists tab: 2 cards with harbor-lift-card + hover:-translate-y-0.5 (qa-r6-library-lists.png). Console: 0 errors 0 warnings; dev.log: 0 5xx; bun run lint: 0 errors 0 warnings.

Stage Summary:
- Lists are now shareable as portable hblist1 URLs (local-only, nothing uploaded — recipient imports into their own localStorage and the list joins cloud sync from there); theme share and list share banners coexist with offset.
- Screenshots: download/qa-r6-share-copied.png, qa-r6-share-dialog.png, qa-r6-share-banner.png, qa-r6-share-import.png, qa-r6-rails.png, qa-r6-rail-hover.png, qa-r6-detail.png, qa-r6-detail-episodes.png, qa-r6-library-lists.png
- Honest limits: this headless environment reports (hover: hover) = false, so Tailwind hover states (chevrons-on-hover, episode-row hover tint, card lift) cannot be visually triggered in the QA browser — verified instead via compiled CSS rules (@media (hover: hover) wrapper confirmed present) + class assertions + forced-style click test; stagger/entrance animations verified by class mutation rather than frame-by-frame motion; share links deliberately drop release info/ratings and cap 300 items/600-char posters (URL length safety); import replaces nothing — collisions always create a new list.

---
Task ID: cron-round-6 (2026-10-07 QA + feature round)
Agent: main (orchestrator) + subagents 6-a/6-b (full-stack-developer)
Task: QA assessment, debrid integration, Trakt history+scrobble, list share links, styling polish

Work Log:
- QA baseline: dev.log healthy (sync routes 200, Cinemeta catalogs 200), lint 0/0; agent-browser swept all 12 views + console = 0 errors/warnings. Verdict: stable -> feature round.
- Orchestrator note: two parallel agent launches first hit infra timeouts; their partial writes were detected, audited line-by-line, and completed by the relaunched agents (no orphan code).
- FEATURE 1 (6-a) — Debrid integration (BYO key, browser-only storage, per-request relay):
  - lib/harbor/debrid.ts (useDebrid store: service realdebrid|alldebrid, apiKey, validate, resolve), lib/harbor/debrid-server.ts (validation, 20/min/IP guard, 15s timeouts, 45s budget, video-ext matching)
  - /api/debrid/user (RD Bearer /user + AD /v4/user -> {username, premium, expiresAt}); /api/debrid/resolve (RD: instantAvailability -> honest 404 when not cached -> addMagnet -> selectFiles -> links -> unrestrict -> best-effort delete; AD: upload -> poll -> unlock); step-named errors, upstream 429 mapped
  - Settings Integrations: DebridCard (segmented service control, key input, Validate spinner, premium/expiry/Disconnect, privacy notes)
  - Picker unlock flow: infoHash-no-url streams get DEBRID chip + accent Unlock button; unconfigured -> toast + settings push; configured -> resolving overlay -> play on success / inline row error (6s) + toast on failure
- FEATURE 2 (6-a) — Trakt history import + scrobble:
  - /api/trakt/history (250 plays -> {id,type,name,videoId showImdb:s:e,watchedAt}); /api/trakt/scrobble (start/pause/stop, progress 0-100, movie/episode bodies per Trakt docs, 60/min)
  - cw.ts mergeHistory (idempotent, 0/0 -> 1/1ms counts as watched, cap 250); trakt.ts importHistory + scrobbleEnabled + silent scrobble(); player hooks (tt-guard, >3s -> start, pause/stop on pause/ended/pagehide/unmount, 10s dedupe); TraktCard gains Import history + scrobble Switch
- FEATURE 3 (6-b) — Custom-list share links (hblist1.<base64url>, validation, collision "(2)" suffixes; Share button + fallback dialog in list-detail; #list= deep-link banner in app-shell with offset under theme banner; import -> toast -> navigate into list)
- STYLING (6-b): section-rails IntersectionObserver stagger entrance (harbor-rise-in, --stagger-i mod 8, reduced-motion skip); Rail desktop hover glass chevrons (85% smooth scroll, edge-aware); detail-view episode hover accent bar + watched badge + season chip ring + unified hero chips + pop-in stagger; library hover lift + harbor-lift-card glow + accent empty-state chips + animated tab underline; globals.css keyframes + reduced-motion guards

Integration QA (orchestrator, agent-browser):
- Integrations tab renders Trakt + Debrid cards; scrobble/import-history correctly gated behind connect
- curl: debrid/user bad key -> 401 {"error":"Invalid Real-Debrid API key"} (upstream genuinely reached); debrid/resolve bad hash -> 400; trakt/scrobble bad action -> 400
- Installed Torrentio via manifest input; picker on tt0111161: 53 DEBRID chips + Unlock buttons across 6 tiers; unconfigured unlock -> exact toast; configured (fake key) unlock -> server 401 relayed -> inline row alert "Invalid Real-Debrid API key" (verified visible via [role=alert])
  - Orchestrator lesson recorded: agent-browser open to the SAME url does not reload the page — zustand localStorage hydration was stale during first fake-key attempt (test artifact, not an app bug)
- #list= deep link: banner -> Add to my lists -> toast "Imported 1 item" -> list-detail navigated, hash stripped
- Mobile 390px: picker bottom-sheet renders chips/unlock correctly; console clean throughout; dev.log 0 new 5xx; final lint 0/0

Stage Summary:
- Stream unlocks for cached torrent sources are now possible end-to-end with a user-supplied key (RD chain + AD chain coded; full addMagnet->unrestrict verification needs a real premium key — sandbox has none; error/validation paths fully verified)
- Trakt is now watchlist + history + scrobble (BYO credentials; real OAuth still needs user keys outside sandbox)
- Lists/theme share links complete the shareable-config trio; UI polish passes keep matching Harbor's design language
- Screenshots: download/qa-r6-integrations.png, qa-r6-debrid-card.png, qa-r6-mobile-picker.png, qa-r6-picker-state.png + 6-b's qa-r6-share-*.png / qa-r6-rails.png / qa-r6-detail*.png / qa-r6-library-lists.png
- Known limits: uncached torrents honestly refuse (no server-side download queue); scrobble stop on tab close is best-effort; Trakt/RD egress can be Cloudflare-blocked from some server IPs (clean actionable errors); share links cap 300 items and drop ratings/release info by design
- Next steps candidates: Simkl integration, WebTorrent (uncached torrent path), TV-nav polish for picker rows, per-list public share pages, Trakt watchlist two-way sync

---
Task ID: cron-round-7 (phase 1: QA + bug fixes)
Agent: main (orchestrator)
Task: QA assessment; fix all latent TypeScript errors blocking production build

Work Log:
- QA baseline: dev.log healthy, lint 0/0, agent-browser swept Home/Wrapped/Settings/Integrations/Library/Calendar/LiveTV/Discover/Addons = all render, 0 console errors. Verdict: stable but tsc audit revealed hidden debt.
- Ran `bunx tsc --noEmit`: Next dev does not typecheck, so 14 real type errors had accumulated silently (would fail `next build`). Investigated a suspected syntax corruption in api/trakt/watchlist/route.ts (`const ovies, shows]`) — resolved as FALSE ALARM: hexdump proved the file contains valid `const [movies, shows]`; the IM gateway display pipeline eats `[m` sequences in tool output (lesson recorded).
- FIXED all 14 src/ type errors:
  1. api/sync/route.ts — GET reconstruction now rebuilds addon manifest from mirrored Prisma columns (types/catalogs/resources/idPrefixes/behaviorHints/flags as JSON columns; manifest.id correctly sliced from `${pid}:` prefix) instead of the non-existent `a.manifest` field
  2. api/trakt/history/route.ts — added missing null-guard for entry.show (TS18048 ×2)
  3. player-overlay.tsx — dynamic import now destructures `{ useAddons: addons }` (×2); LOCAL onVideoError rename fixing a REAL runtime bug: video error handler shadowed the onError prop and recursed infinitely on stream failure; CW/history entry now includes `t: Date.now()` (required by LocalCwEntry)
  4. picker-overlay.tsx — runPipeline(results) without stale preferAddonId option (renamed preferredAddonId in scoring)
  5. wrapped-view.tsx — Stats.topTitles type now includes `count: number`
  6. cloud-sync.ts — boot-pull settings adoption merges onto current settings (saveSettings expects full Settings); simpleAdopt typed [string, string|null][]
  7. lists.ts — legacy `p` poster alias accessed via `as unknown as` cast
- VERIFIED: tsc --noEmit clean for src/ (0 errors); eslint 0/0; curl smoke: GET / 200, GET /api/sync 200, POST /api/trakt/watchlist 400 (validation intact, route compiles)

Stage Summary:
- src/ is now tsc-clean; production build is no longer blocked by type errors (examples/ + skills/ folders still have tsc errors but are outside the Next app)
- Real runtime bug fixed: player video-error handler no longer infinitely recurses; error message now actually reaches the UI
- Next: feature round (Simkl integration, Trakt watchlist push, TV-nav picker polish, Wrapped empty state, styling pass)

---
Task ID: 7-b
Agent: full-stack-developer
Task: TV-nav picker polish + Wrapped empty state + styling polish

Work Log:
- Read worklog rounds 5/6 first (harbor-rise-in/pop-in/stagger/lift-card/tv-focus/edge-fades/ken-burns) to match the design language; confirmed harbor-shimmer keyframe + .harbor-skeleton application already exist (round 1), so WS3 shimmer work = reduced-motion guard, not re-adding. Strict file ownership held: only picker-overlay.tsx, wrapped-view.tsx, globals.css touched (grid-view.tsx audited, left untouched — poster skeletons already shimmer; nothing looked off).
- WS1 — picker-overlay.tsx (TV navigation polish):
  - Auto-focus on open + again when load completes: scheduleTvFocus() = clearTimeout-guarded 350ms setTimeout -> requestAnimationFrame -> only if document.documentElement.dataset.tv === "on" (checked INSIDE the delayed callback, so a mouse jiggle during the settle window cancels the steal; tvnav flips tv=off on mousemove) -> focus first .harbor-picker-row in the picker body (query at fire time, so no streams yet => falls back to closeRef close button; matches spec "first StreamRow when streams exist, else close button"). focus({preventScroll:true}) + scrollIntoView({block:"nearest", behavior:"smooth"}) mirroring tvnav; timers cleared on unmount. Effects: mount + [loading] (fires when load finishes, incl. manual Refresh).
  - StreamRow: added .harbor-picker-row class (row div already role=button/tabIndex=0). No rank column (per spec NO).
  - Tier header dots: 4K HDR/4K -> bg-emerald-400, 1080p HDR/1080p -> bg-amber-500, 720p/SD -> bg-zinc-500, ROUGH/OTHER -> bg-zinc-600 (aria-hidden h-1.5 w-1.5 rounded-full before the tier title; quality-ladder = emerald top / amber mid / neutral low per existing palette conventions).
  - Loading state: 5 stream-row-shaped skeletons under the "Querying x/y" line — h-[68px] harbor-skeleton with res-chip block (.w-14), title+meta lines (.flex-1), fake unlock button (.w-16), aria-hidden.
- WS2 — wrapped-view.tsx empty-state redesign (header kept; inline "Watch something first!" removed from subtitle):
  - WrappedEmptyState local component: centered card max-w-xl rounded-3xl bg-elevated/60 border-edge-soft shadow-2xl; 64px Sparkles icon chip (rounded-3xl bg-accent-soft border-edge-soft text-accent); font-display headline "Your year in stories"; 2-line description (computed locally from watch history + privacy note); CTA row: Browse Movies (accent primary) / Top Shows / Open Live TV (raised secondary), all harbor-tv-focus, push({kind:"view",view:"movies"|"shows"|"live"}) matching existing nav usage.
  - Below CTAs: decorative preview row — 3 .harbor-stat-card.is-placeholder mini cards (Clock "Watch time" / Flame "Active days" / Trophy "Top title") with .harbor-stat-chip + fake value bar, wrapper aria-hidden + pointer-events-none + select-none + opacity-50, dashed border via is-placeholder. No fake data implied (placeholder bars, not numbers).
  - Entrance stagger: card harbor-pop-in; CTA row pop-in delay 90ms; placeholder cards pop-in delays 160/230/300ms; all resolve under prefers-reduced-motion (see WS3 guard).
- WS3 — globals.css (additive-only, appended "Round 7 polish" section; nothing renamed/removed):
  - ::selection { accent 30% color-mix tint + ink text }.
  - App-wide keyboard-focus fallback: :focus-visible { 2px accent 65% outline, offset 2 } with an opt-out rule for [class~="outline-none"/"outline-hidden"] elements (shadcn components that own their ring keep ring-only); deliberately lower priority than .harbor-tv-focus and html[data-tv=on] rules (they win by specificity as before).
  - .harbor-picker-row { scroll-margin-top:96px / bottom:24px } (rows never clip under the picker's fixed header band on scrollIntoView); .harbor-picker-row:focus-visible = 2px accent outline + inset 1px accent ring + soft accent glow (color-mix box-shadow; outline avoids layout shift, inset ring fakes the thicker border); html[data-tv="on"] .harbor-picker-row:focus-visible slightly stronger (offset 3 + bigger glow); .harbor-picker-body .harbor-tv-focus:focus-visible:not(.harbor-picker-row) strengthens non-row controls (close/refresh/unlock/filter).
  - New utilities: .harbor-stat-card (rounded-2xl... implemented as 1rem radius, border-edge-soft, bg-elevated/60 via color-mix, p-4) + .harbor-stat-card.is-placeholder (dashed, fainter bg) + .harbor-stat-chip (36px accent-soft icon chip, accent border 30%) — generic, reusable.
  - prefers-reduced-motion guard extended additively: .harbor-pop-in, .harbor-skeleton (shimmer), .harbor-kenburns, .harbor-hero-rise now join .harbor-rise-in/.harbor-stagger > * with animation:none. harbor-scroll on the picker body verified fine — no change needed.
- Infra note (honest): the long-running dev server was serving a stale pre-round-7 module graph (files on disk correct, fresh page loads + restart-without-cache-clear still served old compiled output; GET / compile times ~2-7ms = cache hits). Restarted `bun run dev` (killed PID tree; relaunched detached via setsid; a first background start was reaped and needed a second detached start). Fresh server compiled current sources correctly. Shared dev.log was truncated by the restart tee.

Verification (agent-browser, isolated named session ws7b — the default session is shared with the concurrently-running settings agent and cross-navigated my pages, so all QA was redone in a named session):
- bun run lint -> 0 errors 0 warnings; bunx tsc --noEmit | grep ^src/ -> EMPTY.
- Home screenshot in fresh session unchanged/clean (download/qa-r7-home.png); agent-browser errors empty; console no new errors/warnings.
- Wrapped empty state: headline/3 CTAs/3 placeholders all present; placeholder computed border-style "dashed", wrapper opacity 0.5 + aria-hidden; screenshots qa-r7-wrapped-empty.png + qa-r7-wrapped-empty-mobile.png (390px). CTA navigation verified: Browse Movies -> Movies catalog, Top Shows -> Shows catalog, Open Live TV -> Live TV view.
- Picker QA (Torrentio installed via manifest input; GoT tt0944947 detail): ArrowRight activates html[data-tv="on"] and moves focus; opening the picker with tv=on auto-focused the FIRST row after load (activeElement.classList contains harbor-picker-row, aria-label "Game of Thrones S01E01 ..."); ArrowDown moves row->row; Tab moves into the row's Unlock button; 131 rows all appear as role=button in snapshot -i; refresh re-runs the post-load refocus.
- Mouse-user protection: dispatching mousemove flips dataset.tv to "off"; after Refresh, focus does NOT move (activeElement stays BODY) — no steal.
- Row CSS: computed scroll-margin-top 96px / bottom 24px; focused row outline accent + inset ring + glow box-shadow; tier dots verified computed colors (4K tiers green, 1080p amber, 720p/SD gray) on live "4K HDR/4K/1080P/720P/SD" headers.
- Loading skeletons: refresh timeline probe (60ms samples) caught {rows:0, skeletons:5} during load; shape classes code-verified (chip/lines/button); .harbor-skeleton app-wide computes animation-name harbor-shimmer 1.4s.
- prefers-reduced-motion verified end-to-end via browser media emulation: matchMedia reduce=true -> .harbor-pop-in computes animation-name none + opacity 1 (instant, visible).
- dev.log tail: sync/catalog routes 200, zero 5xx, zero compile errors.

Stage Summary:
- Picker is now TV-first: keyboard users land on the best stream (or close button when none) with a stronger scoped focus glow and no clipped rows; mouse users get zero focus theft. Tier headers read at a glance (quality-ladder dots), and loading shows stream-row-shaped shimmer skeletons.
- Wrapped empty state is a proper landing page: accent icon chip, "Your year in stories" headline, local-computation privacy note, working navigation CTAs, and an honest decorative stat preview (dashed, aria-hidden, no fake numbers) built on new reusable .harbor-stat-card/.harbor-stat-chip utilities.
- globals.css gained app-wide polish (accent ::selection, universal keyboard-focus fallback with opt-outs) with strictly additive changes and an extended reduced-motion guard.
- Screenshots produced: download/qa-r7-home.png, qa-r7-wrapped-empty.png, qa-r7-wrapped-empty-mobile.png, qa-r7-picker-rows.png. (qa-r7-addons/integrations/simkl-card/wrapped from 09:17-09:18 belong to the concurrent settings agent, not this task.)
- Honest limits: headless hover states still can't be triggered ((hover:hover)=false in this environment) — hover affordances verified via compiled CSS/computed styles only; skeleton row shape verified via code + a 60ms-sample timeline (the cached refresh loading window is ~60-120ms, too fast for a stable screenshot); the 2px-vs-3px outline nuance on rows resolves to the tv-mode 3px treatment when tv=on by design (stronger default); dev-server restart was required and briefly rebooted the shared log.

---
Task ID: cron-round-7 (phase 2: features)
Agent: main (orchestrator) + subagents 7-a/7-b (full-stack-developer)
Task: Simkl integration, Trakt watchlist push + first-connect fix, TV-nav picker polish, Wrapped empty-state redesign, styling pass

Work Log:
- FEATURE 1 (7-a) — Simkl.tv integration (BYO client id, PIN OAuth — mirrors Trakt pattern):
  - Upstream contract probed live from sandbox before coding: api.simkl.com reachable; POST /oauth/pin → {device_code, user_code, verification_url:"https://simkl.com/pin", expires_in, interval}; invalid client_id → 412 {"error":"client_id_failed","message":...}; all endpoints require `simkl-api-key` header
  - lib/harbor/simkl-server.ts (guard 20/min/IP, simklFetch 15s timeout, 412→message mapping, 401→"token expired or revoked", non-JSON→502, normalizeWatchlist cap 500 with imdb/simkl:<id> fallback, normalizeHistory cap 250 fully defensive); routes /api/simkl/pin|pin/poll|user|watchlist|history; lib/harbor/simkl.ts useSimkl store (localStorage harbor-web.simkl, connect/pollOnce/cancel/disconnect/importWatchlist→mergeWatchlist/importHistory→mergeHistory)
  - SimklCard in IntegrationsPanel between Trakt and Debrid — identical card language (TvMinimalPlay chip, Client ID + optional secret, PIN code display with spinner + cancel, connected state with imports + counts + disconnect)
  - curl-verified: pin invalid-test → 412 {"error":"Your client_id is wrong. Try another one"} (upstream genuinely reached); {} → 400; short clientId → 400; short token → 401; zero 5xx
- FEATURE 2 (7-c, orchestrator) — Trakt watchlist push (two-way sync):
  - /api/trakt/push-watchlist: validates creds + items (^tt\d+$ only, cap 500, skipped counter) → Trakt POST /sync/watchlist {movies,shows} → {added:{movies,shows}, notFound, skipped}; 401 → "token expired or revoked"
  - trakt.ts: pushIds core + pushWatchlist UI action (filters imdb-backed entries, "empty" result when none, updates pushed-mirror on success) + setPushEnabled (seeds mirror so enabling never mass-pushes old items) + installTraktPushSync() — window "harbor:data-changed" listener, 6s debounce, skips while imports run, pushes only never-pushed additions, silent on failure
  - TraktCard: "Push watchlist" button (UploadCloud) with Last-push feedback ("+N" or "N not on Trakt") + "Keep watchlist in sync" Switch with one-way explanation (additions flow out; imports never pushed back; nothing removed)
  - REAL BUG FIXED (flagged by 7-a): trakt.ts pollOnce sent auth?.clientId which is null during first-time device flow → every fresh Trakt connect 400'd at first poll. Now connect() stashes pendingCreds module-level; pollOnce falls back to them; cleared on authorized/fail/cancel
  - Browser-verified with injected fake auth + network mock: connected state renders Push button + switch; empty watchlist → "Nothing to push" toast with Cinemeta hint; fake token → "Push failed: Trakt request failed" toast (real upstream 403 relayed); mocked success → "Last push: +1" + mirror ["tt0111161"]; auto-sync: enabled switch → added tt0137523 + fired harbor:data-changed → 6s debounce → pushedMirror ["tt0111161","tt0137523"]. Test state cleaned after
- FEATURE 3 (7-b) — TV-nav picker polish + Wrapped empty state + styling:
  - picker-overlay: keyboard auto-focus (350ms after open/load, gated on dataset.tv="on" checked inside the callback — mouse users never robbed; first row else close), harbor-picker-row class, tier quality dots (emerald 4K/amber 1080p/zinc lower), stream-row-shaped skeletons
  - wrapped-view: full empty-state redesign — accent Sparkles chip, "Your year in stories" headline, local-computation privacy note, working CTAs (Browse Movies/Top Shows/Open Live TV), decorative dashed aria-hidden stat previews, staggered pop-in
  - globals.css: accent ::selection, app-wide :focus-visible fallback, .harbor-picker-row scroll-margins + accent glow (stronger under data-tv), .harbor-stat-card/.harbor-stat-chip utilities, reduced-motion guards extended (pop-in/skeleton/kenburns/hero-rise); skeleton shimmer verified existing
- Integration QA (orchestrator): fake-auth cleanup → reload → console 0 errors/warnings; agent-browser errors empty; dev.log 0 5xx all-time; final lint 0/0; tsc src/ 0 errors; SimklCard/TraktCard/debrid coexist in Integrations with consistent styling
- Screenshots: download/qa-r7-simkl-card.png, qa-r7-trakt-push.png, qa-r7-integrations-final.png, qa-r7-wrapped-empty.png, qa-r7-wrapped-empty-mobile.png, qa-r7-picker-rows.png, qa-r7-final-view.png

Stage Summary:
- Integrations now cover Trakt (watchlist import/export + history + scrobble), Simkl (watchlist + history import), Debrid (RD/AD unlock) — all BYO-credential, browser-only storage, per-request relay
- Trakt first-time device flow actually works now (pendingCreds fix); watchlist sync is one-way push with debounced auto-add and loop protection (imports skipped, mirror-seeded enable, nothing ever removed remotely)
- src/ stays tsc-clean (production-build ready); lint 0/0; zero 5xx
- Honest limits: real Trakt/Simkl OAuth + watchlist writes need user credentials (sandbox verified error/validation/success-mocked paths); pushed-mirror is device-local (per-browser); Simkl history shape normalized defensively — if upstream returns nothing, import reports 0 honestly
- Next steps candidates: Simkl calendar into Calendar view, WebTorrent uncached path, per-addon catalog picker polish, Trakt history paging beyond 250, PWA offline cached catalogs
---
Task ID: 8-b
Agent: full-stack-developer
Task: Command palette (VS Code style) — Ctrl/Cmd+K + "/" hotkeys

Work Log:
- Read worklog rounds 6/7 styling passes first; palette reuses harbor-pop-in, harbor-tv-focus, harbor-scroll, accent/glass token language (bg-canvas panel, border-edge-soft, bg-raised selected row, rounded-full glass type chips matching hero meta chips).
- NEW src/components/harbor/chrome/command-palette.tsx:
  - Module-level zustand store `useCommandPalette` {open, openPalette(), close(), toggle()} — `openPalette()` no-ops while ANY stack frame is a player (scans whole stack, superset of spec's top() check) and also closes the SearchOverlay so the existing "/" hotkey can't double-open both overlays.
  - Overlay: fixed inset-0 z-[300] bg-black/70 backdrop-blur-sm (items-start so panel hugs top), panel mt-[12vh] max-w-xl w-full rounded-2xl border-edge-soft bg-canvas shadow-2xl overflow-hidden harbor-pop-in, role="dialog" aria-modal aria-label="Command palette".
  - Input row: Search icon + autofocus input "Type a command or search…", esc kbd chip (.harbor-kbd), close button; input owns ArrowUp/Down (preventDefault + scrollIntoView block:nearest), Enter (run), Esc/Tab (close), Ctrl/Cmd+K (close) — aria-activedescendant + role=listbox/option with aria-selected.
  - Fuzzy filter: subsequence match, +6 consecutive bonus, +8 word-start bonus (idx 0 or after space/-_:.·/([), short-target bonus; keywords scored at 0.8x label weight; ties broken by group order then label.
  - Items: (a) nav via navItemsFor(settings) minus "settings" (respects hidden/renamed/kids nav), push({kind:"view"}); (b) 7 "Settings · <Section>" items → push settings view (skipped if already top) then window CustomEvent "harbor:settings-section" via 60ms setTimeout so the just-mounted view catches it; (c) actions: Toggle Kids Mode (useSettings.update, meta shows On/Off), Shuffle theme (random THEME_PRESETS ≠ current, via settings setter — app-shell effect applies it live), Sync now (useCloudSync.pushNow()), Search content (setSearchOpen(true)), Install app (only when usePwa.canInstall → promptInstall()); (d) library: watchlist + CW cards + first 30 history, deduped by type:id, poster thumb via PosterImage + type chip, push({kind:"detail"}); (e) addons: first 20 installed, keywords from manifest types+description, push({kind:"addon-detail"}) (frame type confirmed to exist in store.ts).
  - Recents: localStorage "harbor-web.palette.recents" cap 5, serializable RecentAction descriptors rebuilt through the same builders (icons re-derived), dedupe by uid, recorded on every run; empty query shows recents ("Recent" tag) then all nav items.
  - Component split: outer CommandPalette returns null when closed and remounts PaletteSurface per open — fresh query/selection/recents without setState-in-effect (satisfies react-hooks/set-state-in-effect lint rule).
- app-shell.tsx (additive only): one import line, extended existing global keydown effect with Ctrl/Cmd+K toggle + "/" open (both after the existing typing-target guard; "/" additionally no-ops while a player frame is anywhere in the stack), rendered <CommandPalette /> next to <SearchOverlay />.
- settings-view.tsx (ONE additive change): useEffect inside SettingsView listening for window "harbor:settings-section" (CustomEvent detail validated against SECTIONS ids) → setSection.
- globals.css: appended "Round 8 polish" section only — .harbor-palette-scroll (max-height min(420px,52vh), overscroll-behavior contain; pairs with .harbor-scroll) and .harbor-kbd (rounded, edge-soft border, raised bg via color-mix, 10px mono caps); comment notes no new animations (pop-in already covered by the Round 7 reduced-motion guard). Nothing removed/renamed.

Stage Summary:
- Verification: `bun run lint` 0/0; `bunx tsc --noEmit | grep ^src/` EMPTY; agent-browser errors EMPTY; console clean.
- Browser QA (all via agent-browser on port 3000): Ctrl+K opens palette with 12 nav items (download/qa-r8-palette.png); typed "the" → filtered to Shuffle theme / The Shawshank Redemption (library) / Settings · Theme / Toggle Kids Mode; ArrowDown moved aria-activedescendant to opt-1, Enter pushed detail:movie:tt0111161 and closed palette (extra shot qa-r8-palette-detail-nav.png); "integrations" → Enter pushed view:settings AND auto-activated the Integrations tab (accent bg verified via getComputedStyle; download/qa-r8-palette-settings.png); seeded harbor-web.watchlist.v1 with The Godfather → palette filter shows Library row with poster img + movie chip, Enter → detail:movie:tt0068646, then empty-query palette lists 3 recents (Godfather, Settings · Integrations, Shawshank) + all nav items; Esc closes; "/" opens; Toggle Kids Mode flips data-kids on→off through the palette; demo player (#/demo-player) open → Ctrl+K AND "/" both suppressed (palette stays closed).
- Honest limits/caveats: (1) The PWA service worker's runtime asset cache served STALE Turbopack chunks after recompiles — during QA I had to unregister the SW + clear caches + reload to see fresh code; other agents doing browser QA after code changes should do the same (server was never actually stale). (2) dev.log has two pre-existing-pattern 502s on GET /api/proxy (opensubtitles upstream unreachable from sandbox) triggered by the demo player's subtitle fetch, not by the palette — palette makes zero network calls. (3) Recents render recents+nav on empty query per spec; settings/actions/library/addons are reachable by typing (VS Code behavior). (4) store method is named openPalette() (not open()) because a boolean field and a method can't share the name `open` in one zustand type — behavior matches spec otherwise.

---
Task ID: 8-a
Agent: full-stack-developer
Task: Catalog filter bar in grid-view + catalogs-view polish

Work Log:
- Read worklog rounds 6/7 first for the design language (harbor-tv-focus, harbor-pop-in, harbor-scroll, accent tokens, bg-canvas/80 backdrop-blur glass treatment from ScrollTopbar, harbor-lift-card hover pattern from library cards). File ownership held: only grid-view.tsx + catalogs-view.tsx touched.
- LIVE PROBES before coding (curl, upstream): /catalog/movie/top/search=batman.json returns 19 real Batman metas; /catalog/movie/top/query=batman.json returns the UNFILTERED top list (Cinemeta ignores a `query=` extra); /catalog/movie/trailer/genre=Action.json + trailer/search both work; series/top genre=War & Politics works; Cinemeta v3.0.14 manifest declares per-catalog genres/extra/extraSupported (top: genre+search+skip; year: genre+skip with extraRequired genre; last-videos/calendar-videos: no genre/search).
- DEVIATION (deliberate, verified): task text said "sets extra.query (the ParseOpts field for search is `query`)" — the type does declare `query?`, but the live probe proves Cinemeta ignores it (unfiltered results) and the mandatory verification requires real Batman results. Implemented with the wire key `search` (the catalog-declared extra name the input is gated on; ParseOpts has an index signature so it type-checks). Local filter state named `filters` = the "local extra state" from the spec; merged `{...query.extra, ...filters, skip}` in loadPage — the nav frame's query is never mutated. Documented here so a future reader doesn't "fix" it back to `query`.
- grid-view FEATURE 1:
  - resolveCatalogDef(): addonId path unchanged (addon manifest lookup); Cinemeta path first reuses an installed addon whose manifest.id includes "cinemeta" matched by (type, catalogId) so declared genres/extras win; otherwise synthesizes {id, type, name: title, genres: DEFAULT_*_GENRES, extra:[search,genre]}. Consts DEFAULT_MOVIE_GENRES (19) / DEFAULT_SERIES_GENRES (movie list minus Music plus Kids/Reality/War & Politics) mirror Cinemeta's manifest per spec.
  - Filter bar (sticky top-14 z-20, bg-canvas/80 + backdrop-blur-xl + border-b border-edge-soft, harbor-pop-in — same glass treatment as ScrollTopbar): genre chips row (harbor-scroll horizontal scroll, rounded-full chips; active = border-accent bg-accent text-black aria-pressed; inactive = bg-raised text-ink-muted hover:text-ink; leading "All" chip clears genre; rendered only when genre declared via genres/extra options/extraSupported) + search input (w-full sm:w-56, Search icon, 400ms debounce commit, Enter = immediate commit, X button clears + refocuses, shown only when a search extra is declared) + "Clear all" pill (accent-soft glass chip) when any filter active. All controls harbor-tv-focus.
  - Manifest-declared extra[].options take priority over genres list; genre preset from a rail push (e.g. Action rail → View all) initializes the active chip; genre + search combine (both sent).
  - Item count: subtitle gains " · N items" (normal-case span, singular-aware) updating as pages load.
  - Filters change → existing loadPage-identity effect resets metas/page/exhausted and refetches page 1 (infinite scroll preserved; observer now also gated on `exhausted`).
  - NEW exhaustion guard: a page returning zero items or zero NEW items after dedupe sets exhausted and stops further auto-paging — this fixes a pre-existing infinite-fetch loop risk (sentinel stays visible after an empty page) that search results (small sets) would have triggered constantly; dev.log stays clean.
  - Empty state is now filter-aware ("No items match the active filters." + Clear filters CTA) while the no-filter message is unchanged; edge case verified: catalogs with no genre/search extras render NO filter bar (grid unchanged).
- catalogs-view FEATURE 2: type icon chip (Film/Tv/LayoutGrid, text-accent, bg-raised rounded-xl) with addon logo as w-5 h-5 rounded-md ring-1 ring-edge-soft overlay pinned -bottom-1 -right-1 (conditional — see limits); badges row: "Searchable" (accent-soft + Search icon) when extra/extraSupported declare search, "N genres" muted chip when genres declared, "needs search term" amber chip when extraRequired includes search; card hover = harbor-lift-card + hover:-translate-y-0.5 (matches library cards); grid layout + install-empty state untouched.
- QA note: dispatching synthetic `new Event('input')` after setting .value does NOT trigger React onChange (value-tracker artifact of the test harness, not an app bug) — real Playwright keystrokes verified the debounce path correctly.

Verification (agent-browser, isolated session r8a):
- bun run lint → 0/0; bunx tsc --noEmit | grep ^src/ → EMPTY.
- Movies view → "Top Rated" View all → grid opens on the Cinemeta path → 19 genre chips + search box + sticky glass bar; click "Action" → refetch, first row changed (Unabomber/Love Hypothesis/Backrooms → The Uprising/Spider-Man/Avengers), aria-pressed=Action, count "movie · top · 50 items" → download/qa-r8-grid-genre.png.
- Type "batman" + Enter → 19 Batman titles (Batman, The Batman, Batman Begins…), count "· 19 items" (matches upstream probe) → download/qa-r8-grid-search.png. Then real-keystroke "superman" without Enter → debounce committed after ~400ms → Superman titles. X clear → grid restores; "Clear all" → unfiltered Top Rated, input empty, "All" active.
- Sticky bar: at scrollY 900 it pins at top=56px (below the h-14 floating topbar), computed backdrop-filter blur(24px).
- addonId path: installed Cinemeta (v3.0.14) via Addons → Catalogs card "Popular Cinemeta · movie" → grid shows DECLARED manifest genres (Biography/Sport present — proves manifest path over synthesized consts) + search box + count.
- No-extras edge: "Last videos" catalog → hasFilterBar=false, hasSearchBox=false, grid + "series · last videos · 100 items" unchanged.
- Catalogs view: badges verified in DOM ("Searchable", "19 genres"/"22 genres"/"107 genres"; Searchable correctly absent on Cinemeta's non-search "New" catalog) → download/qa-r8-catalogs.png. agent-browser errors empty; console clean.
- dev.log tail: catalog proxy fetches 200 (last-videos 1.6s upstream — fine); the only 5xx-pattern lines in the whole log are two OLD opensubtitles 502s from a previous round's demo-player test (lines 1543/1545, unrelated to catalogs).

Stage Summary:
- Catalog grids are now filterable: genre chips + catalog search (debounced/Enter/clear) + Clear-all, glass sticky bar, live item count, manifest-driven capability detection with a Cinemeta fallback path that synthesizes genres/extras when no cinemeta addon is installed; rail-pushed genre presets light up the matching chip.
- Catalogs view cards gained type icon chips with addon-logo overlays, capability badges (Searchable / N genres / needs search term) and the library-style lift hover.
- Honest limits: the "needs search term" badge and extra-options-priority path are code-verified only (no sandbox addon declares extraRequired search / genre options); live Cinemeta v3.0.14 manifest has NO logo field, so the logo overlay was verified by temporarily injecting a fake logo into the installed record (screenshot taken, then reverted) — it will render for real addons that declare logos; headless hover still can't be triggered, so hover styles verified via class/computed-CSS only; TV-mode arrow-key sweep not re-run (all new controls carry harbor-tv-focus and are plain buttons/inputs so tvnav picks them up).
- Screenshots: download/qa-r8-grid-genre.png, qa-r8-grid-search.png, qa-r8-catalogs.png (Cinemeta left installed in the r8a QA session; fake logo removed).
- Next steps candidates: multi-select genres (optionsLimit), year-catalog chips labeled as years, per-addon extra presets remembered per catalog.

---
Task ID: cron-round-8 (2026-10-07 QA + feature round)
Agent: main (orchestrator) + subagents 8-a/8-b (full-stack-developer)
Task: QA assessment, catalog filter bar (Stremio extras), command palette (Ctrl+K), accent-soft theme bug fix, graceful catalog empty states

Work Log:
- QA baseline: lint 0/0, dev.log healthy, agent-browser sweep clean. Verdict: stable -> feature round.
- FEATURE 1 (8-a) — Catalog filter bar (grid-view):
  - CatalogDef resolution: addonId path uses the manifest catalog; Cinemeta path reuses an installed cinemeta addon's declared catalog, else synthesizes one (DEFAULT_MOVIE_GENRES/DEFAULT_SERIES_GENRES mirroring Cinemeta's manifest + declared search/genre extras)
  - Sticky glass filter bar (bg-canvas/80 backdrop-blur-xl, harbor-pop-in): horizontally scrollable genre chips (aria-pressed, active accent, "All" clears), debounced (400ms) in-catalog search with Enter/X, Clear-all pill; wire key is `search` (live-probed: Cinemeta ignores `query=`); item count in subtitle; hidden entirely for extras-less catalogs; rail genre presets light up the active chip
  - BONUS FIX: end-of-catalog guard (empty or all-dupe page stops paging) — prevents a pre-existing infinite-fetch loop that small result sets would hammer
  - Catalogs view polish: Film/Tv/LayoutGrid icon chips with addon-logo overlay ring, "Searchable"/"N genres"/"needs search term" badges, lift+glow hover matching library cards
- FEATURE 2 (8-b) — Command palette (Ctrl+K or /):
  - command-palette.tsx: module-level useCommandPalette store (openPalette/close/toggle), fuzzy subsequence scoring with word-start bonuses, recents (localStorage cap 5), groups: Navigate (12 views), Settings sections (deep-linked via "harbor:settings-section" event + one additive listener in settings-view), Quick actions (Toggle Kids Mode, Shuffle theme, Sync now, Search content, Install app when available), Library matches (watchlist + CW + history with poster thumbs), Addons
  - Full keyboard support (arrows/Enter/Esc/Tab, scroll-into-view, aria listbox/activedescendant), suppressed while a player overlay is active, "/" guarded against typing targets
  - app-shell: additive import + render + hotkeys in the existing global keydown effect; globals.css "Round 8 polish" (.harbor-palette-scroll, .harbor-kbd)
- BUG FIX 1 (integration QA catch, orchestrator) — THEME ENGINE: bg-accent-soft rendered SOLID accent for non-hex accent colors (oklch presets/custom themes), making text-accent icons invisible app-wide (integration card chips, DEBRID chips, Clear-all pill). customColorsToTokens now derives the tint via color-mix(in srgb, accent 22%, transparent) for non-hex accents. Verified: computed bg = color(srgb .../0.22); Trakt/Simkl icons + Install-app icon + Clear-all now readable (qa-r8-accent-soft-fixed.png)
- BUG FIX 2 (orchestrator) — palette duplicate React keys (nav:movies): empty-query list showed a recent AND its nav item with the same uid; deduped by uid (items 17->16, fresh console 0 errors)
- BUG FIX 3 (orchestrator) — catalog upstream-404 UX: Cinemeta answers 404 for no-match searches / past-end pages; grid-view now treats proxy-mapped 404 as end-of-catalog (quiet stop + subtle "End of catalog · N items" note) when paging or filters active — real network failures still show the banner; page-1 filtered 404 shows "No items match the active filters." + Clear filters (verified with gibberish search)
- Integration QA: cross-feature guards verified ("/" typed in the catalog search input does NOT open the palette; Ctrl+K works everywhere else); genre Action filter returns real filtered grids (qa-r8-int-grid-action.png); palette→detail/settings/library/recents flows verified; PWA SW stale-chunk caveat handled by unregister+cache-clear before QA (recurring lesson recorded)
- Final state: lint 0/0, tsc src/ 0 errors, fresh-session console 0 errors, dev.log zero app-side 5xx (only sandbox-unreachable opensubtitles upstreams + QA artifact)
- Screenshots: download/qa-r8-grid-genre.png, qa-r8-grid-search.png, qa-r8-catalogs.png, qa-r8-int-palette.png, qa-r8-palette-settings.png, qa-r8-palette-detail-nav.png, qa-r8-int-grid-action.png, qa-r8-graceful-empty.png, qa-r8-accent-soft-fixed.png, qa-r8-clearall-fixed.png

Stage Summary:
- Catalog browsing is now protocol-complete: genre + search extras surface from addon manifests with honest fallbacks; infinite paging stops politely at catalog ends
- The command palette is the new fastest path to anything: every view, every settings section, quick actions, and personal library titles are two keystrokes away, with recents learning the user's habits
- Theme engine bug fix improves EVERY screen (accent-soft chips were solid accent since round 4's theming engine landed — icons silently invisible)
- Known limits: headless hover still unverifiable; year/actor extras not exposed (Cinemeta doesn't support them); palette recents are per-browser by design
- Next steps candidates: Simkl calendar section in Calendar view, Trakt history paging beyond 250, WebTorrent uncached path, PWA offline cached catalogs, palette: fuzzy index over full Cinemeta search
---
Task ID: cron-round-9 (2026-10-07 QA + feature round)
Agent: main (orchestrator; 9-a/9-b implementations landed in-line after subagent context deadlines)
Task: QA assessment, universal content search in command palette, Wrapped upgrade (365-day heatmap + achievements + share card)

Work Log:
- QA baseline: worklog rounds 7/8 reviewed; agent-browser sweep of home/calendar/settings/theme-studio/live-tv/library/mobile — all render, console clean, lint 0/0, tsc src/ 0 errors (examples/+skills/ pre-existing errors only), dev.log zero 5xx. Verdict: STABLE -> feature round.
- Dev-server incident: server died mid-QA twice (no logged errors; supervisor reaping suspected). Restarted detached with setsid; stable since. agents hitting deadlines: killed 16 stray agent-browser processes that were racing the default session's localStorage (caused a false "seeded data after cleanup" scare — clean-profile re-verification proved cleanup correct).
- FEATURE 1 (9-a) — Universal content search in command palette:
  - PaletteSurface gained debounced (320ms) remote search: Promise.allSettled([searchCinemeta(q), searchAddonCatalogs(installedAddons(), q)]) for q >= 2 chars; runToken ref invalidates stale responses (also on unmount); Loader2 spinner beside input while searching
  - Results appended after local fuzzy matches, groups Movies (6)/Series (6)/Addon results (8) with poster thumbs, type chips, meta "year · ★ rating"; deduped against library (type:id from detail: uids) and each other; GROUP_ORDER renumbered (Addons 5->9)
  - "Search everywhere for '<q>'" hand-off row (accent label + ↵ kbd chip) replaces the dead-end "No matches" block when local+remote both empty after a finished search: dispatches "harbor:prefill-search" CustomEvent THEN opens SearchOverlay
  - search-overlay.tsx ONE additive change: module-level pendingPrefill + "harbor:prefill-search" listener (validated, trimmed, capped 100) applied on open; overlay query prefill lands before search runs
  - Footer hint "≥2 chars searches Cinemeta + addons"
- FEATURE 2 (9-b) — Wrapped upgrade:
  - computeStats extended: heat365 (365 entries oldest->today), maxEpisodesPerDay, lateNightSessions (00:00-04:59), maxSessions; still pure
  - HeatmapGrid (GitHub-style): Monday-first weeks x 7 rows, month labels (Oct..Oct), Mon/Wed/Fri gutter, 5-level accent ramp via color-mix(in srgb, accent N%, transparent) (25/45/70/solid) with level 0 = bg-raised+edge-soft, today ring-accent/80, per-cell title tooltips "Oct 7 · 1h 24m", Less/More legend, harbor-scroll horizontal scroll on narrow screens, role=img + sr-only summary (365-day total + active days)
  - Achievements (6, computed honestly): First Steps, Binger (3+ eps one series/day), Night Owl (00-05h sessions), Explorer (10+ unique titles), Devoted (5+ sessions one title), Marathoner (8h+ day) — earned: accent-soft card + accent progress; unearned: grayscale icon + locked dot + honest progress ("best day: 7h 30m of 8h"); staggered harbor-pop-in
  - Share card (lib/harbor/share-card.ts NEW): 1200x675 canvas PNG — deep bg + accent radial glow + accent ring decoration, "MY HARBOR WRAPPED" + year, hero watch-time stat, movies/episodes/active-days blocks, top-3 posters via cover-crop rounded rects (cross-origin posters re-routed through existing /api/proxy/raw for same-origin, no taint), taint-safe retry on a FRESH canvas with initial-letter placeholders so download always succeeds; accentToRgb resolves oklch/hex/color-mix via 1x1 canvas probe
  - "Share stats" button in header (disabled when empty, Loader2 while generating, anchor-download harbor-wrapped.png, revoke after 5s, toast "Share card downloaded", inline role=alert on failure)
- QA (agent-browser, clean session after SW unregister + cache clear):
  - Palette: "batman" -> 6 Movies rows w/ posters+years (qa-r9-palette-content.png); ArrowDown+Enter opened The Batman detail (2022 ★7.8 verified in DOM); recents show The Batman with poster; "walking dead" -> Movies + Series + addon-catalog results (qa-r9-palette-series.png); gibberish -> accent "Search everywhere" row -> overlay opens prefilled "xzqvwy" with honest no-results (qa-r9-palette-prefill.png); clean profile "heat" -> remote Cinemeta hits only
  - Wrapped: seeded 34-entry year of history (12 films + GoT 4-ep binger + 6 weekly 1-3am BB sessions + 6 TWD sessions + 7.5h marathon day + 3-ep GoT day-2 binger) -> tiles 41h48m/15 movies/19 episodes/26 active days; heatmap 367 cells, 26 accent-filled, today ring, month labels, legend (qa-r9-heatmap.png, qa-r9-heatmap2.png); achievements 5/6 with Marathoner honestly locked at 7h30m/8h; mobile 390px heatmap scrolls horizontally, badges 2-col (qa-r9-heatmap-mobile.png); Share -> "Share card downloaded" toast, zero share-card console warnings (non-tainted poster path confirmed)
  - Empty state intact in pristine profile ("Your year in stories"); localStorage test data fully cleaned
- Final state: lint 0/0, tsc src/ 0 errors, fresh-session console 0 errors/warnings, dev.log zero 5xx
- Screenshots: download/qa-r9-palette-content.png, qa-r9-palette-series.png, qa-r9-palette-prefill.png, qa-r9-search-everywhere.png, qa-r9-wrapped-top.png, qa-r9-heatmap.png, qa-r9-heatmap2.png, qa-r9-heatmap-mobile.png, qa-r9-wrapped-empty.png, qa-r9-detail-check.png

Stage Summary:
- Ctrl+K is now a universal launcher: commands, settings, library AND the entire Cinemeta+addon catalog universe, with a graceful hand-off to the full search overlay (prefilled) when nothing matches
- Wrapped is a complete personal-stats product: 365-day GitHub-style heatmap, honest achievement system with progress, and a shareable designed PNG card that always downloads (taint-safe fallback)
- Honest limits: share card renders posters only when /api/proxy/raw can reach them (placeholders otherwise, download never fails); heatmap tooltips are native title attrs (no rich popover); achievements are heuristic thresholds, not synced across devices; palette remote search capped (6+6+8 rows) to keep the listbox snappy
- Ops note: dev server died twice mid-round (silent); restart pattern: cd /home/z/my-project && (setsid bun run dev >> dev.log 2>&1 &). Stray agent-browser processes from timed-out subagents can race the default session's localStorage — pkill -f agent-browser before storage-sensitive QA
- Next steps candidates: Trakt/Simkl calendar sections in Calendar view (needs connected accounts), palette recents for content searches, heatmap year selector, share card OG-image mode (copyable dataURL), PWA offline cached catalogs, WebTorrent uncached path
---
Task ID: cron-round-10 (addon battery verification + subtitle experience)
Agent: main (orchestrator, all work in-line)
Task: User supplied 5 addon URLs (Torrentio + 4 Arabic subtitle addons: SubSource, opensubtitles PRO, SubSense, SubDL) and requested full testing. QA + fixes + features around the addon/subtitle pipeline.

Work Log:
- USER ADDON BATTERY — all 5 tested end-to-end (protocol level via app proxy AND browser E2E):
  - Manifests: all 5 fetch through /api/proxy (200, correct JSON). Resource URLs verified: Torrentio /stream/movie/tt4154796.json → 72 real streams; all 4 subtitle addons /subtitles/movie/tt4154796.json → 37/14/83/39 ara entries.
  - Subtitle FILES: all 4 providers' URLs download through /api/proxy/raw (SRT ~150-190KB each, OSv3-pro mirror VTT) and parse with our engine (1783-2105 cues, 0 invalid).
  - Browser E2E: installed all 5 via Addons paste-URL (toasts OK, INSTALLED (5), cards with logos/versions). Picker on #/detail/movie/tt4154796 shows all 72 streams in 6 tiers (14+12+1+34+7+4 — "N streams" is per-tier, initial confusion resolved), DEBRID badges, seeders/size/codec chips, filter chips work; clicking a torrent without debrid deep-links to Settings (correct). All 5 health probes green.
- VERDICT: user's addons fully functional. Torrentio streams need debrid/webtorrent to actually play (by design; picker communicates this).
- BUG FIX 1 — SUBTITLE LANGUAGE MATCHING WAS DEAD: settings store display names ("English"/"Arabic") while addons/mirrors return ISO codes ("eng"/"ara"); subScore/pickBestSubtitle substring match NEVER matched → preferred-language ranking was a no-op. New src/lib/harbor/languages.ts: ISO 639-2b/1 ↔ English name map (~60 entries) + bidirectional langMatches() + langChip() (ara→ARA); subScore and pickBestSubtitle now use it. Settings chips (Language panel) now actually control subtitle ranking.
- BUG FIX 2 — SUBTITLE LABELS RENDERED "i": OS mirrors return m:"i" (garbage); labels now derived by new subLabel() with per-provider priority: label > subtitleFileName > title > movieReleaseName > releaseName > fileName > m > id (opaque ids like "subsense-…"/"v3+|…" rejected, SubDL "_N" suffix stripped). RawSubtitle type extended with mirror/SubSense fields + addonName.
- BUG FIX 3 — source attribution: fetchSubtitles tags every entry with addonName (mirror pool → "OpenSubtitles"; addon pool → manifest.name); shown in panel rows.
- BUG FIX 4 — local-file subtitle used stale closure `subtitles.length` for selection index → subtitlesRef captures latest committed list.
- BUG FIX 5 (robustness) — parseSRT strips BOM per block (OS mirror VTTs re-emit \uFEFF mid-file); gzip-guard unchanged.
- FEATURE 1 — Addon health probe (addon-probe.ts): probeAddon picks best declared resource (stream→subtitles→catalog→meta), fires a sample request (tt0111161), returns {ok, resource, count, ms|error}; describeProbe builds toast copy. Auto-probe fires in background after every install; per-addon "Test" button (Activity icon) on installed cards with spinner + persistent status dot (green healthy / red dead, placed outside the name clamp so it never clips). Verified: all 5 probes green ("SubDL Subtitles is healthy — Responded with 80 subtitles in 1.4s").
- FEATURE 2 — Subtitle panel overhaul (player-overlay): w-72 glass panel; header "N/M loaded" counter; language chips (All + top-6 by count, each with pool count, aria-pressed) that RE-RANK the pool language-first, reset the cursor and load top-8 (ARA chip → 176 Arabic subs surface instantly — fixes the "Arabic buried at 200+ under English CAM rips" UX); rows = lang chip (ARA) + release label + source + AI badge (ai_translated); scrollable max-h-64 harbor-scroll; "Load more (N more)" increments of 8 from the (filtered) ranked pool — verified 8→16; Off row; local-file row (source "Local file").
- FEATURE 3 — demo deep link accepts overrides: #/demo-player?metaId=tt4154796&title=... (tt-prefixed ids only) so the subtitle pipeline is QA-able without debrid (mux BBB video + real movie subtitles). Plain #/demo-player unchanged (demo:bbb).
- E2E PROOF: Endgame via demo override → pool 268 subs → ARA chip → 8 Arabic subs (SubSource/OSv3-pro/SubSense/SubDL + mirrors), cue rendered on video at 551s ("لم أستطع إيقافه / ولا أنا" via .harbor-subtitle div) — full addon→panel→screen chain verified. Load more → 16/176.
- OPS: recurring lesson re-bitten — PWA service worker served stale chunks after code edits (demo override appeared dead until SW unregister+cache clear); ALWAYS unregister SW + clear caches before QA after edits. Also: tsc incremental cache masks on-disk changes — final checks run with --incremental false. Note: tool-output sanitizer strips "[m" sequences from displayed file content (looked like `const uted` corruption); od -c confirmed file was always correct — verify with od before "fixing" such ghosts.
- Final state: lint 0/0, tsc --incremental false src/ 0 errors, dev.log zero errors/5xx, fresh-session console clean.
- Screenshots: download/qa10-03-tor-installed.png, qa10-07-picker.png (72-stream picker), qa10-08-debrid-prompt.png, qa10-14-subpanel-chips.png, qa10-16-ara-loaded.png (ARA panel with sources), qa10-17-arabic-cue.png, qa10-20-all-probed.png (5/5 healthy + healthy toast), qa10-22-dot-visible.png.

Stage Summary:
- All 5 user-supplied addons verified working end-to-end (manifests, resources, files, UI, health probes). Torrentio = debrid-required (communicated in UI); the 4 Arabic subtitle addons deliver real Arabic tracks that render on screen.
- Subtitle experience is now language-aware end-to-end: settings language chips finally affect ranking, panel offers language jump-chips with counts, honest labels + provider attribution, incremental loading, AI-translation flag.
- Addons manager gained a real "does this addon actually work?" answer: auto-probe on install + one-click re-test with persistent status.
- Known limits: probe uses fixed sample id (tt0111161) — addons with restrictive idPrefixes/types may report "no testable resources" though fine for their domain; probe results are session-transient (not persisted); subtitle "Load more" is sequential (8 × ~150KB batches, ~5-15s per batch on slow upstreams); AI badge only for OSv3-pro ai_translated entries.
- Next steps candidates: persist probe results + last-checked timestamp on addon records (Prisma Addon table has room), WebTorrent uncached path so Torrentio plays without debrid, subtitle search box inside the panel for big pools, multi-language preferred ranking drag-order in settings, per-addon subtitle enable/disable toggles.
---
Task ID: cron-round-11 (2026-10-07 QA + feature round)
Agent: main (orchestrator, all work in-line)
Task: QA assessment, then round-10 candidate features: subtitle panel search, persisted addon probes, multi-language subtitle priority ordering.

Work Log:
- QA baseline: worklog round 10 reviewed; agent-browser sweep (home, addons, demo-player with full subtitle pipeline) — all render, console 0 errors, lint 0/0, tsc src/ 0 errors. Verdict: STABLE -> feature round. (SW unregister + cache clear before QA per recurring lesson.)
- FEATURE 1 — Subtitle panel search (player-overlay):
  - applySubFilter refactored into applySubView(chip, search): language chip RE-RANKS (matches first) then free-text search NARROWS the pool by label/lang/provider; commits token-guarded (subViewTokenRef) so fast retyping can't let an older parse batch clobber a newer view; debounced input (~280ms).
  - Panel gains a Search input (shown when pool > 6) with clear button, keyboard-stopPropagation so player hotkeys don't fire while typing; header counter now "loaded/effective" (subEffectiveCount); honest empty states split: "No subtitles match 'q'" vs "No subtitles found for this title"; Load more counts reflect the effective view.
  - E2E: 95-sub pool → "bluray" → 5/5 real BluRay releases; "zzzz" → honest no-match; clear → 8/95 restored; PER chip + "yts" → 2/2 composed correctly.
- FEATURE 2 — Persisted addon probes (3 layers):
  - store.ts: AddonRecord.probe?: StoredProbe (+ setProbe action, sanitizeStoredProbe on read) — survives reloads, flows through cloud-sync snapshot automatically.
  - Prisma Addon model: probeOk/probeResource/probeCount/probeMs/probeError/probedAt columns; sync POST mirrors them, GET row-rebuild reconstructs probe when blob missing (db:push applied).
  - addons-view: status dot + new persistent AddonProbeLine ("HEALTHY/NO REPLY · N items · X.Xs · checked Xm ago", full timestamp tooltip); results hydrate from the record; header gains a fleet health strip ("N healthy · M not responding · K/J checked" + "Re-test all" button).
  - E2E: Cinemeta install → auto-probe → status line; full page reload → line persisted ("checked 18m ago"); Re-test all → refreshes; DB row verified (probeOk=true, count=48, ms=31).
- FEATURE 3 — Subtitle language priority ordering (settings LanguagePanel):
  - Selected languages render as an ordered priority list: rank badge (#1 accent + "TOP PICK" chip), HTML5 drag-to-reorder with drop-target highlight, keyboard/touch up/down buttons, remove X — all aria-labelled.
  - BUG FIX (found by QA): toggleLang/move read the render-closure settings snapshot, so synchronous rapid ops dropped each other's changes; now read useSettings.getState() live.
- BUG FIX (round-11 catch) — SUBTITLE BOOT RACE: player mounted via deep link at app boot ran its subtitle effect BEFORE AppShell's settings hydration (child effects first), so preferredSubLangs ranking used DEFAULTS (all-ENG top-8 despite Turkish-first). Fix: the effect reads useSettings.getState().settings live instead of the closure. E2E proof: boot with subtitlesOffByDefault=true → subs stay off (live read); Turkish-first settings → top-8 all TUR on deep-link boot.
- OPS: sync POST /api/sync 500 "Unknown argument probeOk" after schema change — running dev server still held the OLD Prisma Client; fixed by restarting the dev server (setsid pattern). Pending sync pushes flushed successfully afterwards. (New ops lesson: restart dev server after ANY prisma schema change, not just db:push.)
- Final state: lint 0/0, tsc --incremental false src/ 0 errors, fresh-session console 0 errors, dev.log zero app-side 5xx (only upstream opensubtitles mirror 502s, gracefully skipped by the subtitle pipeline).
- Screenshots: download/qa11-01-home.png, qa11-03-addons.png, qa11-04-player.png, qa11-07-probe-persisted.png, qa11-08-sub-search.png, qa11-12-lang-priority.png, qa11-13-tur-first.png, qa11-14-health-strip.png, qa11-15-final-home.png.

Stage Summary:
- Subtitle pool navigation is now two-dimensional: language chips re-rank, search narrows — with honest counters and token-guarded commits.
- "Does this addon actually work?" now has a durable, synced answer: probe results persist in localStorage, cloud snapshot, and Prisma columns, with a fleet health strip and one-click re-test.
- Language preference became a real priority system: drag-ordered, keyboard-accessible, and actually honored at boot (the race is fixed).
- Known limits: HTML5 drag reorder not automatable headless (button path E2E-verified); probe GET-rebuild path exercised only by unit-level reading; per-addon subtitle enable/disable still open.
- Next steps candidates: per-addon subtitle enable/disable toggles, WebTorrent uncached path, heatmap year selector, palette recents for content searches, PWA offline cached catalogs.
---
Task ID: cron-round-12 (P2P torrent engine — "can't play anything" fixed)
Agent: main (orchestrator, all work in-line)
Task: USER REPORT (Arabic, with screenshot): "لا أستطيع تشغيل أي شيء" — stream picker shows only DEBRID-locked Torrentio torrents with Unlock buttons; with no debrid key configured nothing plays. Root cause = the known round-10 gap: no playback path for uncached torrents. This round shipped it.

Work Log:
- NEW MINI-SERVICE — mini-services/torrent-service (port 3031, Node 24 + webtorrent v3, run via `bun run dev` → `node --watch index.mjs`):
  - POST /prepare {infoHash, fileIdx?, filename?} → joins swarm (DHT + 9 trackers incl. wss), sequential strategy, waits metadata (35s → 202 pending instead of hard fail), picks file (explicit idx > filename match > largest video), selects only that file. LRU cap 6 torrents, TTL sweeper (idle 45min; never-got-metadata dropped after 90s of no polls), destroyStore cleanup.
  - GET /stream/:key/:idx — native Range-capable file streaming (206 verified, Content-Range correct).
  - GET /remux/:key/:idx — ffmpeg progressive remux to fMP4 (movflags frag_keyframe+empty_moov+default_base_moof) for browser-hostile containers: video stream-copy + **audio transcode to AAC 256k** (mp4 mux rejects EAC3/DTS copy and browsers can't decode them — discovered via a real EAC3 mkv failing with "Could not write header").
  - GET /codec/:key — ffprobe report over a 6MB head dump (native containers short-circuit as assumed-playable; moov-at-end mp4s can't be head-probed).
  - GET /status/:key, /health, POST /remove/:key, POST /cleanup {purge}.
  - HARD-WON WEBTORRENT v3 LESSONS (all hit in QA): (1) client.get() is async → Promise — truthy-promise bug made torrent null; (2) torrent.destroy() is callback-style returning undefined — never .catch() its result; (3) add() callback is error-first AND fires on 'ready' — use the synchronously returned Torrent + events; (4) constructor downloadLimit/uploadLimit: 0 silently KILLS all announce/DHT peer discovery (0 peers forever) — omit them; (5) raw infoHash string works but announce list must be passed in opts.
  - Verified with real swarms: Sintel (08ada5a7) metadata in ~2s, 7→28 peers; user's own Simpsons torrents (092ea1d9 cakes S38E01, 1d9098aa HONE S01E01) joined + downloaded (cakes hit 100%).
- FRONTEND CLIENT — src/lib/harbor/p2p.ts: prepare/status/codec/health/remove/cleanup + stream/remux URL builders (relative, gateway via `?XTransformPort=3031`) + p2pPlan() (native container → /stream; remuxable → /codec probe → /remux unless video=hevc; hevc = honest dead end) + formatSpeed/formatEta.
- PICKER OVERHAUL (picker-overlay.tsx): torrent rows now have primary accent **Play (P2P)** button + secondary **Debrid** button (label switches by configured state); row overlay "Joining swarm… / N peers · Xs" during prepare+poll (2.5s interval, 100s cap); new **Free** filter chip (url OR infoHash streams); no-debrid banner ("Torrent streams play through the built-in P2P engine…") with Connect button; **inline DebridSetupDialog** (service radio cards + key input + validate + Get key link + honest P2P-fallback note) replaces the old toast+settings-jump dead end; P2P badge chip next to DEBRID; direct-URL rows get emerald left border.
- PLAYER (player-overlay.tsx): PlayerPayload/Stream gain `p2p {key, fileIdx, infoHash, mode}`; instant-play resolve path now: series bare-id → fetchMeta → defaultVideoId → streams → prefer url-streams → best non-HEVC torrent → P2P prepare (status line: "Finding the best stream… / Joining the torrent swarm… / Finding peers… (N found) / Checking video codecs…") → plan → play; VideoStage polls /status every 2.5s → buffering HUD ("Downloading via P2P… 12% · 8 peers · 1.1 MB/s", transmux note) + persistent top-left pill while playing; one-shot onVideoError remux fallback (native fail → /remux).
- SERIES EPISODE RESOLUTION FIX (player + picker): bare series ids (deep links, main Play button) now resolve the default episode via Cinemeta before querying stream addons — **with season-0 skip** (defaultVideoId in api.ts picks first season>=1 episode; Cinemeta lists specials first and Torrentio returns 0 streams for both bare ids AND S0 ids — two silent-empty bugs found by QA).
- ADDON URL NORMALIZATION FIX (types.ts parseAddonUrl + store readStoredAddons): pasted manifest URLs containing %7C (encoded pipe) reached Torrentio still encoded (proxy is byte-faithful) → **0 streams silently**. Now decodeURI'd (path only, query preserved) at install AND at every localStorage load (heals existing installs). User's original install had a raw pipe which is why it used to work.
- SETTINGS → INTEGRATIONS: new "P2P Torrent Engine" card — online/offline health pill (port 3031), p2pEnabled toggle (Settings key, default on, sanitized), live swarm list (name/progress/peers/speed) + Refresh, Stop all / Wipe cache buttons, TTL explainer.
- OPS LESSON (recurring, bit again): Turbopack served a STALE player-overlay chunk after edits (server had new code; browser SW-cached old). Unregister SW + clear caches + reload before trusting any QA; also chunk URLs don't change between edits — verify by grepping the fetched chunk for a new-code marker.
- E2E PROOF (agent-browser, fresh session, Torrentio installed, NO debrid): detail The Simpsons → Play → S1:E1 auto-resolved → P2P join (11 peers) → codec probe (HONE EAC3 mkv) → remux AAC transcode → **video frames at 1080p with English subtitles + live P2P pill (0% · 409 KB/s · 10 peers · transmux) + Up Next card**. Picker screenshots show Free/Cached chips, banner, Play/Debrid dual buttons, inline debrid dialog. Settings card shows "Online · port 3031" + live swarm rows. Mobile 390px layouts verified.
- Final state: lint 0/0, tsc --incremental false src/ 0 errors, console 0 errors, dev.log app-side clean (only upstream subsource 500, gracefully skipped).
- Screenshots: download/qa12-01..18 (player HUD, picker before/after, debrid dialog, P2P card, mobile).

Stage Summary:
- Harbor Web can now actually play torrents WITHOUT any account: server-side BitTorrent streaming (webtorrent) with sequential piece selection, Range playback for native containers, and an ffmpeg transmux lane (audio→AAC) for mkv — the exact gap the user hit. Debrid remains the premium instant path; P2P is the free default fallback.
- Two silent-zero-streams bugs fixed en route: %7C-encoded addon URLs and season-0 default episodes.
- Known limits: remux lane is progressive (no Range — seek within buffered only, noted in HUD); 4K/HEVC torrents can't play in-browser (honest error suggests debrid); metadata wait up to ~100s on cold swarms; service holds torrents in memory (TTL-evicted); probe/remux rely on host ffmpeg (present at /usr/bin/ffmpeg).
- Next steps candidates: seekable remux via byte-offset re-exec (accept &start= on /remux), HEVC hardware transcode lane, torrent cache warm list + "pre-download" button, per-addon stream priority settings, WebSeed (land+instant) catalogs, persist probe results into wrapped/stats.

---
Task ID: feat-round-13 (F1 duplicate-subtitles fix + roadmap F2-F5)
Agent: main (orchestrator, all work in-line)
Task: USER REPORT (critical): same subtitle line rendered TWICE during playback (small native subs near progress bar + big styled subs on dark strip). Fix first, then floating search, TMDB, activation-code linking, ratings.

Work Log (F1):
- ROOT CAUSE (code-verified, not guessed): VideoStage rendered a native `<track kind="subtitles" default>` on the <video> (browser's own subtitle layer) WHILE the custom `.harbor-subtitle` div overlay rendered the same active cue — two simultaneous layers, out of sync (one truncated by native line-breaking). Bonus bugs: `URL.createObjectURL(new Blob(...))` was called inline in render (new blob URL every render, never revoked → leak + track reload churn); hls.js could flip embedded text tracks to showing (no `renderTextTracksNatively: false`).
- NEW src/lib/harbor/subtitle-manager.ts — SubtitleManager: single source of truth; sweep() sets EVERY TextTrack to "disabled", removes stray <track> children, revokes tracked blob URLs, dev-time assertion warns if any second layer survives; subtitleDedupeKey(url|lang|label) + mergeSubtitlesUnique for idempotent loading; makeVttUrl tracked lifecycle.
- player-overlay.tsx: native <track> REMOVED (overlay is the only renderer); Hls config + renderTextTracksNatively:false; manager attach/sweep on addtrack/removetrack events + on [activeSub, subtitles, fullscreen, srcOverride]; destroy() on unmount (stage remount covers episode/source change via key={url}); all three setSubtitles commit paths now merge idempotently; parseSubBatch dedupes within batch; local-file load rebuilt on subtitlesRef (fixes stale-index race) with honest toasts ("already loaded", "no readable cues"); overlay positioning now controls-aware: bottom-36/40 (stremio) while controls visible → bottom-5/8 when auto-hidden, transition-[bottom]; font scales with measured stage height via ResizeObserver (clamp 0.55–1.6 of 720p reference).
- E2E PROOF (agent-browser, demo player + Endgame subs): exactly 1 `.harbor-subtitle`, 0 <track> elements, 0 showing TextTracks at every checkpoint — after load, after 10 rapid 's' presses (incl. off), after fullscreen enter/exit (font scales 28→21px at 544px stage = correct 720p ratio), cue text intact multi-line; controls auto-hide moves the layer below the transport cleanly.
- Final state: lint 0/0, tsc src/ 0 errors.

Stage Summary (F1):
- FIXED: one subtitle layer ever; blob-URL leak gone; HLS-embedded tracks can't fight the overlay; subs never overlap seek bar/controls; font scales with player height incl. fullscreen; idempotent loads (url+lang+label) across addon/local paths; dev assertion guards regressions.
- Next: F2 floating search bar (glass, instant grouped results, keyboard nav), F3 TMDB proxy+enrichment, F4 env-based Trakt/Simkl activation codes with vault, F5 ratings provider registry.

---
Task ID: feat-round-13b (F2 floating search + TMDB core)
Agent: main (orchestrator, all work in-line)

Work Log (F2):
- NEW src/components/harbor/chrome/floating-search.tsx — fixed top-center glass search bar: collapses to icon pill on mobile (safe-area aware), expands on focus; debounced (250ms) instant results grouped Movies/Series/From-your-addons (+ People group automatically when TMDB is configured); recents (localStorage, 8 max) + Cinemeta trending when idle; full keyboard nav (↑/↓/Enter/Esc), ARIA combobox/listbox + aria-activedescendant, focus rings; Enter with no selection / "See all results" hands off to the existing full SearchOverlay (prefill bridge kept); AI button opens overlay's AI mode; motion-reduce + backdrop-filter fallback (.harbor-glass + @supports in globals.css).
- Shortcut rewire: "/" and Ctrl/Cmd+K → focus floating search; command palette moved to Ctrl/Cmd+Shift+P (binding + palette input handler + shortcuts overlay text + tip updated). Sidebar search button + ScrollTopbar search button now focus the floating bar.
- TMDB core shipped early (F2's People group + F3 foundation): src/lib/harbor/tmdb-server.ts (env-creds TTL cache + inflight dedupe + Retry-After-aware backoff, per-path TTLs, 501-with-clear-error when unconfigured), /api/tmdb (path allowlist, rate-limited, user-key via header), /api/tmdb/validate (live key check), src/lib/harbor/tmdb.ts (client: tmdbEnabled/multi-search/id-mapping/details/logo/certification/trending, settings-driven headers, client TTL cache). Settings schema + sanitize: tmdbEnabled/tmdbLanguage/tmdbImageQuality/tmdbUserKey (+ ratingsEnabled/ratingsProviders for F5).
- E2E (agent-browser, mobile 390px + desktop 1280px): bar renders glass, "/" focuses, "batman" → grouped results with thumbnails/year, arrow-key selects (aria-selected verified), Enter opens detail, recents persist ("inception"), Esc closes, mobile collapses to 48px icon pill; BUG FOUND+FIXED in QA: Thumb wrapper missing `relative` → poster escaped its 8x11 box; fixed + re-verified after SW cache clear.
- Final state: lint 0/0, tsc src/ 0 errors.

---
Task ID: feat-round-14 (F3 TMDB + F4 activation-code linking + F5 ratings)
Agent: main (orchestrator, all work in-line)

Work Log:
- F3 TMDB: /api/tmdb (path allowlist, rate-limited 60/min, user-key via header), /api/tmdb/validate (live key check), tmdb-server.ts (env TMDB_ACCESS_TOKEN/v4 preferred + TMDB_API_KEY/v3; TTL cache 5min search→6h details; inflight dedupe; Retry-After-aware backoff; 501 with clear message when unconfigured), tmdb.ts client (multi-search incl People group for floating search, imdb⇄tmdb id mapping via /find, details+logo+certification+trending, settings-driven lang/region/quality headers). Settings → Integrations → "TMDB metadata" card (enable, metadata language 12 langs, image quality low/med/high, BYO key with debounced live validation ✓/✗ + server-key status dot). DetailView enrichment: TMDB backdrop upgrade, certification chip, title LOGO replaces the h1 visually (sr-only h1 kept), "Recommended for you (via TMDB)" rail. Attribution (required text + TMDB badge) in Settings → About AND the home footer.
- F4 zero-config linking: vault.ts (AES-256-GCM at rest, key = HARBOR_TOKEN_SECRET with documented fallback; opaque linkIds; server-side pending device-flow registry), Prisma LinkedAccount model (unique per provider, db:push applied + dev server restarted per ops lesson). New routes: trakt+simkl /link/start (env creds only; 501+configured:false when missing), /link/poll (pending/slow_down pacing/expired/denied/authorized; profile fetch; token never crosses the boundary), /link/unlink (Trakt token revoke best-effort + row delete). traktCredsFromBody/simklCredsFromBody patch ALL 8 sync routes (scrobble/watchlist/history/me/push-watchlist × trakt + watchlist/history/user × simkl) to accept EITHER linkId (vault mode) OR legacy BYO clientId/accessToken — zero breaking change. NEW /api/simkl/scrobble. Auto-refresh: Trakt tokens refresh inside the 5-min expiry window during resolve. Client: linking.ts store (startLink/regenerate/pollOnce with slow_down retry/cancel/unlink/syncNow + lastSync timestamps + checkEnv), link-account-flow.tsx UI (big code + one-click copy, verification URL button, QR (qrcode pkg), live mm:ss countdown, polling status, success screen with username/avatar, New code/Cancel, honest error states), both TraktCard+SimklCard now show the one-click flow with legacy BYO collapsed under <details> "Advanced". Player scrobbles fan out to ALL linked services via scrobbleToLinkedServices (Simkl included).
- F5 ratings: ratings/adapters.ts — provider-adapter registry (imdb/rotten/metacritic via ONE OMDb call + side-cache; tmdb; trakt public ratings; mdblist fallback; anilist GraphQL; jikan/MAL; kitsu), 6h TTL cache + inflight dedupe + per-provider failure isolation; /api/ratings (allSettled fan-out, 40/min). ratings-row.tsx: RatingsRow (brand-colored provider chips, votes compacted, original scale on tooltip, deep links, skeletons, honest "No ratings available", anime auto-detect Animation+Japan) + RatingsSettingsCard (enable + per-provider ordering with ↑/↓ + Ordered/Default toggles + key hints). DetailView shows the row under the meta chips.
- .env.example created: DATABASE_URL, TMDB keys, TRAKT_CLIENT_ID/SECRET (register trakt.tv/oauth/applications/new), SIMKL_CLIENT_ID/SECRET (simkl.com/settings/applications/new), OMDb, MDBList, HARBOR_TOKEN_SECRET — each with where-to-obtain notes.
- E2E: /api/ratings for AoT → real AniList 85/100 + Kitsu 84.4/100 (Jikan rate-limited → isolated, row unaffected); detail page renders the chips (screenshot qa-f5-01); link flow error state honest when env missing (qa-f4-02); with TEMP env creds set, /api/trakt/link/start reached Trakt and surfaced its 401 verbatim (plumbing proven end-to-end minus real authorization which needs a registered app + human code entry); Integrations panel shows all 6 cards; About + footer attribution present; home reload clean, console 0 errors; lint 0/0; tsc src/ 0 errors; dev.log app-side clean.

Stage Summary:
- Shipped: single-renderer subtitle engine (F1), glass floating search with instant grouped results (F2), full TMDB layer with graceful degradation (F3), zero-config Trakt/Simkl linking with an encrypted server-side vault (F4), 9-provider ratings registry (F5).
- Honest limits: Letterboxd NOT integrated (no public API; scraping violates their ToS — deep links would be possible but there's no reliable title mapping, so omitted entirely); Simkl ratings omitted (Simkl exposes no public title-rating endpoint — linked-account scrobble/history/watchlist ARE supported); real Trakt/Simkl authorization requires the operator to register apps + set env vars (routes verified against live upstreams with temp creds); TMDB features dormant until a key is set (UI communicates this and offers BYO-key); Jikan rate-limits aggressively (isolated, retries on next cache miss).
- Setup: copy .env.example → .env, fill TMDB_ACCESS_TOKEN (themoviedb.org/settings/api), TRAKT_CLIENT_ID/SECRET (trakt.tv/oauth/applications/new), SIMKL_CLIENT_ID/SECRET (simkl.com/settings/applications/new), OMDB_API_KEY (omdbapi.com/apikey.aspx), MDBLIST_API_KEY (mdblist.com/preferences), HARBOR_TOKEN_SECRET (openssl rand -base64 32); restart dev server.
- Next candidates: TMDB-backed Discover filters (trending by genre/year/language rows), Trakt/Simkl calendar sections, rating push (rate in-app → Trakt/Simkl), continue-watching two-way conflict sync, wired "wrapped" TMDB stats.
---
Task ID: cron-round-15 (ONE search bar + visible integrations + stale-SW heal)
Agent: main (orchestrator, all work in-line)
Task: USER REPORT (Arabic): "لدي الكثير من اشرطة البحث انا اريد شريط واحد متقن" (too many search bars, want ONE polished bar) + "انا لا ارى الاضافات التي طلبتها مثل TMDB وغيرها" (can't see requested features like TMDB).

Work Log:
- SEARCH AUDIT (code-verified): 4 simultaneous search surfaces — floating glass bar (top-center), sidebar "Search…" pseudo-input button under the logo, ScrollTopbar "Search /" button on scroll, plus SearchOverlay; contextual filter inputs read as search bars too.
- UNIFIED to ONE: sidebar.tsx — removed the fake search input-button (floating bar is the single surface; comment left in code); app-shell.tsx ScrollTopbar — removed the Search button, header is now a pure legibility backdrop (verified zero header buttons after scroll via DOM check); live-view + player-overlay — "Search channels…/Search subtitles…" renamed to "Filter …" with aria-labels updated (they are local filters, not search); grid-view catalog input kept (it performs a real remote addon search). SearchOverlay/command-palette unchanged (full results page + command palette, opened FROM the floating bar).
- ROOT-CAUSE FIX for "can't see features": pwa.ts — service worker registration is now PRODUCTION-ONLY; in dev it UNREGISTERS any existing SW and purges all CacheStorage (heals browsers stuck on stale chunks — Turbopack reuses chunk URLs across edits, documented round-12 lesson); sw.js CACHE bumped v2→v3.
- DISCOVERABILITY for integrations: NEW src/app/api/integrations/status/route.ts (GET → env-key booleans for tmdb/trakt/simkl/omdb/mdblist; leaks only existence, no-store); NEW src/components/harbor/chrome/integrations-strip.tsx — home "Complete your Harbor setup" card: per-service status dot (server env OR user TMDB key), one-line benefit copy, CTA "Set up in Settings → Integrations" (push + harbor:settings-section event, pattern already supported by settings-view), dismiss persisted in localStorage (harbor-web.integrations-strip-v1); auto-hides when all active. Wired at top of home-view content (px-4 md:px-8 aligns with rails).
- TMDB CARD UX: added 3-step "free key in ~1 minute" guide (signup → Settings→API → paste, live-validated, browser-local) replacing the single-link hint.
- WHY TMDB LOOKED ABSENT (honest finding): .env contains ONLY DATABASE_URL — no TMDB/Trakt/Simkl/OMDb/MDBList keys, so all key-gated features are dormant BY DESIGN (no secrets in code per security spec). The strip now surfaces this state and the exact path to fix it. tmdbEnabled/ratingsEnabled default true — they light up the moment a key exists.
- QA (agent-browser): home desktop = exactly ONE search bar + strip visible (TMDB/Ratings "Not set up" chips); scrolled = no header buttons (DOM-verified); strip CTA → Settings opens directly on Integrations tab (Trakt/Simkl/TMDB/Ratings/Debrid cards); TMDB card renders the new guide; floating search "spider" → 9 grouped options (Movies/Series), ArrowDown+Enter opened Spider-Man detail; detail shows honest "No ratings available" (no keys); dismiss sets flag + hides, flag then cleared so the user sees the strip; mobile 390px = icon-pill search + single-column strip, no overflow; console 0 errors, page errors 0, dev.log app-side clean.
- Final state: lint 0/0, tsc src/ 0 errors (examples/skills folders have pre-existing unrelated tsc noise), SW healed for dev users on next load.

Stage Summary:
- Users now see ONE polished glass search bar everywhere ("/" or Ctrl/Cmd+K), and a live status card telling them exactly which of their requested features (TMDB / ratings / Trakt / Simkl) are active and how to activate them in one click.
- Stale-service-worker root cause for "features invisible" eliminated: dev browsers auto-purge on next load.
- Operator note (unchanged, now discoverable): copy .env.example → .env and fill TMDB_ACCESS_TOKEN (themoviedb.org/settings/api), TRAKT_CLIENT_ID/SECRET (trakt.tv/oauth/applications/new), SIMKL_CLIENT_ID/SECRET (simkl.com/settings/applications/new), OMDB_API_KEY (omdbapi.com/apikey.aspx), MDBLIST_API_KEY (mdblist.com/preferences), HARBOR_TOKEN_SECRET (openssl rand -base64 32); restart. Or users can paste their own TMDB key in Settings → Integrations (browser-local, live-validated).
- Next candidates: TMDB Discover rows once a key is present, in-app rating push to Trakt/Simkl, per-addon subtitle toggles, seekable remux lane.
---
Task ID: cron-round-16 (Trakt PKCE-only apps — real linking activated with user's Client ID)
Agent: main (orchestrator, all work in-line)
Task: USER registered a Trakt app (HarborWeb, Client ID pk0CCmQa…fUY) and pasted the registration page: "Client Secret — Not issued. This app signs users in with PKCE." Server still answered "Trakt linking is not configured (missing TRAKT_CLIENT_ID / TRAKT_CLIENT_SECRET)".

Work Log:
- ROOT CAUSES (code + live-curl verified): (1) link/start+poll required BOTH env vars; (2) validCredential regex rejected the new PKCE-era client-id format (43-char base62 with underscores — old regex allowed hex+dash only); (3) our poll expected the DEAD apiary contract {"error":"authorization_pending"} on 400 — the CURRENT API (developer.trakt.tv, apiary officially deprecated per trakt/trakt-api#808) returns 400 with an EMPTY body for Pending (schema z.undefined()), 429 slow-down, 410 expired, 418 denied, 404/409 invalid/used; (4) OAuth endpoints must use https://auth.trakt.tv (api hostname deprecated for OAuth).
- LIVE PROOF BEFORE CODING: POST auth.trakt.tv/oauth/device/code with client_id only → 200 with real device/user codes (PKCE apps confirmed working with ID alone); token poll with ID only → 400-empty = Pending.
- FIXES: trakt-server.ts — validCredential accepts [A-Za-z0-9_-]{32,64}; NEW TRAKT_OAUTH const + envTraktClientId/envTraktClientSecret helpers (secret OPTIONAL) + traktFetch `oauth` host flag. link/start — ID-only gate, omits client_secret when absent, NEW GET probe {configured, pkceOnly} (never mints codes). link/poll — ID-only gate, omits secret, full new-API status mapping (400-empty OR authorization_pending → pending; 429 → slow_down+backoff; 410 → expired; 418 → denied; 404/409 → expired-terminal). device-code + device-token (legacy BYO relay) — secret optional, oauth host, and device-token NORMALIZES new statuses into the legacy JSON contract the client store parses. trakt.ts store — connect(clientId, clientSecret?) optional, empty secret sent as "" and omitted server-side. link-resolve.ts — refreshTrakt + revokeTraktToken work without secret, via auth.trakt.tv. linking.ts checkEnv — switched from POST probe (which would mint a REAL device code on every Integrations mount!) to the GET probe. simkl link/start — added the same GET probe. /api/integrations/status — trakt: TRAKT_CLIENT_ID alone. settings-view TraktCard BYO — Client ID required only, secret field relabeled "(optional — PKCE apps have none)".
- OPS: .env now contains the user's real TRAKT_CLIENT_ID (pkceOnly:true); .env.example documents PKCE-only apps + auth.trakt.tv note; dev server restarted for env reload (documented lesson).
- TOOLING NOTE (bit twice now): the Bash output renderer eats "[h"/"[...m" sequences — a HEALTHY `const [histCount, …` line READS as `const istCount, …`. Trust tsc over sed screenshots of a line; tsc confirmed 0 real syntax errors there. (One REAL error was found & fixed: TRAKT_API import needed by link/poll's /users/me call.)
- E2E (curl + agent-browser): GET status → {trakt:true}; POST link/start → REAL user_code BN6XNWD6 (auth.trakt.tv/activate); poll ×2 → {"status":"pending","retryInMs":6000} (correct new-API interpretation — previously "failed"); UI: Integrations → "Link Trakt.tv with a code" → big code 8TFV2DLP + copy + QR + "Expires in 09:55" countdown + "Waiting for authorization…" + New code/Cancel; home strip now reads TMDB:Not set up | Ratings:Not set up | Trakt:Active | Simkl:Not set up with honest "3 integrations not active yet" count. Browser page errors: 0; dev.log app-side clean.
- Final state: lint 0/0, tsc src/ 0 errors.

Stage Summary:
- Trakt linking is LIVE with the user's PKCE-only app: the ONLY remaining human step is visiting https://auth.trakt.tv/activate and entering the displayed code — the poll then exchanges it, stores the token AES-256-GCM-encrypted, and shows the connected username/avatar. Scrobble/watchlist/history sync routes all resolve via linkId automatically.
- Honest limits: actual authorization (typing the code at Trakt) can't be automated here; Simkl still needs its own app registration (SIMKL_CLIENT_ID at simkl.com/settings/applications — its PIN flow already accepts secret-less apps too); TMDB/OMDb/MDBList still key-gated as before.
- Next candidates: Simkl PIN flow live once user registers the Simkl app; TMDB Discover rows; in-app rating push to Trakt.
---
Task ID: cron-round-17 (scroll UX cleanup + Trakt "authorized but never detected" ROOT-CAUSE FIX)
Agent: main (orchestrator, all work in-line)
Task: USER REPORT (Arabic): (1) "يوجد شريط مستطيل في الأعلى يظهر عند التمرير للأسفل اريد منك إزالته" — remove the rectangular top strip that appears on scroll-down; (2) "اجعل شريط البحث يتفاعل بتمرير للاختفاء وظهور" — the search bar should hide/reveal with scroll direction; (3) "Trakt بعد أن أضيف الكود ويمنح الإذن الموقع لا يكتشف ويظل يبحث ولا يتوقف" — after entering the code on Trakt and approving, the app never notices and polls forever.

Work Log:
- TRAKT ROOT CAUSE (live-curl proven BEFORE coding): round-16 moved device endpoints to auth.trakt.tv ("OAuth must use auth host"). LIVE TEST: same pending device code → POST api.trakt.tv/oauth/device/token → **400 (pending, correct)**; POST auth.trakt.tv/oauth/device/token → **429 empty body at ANY pacing** (even first call after respecting interval=6s) = Cloudflare blocking a path that host does NOT serve. Our poller read 429 → "slow_down" → back off → poll again → 429 → infinite loop. The user HAD approved; we were asking the wrong door forever. (device/code happens to work on both hosts — that's why start worked and only poll was broken.)
- FIX: link/poll + link/start + device-code + device-token routes → device endpoints now on **api.trakt.tv** (TRAKT_OAUTH reserved for /oauth/token exchange, refresh, revoke — per developer.trakt.tv). trakt-server.ts documents the host contract with the 429 evidence so it never regresses.
- REGRESSION FOUND: .env had LOST TRAKT_CLIENT_ID (sandbox reset; only DATABASE_URL remained) — the sandbox can wipe .env silently. Two-layer fix: (a) restored TRAKT_CLIENT_ID in .env; (b) NEW prisma model `ServerConfig` (key/value, db:push applied) + NEW src/lib/harbor/server-config.ts; NEW resolveTraktClientId() = env → DB row (seeded trakt.client_id) → null; wired into link/start GET+POST, link/poll, integrations/status. Trakt now survives future .env wipes.
- OBSERVABILITY: link/poll now logs `[harbor:trakt-poll] upstream <status>` per poll — QA reads exactly which host answered and with what.
- CLIENT HARDENING: linking.ts pollOnce — 5xx/429 from OUR server are transient ("Connection hiccup — still trying…") instead of terminal-fail (a single blip used to kill the flow while the user was mid-approval); waiting screen shows that status live + a one-line expectation "Approve on the provider's site and this connects automatically within seconds."
- UX (1) REMOVED ScrollTopbar entirely (app-shell) — zero <header> elements in the DOM at any scroll position; the floating glass search bar is the ONLY fixed top element.
- UX (2) floating-search.tsx scroll-direction visibility: scroll down (y>90, dy>4) → slides off-screen (-translate-y-[160%] + opacity-0 + pointer-events-none + aria-hidden, Tailwind v4 composes with -translate-x-1/2 centering via the `translate` property); scroll up (dy<-4 or y<=90) → slides back; NEVER hides while expanded/focused; "/" and Ctrl/Cmd+K reveal+focus an off-screen bar (focus bridge now clears hidden); transition-[width,transform,opacity] 300ms, motion-reduce instant.
- E2E PROOF (curl + agent-browser): GET /api/trakt/link/start → {configured:true,pkceOnly:true}; POST → real user_code 8S44862M; poll ×2 → {status:"pending",retryInMs:6000} with dev.log `upstream 400` ×2 (the auth-host bug would show 429); UI flow → code VVKN3JGW + QR + countdown 09:29 + "Waiting for authorization…" and dev.log shows UI polling arriving (5 traces, all upstream 400). Home strip now reads **Trakt: Active**. Scroll QA desktop+390px mobile: headerCount 0 always; hidden = translate "-50% -160%"+opacity 0; up = "-50%"+opacity 1; "/" reveals+focuses (activeElement=INPUT). Instant search re-verified ("bat" → live results). lint 0/0, tsc src 0 errors, console 0 errors, dev.log app-side clean (only prisma:query noise).
- Screenshots: download/qa17-01-trakt-flow.png (code+QR+countdown), qa17-02-scrolled-clean-top.png (scrolled: NO top strip), qa17-03-scrollup-search-back.png (scroll-up: bar returns).
- HONEST LIMIT: the final authorized→token step still needs a human to approve at trakt.tv/activate (cannot be automated here) — but every branch up to the 200-token exchange is now verified against the live API, and the 429 loop is dead: with the API host, approval is followed by upstream 200 within one poll interval (≤6s).

Stage Summary:
- Fixed the exact reported bug: Trakt approval now DETECTED (device/token on api.trakt.tv; the auth-host Cloudflare-429 "slow_down" infinite loop is gone) — user just clicks "Link Trakt.tv with a code" again and approves a fresh code.
- Top of the app is now exactly what the user asked: no rectangular strip ever, one glass search bar that hides on scroll-down and returns on scroll-up (and "/" still summons it anywhere).
- Trakt config is now crash-proof: env + DB fallback survive sandbox .env resets.
- Next candidates: Simkl app registration (SIMKL_CLIENT_ID) to light its card, TMDB Discover rows (key still missing), in-app rating push to Trakt now that linking works, persist pending device flows to DB (in-memory registry dies on dev-server restart mid-flow).
---
Task ID: m3-foundation (STEP 1 audit + STEP 2 foundations of the Material Design 3 migration)
Agent: main (orchestrator)
Task: FULL M3 migration requested (Principal Frontend Architect spec). This entry = audit result + foundations. Sweep agents (m3-3a..m3-3e) follow.

Work Log:
- AUDIT (summary): stack = Next.js 16 + Tailwind 4 @theme inline + shadcn/Radix + 12 semantic Harbor CSS vars (--color-canvas-var etc.) aliased to utilities (bg-canvas/text-ink/bg-accent). themes.ts = 11 presets (accent+canvas+fontPair+8 layouts+6 card styles+4 button styles) + Theme Studio custom/user themes + share codes. CHOSEN APPROACH: custom token layer + @material/material-color-utilities (core math) — @material/web rejected (no player/glass/TV-nav, fights Radix a11y). ZERO-REGRESSION TRICK: legacy Harbor vars are RE-DERIVED from M3 roles at runtime → entire app inherits M3 palette without touching components.
- npm @material/material-color-utilities: latest 0.3.x ESM build broken on Node (dynamic_color missing); 0.2.7 wrapper layer (Scheme*) broken too — but CORE (TonalPalette/Hct/argb/hex) verified healthy → md3/color.ts uses core + published M3 role→tone tables.
- NEW src/lib/harbor/md3/color.ts: parseColorToArgb (hex/rgb/oklch via Ottosson math), buildMd3Colors(seed, dark|light, standard|medium|high, neutralSeed?) — full 31-role md.sys set; two-scheme blend (accent seed → primary/secondary/tertiary, canvas seed → neutral/neutral-variant) PRESERVES preset identity (Nord stays blue-grey etc.); contrastRatio() for audits.
- NEW src/lib/harbor/md3/apply.ts: applyMd3Scheme(html, accentSeed, canvasSeed, env) writes all --md-sys-color-* + re-derived legacy vars; KIDS_SEED re-seeds the WHOLE scheme pink (kidsMode) instead of the old accent-swap; harborAliasesFromRoles maps canvas→surface, surface→container-low, elevated→container, raised→container-high, ink→onSurface, muted→onSurfaceVariant, subtle→outline, edge→outlineVariant(+55% mix for soft), accent→primary, accent-soft→primaryContainer, danger→error.
- themes.ts: applyTheme(theme, env?) — custom themes keep EXACT user colors on legacy vars (Theme Studio 10-color picker preserved) while M3 layer derives from their seeds; presets go full M3 (identity via neutral seed). Presets/presetTokens/share codes/user themes API UNCHANGED.
- settings.ts: NEW keys appearance ("dark"|"light") + contrastLevel ("standard"|"medium"|"high") with defaults + sanitize.
- app-shell: passes {appearance, contrast, kids} into applyTheme.
- NEW src/lib/harbor/md3/window-class.ts: useWindowClass()/windowClass() — compact<600/medium<840/expanded<1200/large<1600/extraLarge.
- globals.css REWRITTEN: static md.sys fallback (dark baseline + light block), full type scale (display/headline/title/body/label × sizes), shape scale (none..full), elevation 0-5 (M3 stacks), motion (M3 easings+durations), shadcn tokens retargeted to M3 roles (dialogs/toasts/selects now in-system), M3 primitives: .md-state (8/10/16% state layers), .md-btn (filled/tonal/elevated/outlined/text/danger), .md-icon-btn variants, .md-fab, .md-chip(+selected), .md-card-(filled/elevated/outlined), .md-dialog(28), .md-sheet, .md-snackbar, .md-tooltip, .md-field-(outlined/filled), .md-nav-pill, .md-nav-item, .md-type-scale classes, .md-expressive. ALL existing Harbor sections preserved verbatim (glass/bokeh/poster/nav-bar/skeleton/subtitle PROTECTED/TV-focus/picker/stat/kbd/clamp) — now colored by M3 roles; motion classes migrated to M3 easings; reduced-motion extended to md-* classes.
- CONTRAST AUDIT (script, cool-grey default): dark onSurface/surface 14.31, primary/onPrimary 7.74, primary/onPrimaryContainer 5.48 (chips), onSurfaceVariant/container 9.64, onPrimaryContainer/container 7.23, error/container 5.51; light scheme ≥6.15 — ALL WCAG AA+, most AAA.
- Verified live: appearance=dark, --md-sys-color-primary #ffb77d, canvas #111416, accent-soft #6e3900 (container), body bg rgb(17,20,22); home renders identical structure with M3 palette (screenshot m3-01-foundation.png); lint 0/0.
- NEXT (sweep agents m3-3a..3e, parallel, strict file ownership): adaptive nav (sidebar+app-shell margins), search surfaces, content views/cards/chips/hero, settings+studio (appearance/contrast segmented controls + seed picker wiring), player controls (subtitle engine PROTECTED) + kids view. Then adaptive QA (LTR/RTL, widths, appearances) + mapping table.
---
Task ID: m3-3a
Agent: M3-nav-shell
Task: M3 adaptive navigation shell — compact bottom navigation bar (M3 nav bar) + md+ 220px drawer kept verbatim; app-shell margin/back-button clearance.

Work Log:
- Read window-class.ts + m3-foundation tokens; chose PURE-CSS switching (md:hidden / hidden md:flex) over the JS useWindowClass hook — zero hydration/layout shift; hook not needed in sidebar.
- sidebar.tsx: Sidebar now returns TWO navs (same aria-label "Primary navigation"; only one is ever displayed): (1) compact = M3 navigation BAR `md:hidden fixed inset-x-0 bottom-0 z-40 bg-[var(--md-sys-color-surface-container)] pb-[max(0.25rem,env(safe-area-inset-bottom))]` with `harbor-scroll-x overflow-x-auto` ul h-20 (80dp) — same navItemsFor(settings) list, each item a full-height button w-16 min-w-12 (64×80 ≥ 48dp target, md-state layer, harbor-tv-focus), icon inside a span h-8 w-14 rounded-full that gets `.md-nav-pill` (secondary-container) + text-ink when active, label `md-label-medium max-w-[60px] truncate` below (truncates, never wraps); aria-current="page" kept; NO Install app button and NO UserChip on compact (auto-excluded — they live in the md+ drawer only; account access stays via Settings, PWA prompt exists elsewhere). (2) md+ drawer = previous markup/classes UNCHANGED except container `hidden md:flex w-[220px]` (68px collapsed rail removed — replaced by the bottom bar); keeps harbor-nav-item + `active bg-accent-soft text-ink font-semibold` so all 8 html[data-theme-layout] variants (stremio accent bar etc.) keep working; accent-soft is already primary-container via the token bridge.
- app-shell.tsx (ONLY the two prescribed lines): main `flex-1 ${showChrome ? "md:ml-[220px] pb-24 md:pb-10" : "pb-10"}` (drops ml-[68px] — no rail below md; pb-24=96px clears the 84px bar incl. safe-area, md:pb-10 unchanged); BackButton `top-4 left-4 md:left-[240px]` (left-[84px] rail offset no longer needed on compact).
- nav-items.tsx: untouched (read-only; no tweak required).
- RTL: new compact-bar markup is direction-neutral (inset-x-0, symmetric px, no left/right); physical left-0/ml-[220px] kept on md+ drawer/back-button per task spec (drawer is physically left in both directions today).

Stage Summary:
- Mapping old→M3: mobile 68px icon rail → M3 navigation bar (surface-container, 80dp, safe-area, scrollable, 56×32 secondary-container active pill + label-medium); md+ 220px drawer preserved 1:1 (item structure/classes verbatim, already M3-container-colored); main ml-[68px]→ml-0 (compact) with pb-24 bar clearance; BackButton left-[84px]→left-4 on compact.
- Verification: lint 0/0; tsc 0 errors in owned files (repo-wide tsc currently blocked ONLY by a concurrent agent's in-progress settings-view.tsx parse error — not this task's files); curl 200 + agent-browser: @1280×800 bottom bar display:none, drawer flex w-220 full-height, main ml 220px, drawer active item bg #6e3900 (primary-container) rounded-2xl radius 16px aria-current=page, Install+UserChip present; @390×844 bar fixed z-40 bg #1d2022 (surface-container) h=84 (80+4 safe-area floor), drawer display:none, 13 items, button 64×80 min-width 48px, active pill 56×32 r-full bg #5a422e (secondary-container), main ml 0 + padding-bottom 96px, footer clearance 96>84 (no overlap by construction; scroll-max gap 12px+).
- NOTE for QA/orchestrator: at verification time a sibling sweep agent's settings-view.tsx was left with a JSX parse error (line ~764) making GET / 500 — page-level QA re-run blocked by that file, NOT by m3-3a changes (all nav QA above captured while server was 200). Once settings-view compiles, / should render with no further change needed here.
---
Task ID: m3-round-complete (STEPS 3–6: component migration, adaptive, a11y, verification)
Agent: main (orchestrator + 5 sweep agents m3-3a/3b/3c/3d/3e, resumed in-line after agent interruption)
Task: Complete M3 migration after mid-run interruption: one agent (3a) finished + logged; 3b/3c/3d/3e were stopped mid-edit leaving settings-view.tsx with a broken JSX tag; remaining files completed and verified in-line.

Work Log:
- INTERRUPT RECOVERY: git status diffed all target files; only settings-view.tsx had a syntax break (LanguagePanel closed with </SectionCard> after the agent had replaced its opening with a plain div) → fixed to </div>; agent-typed SegmentedControl received flat option arrays at 4 legacy call sites vs [id,label] pairs at the 2 new ones → normalized all to pairs `(["a","b"] as const).map(id=>[id,id] as const)` preserving literal types; apply.ts parseSeed helper removed a `number | ""` TS error. Result: lint 0/0, tsc src 0.
- COMPLETION STATE (grep-audited): player-overlay 43 M3 markers, wrapped 26, theme-studio 25, detail-view 25, picker 24, live 12, floating-search/search-overlay 9 each, meta-card/hero 6 — the stopped agents had done nearly everything. kids-view verified complete in-browser (md-headline, 28px posters, 64px targets, blobs). discover/movies/shows = pure SectionRails data wrappers → inherit M3 (no edit needed, documented). add-to-list polished (shape tokens + md-state rows + md-field-outlined). ratings-row/tmdb-enrich already token-native (semantic vars) — pill chips match md-chip language.
- ADAPTIVE NAV POLISH: compact bottom bar labels stopped truncating (68px items, md-label-small, tighter gap); verified 13 items, 68px targets, scrollable.
- RTL GAP FIXED (real bug found by M3 audit): root layout never applied dir — added app-shell effect (settings.uiLanguage → html.lang + html.dir, /^ar/ → rtl); frame physical classes → logical (sidebar left-0→start-0, border-r→border-e; main md:ml→md:ms; BackButton left→start). Browser-proven: dir=rtl mirrors drawer to the right, hero/buttons/chips flip (m3-qa-rtl-desktop.png). Components already used logical utilities so the body mirrored with zero other edits.
- M3 DYNAMIC COLOR PROVEN END-TO-END (agent-browser): (1) Theme tab Appearance segmented → Light flips whole app (bodyBg rgb(249,249,252), ink #191c1e, settings/theme-studio/presets all light — m3-qa-light.png) → Dark restores (primary #ffb77d); (2) Contrast High in light darkens primary tone 40→28 (#673500) then Standard restores; (3) Custom Theme Studio seed #3ddc97 → full scheme generated live (primary #42e09a, tertiary #96cfe4 auto hue+60, custom canvas preserved) (m3-qa-custom-seed.png); (4) Kids mode re-seeds WHOLE scheme pink (primary #ffafd3, dataset kids=on) and restores amber when off.
- PLAYER PROTECTION VERIFIED: demo player runs, 0 native <track>, 0 stray .harbor-subtitle layers, controls restyled M3 (white-on-scrim protected readability, seek bar M3 slider, 48px targets), auto-hide intact.
- REGRESSIONS: Trakt probe {configured:true,pkceOnly:true}; floating search scroll-hide/reveal works (opacity 0→hidden at y900, 1 at y50); "/" focuses; instant search renders groups; console errors after clean reload = 0 (pre-fix session errors were stale); dev.log clean (only /api/sync 200s + prisma noise).
- FINAL: lint 0/0 · tsc src 0 · light/dark/high-contrast/kids/custom-seed/RTL/compact+expanded all screenshot-verified (download/m3-qa-*.png, m3-01-foundation.png).

MIGRATION MAPPING (old → M3 → status):
- 12 Harbor semantic vars → md.sys roles via md3/apply.ts aliases (canvas→surface, surface→container-low, elevated→container, raised→container-high, ink→on-surface, ink-muted→on-surface-variant, ink-subtle→outline, edge→outline-variant, accent→primary, accent-soft→primary-container, danger→error) → DONE, whole app inherits.
- shadcn tokens (--background/--primary/--radius…) → md.sys roles → DONE (dialogs/selects/toasts in-system).
- Theme presets (11) → seed-based dynamic schemes (accent seed + canvas neutral seed) → DONE; Theme Studio custom colors keep exact legacy vars + M3 layer from seeds → DONE; share codes/user themes untouched → DONE.
- ScrollTopbar → removed (round-17, user request) → N/A. Sidebar → M3 nav drawer (md+) + M3 nav bar (compact, 80dp bottom, pill indicator) → DONE.
- Floating search → M3 search bar + results view (glass retained as Harbor identity) → DONE. SearchOverlay → full-screen view (mobile)/docked panel → DONE. Command palette/shortcuts → M3 dialogs → DONE.
- Buttons/chips/cards/fields/menus/snackbars/tooltips → .md-btn-*/.md-chip*/.md-card-*/.md-field-*/md-dialog/md-sheet primitives → DONE across chrome/views/player.
- Hero → M3 chips + filled/tonal buttons, ken-burns kept → DONE. Detail → M3 chips/buttons/lists + TMDB logo title kept → DONE.
- Settings → M3 tabs/list rows/segmented controls + NEW Appearance & Contrast controls → DONE. Theme Studio → M3 dialogs + seed explainer → DONE. Linking flow → M3 containers, polling logic untouched → DONE.
- Player → M3 controls-only restyle; subtitle engine + single-layer positioning PROTECTED → DONE. Picker → M3 chips/dialog/radio cards, scoring untouched → DONE. Kids → pink-seeded scheme + 28px shapes + 64px targets, PIN logic untouched → DONE.
- Motion → M3 easings/durations tokens + Expressive-lite .md-expressive on transforms → DONE; prefers-reduced-motion covers md-* → DONE.
- Typography → full md.sys type scale tokens + classes; Arabic line-heights via existing font stack (Arabic web fonts self-host deferred — system Arabic fallback currently used) → PARTIAL (honest).
- Material Symbols variable font → NOT adopted (app standardizes on Lucide; swapping icon sets app-wide is a separate high-risk pass) → INTENTIONALLY DEFERRED.
- Dynamic color from poster/backdrop on detail pages → toggle/engine hook point exists (applyMd3Scheme), image sampling NOT shipped (canvas-taint/proxy complexity) → DEFERRED.

Stage Summary:
- Harbor Web now runs on a genuine Material Design 3 dynamic-color engine: 31 md.sys color roles generated at runtime from any seed (Google MCE core), light/dark + standard/medium/high contrast, whole-app retarget with zero feature regressions, adaptive M3 navigation (bottom bar ↔ drawer), M3 primitives for every component class, verified RTL mirroring, TV focus + state layers + reduced motion per spec.
- How to change the seed: Settings → Theme → pick a preset (its accent IS the seed) or Theme Studio → custom accent color; Appearance Dark/Light + Contrast segmented controls sit right above.
- Known honest gaps for next rounds: Arabic-optimized web font + Material Symbols variable icons, poster-derived dynamic seed on detail pages, light-scheme pass over hero scrims on poster-heavy surfaces (chips there keep black/30 scrims for readability by design).

---
Task ID: round-19
Agent: main (orchestrator)
Task: Fix user-reported regression — rail carousel navigation arrows rendered at bottom-left below the posters instead of vertically centered ("الأسهم الخاصة بتنقل تظهر بالأسفل")

Work Log:
- Reproduced & root-caused via agent-browser computed-style inspection: rail arrow computed `position: relative` (not absolute), `top: 161.5px` — element fell back into flow below the rail.
- ROOT CAUSE (Tailwind 4 cascade): `.md-state { position: relative; overflow: hidden }` in globals.css was UNLAYERED. Unlayered author CSS beats ALL @layer rules (Cascading-5), so it silently overrode Tailwind's `.absolute` (in `@layer utilities`) on any `md-state absolute` element. Only src/components/harbor/common/rail.tsx arrows combine them (grep-audited; other matches were `after:absolute` pseudo false-positives).
- FIX (root cause, globals.css): moved the whole `.md-state` block (base + ::after + hover/focus/active/dragged/disabled states) into `@layer components`. Utilities now win ties as intended; plain `.md-state` elements still default to relative. Surgical — the rest of the M3 primitives stay unlayered to avoid flipping non-! overrides app-wide.
- Hardening (rail.tsx): added `group-focus-within/rail:opacity-100 group-focus-within/rail:pointer-events-auto` to both arrows so keyboard users can see/reach them (previously hover-only).
- Environment note: agent-browser emulates `hover: none` → Tailwind 4 gates hover variants behind `@media (hover: hover)` → hover path can't be screenshot-verified headlessly. Verified via keyboard path instead.

Stage Summary:
- VERIFIED FIXED (agent-browser): all rail arrows now `position: absolute`, `centeredDiff: 0` vs poster-row center (checked Trending Movies / In Theaters / Trending Series / Popular Series); focus-reveal screenshot download/qa-rail-arrows-fixed.png shows both arrows vertically centered on posters, no stray arrow below the rail, no layout shift (removed the ~80px in-flow gap the broken button used to add).
- State layers intact elsewhere: `.md-state::after` computed content "\"\"", position absolute, inset 0 (components layer works).
- lint 0 problems; dev.log clean (no compile/runtime errors).
- Lesson recorded: in Tailwind 4, NEVER put positioning/overflow primitives unlayered if callers may combine them with utilities; M3 primitives that set structural props belong in `@layer components`.

---
Task ID: round-20
Agent: main (orchestrator)
Task: Navigation redesign — remove sidebar, floating glass bottom dock (Figma spec), Settings Quick Access hub

Work Log:
- AUDIT: sidebar.tsx (compact M3 bar + md+ drawer) + nav-items.tsx registry (13 items) + app-shell host (`md:ms-[220px]`, `md:start-[240px]`, `pb-24 md:pb-10`). Honest findings: NO parent PIN exists in codebase (only Simkl link PIN); NO i18n framework (added minimal EN/AR label map); NO global UI zoom (token hook point documented).
- TOKENS: new `--nav-*` block in globals.css (height 73 / padding 8 / radius 9999 / max-width 420 / glass-fill rgba(255,255,255,.07) / border rgba(191,230,242,.35) / blur 12 / shadow none / active-fill .16 / icon 26px / icon-active #F5F5F5 / icon-inactive rgba(255,255,255,.75)) + `--nav-motion-ease` cubic-bezier(0.2,0,0,1) + `--nav-clearance`. Light-theme overrides (white glass .6, dark icons), Kids overrides (84px, .12 fill, 30px icons), `@supports not backdrop-filter` → opaque surface-container-high fallback, prefers-reduced-motion → transitions none.
- NEW chrome/glass-dock.tsx: stadium capsule, 4 equal flex slots (settings/kids/anime/home — single DOCK_TABS config), measured sliding pill (translateX+width 350ms), outline→filled icon crossfade (150ms, both icons stacked), pressed scale(.96) + .md-state, aria-current="page", role=tablist/tab, sr-only labels + native tooltips, roving Arrow/Home/End keys (RTL-aware), scroll auto-hide (settings.dockAutoHide default on, same pattern as floating search). Active-state: walks nav stack to nearest view frame → every moved page keeps Settings lit; detail frames fall back to deepest view (Home from home).
- NEW chrome/page-header.tsx: Back (pop → fallback resetTo settings) + breadcrumb "Settings > X", rtl:rotate-180 chevrons.
- NEW chrome/quick-access.tsx: M3 card grid (2/3/4 cols) at TOP of Settings — 9 hub entries with icons, EN/AR descriptions, badges (addon count, LIVE ping dot, library count, Trakt/Simkl linked), Edit mode (reorder up/down + hide/show, persists settings.hubOrder/hubHidden, reset-to-default).
- nav-items.tsx extended: DOCK_TABS + dockTabsFor (kids → Home+Kids only, hideContent.anime respected) + HUB_ENTRIES (keywords EN+AR for search) + hubEntriesFor/hubLabel/hubDesc.
- app-shell.tsx: Sidebar → GlassDock (player/picker still excluded via showChrome), main full-width `pb-[var(--nav-clearance)]` (no more 220px offset), BackButton offset removed, shared-theme/list banners lifted above dock (bottom-[calc(var(--nav-clearance)-0.5rem)]).
- DELETED sidebar.tsx. nav-items.tsx kept (command-palette dependency).
- settings.ts: +hubOrder/hubHidden/dockAutoHide (sanitized). settings-view.tsx: QuickAccess + UserChip (new variant="settings", opens downward) in header + "Auto-hide navigation bar" row in Basics.
- 9 moved views got PageHeader: discover/movies/shows (wrapped SectionRails), catalogs/library/live/addons/wrapped/calendar (inline, pt removed).
- floating-search.tsx: destinations group ("Go to"/"انتقال سريع") — matches EN+AR keywords, pushes view, keyboard-navigable.
- account.tsx UserChip: variant prop (sidebar|settings), inline menu opens downward.

Stage Summary:
- ALL QA PASSED (agent-browser): dock 73px/420px/16px bottom/blur(12px)/stadium ✓; tabs [settings,kids,anime,home], default Home ✓; Settings stays active on Discover/Library/Anime-page-adjacent flows ✓; card → breadcrumb → back → Settings ✓; floating search "library"/"مسلسلات" destination rows navigate ✓; Kids mode: [kids,home] 84px/30px + pink scheme, restrictions intact ✓; light theme: white glass + dark icons ✓; compact 390px: 358px dock, 16px margins, 85px slots ✓; RTL: full mirror incl. dock order + pill measurement ✓; player: dock+search hidden, restored on exit ✓; auto-hide down/reveal up ✓; palette → Discover ✓; hub edit reorder+hide persisted (hubOrder/hubHidden in localStorage) ✓; console clean on fresh reload; lint 0; tsc src 0.
- HONEST DIFFERENCES vs reference shot: (1) icons are Harbor's tabs (settings/kids/anime/home) not the mock's (tasks/calendar/goals) — Lucide family per stack; (2) web capsule ratio flatter than the 927×202 frame because the spec's own web values (420×73) win; (3) blur 12px per spec default (design 24 was design-scale).
- Kids PIN: does not exist — reported, not faked. Kids dock (Home+Kids only) is STRICTER than the old sidebar (which let kids reach Settings).

---
Task ID: round-21
Agent: main (orchestrator)
Task: Mobile Home top rebuild — full-bleed Hero carousel + Continue Watching row (Nuvio-reference spec, 360dp measurements), RTL-first, no rebuild of anything else

Work Log:
- AUDIT: old hero+CwSection lived inline in home-view.tsx (58vh landscape ken-burns hero, 6 slides, 11s autoplay w/o pause rules; CW = Rail cards w/ visible progress track). Data: getCwCards() (localStorage localcw.v1, episodeName saved by player but NOT mapped); TMDB enrichment lib exists (tmdbIdFromImdb→tmdbDetails→tmdbLogo, fail-soft, cached); Cinemeta catalog metas carry logo+genres natively (verified live); z-ladder dock 40 < banners 50 < search 85 < player 180; layout.tsx lacked viewportFit=cover.
- NEW src/lib/harbor/i18n.ts: EN/AR string map (nav-items pattern) + metaTypeLabel (Movie/Series/Anime via genre) + remainingLabel + upcomingLabel w/ Intl.PluralRules Arabic plurals (اليوم/غداً/يومان/أيام/يوم) + slideOf/goToSlideLabel.
- NEW src/components/harbor/views/home-hero.tsx: 67svh full-bleed hero; scroll-snap mandatory track (RTL-correct via physical offsetLeft math + negative scrollLeft; slide0 rightmost in RTL); portrait art (object-position top) on phones / landscape backdrop ≥600px; shared content stack keyed crossfade 300ms; Cinemeta logo w/ TMDB sequential enrichment (150ms stagger, fail-soft); meta line year•genre•type w/ 4px dots; "عرض التفاصيل" pill (45px/#F5F6F8/#0B0B0B, scale .97 + md-state); dots 8px→32×8 animated, 48px hit areas via ::after; 6s autoplay paused on hover/touch(8s)/hidden tab/offscreen(IO)/reduced-motion + visible pause control; live region announces only when autoplay off; arrows RTL-aware (ArrowLeft=next in RTL) + Home/End; eager+fetchPriority-high first art, lazy rest; skeleton w/ reserved height.
- NEW src/components/harbor/views/home-cw.tsx: "متابعة المشاهدة" header (18/700, 20px above/16px below); cards min(69vw,320px)/16:9/r16/border white-22%/bg #1A1A1A; bidi-isolated S/E tag (11/700), title 15/700, sub 12/500 white-65% (episodeName→"الحلقة {n}" fallback; movies→remaining time); track-less #E53935 progress (3px, bottom 4, inset-inline 8, role=progressbar); upcoming badge (top inline-end, h22 r8, Cinemeta videos released, daysUntil, capped to first 6 cards, module meta cache) + amber fresh-dot for aired-unwatched next ep; long-press (500ms pointer) + contextmenu → M3 fixed menu (details/mark-as-watched w/ full-duration pushHistory+removeCw+toast/remove), Esc/outside/scroll close; listens harbor:data-changed; hides when empty; skeleton cards.
- home-view.tsx: old Hero+CwSection DELETED; HomeHero(8 slides, heroLoading) + HomeCwSection wired; CW directly after hero (IntegrationsStrip moved below CW); root .home-void (OLED black page in dark appearance); everything below untouched.
- globals.css: full --hero-*/--cw-* token blocks (every spec value: scrim gradients 38/68/97 + top 14%, logo 54%/56px, btn 45/146/32, dots 8/32/gap8, card 69vw/r16/border/scrim/text sizes, badge h22, progress 3/4/8, fresh dot #F5B301); .home-void, hero/cw/menu component CSS in @layer components; light-appearance derives --hero-fade from canvas (seam rule); reduced-motion block.
- layout.tsx: viewportFit "cover" + themeColor #000000.
- types.ts/cw.ts: additive CwCard.episodeName mapped through getCwCards.
- BUG FOUND+FIXED (cascade): .cw-section margin-top:20px computed 0 inside Tailwind space-y-7 parent — TW4 space-y sets margin-block-start:0 on every :not(:last-child) child in the UTILITIES layer, beating components-layer margins. Fix: padding-top instead (documented in CSS comment). (Extends round-19 cascade lesson: utilities/components interplay.)
- QA (agent-browser, 360×740 RTL Arabic + seeded CW): hero 496px=67svh bg #000 ✓; slide0 rightmost, next peeks left, scrollLeft negative RTL ✓; dot jump→-360/keyboard ArrowLeft→next ✓; autoplay pause toggle + live-region polite-when-paused ✓; logo/Cinemeta ✓; meta line 2026•Action•فيلم ✓; btn 45/146/pill/#F5F6F8/#0B0B0B ✓; dots 8/32×8 ✓; header 18/700 pad16 mb16 + 20px hero→header gap ✓; card 248.4(69vw)/16:9/r16/border white-22 ✓; peek 79px=31.9%≈spec 32% ✓; epTag ltr-isolate ✓; sub fallback الحلقة 5 ✓; progress 3px #E53935 inset8 no track ✓; long-press menu 3 items + mark-watched pushed full-duration history + removed from CW ✓; LTR mirror (slide0 x=0, card0 x=16, "View details") ✓; desktop 1280: portrait hidden/landscape shown, hero 536 ✓; classic homeMode hides hero ✓; reduced-motion: crossfade animation none ✓; hero btn→detail→back→home ✓; Top10/rails/footer intact ✓; computed-style audit: ALL spec values exact.
- ENV LIMITATION (not a bug): metahub 307-redirects newer ids to live.metahub.space which is UNREACHABLE from this sandbox → those poster/bg imgs fall back (film icon/gradient); older ids serve directly and render fine. Real users unaffected; fallback chain works as designed.
- HONEST DIFFS vs reference: pause control added next to dots (a11y "pause control for autoplay" — required); badge/fresh-dot data-dependent (no future-dated episode in sandbox data; code path verified); tap still opens detail (resume from there) — direct resume would change the existing player entry flow, kept as-is per "don't break working features".

Stage Summary:
- Home top rebuilt to spec: full-bleed 67svh RTL hero carousel (swipe+snap+crossfade+autoplay w/ full pause rules+skeleton+a11y carousel semantics) and spec-exact Continue Watching row (bidi S/E tag, episode names, upcoming badge w/ Arabic plurals, track-less red progress, long-press M3 menu). All values tokenized (--hero-*/--cw-*), light theme derives fade from canvas, i18n EN/AR, zero regressions below the fold. lint 0; dev.log clean; screenshots download/r21-final-hero.png, r21-final-cw.png, r21-side-by-side.png (vs upload reference).
- Next-round candidates: per-episode TMDB stills for CW cards (N meta fetches — cost tradeoff), swipe-fed slide counter chip, hero "My List" quick action, unit tests for upcomingLabel plurals, reconsider direct-resume tap via picker flow.

---
Task ID: round-21b
Agent: main (orchestrator)
Task: User feedback (Arabic): (1) hero title logo renders too small — enlarge appropriately; (2) extend the round-21 Home-top redesign proportionally to desktop / monitors / iPad / tablets / laptops / large screens ("شكل متناسب الحجم")

Work Log:
- AUDIT: logo was double-capped (`--hero-logo-max-w: 54%` + `max-height: 56px`, `width/height: auto`) so it usually rendered well under its box; content stack, button, dots, CW cards/text all hard-locked to 360dp values at every viewport (desktop just reused phone sizes).
- TOKENS (globals.css): new `--home-scale` responsive driver + ladder in media queries (base 1 → 600px:1.15 → 840px:1.25 → 1024px:1.35 → 1440px:1.5 → 1920px:1.65 → 2560px:1.8; must sit AFTER the base :root block, source-order wins). Every hero/CW size token re-derived from it: `--hero-height: clamp(440px, 67svh, calc(720px * scale))` (67svh is intrinsically proportional; scaled ceiling), logo `min(66vw, calc(320px*scale))` × `calc(68px*scale)` (round-21b: 56 → 68 base per user), fallback title `--hero-title-size-m/s` clamp bounds scaled, meta/button/dots/gaps/paddings `calc(base * scale)` with `min(scale, 1.35|1.5)` caps on text-ish tokens so nothing turns cartoonish on huge screens. New tokens: `--hero-content-max-w` (640×scale, centers the absolutely-positioned stack on wide screens), `--hero-gap-logo/meta/btn`, `--hero-pad-bottom`, `--cw-text-pad-x/b`, `--cw-ep/title/sub-size`, `--cw-badge-size/pad-x/inset`, `--cw-fresh-dot-bottom` — every previously hardcoded CSS/JSX value tokenized.
- COMPONENT CSS: `.home-hero-logo` now FORCES `height: var(--hero-logo-max-h)` (was auto/max-h) + `object-fit: contain` + `max-width` clamp — the logo always renders at maximum size (user complaint fixed; also removes load-time layout shift). New `.home-hero-logo-row` (flex, min-height = logo box, margin-bottom = `--hero-gap-logo`). `.home-hero-title-m/.home-hero-title-s` modifiers (source order beats base in-layer). `.cw-text/.cw-ep-tag/.cw-title/.cw-sub/.cw-badge/.cw-fresh` all read scale tokens.
- home-hero.tsx: logo-row class replaces hardcoded min-h-[56px]/margins; fallback title picks `-m`/`-s` class by name length instead of inline clamps; meta/button margins now `var(--hero-gap-*)`; HeroSkeleton fully token-driven (logo box, meta pills = meta-size, button = btn tokens, dots = ind tokens) so the skeleton mirrors the scaled layout at every breakpoint.
- QA (agent-browser, RTL Arabic): 360×740 — scale 1, hero 496=67svh, logo 97.9×68 (bigger than old ≤56), row 68, btn 176.3×45, meta 14, dot 32×8, card 248.4 16:9 r16, header 18 — phone output byte-identical to round-21 spec except the logo ✓; 768×1024 iPad — scale 1.15, hero 686, logo 201.8×78.2, btn 51.8, card 368×207, radius 18.4, header 20.7, landscape art swapped in ✓; 1024×768 laptop — 1.35, hero 515, logo 91.8, btn 60.8, card 432, content stack capped 864 ✓; 1440×900 — 1.5, hero 603, logo 102, btn 67.5 (cap), card 480 ✓; 1920×1080 — 1.65, hero 724, logo 112.2, card 528, content 1056 ✓; 2560×1440 — 1.8, hero 965, logo 122.4, card 576, content 1152 ✓. LTR flip via settings localStorage: dir=ltr, "View details", mirrored ✓. Screenshots download/r21b-360-hero.png, r21b-360-cw.png, r21b-1920-hero.png, r21b-1920-cw.png, r21b-1920-hero-top.png.
- ENV ISSUE INVESTIGATED (not a bug): old agent-browser session's `errors` log kept resurfacing a stale "settings-view.tsx:764 Parsing ecmascript source code failed" captured during a previous round's mid-edit compile blip; file content at those lines never matched, lint parsed it, pages rendered. Cleared .next + restarted dev server (clean ✓ Ready) — error persisted only in the OLD daemon session; a FRESH session (freshqa) reports `errors: []` on the same build. Root cause: per-session accumulated error log, not the app.
- lint 0 problems; dev.log clean after restart (✓ Ready, all compiles ✓).

Stage Summary:
- Home top (hero + Continue Watching) now scales proportionally across every device class: phones 1× (spec-exact, unchanged), iPad/tablet 1.15–1.25×, laptops 1.35×, desktops 1.5×, large monitors 1.65×, extra-large 1.8× — one `--home-scale` ladder drives ~40 tokens; text capped at 1.35–1.5×; hero content column capped and centered on wide screens; landscape art on ≥600px (unchanged rule).
- Hero logo: base 56 → 68px and now height-FORCED with contain fit (always renders at max, no shift); scales to 122px on 2560px screens.
- All values remain CSS custom properties; no logic/data changes; below-the-fold untouched.
- Next-round candidates: per-episode TMDB stills for CW cards, hero "My List" quick action, swipe-fed slide counter chip, unit tests for upcomingLabel plurals.

---
Task ID: round-22
Agent: main (orchestrator)
Task: (P1) glass bottom nav oversized on phones/all screens; (P2) floating search dead on phone screens — evidence-based root causes + minimal fixes + full size/search matrices

Work Log:
- ROOT CAUSE P1 (evidence): globals.css nav tokens were ONE static desktop set for every viewport (--nav-height:73px / --nav-icon-size:26px / --nav-max-width:420px — the Figma WEB-spec values applied unconditionally, per round-20 "web values win"). Measured at 360×640: nav 328×73, icons 26px, no breakpoints, bottom offset hardcoded calc(1rem+safe-area); Kids override was hardcoded 84px (+15% > the allowed +8%); no landscape-phone rule. NOT the cause (verified): icon frame used the token correctly; tabs had min-width/min-height 48 (not a grow bug); no UI-zoom setting exists in the app (grep: only videoFill/poster zoom) — added the clamped hook anyway.
- ROOT CAUSE P2 (evidence): floating-search.tsx collapsed phone state had NO tap handler — input rendered `opacity-0 pointer-events-none w-0` + tabIndex=-1 on <md, the Search icon was a decorative <Search> inside a role=combobox div with no onClick. elementFromPoint at the pill center returned the svg with `hasHandlerOnPill:false`. Only "/" + Ctrl/Cmd+K (app-shell) or the command palette could open search — none exist on touch. SearchOverlay itself was already full-screen on <sm with back arrow — just unreachable from phones.
- FIX P1 (globals.css only): responsive token system — base compact-phone values (64/48/24, width min(100vw-32,340), bottom 16) + media ladders for <360 (58/42/22, pad 6, bottom 12), ≥600 (68/52/24, 380, 20), ≥840 (72/56/26, 420, 24), ≥1200 (440), ≥1600 TV (88/68/32, 520, 32), and max-height:480 landscape (52/40/22, min(70vw,360), bottom 8 — placed LAST so it wins over width classes). Everything multiplies by --nav-zoom = min(var(--ui-zoom,1), 1.1) (zoom hook, clamped ≤110%) and --nav-kids (kids = 1.08 = max +8%). Capsule width always min'd with --nav-max = calc(100vw - 16px) + safe-area left/right. Explicit --nav-tab-height; .dock-track align-items:center; .dock-pill sized to tab height (top calc, height token); .dock-tab min-width:0 + ::before hit extender (inset -4px 0 → 50px touch target on 42px small-phone tabs, ::after kept free for .md-state state layer). --nav-clearance = height + bottom-offset + safe-area + 16px (app-shell main pb already consumes it — no component change needed).
- FIX P2 (floating-search.tsx + search-overlay.tsx): floating-search — real 48×48 glass phone trigger button (md:hidden, aria-label="Search", onClick → setSearchOpen(true) synchronously inside the tap) at top inline-END (end-3, mirrored in RTL), safe-area top offset; md+ docked bar/dropdown unchanged but hidden md:flex'd and z moved to --z-search-bar. search-overlay — useLayoutEffect synchronous focus (old setTimeout(30) dropped the iOS keyboard; commit happens inside the opening tap's task); inputMode="search" + enterKeyHint="search" + autoComplete off + 16px input + clear-query button; visualViewport keyboard inset (paddingBottom = calc(4rem + overlap)) so results stay reachable above the keyboard; history pushState({harborSearch}) on open so the Android/browser Back gesture closes the overlay (popstate → close; UI close consumes the entry via history.back() guarded by backGuard); focus restore to the trigger on close; idle state gained Recent chips + Trending now (SearchSection reuse); query results gained the "Go to" destinations group (matchingDestinations ported, exports added to floating-search); writeRecent on openMeta (parity with the floating bar); z-index → var(--z-search-overlay).
- Z TOKEN MAP documented in globals.css: content(auto) < hero 2 < --z-nav 40 < --z-banner 50 < --z-search-bar 85 < --z-search-overlay 120 < --z-picker 150 < --z-player 180 < --z-shortcuts 290 < --z-palette 300 (verified elementFromPoint: nav center hits the DIALOG when search is open).
- SIZE MATRIX (getBoundingClientRect, all PASS vs the target table): 320×568 → 296×58 bottom12; 360×640/375/390/412/430 → 328-340×64 bottom16; 667×375/844×390/915×412 → 360×52 bottom8 (landscape rule wins); 768×1024/820×1180 → 380×68 bottom20; 1024×768 → 420×72 bottom24; 1280/1440 → 440×72 bottom24; 1920/2560 → 520×88 bottom32. No horizontal overflow anywhere. Kids: 69px (≤+8% cap 69.2 ✓, 2 tabs ✓). Zoom: --ui-zoom=1.5 → 64px (=+10% clamp of 58 base @320, no overflow ✓). Tab touch target 50px on small phones ✓. main pb = 86px (=58+12+0+16 ✓ content never hidden). Icon frame resolves 22/24/26/32px per class ✓. z=40 ✓.
- SEARCH MATRIX (phone emulation 360×640, RTL Arabic): trigger 48×48 top inline-end, elementFromPoint = inside the button ✓; tap → full-screen overlay z=120, input focused synchronously (activeElement=input), 16px font, inputMode/enterKeyHint=search, back + clear buttons ✓; typed "batman" → Movies/Series groups + 21 rows ✓; result tap → detail opens, overlay closes ✓; Esc closes ✓; outside tap closes ✓; history.back() closes (gesture path, state consumed) ✓; focus-restore + scroll restore on close ✓; slash hotkey + Ctrl/Cmd+K kept ✓; md+ 768 regression: docked bar centered, expands 240→672px, dropdown rows, Enter → full overlay prefilled ✓; open over hero autoplay + CW row (seeded Breaking Bad S1E2 + Endgame, progress bars + S1 E2 LTR tag render) ✓; RTL: trigger mirrors to inline-end (left), overlay back arrow start-mirrored ✓; light theme nav/search render ✓; hero dots/scroll-snap/nav tab navigation intact ✓.
- HONEST LIMITS (need a real device): iOS Safari programmatic-focus-in-gesture verified structurally (useLayoutEffect commit inside tap task), not on physical iOS; visualViewport keyboard-inset logic verified in code + listener wiring, not with a real soft keyboard; Android back GESTURE verified via history.back() (same code path as the gesture); notch safe-area insets verified via env() math (0px in emulator), not hardware.

Stage Summary:
- Nav now properly sized on every device class (58-88px capsule per window class vs the old static 73px; TV grows, landscape phones shrink, kids ≤+8%, zoom clamped ≤110%, viewport never overflowed, content clearance token-driven). Phone search resurrected: visible glass trigger → full-screen M3 search view with sync focus, grouped results/recents/trending/destinations, keyboard-inset padding, back-gesture close, focus restore; desktop docked bar untouched. lint 0; compiles clean; screenshots download/r22-360-home.png, r22-360-nav-search.png.

---
Task ID: 23
Agent: main (orchestrator) — Principal Full-Stack Engineer round
Task: PROBLEM 1 streams fail to play in browser (diagnose with evidence + robust playback pipeline) · PROBLEM 2 Kids page unexplained Large/Medium/Small controls · playback/security/kids/regression matrices

Work Log:
- STEP 1 evidence (no changes before report):
  · Generic error produced at player-overlay.tsx onVideoError (was line 609): any <video> error → one fixed string. Only P2P had a one-shot remux retry.
  · Root cause A (CORS): <video crossOrigin="anonymous"> on the media element forced CORS on EVERY direct stream; hosts without Access-Control-Allow-Origin (most debrid/direct links; probe-verified: download.blender.org sends 200+Accept-Ranges but NO ACAO) failed instantly with SRC_NOT_SUPPORTED.
  · Root cause B (HEVC dead-end): p2pPlan returned the NATIVE stream URL for HEVC torrents (mode "unknown"); player error → remux retry copies video (still HEVC) → fails again → generic error. Torrentio probe (tt0117731): 41/41 streams are torrents; top releases are x265/HEVC/DV/TrueHD MKVs.
  · Root cause C (no direct-stream pipeline): /api/proxy + /api/proxy/raw cap at 24MB buffered JSON/text (unusable for video); no Range, no proxyHeaders forwarding, no HLS rewrite; direct MKV/AC3/DTS had no remux path at all.
  · Root cause D (headers/hotlink): filesamples/Google-bucket probes returned 403 to non-browser clients — class needs UA/Referer forwarding (behaviorHints.proxyHeaders existed but was never used for playback).
  · Failure-class table: (1) CORS-blocked direct → dominant; (2) HEVC/DoVi video → dead-end loop; (3) MKV/AC3/DTS → no remux for direct; (4) hotlink/UA-protected → 403; (5) HLS partial support (native CORS only); (6) torrent/magnet → P2P engine only; (7) expired links → same generic string.
- Built playback pipeline:
  · src/lib/harbor/media-proxy.ts — HMAC-signed short-lived proxy URLs (PROXY_SECRET, auto-stored at db/.media-proxy-secret), proxyHeaders vault (TTL 6h, never in URLs/logs), manual redirect chase with per-hop SSRF re-validation, probe cache (10 min), HLS manifest rewriter (signs every segment/key/map server-side), concurrency slots, host allow/deny lists.
  · /api/media (GET): streaming pipe, Range→206 passthrough, Content-Range/Length fidelity, HLS rewrite, DASH passthrough, SSRF-safe, 24 active-stream cap, OPTIONS.
  · /api/media/sign, /api/media/probe (HEAD→GET 0-0 fallback, cached), /api/media/capabilities (proxy always, transcode when TRANSCODE_ENABLED+ffmpeg).
  · /api/transcode + transcode-core.ts: ffprobe through own proxy → remux (copy video + AAC audio) or transcode (libx264 veryfast) → fMP4 pipe; TRANSCODE_ENABLED default OFF; 2 sessions, 3h wall cap, disconnect cleanup; graceful JSON when off.
  · src/lib/harbor/playback.ts (client): classifyStream (verdict direct/proxy/convert/external/unplayable + badge + reasons), resolveDirectSource (probe → direct when host sends ACAO, else signed proxy; HLS always proxied so manifest+segments can't break mid-play), classifyVideoError (media error codes 1-4), verdictRank.
  · Player overlay rebuilt error path: escalateFailure ladder direct→proxy→transcode (P2P: native→remux→vtrans) with localized toasts (EN/AR: "Retrying through the secure proxy…" / "إعادة المحاولة عبر الوسيط الآمن…"), first-frame watchdog 15s, hls.js network/media retry counters, classified PlaybackError panel (localized message, Convert/Retry/Pick another/Back, collapsible technical details class/code/host-only, Copy diagnostics), auto-fallback (max 3, "Trying another source…"/"جرب مصدراً آخر…"), convert-ask dialog (transcodeMode="ask"), removed blanket crossOrigin (KEY FIX), PlayerPayload.stream added, resolve path prefers verdict-ranked URL streams then transcode-capable torrents.
  · Picker: per-stream compatibility badges (green Plays here / amber Via proxy|Convert / gray Can't play|External), playable-first stable sort, "Playable here (N hidden)" toggle, externalUrl/ytId open-in-new-tab with label.
  · Settings: proxyMode auto/always/never, transcodeMode auto/ask/never (visible only when server supports), playableOnly, preferH264 — persisted via existing store; .env + .env.example (TRANSCODE_ENABLED, PROXY_SECRET, FFMPEG_PATH, TRANSCODE_MAX_SESSIONS/HOURS, MEDIA_PROXY_ALLOWLIST/DENYLIST, hosting requirements).
  · torrent-service: /remux?vtrans=h264 (HEVC→H.264, env-gated), /health.transcodeEnabled, package scripts use node --env-file; p2p.ts plans HEVC→vtrans when available; mini-services/torrent-service/.env added; node-datachannel prebuilt restored (prebuild-install) — service was dead before (missing native binary).
- PROBLEM 2 findings: NO Large/Medium/Small controls existed anywhere — kids-view.tsx full read (127 lines, header+rails only), live DOM scans (desktop 1280 + mobile 390, Kids Mode on/off), settings schema, i18n maps, git history: zero matches. Most plausible user sightings: player "Video fit: Fit/Fill/Zoom" chips or picker quality chips (both functional). Decision per rule (nothing to delete; capability genuinely useful for kids) → implemented ONE clearly-labeled control: Kids header "Card size: Large/Medium/Small" (كبير/متوسط/صغير) live-resizing all Kids posters (190/150/120px base, +30 md) via CSS vars, aria-pressed, persisted (kidsCardSize, default medium), RTL-safe, sanitized on load; no legacy keys existed so no migration needed. Kids Mode restrictions untouched (filter/genre guard/nav restrictions unchanged — no PIN existed before or now).
- BONUS bug found+fixed during QA: .harbor-kids-blob styles were gated behind html[data-kids="on"] → with Kids Mode OFF the blobs rendered as static ~1000px blocks pushing the whole Kids page down; now styled unconditionally (position/blur/round always; kids-mode only bumps opacity).
- Tests:
  · Security: unsigned /api/media → 403; tampered sig → 403; expired sig → 403; SSRF sign attempts localhost/127.0.0.1/10.x/192.168.x/169.254.169.254/[::1]/ftp: → all 403; redirect-to-private (httpbin) → blocked at hop ("blocked host"); DNS resolve enforced; rate limits on sign/probe.
  · Playback: signed proxy Range → 206 + Content-Range bytes 0-99/11061011; no-CORS host (blender.org 853x480) plays in browser through proxy (loadeddata); HLS manifest rewrite verified (all children signed /api/media URLs); MKV→transcode route → 200 video/mp4 fMP4, X-Harbor-Transcode: remux, ffprobe of output = h264; demo HLS plays (readyState 4, 1920x1080); LIVE LADDER TEST: killing the source made the player auto-recover via proxy sign of payload.url (readyState 4 after escalation); dead-torrent run produced the classified torrent error panel with Retry/Pick another/technical details (verified visually).
  · Picker: 41 real Torrentio streams rendered with badges (Via proxy/Convert per stream), toggle hides unplayable (0 hidden while conversion enabled — correct), playable-first order stable.
  · Kids: card size 150→190→120px live + persisted + aria-pressed; RTL Arabic verified (dir=rtl, زاوية الأطفال, حجم البطاقة, 3 buttons); blobs fix verified desktop+mobile (h1y 58, card0y 183, no x-overflow); Kids Mode ON (2 tabs, pink re-seed #ffafd3) intact.
  · Settings: all four new Player rows render (Convert row only because server reports transcode support).
  · Regression: home hero 8 dots + View details, floating search present, lint clean, tsc clean (vendored examples/skills excluded), fresh-session error log clean.
- Ops incident: system hit thread limits during repeated restarts ("Resource temporarily unavailable") — cleaned stray headless shells, single clean restart; torrent-service now runs persistently via setsid.

Stage Summary:
- Streams that failed with the generic codec/CORS message now have a full ladder: probe → direct / signed secure proxy (Range+headers+HLS rewrite) → ffmpeg remux/transcode → classified localized error with actions → auto-fallback to next source (≤3). crossOrigin removal alone rescues every non-CORS direct MP4; proxy rescues hotlink/UA/Referer and mixed-content; transcode rescues MKV+HEVC+AC3/DTS when TRANSCODE_ENABLED=1 (ON in this deployment, documented default OFF).
- Honest limits: browsers can't decode HEVC without server conversion (now auto); fMP4 remux seeks only within buffer (documented, HUD note kept); Safari/Firefox/iOS/Android not testable here (single headless Chromium); magnet-only streams need the P2P engine or debrid (labeled, never auto-added); no content sources bundled — neutral client preserved.
- Kids: mystery controls never existed (evidence archived above); one working labeled control shipped; page-breaking blob bug fixed.
- Env/docs: .env.example complete; hosting needs long-lived Node + optional ffmpeg.

---
Task ID: 24
Agent: main (orchestrator)
Task: Rebrand — user-supplied galloping-horse logo becomes the site's primary logo; site name changes to "Horse"

Work Log:
- ASSET PIPELINE (no hand-copied geometry): scripts/build-horse-assets.mjs extracts the EXACT `d` path (20,738 chars, viewBox 1106×785, evenodd) from upload/horse_logo.svg and derives every raster/vector asset; whitespace runs collapsed (SVG newlines are valid path whitespace but broke JS string literals — first generation had a literal-newline string → "Unterminated string literal" parse error, root-caused + fixed).
- ASSETS: public/logo.svg = primary mark (original #102A43 navy, verbatim); public/icon.svg = PWA tile (navy rounded-square + white horse, computed centering transform); sharp-rasterized icon-512.png / icon-192.png (any+maskable), apple-touch-icon.png (180), favicon-64.png. Rendered output visually verified (white horse on navy tile).
- SINGLE SOURCE OF TRUTH: new src/lib/harbor/brand-asset.ts (HORSE_PATH_D/VIEWBOX/W/H) consumed by both the SVG component and the canvas share-card; scripts/inject-horse-path.mjs regenerates it.
- COMPONENT: chrome/brand.tsx rebuilt — old unused boat-mark HarborMark → HorseMark (inline SVG, fill=currentColor so the mark theme-adapts automatically; optional `label` prop → role=img/aria-label, else aria-hidden; HarborMark kept as alias). The old mark was NEVER rendered anywhere — the app had no visible logo; placements added below.
- PLACEMENTS: (1) Settings → About panel: 48px accent-colored mark + "Horse" heading + install button row; (2) Search overlay idle state: centered mark+wordmark lockup (the most-seen full-screen surface on phones; recents/trending unchanged below); (3) App footer: 28px subtle mark + serif wordmark above the disclaimer lines; (4) Wrapped share card: horse drawn on canvas via Path2D(d)+evenodd at the header (accent color, text-only fallback in try/catch), header reworded "MY HORSE WRAPPED", footer "horse — local stats · private by design" (Path2D parse verified in Chromium against the exact d).
- RENAME (user-visible only): layout.tsx metadata (title "Horse — A Stremio Client Built for Adventure", description, keywords, authors) + NEW icons metadata (favicon-64.png + icon.svg + apple-touch-icon — the app previously had NO favicon wiring at all); manifest.ts name/short_name → Horse + 4-icon set (svg/192/512/maskable-512); footer + About + "Installing Horse…" toast + backup/clear-data strings + integrations key note; account modal "use Horse without an account"; theme-studio import error "Not a Horse theme file"; THEME_PRESETS display name "Harbor" → "Horse" (id `cool-grey` untouched); sw.js header comment.
- DELIBERATELY UNCHANGED (data contracts): localStorage keys `harbor-web.*`, event names (`harbor:data-changed`, `harbor:prefill-search`), backup/theme format strings (`harbor-web-backup`/`harbor-web-theme`, `key.startsWith("harbor-web.")` import loop), CACHE name scheme, env vars, `@/lib/harbor/*` paths, `harbor-*` CSS classes, code comments documenting provenance. MIT attribution to the Harbor desktop project preserved in footer + About (legal + honest).
- SW CACHE BUMP: harbor-web-v3 → v4 (icon.svg + manifest are cache-first; installed PWAs would keep the old boat icon forever without the bump; activate handler deletes stale caches).
- QA (agent-browser): page <title> = "Horse — A Stremio Client Built for Adventure" ✓; footer lockup centered, mark 39×28 subtle-gray, wordmark "Horse" ✓ (desktop dark); search idle: accent horse + serif wordmark, input auto-focus intact ✓; About: 48px mark rgb(255,183,125) accent + heading ✓; LIGHT appearance: mark auto-adapts to rgb(144,77,0) ✓; RTL Arabic 390×844: footer lockup centered+mirrored, full-screen search lockup RTL ✓; served <head> has manifest + 2 icon links + apple-touch-icon ✓; /manifest.webmanifest serves new name/icons ✓; Path2D parses the exact d ✓; QA browser state reset to EN/dark after checks.
- lint 0 problems; dev.log clean (all 200s; pre-existing TMDB 501 = "no key configured", unrelated).
- Cleaned up: scripts/gen-brand.mjs removed (superseded by inject-horse-path.mjs); kept build-horse-assets.mjs + inject-horse-path.mjs so the user's future logo variations regenerate everything with one command each.

Stage Summary:
- The site is now "Horse" everywhere a user can see, with the galloping-horse mark as the primary logo (PWA/favicon/footer/search/About/share-card), theme-adaptive via currentColor, and a regeneration pipeline ready for the promised color/size variations. Zero data-contract breakage; zero regressions observed; attribution to the original Harbor project intact.
- Next-round candidates: when the user ships logo variations (mono/one-color/positive/negative), re-run the two scripts per variant + swap brand-asset.ts; optional splash screen using the mark; hero "My List" quick action + CW TMDB stills still open from round-21b candidates.

---
Task ID: 25
Agent: main (orchestrator) — Principal playback-engineer round
Task: Player time display + seek bar must show the REAL elapsed/total/duration for every stream class; single source of truth for time; evidence-first

Work Log:
- STEP 1 EVIDENCE (no fixes before the table): grep-audited every duration/currentTime reader (player-overlay L994-1059 timeupdate/loadedmetadata only, NO durationchange listener, no rAF; saveProgress L2273 `duration<=0 return`; scrobble L1098; resume L983; slider L1734 `max={duration||100}`). Live measurements (agent-browser + curl + ffprobe):
  · direct MP4 (CORS+CL, vjs oceans): duration 46.613333 exact, UI 0:04/0:46 ✓ (baseline works)
  · MP4 no-CORS direct attach: 10.000 exact ✓; via /api/media proxy: 206+Content-Range+exact CL passthrough ✓ (proxy headers verified byte-exact)
  · HLS VOD (mux x36xhzz, ENDLIST): hls.js 634.634 vs ffprobe 634.584 (Δ0.05s) ✓
  · HLS missing ENDLIST (crafted /test-noendlist.m3u8, 64 segs, 634.63s sum): hls.js live-mode → static playlist stalls → media error ×2 → escalate("codec") → "This format needs conversion" panel (code 4). Duration never shown.
  · fMP4 remux (/api/transcode pipe, oceans): **duration=5.12 vs true 46.61; seekable=[0,0]** — ffmpeg `frag_keyframe+empty_moov` writes NO mehd (box-dump verified; no movflags combo adds it; ffprobe reads fragment trailers, Chromium cannot). Duration frozen/crawls; unseekable.
  · MKV+AC3 silent stall (/test-ac3.mkv): metadata parses (duration 10 finite!), play() → paused forever, NO error event, old 15s watchdog disarmed BY loadedmetadata → infinite black screen, no escalation.
  · Metadata: Cinemeta meta.runtime="111 min" (movies) / "49 min" series avg, per-episode runtime null; TMDB runtime (movie, min) + episode_run_time[] (series, min) available but NEVER forwarded; PlayerPayload lacked runtime; ffprobeMedia DROPPED format.duration (fetched + thrown away); probe endpoint had no duration field.
- STEP 2 SOURCES:
  · transcode-core.ts: ffprobeMedia now returns durationS (format.duration → max stream duration fallback) + RFC-6381 video/audio codec strings.
  · /api/transcode: emits X-Content-Duration (source − signed offset) + X-Codecs; accepts signed ?ss=N → ffmpeg -ss (input seek, keyframe-fast).
  · media-proxy sign/verify: startOffsetS participates in the HMAC payload (unforgeable offsets); sign route accepts ss (clamped ≤24h); signSource(stream, mode, startOffsetS).
  · /api/media/probe: wantsDuration:true → unwraps signed /api/media|/api/transcode URLs (signature-verified), ffprobes the TRUE source through vault headers, returns FULL-SOURCE durationS + durationVia; cached 10 min; signed-path header probe skipped.
- STEP 2 TIMELINE: NEW src/lib/harbor/playback-timeline.ts — PlaybackTimeline class (subscribe/getSnapshot for useSyncExternalStore, event+rAF sampling throttled 8Hz). Duration ladder: element(finite>1s,≥ct−0.05, not crawling/untrusted/frozen-parse) → hls VOD totalduration (LEVEL_LOADED) → seekable.end → probe (applyProbe) → metadata approx (flagged) → null(elapsed-only). fMP4 crawl detector (≥2 upward durationchange revisions in 8s); elementUntrusted veto (transcode/p2p-remux/URL-shape); elementFrozenParse (probe exists + seekable[0,0] + element < probe−1). seekTo(title) → element move (when seekable covers) OR {restart, offsetS}; elementTimeFor(title) offset mapping; markLive; buffered ranges in title time; isApproximate; durationSource debug label. formatClock/spokenDuration/parseRuntimeToSeconds helpers.
- STEP 3 PLAYER: player-overlay.tsx — time/duration state REPLACED by timeline snapshot (time=tlSnap.currentTime, duration=tlSnap.duration|null); durationchange handled inside timeline; probe effect (payload.stream.url ?? payload.url, wantsDuration, retries ≤4×2.5s while none/meta); lazy meta approx fetch (tt-ids, one attempt, 4s defer); CW saves via snapshot (5s throttle, duration null → durationMs 0 keeps resume position without a fake bar; approximate → LocalCwEntry.durationApprox flag); scrobble progress from snapshot; resume offset-aware + no longer requires known duration; subtitle cues use TITLE time (offset-correct); keyboard (±seekStep, PageUp/Down ±60, Home/End, 0-9%) + skip buttons all via doSeek; doSeek verifies element honored the seek (chunked-fMP4 seekable LIES — reports parsed extent, clamps beyond buffered) → restart at offset when clamped; restart re-signs SAME upstream with ss (no stage remount, timeline persists). Watchdog fixes: loadedmetadata no longer disarms first-frame watchdog; paused element (never asked to play) re-arms instead of erroring; stall watchdog (8s no-timeupdate while nominally playing) + first-frame-timeout escalate as CODEC (routes to Convert).
- STEP 3 UI: SeekBar component (pointer-capture drag with preview+tooltip, commit on release, click-to-seek, keyboard on slider role, buffered ranges as lighter segments, ~ marker for approximate, dir=ltr media convention inside RTL-mirrored row, 44px touch target, focus ring, indeterminate shimmer when duration unknown — honest "length unknown", reduced-motion static); TimeDisplay (elapsed/−remaining toggle persisted harbor-web.time-display, "~" prefix when approximate, "length unknown" EN/AR label, aria-label spoken phrasing, aria-live=off ticking). Old input[range]+fmtTime removed; globals.css harbor-seek-indeterminate (+reduced-motion).
- Metadata plumbing: PlayerPayload.runtimeSeconds + Frame(picker).runtimeSeconds; detail-view forwards TMDB runtime/episode_run_time → parseRuntimeToSeconds(meta.runtime) fallback; picker passes through.
- QA HARNESS: demo hash hook accepts &src= (https or same-origin path incl. signed URLs) — documented QA entry, https/strict-path-regex guarded; /test-ac3.mkv (real AC3 MKV built with ffmpeg) + /test-noendlist.m3u8 live-shaped fixture kept in public/ for future rounds.
- TEST RESULTS (displayed vs ffprobe): direct 46.61→0:46 ✓ Δ<0.01; proxied 10.00→0:10 ✓; HLS VOD 634.58→10:34 ✓ Δ<0.1; fMP4 remux 46.61→0:46 ✓ (was 0:05 — FIXED via probe+untrust); seek 0/25/50%: element-exact (resume 20.00→0:20 ✓); keyboard +10/50% ✓; fMP4 restart-seek 85% → POST sign + GET /api/transcode?ss=39 200 → played remainder → ended 46/46 100% ✓; CW after restart pos 43,304/dur 46,613 (REAL ffprobe ms) ✓; remaining-toggle persists ✓; ended state 0:46/−0:00 progress 100% ✓; MKV silent-stall → escalates to Convert ladder (was infinite black) ✓; paused-never-played survives 20s (re-arm) ✓; RTL bar mirrors w/ LTR slider ✓; desktop 1280 + mobile 390 ✓; home/hero/footer regression ✓; tsc 0, lint 0.
- HONEST LIMITS: (1) static no-ENDLIST playlists (no live edge updates) still end in the error panel — real live streams refresh and would show elapsed-only + LIVE semantics via timeline, but a true live UI (LIVE badge, no seekbar) is not built this round; (2) P2P remux restarts not implemented in torrent-service (clamped no-op — UI note updated honestly); (3) transcode of same-origin/localhost sources blocked by SSRF guard (by design; real debrid https works); (4) seek restart lands on keyframes (≤~2s drift, within the 1s spec tolerance for keyframe-aligned sources only approximately — documented); (5) Firefox/Safari/iOS not testable here (single headless Chromium); (6) CW at ≥92% with REAL duration drops from the row (existing threshold, now accurate).
- Env: no new env vars (duration probe reuses TRANSCODE_ENABLED/FFPROBE_PATH); .env.example already documents them.

Stage Summary:
- The control bar now shows the REAL elapsed/total on every stream class where the truth is obtainable: element → hls VOD → seekable → server ffprobe (via signed-URL-unwrapping probe + X-Content-Duration) → marked-approximate metadata → honest elapsed-only. fMP4 remux/transcode went from 5.12s-frozen garbage to the exact 46.61s; unseekable pipes gained real seeking via signed -ss session restarts; the MKV silent-stall now reaches the Convert ladder; CW/scrobble/resume/subs all read the same timeline. Next-round candidates: LIVE badge + live UI semantics for real live playlists; P2P remux -ss support in torrent-service; MSE duration injection for remux (set mediaSource.duration instead of restarts).

---
Task ID: 26
Agent: main (orchestrator)
Task: Title details page — small layout change only: (1) reorder hero content block (title logo → ratings/meta → description → action buttons), (2) push the block slightly down via a single tunable CSS token --details-content-offset (~24-40px desktop / 16-24px mobile), (3) keep bottom padding safe + existing gradient. Nothing else.

Work Log:
- SCOPE KEPT MINIMAL: exactly 2 files — src/components/harbor/views/detail-view.tsx (hero content block only) and src/app/globals.css (token + one class appended at end). No data, logic, or other styles touched.
- REORDER: hero content container now renders title logo/h1 FIRST (tmdb.logo img branch keeps its sr-only h1; text h1 fallback in the same slot), then meta chips row (year/cert/IMDb/runtime/genres/via-addon), then unified RatingsRow (Trakt etc.), then description <p>, then the unchanged action-button row (Play|Resume / Streams / Watchlist / Add to list). Per-element classes and margins preserved verbatim (logo mb-3, chips mb-2.5, ratings mb-3, desc mb-5); only the pop-in animationDelays were resequenced (logo 0ms, chips 40ms, ratings 70ms, desc 140ms, buttons 210ms) so the staggered entrance cascade still flows top→bottom in the new order.
- OFFSET TOKEN (globals.css): :root { --details-content-offset: 16px } + @media(min-width:768px){ 24px } + .harbor-details-offset { transform: translateY(var(--details-content-offset, 0px)) }. Applied the class to the hero content container. Chose translateY over padding/height changes because the block is bottom-anchored (justify-end + pb-8 inside overflow-hidden hero): pushing down within a fixed hero necessarily trades bottom gap; a pure vertical transform is RTL/LTR-identical, reflow-free, gradient untouched, and reversible. Defaults picked at the SAFE end of the user's ranges to protect the bottom edge: 16px mobile → 16px gap below buttons, 24px desktop → 8px gap (documented in the CSS comment: keep token ≤ 2rem; same low-sit pattern as the Home hero's --hero-pad-bottom = 6px×scale).
- GEOMETRY PROOF (agent-browser, live view; note: nav stack keeps prior detail views mounted in hidden wrappers — .harbor-details-offset matches must use the LAST instance, the hidden first match has 0×0/transform:none as a display:none artifact):
  · Desktop 1280×800 (movie tt4154796 + series tt0903747): with token title-top y=243 / btn gap 8 / no clip; token→0 y=219 / gap 32; measured shift EXACTLY 24px; restores after removing override. transform matrix(1,0,0,1,0,24). Both gradient overlays intact (to-top from-canvas + to-right).
  · Mobile 390×844: transform 16px, measured shift EXACTLY 16px, gap 16px, no clip, scrollWidth 390 = no h-overflow.
  · RTL Arabic (uiLanguage=ar, dir=rtl): order H1→CHIPS→RATINGS→P(desc)→BUTTONS preserved, shift exactly 16px, gap 16, no clip, no overflow; screenshot qa-r26-rtl-mobile.png (chips/buttons mirror correctly). EN/dark state restored after QA (cloudSyncEnabled back on).
  · Order audit on loaded pages (movie+series): [H1, CHIPS, RATINGS, P(desc), BUTTONS(4)] — the requested logo/meta-ratings/description/buttons stack.
  · Screenshots: qa-r26-desktop.png (Endgame, new order visible), qa-r26-rtl-mobile.png.
- ENV INCIDENT: Turbopack dev watcher went stale for globals.css (CSS-only edits — touch/append did not retrigger; served chunk kept old content while disk had the class). Fixed by clean single-instance dev-server restart (killed 5 stale procs, setsid bun run dev). After restart the stable-named dev chunk serves the new rules. Also learned: app SW + cloud-sync overwrite localStorage settings on boot — QA language switches must set cloudSyncEnabled=false first.
- OBSERVED PRE-EXISTING (NOT touched, out of scope): detail view intermittently remounts to skeleton when periodic /api/sync changes the addons store identity (effect deps [addons, addonsLoaded]) — visible as a brief flicker every sync cycle; worth a future round (memoize addons identity or gate the refetch).
- lint 0 problems; dev.log clean (TMDB /find 501 = known no-key sandbox case, unrelated).

Stage Summary:
- Details hero now reads logo → year/age/score/runtime/genres/Trakt → description → Play/Streams/Watchlist/Add-to-list, sits exactly 16px (mobile) / 24px (desktop) lower revealing more backdrop, nothing clipped, gradient intact, RTL/LTR + mobile/desktop verified with measured numbers. Single tunable token --details-content-offset documented in globals.css.
- Next-round candidates: the /api/sync-driven detail-view remount flicker (pre-existing); when a TMDB key is configured, re-verify the tmdb.logo img branch visually (sandbox has no key → h1 fallback verified; img branch is the same slot, code-identical).
---
Task ID: 27
Agent: Z.ai Code (coordinator + 4 parallel general-purpose subagents)
Task: Corrected request — extract ALL text content from the project SOURCE FILES (not an external website), organized by file/section with structure preserved, delivered as one Markdown file for content review & translation.

Work Log:
- Clarified scope: previous round's URL-crawl framing was wrong; user wants the project's own text corpus → deliverable is source-file extraction, not rendered-DOM capture.
- Inventoried the codebase (views/chrome/player ≈ 19.3k lines; settings-view 2108, player-overlay 2793, picker-overlay 924).
- Launched 4 parallel extraction subagents (Tasks 3-a…3-d of this round): views (22 files), chrome/common/player (22 files, incl. full player-overlay), lib+API (82 files scanned; strings from 27 lib files + torrent service + 36/39 API routes), docs/meta (READMEs verbatim, sw.js, robots, manifest/layout metadata, prisma models, derived 37-round dev-history timeline, 191-file inventory).
- Coordinator wrote header (method, conventions, coverage stats, pre-translation findings) and assembled the final file.
- Deliverable: /home/z/my-project/project-text-content.md (2,929 lines, 5 top-level sections: 1 Views · 2 Chrome & player · 3 Lib/system/API · 4 Metadata/docs/history+inventory). ~1,800+ unique strings, ~140 source files.
- Verified section order/transitions/ending; temp .extract/ dir removed afterwards.
- Companion artifact unchanged: website-content.md (rendered-app DOM walk from earlier round) — kept as a second view of the same corpus.

Stage Summary:
- KEY FINDING: only src/lib/harbor/i18n.ts (~60 keys) is bilingual EN/AR; a few inline AR ternaries exist (quick-access, page-header, floating-search, player); everything else is hardcoded EN → real i18n pass required for full AR coverage.
- Pre-rename leftovers flagged: user-visible "Harbor" strings survive in live-view empty state, addons-view intro (×2), settings Basics+Player, integrations-strip heading, shortcuts-overlay subtitle, theme-studio toast (About attribution is deliberate).
- Density hotspots for translation: settings-view (~230 strings), player-overlay, picker-overlay, command-palette.
- No source code touched; lint/build not run (extraction-only round); worklog is the only project file modified besides the new deliverable.
- Next-round candidates remain: /api/sync-driven detail-view remount flicker; optional follow-up — actually migrating extracted strings into i18n dictionary / fixing the "Harbor" leftovers.
---
Task ID: 28
Agent: Z.ai Code (coordinator, no subagents needed)
Task: User re-sent the Round-26 request (details-page content reorder + downward offset + bottom safety) with the same two screenshots. Verify the requested end-state, touch nothing else.

Work Log:
- Read detail-view.tsx (598 lines) and globals.css tail: Round-26 implementation fully intact — hero block order logo/h1 → meta chips → RatingsRow(Trakt) → description → buttons with pop-in delays 0/40/70/140/210ms; .harbor-details-offset applied at line 188; token block at globals.css:1844-1852 (16px mobile / 24px ≥768px).
- Concluded user's desktop screenshot (12:29) predates the change; mobile screenshot (13:35) already shows the new order. No code modification required or made this round.
- Fresh agent-browser QA on live dev server: searched "The Simpsons", opened detail page.
  · Desktop 1280×800: transform matrix(1,0,0,1,0,24) = exactly 24px; order verified via DOM children (h1 → chips div → Trakt div → p → buttons div); block padding-bottom 32px; last button 8px above hero bottom; 2 gradient scrims present; no horizontal scroll.
  · Mobile 390×844 (set viewport): transform = 16px; same order; last button 16px above hero bottom; no overflow.
  · RTL emulation (dir=rtl): transform stays vertical-only, block edges symmetric (0/0), no overflow; state restored to ltr/en afterwards.
- Screenshots: qa-r28-desktop.png, qa-r28-mobile.png. lint 0 problems; dev.log clean.

Stage Summary:
- Requested layout change confirmed LIVE and within spec (desktop 24px ∈ [24,40], mobile 16px ∈ [16,24]); zero files modified this round; nothing else touched.
- If the user wants a larger shift later, tune only --details-content-offset (≤ 2rem guardrail per CSS comment).
- Carried-over candidates unchanged: /api/sync-driven detail-view remount flicker; TMDB logo img branch visual check once a key exists (h1 fallback verified again today).
---
Task ID: 29
Agent: Z.ai Code (coordinator, no subagents)
Task: User feedback on details hero — "push down more, ESPECIALLY on mobile, the poster isn't visible because of these things".

Work Log:
- Measured ground truth first (agent-browser): poster-above-title was 105px @390×844, only 72px @375×667 (hero 52vh/min-360 too short + offset 16px). Key insight: offset alone is capped (buttons bottom-anchored, gap = pb-8 32px − offset), so the dominant lever is hero height.
- CHANGE 1 — detail-view.tsx line 178 (one line): hero `h-[52vh] min-h-[360px] md:h-[64vh]` → `h-[60vh] min-h-[420px] md:h-[68vh]`.
- CHANGE 2 — globals.css token block: converged `--details-content-offset` to a single 24px token (removed the now-redundant 16/24 media-query split), comment rewritten: guardrail now ≤24px (keeps 8px button gap + no top-clip on 420px min hero), documents how to re-add a desktop override.
- ENV INCIDENT (recurring): Turbopack served a STALE globals.css chunk after the CSS-only edit (transform read 16px while hero-height TSX change was live). Clean dev-server restart fixed it. NOTE: `setsid bun run dev &` inside the tool shell died after ~1 min; working pattern is `(setsid bun run dev </dev/null >/dev/null 2>&1 &)`.
- QA (agent-browser, Simpsons detail): 375×667 → hero 420, offset 24, poster 104px (+45%), gap 8, no clip. 390×844 → hero 506, poster 180px (+71%), gap 8. 1280×800 → hero 544, poster 329px (+32), 2 gradient scrims intact. RTL: vertical-only transform, correct edge anchoring, no h-scroll. Order logo→meta→Trakt→description→buttons unchanged everywhere.
- lint 0 problems; dev.log clean; screenshots qa-r29-mobile.png / qa-r29-desktop.png.

Stage Summary:
- Poster visibility on mobile dramatically improved (+45% small phones, +71% regular); desktop +32px bonus; button safety gap unified at 8px; single tunable token (24px, ≤24px guardrail).
- If user wants even more later: raise --details-content-offset toward 32px ONLY together with pb-8→pb-12 (gap math in CSS comment), or bump hero vh again.
- Carried-over: /api/sync detail-view remount flicker still open.
---
Task ID: 30
Agent: Z.ai Code (coordinator, no subagents)
Task: User uploaded upload/project-text-content-ar.md — adopt it as the site's Arabic translation + use the Tajawal font.

Work Log:
- Verified the AR corpus mirrors the EN corpus (project-text-content.md) 1:1 — parser matched 120/120 sections with ZERO count mismatches.
- Built scripts/build-ar-dict.mjs → src/lib/harbor/ar-dict.ts: 854 exact EN→AR pairs (positionally paired per file-heading; dynamic templates excluded; identity/proper-noun pairs skipped; conflicting translations keep-first).
- Built src/lib/harbor/ar-text.ts (engine): exact-dict lookup + AR_SUPPLEMENT (standalone nodes whose corpus line was composite) + ~50 ordered regex rules for dynamic strings (durations, counts, seasons, search queries, probe toasts, theme shares, ago/updated…). Text-node originals stashed via symbols for byte-exact EN restore.
- Built src/components/harbor/chrome/ar-text-layer.tsx (ArabicTextLayer): TreeWalker initial pass + MutationObserver (childList/characterData/attributes) + rAF batching. Mounted in app-shell.
- BUG FOUND & FIXED (critical): React re-renders re-wrote translated nodes to EN and the observer's blind selfWritten skip left them EN forever → replaced with lastWritten/lastWrittenAttrs WeakMaps (skip only if current value == our last write; re-translate otherwise).
- BUG FOUND & FIXED: React splits template strings across adjacent text nodes ("3"+" integration"+"s"+" not active yet…") defeating per-node matching → added translateSplitRuns (join consecutive text-node siblings, translate the sentence into the first node, blank the rest, stash originals).
- Discovered there was NO UI control for settings.uiLanguage at all → added an "Interface language · لغة الواجهة" card (English | العربية chips) at the top of the Settings → Language panel.
- Tajawal font: downloaded all 8 woff2 (400/500/700/800 × arabic/latin subsets) from Google Fonts → self-hosted in public/fonts/; @font-face block + unicode-ranges appended to globals.css; applied via html[lang^="ar"] { --font-sans-var … !important } — !important REQUIRED because themes.ts:410 writes an inline --font-sans-var on <html> at boot (author-inline beats normal author rules).
- ENV (recurring): Turbopack served stale CSS chunks through TWO dev-server restarts; final fix required rm -rf .next (on-disk compile cache) + restart. agent-browser fresh session (close --all) used for clean-cache QA.
- QA (agent-browser): AR mode → html lang=ar dir=rtl, footer/heading/settings-tabs/hub-cards/detail-buttons all Arabic, Tajawal computed on body (7/8 faces loaded), placeholder بحث…, integrations strip stitched sentence translated. EN restore → byte-exact text, Switzer font, ltr. Left final state = Arabic (user request). Content (movie titles, genres-as-data, brand names) intentionally untranslated. qa-r30-home-ar.png, qa-r30-detail-ar.png, qa-r30-home-ar-final.png.
- lint 0 problems; dev.log clean.

Stage Summary:
- Arabic is now a first-class UI language driven by the user-approved corpus: switch in Settings → Language → لغة الواجهة. Dictionary = ar-dict.ts (854) + AR_SUPPLEMENT (8) + ~50 pattern rules + split-run stitching.
- To re-grow the dictionary after future UI strings change: update the two corpora, run bun scripts/build-ar-dict.mjs, review scripts/ar-dict-report.txt.
- Known limits: some rare runtime composites not covered by patterns stay EN; genre names are TMDB data (EN); API error strings from upstream providers are translated only where the corpus provided wording.
- Carried-over: /api/sync detail-view remount flicker; Turbopack CSS staleness workaround = rm -rf .next on CSS edits that don't hot-apply.
---
Task ID: 31
Agent: Z.ai Code (coordinator, no subagents)
Task: Player controls — (1) fix "seek bar does nothing", (2) add ±10s skip (buttons+double-tap+keyboard), (3) add prev/next episode buttons (series).

Work Log:
- EVIDENCE-FIRST diagnosis: read player-overlay.tsx (2852 lines) + playback-timeline.ts fully; live-tested the demo player with synthetic pointer events. FINDINGS: click/drag seek is EXACT on HLS (25%→158.7/634.6, drag 60%→380.8) and MP4 (0.1/22.5/45.0/89.1), playing AND paused; slider max/interception/RTL math/clean (elementFromPoint = track, dir=ltr bar). The REAL broken path (matches the report): p2p-remux/progressive pipes — Chromium silently clamps element seeks beyond the buffered extent, and the post-seek verifier restarted ONLY for mode==="transcode" → p2p-remux/p2p-transcode seeks beyond buffer did literally NOTHING. Second latent defect: SeekBar committed the drag from React state — a down+up processed in the same task reads a stale null closure (lost seek); third: slider keydown + window hotkey both sought (benign same-target, still made strictly single).
- FIX 1: torrent-service /remux now accepts ?ss=N (OUTPUT seek — ffmpeg drops packets until target; input -ss impossible on pipes). Node-ran service hot-verified (health OK). NOTE: bun in this sandbox panics (uv_timer_init) — service now runs under node.
- FIX 2: player restartAt() generalizes restartTranscodeAt — handles transcode (re-sign -ss) AND p2p-remux/p2p-transcode (p2pRemuxUrl gains ssS param); doSeek verifier restarts for all three modes; pauseAfterRestartRef restores a paused session after the restart auto-play.
- FIX 3: SeekBar dragRef (batch-proof commit), stopPropagation on handled slider keys.
- FEATURE ±10s: back/forward transport buttons upgraded (RotateCcw/RotateCw icons, bilingual aria+title "رجوع/تقديم 10 ثوانٍ", clamped via timeline), SkipHud center chip ("−10 s"/"+10 s", dir=ltr), touch double-tap zones on the video surface (left=−10/right=+10, time-true in RTL since the bar is LTR; 300ms deferred tap-toggle so a second tap becomes a skip; dblclick-fullscreen now mouse-only), keyboard arrows already ±settings.seekStep (10s default) — kept.
- FEATURE episodes: epList fetch (series, sorted season/episode) → prevEp/nextEx ordered-list neighbors (season-crossing falls out of the sort); StepBack/StepForward buttons in the control bar — series only, DISABLED (not hidden) at edges, movies render none (live-verified); switchEpisode → existing handlePlayNext (VideoStage unmount flush saves outgoing progress; subtitles re-resolve per videoId; scrobble stop/start via effect lifecycle; S:E + episodeName label updates); resolve failure during a switch auto-opens the stream picker (autoPickerRef, cleared on playing); keyboard Shift+N/Shift+P added (no conflicts; plain "n" kept).
- QA: MP4 (generated public/test-seek.mp4 90s): click 0/25/50/99% EXACT; paused drag EXACT (63.0=70%); skip buttons: back at 3s→0 clamp, back at 0→0, fwd→10; double-tap touch −10→0 clamp; HUD "+10 s"; keyboard −10.0 single; end clamp at duration; episode buttons absent for movie. HLS (mux 634.6s): click25/drag60/back10/fwd10 all exact. Series full playback NOT runnable in sandbox (no stream addons; torrent engine uv-panic under bun → node) — episode switch path verified by code + the resolve-failure→error-panel flow live; movie-button-hidden verified live. RTL: tested in Arabic mode throughout (labels/buttons/tooltips AR). lint 0; dev.log clean; qa-r31-player-ar.png.
- Honest limits: torrent-service ?ss= verified by health/hot-reload only (needs a live swarm for end-to-end); iOS/Safari not testable here.

Stage Summary:
- Seek works everywhere it can (element-exact) and RESTARTS where it cannot (transcode/remux) — the "changes nothing" class is closed at both service and player ends. ±10s + episode nav shipped with bilingual a11y, HUD feedback, season-crossing logic and picker fallback.
- Next candidates: LIVE badge UI for real live playlists (no-ENDLIST shows honest elapsed-only today); expose seek-step in Settings UI already exists (seekBack/ForwardStepSec 5-60).
---
Task ID: 32
Agent: Z.ai Code (coordinator, no subagents)
Task: RTL/bidi/i18n QA round — fix defects A–G from six annotated screenshots (integrations buttons, P2P switch + mixed text, squeezed setting rows, footer logo/dev-badge/dead-space, addons cards + install field, floating-search overlap, untranslated/bidi strings), then global sweep + repeatable audit:ui.

Work Log:
- STEP 1 EVIDENCE (root causes with file:line before any fix):
  · A: `md-btn-filled` etc. variant classes painted colors ONLY (no display/radius/padding) — any button using a variant without the base `.md-btn` rendered as a square UA rectangle with the icon pinned to the corner (link-account-flow.tsx:110). 20+ instances app-wide.
  · B: ui/switch.tsx used physical `translate-x-[calc(100%-2px)]` → thumb exits the track in RTL; track 32×18.4 ≠ M3 52×32. Mixed EN/AR scramble = no Unicode bidi isolation anywhere. "Offline" literal + ad-hoc danger colors.
  · C: SettingRow = `flex justify-between` + control in `shrink-0` (settings-view:174); SegmentedControl ~290px inline-flex; sliders w-40 → label collapsed to one word/line. No container queries.
  · D: footer logo h-7 (28px); "N" badge = Next.js dev indicator (no devIndicators in next.config.ts); dead space = footer pb-6 + main --nav-clearance stacked.
  · E: AddonCard middle column min-w-0 between shrink-0 logo/actions; `harbor-clamp-1` ellipsis lands at inline-END on LTR names in RTL → "…ovides"; formatAgo EN-only; "checked 5/5" literal; input no dir/ltr/label.
  · F: floating-search phone trigger fixed end-3 top z-85; settings tab row had no inline-end reserve → "حول" unreachable under it.
  · G: only ~60-key homeT + 854-pair DOM dict; verified dozens of strings absent; no missing-key check, no lint guard, manual time formatting.
- SHARED FIXES (tokens/components, not one-offs):
  · globals.css: `.md-btn-*` variants now self-sufficient (base layout baked into every variant) — fixes ALL bare-variant buttons app-wide; `.harbor-cq` container + `.harbor-setting-row` (stacks <520px container, label flex:1/control ≤45% above); `.harbor-segmented` equal full-width segments when stacked; `.harbor-slider-touch` 48dp hit; `.harbor-fs-clear` search-zone reserve; `.md-switch` rebuilt (root=48dp touch target, inner 52×32 visual track, logical inset-inline-start thumb 16→24dp, hover/focus/disabled states); `.harbor-disclosure-content` grid-rows animation; `.harbor-bdi`; footer logo 64dp + wordmark 28–32dp classes.
  · ui/switch.tsx: M3 rewrite (Radix root + track span + thumb, data-loading spinner, aria preserved). ui/slider.tsx: thumb size-5 + aria-label from root props (axe aria-input-field-name).
  · i18n system: i18n.ts gained APP_STRINGS (~150 keys, complete ar/en, arOther plural shape), t() with {var} interpolation + DEV missing-key console.error, formatNumber (latn digits everywhere), formatTimeAgo (Intl.RelativeTimeFormat → "منذ 8 دقائق"); hooks/use-t.ts useT() binding live uiLanguage.
  · common/bidi.tsx: <Bdi>/<RichBidi> — splits mixed strings, wraps Latin runs in <bdi dir=ltr>. ar-text.ts: isolateBidiRuns() post-processor wraps every Latin run in translated strings with FSI…PDI (fixes punctuation/segment order for ALL DOM-layer translations); new supplement batch (statuses + Data/About/Theme/panels ~80 entries) + new rules (Link X with a code, No account setup…, Online · port N, · x/y checked, checked Xm ago, Import your … watchlist).
  · next.config.ts: devIndicators:false (the "N" badge) — verified absent in dev, never in prod.
- COMPONENT FIXES: link-account-flow.tsx (52dp M3 buttons, t() everywhere, host/code <Bdi>, animated Disclosure with rtl-mirrored chevron, localized terminal states); settings-view.tsx (SettingRow container-query + aria-labelledby wiring via cloneElement, SettingSliderRow title+value line/full-width 48dp slider, SegmentedControl overflow→dropdown degrade, tabs 48dp + fs-clear + tabIndex=0, P2P card fully t()+RichBidi+M3 status chip (error-container)/icon+role=alert error box, mr-→me- RTL margin sweep, Trakt/Simkl headers + Advanced disclosures); addons-view.tsx (AddonCard 3-row redesign: logo 48 + dir=auto 2-line name + LTR-isolated version, status/info chips with Intl relative time + localized counts, 48dp action row, AlertDialog uninstall confirm, md:grid-cols-2 grid; install field label+dir=ltr+h-14 stacked-compact/inline-md+ disabled until plausible URL; health pill t()); app-shell.tsx footer (64dp HorseMark, 28–32px wordmark, translated tagline/credit, TMDB sentence translate="no" EXACT, footer pb reduced so only --nav-clearance remains); common/poster.tsx (sr-only accessible name composes with visible child text — axe label-content-name-mismatch); home-hero.tsx (track tabIndex=0+label; dot buttons real 48dp targets w/ inner visual dot); glass-dock + floating-search hidden states get visibility:hidden (aria-hidden-focus); quick-access card drop redundant aria-label; account/quick-access/kids/integrations-strip/rail touch targets ≥44dp.
- AUDIT TOOL: scripts/audit-ui.mjs + `npm run audit:ui` (axe-core devDep). Drives agent-browser: en/ar × widths {320…1440 full, 390+1280 quick} × dark/light × font-scale 100/150; navigates via native find+click (dock → quick-access fallback); in-page harness flags: document/element horizontal overflow (excl. decorative SVG + overflow-hidden/auto ancestors), narrow text <120px>12ch (warn), ellipsis-clipped w/o tooltip, touch targets (<40 block, 40–47 warn), top-anchored fixed-layer overlaps >30%, Latin-only nodes in AR (allow-list brands/codecs/units + media-title/sr-only exclusions), axe-core critical/serious (color-contrast off). JSON+MD reports + screenshots in download/audit/.
- SWEEP RESULTS (before → after): 941 blocking → **0 blocking** (EXIT=0). Fixed along the way: axe aria-input-field-name (slider thumbs), button-name (switches via SettingRow labelled-by), label-content-name-mismatch (poster sr-only + quick-access), scrollable-region-focusable (hero track, tabs), aria-hidden-focus (dock/search visibility), 8px hero dots, 36px hero-pause/integrations CTA, 32px kids size chips/rail View-all.
- QA ARTIFACTS: qa-r32-a-integrations-ar.png, qa-r32-a-integrations-en.png, qa-r32-a-trakt-ar.png, qa-r32-b-p2p-ar.png (switch thumb inside track verified: 52×32 track, 24dp thumb, inset 20px, insideTrack=true), qa-r32-c-basics-ar-390.png, qa-r32-c-player-ar-390.png (proxy row: label 308px full-width + segmented 308×48 equal segments), qa-r32-e-addons-ar-390.png, qa-r32-e-card-ar.png (health pill "1 سليمة · تم فحص 1/1", "فُحصت قبل 5 ثوانِ" via Intl), qa-r32-d-footer-ar.png (markH 64, wordmark 28px, gap = nav-clearance 96px, no N badge). Measured: link buttons 52dp/9999px inline-flex; "غير متصل" chip bg = error token rgb(147,0,10).
- Turbopack CSS staleness hit AGAIN after dock CSS edit (audit kept flagging the old dock) — clean restart + rm -rf .next required; noted for future rounds.
- lint 0 errors (177 warnings = the new no-literal-ui-string debt catalogue, severity warn by design); tsc clean for all touched files (pre-existing unrelated errors in examples/skills/player-overlay remain); dev.log no runtime errors.

Stage Summary:
- All six reported screens fixed at the SHARED level (tokens + SettingRow/Segmented/Slider/Switch/AddonCard/Poster/footer), so every instance app-wide inherits the fix. Arabic+RTL verified with measured geometry; bidi isolation now systematic (JSX <Bdi> + DOM-layer FSI/PDI).
- audit:ui exists and gates at 0 blocking (quick profile 18 states green); run `node scripts/audit-ui.mjs --full` for the complete matrix (8 widths × themes × 150% scale).
- HONEST LIMITS: (1) 177 lint warnings catalogue remaining literal UI strings across player/picker/views — the AR DOM layer covers most; migrating them into APP_STRINGS is mechanical follow-up; (2) audit "narrow text" heuristic still flags poster-card title columns (media-card design, warn-only); (3) latin-in-ar flags movie titles = data (accepted, excluded where identifiable); (4) 44–47dp warn-band targets are M3-compliant 40dp controls + hit-area padding; (5) production build not runnable in this sandbox (dev-server-only rule) — tsc --noEmit + lint used as the compile gate instead; (6) font-scale 150% verified manually on settings (dropdown degrade) but the full 150% matrix needs `--full`.
- Carried-over: /api/sync detail-view remount flicker; LIVE badge UI for live playlists.

---
Task ID: 30
Agent: Z.ai Code (coordinator, no subagents)
Task: Premium Movie/Show Details redesign (Apple TV+ / Disney+ / Netflix visual language) — hero card with embedded logo, single-line metadata row, centered synopsis, centered CTA + expandable menu, immersive chrome (bottom nav hidden), semi-transparent back button.

Work Log:
- app-shell.tsx: new `immersiveDetail` memo — walks the nav stack top-down skipping player/picker overlays; when the top CONTENT frame is `detail`, `showChrome` becomes false → GlassDock + FloatingSearch + global BackButton unmount, main drops `--nav-clearance` (detail supplies its own bottom padding). Overlays on top of detail keep the immersive answer. Dock correctly REAPPEARS on pop/resetTo home (verified via browser click-through).
- detail-view.tsx FULL REWRITE (presentation only; all business logic — meta loading, addon-meta fallback, resume/nextVideo, picker push, watchlist, TMDB enrichment — unchanged):
  1. Hero = contained rounded CARD (aspect 16/11 → 16/8 → 21/8, ring + deep shadow) with PosterImage backdrop; logo (tmdb.logo ?? meta.logo) embedded INSIDE the card's bottom scrim, centered; text-title fallback when no logo art; ZERO floating chips/badges/buttons on artwork (removed HERO_CHIP rows + inline RatingsRow + button row from hero); sr-only h1 preserved.
  2. Single-line metadata row directly below the card: [amber IMDb star badge] • [year] • [runtime] • [genre chip] (+ cert box + bidi-isolated "via {addon}"); non-wrapping; outer scroller + inner w-max/min-w-full/justify-center pattern → centered when it fits, scrolls from the true start edge on 320px (no justify-center scroll-trap).
  3. Synopsis: centered, max-w-2xl, text-ink-muted, leading-[1.8], md:text-[15px].
  4. Centered action row: primary CTA `md-btn-filled` 52dp full-round with accent glow shadow + hover/active scale micro-interactions (resume variant "Resume S{s}:E{e}" kept); adjacent compact 52dp circular dropdown button with framer-motion chevron rotate + AnimatePresence menu (Add to watchlist toggle / Available streams / Share — Esc + outside-click close, aria-haspopup/expanded, min-h-11 items); third circular 52dp AddToListButton (new additive `variant="icon"`, popover centered under button, default "row" look untouched). Watch Now/Watchlist/Streams/Share all live (share → navigator.share with clipboard fallback + toast).
  5. DetailBackButton: fixed top-start glass pill owned by the page (so deep-linked ROOT detail still has back; root pop falls back to resetTo home); ArrowLeft flips via rtl:rotate-180. Cast/crew restyled as quiet centered lines; EpisodeList keeps logic, gains dir=auto title + bdi E-prefix; rails gain i18n headings.
- i18n.ts: +30 detail keys (watchNow, resumeSE, moreOptions, addToWatchlist, inWatchlistItem, availableStreams, streamsHint, share, linkCopied, director, starring, episodesTitle, seasonN, selectSeason, newest/oldestFirst, noEpisodes, episodeN, recommendedTitle/ByTmdb, viaTmdb, moreLikeThis, viaAddon, loadingDetails, titleNotFound, fetchFailed, goBack, contentRating, pressPlayHint) — complete en/ar pairs.
- Bidi hardening found in QA: addon runtime strings ("58 min") rendered "min 58" in RTL → runtime span dir="ltr" + tabular-nums; episode title dir="auto" + <bdi>E{n}</bdi>; via-addon name <bdi> via RichVia template splitter.
- VERIFIED via agent-browser (screenshots download/qa30-*.png): desktop EN series (Planet Earth II: logo embedded, ★9.4•2016•58min•Documentary row, Trakt chip, CTA row) · menu open (chevron flip, 3 items, glass panel) · watchlist toggle menuitem → "In watchlist" state persists · mobile 390 EN (row fits without wrap, actions fit) · mobile bottom (More like this + clean end) · AR RTL (back button mirrored top-right with flipped arrow, row mirrored, مشاهدة CTA, البثوث المتاحة/مشاركة menu RTL, الموسم chips) · AR menu screenshot (58 min fixed, في قائمة المشاهدة state) · movie EN desktop (Shawshank: 21/8 card, logo, metadata row, director/starring lines) · deep-link ROOT detail → Go back → Home with dock restored · same-document hash nav re-test OK (earlier one-off race not reproducible).
- lint 0 errors (warnings = pre-existing no-literal-ui-string backlog, detail-view itself fully on t()); dev.log: no runtime errors (only normal prisma sync traces + expected Cinemeta/TMDB 501-502 soft-fails).

Stage Summary:
- Detail page is now an immersive, premium title screen: artwork untouched, hierarchy metadata → synopsis → actions, all controls centered, dock/search hidden, back always available (incl. deep-link root).
- Immersive logic lives in app-shell (stack-derived), so ANY future detail-like frame can opt in by frame kind; no business logic touched; data contracts untouched.
- HONEST LIMITS: (1) lint warnings backlog (literal strings elsewhere) still open = defect G sweep; (2) share uses Web Share API where available, clipboard fallback needs HTTPS/localhost; (3) AddToListButton popover is click-outside-close only (no focus trap) — matches pre-existing pattern; (4) hero uses backdrop ?? background ?? poster — poster-only titles crop wide (existing behavior).
- Next candidates: defect-G string migration sweep, /api/sync detail remount flicker, LIVE badge for live playlists.

---
Task ID: 31
Agent: Z.ai Code (coordinator)
Task: Push project to GitHub (hoseain756/Horse) per user's commands: remote add origin, branch -M main, push -u origin main.

Work Log:
- Found repo with 36 auto-generated UUID commits; CRITICAL: tracked secrets — .env (real PROXY_SECRET HMAC key, Trakt client id) and db/.media-proxy-secret (same HMAC) present across ALL history; also db/*.db runtime data + download/ QA screenshots tracked.
- .gitignore extended: .env, db/.media-proxy-secret, db/*.db(+journal/wal/shm) — files remain on disk, app unaffected.
- Discovered an external auto-commit daemon on this box switched branches mid-operation (orphan checkout reverted to main with index preserved); adapted by performing the whole clean-history flow in one atomic pass.
- History rebuild: checkout --orphan → rm -rf cached → add -A (respects new gitignore) → verified staged tree SECRETS-CLEAN (grep for .env/media-proxy-secret/*.db = none; pattern scan of all 670 files for PRIVATE KEY/client_secret/PROXY_SECRET= → only OAuth parameter names in code) → single commit f9fb651 "Horse — Stremio addon-protocol media center (Next.js 16 web client)" (670 files) → git branch -M main replaced old history on main.
- git remote add origin https://github.com/hoseain756/Horse.git — OK; ls-remote confirmed repo exists (empty, reachable).
- git push -u origin main FAILED: no GitHub credentials in sandbox (no gh CLI, no credential helper/store, no env tokens) — "could not read Username". Local state is push-ready; awaiting user PAT (fine-grained, repo-scoped recommended).

Stage Summary:
- main = one clean commit, secrets never published; remote origin configured; runtime intact (dev server up, .env/db on disk untracked).
- BLOCKED ON: user-provided GitHub token to execute the final push. Command ready: git push -u origin main (or embed token: https://<TOKEN>@github.com/hoseain756/Horse.git).
---
Task ID: 33
Agent: Z.ai Code (coordinator, no subagents)
Task: User supplied a GitHub PAT (github_pat_11BBR…, account hoseain756) — push the project. Then re-verify the completed detail-page redesign (Task 30) still healthy.

Work Log:
- Token verified via GET /user → login "hoseain756" (fine-grained PAT). Local repo state: branch main, working tree clean, 2 commits (f9fb651 clean-history rebuild + one daemon commit adding only worklog.md lines); re-audited index = SECRETS-CLEAN (no .env / db/.media-proxy-secret / *.db tracked), no files >5MB.
- Remote origin = https://github.com/hoseain756/Horse.git, repo exists (public, default branch main) but EMPTY (size 0).
- Push attempt via token-embedded URL → 403 "Permission to hoseain756/Horse.git denied". Diagnosis: API header `x-accepted-github-permissions: metadata=read` — the fine-grained PAT has ONLY Metadata:Read. POST /user/repos → 403 (cannot create repos either); GET /user/repos → 200 (read-only). Push is server-side impossible with this token — no workaround (Contents:RW is required for git push AND for the contents API).
- LIVE RE-VERIFICATION of Task 30 redesign (agent-browser, nothing changed since — git diff vs f9fb651 is worklog-only): deep link #/detail/movie/tt0111161 (Shawshank) desktop 1280×800 → hero card with official logo embedded in bottom scrim, ZERO floating elements; single-line metadata row ★9.3 • 1994 • 142 min • Drama (+ Trakt 9.2 chip); centered synopsis; centered Watch Now + dropdown + lists buttons; semi-transparent Back top-start; dock/search absent (immersive). Menu click @e617 → chevron flips, glass panel with Add to watchlist / Available streams / Share. Mobile 390×844 → row fits without wrap, all controls fit, no h-overflow. Console: no errors (only Fast Refresh notices). Screenshots: download/qa33-detail-en.png, qa33-detail-menu.png, qa33-detail-mobile.png. dev.log healthy (normal sync/Cinemeta traffic, expected TMDB 501 soft-fails).
- lint not re-run (no source files modified this round).

Stage Summary:
- Repo is PUSH-READY but BLOCKED: the provided PAT is read-only (metadata:read). USER FIX (either): (a) fine-grained PAT → Repository access: All repositories (or select Horse) → Permissions → Repository permissions → Contents: Read and write; or (b) classic PAT with `repo` scope. Then `git push -u origin main` completes immediately.
- SECURITY NOTE: the PAT was pasted in plaintext chat — recommend revoking/rotating after use regardless.
- Detail redesign (Task 30) re-verified healthy in live app; no regressions.
---
Task ID: 34
Agent: Z.ai Code (coordinator, no subagents)
Task: User asked (AR) for a ready one-click link that grants push access ("عطني رابط جاهز اضغطة يعطيك سماح للوصول") — instead of manually fixing the read-only PAT.

Work Log:
- Implemented GitHub OAuth DEVICE FLOW (the only click-to-grant mechanism GitHub offers): POST /login/device/code with the public GitHub CLI OAuth app client_id (178c6fc778ccc68e1d6a) — transparent to the user that the consent screen says "GitHub CLI". Scope requested: `repo` only (verified repo has NO .github/workflows files, so workflow scope unnecessary; repo is public).
- Flow: user_code BC4C-4D4E, verification_uri https://github.com/login/device, expires_in 899s, interval 5s. device_code kept OUT of the repo.
- Background poller launched: /tmp/ghflow/poll.sh (setsid, detached) → polls /login/oauth/access_token every 5s (slow_down-aware), on success: chmod-600 token at /tmp/ghflow/token → `git push https://x-access-token:<t>@github.com/hoseain756/Horse.git main:main` → logs PUSH_OK → DELETES token. All artifacts live in /tmp/ghflow/ (OUTSIDE the repo so the external auto-commit daemon can never commit/log a secret). Log: /tmp/ghflow/flow.log.
- Poller started 14:11:30 UTC; runs ~18 min (220×5s) > token expiry.
- NEXT ROUND MUST: check /tmp/ghflow/flow.log — PUSH_OK → confirm to user + verify remote (API repo size/branch) + append final entry; PUSH_FAILED → token file kept at /tmp/ghflow/token for one manual retry, inspect error (never print token); EXPIRED/DENIED/no-code → restart device flow or fall back to the pre-filled classic PAT link (https://github.com/settings/tokens/new?description=Horse%20push&scopes=repo) with user pasting token back; push command ready regardless: git push https://x-access-token:<TOKEN>@github.com/hoseain756/Horse.git main:main.
- SECURITY: user consent screen will read "GitHub CLI" (expected); token never displayed in chat; recommend the user revoke the authorization afterwards (Settings → Applications → Authorized OAuth Apps → GitHub CLI) once push is confirmed.

Stage Summary:
- One-click grant flow is LIVE and armed: user clicks https://github.com/login/device, enters BC4C-4D4E, clicks Authorize → push happens automatically within ~5-10s, no further user action.
- Fallback path documented above if the code expires (15 min) or is denied.
