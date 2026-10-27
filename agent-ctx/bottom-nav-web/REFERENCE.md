# Harbor WEB — Bottom Navigation Bar ("Glass Dock") — Flutter Translation Reference

Source repo: `/home/z/my-project` (Harbor Web — Next.js 16 App Router + TS + Tailwind 4).
Target: Flutter "Noor" app at `/home/z/Noor` (dark "Horse" theme).
This doc was written so the translator agent needs NOTHING else from the web repo.

---

## 1. File inventory (absolute paths + line counts)

| File | Lines | Role |
|---|---|---|
| `/home/z/my-project/src/components/harbor/chrome/glass-dock.tsx` | 480 | THE bottom nav bar component (`GlassDock`, `DockTabButton`, `tabIdForView`, `activeTabId`, scrub gesture). Verbatim copy at `agent-ctx/bottom-nav-web/glass-dock.tsx` |
| `/home/z/my-project/src/components/harbor/chrome/nav-items.tsx` | 273 | Tab config: `DOCK_TABS`, `DOCK_ORDER`, `dockTabsFor`, `dockDirectionFor`, `dockTabLabel`, `DockTab`, `DockTabId` (+ sidebar `NAV_ITEMS`/hub entries, not dock-critical) |
| `/home/z/my-project/src/lib/harbor/store.ts` | 331 | Zustand stores: `useNav` (stack/`resetTo`), `useSettings` |
| `/home/z/my-project/src/components/harbor/chrome/app-shell.tsx` | ~530 | Mounting context (`showChrome`, `--nav-clearance` main padding) |
| `/home/z/my-project/src/app/globals.css` | 5103 | All styling. Dock-specific block: lines 1890–2206 ("Floating glass dock") + shared `--glass-*` tokens (1313–1455) + `.md-state` (314–350) + `.harbor-tv-focus` (1126–1142) + ≥1024px hide rule (3320–3353) |

---

## 2. Component contract (what renders what)

```tsx
<nav className="glass-dock" data-hidden={hidden} aria-hidden={hidden} aria-label="Primary navigation">
  <div className="dock-track" role="tablist" aria-label="Primary"
       data-scrub={scrubbing}
       onPointerDown/Move/Up/Cancel + onLostPointerCapture + onKeyDown>
    <span className="dock-pill" aria-hidden />   {/* THE single sliding indicator */}
    {tabs.map(tab => <DockTabButton ... />)}
  </div>
</nav>
```

`DockTabButton`:
```tsx
<button type="button" data-tab={tab.id} role="tab" aria-selected={active}
        aria-current={active ? "page" : undefined} title={label}
        onClick={() => resetTo({ kind: "view", view: tab.view })}
        className="dock-tab md-state harbor-tv-focus">
  <span className="dock-icon-frame" aria-hidden>
    <Icon className="dock-icon-outline" strokeWidth={1.8} />
    <Icon className="dock-icon-filled" fill="currentColor" strokeWidth={1} />
  </span>
  <span className="sr-only">{label}</span>
</button>
```

Key architecture facts (must be preserved conceptually in Flutter):
- **Exactly ONE indicator pill** for the whole bar. React never styles it — every position/width/scale write is a direct DOM write (`writePill`), so re-renders can't ghost it. A dev-only check asserts exactly one `.dock-pill` exists.
- Pill position comes from ONE value: a **fractional tab index** (0..count-1), plus an optional grow scale. Transform = `translate3d(frac * slotW * dirSign, 0, 0) scale(s)`.
- `slotW = trackWidth / tabCount`, measured live each frame via `getBoundingClientRect()`.
- `dirSign` = +1 LTR, −1 RTL (inline-axis-safe math; pill anchored with `inset-inline-start: 0`).
- Icons cross-fade outline→filled (150ms): each tab renders the SAME lucide icon twice (outline + filled) stacked absolutely; active/lit toggles opacity.

## 3. Navigation items

Tab config (`DOCK_TABS`, order swapped per locale via `DOCK_ORDER` so the ON-SCREEN order is ALWAYS `Settings | Kids | Anime | Home`, Home at the far-right):

