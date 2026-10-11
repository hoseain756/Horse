# CSS techniques for Liquid Glass

Contents: 1. Backdrop roots and nesting - 2. Gradient edge - 3. Specular and sheen layers - 4. SVG edge refraction (Chromium) - 5. Pointer-reactive light - 6. Scrim for busy backgrounds - 7. Frameworks and Tailwind - 8. Theming

Start from the base recipe in `SKILL.md`. Add techniques here only when the design needs them.

## 1. Backdrop roots and nesting

`backdrop-filter` samples what is painted behind the element up to the nearest *backdrop root*. These properties on an ancestor create a backdrop root: `filter`, `backdrop-filter`, `opacity` below 1, `mask`/`clip-path`, `mix-blend-mode` other than normal, and `will-change` naming any of them.

Consequences:
- A glass child inside a glass parent blurs only the parent's contents. If the child must blur the page, make it a sibling positioned above, not a descendant.
- Fading a glass element with `opacity` during an open/close animation flattens its blur for the duration. Acceptable for short transitions (under ~250ms); do not leave `opacity < 1` on a resting glass element.
- Put `isolation: isolate` on the glass element so pseudo-elements and blend modes stay inside it.

## 2. Gradient edge (light catching a rim)

A 1px border that is brighter at the top-left and fades toward the bottom-right reads as a lit edge. Use a masked pseudo-element so the interior stays transparent.

```css
.glass-edge::after {
  content: ""; position: absolute; inset: 0; border-radius: inherit; padding: 1px; pointer-events: none;
  background: linear-gradient(135deg, rgb(255 255 255 / .7), rgb(255 255 255 / .08) 40%, rgb(255 255 255 / .02) 60%, rgb(255 255 255 / .35));
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
          mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0);
}
```
Keep the light direction consistent across all components (top-left is the usual choice). On light themes lower the white alpha and add a faint dark outer edge so the border stays visible.

## 3. Specular and sheen layers

- **Sheen**: `::before` with `linear-gradient(180deg, rgb(255 255 255 / .22), transparent 38%)`. Subtle; never a full-surface gloss.
- **Inner shadow for thickness**: `inset 0 -1px 0 rgb(0 0 0 / .12)` plus `inset 0 1px 0 rgb(255 255 255 / .5)`.
- **Soft ambient shadow**: one large, low-alpha shadow (`0 8px 32px rgb(0 0 0 / .18)`). Avoid stacking three heavy shadows.
- **Colored glow** only when it expresses state (focus, active), at low alpha.

## 4. SVG edge refraction (Chromium only)

`backdrop-filter: url(#filter)` lets an SVG filter distort the backdrop. It is supported in Chromium-based browsers, not in Safari or Firefox. Use it only for small, high-value elements (a nav pill, a lens control), always with a plain-blur fallback, and test on a mid-range device.

```html
<svg width="0" height="0" aria-hidden="true" focusable="false" style="position:absolute">
  <filter id="lg-refract" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.008 0.012" numOctaves="2" seed="3" result="noise"/>
    <feGaussianBlur in="noise" stdDeviation="2" result="soft"/>
    <feDisplacementMap in="SourceGraphic" in2="soft" scale="18" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
</svg>
```
```css
/* .glass already provides the plain blur fallback for every browser */
.is-chromium .glass--lens {
  -webkit-backdrop-filter: url(#lg-refract) blur(6px) saturate(160%);
          backdrop-filter: url(#lg-refract) blur(6px) saturate(160%);
}
```
```js
// Opt in only on Chromium-based engines; elsewhere the plain blur stays.
if (navigator.userAgentData?.brands?.some(b => /Chromium/.test(b.brand))) {
  document.documentElement.classList.add('is-chromium');
}
```
Notes:
- `@supports` cannot reliably detect `url()` support inside `backdrop-filter`, so gate by engine (as above) and accept the plain-blur fallback elsewhere. Re-verify this gate when browser support changes.
- Noise displacement gives a liquid wobble, not physically correct lensing. Describe it honestly as stylized.
- True edge-only refraction (distortion concentrated near the rim) needs a displacement map image generated per element size, which is heavy to maintain. Prefer the blur + edge-light recipe unless the brief demands more.
- Keep `scale` low (10-24). Large values smear text behind the glass.

## 5. Pointer-reactive light

```css
.glass-lit { --mx: 50%; --my: 0%; }
.glass-lit::before {
  background:
    radial-gradient(160px circle at var(--mx) var(--my), rgb(255 255 255 / .28), transparent 60%),
    linear-gradient(180deg, rgb(255 255 255 / .18), transparent 38%);
}
```
```js
// Only for fine pointers and when motion is allowed
const ok = matchMedia('(hover: hover) and (pointer: fine)').matches &&
           !matchMedia('(prefers-reduced-motion: reduce)').matches;
if (ok) document.querySelectorAll('.glass-lit').forEach(el => {
  let raf = 0;
  el.addEventListener('pointermove', e => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      el.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  }, { passive: true });
});
```
Use on small controls (buttons, nav pills). Not on text panels or whole pages.

## 6. Scrim for busy backgrounds

When a photo or noisy pattern makes contrast unreliable, add a solid-tint layer between content and glass or inside the glass:

```css
.glass--scrimmed { background:
  linear-gradient(rgb(var(--lg-scrim, 0 0 0) / .35), rgb(var(--lg-scrim, 0 0 0) / .35)),
  linear-gradient(135deg, rgb(var(--lg-tint) / .18), rgb(var(--lg-tint) / .08)); }
```
Raise the scrim alpha until the contrast script passes for the worst-case patch of the image.

## 7. Frameworks and Tailwind

- **Any framework**: put tokens and `.glass` in a global stylesheet (or the project's token layer). Wrap in a small component only if the project already uses component abstractions, for example `GlassSurface` with `tier` and `as` props that render the right element.
- **React/Next**: no runtime CSS-in-JS needed. Keep the glass primitive as a class; use `data-tier="1|2"` attributes for variants. In SSR frameworks avoid reading `matchMedia` during render; do it in an effect.
- **Vue/Nuxt, Svelte/SvelteKit, Astro**: scoped styles are fine, but define the tokens on `:root` globally so themes work across components. In Astro, ship interactive indicators with a small client island or plain script.
- **Tailwind v3**: map tokens in `theme.extend` (colors via `rgb(var(--x) / <alpha-value>)`), and define `.glass` in `@layer components`. **Tailwind v4**: declare tokens in `@theme` and keep the material as a custom class or `@utility`. Native `backdrop-blur-*` utilities exist but do not set saturation, edges, or fallbacks, so wrap them in the shared class.
- **CSS Modules / vanilla-extract / styled-components**: reuse the same variables; do not duplicate the recipe per component.

## 8. Theming

- Dark theme: low tint alpha (0.08-0.16), white highlight, visible edge. Light theme: higher alpha (0.4-0.6), faint cool tint, dark text, subtle dark outer edge.
- Switch themes by overriding tokens on `[data-theme]` or via `prefers-color-scheme`; do not branch per component.
- Check both themes against the same worst-case backdrop procedure.
