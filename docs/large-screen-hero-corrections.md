# HORSE — Large-Screen Home Corrections (Round 26)

Correction pass over the round-25 large-screen layout: the side navigation, the
hero carousel, the floating search bar, and the Up-next strip. Scope guards:

- **Phone (<600) and tablet (600–1023) are design-frozen.** Every changed CSS
  rule is either value-identical below 1024 or scoped to `@media (min-width:
  1024px)`/`(min-width: 1600px)`. The single deliberate exception is the hero
  prev/next arrow removal (A2 mandates deleting the component at all sizes;
  touch tablets never saw the arrows — they were `(hover:hover) and
  (pointer:fine)` only). Bidi corrections (B1) also apply below 1024 by design
  — they change punctuation sides, not layout.
- The glass design language, tokens, folder structure, business logic, data,
  and APIs are unchanged.

---

## Root causes and fixes (evidence-first)

### A1 — Side nav must hide and reveal on intent (no menu that opens)

**Root cause.** Round 25 shipped the rail as an always-visible capsule with a
persisted `railExpanded` toggle (a `«`/`»` chevron button inside the capsule)
and an "always expanded on TV" band. Measured: `.rail-toggle` present at
1515px; `settings.railExpanded` widened the capsule to 240px and re-derived
**every** content inset from it (`--rail-inset` → `--hero-col-inset` →
`--fs-anchor-start`), which is also what caused B2/B3/B4 drift.

**Fix.**
- `side-rail.tsx` rewritten: ONE compact form. The expand toggle, the expanded
  icon+label mode, and the `railExpanded` setting are deleted (settings key
  migrated: `railExpanded` is dropped on load; new optional
  `railAutoHide`, default **auto-hide**, with a tiny Settings → Basics
  segmented control "Navigation rail: Auto-hide / Always visible").
- Hidden by default at the inline-start edge: the capsule is translated
  `translateX(±(100% + 24px))` (mirrored for RTL) with opacity 0 and
  `pointer-events: none`; a 4×48dp glass **edge handle** (40% opacity,
  vertically centered) is the only visible affordance.
- **Reveal triggers:** pointer into a 24dp edge hot zone (rail span ± 80dp)
  with an ~80ms hover-intent delay; keyboard `focusin` on any rail item
  (items keep their tab order); touch/pen tap on the handle (plus tap-outside
  to dismiss); TV/D-pad reaches the items through focus.
- **Hide triggers:** ~700ms after the pointer leaves rail + hot zone; ~600ms
  after selecting a destination (click or scrub commit); immediately on Esc
  (which also releases rail focus). Never while a rail item has keyboard
  focus, while the indicator is scrubbed, or while a tooltip is shown.
- The hot zone is **not an element** — it is a document-level `pointermove`
  probe, so it cannot block page controls or the scrollbar.
- Labels are glass **tooltips** beside the hovered/focused icon (plus
  `aria-label`s). Motion: transform+opacity ~280ms glass easing; reduced
  motion = fade only (no translate).
- `--side-safe-inset` (rail width + 24dp) is the new CONSTANT layout inset
  used by `main.rail-main`, `.home-void`, `.home-below`, the hero content
  column and the Up-next strip — layout never shifts between rail states and
  the revealed rail never covers text or controls.

**Verified:** reveal/hide/Esc/focus/handle-tap/selection-hide battery all pass
(see Verification). Reduced-motion fade-only verified with emulated media.

### A2 — Remove the prev/next hero arrows

**Root cause.** Round 25 added `.home-hero-arrow` buttons vertically centered
at the hero edges; at 1515px the start arrow's 48dp box intersected the meta
line ("20.." cut in Image 1) and the end arrow overlapped the Up-next cards'
left edge.

**Fix.** Component, styles, `--hero-arrow-inset-start` token and the
`prevSlide`/`nextSlide` i18n strings deleted. Navigation remains: touch swipe,
mouse drag (grab/grabbing cursors added at ≥1024; a real drag now swallows the
single click that trails pointerup so releasing over a control never activates
it), **horizontal trackpad/wheel gesture (new** — native non-passive wheel
listener, horizontal intent only, one step per ~450ms gesture, natural
trackpad direction, shortest circular path), clickable progress segments,
clickable Up-next cards, and keyboard ←/→ (visual direction, RTL-mapped) +
Home/End on the focused hero. Carousel engine rules untouched.

