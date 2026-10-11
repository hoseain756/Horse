# Liquid Glass component recipes

Contents: Floating nav with moving indicator - Header/toolbar - Search - Buttons - Menus and popovers - Modal and command palette - Sidebar - Cards - Form controls - Tabs/segmented - Toggle and slider - Tooltip - FAB - Media overlay - Notifications - Dashboard - Loading

All examples assume the `.glass` primitive and tokens from `SKILL.md`. When restyling an existing component, keep its markup, handlers, and ARIA; add classes and CSS only.

## Floating nav with moving indicator

```html
<nav class="glass nav" aria-label="Main">
  <span class="nav__pill" aria-hidden="true"></span>
  <a class="nav__item" href="/" aria-current="page"><svg aria-hidden="true">...</svg><span class="sr-only">Home</span></a>
  <a class="nav__item" href="/tasks"><svg aria-hidden="true">...</svg><span class="sr-only">Tasks</span></a>
  <!-- more items -->
</nav>
```
```css
.nav {
  --count: 4; --pad: 6px;
  position: fixed; inset-inline: 0; margin-inline: auto;
  bottom: max(12px, env(safe-area-inset-bottom));
  width: min(92vw, 560px); padding: var(--pad);
  display: grid; grid-template-columns: repeat(var(--count), 1fr);
  border-radius: var(--lg-radius-pill); overflow: hidden; touch-action: none;
}
.nav__item { position: relative; z-index: 1; min-height: 48px; display: grid; place-items: center; color: var(--lg-text-muted); border-radius: inherit; }
.nav__item[aria-current="page"] { color: var(--lg-text); }
.nav__item:focus-visible { outline: none; box-shadow: var(--lg-focus-ring); }
.nav__pill {
  position: absolute; z-index: 0; top: var(--pad); bottom: var(--pad); inset-inline-start: var(--pad);
  width: calc((100% - 2 * var(--pad)) / var(--count)); border-radius: inherit;
  background: rgb(var(--lg-tint) / var(--lg-fill-strong));
  transform: translateX(calc(var(--i, 0) * 100% * var(--dir, 1)));
  transition: transform var(--lg-dur-slow) var(--lg-ease-spring);
}
.nav.is-dragging .nav__pill { transition: none; }
```
`--dir` is `1` in LTR and `-1` in RTL (`[dir="rtl"] .nav { --dir: -1 }`), so the same transform math works in both directions. Do not duplicate item order by language in CSS; DOM order plus `dir` already flips the layout. Only change DOM order when the product requires a different logical order per language.

Drag (add to existing tap logic, do not replace it):

```js
const nav = document.querySelector('.nav'), pill = nav.querySelector('.nav__pill');
const items = [...nav.querySelectorAll('.nav__item')];
let down = false, dragging = false, startX = 0, timer;
const rtl = () => getComputedStyle(nav).direction === 'rtl';

function indexAt(x) {                          // pointer X -> tab index, direction aware
  const r = nav.getBoundingClientRect(), pad = parseFloat(getComputedStyle(nav).paddingLeft) || 0;
  const w = (r.width - 2 * pad) / items.length;
  let i = Math.floor((x - r.left - pad) / w);
  if (rtl()) i = items.length - 1 - i;
  return Math.max(0, Math.min(items.length - 1, i));
}
function follow(x) {                           // pill centered under pointer, clamped inside the bar
  const r = nav.getBoundingClientRect(), pw = pill.offsetWidth;
  const min = 0, max = nav.clientWidth - pw;   // clientWidth excludes the border
  const local = x - r.left - nav.clientLeft - pw / 2;
  const px = Math.max(min, Math.min(max, rtl() ? nav.clientWidth - pw - local : local));
  pill.style.transform = `translateX(${rtl() ? -px : px}px)`;
  pill.style.insetInlineStart = '0px';
}
nav.addEventListener('pointerdown', e => {
  down = true; startX = e.clientX; nav.setPointerCapture(e.pointerId);
  timer = setTimeout(() => start(e.clientX), 250);
});
nav.addEventListener('pointermove', e => {
  if (!down) return;
  if (!dragging && Math.abs(e.clientX - startX) > 8) { clearTimeout(timer); start(e.clientX); }
  else if (dragging) follow(e.clientX);
});
function start(x) { dragging = true; nav.classList.add('is-dragging'); follow(x); }
function end(e) {
  clearTimeout(timer); if (!down) return; down = false;
  const i = indexAt(e.clientX);
  if (dragging) { dragging = false; nav.classList.remove('is-dragging'); }
  pill.style.removeProperty('inset-inline-start');
  setActive(i);                                // your existing function: sets aria-current and --i
}
['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => nav.addEventListener(t, end));
```
Rules that prevent the usual bugs:
- **One indicator only.** While dragging, mark only the item under the pointer as current; do not leave a static background on the item first pressed.
- **Clamp with real measurements** (`clientWidth`, `offsetWidth`), and give the nav `overflow: hidden` and `box-sizing: border-box` so borders do not shift the math.
- **Reset in `pointerup`, `pointercancel`, and `lostpointercapture`** so no stale state remains.
- Links still navigate on a plain tap; only treat the gesture as a drag after the hold or movement threshold.
- Test with the pointer ending outside the bar, with RTL on, and with keyboard Left/Right still working.

