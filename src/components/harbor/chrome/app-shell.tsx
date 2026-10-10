"use client";

// Harbor Web — application shell
// Owns: theme application, view stack rendering, sidebar visibility, search overlay, keyboard nav
import { useEffect, useMemo, useState } from "react";
import { useNav, useSettings, useSettingsInit, useAddonsInit, frameKey } from "@/lib/harbor/store";
import { applyTheme, decodeThemeShare, type ActiveTheme } from "@/lib/harbor/themes";
import { applyPosterLook } from "@/lib/harbor/poster-look";
import { decodeListShare, importSharedList, type SharedList } from "@/lib/harbor/lists";
import { installTvNavigation } from "@/lib/harbor/tvnav";
import { useAuth } from "@/lib/harbor/auth";
import { useCloudSync, installCloudSyncListeners } from "@/lib/harbor/cloud-sync";
import { usePwa } from "@/lib/harbor/pwa";
import { useHorseAccount } from "@/lib/harbor/horse-account";
import { ResetPasswordDialog } from "./reset-password-dialog";
import { openPairingReceiver } from "./device-pairing";
import { openQrApprove, QrApproveDialog } from "./qr-login";
import { AddonTransferDialogs, openTransferReceiver } from "./addon-transfer";
import { GlassDock } from "./glass-dock";
import { SideRail } from "./side-rail";
import { ArabicTextLayer } from "./ar-text-layer";
import { FloatingSearch, focusFloatingSearch } from "./floating-search";
import { CommandPalette, useCommandPalette } from "./command-palette";
import { ShortcutsOverlay, useShortcutsHelp } from "./shortcuts-overlay";
import { HomeView } from "../views/home-view";
import { DetailView } from "../views/detail-view";
import { LibraryView } from "../views/library-view";
import { AddonsView } from "../views/addons-view";
import { SettingsView } from "../views/settings-view";
import { DiscoverView } from "../views/discover-view";
import { CatalogsView } from "../views/catalogs-view";
import { MoviesView } from "../views/movies-view";
import { ShowsView } from "../views/shows-view";
import { AnimeView } from "../views/anime-view";
import { KidsView } from "../views/kids-view";
import { GridView } from "../views/grid-view";
import { LiveView } from "../views/live-view";
import { CalendarView } from "../views/calendar-view";
import { PickerOverlay } from "../views/picker-overlay";
import { PlayerOverlay } from "../player/player-overlay";
import { AddonDetail } from "../views/addon-detail";
import { WrappedView } from "../views/wrapped-view";
import { ListDetailView } from "../views/list-detail-view";
import { ArrowLeft, Palette, Check, X, ListVideo, ListPlus } from "lucide-react";
import { HorseMark } from "./brand";
import { RichBidi } from "../common/bidi";
import { useT } from "@/hooks/use-t";
import { useToast } from "@/hooks/use-toast";

function ViewFrame({ index }: { index: number }) {
  const stack = useNav((s) => s.stack);
  const frame = stack[index];
  const isTop = index === stack.length - 1;
  // Keep the two levels below top mounted for scroll memory; hide the rest
  const mounted = index >= stack.length - 3;

  if (!mounted) return null;
  return (
    <div
      className={isTop ? "contents" : "hidden"}
      data-frame={frameKey(frame)}
      aria-hidden={!isTop}
    >
      <FrameContent frame={frame} />
    </div>
  );
}

function FrameContent({ frame }: { frame: ReturnType<typeof useNav.getState>["stack"][0] }) {
  switch (frame.kind) {
    case "view":
      switch (frame.view) {
        case "home":
          return <HomeView />;
        case "discover":
          return <DiscoverView />;
        case "catalogs":
          return <CatalogsView />;
        case "movies":
          return <MoviesView />;
        case "shows":
          return <ShowsView />;
        case "anime":
          return <AnimeView />;
        case "kids":
          return <KidsView />;
        case "library":
          return <LibraryView />;
        case "addons":
          return <AddonsView />;
        case "wrapped":
          return <WrappedView />;
        case "settings":
          return <SettingsView />;
        case "live":
          return <LiveView />;
        case "calendar":
          return <CalendarView />;
        default:
          return <HomeView />;
      }
    case "detail":
      return <DetailView type={frame.type} id={frame.id} />;
    case "grid":
      return <GridView query={frame.query} title={frame.title} />;
    case "addon-detail":
      return <AddonDetail addonId={frame.addonId} />;
    case "list-detail":
      return <ListDetailView listId={frame.listId} />;
    default:
      return null;
  }
}

