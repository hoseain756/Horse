"use client";

// Harbor Web — VS Code-style command palette (Round 8; Round 9 added remote
// content search: Cinemeta movies/series + installed addon catalogs, plus a
// "Search everywhere" hand-off to the floating search bar — the single
// search surface).
// Module-level zustand store so app-shell hotkeys can toggle it without prop drilling.
// Suppressed while a player overlay is active; always runs-and-closes.
import { useEffect, useMemo, useRef, useState } from "react";
import { create } from "zustand";
import {
  Search,
  X,
  Baby,
  Shuffle,
  CloudUpload,
  MonitorDown,
  Puzzle,
  Film,
  Tv,
  Loader2,
  House,
  Settings as SettingsIcon,
  SlidersHorizontal,
  Palette,
  Globe2,
  Plug,
  DatabaseBackup,
  Info,
} from "lucide-react";
import {
  useNav,
  useSettings,
  useAddons,
  installedAddons,
  type AddonRecord,
  type View,
} from "@/lib/harbor/store";
import type { Settings } from "@/lib/harbor/settings";
import { searchCinemeta, searchAddonCatalogs } from "@/lib/harbor/api";
import type { Meta } from "@/lib/harbor/types";
import { focusFloatingSearch } from "./floating-search";
import { NAV_ITEMS, navItemsFor, navLabel } from "./nav-items";
import { getWatchlist, getCwCards, getHistory } from "@/lib/harbor/cw";
import { THEME_PRESETS } from "@/lib/harbor/themes";
import { useCloudSync } from "@/lib/harbor/cloud-sync";
import { usePwa } from "@/lib/harbor/pwa";
import { PosterImage } from "../common/poster";
import { cn } from "@/lib/utils";

// ---------- Store ----------
type CommandPaletteState = {
  open: boolean;
  openPalette: () => void;
  close: () => void;
  toggle: () => void;
};

function playerOverlayActive(): boolean {
  if (typeof window === "undefined") return false;
  return useNav.getState().stack.some((f) => f.kind === "player");
}

export const useCommandPalette = create<CommandPaletteState>((set, get) => ({
  open: false,
  openPalette: () => {
    if (playerOverlayActive()) return; // never surface the palette over playback
    set({ open: true });
  },
  close: () => set({ open: false }),
  toggle: () => {
    if (get().open) {
      set({ open: false });
      return;
    }
    get().openPalette();
  },
}));

// ---------- Recents (localStorage, cap 5) ----------
const RECENTS_KEY = "harbor-web.palette.recents";

type RecentAction =
  | { t: "view"; view: string }
  | { t: "section"; section: string }
  | { t: "action"; id: "kids" | "shuffle" | "sync" | "search" | "install" }
  | { t: "detail"; type: string; id: string; name: string; poster?: string }
  | { t: "addon"; addonId: string; name: string; logo?: string };

type RecentRecord = {
  uid: string;
  label: string;
  group: string;
  thumb?: string;
  typeChip?: string;
  action: RecentAction;
};

function loadRecents(): RecentRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as RecentRecord[];
    return Array.isArray(arr) ? arr.filter((r) => r && r.uid && r.action).slice(0, 5) : [];
  } catch {
    return [];
  }
}

