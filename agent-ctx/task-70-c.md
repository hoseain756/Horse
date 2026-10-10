---
Task ID: 70-c
Agent: full-stack-developer (session interrupted post-implementation; verification completed by coordinator)
Task: Wire the 6 dead/lying settings to real consumers (audit F2) + PIN-gate Kids-mode OFF in the command palette.

Work Log:
- FIX 1 posterScale/posterRadius: NEW src/lib/harbor/poster-look.ts (applyPosterLook writes --poster-scale/--poster-radius with defensive clamps 0.6–1.6 / 0–28px); app-shell.tsx settings effect calls it next to applyTheme; globals.css .harbor-poster border-radius → var(--poster-radius, fallback) + poster img transform scale(var(--poster-scale,1)) + matted inset background while loading.
- FIX 2 showCardBadges/hidePosterTitles: meta-card.tsx now gates the on-poster chip cluster (rating/addonOrigin/releaseInfo) behind showCardBadges and the title block behind !hidePosterTitles, via atomic zustand selectors (per-card re-render discipline).
- FIX 3 subFontColor/subBorderColor/subStyle: player-overlay.tsx subtitle layer — subCssColor() normalizer (bare-hex/#-prefixed), WebkitTextStroke from border size+color with paintOrder "stroke fill", textShadow per style (shadow/outline via subOutlineShadow() 4-dir + double-weight >2px, box keeps rgba background 0.15em/0.35em radius 4px). Verified this overlay is the ONLY subtitle render path (native tracks suppressed) — HLS unaffected.
- FIX 4 customPlaybackSpeeds: speedMenuItems() sanitizes read-only (finite 0.25–4, dedup, ascending, 1 always present, fallback to classic presets when empty); wired into the speed menu grid.
- FIX 5 resumePrompt: resumeAskAt chip (Up-Next card language, ar+en literals from file pattern) above transport; blocks the silent seek + progress persistence while pending; Resume applies the same title-seconds→element-time seek incl. near-end guard; Start over clears stored position. resumePrompt=false path byte-identical behavior.
- FIX 6 streamSort: picker-overlay.tsx tiers memo re-sorts flat list by score desc (stable index tiebreak → addon order survives ties) when streamSort=score; "addon" default keeps today's order exactly; tier headers pinned to TIER_ORDER.
- FIX 7 command-palette.tsx: act:kids OFF gated by hasParentPin()+!isParentUnlocked() → inline PIN confirm inside palette overlay; verifyParentPin success grants the session unlock (subsequent OFF free); ON never gated; no PIN → unchanged behavior.
- Coordinator byte-check: suspected `max-w-in(` class corruption disproved — file contains correct `max-w-[min(...)]` (Read/pipe display artifact swallowing "[m", same class as Task 69).
- VERIFIED: bunx tsc --noEmit (all touched files clean); bun run lint 0 errors (157 pre-existing warnings); curl / → 200; dev.log clean.

Stage Summary:
- All 7 fixes landed with file:line evidence in diffs; settings that lied now do what they promise; defaults preserved byte-for-byte for existing users (streamSort=addon, resumePrompt=false, empty customPlaybackSpeeds).
- Honest limits: subtitle WebkitTextStroke replaces the brief's textShadow-outline idea (better: paintOrder keeps fill on top — crisper at any borderSize); poster-scale zooms art within its frame (true "poster size" reflow would fight every grid); QA of resume chip + speed menu in a real playback session still to be browser-verified by coordinator.
