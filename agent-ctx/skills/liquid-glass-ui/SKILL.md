---
name: liquid-glass-ui
description: Design, implement, redesign, and repair "Liquid Glass" web interfaces - translucent, layered, background-aware glass surfaces with specular edges, soft depth, and fluid interaction - that stay accessible, responsive, and fast. Use this skill whenever the user mentions liquid glass, glassmorphism, frosted or translucent UI, glass navbar, floating glass navigation, backdrop blur, iOS 26 / visionOS-style interfaces, or asks to make a site look "modern, premium, glassy, or Apple-like" - even if they never say "liquid glass". Also use it to fix an existing glass UI that has low contrast, janky scrolling, heavy blur, or broken mobile layouts.
---

# Liquid Glass UI Design

You are acting as a senior UI/UX designer, frontend architect, and design-systems engineer. Your job is to make interfaces that feel like carefully engineered glass: the material responds to what is behind it, edges catch light, depth comes from layering, and every effect serves legibility or state. Liquid Glass is a **design direction**, not one CSS property and not a spec. Pick the simplest technique that achieves the intended result.

## Principles (and how this differs from ordinary glassmorphism)

| Ordinary glassmorphism | Liquid Glass direction |
|---|---|
| One flat `rgba` + blur on every card | A material with several layers: tint, blur + saturation, edge highlight, soft shadow |
| Same treatment everywhere | Hierarchy: glass is for chrome and controls that float above content, not for all content |
| Ignores what is behind it | Tint, opacity, and blur chosen per background and verified for contrast |
| Decorative | Glass communicates elevation, focus, and state |
| Large radius and glow everywhere | Radius follows control size; light is subtle and consistent in direction |

Rules of thumb:
- Glass needs something to refract. Over a flat color it looks like a gray box. Make sure content, imagery, or a gradient exists behind it.
- Plain CSS transparency does not produce physical refraction. Do not claim it does. True lensing needs an SVG displacement filter (Chromium only for `backdrop-filter: url()`), WebGL, or canvas, and only when the brief justifies the cost. See `references/css-techniques.md`.
- Never trade legibility for transparency. When in conflict, raise opacity or tint.
- Restraint wins. If an effect does not improve usability or hierarchy, remove it.

## Workflow

Follow these phases in order. Do not rewrite an interface before you understand it.

Pick the entry path first:
- **Existing site, restyle or redesign:** run all five phases; preserve behavior.
- **Fixing a slow, unreadable, or broken glass UI:** read `references/quality-checklist.md` section 3 (repair playbook) before Phase 1 and follow its order. Layout first, then rendering cost, then contrast.
- **New project with no existing code or tokens:** Phase 1 reduces to confirming the stack and constraints; use `references/quality-checklist.md` section 4 for starting defaults, then continue from Phase 2.

### 1. Inspect
1. Read the repo: framework (React/Next, Vue/Nuxt, Svelte/SvelteKit, Astro, plain HTML), styling approach (Tailwind, CSS modules, CSS-in-JS, global CSS), build and test commands.
2. Find existing design tokens, theme files, shared components, and dark-mode handling. Reuse them; extend rather than replace.
3. Identify the target pages/components and what sits behind each one (image, gradient, scrolling text, other layers).
4. Note existing behavior to preserve: routes, handlers, form logic, analytics hooks, tests, ARIA.
5. Note constraints: browsers supported, mobile share, performance budget.

### 2. Plan
Write a short plan (a few lines is enough): components to change, which glass tier each gets, shared tokens, responsive changes, interaction states, accessibility risks, performance risks. Preserve content, information architecture, and functionality unless the user asks otherwise.

### 3. Implement
- Centralize tokens as CSS custom properties; build one reusable glass primitive (class, component, or utility) and variants.
- Restyle existing markup where possible. Keep DOM structure, event handlers, and business logic. Add wrappers or pseudo-elements instead of rewriting components.
- Use native elements (`<nav>`, `<button>`, `<dialog>`, `<input>`). Put glass on a wrapper and use `:focus-within` for composite controls such as search fields.
- Implement every state: default, hover (pointer devices only), pressed, focus-visible, active/current, disabled, loading, error.
- Add no dependency unless native CSS cannot do the job.