| id | view | labelEn | labelAr | lucide icon | click action |
|---|---|---|---|---|---|
| `settings` | settings | Settings | الإعدادات | `Settings` | `resetTo({kind:"view",view:"settings"})` |
| `kids` | kids | Kids | الأطفال | `Baby` | `resetTo(... view:"kids")` |
| `anime` | anime | Anime | الأنمي | `Sparkles` | `resetTo(... view:"anime")` |
| `home` | home | Home | الرئيسية | `House` | `resetTo(... view:"home")` |

- `DOCK_ORDER = { ltr: [settings,kids,anime,home], rtl: [home,anime,kids,settings] }` — the flex row follows document direction, so both arrays yield the same visual order.
- `dockTabsFor(settings, lang)` filters: Anime tab removed when `settings.hideContent.anime`; in Kids Mode (`settings.kidsMode`) only `home` + `kids` remain (relative order kept — Settings is behind parent gate).
- Language: `dockDirectionFor(uiLang)` → `"rtl"` iff `/^ar(-|_|$)/i` matches, else `"ltr"`. `dockTabLabel(tab, lang)` picks labelAr on Arabic regex.
- NO badges/counts on dock tabs (badges exist only on Settings-hub Quick Access entries, which are NOT dock tabs).

### Active tab detection
```ts
tabIdForView(view): "anime"|"kids"|"home" → themselves; EVERYTHING else (discover, catalogs, movies, shows, live, calendar, library, addons, wrapped, settings) → "settings".
activeTabId(stack): walk stack from top down; first frame with kind==="view" → tabIdForView(that view); fallback "home".
```
So Settings stays lit while browsing any hub page pushed on top of it.

## 4. Behavior

1. **Click/tap**: `resetTo` clears the nav stack to a single view frame (tab = root navigation, no back accumulation).
2. **Press-and-drag scrub** (pointer enhancement; taps untouched):
   - Enter scrub on ≥250ms hold (`SCRUB_HOLD_MS=250`) OR >6px move (`SCRUB_MOVE_PX=6`) while pressed.
   - While scrubbing: pill follows pointer as FRACTIONAL index clamped to [0, count-1] (can never leave capsule), CSS transitions OFF (`data-scrub="true"`), pill grows to 1.08× (`SCRUB_GROW`) with a 150ms eased grow (`SCRUB_GROW_MS`) baked INTO the same transform write (never the standalone `scale` property — that was an overshoot bug).
   - Nearest tab lights as PREVIEW (`data-lit="true"`); the real active tab's visual active state is CSS-suppressed while scrubbing (aria-current kept for screen readers) → exactly one indicator at all times.
   - Release: commits exactly ONE navigation to nearest slot (`Math.round(frac)`); fast flick (>0.5 px/ms, `FLICK_PX_MS`, velocity from last ≤120ms samples) advances one extra tab in inline direction; pill snaps back with 350ms transition. `pointercancel`/lost capture → snap back to still-active tab, no navigation.
   - Haptic: `navigator.vibrate?.(10)` on scrub start (best-effort; iOS no-ops).
   - `touch-action: none` on the capsule so page scroll never steals the pointer mid-scrub.
   - Plain taps: gesture released untouched so the button's normal onClick fires.
3. **Auto-hide on scroll** (`settings.dockAutoHide`, default true): listen passive `window.scroll`; hide when `scrollY > 120 && dy > +4`; reveal when `dy < -4` or `y <= 120`. Hidden state = `data-hidden="true"` → slides fully below screen + opacity 0 + `visibility: hidden` + `pointer-events: none`.
4. **Keyboard roving** (TV/a11y): ArrowLeft/ArrowRight move focus AND activate (direction-aware — follows visual direction, flipped in RTL), Home/End jump to first/last; wraps around. Focus ring via `.harbor-tv-focus`.
5. **Re-measure triggers**: active tab change, tab set/order change (language switch / Kids Mode / hide-anime — signature `tabs.map(t=>t.id).join("|")`), track resize (ResizeObserver on track + window `resize` + `orientationchange`).
6. **No scroll-position memory, no long-press menus, no per-tab badges.**

