# Quality checklist, repair playbook, and report template

Contents: 1. Viewport matrix - 2. Full checklist - 3. Repair playbook (fixing a broken glass UI) - 4. New-site starting defaults - 5. Report template

## 1. Viewport matrix

Check every changed page at: 320, 375, 480, 768, 834, 1024, 1280, 1440+ px. These are test widths, not required breakpoints.

At each width confirm: no horizontal scroll, no clipped or overlapping controls, text readable without zoom, glass panels not oversized, touch targets at least 44px on touch layouts, fixed/floating glass clear of safe areas and the on-screen keyboard.

Also check: portrait and landscape on a phone size, 200% browser zoom, long text and long translated strings, RTL if the product supports it.

## 2. Full checklist

**Preservation**
- [ ] Routes, handlers, form logic, analytics, and ARIA unchanged unless intentionally improved
- [ ] Existing tests and build pass; no unrelated refactors

**Design**
- [ ] Glass limited to the right tiers; text-heavy areas solid or near-solid
- [ ] One glass primitive and shared tokens; no duplicated one-off recipes
- [ ] Consistent radius, edge light direction, spacing, and typography
- [ ] Something visible behind each glass surface (not a flat gray box)
- [ ] Both themes checked
- [ ] Looked at screenshots, not only metrics: no flat gray or muddy glass, no awkward heading wraps; tint hue fits the backdrop

**Accessibility**
- [ ] Text 4.5:1 (large 3:1), icons/borders 3:1 on worst-case backdrop
- [ ] Focus visible everywhere; keyboard path complete; dialogs return focus
- [ ] Icon-only controls named; semantic elements used
- [ ] Drag gestures have tap and keyboard alternatives
- [ ] Reduced motion, high contrast, forced colors behave

**Responsive**
- [ ] Matrix widths pass; mobile layout is redesigned, not just shrunk
- [ ] Safe areas and `dvh` handled; no hover-only essentials

**Performance and compatibility**
- [ ] Blur radius within the budget; blurred area small; 3 or fewer simultaneous layers
- [ ] No animated blur; animations use transform/opacity
- [ ] `@supports` fallback is opaque and readable; `-webkit-` prefix present
- [ ] Checked Chromium, Safari/WebKit, Firefox where tools allow; noted gaps otherwise
- [ ] Scrolling stays smooth with glass over moving content (profile if tools exist)

**Verification honesty**
- [ ] Every "works" claim is backed by something you ran or inspected
- [ ] Limitations are listed in the report

## 3. Repair playbook

Use when the user has an existing glass UI that is slow, unreadable, or broken on mobile. Work in this order and re-measure after each step.

1. **Reproduce and baseline.** Capture screenshots at 320, 375, 768, 1280. Note console errors. Record which surfaces use `backdrop-filter`, their sizes, and blur values (search the stylesheets for `backdrop-filter`, `backdrop-blur`, `filter: blur`).
2. **Fix layout first.** Overflow, clipped nav, fixed widths: use `min-width: 0`, fluid widths, `max-width: 100%`, wrapped flex rows, `dvh`, safe-area padding. Layout breakage hides every other problem.
3. **Cut rendering cost.**
   - Reduce blur to 12-20px for chrome; never above ~28px.
   - Remove `backdrop-filter` from large or full-viewport surfaces, repeated list items, and anything nested inside another blurred element; replace with tint-only fills.
   - Remove animations on `backdrop-filter`/`filter`; animate `transform`/`opacity` instead.
   - Limit visible blurred layers to about 3; delete `will-change` that is always on.
4. **Fix contrast.** Run `scripts/contrast.py` for each text/surface pair against worst-case backdrops. Raise fill, add a scrim, or move text onto a solid backing until text reaches 4.5:1 and UI 3:1. Check muted text and placeholders. Prefer a moderate, hue-matched scrim over a heavy neutral one, then look at the screenshot: a metric-only fix can make the surface muddy.
5. **Fix hierarchy.** Convert tier-3 content (articles, tables, forms) to solid or near-solid surfaces; keep glass for chrome and controls.
6. **Fix fallbacks and preferences.** Add the opaque base background, `@supports` gate, `prefers-contrast`, `forced-colors`, and `prefers-reduced-motion` handling.
7. **Fix interaction.** Focus rings, 44px targets, hover-only features, dialog focus management, drag alternatives.
8. **Re-validate** with section 2 and report before/after: blur values, number of blurred layers, contrast ratios, and widths that now pass.

Report any remaining limitation, such as inability to profile on a real mid-range phone.

## 4. New-site starting defaults

When building a new site with no existing design system:
1. Choose a background with depth: a gradient plus imagery or content that scrolls, so glass has something to act on. Decide light or dark first.
2. Add the token block from `SKILL.md`; set theme overrides for the other mode.
3. Build the `.glass` primitive, then only these first: floating or top nav (tier 1), buttons (tier 1), one panel style (tier 2). Keep content areas solid.
4. Layout mobile first: single column, bottom or compact top nav, fluid type with `clamp()`. Add tablet and desktop enhancements where content needs them.
5. Add states, focus, and reduced-motion support before polishing visuals.
6. Validate across the matrix and the checklist.

## 5. Report template

Finish every task with a concise report:

```
Changed: <components/files>
Approach: <tokens, glass tiers used, notable decisions>
Verified: <what you ran: build, tests, screenshots at widths, keyboard pass, contrast estimates, reduced motion>
Not verified: <what you could not run, e.g. real iOS Safari, profiling on device>
Known limitations: <browser gaps, fallbacks that look different, trade-offs>
```