### 4. Validate
Do not claim anything works unless you verified it. Use what the environment offers (build, lint, tests, headless browser screenshots, dev-tools emulation). If you cannot run a browser, say so and list what remains unverified.
- Check the widths in the viewport matrix (`references/quality-checklist.md`).
- Check text and icon contrast against the worst-case backdrop. `scripts/contrast.py` gives an estimate; confirm on the rendered page.
- Tab through every control; open and close every overlay with keyboard only.
- Emulate `prefers-reduced-motion`, `prefers-contrast: more`, and a browser without `backdrop-filter`.
- Check the console, the build, and existing tests.

### 5. Refine
Fix measurable problems only: contrast, overflow, alignment, jank, inconsistent radius or spacing, timing that feels off. Do not keep adding highlights, gradients, or glows. Stop when the checklist passes.

## Design tokens

Define once at the root, override for themes. Values below are starting points, not mandates; tune per background.

```css
:root {
  /* Material */
  --lg-blur: 16px;                 /* chrome 12-20px; large overlays up to 28px; avoid more */
  --lg-saturate: 160%;             /* 120-180% keeps color alive behind blur */
  --lg-tint: 255 255 255;          /* RGB channels. Light theme: white. Dark theme: a light tint of the backdrop hue (e.g. 150 215 235 over teal) */
  --lg-fill: 0.10;                 /* tier-2 tint alpha; raise on busy backgrounds */
  --lg-fill-strong: 0.22;          /* tier-1 / controls */
  --lg-edge: 0.35;                 /* border alpha */
  --lg-highlight: 0.55;            /* top inset highlight alpha */
  --lg-solid: #1d2a30;             /* opaque fallback; also used for contrast backing */
  --lg-shadow: 0 8px 32px rgb(0 0 0 / 0.18);

  /* Shape and space */
  --lg-radius-sm: 12px; --lg-radius-md: 20px; --lg-radius-lg: 28px; --lg-radius-pill: 999px;
  --lg-space-1: 4px; --lg-space-2: 8px; --lg-space-3: 12px; --lg-space-4: 16px; --lg-space-6: 24px;
  --lg-icon: 24px;

  /* Type and color */
  --lg-font: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --lg-text: #fff; --lg-text-muted: rgb(255 255 255 / .78);

  /* Motion */
  --lg-ease: cubic-bezier(.2, .8, .2, 1);
  --lg-ease-spring: cubic-bezier(.3, 1.25, .5, 1);
  --lg-dur-fast: 120ms; --lg-dur: 220ms; --lg-dur-slow: 380ms;

  /* Focus */
  --lg-focus: #fff; --lg-focus-ring: 0 0 0 2px var(--lg-solid), 0 0 0 4px var(--lg-focus);
}
:root[data-theme="light"], .theme-light {
  --lg-tint: 255 255 255; --lg-fill: 0.45; --lg-edge: 0.7;
  --lg-solid: #f1f5f7; --lg-text: #0b1b22; --lg-text-muted: rgb(11 27 34 / .72);
  --lg-focus: #0b1b22; --lg-shadow: 0 8px 32px rgb(20 40 60 / 0.14);
}
```

If the project already has tokens, map to them (`--lg-*` can alias existing variables) instead of adding a parallel system. In Tailwind, expose the same variables through the theme config (v3 `theme.extend`, v4 `@theme`) and keep the material in a component class; do not scatter 12 arbitrary-value utilities across every element.

## Glass material recipe

Layers, bottom to top: backdrop blur and saturation, translucent tint gradient, edge border, inset highlights, outer shadow, optional specular pseudo-element.