## 5. Visual spec (all values = CSS custom properties)

### Window-class size ladder (base × `--nav-zoom` [min(ui-zoom,1.1)] × `--nav-kids` [1 or 1.08 in Kids Mode])

| Class | height | tab height | icon size | width | bottom offset | padding |
|---|---|---|---|---|---|---|
| Compact phone <360px | 54px | 40px | 20px | min(100vw−24, 290px) | 12px | 6px |
| **Phone 360–599 (base)** | **60px** | **44px** | **22px** | **min(100vw−32, 330px)** | **16px** | **8px** |
| Tablet 600–839 | 64px | 48px | 22px | 360px | 20px | 8px |
| Small desktop 840–1199 | 66px | 50px | 24px | 400px | 24px | 8px |
| Desktop 1200–1599 | (same heights) | | | 420px | | |
| TV ≥1600 | 78px | 60px | 28px | 490px | 32px | 8px |
| Landscape phone (height ≤480, any width) — last, wins | 48px | 38px | 20px | min(70vw, 340px) | 8px | 6px |

- `--nav-radius: 9999px` (stadium capsule). `--nav-max: calc(100vw - 16px)` hard viewport guard.
- Final width = `min(var(--nav-width), var(--nav-max), 100% − safe-left − safe-right, 100vw − safe-left − safe-right)`.
- **Positioning**: `position: fixed; bottom: calc(var(--nav-bottom-offset) + env(safe-area-inset-bottom)); left: 50%; transform: translateX(-50%); z-index: 40 (--z-nav)`.
- **Safe-area**: bottom inset in `bottom`; left/right insets in the width cap. (Content clearance: `--nav-clearance = height + bottom-offset + safe-bottom + 16px` applied as main's bottom padding; = 32px at ≥1024px where dock is hidden.)

### Glass material (shared `--glass-*` tokens, dark default)
- Background: two layers — `linear-gradient(160deg, rgb(tint/0.12), rgb(tint/0.05) 60%)` over `color-mix(in srgb, panel-fill 70%, transparent)`.
  Dark: `--glass-tint-rgb: 191 230 242`, `--glass-panel-fill: rgba(16,24,28,0.62)`.
- Border: `1px solid rgba(191,230,242,0.35)` (dark) / `rgba(9,42,54,0.16)` (light).
- `backdrop-filter: blur(14px) saturate(1.35)` (12px blur <600px). NO drop shadow (`--glass-shadow: none`) — only inset edges: `inset 0 1px 0 rgb(tint/0.5)` (specular top) + `inset 0 -1px 0 rgb(0 0 0/0.14)`.
- Fallback when no backdrop-filter: opaque `--glass-fallback` = surface-container-high.
- Light appearance overrides: tint `214 234 240`, panel-fill `rgba(252,249,244,0.78)`, active-fill `rgba(9,42,54,0.09)`, highlight 0.85.
- Kids Mode (`html[data-kids="on"]`): pink tint `255 214 235`, panel-fill `rgba(38,20,30,0.6)`, active-fill `rgba(255,255,255,0.24)`, border `rgba(255,214,235,0.4)`, sizes ×1.08.
- Icon colors: dark `--nav-icon-active: #f5f5f5`, `--nav-icon-inactive: rgba(255,255,255,0.75)`; light `#17262e` / `rgba(15,34,43,0.64)`.

### Pill / track / tab
- Track: flex row, `align-items: center`, width/height 100%, relative.
- Pill: absolute, `top: calc((100% - tab-height)/2)`, `height: var(--nav-tab-height)`, `inset-inline-start: 0`, width = one slot (JS-written), `border-radius: var(--nav-radius)` (stadium), `background: var(--glass-active-fill)` (dark `rgba(255,255,255,0.16)`), `opacity: 0` until measured (`data-ready="true"` → 1, no first-paint flash), `transition: transform 350ms / width 350ms / opacity 200ms`, all with `--glass-ease: cubic-bezier(0.2,0,0,1)`; `will-change: transform,width`; `pointer-events: none`. While scrubbing: `transition: none`.
- Tab: `flex: 1 1 0`, height = tab-height, centered content, radius = nav-radius, color = icon-inactive; `transition: color 150ms ease, transform 150ms ease`; `:active` → `scale(0.96)` (`--glass-press-scale`); `[aria-current="page"]` → icon-active color. Touch hit extender `::before` with `inset: -4px 0` (50px target from 42px visual). `-webkit-tap-highlight-color: transparent`.
- M3 state layer `.md-state`: `::after` painted with currentColor — hover 0.08 (hover-capable devices), focus-visible 0.1, active 0.1, disabled 0; 150ms-ish motion.
- Icon frame: 22×22px box (`--nav-icon-size`), both SVGs absolutely stacked filling the box; `transition: opacity 150ms ease`; filled copy `opacity: 0` at rest; active/lit → outline 0 / filled 1.
- `prefers-reduced-motion: reduce` → ALL dock transitions off.

## 6. Breakpoints / visibility conditions (mounting context)

- Mounted in `app-shell.tsx` line ~467: `{showChrome && <GlassDock />}` alongside `<SideRail/>` and `<BackButton/>`.
- `showChrome = !playerActive && !immersiveDetail` — where `playerActive` = top-of-stack frame is `player` (picker overlays ignored), `immersiveDetail` = the top non-overlay frame is a `detail` page. So: **no dock in the video player or on title detail pages** (detail page renders its own back button).
- **Show/hide by width**: `.glass-dock { display: none }` inside `@media (min-width: 1024px)`; the side rail shows there instead. Both components stay mounted; CSS picks one. `< 1024px` = dock only.
- `main` gets bottom padding `--nav-clearance` when showChrome (content never hides behind the dock).
- Auto-hide on scroll-down (section 4.3) is the only runtime hide.

## 7. Dependencies (what the component reads)

- `useNav` (zustand, `@/lib/harbor/store`): `s.stack` (Frame[] — used ONLY for `activeTabId` detection), `s.resetTo(frame)` (clears stack to one frame; both button click and scrub release/keyboard call it with `{kind:"view", view: tab.view}`).
- `useSettings` (same store module): `s.settings` — fields consumed: `uiLanguage` (default "en"; Arabic regex → RTL + Arabic labels + reordered tabs), `kidsMode` (only Home+Kids tabs; also ×1.08 size via `data-kids="on"` on `<html>`), `hideContent.anime` (removes Anime tab), `dockAutoHide` (default true; scroll auto-hide on/off).
- `@/lib/utils` `cn` (class merge, trivial).
- `nav-items.tsx` locals: `dockTabsFor`, `dockDirectionFor`, `dockTabLabel`, types `DockTab`/`DockTabId`.
- Icons (lucide-react, by name): `Settings`, `Baby`, `Sparkles`, `House`.
- Exports consumed elsewhere: `activeTabId` is imported by `side-rail.tsx` (large-screen rail shares the same active-tab truth).

## 8. Flutter translation hints (suggestions, not spec)

- Capsule: `ClipRRect`/`Container` stadium (radius = height/2), `BackdropFilter(blur 14, saturate 1.35)` over the gradient+tint stack, 1px tint border, NO drop shadow, inset top highlight (inner shadow or gradient line).
- Layout: `SafeArea(bottom: true)` + `Align(bottomCenter)` + width = min(computed, viewport−16); `Positioned` fixed-equivalent via Stack/overlay in the app shell; hide on player/detail routes; ≥~1024px equivalent → switch to the side rail.
- Pill: single `AnimatedAlign`/`AnimatedPositioned` with `CurvedAnimation(cubic-bezier(0.2,0,0,1))` 350ms; fractional index from a `HorizontalDragGestureRecognizer` (hold 250ms or 6px slop), grow 1.08 baked into the same transform, haptic `HapticFeedback.selectionClick()`-ish 10ms, flick velocity threshold 0.5px/ms.
- Tab order invariant: on-screen `Settings | Kids | Anime | Home` (Home far-right) in BOTH ar/en; Kids Mode → Home+Kids only; hide-anime removes Anime.
- Active detection: walk the route/nav stack to the nearest "view" route and map: anime/anime, kids/kids, home/home, everything-else→settings.