function BackButton() {
  const stack = useNav((s) => s.stack);
  const pop = useNav((s) => s.pop);
  const top = stack[stack.length - 1];
  if (stack.length <= 1 || top.kind === "view") return null;
  return (
    <button
      type="button"
      onClick={pop}
      className="fixed top-4 start-4 z-30 flex items-center gap-2 rounded-full bg-black/55 hover:bg-black/75 backdrop-blur-md border border-edge-soft px-4 py-2 text-sm text-ink transition-colors harbor-tv-focus"
      aria-label="Go back"
    >
      {/* RTL: the back affordance mirrors (arrow points forward-of-flow). */}
      <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
      Back
    </button>
  );
}

export function AppShell() {
  useSettingsInit();
  useAddonsInit();
  const tr = useT();
  const loadAuth = useAuth((s) => s.load);
  const authLoaded = useAuth((s) => s.loaded);
  const accountLoaded = useHorseAccount((s) => s.loaded);
  const loaded = useSettings((s) => s.loaded);
  const { toast } = useToast();
  useEffect(() => {
    loadAuth();
  }, [loadAuth]);

  // HORSE account: silent session restore at boot (hashed-DB session via
  // httpOnly cookie). /api/auth/me also transparently upgrades a legacy
  // stateless cookie and applies the sliding renewal. Guest data is never
  // touched when the session has expired — the card simply shows signed-out.
  useEffect(() => {
    void useHorseAccount.getState().load();
  }, []);

  // Hash deep links: #verify=<token> / #reset=<token> (email flows)
  useEffect(() => {
    const handleHash = () => {
      const h = window.location.hash || "";
      const verify = /^#verify=(.+)$/.exec(h);
      const reset = /^#reset=(.+)$/.exec(h);
      if (verify) {
        history.replaceState(null, "", window.location.pathname);
        void useHorseAccount
          .getState()
          .verifyEmail(decodeURIComponent(verify[1]))
          .then((r) => toast({ title: r.ok ? tr("accountVerifyDone") : r.error || tr("accountVerifyInvalid"), variant: r.ok ? "default" : "destructive" }));
      } else if (reset) {
        history.replaceState(null, "", window.location.pathname);
        const token = decodeURIComponent(reset[1]);
        window.dispatchEvent(new CustomEvent("harbor:reset-password", { detail: token }));
      }
    };
    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, [toast, tr]);

  // Cloud sync: pull once stores + auth state + account restore have hydrated,
  // then keep pushing mutations. Boot order matters: the account cookie makes
  // the SERVER switch the bucket to acct:<uid>, so /me must resolve first.
  useEffect(() => {
    if (!loaded || !authLoaded || !accountLoaded) return;
    void useCloudSync.getState().boot();
    return installCloudSyncListeners();
  }, [loaded, authLoaded, accountLoaded]);

  // PWA: service worker + install prompt capture
  useEffect(() => {
    void usePwa.getState().init();
  }, []);
  // Task 70: a #settings/... deep link opens the Settings view directly (the
  // shell inside applies the category + anchor from the same hash). Mounted
  // here — client-only — so SSR/hydration never sees a divergent nav stack.
  // The hashchange subscription keeps same-document deep links working when
  // the app is already open on another view.
  useEffect(() => {
    const openFromHash = () => {
      if (/^#settings(\/|$)/.test(window.location.hash)) {
        const top = useNav.getState().stack[useNav.getState().stack.length - 1];
        if (top.kind !== "view" || top.view !== "settings") {
          useNav.getState().resetTo({ kind: "view", view: "settings" });
        }
      }
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);
  const settings = useSettings((s) => s.settings);
  const stack = useNav((s) => s.stack);

  const top = stack[stack.length - 1];
  const overlayFrame = useMemo(() => {
    for (let i = stack.length - 1; i >= 0; i--) {
      const f = stack[i];
      if (f.kind === "player" || f.kind === "picker") return f;
    }
    return null;
  }, [stack]);
  const playerActive = overlayFrame?.kind === "player";
  const pickerActive = overlayFrame?.kind === "picker";
  /* Immersive detail (Task 30): the top CONTENT frame is a title detail page →
     hide the glass dock + floating search for an Apple-TV+-style full-screen
     view. Overlays (picker/player) sit on top and don't change the answer;
     the semi-transparent back button stays visible on detail pages. */
  const immersiveDetail = useMemo(() => {
    for (let i = stack.length - 1; i >= 0; i--) {
      const f = stack[i];
      if (f.kind === "player" || f.kind === "picker") continue;
      return f.kind === "detail";
    }
    return false;
  }, [stack]);
  const showChrome = !playerActive && !immersiveDetail;

  // Apply theme + kids mode — env carries the M3 scheme knobs (appearance /
  // contrast / kids re-seed) so dynamic color responds to settings live
  useEffect(() => {
    if (!loaded) return;
    applyTheme(settings.theme, {
      appearance: settings.appearance,
      contrast: settings.contrastLevel,
      kids: settings.kidsMode,
    });
    document.documentElement.dataset.kids = settings.kidsMode ? "on" : "off";
    // FIX 1 (Task 70 / audit F2): posterScale + posterRadius now reach the real
    // CSS consumers (.harbor-poster radius + card-img zoom) — written next to
    // the theme so the sliders respond live with everything else here.
    applyPosterLook(settings.posterScale, settings.posterRadius);
    // A1: the side rail is compact-only (auto-hide / always-visible). The old
    // data-rail="expanded" hook is gone — no content inset may ever depend on
    // a rail state (--side-safe-inset is constant, so nothing shifts).
  }, [settings, loaded]);

  // M3 adaptive + RTL: mirror the document for Arabic (logical CSS properties
  // across the app mirror automatically; the frame's physical classes use
  // start-/end- utilities so they follow dir).
  useEffect(() => {
    const rtl = /^ar(-|_|$)/i.test(settings.uiLanguage ?? "en");
    document.documentElement.lang = settings.uiLanguage || "en";
    document.documentElement.dir = rtl ? "rtl" : "ltr";
  }, [settings.uiLanguage]);

  // Global keyboard: browser back via Backspace/Alt+Left; floating search via
  // Ctrl/Cmd+K and "/"; palette via Ctrl/Cmd+Shift+P; help via "?"
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing =
        target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      if (typing) return;
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        useCommandPalette.getState().toggle();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        // Floating search is the primary search surface (instant results dropdown)
        e.preventDefault();
        focusFloatingSearch();
        return;
      }
      if (e.key === "/") {
        const playerUp = useNav.getState().stack.some((f) => f.kind === "player");
        if (playerUp) return;
        e.preventDefault();
        focusFloatingSearch();
        return;
      }
      if (e.key === "?") {
        // Shortcuts help — not while a player owns the keyboard (it has scoped keys)
        const playerUp = useNav.getState().stack.some((f) => f.kind === "player");
        if (playerUp) return;
        e.preventDefault();
        useShortcutsHelp.getState().toggle();
        return;
      }
      if (e.key === "Backspace" || (e.altKey && e.key === "ArrowLeft")) {
        if (useNav.getState().stack.length > 1) {
          e.preventDefault();
          useNav.getState().pop();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // TV spatial navigation: arrow keys rove focus; mouse use disables the mode
  useEffect(() => installTvNavigation(), []);

  // Hash-based deep link for meta pages (SEO/shareable) + demo player hook
  useEffect(() => {
    const applyHash = () => {
      const hash = window.location.hash;
      const detailMatch = hash.match(/^#\/detail\/(movie|series)\/(.+)$/);
      if (detailMatch) {
        useNav.getState().push({
          kind: "detail",
          type: detailMatch[1],
          id: decodeURIComponent(detailMatch[2]),
        });
        return;
      }
      // Demo playback entry (public Big Buck Bunny test HLS) — used for smoke-testing the player.
      // Optional overrides: #/demo-player?metaId=tt4154796&title=Avengers — lets the subtitle
      // pipeline (which requires a tt-prefixed meta id per addon idPrefixes) be QA'd without debrid.
      // QA harness: &src=<https-url> overrides the demo source (player stream QA across
      // source classes: direct MP4 / HLS / same-origin test assets). https-only by design;
      // the normal proxy/convert ladder still applies to whatever loads.
      const demoMatch = hash.match(/^#\/demo-player(?:\?(.*))?$/);
      if (demoMatch) {
        const demoParams = new URLSearchParams(demoMatch[1] ?? "");
        const metaId = /^tt\d+$/.test(demoParams.get("metaId") ?? "")
          ? (demoParams.get("metaId") as string)
          : "demo:bbb";
        const srcParam = demoParams.get("src") ?? "";
        // https:// (external) or same-origin absolute path incl. signed /api/media URLs
        const src = /^https:\/\//i.test(srcParam)
          ? srcParam
          : /^\/(?!\/)[\w./%=?&-]+$/i.test(srcParam)
            ? srcParam
            : "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";
        useNav.getState().push({
          kind: "player",
          payload: {
            url: src,
            title: demoParams.get("title") ?? "Big Buck Bunny (Demo)",
            type: "movie",
            metaId,
            episodeName: "Public demo stream",
          },
        });
      }
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  // Shared-theme deep link: #theme=hbtheme1.... → live preview + apply banner
  const [sharedTheme, setSharedTheme] = useState<ActiveTheme | null>(null);
  useEffect(() => {
    const check = () => {
      const m = window.location.hash.match(/^#theme=(.+)$/);
      if (m) {
        const decoded = decodeThemeShare(decodeURIComponent(m[1]));
        if (decoded) {
          setSharedTheme(decoded);
          applyTheme(decoded); // live preview until the user decides
        }
        // Strip the hash so reloads don't re-trigger
        history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    };
    check();
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, []);

  // Shared-list deep link: #list=hblist1.... → import offer banner (mirrors #theme= handler)
  const [sharedList, setSharedList] = useState<SharedList | null>(null);
  useEffect(() => {
    const check = () => {
      const m = window.location.hash.match(/^#list=(.+)$/);
      if (m) {
        const decoded = decodeListShare(decodeURIComponent(m[1]));
        if (decoded) setSharedList(decoded);
        // Strip the hash so reloads don't re-trigger
        history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    };
    check();
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, []);

  // Device-pairing deep link: #pair=XXXXXX — a phone scanned the QR shown on
  // a TV / laptop / iPad. Jump to Settings → Integrations and open the
  // receiver with the code pre-filled (one tap sends the saved debrid key).
  useEffect(() => {
    const check = () => {
      const m = window.location.hash.match(/^#pair=([A-Za-z0-9]{6})$/);
      if (m) {
        useNav.getState().push({ kind: "view", view: "settings" });
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("harbor:settings-section", { detail: "integrations" }));
          openPairingReceiver(m[1].toUpperCase());
        }, 60);
        // Strip the hash so reloads don't re-trigger
        history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    };
    check();
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, []);

  // QR sign-in deep link: #qrlogin=XXXXXX — a phone scanned the code shown on
  // a TV / laptop / tablet that isn't signed in. Open the approval dialog
  // (a logged-in account on THIS device is required to approve; the dialog
  // routes to sign-in otherwise). No view push — the dialog floats anywhere.
  useEffect(() => {
    const check = () => {
      // Accept raw XXXXXX and display XXX-XXX (users paste what they see)
      const m = window.location.hash.match(/^#qrlogin=([A-Za-z0-9](?:-?[A-Za-z0-9]){5})$/);
      if (m) {
        openQrApprove(m[1].replace(/-/g, "").toUpperCase());
        // Strip the hash so reloads don't re-trigger
        history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    };
    check();
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, []);

  // Addon-transfer deep link: #transfer=XXXXXXXXX — a phone scanned the QR
  // shown by another device's "Transfer addons" dialog. Open the receiver
  // with the code pre-filled (it auto-claims once).
  useEffect(() => {
    const check = () => {
      // Accept raw XXXXXXXXX and display XXX-XXX-XXX
      const m = window.location.hash.match(/^#transfer=([A-Za-z0-9](?:-?[A-Za-z0-9]){8})$/);
      if (m) {
        openTransferReceiver(m[1].replace(/-/g, "").toUpperCase());
        // Strip the hash so reloads don't re-trigger
        history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    };
    check();
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, []);

  // Scroll to top on frame change
  useEffect(() => {
    if (!playerActive) window.scrollTo({ top: 0 });
  }, [stack.length, playerActive]);

  return (
    <div className="min-h-screen flex flex-col bg-canvas text-ink">
      <div className="harbor-bg-layer" aria-hidden />
      {settings.theme.preset === "aurora" && <div className="harbor-bokeh" aria-hidden />}
      {/* Arabic UI text layer (no-op in English) — mounts once, owns DOM translation */}
      <ArabicTextLayer />
      {showChrome && <GlassDock />}
      {/* Large screens (≥1024px) swap the bottom dock for the floating side
          rail. Both nodes mount; the window-class CSS shows exactly one
          (display:none removes the other from the a11y tree + tab order).
          Same showChrome rules: neither renders in the player / immersive
          detail. */}
      {showChrome && <SideRail />}
      {/* NOTE: immersive detail renders its OWN back button (DetailView) so it
          also exists when a title is deep-linked as the root frame. */}
      {showChrome && <BackButton />}
      {/* NOTE: no top bar on scroll — the floating glass search bar is the only
          fixed element at the top, and the floating glass dock is the only
          fixed element at the bottom (auto-hides with scroll direction). */}
      {/* Full-width layout (sidebar removed): the glass dock floats over the
          content, so every scrollable page keeps bottom clearance via
          --nav-clearance (dock height + offset + spacing + safe area). */}
      <main
        className={`flex-1 w-full rail-main ${showChrome ? "pb-[var(--nav-clearance)]" : "pb-10"}`}
        role="main"
      >
        {/* Immersive detail supplies its own bottom padding; the dock is hidden,
            so --nav-clearance must NOT be applied there. */}
        {stack.map((_, i) => (
          <ViewFrame key={i} index={i} />
        ))}
        {top.kind === "view" && stack.length === 1 && (
          <footer className="mt-auto pt-12 pb-2 px-4 md:px-8 text-center text-[11px] text-ink-subtle">
            {/* Brand lockup: primary galloping-horse mark (64dp) + wordmark (28–32dp) */}
            <div className="mb-4 flex flex-col items-center justify-center gap-1.5">
              <HorseMark className="harbor-footer-logo text-ink-subtle" label="Horse logo" />
              <span className="harbor-footer-wordmark font-display font-bold tracking-tight text-ink-muted">
                Horse
              </span>
            </div>
            <p className="max-w-xl mx-auto">
              <RichBidi text={tr("footerTagline")} />
            </p>
            <p className="mt-1 max-w-xl mx-auto">
              <RichBidi text={tr("footerCredit")} />
            </p>
            <p className="mt-2 flex items-center justify-center gap-1.5 flex-wrap">
              {/* Official TMDB lockup, smaller than the Horse mark. Required
                  attribution sentence stays EXACTLY as TMDB mandates —
                  translate="no" keeps the Arabic DOM layer from touching it. */}
              <span className="inline-flex h-4 items-center rounded-[4px] bg-[#01b4e4] px-1.5 text-[9px] font-black tracking-wide text-[#0d253f]" aria-hidden>
                TMDB
              </span>
              <span translate="no">This product uses the TMDB API but is not endorsed or certified by TMDB.</span>
            </p>
          </footer>
        )}
      </main>
      {pickerActive && overlayFrame.kind === "picker" && (
        <PickerOverlay
          type={overlayFrame.type}
          id={overlayFrame.id}
          videoId={overlayFrame.videoId}
          season={overlayFrame.season}
          episode={overlayFrame.episode}
          runtimeSeconds={overlayFrame.runtimeSeconds}
        />
      )}
      {playerActive && overlayFrame.kind === "player" && (
        <PlayerOverlay payload={overlayFrame.payload} />
      )}
      <FloatingSearch />
      <CommandPalette />
      <ShortcutsOverlay />
      <ResetPasswordDialog />
      <QrApproveDialog />
      <AddonTransferDialogs />
      {sharedTheme && (
        <SharedThemeBanner
          theme={sharedTheme}
          onApply={() => {
            useSettings.getState().update({ theme: sharedTheme });
            setSharedTheme(null);
          }}
          onDismiss={() => {
            applyTheme(useSettings.getState().settings.theme); // restore persisted look
            setSharedTheme(null);
          }}
        />
      )}
      {sharedList && (
        <SharedListBanner
          shared={sharedList}
          offsetForTheme={!!sharedTheme}
          onAccept={() => {
            const list = importSharedList(sharedList);
            setSharedList(null);
            toast({
              title: `Imported ${list.items.length} ${list.items.length === 1 ? "item" : "items"}`,
              description: `“${list.name}” was added to your lists.`,
            });
            useNav.getState().push({ kind: "list-detail", listId: list.id });
          }}
          onDismiss={() => setSharedList(null)}
        />
      )}
    </div>
  );
}

// Bottom banner offering to keep a theme that arrived via a share link
function SharedThemeBanner({
  theme,
  onApply,
  onDismiss,
}: {
  theme: ActiveTheme;
  onApply: () => void;
  onDismiss: () => void;
}) {
  const name = theme.customName ?? (theme.preset === "custom" ? "Shared custom theme" : theme.preset);
  return (
    <div
      className={`fixed inset-x-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-[440px] z-50 rounded-2xl border border-edge-soft bg-elevated/95 backdrop-blur-xl shadow-2xl p-4 harbor-pop-in bottom-[calc(var(--nav-clearance)-0.5rem)]`}
      role="dialog"
      aria-label="Shared theme"
    >
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 shrink-0 rounded-xl bg-accent-soft flex items-center justify-center">
          <Palette className="w-4.5 h-4.5 text-accent" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">Shared theme: {name}</p>
          <p className="text-xs text-ink-subtle mt-0.5">Previewing now — keep it or restore your previous look.</p>
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={onApply}
              className="flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-1.5 text-xs font-bold text-black hover:brightness-110"
            >
              <Check className="w-3.5 h-3.5" /> Keep theme
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="flex items-center gap-1.5 rounded-lg bg-raised px-3.5 py-1.5 text-xs font-semibold text-ink-muted hover:text-ink"
            >
              <X className="w-3.5 h-3.5" /> Discard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Bottom banner offering to import a list that arrived via a share link
function SharedListBanner({
  shared,
  offsetForTheme,
  onAccept,
  onDismiss,
}: {
  shared: SharedList;
  offsetForTheme: boolean;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      className={`fixed inset-x-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-[440px] z-50 rounded-2xl border border-edge-soft bg-elevated/95 backdrop-blur-xl shadow-2xl p-4 harbor-pop-in bottom-[calc(var(--nav-clearance)-0.5rem)] ${
        offsetForTheme ? "!bottom-52" : ""
      }`}
      role="dialog"
      aria-label="Shared list"
    >
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 shrink-0 rounded-xl bg-accent-soft flex items-center justify-center">
          <ListVideo className="w-4.5 h-4.5 text-accent" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink truncate">Shared list: {shared.name}</p>
          <p className="text-xs text-ink-subtle mt-0.5">
            {shared.items.length} {shared.items.length === 1 ? "item" : "items"}
            {shared.description ? ` — ${shared.description}` : ""}
          </p>
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={onAccept}
              className="flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-1.5 text-xs font-bold text-black hover:brightness-110"
            >
              <ListPlus className="w-3.5 h-3.5" /> Add to my lists
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="flex items-center gap-1.5 rounded-lg bg-raised px-3.5 py-1.5 text-xs font-semibold text-ink-muted hover:text-ink"
            >
              <X className="w-3.5 h-3.5" /> Discard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