```css
.glass {
  position: relative;
  isolation: isolate;                      /* keeps ::before behind content, contains blend */
  border-radius: var(--lg-radius-md);
  color: var(--lg-text);
  background: var(--lg-solid);             /* fallback: opaque, readable everywhere */
  border: 1px solid rgb(var(--lg-tint) / var(--lg-edge));
  box-shadow: var(--lg-shadow);
}
@supports ((-webkit-backdrop-filter: blur(1px)) or (backdrop-filter: blur(1px))) {
  .glass {
    background:
      linear-gradient(135deg, rgb(var(--lg-tint) / calc(var(--lg-fill) + .08)), rgb(var(--lg-tint) / var(--lg-fill)) 55%);
    -webkit-backdrop-filter: blur(var(--lg-blur)) saturate(var(--lg-saturate));
            backdrop-filter: blur(var(--lg-blur)) saturate(var(--lg-saturate));
    box-shadow:
      var(--lg-shadow),
      inset 0 1px 0 rgb(var(--lg-tint) / var(--lg-highlight)),   /* top specular edge */
      inset 0 -1px 0 rgb(0 0 0 / .12);                          /* bottom core shadow */
  }
}
.glass::before {                            /* soft sheen, not a mirror */
  content: ""; position: absolute; inset: 0; z-index: -1; border-radius: inherit; pointer-events: none;
  background: linear-gradient(180deg, rgb(255 255 255 / .22), transparent 38%);
}
@media (prefers-contrast: more) {
  .glass { background: var(--lg-solid); -webkit-backdrop-filter: none; backdrop-filter: none; border-color: currentColor; }
  .glass::before { display: none; }
}
@media (forced-colors: active) {
  .glass { background: Canvas; border: 1px solid CanvasText; -webkit-backdrop-filter: none; backdrop-filter: none; box-shadow: none; }
}
```

Technique selection:

| Need | Use | Avoid |
|---|---|---|
| Frosted surface | `backdrop-filter` blur + saturate + tint | Blur above ~28px; stacking many blurred layers |
| Edge light | inset `box-shadow`, 1px border, gradient border via mask | Thick white borders, rainbow edges |
| Surface sheen | `::before` gradient at low alpha | Full-surface glossy gradients |
| Lensing at edges | SVG `feDisplacementMap` via `backdrop-filter: url(#id)` (Chromium) with plain-blur fallback | Using it on large panels, or without a fallback |
| Cursor-reactive light | CSS vars `--mx/--my` updated in `pointermove`, only for `(hover: hover) and (pointer: fine)` | Pointer effects on touch, on text-heavy panels, or when reduced motion is on |
| Real 3D refraction | WebGL/canvas only if the brief requires it and a static fallback exists | Defaulting to it |

Pitfall: an element with `backdrop-filter`, `filter`, `opacity < 1`, `mask`, or `will-change` of those properties becomes a *backdrop root*. A nested glass child then blurs only what is inside that parent, not the page. Avoid nesting glass in glass; if unavoidable, flatten the parent.

## Hierarchy: not everything is glass

1. **Tier 1 - controls and floating chrome** (floating nav, toolbar, FAB, segmented control, popover): strongest glass, `--lg-fill-strong`, clear edge.
2. **Tier 2 - panels** (sidebar, modal, notification, command palette): medium glass with a higher fill when it holds text. Text-heavy panels should be closer to opaque.
3. **Tier 3 - content** (articles, tables, forms, long lists): solid or very lightly tinted surfaces. Do not blur behind body text.

## Background awareness

Before choosing values, look at what is behind the surface (and at the lightest and darkest cases as content scrolls).

| Backdrop | Treatment |
|---|---|
| Dark, smooth gradient | Low fill (0.08-0.14), light text, visible top highlight |
| Light, smooth | Higher fill (0.4-0.6) with a faint dark tint, dark text; white-on-white glass disappears |
| Photo / busy / noisy | Raise blur to 20-28px and fill to 0.25-0.5, or add a `--lg-solid` scrim at 40-60% under the glass |
| Scrolling content under fixed glass | Test at worst-case content; add an edge fade or higher fill; keep text on the glass short |
| Overlapping glass | Keep at most 2-3 visible blurred layers; reduce inner layer to tint only (no blur) |
| Dynamic / video | Cap blur, test performance on a mid-range phone, offer a static fallback |

If any text or icon on glass fails contrast against the worst-case backdrop, increase fill, change tint, or add a solid backing. Never ship a failure to preserve the look.

Tint hue matters as much as opacity. Pure white tint over a near-black or saturated backdrop reads as flat gray and wastes contrast headroom; a light tint of the backdrop's own hue reads as glass and measured better in testing (min contrast 5.58 vs 4.51 on the same layout). A heavy neutral dark scrim fixes contrast but turns the surface muddy, so prefer a moderate, theme-hued scrim and look at the result.

## Interaction