function saveRecent(rec: RecentRecord): RecentRecord[] {
  const list = loadRecents().filter((r) => r.uid !== rec.uid);
  const next = [rec, ...list].slice(0, 5);
  try {
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

// ---------- Item model ----------
type PaletteItem = {
  uid: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  group: string; // section tag shown on the row
  keywords?: string;
  thumb?: string;
  typeChip?: string;
  meta?: string;
  action?: RecentAction;
  accent?: boolean; // accent-colored label ("Search everywhere" row)
  kbd?: string; // right-aligned kbd hint chip ("Search everywhere" row)
  run: () => void;
};

const GROUP_ORDER: Record<string, number> = {
  Recent: 0,
  Navigate: 1,
  Settings: 2,
  Actions: 3,
  Library: 4,
  // Round 9: remote content groups (Addons renumbered 5 → 9 to stay last).
  Movies: 6,
  Series: 7,
  "Addon results": 8,
  Addons: 9,
};

// ---------- Fuzzy scoring (subsequence + consecutive/word-start bonuses) ----------
function fuzzyScore(query: string, text: string): number | null {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (!q) return 0;
  let score = 0;
  let searchFrom = 0;
  let prevIdx = -2;
  for (let qi = 0; qi < q.length; qi++) {
    const ch = q[qi];
    const idx = t.indexOf(ch, searchFrom);
    if (idx === -1) return null;
    let bonus = 1;
    if (idx === prevIdx + 1) bonus += 6; // consecutive match
    if (idx === 0 || /[\s\-_:.·/(\[]/.test(t[idx - 1])) bonus += 8; // word start
    score += bonus;
    prevIdx = idx;
    searchFrom = idx + 1;
  }
  // Slight preference for shorter targets
  score += Math.max(0, 8 - Math.floor(t.length / 12));
  return score;
}

// ---------- Item builders ----------
function buildNavItems(settings: Settings): PaletteItem[] {
  return navItemsFor(settings)
    .filter((i) => i.id !== "settings") // settings reachable via its section items
    .map((i) => ({
      uid: `nav:${i.id}`,
      icon: i.icon,
      label: navLabel(i, settings.navRenamed),
      group: "Navigate",
      keywords: i.label,
      action: { t: "view", view: i.id } as RecentAction,
      run: () => useNav.getState().push({ kind: "view", view: i.id }),
    }));
}

const SECTION_DEFS: {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords: string;
}[] = [
  { id: "basics", label: "Basics", icon: SettingsIcon, keywords: "general preferences home posters badges profile region" },
  { id: "player", label: "Player", icon: SlidersHorizontal, keywords: "playback streaming subtitles resume seek speed" },
  { id: "theme", label: "Theme", icon: Palette, keywords: "appearance colors fonts layout theme studio background" },
  { id: "language", label: "Language", icon: Globe2, keywords: "locale translation preferred languages subtitles" },
  { id: "integrations", label: "Integrations", icon: Plug, keywords: "trakt simkl debrid iptv api keys cloud connect" },
  { id: "data", label: "Data", icon: DatabaseBackup, keywords: "backup restore cloud sync storage export import" },
  { id: "about", label: "About", icon: Info, keywords: "version credits license info harbor" },
];

function buildSectionItems(): PaletteItem[] {
  return SECTION_DEFS.map((s) => ({
    uid: `section:${s.id}`,
    icon: s.icon,
    label: `Settings · ${s.label}`,
    group: "Settings",
    keywords: s.keywords,
    action: { t: "section", section: s.id } as RecentAction,
    run: () => {
      const nav = useNav.getState();
      const top = nav.top();
      if (top?.kind !== "view" || top.view !== "settings") {
        nav.push({ kind: "view", view: "settings" });
      }
      // The (possibly just-mounted) SettingsView listens for this event.
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent("harbor:settings-section", { detail: s.id }));
      }, 60);
    },
  }));
}

function buildActionItems(settings: Settings, canInstall: boolean): PaletteItem[] {
  const items: PaletteItem[] = [
    {
      uid: "act:kids",
      icon: Baby,
      label: "Toggle Kids Mode",
      group: "Actions",
      keywords: "kids parental children safe mode restriction lock",
      meta: settings.kidsMode ? "On" : "Off",
      action: { t: "action", id: "kids" },
      run: () => {
        const st = useSettings.getState();
        st.update({ kidsMode: !st.settings.kidsMode });
      },
    },
    {
      uid: "act:shuffle",
      icon: Shuffle,
      label: "Shuffle theme",
      group: "Actions",
      keywords: "random theme appearance colors preset surprise",
      action: { t: "action", id: "shuffle" },
      run: () => {
        const st = useSettings.getState();
        const current = st.settings.theme.preset;
        const pool = THEME_PRESETS.filter((p) => p.id !== current);
        const pick = pool[Math.floor(Math.random() * pool.length)] ?? THEME_PRESETS[0];
        if (!pick) return;
        // Persisted via the settings setter; the app-shell effect applies it live.
        st.update({
          theme: { ...st.settings.theme, preset: pick.id, customColors: null, customName: null },
        });
      },
    },
    {
      uid: "act:sync",
      icon: CloudUpload,
      label: "Sync now",
      group: "Actions",
      keywords: "cloud sync upload push backup server",
      action: { t: "action", id: "sync" },
      run: () => {
        void useCloudSync.getState().pushNow();
      },
    },
    {
      uid: "act:search",
      icon: Search,
      label: "Search content",
      group: "Actions",
      keywords: "find movies shows search ai titles",
      action: { t: "action", id: "search" },
      run: () => {
        // Single search surface: focus the floating glass bar.
        focusFloatingSearch();
      },
    },
  ];
  if (canInstall) {
    items.push({
      uid: "act:install",
      icon: MonitorDown,
      label: "Install app",
      group: "Actions",
      keywords: "pwa install add to home screen desktop app",
      action: { t: "action", id: "install" },
      run: () => {
        void usePwa.getState().promptInstall();
      },
    });
  }
  return items;
}

function buildLibraryItems(): PaletteItem[] {
  const out: PaletteItem[] = [];
  const seen = new Set<string>();
  const add = (type: string, id: string, name: string, poster?: string, extraKw?: string) => {
    if (!id || !name || seen.has(`${type}:${id}`)) return;
    seen.add(`${type}:${id}`);
    out.push({
      uid: `detail:${type}:${id}`,
      icon: type === "series" ? Tv : Film,
      label: name,
      group: "Library",
      keywords: extraKw,
      thumb: poster,
      typeChip: type,
      action: { t: "detail", type, id, name, poster },
      run: () => useNav.getState().push({ kind: "detail", type, id }),
    });
  };
  for (const w of getWatchlist()) add(w.type, w.id, w.name, w.poster, w.releaseInfo);
  for (const c of getCwCards()) add(c.type, c.id, c.name, c.poster, "continue watching");
  for (const h of getHistory().slice(0, 30)) add(h.type, h.id, h.name, h.poster, "history");
  return out;
}

// ---------- Round 9: remote content results ----------
function remoteMetaLine(m: Meta): string | undefined {
  const parts: string[] = [];
  if (m.releaseInfo) parts.push(m.releaseInfo); // "2016" / "2016–2019"
  if (m.imdbRating) parts.push(`★ ${m.imdbRating}`);
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

function buildRemoteItems(
  remote: { movies: Meta[]; series: Meta[]; addon: Meta[] },
  libraryKeys: Set<string>,
): PaletteItem[] {
  const out: PaletteItem[] = [];
  // Dedupe against the local library (type:id) — and, since `seen` accumulates,
  // addon results that duplicate a Cinemeta hit shown above them.
  const seen = new Set(libraryKeys);
  const push = (m: Meta, group: string, uid: string, keywords: string) => {
    if (!m?.id || !m.name) return;
    const key = `${m.type}:${m.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      uid,
      icon: m.type === "series" ? Tv : Film,
      label: m.name,
      group,
      keywords,
      thumb: m.poster,
      typeChip: m.type,
      meta: remoteMetaLine(m),
      action: { t: "detail", type: m.type, id: m.id, name: m.name, poster: m.poster },
      run: () => useNav.getState().push({ kind: "detail", type: m.type, id: m.id }),
    });
  };
  for (const m of remote.movies.slice(0, 6)) {
    push(m, "Movies", `cine:movie:${m.id}`, `${m.type} search remote content`);
  }
  for (const m of remote.series.slice(0, 6)) {
    push(m, "Series", `cine:series:${m.id}`, `${m.type} search remote content`);
  }
  for (const m of remote.addon.slice(0, 8)) {
    push(
      m,
      "Addon results",
      `cine:addon:${m.type}:${m.id}`,
      `${m.type} addon search remote content`,
    );
  }
  return out;
}

function buildAddonItems(addons: AddonRecord[]): PaletteItem[] {
  return addons.slice(0, 20).map((a) => ({
    uid: `addon:${a.manifest.id}`,
    icon: Puzzle,
    label: `Addon: ${a.manifest.name}`,
    group: "Addons",
    keywords: [a.manifest.types?.join(" "), a.manifest.description]
      .filter(Boolean)
      .join(" "),
    thumb: a.manifest.logo,
    typeChip: a.manifest.types?.[0],
    action: { t: "addon", addonId: a.manifest.id, name: a.manifest.name, logo: a.manifest.logo },
    run: () => useNav.getState().push({ kind: "addon-detail", addonId: a.manifest.id }),
  }));
}

function itemFromRecent(rec: RecentRecord, settings: Settings, canInstall: boolean): PaletteItem | null {
  const a = rec.action;
  switch (a.t) {
    case "view": {
      const nav = NAV_ITEMS.find((n) => n.id === a.view);
      const view = a.view as View;
      return {
        uid: rec.uid,
        icon: nav?.icon ?? House,
        label: rec.label,
        group: "Recent",
        keywords: nav?.label,
        action: a,
        run: () => useNav.getState().push({ kind: "view", view }),
      };
    }
    case "section": {
      const def = SECTION_DEFS.find((s) => s.id === a.section);
      return {
        uid: rec.uid,
        icon: def?.icon ?? SettingsIcon,
        label: rec.label,
        group: "Recent",
        keywords: def?.keywords,
        action: a,
        run: () => {
          const nav = useNav.getState();
          const top = nav.top();
          if (top?.kind !== "view" || top.view !== "settings") {
            nav.push({ kind: "view", view: "settings" });
          }
          window.setTimeout(() => {
            window.dispatchEvent(new CustomEvent("harbor:settings-section", { detail: a.section }));
          }, 60);
        },
      };
    }
    case "action": {
      if (a.id === "install" && !canInstall) return null;
      const built = buildActionItems(settings, canInstall).find((i) => i.uid === `act:${a.id}`);
      if (!built) return null;
      return { ...built, uid: rec.uid, group: "Recent" };
    }
    case "detail":
      return {
        uid: rec.uid,
        icon: a.type === "series" ? Tv : Film,
        label: rec.label,
        group: "Recent",
        thumb: rec.thumb ?? a.poster,
        typeChip: rec.typeChip ?? a.type,
        action: a,
        run: () => useNav.getState().push({ kind: "detail", type: a.type, id: a.id }),
      };
    case "addon":
      return {
        uid: rec.uid,
        icon: Puzzle,
        label: rec.label,
        group: "Recent",
        thumb: rec.thumb ?? a.logo,
        action: a,
        run: () => useNav.getState().push({ kind: "addon-detail", addonId: a.addonId }),
      };
  }
}

// ---------- Component ----------
export function CommandPalette() {
  const open = useCommandPalette((s) => s.open);
  const close = useCommandPalette((s) => s.close);
  if (!open) return null;
  // Remounts on every open → input/query/selection/recents reset naturally
  return <PaletteSurface onClose={close} />;
}

function PaletteSurface({ onClose }: { onClose: () => void }) {
  const settings = useSettings((s) => s.settings);
  const addons = useAddons((s) => s.addons);
  const canInstall = usePwa((s) => s.canInstall);

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [recents, setRecents] = useState<RecentRecord[]>(() => loadRecents());
  // Round 9: remote content search state (Cinemeta + installed addon catalogs)
  // and the query the last completed search was for (drives the "Search
  // everywhere" row so it only shows for a finished, empty current search).
  const [remoteResults, setRemoteResults] = useState<{
    movies: Meta[];
    series: Meta[];
    addon: Meta[];
  }>({ movies: [], series: [], addon: [] });
  const [searching, setSearching] = useState(false);
  const [doneQuery, setDoneQuery] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const runToken = useRef(0);

  // Focus + lock scroll while mounted (no state resets needed — fresh mount)
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.body.style.overflow = "";
    };
  }, []);

  // Round 9: debounced remote content search. The token is incremented on
  // every query change (and on unmount, below) so stale responses never reach
  // state. State resets use 0ms timeouts — the same setState-in-effect-safe
  // pattern the search overlay uses. Player overlays suppress the palette
  // entirely, so a remote search can never run during playback.
  useEffect(() => {
    const q = query.trim();
    const token = ++runToken.current; // invalidates any in-flight response
    if (q.length < 2) {
      const reset = setTimeout(() => {
        setRemoteResults({ movies: [], series: [], addon: [] });
        setSearching(false);
        setDoneQuery(null);
      }, 0);
      return () => clearTimeout(reset);
    }
    const spin = setTimeout(() => setSearching(true), 0);
    const t = setTimeout(() => {
      void Promise.allSettled([
        searchCinemeta(q),
        searchAddonCatalogs(installedAddons(), q),
      ]).then(([cine, addon]) => {
        if (token !== runToken.current) return; // stale response — ignore
        setRemoteResults({
          movies: cine.status === "fulfilled" ? cine.value.movies : [],
          series: cine.status === "fulfilled" ? cine.value.series : [],
          addon: addon.status === "fulfilled" ? addon.value : [],
        });
        setSearching(false);
        setDoneQuery(q);
      });
    }, 320);
    return () => {
      clearTimeout(spin);
      clearTimeout(t);
    };
  }, [query]);

  // Invalidate any in-flight remote search when the palette unmounts (closes).
  useEffect(() => {
    return () => {
      runToken.current += 1;
    };
  }, []);

  // Full command pool (only needed when filtering)
  const pool = useMemo<PaletteItem[]>(
    () => [
      ...buildNavItems(settings),
      ...buildSectionItems(),
      ...buildActionItems(settings, canInstall),
      ...buildLibraryItems(),
      ...buildAddonItems(addons),
    ],
    [settings, canInstall, addons],
  );

  // Round 9: type:id keys of local library rows (library items store uid
  // `detail:{type}:{id}`), used to dedupe remote results against the library.
  const libraryKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const it of pool) {
      if (it.uid.startsWith("detail:")) keys.add(it.uid.slice("detail:".length));
    }
    return keys;
  }, [pool]);

  const itemsBase = useMemo<PaletteItem[]>(() => {
    const trimmed = query.trim();
    const q = trimmed.toLowerCase();
    if (!q) {
      // Empty query: recents first, then all navigation items. Recents reuse
      // the original item uids, so drop any nav item already shown as a recent
      // (duplicate React keys otherwise).
      const rec = recents
        .map((r) => itemFromRecent(r, settings, canInstall))
        .filter((i): i is PaletteItem => i !== null);
      const seen = new Set(rec.map((i) => i.uid));
      return [...rec, ...buildNavItems(settings).filter((i) => !seen.has(i.uid))];
    }
    const scored: { item: PaletteItem; score: number }[] = [];
    for (const item of pool) {
      let best = fuzzyScore(q, item.label);
      if (item.keywords) {
        const ks = fuzzyScore(q, item.keywords);
        if (ks !== null) best = best === null ? ks * 0.8 : Math.max(best, ks * 0.8);
      }
      if (best !== null) scored.push({ item, score: best });
    }
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const ga = GROUP_ORDER[a.item.group] ?? 9;
      const gb = GROUP_ORDER[b.item.group] ?? 9;
      if (ga !== gb) return ga - gb;
      return a.item.label.localeCompare(b.item.label);
    });
    const local = scored.map((s) => s.item);
    // Round 9: append remote content results after the local scored items.
    // Results are only stored when their response token was current, so they
    // always belong to the most recent completed search (typeahead-fresh).
    if (
      trimmed.length >= 2 &&
      remoteResults.movies.length +
        remoteResults.series.length +
        remoteResults.addon.length >
        0
    ) {
      return [...local, ...buildRemoteItems(remoteResults, libraryKeys)];
    }
    return local;
  }, [query, pool, recents, settings, canInstall, remoteResults, libraryKeys]);

  // Round 9: when a >= 2-char query matched nothing locally or remotely and
  // that search has finished, offer a hand-off to the floating search bar
  // instead of a dead end (replaces the "No matches" block).
  const searchEverywhereItem = useMemo<PaletteItem | null>(() => {
    const q = query.trim();
    if (q.length < 2 || searching || doneQuery !== q || itemsBase.length > 0) return null;
    return {
      uid: "cine:search-everywhere",
      icon: Search,
      label: `Search everywhere for “${q}”`,
      group: "Search",
      keywords: `${q} everywhere all sources remote search`,
      accent: true,
      kbd: "↵",
      // Order matters (runItem closes the palette before run()): dispatch
      // stores the pending prefill, THEN focus lands on the bar and consumes it.
      run: () => {
        window.dispatchEvent(new CustomEvent("harbor:prefill-search", { detail: q }));
        focusFloatingSearch();
      },
    };
  }, [query, searching, doneQuery, itemsBase]);

  const items = useMemo(
    () => (searchEverywhereItem ? [searchEverywhereItem, ...itemsBase] : itemsBase),
    [searchEverywhereItem, itemsBase],
  );

  const sel = Math.min(selected, Math.max(0, items.length - 1));

  // Keep the selected row in view
  useEffect(() => {
    document
      .getElementById(`harbor-palette-opt-${sel}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [sel, items]);

  const runItem = (item: PaletteItem) => {
    if (item.action) {
      setRecents(
        saveRecent({
          uid: item.uid,
          label: item.label,
          group: item.group,
          thumb: item.thumb,
          typeChip: item.typeChip,
          action: item.action,
        }),
      );
    }
    onClose();
    item.run();
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "p") {
      // Palette shortcut is now Ctrl/Cmd+Shift+P (Ctrl/Cmd+K belongs to the floating search)
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => (items.length ? Math.min(s + 1, items.length - 1) : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = items[sel];
      if (item) runItem(item);
    } else if (e.key === "Escape" || e.key === "Tab") {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex items-start justify-center bg-black/70 px-4 backdrop-blur-sm harbor-scroll"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onClick={onClose}
    >
      <div
        className="md-dialog mt-[12vh] w-full max-w-xl overflow-hidden harbor-pop-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input row */}
        <div className="flex items-center gap-3 border-b border-edge-soft px-4 py-3.5">
          <Search className="h-5 w-5 shrink-0 text-ink-subtle" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(0);
            }}
            onKeyDown={onInputKeyDown}
            placeholder="Type a command or search…"
            className="flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-subtle"
            aria-label="Command palette search"
            aria-controls="harbor-palette-list"
            aria-activedescendant={items.length > 0 ? `harbor-palette-opt-${sel}` : undefined}
          />
          {searching ? (
            <Loader2
              className="h-4 w-4 shrink-0 animate-spin text-accent"
              role="status"
              aria-label="Searching content"
            />
          ) : null}
          <kbd className="harbor-kbd">esc</kbd>
          <button
            type="button"
            onClick={onClose}
            className="md-state md-icon-btn harbor-tv-focus w-8! h-8! shrink-0"
            aria-label="Close command palette"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Results */}
        <div id="harbor-palette-list" role="listbox" aria-label="Commands" className="harbor-scroll harbor-palette-scroll p-2">
          {items.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <Search className="mx-auto mb-3 h-8 w-8 text-ink-subtle opacity-50" />
              <p className="text-sm text-ink-muted">No matches for “{query.trim()}”</p>
              <p className="mt-1 text-xs text-ink-subtle">
                Try “settings” or a title from your library
              </p>
            </div>
          ) : (
            items.map((item, i) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.uid}
                  id={`harbor-palette-opt-${i}`}
                  role="option"
                  aria-selected={i === sel}
                  aria-label={item.label}
                  onMouseEnter={() => setSelected(i)}
                  onClick={() => runItem(item)}
                  className={cn(
                    "md-state flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                    i === sel ? "bg-accent-soft text-ink" : "text-ink-muted",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.thumb ? (
                    <span className="relative block h-10 w-7 shrink-0 overflow-hidden rounded-md border border-edge-soft ring-1 ring-edge-soft">
                      <PosterImage
                        src={item.thumb}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      "truncate",
                      item.accent && "font-medium text-accent",
                    )}
                  >
                    {item.label}
                  </span>
                  {item.typeChip ? (
                    <span className="shrink-0 rounded-full border border-edge-soft px-2 py-0.5 text-[10px] uppercase tracking-wide text-ink-subtle">
                      {item.typeChip}
                    </span>
                  ) : null}
                  {item.meta ? (
                    <span className="shrink-0 text-[10px] font-semibold text-ink-subtle">
                      {item.meta}
                    </span>
                  ) : null}
                  <span className="ms-auto hidden shrink-0 text-[10px] uppercase tracking-wide text-ink-subtle sm:inline">
                    {item.group}
                  </span>
                  {item.kbd ? (
                    <kbd className="harbor-kbd ms-auto shrink-0 sm:ms-0">{item.kbd}</kbd>
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center gap-4 border-t border-edge-soft px-4 py-2 text-[10px] text-ink-subtle">
          <span className="flex items-center gap-1">
            <kbd className="harbor-kbd">↑</kbd>
            <kbd className="harbor-kbd">↓</kbd> navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="harbor-kbd">↵</kbd> select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="harbor-kbd">esc</kbd> close
          </span>
          <span className="hidden md:inline">≥2 chars searches Cinemeta + addons</span>
          <span className="ml-auto hidden items-center gap-1 sm:flex">
            <kbd className="harbor-kbd">ctrl</kbd>
            <kbd className="harbor-kbd">K</kbd> toggle
          </span>
        </div>
      </div>
    </div>
  );
}
