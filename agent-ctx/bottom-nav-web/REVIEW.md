# REVIEW — Harbor WEB "Glass Dock" bottom nav (Agent-2 inspection, Task 107-b)

Audience: Agent-3 (Flutter translator) and Agent-4 (integrator). Inputs audited:
`agent-ctx/bottom-nav-web/glass-dock.tsx` (Agent-1 copy), `agent-ctx/bottom-nav-web/REFERENCE.md`,
against the live originals `src/components/harbor/chrome/glass-dock.tsx`,
`src/components/harbor/chrome/nav-items.tsx`, `src/lib/harbor/store.ts`,
`src/lib/harbor/settings.ts`, `src/components/harbor/chrome/app-shell.tsx`,
`src/components/harbor/views/settings-view.tsx`, and `src/app/globals.css`
(dock block 1890–2206, glass tokens 1313–1456, `.md-state` 314–350,
`.harbor-tv-focus` 1126–1142, ≥1024 band 3320–3353).

---

## 1. Fidelity

**Copy: BYTE-FAITHFUL.**
- `diff -q` → no differences; md5 of copy = md5 of original = `381efcc9c25a6637a844e646e371c100`; 480 lines each. No source files were modified during this audit.

**REFERENCE.md vs actual code — verified accurate on every load-bearing claim:**

| Claim | Verdict | Evidence |
|---|---|---|
| Tabs `settings/kids/anime/home`, EN+AR labels, lucide `Settings/Baby/Sparkles/House` | ✅ | nav-items.tsx 89–94 |
| `DOCK_ORDER` ltr `[settings,kids,anime,home]`, rtl `[home,anime,kids,settings]` → on-screen always Settings\|Kids\|Anime\|Home, Home far-right | ✅ | nav-items.tsx 96–107 (flex row under `dir` — no auto-reversal, explicit arrays) |
| `dockTabsFor`: hide-anime removes Anime; Kids Mode → only home+kids, relative order kept | ✅ | nav-items.tsx 118–133 |
| `dockDirectionFor` = `/^ar(-|_|$)/i` → rtl; `dockTabLabel` same regex | ✅ | nav-items.tsx 110–112, 270–272 |
| `tabIdForView`: anime/kids/home → self; EVERYTHING else (incl. settings, wrapped) → settings | ✅ | glass-dock.tsx 49–61; `View` enum (store.ts 19–32) confirms the full hub list |
| `activeTabId`: walk stack top-down, first `kind==="view"` frame, fallback "home" | ✅ | glass-dock.tsx 63–71 |
| Scrub thresholds 250ms hold / 6px move / 1.08× grow (150ms ease) / 0.5 px-ms flick | ✅ | glass-dock.tsx 87–91 (`SCRUB_*`, `FLICK_PX_MS`); grow baked into transform (229–245) |
| Flick velocity from last ≤120ms samples; `sign(v) × dirSign`; commit exactly one nav on `Math.round(frac)` | ✅ | glass-dock.tsx 349–362 |
| pointercancel / lostpointercapture → snap back, no nav | ✅ | glass-dock.tsx 380–400 |
| Auto-hide: `y>120 && dy>+4` hide; `dy<-4 \|\| y<=120` reveal; passive window scroll; `dockAutoHide` default **true** | ✅ | glass-dock.tsx 178–194; settings.ts 233, 277 |
| Pill: ONE element, DOM-owned via `writePill`, fractional index `clamp(pos/slotW−0.5, 0, count−1)`, `translate3d(frac*slotW*dirSign) scale(s)`, `inset-inline-start:0`, dev assert exactly 1 | ✅ | glass-dock.tsx 128–172, 219–227; CSS 2091–2117 |
| 350ms `cubic-bezier(0.2,0,0,1)` transform/width + 200ms opacity; transitions OFF while scrubbing | ✅ | CSS 2099–2117; `--glass-ease` 1352 |
| Icon cross-fade 150ms outline→filled (same icon twice, absolutely stacked) | ✅ | glass-dock.tsx 473–476; CSS 2171–2197 |
| Press scale 0.96; hit extender `::before inset:-4px 0`; tap-highlight transparent | ✅ | CSS 2147–2157 |
| Sizes: base phone 60/44/22, width `min(100vw−32, 330px)`, bottom 16, padding 8; ladder <360 / 600–839 / 840–1199 / 1200–1599 / ≥1600 / landscape `max-height:480` LAST-WINS | ✅ | CSS 1899–2002 |
| `--nav-max: 100vw−16`; width `min(--nav-width, --nav-max, 100%−safeL−safeR, 100vw−safeL−safeR)` | ✅ | CSS 1911, 2034–2039 |
| `--nav-zoom ≤1.1` × `--nav-kids 1.08` multipliers; `--nav-clearance = height+offset+safe-bottom+16` | ✅ | CSS 1902–1923; ≥1024 → `--nav-clearance:32px` (3341) |
| Fixed bottom `bottom+offset+env(safe-area-inset-bottom)`, centered, `z-index:40` | ✅ | CSS 2021–2026 |
| Glass: tint 191 230 242, panel-fill rgba(16,24,28,.62), active-fill rgba(255,255,255,.16), border .35, blur 14px (12px <600px) saturate 1.35, **no drop shadow**, inset specular top + bottom core line, opaque fallback, light + kids variants | ✅ | CSS 1313–1422, 2045–2064, 1379–1384 |
| Scrub suppression: real active tab's visuals suppressed unless `[data-lit]`; aria-current kept | ✅ | CSS 2118–2129 |
| `.md-state` currentColor layer (hover .08 hover-only, focus/active .1, disabled 0) | ✅ | CSS 314–350 |
| Reduced motion → all dock transitions off | ✅ | CSS 2199–2206 |
| Mounted `app-shell.tsx` line ~467 `{showChrome && <GlassDock/>}`; `showChrome = !playerActive && !immersiveDetail`; ≥1024 `.glass-dock{display:none}` + side rail; `main` gets `pb-[var(--nav-clearance)]` | ✅ | app-shell.tsx 220–234, 467–484; CSS 3320–3353 |
| `resetTo` clears stack to ONE frame (no back accumulation) | ✅ | store.ts 158 |
| `activeTabId` shared with side-rail | ✅ | side-rail.tsx 60, 102 |