- States communicate meaning: hover brightens the fill slightly (pointer devices only); pressed lowers elevation or scales to ~0.97; focus-visible shows a high-contrast ring using `--lg-focus-ring`; current/active uses an indicator, not just a color change.
- Active indicators (nav pill, segmented thumb) move with `transform` and `opacity`, never by animating `left/width`. Use `--lg-ease-spring` sparingly. For drag, clamp with real measurements and disable the transition while dragging (see `references/components.md`).
- Open/close overlays with `opacity` + `transform` (scale .96 to 1, 8px translate) over `--lg-dur`.
- Never gate essential actions behind hover. Use `@media (hover: hover) and (pointer: fine)` for hover-only polish.
- Respect reduced motion:
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; scroll-behavior: auto !important; }
  }
  ```
- Do not hijack scrolling, add pointer-follow effects to whole pages, or animate blur radius.

## Responsive rules (mobile first)

Design the smallest layout first, then enhance. Validate at 320, 375, 480, 768, 834, 1024, 1280, and 1440+ px. These are test widths, not required breakpoints; set breakpoints where the layout breaks (`min-width`, content-driven).

- No horizontal overflow at 320px. Use `min-width: 0` on flex/grid children, `max-width: 100%` on media, `overflow-wrap: anywhere` for long strings.
- Touch targets: at least 44x44 CSS px for primary controls (WCAG 2.5.8 sets a 24px minimum; 44 is the practical target). Keep 8px spacing between neighbors.
- Fixed/floating glass respects safe areas: `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` and `padding-bottom: max(12px, env(safe-area-inset-bottom))`.
- Use `dvh`/`svh` rather than `vh` for full-height overlays on mobile.
- Transform, not shrink: on phones a desktop sidebar becomes a bottom bar or sheet; a long nav becomes an icon bar plus overflow menu.
- Reduce glass area on small screens: smaller radius, smaller blur, less padding, fewer simultaneous glass layers.
- Fluid sizing with `clamp()` for type and spacing; avoid fixed pixel widths on containers.

## Accessibility (mandatory)

Treat these as acceptance criteria; details and snippets in `references/accessibility.md`.
- Contrast: text 4.5:1 (3:1 for large text), icons and control boundaries 3:1, measured against the worst-case backdrop.
- Semantic HTML first; ARIA only when native semantics are insufficient. Icon-only buttons need an accessible name.
- Visible focus on every interactive element; never `outline: none` without a replacement.
- Dialogs: prefer native `<dialog>` with `showModal()`; return focus to the trigger on close; Escape closes.
- Navigation uses `<nav>` and `aria-current="page"`; reserve `role="tablist"` for real tab panels.
- Honor `prefers-reduced-motion`, `prefers-contrast: more`, and `forced-colors`. `prefers-reduced-transparency` has limited support: use it as an enhancement, never as the only fallback.
- Forms: real `<label>`s, error text tied by `aria-describedby`, not conveyed by color alone.

## Performance and compatibility

- `backdrop-filter` forces the browser to re-composite what is behind the element every frame it changes. Cost scales with blurred area and blur radius.
- Keep blurred regions small (bars, cards, popovers). Avoid full-viewport blurred layers, especially on mobile.
- Limit simultaneous visible backdrop-filter layers (aim for 3 or fewer) and avoid them inside long scrolling lists; use tint-only surfaces for repeated items.
- Do not animate `backdrop-filter` or `filter`. Animate `transform` and `opacity` on a layer; fade a pre-blurred element instead of changing blur.
- Use `will-change` only on elements that are about to animate, and remove it afterward.
- Prefer static gradients over large animated ones; avoid `mix-blend-mode` on large areas.
- Feature-detect with `@supports`, prefix with `-webkit-backdrop-filter` for older Safari, and always ship the opaque fallback in the base rule.
- SVG-filter `backdrop-filter: url()` only works in Chromium-based browsers; guard with a Chromium check or `@supports` and fall back to plain blur elsewhere.
- Test Safari separately for `border-radius` clipping and nested blur behavior, and Firefox for `backdrop-filter` support (available in current versions).

## Components

Quick rules; full recipes in `references/components.md`.

| Component | Tier | Key rules |
|---|---|---|
| Floating nav / mobile nav | 1 | Pill container, moving indicator via transform, safe-area padding, 44px targets, `aria-current` |
| Header / toolbar | 1 | Sticky, fade or raise fill when content scrolls beneath, keep height compact |
| Search bar | 1 | Native `<input type="search">`, glass on wrapper, `:focus-within` ring, visible label or `aria-label` |
| Buttons / icon buttons | 1 | Fill + edge, pressed scale, accessible names, disabled state with lower contrast but still legible |
| Dropdown / context menu / popover | 1-2 | Small blur, higher fill, arrow keys, Escape, focus return |
| Modal / command palette | 2 | Native `<dialog>`, dim `::backdrop` lightly (do not blur twice), focus trap, higher fill for text |
| Sidebar | 2 | Glass only if content scrolls beneath; otherwise solid |
| Cards / panels | 2-3 | Use sparingly; text-heavy cards solid or near-solid |
| Form controls | 3 | Solid-ish fields, strong border, clear errors; glass only on wrappers |
| Tabs / segmented control | 1 | Indicator slides on transform; keyboard arrows |
| Toggle / slider | 1 | Track tint, thumb as small glass or solid; 3:1 boundary contrast |
| Tooltip | 1 | Short text, high fill, not the only carrier of information |
| FAB | 1 | One per screen, safe-area aware |
| Media overlay | 1 | Auto-hide with controls reachable by keyboard/touch; scrim for contrast over video |
| Notification panel | 2 | Solid-leaning, severity not by color alone |
| Dashboard | 2-3 | Glass for nav/filters; charts and tables on solid surfaces |
| Loading / skeleton | 3 | Tint-only shimmer using transform/opacity; respect reduced motion |

## Common mistakes and anti-patterns

- Putting glass on every card, so nothing has hierarchy.
- Blur over a flat background (nothing to see) or maximum blur on everything (muddy, slow).
- White text on a light photo with 10% fill; contrast never measured.
- Nested `backdrop-filter` that silently does nothing.
- Animating blur or `left/width` for indicators.
- Hover-only menus; tiny icon buttons; removed focus outlines.
- Replacing a working component's DOM and breaking handlers, tests, or ARIA.
- Adding a library for what CSS can do.
- Claiming results ("tested on mobile", "passes WCAG") without verification.
- Over-rounding everything, glow on every edge, rainbow gradients, decorative floating blobs.
- Fixing contrast with a heavy neutral scrim and never looking at the screenshot (gray, muddy glass).
- Hero headlines with a very narrow `max-width` in `ch` (under about 18ch) that wrap to three lines on desktop; use `text-wrap: balance` instead.
- Trusting a contrast number measured from a rounded element's bounding box (corners include the surroundings); see `references/accessibility.md` section 1.

## Final QA checklist

Run the full version in `references/quality-checklist.md`. Minimum before reporting done:
- [ ] Existing functionality, routes, and tests unchanged and passing
- [ ] Tokens centralized; one glass primitive reused
- [ ] Hierarchy clear; glass limited to appropriate tiers
- [ ] Contrast verified against worst-case backdrop (text 4.5:1, UI 3:1)
- [ ] No horizontal overflow at 320px; layout checked at all matrix widths
- [ ] Touch targets 44px; safe areas handled
- [ ] Keyboard path complete, focus visible, dialogs manage focus
- [ ] Reduced motion, high contrast, forced colors, and no-backdrop-filter fallbacks work
- [ ] No animated blur; blurred area and layer count within budget
- [ ] Console clean; build passes
- [ ] Report states what was verified and what was not

## Reference files

Read these only when needed:
- `references/css-techniques.md` - SVG displacement filter for edge refraction, gradient borders, specular layers, pointer light, backdrop-root pitfalls, framework and Tailwind notes. Read when a task needs more than the base recipe.
- `references/components.md` - per-component markup and CSS, including the nav indicator with drag clamping and RTL handling. Read before building or restyling any component.
- `references/accessibility.md` - contrast method, ARIA patterns, dialog and menu behavior, user-preference media queries. Read during planning for any interactive component and again at validation.
- `references/quality-checklist.md` - viewport matrix, full checklist, repair playbook (section 3) for broken glass UIs, new-site starting defaults (section 4), report template (section 5). Read at validation; read the repair playbook first when fixing an existing glass UI; read section 4 first for greenfield work.
- `scripts/contrast.py` - estimates WCAG contrast of text on a translucent surface over several backdrop colors. Usage in `references/accessibility.md`.
