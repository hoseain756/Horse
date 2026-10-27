# AUDIT — Task 107-e (final adversarial audit of the Harbor glass-dock → Noor pipeline)

Auditor: Agent-5 (supervisor/auditor). Everything below was re-verified first-hand
(diffs, full file reads, gates re-run) — no agent report was trusted without a check.

## Verdict: **SHIP** (1 real bug found and fixed; commit `3607904` in Noor)

Gates after the fix: `flutter analyze --no-pub` → **No issues found!**;
`flutter test` → **71/71 passed** (70 baseline + 1 auditor regression test).

## Checks table

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Artifact trail complete (tsx, REFERENCE.md, REVIEW.md, DART_PORT×4) | PASS | All 7 files present in `agent-ctx/bottom-nav-web/` |
| 2 | tsx copy still byte-faithful to live web source | PASS | `diff -q` empty; md5 `381efcc9c25a6637a844e646e371c100` both sides, 480 lines |
| 3 | DART_PORT → Noor verbatim (dock_tab.dart, glass_dock.dart) | PASS | `diff -q` empty for both vs `lib/features/shell/` (glass_dock.dart diverged only by the auditor fix below) |
| 4a | Single-pill invariant + geometry survived integration | PASS | ONE `PositionedDirectional` pill; `Matrix4..translateByDouble(_frac*slotW*_dirSign)..scaleByDouble(scale)` with `alignment: center` — grow lives in the SAME transform (matrix test asserts tx=172 @ slot 2, 1.08 mid-scrub) |
| 4b | RTL: explicit per-direction arrays, no double-flip, dirSign applied | PASS | `kNoorDockOrderLtr/Rtl` applied at list-build; pill anchored `PositionedDirectional(start:0)`; `_dirSign = rtl ? -1 : 1`; `_inlinePos` flips vs track width; RTL widget test (Settings leftmost, tap works) |
| 4c | Tab set Settings\|Library\|Kids\|Anime\|Home; real hide-anime; real Library nav | PASS | `noorDockTabsFor` reads the REAL `(webSettings['hideContent'] as Map?)['anime']` (same key the settings UI writes); Library = IndexedStack index 3 (real `LibraryPage`); `noorDockTabIdForIndex/ForTabId` round-trip tested; Settings' `onOpenLibrary → _selectTab(3)` consistent |
| 4d | Mount <840 only; hidden on player/detail; auto-hide; clearance on all pages | PASS | `tabletLayout = width >= 840` gates the mount; player/detail are pushed routes → dock unmounts (web `showChrome` rule); `_chromeVisible` shell hysteresis feeds `GlassDock.hidden`; `glassDockContentClearance` used at home×2 (incl. `_featuredHeroHeight`), kids, library, anime, settings |
| 4e | No regressions | PASS | `GlassNavigationBar` deleted (zero references; only an explanatory comment); `GlassSearchButton` kept + still used; magnet/Trakt/AniList/MAL files untouched by af0c8ed; tablet legacy clearance `76+safe` preserved at ≥840 |
| 4f | Version bump + commit quality | PASS | pubspec `1.2.13+16`; af0c8ed subject + 7-bullet body in repo style |
| 5 | Web-side integrity | PASS | `git -C /home/z/my-project status` → only `M worklog.md` (append-only pipeline log, +75/−0) + untracked `agent-ctx/`; zero source files touched |
| 6 | Behavior spot-checks (tap purity, one-nav release, cancel, flick, fallback, first paint, landscape, reduced-motion, semantics) | PASS | Verified by reading the integrated code + widget tests: tap = exactly one `onTabSelected`; release = one nav iff id≠active; cancel = snap-back, no nav; flick `sign(v)·dirSign` clamped (≤120ms samples, ≥2, 0.5px/ms); missing-active → slot 0, nothing selected, no crash; `_measured` seeds before first paint; landscape ≤480 last-wins (48/38/20, min(0.7w,340)); `disableAnimationsOf` zeroes every duration; `Semantics(selected:)` follows real active even mid-scrub |
| 7 | Gates (re-run by auditor) | PASS | analyze → "No issues found!"; test → 70/70 pre-fix, **71/71 post-fix** |

## Bug found & fixed (commit `3607904`)

**Stuck press state after scrub.** `_pressedIndex` (0.96 press scale + white 0.1
state layer) was cleared only on the plain-tap paths — every scrub release,
scrub cancel, and mid-scrub tab-set change left the initially pressed slot
permanently looking pressed until the next tap. The web clears `:active` on
pointer-up unconditionally (and pointer capture moves it off the button once
scrub starts). Fix: clear `_pressedIndex` on scrub entry (`_enterScrub`),
release (`_commitScrub`), cancel (`_onPointerCancel` scrub path) and the
`didUpdateWidget` mid-scrub abort. Regression test added to `test/dock_test.dart`
and proven to FAIL on the pre-fix build (verified via `git stash`).

Note: `agent-ctx/.../DART_PORT/glass_dock.dart` intentionally remains the
pre-fix translator draft (artifact-trail integrity); **Noor's
`lib/features/shell/glass_dock.dart` is the canonical fixed version**.

## Judgment calls (documented, NOT changed)

1. **Auto-hide hysteresis**: the exact web hysteresis (`y>120 && dy>±4`) ships
   inside `GlassDockScrollHide` (in the integrated file, tested) but the host
   wires Noor's pre-existing shell-level hysteresis (+10/−8 cumulative, reveal
   at top) to `GlassDock.hidden` instead. INTEGRATION_NOTES §4 explicitly offers
   both wirings; observable contract (hide on down-scroll, reveal on
   up-scroll/top, `dockAutoHide` opt-out) holds, and the shared flag also drives
   the search button — changing thresholds would alter pre-existing Noor chrome
   behavior beyond this task's scope. Kept; feel difference is minor.
2. **kidsMode filter / kidsZoom not wired**: `webSettings['kidsMode']` is a
   dormant web-sync flag with zero mobile behavior in Noor — intentional,
   documented in code + commit. The port's fallback for a missing active tab is
   exercised by tests regardless.
3. **Tap resolved at pointer-up slot** (floor(pos/slotW)) vs web click target:
   equivalent for real taps; the ≤6px micro-drag release landing on the up-slot
   is a negligible, arguably better, superset.

## Residual risks for the operator

1. **Not verified on real devices** — no Android/iOS device or emulator in the
   sandbox: haptics, backdrop-blur performance on low-end GPUs, and real
   touch-scrub feel (vs widget-test gestures) need a manual pass on hardware.
2. **Auto-hide thresholds** differ from web (Noor hides after ~10px of
   down-scroll vs web's 120px gate) — if the dock feels twitchy vs the web, swap
   `_onScroll` for the shipped `GlassDockScrollHide` mixin (one-file change).
3. **kidsMode is dormant**: if Noor ever activates kids mode on mobile, wire
   `dockTabsFor(kidsMode:…)` + `kidsZoom: 1.08` per INTEGRATION_NOTES — until
   then the dock shows all tabs in kids mode.
4. **`agent-ctx/` is untracked** on the web repo — commit it (or archive it)
   if the audit trail must survive the sandbox.
5. **Push pending**: Noor is 5 commits ahead of origin (Task 106 ×3 + af0c8ed +
   3607904) — push after operator review, per the pipeline's no-push instruction.
