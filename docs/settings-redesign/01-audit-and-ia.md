# Settings Redesign — STEP 1 Inventory & Audit + STEP 2 IA + STEP 3 Design System
Task 70 · Horse (Harbor Web) · evidence-based, measured from code at commit 09e8077

---

## PART A — INVENTORY (every setting; storage `harbor-web.settings` unless noted)

Legend — UI: ✅ row exists in settings-view today · ⚠️ functional but edited elsewhere · ❌ orphan (no consumer AND no UI) · ◐ has UI but no consumer (half-working) · SYNC: full settings blob uploads verbatim (cloud-sync.ts:176-188) → every key below syncs when cloudSyncEnabled. Secrets in separate keys noted. Gated: Kids-PIN gate does NOT exist today (see audit F1).

### Basics / Home
| # | Key | Type | Default | UI today | Consumer (evidence) | Verdict |
|---|-----|------|---------|----------|---------------------|---------|
| 1 | profileId | text | "default" | ❌ | none found | orphan |
| 2 | region | text | "US" | ❌ | detail-view.tsx:123, tmdb.ts:40 | reachable, uneditable |
| 3 | preferredLanguages | text[] | ["English"] | ❌ | p2p.ts pickAudioRel (picker/player) | reachable, uneditable |
| 4 | uiLanguage | segmented | "en" | ✅ LanguagePanel | everywhere (i18n) | functional |
| 5 | homeMode | segmented harbor/classic | "harbor" | ✅ Basics | home-view | functional |
| 6 | homeShowAllAddonRows | switch | false | ✅ Basics | home-view | functional |
| 7 | hideWatchedInCatalogs | switch | false | ✅ Basics | catalog rows | functional |
| 8 | tmdbKey | secret-text | "" | ❌ | NONE (tmdbUserKey is used) | orphan legacy; still synced plaintext-in-blob |
| 9 | opensubtitlesEnabled | switch | true | ❌ | none | orphan |
| 10 | tmdbEnabled | switch | true | ✅ TmdbCard | tmdb enrichment | functional |
| 11 | tmdbLanguage | select | "en-US" | ✅ TmdbCard | tmdb.ts | functional |
| 12 | tmdbImageQuality | segmented l/m/h | "medium" | ✅ TmdbCard | tmdb.ts | functional |
| 13 | tmdbUserKey | secret-text | "" | ✅ TmdbCard | tmdb.ts:38 | functional |
| 14 | ratingsProviders | order-list | [] | ✅ RatingsSettingsCard | ratings/* | functional |
| 15 | ratingsEnabled | switch | true | ✅ RatingsSettingsCard | ratings | functional |
| 16 | showImdbBadge | switch | true | ❌ | none | orphan |
| 17 | showMalBadge | switch | true | ❌ | none | orphan |
| 18 | showQualityBadge | switch | true | ❌ | none | orphan |
| 19 | showCardBadges | switch | true | ◐ Basics row | NO rendering consumer (meta-card.tsx:28-37 unconditional) | half-working |
| 20 | cardBadgeLimit | slider | 3 | ❌ | none (only clamp) | orphan |
| 21 | posterScale | slider 70-140% | 1 | ◐ Basics slider | NO consumer (no setProperty anywhere) | half-working |
| 22 | posterRadius | slider 0-28 | 12 | ◐ Basics slider | NO consumer (--poster-radius static, globals.css:233) | half-working |
| 23 | hidePosterTitles | switch | false | ❌ | none | orphan |
| 24 | posterEffect | seg blur/fade/off | "off" | ❌ | none | orphan |
| 25 | episodesView | seg auto/list/grid | "auto" | ⚠️ episodes toolbar | episodes-section.tsx:215,307 | functional off-settings |
| 26 | blurEpisodeThumbnails | switch | false | ✅ Basics | episodes | functional |

### Player
| 27 | instantPlay | switch | true | ✅ Basics | picker | functional |
| 28 | autoPlayNextEpisode | switch | true | ✅ Basics | player | functional |
| 29 | resumePlayback | switch | true | ✅ Basics | player/cw | functional |
| 30 | resumePrompt | switch | false | ❌ | none | orphan |
| 31 | playerConfirmLeave | switch | true | ✅ Basics | player | functional |
| 32 | seekBackStepSec / 33 seekForwardStepSec | slider 5-60 | 10/10 | ✅ Player (one row writes both) | player | functional |
| 34 | subFontSize | slider 12-64 | 28 | ✅ Player | subtitle style | functional |
| 35 | subFontColor | color | #FFFFFF | ❌ | subtitle renderer? (grep: style application in player) | reachable, uneditable |
| 36 | subBorderColor | color | #000000 | ❌ | same | reachable, uneditable |
| 37 | subBorderSize | slider 0-10 | 0 | ✅ Player | same | functional |
| 38 | subBackgroundOpacity | slider 0-100 | 0.35 | ✅ Player | same | functional |
| 39 | subStyle | seg shadow/outline/box | "shadow" | ❌ | same | reachable, uneditable |
| 40 | preferredSubLangs | multi+order | ["English"] | ✅ LanguagePanel | subtitle pick | functional |
| 41 | subtitlesOffByDefault | switch | false | ✅ LanguagePanel | player | functional |
| 42 | customPlaybackSpeeds | number[] | [] | ❌ | NONE (speeds hardcoded player-overlay.tsx:3264) | orphan |
| 43 | showQualityInfo | switch | false | ✅ Player | player HUD | functional |
| 44 | videoFill | seg fit/fill/zoom | "fit" | ✅ Player | player | functional |
| 45 | playerTheme | seg auto/default/stremio | "auto" | ✅ Player | player chrome | functional |
| 46 | pickerLayout | seg condensed/stremio | "stremio" | ✅ Player | picker | functional |
| 47 | streamSort | seg score/addon | "addon" | ❌ | none | orphan |
| 48 | p2pEnabled | switch | true | ✅ P2pCard | engine | functional |
| 49 | browserEngineEnabled | switch | false | ✅ P2pCard | browser engine | functional |
| 50 | proxyMode | seg auto/always/never | "auto" | ✅ Player | media proxy | functional |
| 51 | transcodeMode | seg auto/ask/never | "ask" | ✅ Player (capability-gated) | transcode | functional |
| 52 | playableOnly | switch | true | ✅ Player | picker | functional |
| 53 | preferH264 | switch | true | ✅ Player | scoring | functional |

### Kids / Library / Content
| 54 | kidsCardSize | seg l/m/s | "medium" | ⚠️ kids-view.tsx:109-152 | kids cards | functional off-settings |
| 55 | librarySort | seg recent/title/year | "recent" | ⚠️ library-view header | library | functional off-settings |
| 56 | libraryBookmarkedOnly | switch | true | ⚠️ library-view toggle | library | functional off-settings |
| 57 | hideContent.{anime,liveTv,adult} | switches | false/false/true | ⚠️ anime/live views + dockTabsFor | nav + views | functional off-settings |
| 58 | kidsMode | switch | false | ⚠️ command palette ONLY | dock/rail/theme/kids-view | functional; NO PIN, NO touch exit |
| 59 | iptvPlaylists | list-editor | [] | ⚠️ live-view dialog | live-view | functional off-settings; URLs sync in blob |

### Theme (sub-object `theme.*` + appearance/contrast)
| 60 | theme.preset / customColors / customName / fontPair / layout / cardStyle / buttonStyle / backgroundImage / backgroundDim | studio | preset | ✅ ThemePanel+ThemeStudio | applyTheme | functional |
| 61 | appearance | seg dark/light | "dark" | ✅ ThemePanel (EN literals) | md3 apply | functional |
| 62 | contrastLevel | seg s/m/h | "standard" | ✅ ThemePanel (EN literals) | md3 apply | functional |

### Navigation / Hub / Misc
| 63 | navOrder / navHidden / navRenamed | lists/map | [] | ❌ NO writer anywhere | read-only nav-items.tsx:45-69 | dead customization |
| 64 | hubOrder / hubHidden | lists | [] | ✅ QuickAccess edit mode | hub | functional |
| 65 | dockAutoHide | switch | true | ✅ Basics | glass-dock | functional |
| 66 | railAutoHide | seg auto/always | true | ✅ Basics | side-rail | functional |
| 67 | aiEnabled / aiStyle | switch/seg | true/concise | ❌ | ZERO consumers | orphan pair |
| 68 | soundTheme | seg none/modern/cinematic | "none" | ❌ | ZERO consumers | orphan |
| 69 | wrappedButton | switch | true | ❌ | ZERO consumers (Wrapped always reachable) | orphan |
| 70 | cloudSyncEnabled | switch | true | ✅ Data | cloud-sync | functional |

### Settings-adjacent surfaces (not in settings.ts)
| Surface | Storage | Synced | Where managed |
|---|---|---|---|
| Horse account (email auth, devices, export) | server + session cookie | — | Data panel (HorseAccountCard) |
| Debrid API key (torbox/realdebrid/alldebrid) | `harbor-web.debrid` plaintext | NO (device-local) | Integrations DebridCard |
| Trakt/Simkl link | server vault; `harbor-web.links` opaque linkId | linkId only | Integrations cards |
| Trakt legacy BYO token | `harbor-web.trakt` plaintext | NO | (legacy path) |
| Addons (+ per-addon probe) | `harbor-web.installed-addons` | YES (encrypted at rest per-row) | Addons view / hub |
| Watchlist / CW / History / Lists | own keys | YES | their views |
| User themes | `harbor-web.user-themes` | YES | Theme Studio |
| Local engine config | `harbor-web.local-engine` | NO (device-local by design) | P2pCard |
| Device pairing | pairing store | NO | DebridCard |

Count: 70 inventory rows. UI-reachable today in settings-view: ~34. Orphans: 14 keys. Half-working (UI but no consumer): 3 (showCardBadges, posterScale, posterRadius). Reachable-uneditable: 6 (region, preferredLanguages, subFontColor, subBorderColor, subStyle, navOrder family).

---

## PART B — AUDIT FINDINGS (each with evidence + verdict)

**F1. Kids parent PIN does not exist** (brief assumes it does). `kidsMode` is a plain boolean toggled ONLY from the command palette (command-palette.tsx:229-241); no PIN storage, no hashing, no gate component; Settings/palette/search remain reachable while Kids Mode is on; no touch exit (nav hides the Kids tab instead, nav-items.tsx:56). → Decision: build the PIN gate as part of the redesign (UI-layer gate + hashed PIN in localStorage; the category is gated while Kids Mode active, exit requires PIN). This ADDS the missing capability rather than changing existing logic.

**F2. Orphaned settings (14 keys) sync as dead weight; 3 half-working controls lie to users.** showCardBadges toggle does nothing; posterScale/posterRadius sliders do nothing (no CSS var writes). aiEnabled/aiStyle/soundTheme/wrappedButton/customPlaybackSpeeds/streamSort/resumePrompt/badge family/opensubtitlesEnabled/posterEffect/hidePosterTitles/tmdbKey/profileId have zero consumers. → Migration: remove keys via sanitizeSettings (already tolerant to unknown keys) with a documented tombstone list; wire posterScale/posterRadius/showCardBadges properly (they are user-visible promises) — poster radius/scale get real CSS-var consumers, badges get real consumers OR are cut with the row. Never silently drop a working capability: none of the orphans are working.

**F3. No deep links / anchors / per-setting search.** Section is `useState` (settings-view.tsx:74); only an event (`harbor:settings-section`) switches tabs — 7 dispatchers (palette, integrations-strip, app-shell, addons-view, player) but NOT floating-search; no `#anchor`, no highlight-on-arrival; search indexes only the 9 hub destinations (floating-search.tsx:79-88,550). → New IA adds routes `/settings/[category]` + `#setting-key` anchors + search index of every setting (ar+en synonyms) + arrival highlight.

**F4. Single-column tabs at every size — no two-pane ≥840dp, no TV scale.** Grid is `max-w-6xl` single pane with 7 primary tabs at 320→2560 (settings-view.tsx:87-148). → New SettingsShell with container-query bands (tokens below).

**F5. Literal English strings across whole panels** (violates the app's own lint rule): ThemePanel ("Appearance", "Theme Studio", "Open Theme Studio", "Theme presets", "Font pairing", "Custom background", "Upload image", "Dim"…), LanguagePanel ("Preferred subtitle languages", "Priority order", "TOP PICK"), DataPanel ("Export backup", "Restore", "Clear", "Current settings size" + toasts), AboutPanel (entire panel + shortcuts), TraktCard/SimklCard (buttons, statuses, toasts), CloudSyncCard (two long English paragraphs), DebridCard (partially), P2pCard (partially). → i18n sweep ar/en for every string; audit script flags Latin-only outside allow-list.

**F6. Danger action without confirmation**: "Clear local data" runs `clearData()` immediately on click (settings-view.tsx:1097-1101) — wipes ALL harbor-web.* keys including debrid key and addons with no AlertDialog. Delete-account and debrid-key-delete DO confirm. → DangerZone component with confirm + typed undo snackbar where feasible.

**F7. Two overlapping sync surfaces**: CloudSyncCard (anonymous device-key sync, legacy) + HorseAccountCard (email account, merge strategies) both present in Data; their relationship is unexplained. → IA: Account & Sync category with one status surface; keep both mechanisms (no logic change), clarify copy.

**F8. Privacy**: full settings blob (incl. `tmdbKey` legacy + `iptvPlaylists` URLs that may embed provider credentials) uploads in plaintext JSON; protection is server-side AES-256-GCM at rest (vault.ts, sync/route.ts:332-355). No client-side E2E. → Keep mechanism (no logic change), surface honest privacy notes + prune dead `tmdbKey` from sanitize (stops syncing a useless secret).

**F9. Defects from the brief already fixed in current code (must survive redesign)**: row squeeze → `.harbor-cq` container queries stack <520px (globals.css:2383-2434); RTL switch → custom M3 `md-switch` with logical inset (switch.tsx, globals.css ~2470+); segmented dropdown fallback (settings-view.tsx:179-207); search-over-tabs → `.harbor-fs-clear` (globals.css:2451-2463); addon card name/URL fixes (addons-view.tsx:5-16, 342-418). Footer logo is 64px (globals.css:2566) and NO dev badge exists in code — earlier observation not reproduced; verify live in QA.

**F10. Component gaps**: no shared IntegrationCard (6 ad-hoc cards), no Select (native `<select>` fallback), no masked-secret reveal on TMDB key field, no live previews (poster preview missing since sliders are dead; no subtitle preview), no sync/device indicators on rows, no per-section reset, no undo. Slider lacks TV steppers. SettingRow lacks anchor id/badges.

---

## PART C — STEP 2 IA (every key mapped to exactly one place)

Routes: `/settings` (Home: account card + Quick Access + category list) · `/settings/[category]` for each below. Anchors `#<key>` per row. Categories:

1. **account** — Account & Sync: HorseAccountCard (sign in/register/devices/export/delete), CloudSyncCard (cloudSyncEnabled), privacy note. Synced indicator on synced rows.
2. **appearance** — Appearance: theme.preset/appearance/contrastLevel/fontPair/background image+dim (Theme Studio entry), uiLanguage, posterScale+posterRadius (WIRED to real CSS vars) + live preview card, showCardBadges (WIRED) + hidePosterTitles (WIRED) preview, navigation behavior (dockAutoHide, railAutoHide, navOrder/navHidden/navRenamed — NEW dock customization editor replacing dead keys), homeMode, homeShowAllAddonRows, hideWatchedInCatalogs, blurEpisodeThumbnails, episodesView (surfaced here AND kept in episodes toolbar — one source).
3. **playback** — Playback: instantPlay, autoPlayNextEpisode, resumePlayback (+resumePrompt WIRED as "ask before resuming" — currently orphaned; wire to player), playerConfirmLeave, seek steps, videoFill, playerTheme, pickerLayout, showQualityInfo, proxyMode, transcodeMode, playableOnly, preferH264, customPlaybackSpeeds (WIRED to player speed menu), streamSort (WIRED to picker sort or REMOVED — implement sort toggle), p2pEnabled, browserEngineEnabled (P2pCard lives here).
4. **subtitles** — Subtitles: preferredSubLangs, subtitlesOffByDefault, subFontSize/Color/Border(Color,Size)/Style/BackgroundOpacity + LIVE PREVIEW over sample frame.
5. **integrations** — Integrations: TraktCard, SimklCard, TmdbCard, RatingsSettingsCard, DebridCard(+DevicePairingCard), engine/serverless card. Shared IntegrationCard shell.
6. **addons** — Addons: full addons manager (existing view embedded as category content; keeps top-level hub entry).
7. **kids** — Kids & Parental (whole category behind parent PIN while kidsMode): kidsMode toggle (PIN-gated), NEW parent PIN set/change (hashed), kidsCardSize, hideContent.{anime,liveTv,adult}.
8. **data** — Data & Privacy: export/restore backup, clear local data (CONFIRMED, DangerZone), settings size (diagnostics, demoted to footnote), region, preferredLanguages.
9. **about** — About: logo lockup (64dp icon + wordmark), version, MIT/Harbor attribution, not-affiliated notice, TMDB attribution, keyboard shortcuts (i18n), PWA install.

Removed (migration tombstones, sanitize deletes; no capability lost — all zero-consumer): aiEnabled, aiStyle, soundTheme, wrappedButton, opensubtitlesEnabled, posterEffect, showImdbBadge, showMalBadge, showQualityBadge, cardBadgeLimit, resumePrompt→wired (kept), tmdbKey (legacy duplicate of tmdbUserKey), profileId. Wired instead of removed: posterScale, posterRadius, showCardBadges, hidePosterTitles, customPlaybackSpeeds, region, preferredLanguages, subFontColor/subBorderColor/subStyle, navOrder/navHidden/navRenamed, resumePrompt, streamSort (implement) — each becomes a real control + real consumer.

## PART D — STEP 3 design system (components + tokens)

New shared components (one source of truth, `src/components/harbor/settings/`):
- `SettingsShell.tsx` — size-class layout (drill-down <840 / two-pane ≥840 / TV ≥1600 scale), top bar + breadcrumb, safe areas, nav clearance, rail inset; category state in URL; scroll persistence per pane.
- `CategoryList.tsx` / `CategoryItem.tsx` — icon outlined/filled, title, live one-line summary, status badges; glass active pill in two-pane.
- `SettingsSection.tsx` — surface-container card, optional glass header, per-section reset.
- `SettingRow.tsx` — anchor id, container-query stack <520dp, label min-width guard, badges, sync/device indicator, danger variant, description via RichBidi.
- Controls: `ToggleRow`(M3 switch), `SliderRow`(+TV steppers), `SegmentedRow`(existing SegmentedControl generalized + dropdown fallback), `SelectRow`(collision-aware popover), `TextFieldRow`(dir=ltr, mask+reveal, validation), `ColorRow`, `ActionRow`, `DangerZone`, `PreviewCard` (poster + subtitle), `IntegrationCard`.
- Tokens (globals.css, ≥840 only for pane band; <840 values untouched): `--settings-list-w: 300px`, `--settings-detail-max: 880px`, `--settings-band: 840px`, `--settings-tv-band: 1600px`, `--settings-row-min-h: 56px/64px(tv)`, TV type scale ≥22px base.

## PART E — size-class layout (sketch)

- Phone <600: Home = account card → Quick Access (2-col grid) → category rows 64-72dp; tap pushes `/settings/[cat]` with back-crumb app bar; sticky section headers; bottom nav clearance.
- Tablet 600-839: same drill-down, content max 720dp centered, Quick Access 2-col; rows comfortable.
- 840-1599: two-pane — left: account mini + Quick Access compact + categories; right: category content ≤880dp; swap without reload; URL updates; left pane scroll preserved.
- ≥1600 (TV): two-pane scaled; rows ≥72-80dp, targets ≥56dp, D-pad: arrows cross panes, Enter activates, Esc/Backspace back, glass focus ring 3-4px + subtle scale, sliders via Left/Right + ± steppers, no hover-only affordances; focus remembered per pane.
- RTL: logical properties everywhere; pane order mirrors; chevrons/switches mirror; media icons don't.

## PART F — open decisions (NOT blockers — proceeding with stated defaults)
1. Kids parent PIN does not exist today → building it (hashed PIN, gate on Kids category + exit). Brief assumed it existed; audit says otherwise.
2. `streamSort` → implement as picker sort toggle (score vs addon order) since scoring already returns both orders.
3. Legacy CloudSyncCard + account sync coexist → keep both, clarify copy (no logic change).
