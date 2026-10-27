# INTEGRATION NOTES — Glass Dock Flutter port → Noor

For Agent-4. Files: `dock_tab.dart` (model + order/filter/direction + active-tab
helpers) and `glass_dock.dart` (widget + `GlassDockScrollHide` mixin +
`glassDockSizing` resolver). Both are self-contained (flutter/material +
flutter/services only), `flutter analyze`-clean on Flutter 3.47.7 stable, and
covered by the scratch test suite used during the port (taps, scrub
entry/release/cancel, flick, RTL order, missing-active fallback, hidden
semantics, size ladder, pill matrix math).

Provenance: translated 1:1 from Harbor web `glass-dock.tsx` + `nav-items.tsx`
per Task 107-b REVIEW.md (MUST PORT list honored; web-only plumbing dropped as
classified there).

---

## 1. Mounting

Put the dock in the shell's `Stack`, pinned bottom-center (like Noor's current
`GlassNavigationBar` mount in `main_shell.dart`):

```dart
PositionedDirectional(
  start: 0, end: 0, bottom: 0,
  child: GlassDock(
    tabs: tabs,
    activeId: activeId,
    onTabSelected: (tab) => _selectTab(tab),   // ONE navigation commit
    languageCode: app.english ? 'en' : 'ar',   // or null → Directionality decides
    hidden: glassDockHidden,                   // scroll auto-hide (see §4)
    kidsZoom: app.kidsMode ? 1.08 : 1.0,       // web --nav-kids
  ),
)
```

The dock sizes itself (size ladder, safe area, bottom offset) and animates its
own hidden state (AnimatedSlide + AnimatedOpacity + IgnorePointer +
ExcludeSemantics, 350ms `Cubic(0.2,0,0,1)`). Do NOT wrap it in another
AnimatedSlide/Opacity pair — that would double-animate.

**Content clearance** (web `--nav-clearance`): add bottom padding to the page
content so nothing hides behind the dock:

```dart
final sizing = glassDockSizing(viewport: MediaQuery.sizeOf(context));
final clearance = sizing.contentClearance(safeBottom: MediaQuery.paddingOf(context).bottom);
// e.g. pad the IndexedStack/scrollables with EdgeInsets.only(bottom: clearance)
```

## 2. Tabs and activeId (Noor mapping)

Build the tab list with the explicit order arrays (visual order is
Settings|Kids|Anime|Home in BOTH languages — the `Row` follows the ambient
`Directionality`, so never reverse the array again for RTL):

```dart
// Harbor-identical set:
final tabs = dockTabsFor(kidsMode: app.kidsMode, hideAnime: app.hideAnime, rtl: !app.english);

// Noor set with Library: append a 5th tab, then order per direction:
final libraryTab = const DockTab(
  id: 'library', view: 'library',
  labelEn: 'My Library', labelAr: 'مكتبتي',
  iconOutline: Icons.video_library_outlined, iconFilled: Icons.video_library,
);
final pool = [...kDockTabs, libraryTab]; // then order with kDockOrderLtr/Rtl + kids/anime filters
```

`activeId` from Noor's shell: `MainShell._selected` maps to ids
`home/anime/kids/library/settings`. For deep pages, use the pure helpers:

```dart
final activeId = dockActiveTabId(stack.map((f) => f is ViewFrame
    ? DockNavFrame.ofView(f.view)
    : DockNavFrame.other()).toList(),
  extraViewIds: {'library': 'library'});
// Every non-dock view (catalogs, live TV, calendar, addons, stats, settings
// hub pages) maps to 'settings' → Settings stays lit, exactly like the web.
```

On tap/scrub-release the widget calls `onTabSelected(tab)` exactly once; hosts
usually `resetTo(tab.view)` (Noor: `setState(_selected = …)` + reveal chrome;
ignoring same-id taps is safe and matches the web `resetTo` no-op).

## 3. Pages that hide the dock (player / detail equivalent)

Noor pushes the player and detail pages as full-screen routes ON TOP of
`MainShell`, so the dock disappears automatically — nothing to do. If a page
inside the shell must suppress it instead, pass `hidden: true` (slides away,
ignores pointers, leaves the semantics tree) — the web `showChrome` rule.
The ≥1024px side-rail swap is a host concern (Noor already switches to its
tablet layout at ≥840 — gate the dock mount the same way).

## 4. Scroll auto-hide (web `window.scroll` replacement)

```dart
class _HomePageState extends State<HomePage> with GlassDockScrollHide {
  @override
  bool get dockAutoHide => app.dockAutoHide; // web settings.dockAutoHide, default true

  Widget build(context) => Stack(children: [
    NotificationListener<ScrollNotification>(      // around the PRIMARY scrollable
      onNotification: handleGlassDockScroll,
      child: ListView(...),
    ),
    GlassDock(hidden: glassDockHidden, ...),
  ]);
}
```

Hysteresis is identical to the web: hide on `y > 120 && dy > +4`, reveal on
`dy < -4 || y <= 120`. Call `revealGlassDock()` on tab switch. This can replace
the hand-rolled `_onScroll` hysteresis in `main_shell.dart`.

## 5. Deviations from the web (intentional, for Flutter idioms)

- `Listener`-based gesture instead of pointer capture + click: tap purity and
  drag-beyond-bounds behavior are preserved (Flutter routes later events along
  the down-time hit path); the hit area is the whole capsule (web: tabs +
  4px extender) — slightly more forgiving, never less.
- Press state layer + scale 0.96 replaces `.md-state`/`:active`; the outline
  icon's COLOR swap is instant while the 150ms outline↔filled cross-fade is
  animated (icons are font glyphs; web recolored currentColor smoothly).
- `saturate(1.35)` wraps blur + panel via `ColorFiltered` (no saturate in
  `ImageFilter`); panel colors are near-gray, so the overshoot is negligible.
- Outline/filled pairs use Material glyphs (`settings/child_care/auto_awesome/
  home` × outlined/filled) instead of lucide SVGs.
- `hidden` is a plain parameter (host-driven); the web's global scroll listener
  became the `GlassDockScrollHide` mixin; keyboard roving/TV focus rings,
  hover state layer, tooltips and the DOM measure/`data-ready` dev plumbing
  are DROPPED per REVIEW.md (the pill fades in on first measure — no flash).
- Light/kids glass tint variants were not ported (Noor is dark-only); the
  dark Harbor glass constants are grouped at the top of `glass_dock.dart` if
  a theme hook is ever wanted.
- Landscape width uses `min(0.7·w, 340)`; zoom/kids multipliers apply to
  height/tab/icon/width (offsets stay raw), matching the web token chain.
