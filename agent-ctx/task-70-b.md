---
Task ID: 70-b
Agent: full-stack-developer
Task: Reorganize settings-view.tsx onto SettingsShell — nine categories (audit Part C), anchor contract, per-section reset; panels moved, not rewritten.

Work Log:
- Read worklog (last 3 entries), docs/settings-redesign/01-audit-and-ia.md Parts C/D/E, and the toolkits: settings/shell.tsx, settings/design.tsx, lib/harbor/parent-pin.ts.
- Found the working tree already carried a completed (interrupted before verify) rewrite of settings-view.tsx from a prior 70-b session: 3899 lines vs 3462 at HEAD. Verified its fidelity before trusting it:
  * Region-diffed every moved panel against HEAD: TraktCard/SimklCard/DebridCard/P2pCard/HorseAccountCard/ForgotPasswordLink/CloudSyncCard byte-identical (only re-indent/anchor additions); ThemePanel = same logic wrapped in the shared SectionCard + i18n'd titles + anchors; AboutPanel unchanged; old local SettingRow/SectionCard/SegmentedControl/SettingSliderRow, SECTIONS, `type Section`, section state and the `harbor:settings-section` listener all deleted; header comment matches Task 70.
  * Confirmed "const [mode…" / "const [merge…" lines are intact via `od -c` (Read-tool ANSI display artifact, same false alarm as Task 69 — bytes are fine).
- Fixed the read-tool artifact paranoia only where real spec gaps existed (SubtitlesPanel):
  1. Preview spec compliance: outline stroke now `Math.max(1, subBorderSize/2)` (was `1 + size/2`); fontSize now `Math.max(12, subFontSize*0.5)`; box radius 6px→4px — all per the 70-b brief.
  2. REAL BUG: settings.ts sanitizeSettings validates subtitle colors as BARE 6-hex (`/^[0-9A-Fa-f]{6}$/`), so the design.tsx ColorRow writing "#RRGGBB" was wiped back to default on every update — custom colors could never persist. Fixed inside settings-view only: added `subColorHex()` normalizer; ColorRow now writes bare hex and reads normalized `#RRGGBB` (handles legacy "#"-prefixed values). Mirrors the player renderer's subCssColor() (player-overlay.tsx, task 70-c) so preview == playback for both storage forms.
- Verified AddonsView embeds standalone: its `useNav` is the zustand frame-stack store (not a router hook) — no guard needed.
- Verified all i18n keys used exist (tsc passes against the strict AppStringKey union; checked the Task-70 block 840-966 in i18n.ts). No new keys invented; section titles reuse existing keys (tabLanguage/tabTheme) or the brief's literals ("Posters & cards", "Navigation", "Behavior", "Streams & sources", "Pipeline", "Style", "Content limits", "Backup & restore", "Content preferences") per the "never invent keys" rule.
- Verification suite (in order): `bunx tsc --noEmit | grep settings-view` → EMPTY; `bun run lint` → 0 errors / 157 warnings (all pre-existing literal-string style warnings, 31 of them in settings-view from the moved-as-is panels); `curl :3000` → 200; dev.log clean (only pre-existing /api/sync 500s: sandbox has no POSTGRES_URL — cloud-sync backend env issue, unrelated to this file).
- Live browser QA (agent-browser, 1440/780/390): two-pane shell renders 3 groups + 9 categories; per-category DOM anchor audit (below); preview math verified live (shadow/outline/box inline styles match spec incl. max(1,…) stroke and 4px radius); PIN battery: create (choose→confirm→salted hash stored, row flips to Change/Remove), kidsMode OFF gate (wrong PIN → "Wrong PIN" shake, correct → switch unchecked), Change-PIN and Remove-PIN both verify-current-first; settings search "subtitle" → 8 indexed rows → jump lands on Subtitles + harbor-row-arrive on set-preferredSubLangs; deep link `#settings/appearance/posterScale` → category opens + arrival highlight; drill-down <840 breadcrumb/back OK; no horizontal overflow at 390; zero page errors. QA artifacts cleaned (parent PIN removed, kidsMode off, subStyle restored to shadow, browser closed).

Stage Summary:
- SettingsView now renders `<SettingsShell categories={CATEGORIES} groups={GROUPS} home={<QuickAccess/>}/>` with NINE categories in the brief's exact groups (general=[account,appearance,playback,subtitles], content=[addons,kids], system=[integrations,data,about]) and the pre-existing panel components reused intact.
- ANCHOR CONTRACT GUARANTEED (all verified in the live DOM as `set-<id>`):
  account: horse-account(wrapper), cloudSync (on CloudSyncCard root)
  appearance: theme-preset(wrapper), appearance, contrastLevel (inside ThemePanel), uiLanguage(wrapper), homeMode, episodesView, showAllAddonRows, hideWatched, blurEpisodeThumbs, posterScale, posterRadius, showCardBadges, hidePosterTitles, dockAutoHide, railAutoHide
  playback: instantPlay, autoPlayNextEpisode, resumePlayback, resumePrompt, playerConfirmLeave, seekStep, streamSort, pickerLayout, showQualityInfo, playableOnly, preferH264, proxy, transcodeMode (capability-gated — hidden in this sandbox, code-verified), videoFill, playerTheme, p2p(wrapper)
  subtitles: preferredSubLangs(SectionCard), subtitlesOffByDefault, subFontSize, subFontColor, subBorderColor, subStyle, subBorderSize, subBackgroundOpacity
  kids: kidsMode, parentPin, kidsCardSize, hide-anime, hide-livetv, hide-adult
  data: export, restore, clear, region, preferred-langs(wrapper)
  about: category-level (no indexed rows)
- Per-section reset ONLY on: appearance "Posters & cards", "Navigation"; playback "Behavior"; subtitles "Style" — each toasts setResetDone with the category label.
- Deviations (with reasons):
  1. CloudSyncCard lives in the ACCOUNT category per the brief, but shell ROW_INDEX indexes it under data/cloudSync. Cannot edit shell.tsx → added the `set-cloudSync` id to the card root so the deep link resolves whenever a pane containing the card is open; noted for the coordinator (index entry could move to account).
  2. Sub-color storage is bare hex (not "#"-prefixed as the brief's `#${…}` wording implied): sanitizeSettings enforces bare 6-hex, so storing "#RRGGBB" would be silently reset — normalization added at both edges instead; preview shows `#`+hex and matches the brief visually.
  3. Preview sliders keep the original ranges (fontSize 14–56 step 2, borderSize 0–8, background 0–100%) — "move, not rewrite"; sanitize clamps wider (12–64, 0–10).
  4. transcodeMode row hidden when serverCapabilities().transcode is false (kept gate) — absent in sandbox DOM by design.
- Files touched: ONLY src/components/harbor/views/settings-view.tsx (3899→3908 lines). i18n.ts, globals.css, shell.tsx, design.tsx, parent-pin.ts untouched.