## Header / toolbar
Sticky, compact. Start with a higher fill at scroll top if it sits over text; reduce to lighter glass once content scrolls beneath. Toggle a `.is-scrolled` class from an `IntersectionObserver` on a sentinel, not a scroll listener.

## Search
```html
<form role="search" class="glass search">
  <label class="sr-only" for="q">Search</label>
  <svg aria-hidden="true">...</svg>
  <input id="q" type="search" placeholder="Search" autocomplete="off">
</form>
```
```css
.search { display: flex; align-items: center; gap: var(--lg-space-2); padding-inline: var(--lg-space-4); min-height: 48px; border-radius: var(--lg-radius-pill); }
.search input { flex: 1; min-width: 0; background: none; border: 0; color: inherit; font: inherit; outline: none; }
.search:focus-within { box-shadow: var(--lg-shadow), var(--lg-focus-ring); }
.search input::placeholder { color: var(--lg-text-muted); }   /* verify >= 4.5:1 */
```
Keep the existing search logic, debounce, and result handling untouched.

## Buttons
Primary: `--lg-fill-strong` with a stronger edge. Secondary: base fill. Destructive: tinted red with an icon or text, not color alone. Icon-only and ghost buttons on glass need their own scrim fill (a dark or hue-matched tint behind light icons), because a white-tint fill over a bright backdrop can drop an icon below 3:1. Pressed: `transform: scale(.97)`. Disabled: reduced opacity of the *content*, still readable (>= 3:1) and `aria-disabled` or `disabled`. Min size 44x44.

## Menus and popovers
Use a small blur (8-12px) and a higher fill. Support Arrow keys, Home/End, Escape, and return focus to the trigger. Use the Popover API (`popover`) or the project's existing library; do not invent a focus manager if one exists.

## Modal and command palette
```css
dialog.glass { border: 1px solid rgb(var(--lg-tint) / var(--lg-edge)); padding: var(--lg-space-6); max-width: min(92vw, 560px); max-height: 85dvh; overflow: auto; }
dialog.glass::backdrop { background: rgb(0 0 0 / .35); }   /* dim only; no second blur */
dialog.glass[open] { animation: lg-pop var(--lg-dur) var(--lg-ease); }
@keyframes lg-pop { from { opacity: 0; transform: translateY(8px) scale(.96); } }
```
Open with `dialog.showModal()` (focus trap and Escape come built in); on close, focus returns to the trigger. Command palette: `role="combobox"` input with a `role="listbox"` list, `aria-activedescendant`, arrow-key navigation.

## Sidebar
Use glass only if page content scrolls under it. Otherwise a solid or lightly tinted surface is cleaner and cheaper. On mobile convert to a sheet or bottom bar.

## Cards and panels
Prefer tier 3 (solid or barely tinted). Use glass cards only for a few featured items over rich backgrounds. Never blur behind long text blocks.

## Form controls
Solid-leaning fields with a 3:1 border. Glass belongs on the wrapper or container, not on the input text area itself. Visible labels, `aria-describedby` for errors, error indicated by icon + text + color.

## Tabs and segmented controls
Same indicator pattern as the nav pill (transform-based). For true tab panels use `role="tablist"`, `tab`, `tabpanel` with roving tabindex and Arrow keys. For page navigation use `<nav>` and `aria-current`.

## Toggle and slider
Use native `<input type="checkbox" role="switch">` and `<input type="range">` with custom styling. Track and thumb must reach 3:1 against the surface in both on and off states.

## Tooltip
Short, supplementary text only; appears on focus as well as hover; `role="tooltip"` linked by `aria-describedby`; dismissible with Escape.

## Floating action button
One per screen. Include safe-area offsets. Provide a text label or `aria-label`.

## Media overlay
Controls on glass over video need a scrim (see `css-techniques.md` section 6). Controls must be reachable by keyboard and touch and must not auto-hide while focused.

## Notifications
Solid-leaning surfaces. Use `role="status"` (polite) or `role="alert"` (urgent). Do not rely on color for severity; include an icon and label. Allow dismissal and keep them out of the focus path unless actionable.

## Dashboard
Glass for navigation, filters, and floating summaries. Charts, tables, and dense data sit on solid surfaces. Limit blurred layers per screen.

## Loading and skeletons
Skeleton blocks are tint-only (`rgb(var(--lg-tint) / .08)`), with a shimmer moved by `transform` on a pseudo-element, disabled under reduced motion. Set `aria-busy="true"` on the region and keep layout dimensions stable to avoid shifts.