**Doc nits (cosmetic, none affect translation):**
1. Line counts: nav-items.tsx is 272 (REF says 273), store.ts 330 (REF says 331), app-shell.tsx 671 (REF says ~530 — but its mount-line claim "~467" is exact).
2. REFERENCE repeats the CSS comment "50px target from 42px visual" — with current tokens the math is 40px tab (small phone) + 8px = 48px, base 44+8 = 52px. The ≥48px-touch-target **intent** holds.
3. CSS comment at globals.css:2170 says "26px box" (stale) — actual `--nav-icon-size` is 22px base; REFERENCE correctly says 22px.
4. Tab transition is `color 150ms ease, transform 150ms var(--glass-ease)` — REFERENCE says "150ms ease" for both (trivial).
5. Actual code is `aria-hidden={hidden || undefined}`; REFERENCE §2 shows `aria-hidden={hidden}` (same effect).

---

## 2. Behavior inventory — MUST PORT / ADAPT / DROP

| # | Web behavior | Class | Flutter mapping / note |
|---|---|---|---|
| 1 | Tap tab → `resetTo({kind:"view",view})` (root nav replacement) | **MUST PORT** | Tab tap = replace route stack to root |
| 2 | Scrub entry: ≥250ms hold OR >6px move while pressed (any direction) | **MUST PORT** | Timer(250ms) on pointer-down + movement threshold; see Risk 3 (pan vs horizontal) |
| 3 | Pill follows pointer as fractional index, clamped 0..count−1, transitions off | **MUST PORT** | One state value `double frac`; `AnimatedPositioned` paused during scrub (drive raw `Positioned`) |
| 4 | Grow 1.08× baked into the SAME transform, 150ms ease-out quad (`1−(1−k)²`) | **MUST PORT** | Compose `Transform(transform: Matrix4.translation…×scale)` — never a separate scale layer |
| 5 | Live preview `data-lit` on nearest tab; real active's visuals suppressed; aria-current kept | **MUST PORT** | One highlight: preview lit state during scrub; `Semantics(selected:)` follows real active |
| 6 | Release commits exactly ONE nav to `Math.round(frac)`; pill snaps 350ms | **MUST PORT** | `CurvedAnimation(Cubic(0.2,0,0,1), 350ms)` |
| 7 | Flick: >0.5 px/ms velocity from ≤120ms samples → +1 tab in inline direction | **MUST PORT** | `DragEndDetails.velocity.pixelsPerSecond.dx/1000`; sign × dirSign; threshold 500 px/s |
| 8 | Haptic `navigator.vibrate(10)` on scrub start | **MUST PORT** | `HapticFeedback.selectionClick()` (or `lightImpact`); scrub-start only |
| 9 | RTL: `DOCK_ORDER.rtl` array + `dirSign=−1` + `inset-inline-start` anchor | **MUST PORT** | `Directionality.of(context)`; explicit per-locale order lists — keep them |
| 10 | Active-tab stack walk ("Settings stays lit" on hub pages) | **MUST PORT** | Walk Noor's nav stack to nearest "view" route; same mapping |
| 11 | Tab filtering: kidsMode → home+kids; hideContent.anime → drop anime | **MUST PORT** | Same pure function; recompose tab list from settings |
| 12 | `dockAutoHide` setting gates auto-hide | **MUST PORT** | Settings flag |
| 13 | ≥1024px dock hidden / side rail shown; `--nav-clearance` body padding; hide on player/detail | **MUST PORT** | LayoutBuilder breakpoint; scaffold bottom padding; route-based visibility |
| 14 | Safe-area: bottom in offset, left/right in width cap | **MUST PORT** | `MediaQuery.paddingOf` (bottom/left/right) |
| 15 | Window-class size ladder × zoom ≤1.1 × kids 1.08; landscape last-wins; `min()` width chain | **MUST PORT** | Size-config function of `MediaQuery.size`; see Risk 8 |
| 16 | Icon cross-fade 150ms outline↔filled (two stacked copies of same icon) | **MUST PORT** | `Stack` + `AnimatedOpacity` 150ms; needs outline+filled asset pairs |
| 17 | Press scale 0.96 + state layer on press | **ADAPT** | `AnimatedScale` on tap down/up; optional overlay color instead of `.md-state` |
| 18 | pointercancel / lostpointercapture → cancel, no nav | **ADAPT** | Flutter gesture arena: recognizer rejection = `onPanCancel`/`onCancel`; capture is implicit once a drag is won |
| 19 | `touch-action:none` on capsule | **ADAPT** | Dock is not inside a scrollable; gesture arena plays `touch-action:none`'s role |
| 20 | Multi-pointer guard (second pointer ignored, moves filtered by pointerId) | **ADAPT** | Default single-pointer tracking of one recognizer is equivalent |
| 21 | Auto-hide on `window.scroll` (passive) | **ADAPT** | ⚠ Web listens to GLOBAL scroll; Flutter has none — attach to the active page's primary `ScrollController` / `NotificationListener<ScrollNotification>`; keep ±4 hysteresis + y≤120 reveal |
| 22 | Hidden state: slide below + opacity 0 + `visibility:hidden` + `pointer-events:none` (+ aria-hidden) | **ADAPT** | `AnimatedSlide`+`AnimatedOpacity`+`IgnorePointer`+`ExcludeSemantics` |
| 23 | Re-measure on tab set/order change (`tabSig`), active change, resize/orientation | **ADAPT** | Derive pill from state in `build`; `LayoutBuilder`/`MediaQuery` replaces RO + resize + orientationchange |
| 24 | Keyboard roving (←/→/Home/End, wraps, direction-aware, activates) | **DROP** (touch) / **ADAPT** only if Android-TV/keyboard supported | `FocusTraversalGroup` + `onKeyEvent`; do not build for v1 mobile |
| 25 | `.harbor-tv-focus` 3px accent focus ring; TV-mode `data-tv` rings | **DROP** (mobile) / **ADAPT** (`FocusableActionDetector` + custom ring) for TV |
| 26 | `role=tablist/tab`, `aria-selected/current`, `sr-only` label, `<nav>` landmark, native `title` tooltip | **ADAPT** | `Semantics(button, selected, label)` per tab; pill `ExcludeSemantics`; drop `title` |
| 27 | `md-state:hover` 0.08 layer | **DROP** (mobile) / **ADAPT** `MouseRegion` only if desktop Flutter |
| 28 | ResizeObserver + `resize` + `orientationchange` listeners | **DROP** | LayoutBuilder/MediaQuery rebuild covers all three |
| 29 | `data-ready` opacity gating (no first-paint flash) + single-pill dev assert | **DROP** | Flutter layout is synchronous — first frame is correct; widget tree cannot duplicate the pill |
| 30 | Pointer capture (`setPointerCapture` / lost-capture safety net) | **DROP** | Arena semantics make it moot; keep the *cancel path* (row 18) |
| 31 | Imperative DOM write choreography (`writePill`/`measure`, stale-`measure()` after release, rAF loop, will-change) | **DROP** | Replace with state-driven pill; see Risks 1/6 rationale — this is web-plumbing, not behavior |
| 32 | `backdrop-filter blur(14) saturate(1.35)` | **ADAPT** | `BackdropFilter(ImageFilter.blur(14,14))`; saturate needs a `ColorFiltered` saturation matrix or is dropped; NO drop shadow |
| 33 | `prefers-reduced-motion` kill | **ADAPT** | `MediaQuery.disableAnimationsOf` → durations 0 |
| 34 | `prefers-contrast:more` / `forced-colors` glass guards | **DROP** | No Flutter equivalent needed; validate contrast manually |