**Verified:** keyboard step ±1, wheel step ±1 (one step per gesture), segment
clicks, Up-next clicks; no `.home-hero-arrow` nodes in the DOM at any width.

### A3 — Synopsis: exactly two lines

**Root cause.** `--hero-syn-lines` was 3 on laptop and 4 on TV (round-25 band
ladder).

**Fix.** `--hero-syn-lines: 2` at every large size (tablet already 2, frozen).
`-webkit-line-clamp: 2` renders the platform ellipsis at the logical end of
the visible text (side follows the element's `dir="auto"` — see B1). Missing
synopsis renders nothing (existing conditional); the row's gap tokens keep the
flow stable.

**Verified:** DOM-injected long synopsis through the real class = 2 rendered
lines, clamp 2, both LTR and RTL.

### A4 — Progress segments overlapped the "View details" button

**Root cause.** The large CTA had no bottom margin and `.home-hero-segs` had
no top margin — the rows touched (measured gap 0–3px at 1515px in both
locales; `gapBtnSegs: 0` in the pre-fix DOM probe).

**Fix.** One bottom-anchored flow [logo][meta][synopsis][actions][segments]
with token gaps at ≥1024: meta→synopsis `--hero-gap-meta: 12px`, synopsis→
actions `--hero-gap-syn: 20px` (synopsis margin fallback keeps the frozen
tablet value), actions→segments `--hero-gap-segs: 24px`; hero bottom padding
`--hero-pad-lg: clamp(28px, 4svh, 32px)`. Segments are 32×4dp with 6dp gaps
(frozen tablet keeps 4vw/6dp/10dp), ≥44dp hit targets (`::before` inset
-20px), inactive 35% white, active autoplay fill white. The segments row is
part of the flow (never absolutely positioned).

**Verified:** `gapBtnSegs = 24` at 1024/1180/1280/1366/1440/1920/2560, and
button/segment Y identical across all slides (see B4).

### B1 — Bidi/punctuation on the wrong side

**Root cause.** Dynamic English strings rendered inside the RTL document
without isolation: the synopsis, the title fallback, the meta parts, Up-next
titles, and the search placeholder (static English "Search…" → rendered
"...Search" in Arabic).

**Fix.** Per-element direction by content: `dir="auto"` on the synopsis, the
h1 title fallback, the Up-next titles, and all three search inputs (plus
localized `searchPlaceholder`/`searchAria` i18n — "ابحث…" in Arabic); the meta
parts (year/genre/type) are wrapped in `<bdi>`; block alignment stays on the
column's inline-start edge (flex start). Punctuation and clamp ellipses now
land at the logical end of the text for Arabic, English and mixed strings.

**Verified:** Arabic placeholder "…ابحث" renders with the ellipsis at the
logical end; meta order measured in RTL (year rightmost = first logically);
clamp ellipsis follows content direction.

### B2 — Expanded rail capsule drew as a big circle

**Root cause.** `border-radius: 9999px` on the expanded 240×288 capsule
renders an **ellipse**; the 52dp active-row stadium poked outside its curved
border (Image 2).

**Fix.** The expanded mode no longer exists (A1). The one capsule is 80px wide
(≈96×232 with padding) where the 9999px radius is the intended vertical
stadium, and `overflow: hidden` clips the pill/scrub-grow/lit preview to the
capsule shape so no rail state can overflow its container.

**Verified:** pill singleton maintained during scrub; grow scale clamped
inside (transform measured `scale(1.06)` with no overflow).

### B3 — Search bar geometry/contrast inconsistencies

**Root cause.** The wrapper was over-constrained: `start-[--fs-anchor-start]`
+ `end-3` + `mx-auto` + a width that changed on focus (`w-60` idle vs
`min(--fs-bar-max-w, …)` expanded). The anchor start moved with the rail inset
(262 vs 214dp and center x=707 vs 643 in the two screenshots), and the idle
bar sat at a different width/position than the expanded bar. The glass fill
(`rgba(255,255,255,0.07)`) gave the placeholder/icon no guaranteed contrast
over bright art (the "washed-out" look), and the `/` chip was 10px.

**Fix.** ONE fixed geometry per size class, owned by an unlayered `.fs-wrap`
block at ≥1024: `inset-inline: 0` + auto margins + `width: var(--fs-geo-w)`
(`min(--fs-bar-max-w, 100vw − 24px)`) → **centered in the viewport**,
identical idle/expanded, independent of rail/page/slide; top offset token
`--fs-geo-top`. The frozen 600–1023 band keeps its utility geometry (legacy
`--fs-anchor-start: 0px` retained for it). Contrast: the shell mixes the theme
canvas into the glass (`color-mix(in srgb, var(--color-canvas-var) 72%,
transparent)`) so the ink-on-glass pair stays ≥4.5:1 over ANY artwork in both
appearances; placeholder raised to 88% ink; `/` chip ≥20dp at 12px. The
popover stays anchored to the fixed wrapper and cannot widen the page.

**Verified:** idle width == expanded width (520) at every matrix width,
center offset 0 at all widths and both locales, rendered placeholder contrast
sampled from a real screenshot = 11.1:1 (worst-case math over a white backdrop
≈ 4.7:1), dropdown inside viewport, no horizontal overflow.

### B4 — Content column drift between slides/rail states

**Root cause.** `--hero-col-inset` derived from `--rail-inset`, which changed
with `railExpanded` (144 → 304px measured edge shift between the two states).
Vertical drift was the entrance animation being measured mid-flight plus the
unstable gaps of A4.

**Fix.** The column inset derives from the CONSTANT `--side-safe-inset`
(laptop `+40px`, TV `+56px`); the bottom-anchored stack with fixed gaps means
variable-height parts (logo/meta/synopsis) only grow upward.

**Verified:** button Y = 378.50 and segments Y = 460.00 **exactly** across
slides 1–3 with autoplay paused; padding-inline-start 144px (160px TV) at
every width and rail state.

### B5 — Title logo inconsistency

**Root cause.** One small token pair (`195px × 64px × scale`) governed every
logo: wide wordmarks and small round marks rendered at wildly different
visual weights, and nothing aligned a round mark to the column edge
optically.

**Fix.** Fixed logo box per band (laptop 320×110, TV 480×160; the row keeps
its fixed height and bottom alignment, start-anchored). The logo image is
classified at load (`naturalWidth/naturalHeight < 1.25 → data-shape="square"`)
and square/round logos get `min-height: 72px` plus a slight saturation lift
(optical balance); wide wordmarks fill the box height or cap at the box
width. Styled-text fallback unchanged.

**Verified:** logo scan across all 8 slides — heights 110 (box-anchored) or
width-capped 320; synthetic square source upscaled to exactly 72 inside the
110 box.

### B6 — Readability over bright art

**Root cause.** The directional scrim was static (`0.82 → 0.52 → 0`), too
weak behind the meta/synopsis over bright regions (light denim in Image 2,
shirt in Image 1); no text shadows on meta/title.

**Fix.** A new `.home-hero-scrim-adapt` layer whose opacity is
`--hero-adapt`, **measured per image**: when the active artwork loads, its
text zone (inline-start half, lower 70%) is sampled on a 64×36 canvas (art is
same-origin via `/api/img`), average luminance L is converted to an extra
scrim alpha `clamp((L − 0.24) × 1.9, 0, 0.75)` — white text needs backdrop
luminance ≲0.18 for 4.5:1 — and cached per artwork (`SCRIM_CACHE`). Dark art
adds 0 (unchanged rendering). Soft text shadows added to meta/title at ≥1024.
Gated to ≥1024 (frozen tablet); resets to 0 below the band so no stale value
leaks.

**Verified:** bright "Backrooms" slide measured `--hero-adapt: 0.419` and the
meta/synopsis zone became clearly readable; dark slides measure 0.000.

### B7 — Up-next strip defects

**Root cause.** Round-25 values: 11px label at 72% white, 11.5px titles,
52×74 thumbs (not 2:3), a fixed 2–4 card list that could exceed short heroes,
and no "next" affordance beyond a border tint.

**Fix.** Label 12px at 88% white (≥4.5:1 with the text-shadow); titles 13px
with the 2-line clamp and `dir="auto"` ellipsis; thumbs 52×78 (natural 2:3,
`object-position: center top`); cards 176dp (200 TV); card count **measured**
from the hero height (ResizeObserver → 3 below 620px, 4 above) and capped by
`max-height` so nothing is ever clipped; the first card carries the accent
border + a soft accent wash as the "next" indicator; the strip is absolutely
positioned inside the hero bounds with a fixed inset token
(`--hero-upnext-inset`) and cannot sit under the search bar (bottom-anchored,
search top-anchored).

**Verified:** 3 cards at 496px hero (800 viewport), 4 at taller heroes;
label/title computed sizes 12/13px; thumbs exactly 52×78.

### B8 — Hero height above the fold

**Root cause.** `--hero-height` was `clamp(520px, 76svh, 880px)` on laptop
(76–88% of the viewport): on a 632–800px-tall window only a row title peeked
below the hero.

**Fix.** Laptop `clamp(420px, 62svh, 680px)`, TV `clamp(460px, 66svh,
760px)`; smooth bottom fade unchanged. Frozen tablet ladder untouched.

**Verified:** 1024→420, 1180→434, 1280→446, **1366×768→476**, 1440→558,
1920→713, 2560→760; the "Top 10 Today" header plus the tops of its cards are
visible at 1366×768, 1440×900 and 1536×864 (screenshot `after-ltr-1366.png`).

### B9 — Small/low-contrast utility text

**Root cause.** The "trending on Stremio" footnote rendered at ~11px in
`text-ink-subtle` (contrast below 4.5:1).

**Fix.** ≥1024 only: `.top10-note` → 12px at 62% ink (≥4.5:1). The frozen
bands keep the original.

---

## C — General sweep results

Audited the large-screen Home and the pages reachable from the hero at
1024–2560, RTL + LTR:

- No bounding-box intersections among search / content column parts /
  segments / Up-next strip / rail / handle at any matrix width.
- No horizontal overflow anywhere (scrollWidth == clientWidth at all widths).
- No console errors from the touched surfaces (the only logged errors are the
  pre-existing sandbox ones: TMDB unconfigured → 501, and the DB-less
  `/api/sync` 500 — environmental, not UI).
- Below-fold rows (`Trending Movies`, `In Theaters`, …) inherit the constant
  `--side-safe-inset`; nothing moves when the rail reveals (handle overlay
  only, transient by design).
- Element that moves when the rail appears/hides: **none** (constant inset
  token; the rail overlays).

---

## Files changed

| File | Change |
| --- | --- |
| `src/components/harbor/chrome/side-rail.tsx` | Rewritten: auto-hide state machine, edge handle, pointer probe, tooltips; expanded mode + toggle removed; scrub preserved |
| `src/components/harbor/views/home-hero.tsx` | Arrows removed; wheel nav; grab cursors + click suppression; adaptive scrim sampler; logo shape classification; measured Up-next count; bidi (`dir="auto"`, `<bdi>`); `sectionRef` |
| `src/components/harbor/chrome/floating-search.tsx` | `.fs-wrap` class; width-animation removed; localized placeholder/aria + `dir="auto"` (3 surfaces); icon contrast |
| `src/components/harbor/chrome/app-shell.tsx` | Removed the `data-rail` root attribute hook |
| `src/components/harbor/views/settings-view.tsx` | "Navigation rail" mode setting (auto-hide / always visible) |
| `src/components/harbor/views/home-view.tsx` | `.top10-note` class (B9) |
| `src/lib/harbor/settings.ts` | `railExpanded` → `railAutoHide` (default true) + migration sanitize |
| `src/lib/harbor/i18n.ts` | `+railMode/railModeDesc/optRailAutoHide/optRailAlways/searchPlaceholder/searchAria`; `−prevSlide/nextSlide` |
| `src/app/globals.css` | Round-26 token block (`--side-safe-inset`, `--fs-geo-*`, hero gap/pad/logo/height bands), side-rail hide/handle/tooltip CSS, `.home-hero-scrim-adapt`, search shell contrast, segment/Up-next geometry, `.top10-note`; arrow/expanded/toggle CSS deleted |

Deleted: `.home-hero-arrow` styles + token, `.rail-toggle`/`.rail-label`/
expanded-rail styles, `html[data-rail="expanded"]` blocks, `--rail-inset`,
`--fs-anchor-start` band overrides, `prevSlide`/`nextSlide` strings.

## New/changed tokens

`--side-safe-inset` (new, the only layout inset), `--fs-geo-w`, `--fs-geo-top`,
`--hero-gap-syn`, `--hero-gap-segs`, `--hero-pad-lg` (≥1024 value),
`--hero-height` (≥1024/≥1600 values), `--hero-logo-max-w/-h` (≥1024/≥1600),
`--hero-gap-meta` (≥1024 = 12), `--hero-upnext-w` (176/200), 
`--hero-upnext-inset` (new), `--hero-syn-lines: 2` (all bands).
Removed: `--rail-inset`, `--hero-arrow-inset-start`, `--fs-anchor-start`
band overrides (base 0 kept for the frozen tablet utilities).

## Verification (measurements, agent-browser)

- **Matrix** widths 1024/1180/1280/1366/1440/1920/2560 (RTL Arabic + LTR):
  gap button↔segments = 24 everywhere; column inset constant (144/160);
  search exactly viewport-centered (offset 0) and width 520/720; hero heights
  per B8; horizontal overflow 0; hidden rail pointer-events none; capsules
  off-screen while hidden (x = −88 LTR / 1523 RTL).
- **Rail state machine:** hover-intent reveal (80ms) → reveal; leave → hidden
  after ~700ms; Esc immediate; focus reveal; handle tap toggle; selection
  (click + scrub commit) → hidden after ~600ms; tooltip blocks hide while
  shown and the state recovers (stale-timer bug found in QA and fixed);
  reduced-motion (emulated) = fade only, transform `none`.
- **Carousel:** keyboard ±1 with visual direction; wheel ±1 (one step per
  gesture); segment/Up-next jumps; drag still commit-on-release with click
  suppression; slide positions byte-stable (btn 378.50 / segs 460.00 across
  slides); autoplay pause rules untouched.
- **Synopsis:** 2 rendered lines + clamp 2 in LTR and RTL (injected long text
  through the real class; TMDB is unconfigured in this sandbox — see limits).
- **Contrast:** rendered search-bar surface sampled 11.1:1 (median = p90);
  adaptive scrim engaged 0.419 on the bright slide, 0.000 on dark ones;
  Up-next label/title 12/13px at ≥88% white.
- **Frozen bands:** DOM assertions at 360/412/768/820 — hero 64svh (phone) /
  72svh (tablet), dock present, rail `display:none`, 8 dots / 0 segments
  (phone), 0 dots / 8 segments (tablet), 48dp trigger, search 240px centered
  in `[0, vw−12]` at 768 (x=258), `--hero-adapt` = 0, no arrows/synopsis/
  up-next. Pixel screenshots exist for both sessions
  (`qa-shots/before-*.png` / `after-*.png`); pixel-diffing is confounded by
  translucent glass over different catalog artwork (Cinemeta rotated between
  sessions), so the structural DOM assertions above are the proof of record.

## Changelog (user-visible)

1. The side navigation is hidden at the edge; hover the edge / tap the handle
   / focus it to reveal; it hides itself again. The expand button and the
   wide labelled menu are gone. New Settings → Basics "Navigation rail"
   option (auto-hide / always visible).
2. Hero arrows removed — swipe, drag, trackpad, segments, Up-next cards and
   keyboard navigate the carousel.
3. Synopsis is exactly two lines with an ellipsis; punctuation/ellipsis sit on
   the correct side in Arabic and English.
4. The "View details" button and the progress segments keep a fixed 24dp gap;
   segments are 32×4dp with 44dp hit targets; button/segments never move
   between slides or rail states.
5. The hero is shorter (62svh) so the first row peeks above the fold on
   laptops; logos are optically balanced (wide wordmarks and round marks).
6. Bright artwork no longer washes out the hero text (per-image adaptive
   scrim) or the search bar (canvas-tinted glass); the "/" chip and micro
   labels are readable; Up-next cards are bigger-typed 2:3 posters.

## Not verifiable in this sandbox (honest)

- **Real TV/D-pad remote:** the reveal path via spatial focus was verified
  with programmatic focus only; real 10-foot hardware was not available.
- **Real touch devices:** handle tap was driven via click; a physical
  edge-swipe/tap difference (browser back-gesture reservation) needs a device.
- **TMDB-dependent hero data** (synopsis, textless logos) — TMDB is not
  configured in the dev sandbox (501); those paths were exercised with
  DOM-injected content through the real classes and verified in code. They
  run on production where the key exists.
- **Browser zoom 90–150%** and real 4K panels were not available; tokens are
  fluid by construction.
- **Hover arrows on tablets with a mouse** existed before and are removed
  **by A2 mandate** (the one deliberate frozen-band interaction change).
