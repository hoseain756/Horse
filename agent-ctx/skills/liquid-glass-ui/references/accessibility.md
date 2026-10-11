# Accessibility for Liquid Glass

Contents: 1. Contrast over translucent surfaces - 2. Semantics and ARIA - 3. Keyboard and focus - 4. Dialogs, menus, popovers - 5. User-preference media queries - 6. Forms - 7. Touch targets - 8. Manual test pass

Accessibility is an acceptance criterion. If an effect conflicts with it, change the effect.

## 1. Contrast over translucent surfaces

Targets (WCAG 2.2 AA): normal text 4.5:1, large text (18pt, or 14pt bold) 3:1, icons and control boundaries 3:1, focus indicators 3:1 against adjacent colors.

Why glass is tricky: the effective surface color changes with whatever is behind it. A pass on one backdrop does not mean a pass everywhere.

Procedure:
1. List the worst-case backdrops: the lightest and darkest content that can appear behind the glass (image regions, gradient ends, scrolling content, both themes).
2. Run the estimator:
   ```bash
   python scripts/contrast.py --text "#ffffff" --surface "rgba(255,255,255,0.12)" \
       --backdrop "#ffffff" "#000000" "#5eabcc" --target 4.5
   ```
   It composites the surface over each backdrop and reports the ratio. It does not model blur or saturation, so it is an estimate.
3. Confirm on the rendered page (screenshot and sample pixel colors, or a browser contrast tool).
4. If any backdrop fails, apply in this order: raise surface alpha, switch tint (dark tint under light text, light under dark text), add a scrim (`css-techniques.md` section 6), use a solid backing for text, change text color.

Muted text and placeholders are text: they need 4.5:1 too.

Measuring on the rendered page (when you automate it, these mistakes produce false failures or false passes):
- Hide the text, screenshot the element, and compare the text color with the 5th, 50th, and 95th percentile background luminance.
- Sample the central area around the text, not the full bounding box. Pill-shaped or rounded elements include corner pixels from the surroundings.
- Screenshot clip coordinates are page coordinates in many tools; add the scroll offset, and for `position: fixed` elements scroll to the top first.
- Count translucent surfaces (alpha background, gradient fills), not only elements with `backdrop-filter`; tint-only surfaces still need contrast.
- Re-load the page cleanly when simulating a missing feature; running page scripts twice causes unrelated errors.
- Validate your measuring tool on a case with a known answer (black on white = 21:1) before trusting its failures.

## 2. Semantics and ARIA

- Use native elements: `<nav>`, `<button>`, `<a>`, `<dialog>`, `<input>`, `<label>`.
- Icon-only controls: `<button aria-label="Settings">` or visually hidden text. Decorative SVG gets `aria-hidden="true"`.
- Navigation: `<nav aria-label="Main">` with `aria-current="page"` on the current link. Do not use `role="tab"` for page navigation.
- Real tabs (panels on one page): `role="tablist"`, `role="tab"` with `aria-selected`, `role="tabpanel"`, roving `tabindex`, Arrow/Home/End keys.
- Live updates: `role="status"` for polite messages, `role="alert"` for urgent ones.
- Do not add ARIA that repeats native semantics; incorrect ARIA is worse than none.

Visually hidden utility:
```css
.sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
```

## 3. Keyboard and focus

- Every interactive element is reachable and operable by keyboard in a logical order.
- Focus is always visible. Use `:focus-visible` with a two-tone ring so it works on light and dark backdrops:
  ```css
  :where(a, button, input, select, textarea, [tabindex]):focus-visible { outline: none; box-shadow: var(--lg-focus-ring); }
  ```
- Hover and pointer-only effects never hide essential actions.
- Pointer drag gestures (scrubbing a nav indicator) need a non-drag equivalent: tap, plus keyboard Left/Right (WCAG 2.5.7 Dragging Movements).

## 4. Dialogs, menus, popovers

- Dialog: `<dialog>` + `showModal()`. Provides inert background, focus trap, and Escape. Label with `aria-labelledby`. On close, return focus to the opener.
  ```js
  const opener = document.activeElement; dlg.showModal();
  dlg.addEventListener('close', () => opener?.focus(), { once: true });
  ```
- Menu button: `aria-haspopup="menu"`, `aria-expanded`, items `role="menuitem"`, Arrow keys, Escape closes and refocuses the trigger.
- Popover/tooltips: available on focus as well as hover, dismissible with Escape, not the only place information appears.
- Do not trap focus in non-modal popovers.

## 5. User-preference media queries

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; scroll-behavior: auto !important; }
}
@media (prefers-contrast: more) {
  .glass { background: var(--lg-solid); -webkit-backdrop-filter: none; backdrop-filter: none; border-color: currentColor; }
}
@media (prefers-reduced-transparency: reduce) {   /* limited support: enhancement only */
  .glass { background: var(--lg-solid); -webkit-backdrop-filter: none; backdrop-filter: none; }
}
@media (forced-colors: active) {
  .glass { background: Canvas; border: 1px solid CanvasText; box-shadow: none; -webkit-backdrop-filter: none; backdrop-filter: none; }
  .nav__pill { background: Highlight; }
}
```
Reduced motion means fewer or gentler transitions, not necessarily none: keep opacity changes, drop springs, parallax, and shimmer.

## 6. Forms

- Every field has a visible `<label>` (or an accessible name when design forbids visible text, which should be rare).
- Errors: text near the field, linked with `aria-describedby`, plus `aria-invalid="true"`; not color alone.
- Required fields indicated in text, not only by an asterisk color.
- Keep field backgrounds opaque enough that typed text meets 4.5:1.

## 7. Touch targets

- Primary controls at least 44x44 CSS px (WCAG 2.2 AA minimum is 24x24 with spacing; 44 is the practical target for fingers).
- At least 8px between adjacent targets. Enlarge the hit area with padding or a pseudo-element if the icon is small.

## 8. Manual test pass

1. Unplug the mouse: complete the main flows with Tab, Shift+Tab, Enter, Space, Arrows, Escape.
2. Zoom to 200% and 400% width reflow: no clipped or overlapping glass.
3. Turn on a screen reader if available; confirm names, roles, and current state announce correctly.
4. Emulate reduced motion, high contrast, forced colors, and dark/light themes.
5. Sample the worst-case backdrop contrast again after any style change.

Report which of these you actually performed.