**Why NOT `NavigationBar` / `TabBar`:** Material 3 `NavigationBar` draws a *separate* indicator per destination (per-item pill behind the icon) and animates per-item shape/size — it cannot render ONE shared pill sliding across slots, cannot follow a finger as a fractional index, and has no notion of scrub or flick (+1 tab). `TabBar` is app-bar-oriented, bound to a `TabController`/page semantics, and again animates a per-tab indicator. The dock's defining behavior — a single stadium indicator whose position is a continuous `double` 0..count−1 shared by idle animation and drag scrub — requires a custom `Stack` (indicator behind tabs) + `AnimatedPositioned`/`Transform`. Material defaults would actively fight this design; use Material *tokens* (colors, durations) not Material *widgets*.

---

## 3. Edge cases & invariants (with code receipts)

1. **Single-indicator invariant.** One `.dock-pill` (glass-dock 449; CSS 2091; dev assert 168–172). During scrub the *nearest* tab lights (`data-lit`, 246–253) while the real active tab's active visuals are CSS-suppressed (2121–2129) — so exactly one indicator, and `aria-current` is never moved (screen-reader truth). In Flutter: one widget; preview state ≠ active state; suppression is automatic if the highlight is the pill.
2. **Fractional-index math.** `frac = clamp(pos/slotW − 0.5, 0, count−1)` with `pos` inline-relative (`rect.right − clientX` in RTL) — pill CENTER tracks pointer; clamp bounds keep the center in `[slotW/2, W−slotW/2]` so the pill never leaves the capsule (the 1.08 grow overhangs ≤4% of a slot into the capsule's 8px padding — by design, not clipping). Translate = `frac·slotW·dirSign`, anchor = logical inline-start. Never mix physical left with logical anchor — that exact mixing was the old overshoot bug (comments at 76–80, CSS 2109–2114).
3. **Active-tab-not-in-tabs edge (REACHABLE).** Enabling Kids Mode from the Settings page does NOT navigate away (settings-view.tsx 804–818) → tabs become `[home,kids]`, `activeId="settings"` → `findIndex = −1` → `Math.max(0,−1) = 0` → pill snaps to slot 0 and NO tab carries `aria-current`. Same for hide-anime while browsing anime. Mirror this graceful fallback (pill → slot 0) or improve it (hide pill); it must not crash or NaN.
4. **Tap purity.** Pointer capture engages only when scrub starts (262–294); a plain tap (<250ms, <6px) is released untouched so the button's click fires (340–348). Flutter: make sure tap wins over the scrub recognizers for quick taps (gesture arena ordering), and that a won scrub does not ALSO fire onTap.
5. **Flick sampling.** Samples capped at 6 (336), filtered to last 120ms at release (355), need ≥2 samples; velocity from oldest→newest in window; pointerup itself is not sampled (final move may lag → slight under-count; Flutter's `DragEndDetails` is strictly better here). `sign(v)·dirSign` converts physical direction to inline direction (355–361); result clamped — never wraps past the ends.
6. **Stale-`measure()` after release (web-only hazard).** `onTrackPointerUp` does `writePill(target)` → `resetTo()` → `measure()` — but `measure()` reads the render-closure `activeId`, i.e. the OLD tab, writing the pill to the OLD position; correctness relies on the synchronous React re-render + layout-effect landing before paint. Do NOT port this choreography; drive the pill from state.
7. **Hold timer lifecycle.** Timer killed on move-scrub entry (325–329), on pointerup/cancel, and on unmount (215). `pointercancel` before scrub entry only kills the timer — no state flips, no `setScrubbing`.
8. **Min-tab guard.** `enterScrub` bails if <2 tab buttons (269) — defensive; filters guarantee ≥2 (kids mode = home+kids).
9. **Hidden-dock a11y.** `data-hidden` → slide+fade + `visibility:hidden` (removes from a11y tree AND tab order, 2066–2074) + `aria-hidden` + pointer-events none; `visibility` is added to transition-property so it flips only after the slide-out. Note: while hidden the dock still runs its scroll listener (harmless) and the auto-hide state survives tab switches.
10. **Auto-hide scope.** Listener reads `window.scrollY` only — nested/secondary scroll containers on a page will NOT trigger hide/reveal. The Flutter port must decide which controller is "the" page scroll per route.
11. **Stack fallback.** `activeTabId` returns "home" only when the stack contains no view frame — unreachable in practice (store seeds `[{kind:"view",view:"home"}]`).
12. **Re-measure signature.** `tabSig = tabs.map(id).join("|")` re-seats the pill on language switch / kids toggle / hide-anime; `measure` also fires on active change and on ResizeObserver/resize/orientation (147–165).
13. **Language guard.** `settings.uiLanguage || "en"` (114); RTL determined by `dockDirectionFor`, keyboard nav independently re-checks `document.documentElement.dir` (412) — consistent because app-shell owns `dir`.
14. **Z-order.** `--z-nav: 40` sits below banner(50)/search(85)/picker(150)/player(180) — the dock never covers pickers/player; in player/detail it is *unmounted* (showChrome), not hidden.
15. **Landscape override.** `max-height:480` block is source-order LAST and wins over any width class (e.g. 915×412 → 48px bar). Easy to miss in Flutter.
16. **Reduced motion** kills ALL dock transitions including the hide/reveal slide (2199–2206) — instant state flips.

---

## 4. Flutter mapping table (behavior → primitive)

| Web mechanism | Flutter primitive | Note |
|---|---|---|
| `.glass-dock` fixed capsule | `Align(bottomCenter)` inside shell `Stack` + `Container`/`ClipRRect(StadiumBorder)` | radius = height/2; 1px tint border; inset top highlight via inner gradient |
| `backdrop-filter blur+saturate` | `BackdropFilter(ImageFilter.blur(14,14))` (+ optional `ColorFiltered` saturation matrix) | no `saturate` in ImageFilter; wrap region small; `RepaintBoundary` |
| `.dock-pill` (single, absolute) | ONE `AnimatedPositioned`/`Positioned` inside a `Stack` **behind** the tab row | width = slot; stadium; `ExcludeSemantics` |
| `translate3d(frac·slotW·dirSign) scale(s)` | `Transform.translate` + `Matrix4.scale` composed in ONE transform | grow 1.08 baked in; never a wrapper `ScaleTransition` |
| 350ms cubic-bezier(0.2,0,0,1) | `AnimationController(350ms)` + `CurvedAnimation(Cubic(0.2,0,0,1))` | reuse controller for hide-slide? No — separate |
| scrub (pointer events, capture, rAF) | custom recognizer: `Listener`/`RawGestureDetector` + 250ms `Timer` + move-threshold; per-frame setState | clamp `frac`; lit-tab from `round(frac)` |
| flick velocity | `DragEndDetails.velocity.pixelsPerSecond.dx / 1000` vs **500 px/s** | +1 inline tab, clamped |
| haptic vibrate(10) | `HapticFeedback.selectionClick()` | scrub-start only |
| RTL dirSign | `Directionality.of(context) == TextDirection.rtl ? -1 : 1` | + explicit per-locale order arrays (no auto-reverse) |
| active-tab stack walk | walk Noor's nav stack to nearest "view" route; map everything-else→settings | same pure function |
| tab filtering | pure function of (kidsMode, hideAnime, locale) | recompose list; handle missing active (slot 0 fallback) |
| `window.scroll` auto-hide | `NotificationListener<ScrollNotification>` or page `ScrollController` | ±4 hysteresis; y>120; per-route binding |
| hide/reveal | `AnimatedSlide`+`AnimatedOpacity`+`IgnorePointer`+`ExcludeSemantics` | 350ms/250ms, same ease |
| ResizeObserver/resize/orientation | `LayoutBuilder` + `MediaQuery` rebuilds | drop listeners |
| safe-area | `MediaQuery.paddingOf(context)` (bottom/left/right) | bottom→offset; L/R→width cap; clearance padding on body |
| ≥1024 swap | `LayoutBuilder` breakpoint → side-rail | dock unmounts in player/detail routes |
| icon cross-fade | `Stack` of outline+filled assets + `AnimatedOpacity(150ms)` | needs filled variants of Settings/Baby/Sparkles/House |
| aria/sr-only | `Semantics(button:, selected:, label:)`; nav-level `Semantics(label:"Primary navigation")` | pill excluded from semantics |
| reduced motion | `MediaQuery.disableAnimationsOf` → zero durations | applies to ALL dock motion |
| press scale + state layer | `AnimatedScale(0.96)` on tap down/up + overlay color | replaces `.md-state`/`:active` |

---

## 5. Top risks / pitfalls for the Flutter translation (ranked)

1. **Don't reach for `NavigationBar`/`TabBar`.** Per-section indicators, per-item animation, no shared sliding pill, no fractional scrub — Material3 defaults fight the design. Build custom: `Stack` + one `AnimatedPositioned` pill behind tabs.
2. **Keep the pill's transform atomic.** Translation and grow scale must live in ONE transform (web's overshoot bug was a standalone `scale` composing around the untranslated origin). In Flutter a wrapper `ScaleTransition` around a translated pill reproduces that bug.
3. **Gesture arena vs scrub entry.** Web enters scrub on a 6px move in ANY direction; a horizontal-only recognizer loses vertical drags to other handlers and changes feel. Either use a pan recognizer (matches web; dock isn't in a scrollable) or consciously accept horizontal-only. Critically: quick taps must still reach `onTap` (tap purity, invariant 4) and cancel must snap back with no navigation.
4. **Flick velocity recalibration.** Web: px/ms from ≤120ms samples; Flutter: px/s from framework estimate. Map 0.5 px/ms → 500 px/s and verify the +1-tab feel; keep `sign(v)·dirSign` and clamping (no wraparound).
5. **Hidden-active-tab edge.** Kids-mode toggled ON the Settings page (or hide-anime while on Anime) → active tab missing → pill to slot 0, nothing `selected`. Mirror or improve; must handle `findIndex == −1`.
6. **Auto-hide has no `window`.** Bind to each page's primary scroll (per-route `ScrollController`/`NotificationListener`), handle route swaps, keep hysteresis (±4, y≤120) and don't fight the 350ms slide; respect `dockAutoHide`.
7. **RTL order + dirSign.** Preserve the explicit `DOCK_ORDER` arrays (no `Directionality`-based auto-reversal on top of them — that would double-flip), anchor the pill on the logical start, translate by `frac·slotW·dirSign`.
8. **Size-ladder completeness.** 6 window classes × `zoom≤1.1` × `kids 1.08`, landscape `height≤480` LAST-WINS, width `min(--nav-width, viewport−16, −safeL−R)`, `--nav-clearance` body padding, dock hidden ≥1024 and unmounted in player/detail. Missing the landscape override or clearance is the most likely integration bug.
9. *(bonus)* **Icon assets.** The 150ms cross-fade needs outline AND filled variants of the same four glyphs; Material Icons won't cover all (Baby/Sparkles analogues differ) — plan custom SVG/icon pairs.

## 6. Verdict

- **Copy:** byte-faithful; safe to translate from `agent-ctx/bottom-nav-web/glass-dock.tsx` + `REFERENCE.md`.
- **REFERENCE.md:** accurate; cosmetic nits only (3 line counts, 2 stale-comment repetitions).
- **Web bugs NOT to port:** (a) the imperative pill-write choreography + stale-`measure()` after release — replace with a state-driven pill; (b) the dev-only single-pill console assert — meaningless in Flutter; (c) pointer-capture/lost-capture plumbing — arena handles it (keep the cancel path). No behavioral defect found in the gesture math itself; scrub, flick, clamp, and RTL math are correct as written.
- **Behavior gaps (REFERENCE vs code):** none material. One REACHABLE quirk worth a product decision: hidden-active-tab fallback (pill → slot 0, no selection) when kids-mode/hide-anime hides the current tab; and global-scroll auto-hide won't observe nested scroll containers (both documented above).
- **Green light for Agent-3** with the risk list above; recommended build order: layout+tokens → static pill (state-driven) → tap nav → RTL → auto-hide → scrub+flick → size ladder + kids/zoom → semantics/haptics.
