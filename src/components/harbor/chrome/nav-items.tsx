"use client";

// Harbor Web — navigation items (ported from Harbor chrome/nav-items.tsx)
// NAV_ITEMS is the full registry of primary destinations. It feeds the command
// palette and (since the glass-dock redesign) the dock tabs + Settings hub.
import {
  House,
  Compass,
  LayoutGrid,
  Clapperboard,
  Tv,
  Baby,
  Sparkles,
  Radio,
  CalendarDays,
  Library,
  Puzzle,
  BarChart3,
  Settings,
} from "lucide-react";
import type { View } from "@/lib/harbor/store";

export type NavItem = {
  id: View;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

export const NAV_ITEMS: NavItem[] = [
  { id: "home", label: "Home", icon: House },
  { id: "discover", label: "Discover", icon: Compass },
  { id: "catalogs", label: "Catalogs", icon: LayoutGrid },
  { id: "movies", label: "Movies", icon: Clapperboard },
  { id: "shows", label: "Shows", icon: Tv },
  { id: "anime", label: "Anime", icon: Sparkles },
  { id: "kids", label: "Kids", icon: Baby },
  { id: "live", label: "Live TV", icon: Radio },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "library", label: "Library", icon: Library },
  { id: "addons", label: "Addons", icon: Puzzle },
  { id: "wrapped", label: "Wrapped", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
];

export function navItemsFor(settings: {
  navHidden: string[];
  navOrder: string[];
  navRenamed: Record<string, string>;
  hideContent: { anime: boolean; liveTv: boolean };
  kidsMode: boolean;
}): NavItem[] {
  const items = NAV_ITEMS.filter((item) => {
    if (settings.navHidden.includes(item.id)) return false;
    if (item.id === "anime" && settings.hideContent.anime) return false;
    if (item.id === "live" && settings.hideContent.liveTv) return false;
    if (item.id === "kids" && settings.kidsMode) return false;
    return true;
  });
  if (settings.navOrder.length === 0) return items;
  const ordered: NavItem[] = [];
  for (const id of settings.navOrder) {
    const item = items.find((i) => i.id === id);
    if (item) ordered.push(item);
  }
  for (const item of items) {
    if (!ordered.includes(item)) ordered.push(item);
  }
  return ordered;
}

export function navLabel(
  item: NavItem,
  renamed: Record<string, string>,
): string {
  return renamed[item.id] ?? item.label;
}

// ---------- Glass dock tabs (single config array — change order here only) ----------
export type DockTabId = "settings" | "kids" | "anime" | "home";

export type DockTab = {
  id: DockTabId;
  view: View;
  labelEn: string;
  labelAr: string;
  icon: React.ComponentType<{ className?: string; fill?: string; strokeWidth?: number }>;
};

export const DOCK_TABS: DockTab[] = [
  { id: "settings", view: "settings", labelEn: "Settings", labelAr: "الإعدادات", icon: Settings },
  { id: "kids", view: "kids", labelEn: "Kids", labelAr: "الأطفال", icon: Baby },
  { id: "anime", view: "anime", labelEn: "Anime", labelAr: "الأنمي", icon: Sparkles },
  { id: "home", view: "home", labelEn: "Home", labelAr: "الرئيسية", icon: House },
];

/** Explicit per-locale tab ORDER (config map — no hidden auto-reversal).
 *  The dock is a plain flex row inside the document direction, so the first
 *  array item lands on the visual START edge (left in LTR, right in RTL):
 *  - LTR `[settings, kids, anime, home]` → visual left→right: Settings, Kids, Anime, Home
 *  - RTL `[home, anime, kids, settings]` → first item (Home) at the visual RIGHT edge,
 *    visual left→right: Settings, Kids, Anime, Home
 *  Both produce the required on-screen order in BOTH languages:
 *  Settings | Kids | Anime | Home (Home at the far right). */
const DOCK_ORDER: Record<"ltr" | "rtl", DockTabId[]> = {
  ltr: ["settings", "kids", "anime", "home"],
  rtl: ["home", "anime", "kids", "settings"],
};

/** Document direction for a UI language — mirrors app-shell's dir logic. */
export function dockDirectionFor(uiLang?: string): "ltr" | "rtl" {
  return /^ar(-|_|$)/i.test(uiLang ?? "en") ? "rtl" : "ltr";
}

/** Dock tabs for the current settings + UI language: the explicit per-locale
 *  order above; Kids Mode keeps only Home + Kids in the same relative order
 *  (Settings stays behind the parent gate — stricter than the old sidebar);
 *  the optional "hide anime content" setting removes the Anime tab. */
export function dockTabsFor(
  settings: {
    kidsMode: boolean;
    hideContent: { anime: boolean; liveTv: boolean };
  },
  uiLang?: string,
): DockTab[] {
  const order = DOCK_ORDER[dockDirectionFor(uiLang)];
  const byId = new Map(DOCK_TABS.map((t) => [t.id, t]));
  const hidden = (id: DockTabId) =>
    (id === "anime" && settings.hideContent.anime) ||
    (settings.kidsMode && id !== "home" && id !== "kids");
  return order
    .map((id) => byId.get(id))
    .filter((t): t is DockTab => !!t && !hidden(t.id));
}

// ---------- Settings Quick Access hub ----------
// Every destination that used to live in the sidebar and is NOT a dock tab.
// `route` keeps the original in-app route (stack frame view id) so existing
// deep links, shortcuts and command-palette entries keep working.
export type HubEntryId =
  | "discover"
  | "catalogs"
  | "movies"
  | "shows"
  | "live"
  | "calendar"
  | "library"
  | "addons"
  | "wrapped";

export type HubBadge = "addons-count" | "trakt" | "simkl" | "live-dot" | "library-count";

export type HubEntry = {
  id: HubEntryId;
  view: View;
  labelEn: string;
  labelAr: string;
  descEn: string;
  descAr: string;
  keywordsEn: string[];
  keywordsAr: string[];
  icon: React.ComponentType<{ className?: string }>;
  badge?: HubBadge;
};

export const HUB_ENTRIES: HubEntry[] = [
  {
    id: "discover", view: "discover", labelEn: "Discover", labelAr: "استكشف",
    descEn: "Trending and top picks across movies & series",
    descAr: "الأكثر رواجاً والأفضل تقييماً في الأفلام والمسلسلات",
    keywordsEn: ["discover", "explore", "trending", "browse"],
    keywordsAr: ["استكشف", "اكتشف", "الرائج", "تصفح"],
    icon: Compass,
  },
  {
    id: "library", view: "library", labelEn: "Library", labelAr: "المكتبة",
    descEn: "Watchlist, continue watching and your collection",
    descAr: "قائمة المشاهدة ومتابعة المشاهدة ومجموعتك",
    keywordsEn: ["library", "watchlist", "collection", "saved"],
    keywordsAr: ["المكتبة", "قائمة المشاهدة", "المجموعة", "المحفوظات"],
    icon: Library,
    badge: "library-count",
  },
  {
    id: "movies", view: "movies", labelEn: "Movies", labelAr: "أفلام",
    descEn: "Popular, top rated and every movie genre",
    descAr: "الأكثر شعبية والأعلى تقييماً وكل تصنيفات الأفلام",
    keywordsEn: ["movies", "films", "cinema"],
    keywordsAr: ["أفلام", "فيلم", "سينما"],
    icon: Clapperboard,
  },
  {
    id: "shows", view: "shows", labelEn: "Shows", labelAr: "مسلسلات",
    descEn: "Popular series, top rated shows and genres",
    descAr: "أشهر المسلسلات والأعلى تقييماً وتصنيفاتها",
    keywordsEn: ["shows", "series", "tv"],
    keywordsAr: ["مسلسلات", "مسلسل", "برامج"],
    icon: Tv,
  },
  {
    id: "live", view: "live", labelEn: "Live TV", labelAr: "البث المباشر",
    descEn: "IPTV playlists and live channels",
    descAr: "قوائم IPTV والقنوات المباشرة",
    keywordsEn: ["live tv", "live", "iptv", "channels"],
    keywordsAr: ["البث المباشر", "مباشر", "قنوات", "آي بي تي في"],
    icon: Radio,
    badge: "live-dot",
  },
  {
    id: "calendar", view: "calendar", labelEn: "Calendar", labelAr: "التقويم",
    descEn: "Airing schedule for your series",
    descAr: "جدول عرض مسلسلاتك",
    keywordsEn: ["calendar", "schedule", "airing"],
    keywordsAr: ["التقويم", "الجدول", "مواعيد العرض"],
    icon: CalendarDays,
  },
  {
    id: "addons", view: "addons", labelEn: "Addons", labelAr: "الإضافات",
    descEn: "Install and manage catalog & stream addons",
    descAr: "تثبيت وإدارة إضافات الكتالوج والمصادر",
    keywordsEn: ["addons", "extensions", "plugins", "install"],
    keywordsAr: ["الإضافات", "إضافة", "إضافات", "تثبيت"],
    icon: Puzzle,
    badge: "addons-count",
  },
  {
    id: "catalogs", view: "catalogs", labelEn: "Catalogs", labelAr: "الكتالوجات",
    descEn: "Browse every catalog your addons provide",
    descAr: "تصفح كل الكتالوجات التي توفرها إضافاتك",
    keywordsEn: ["catalogs", "catalog", "browse addons"],
    keywordsAr: ["الكتالوجات", "كتالوج", "تصفح الإضافات"],
    icon: LayoutGrid,
  },
  {
    id: "wrapped", view: "wrapped", labelEn: "Wrapped", labelAr: "حصاد المشاهدة",
    descEn: "Your viewing stats and yearly highlights",
    descAr: "إحصاءات مشاهدتك وأبرز لحظات العام",
    keywordsEn: ["wrapped", "stats", "statistics", "history"],
    keywordsAr: ["حصاد المشاهدة", "إحصائيات", "السجل", "ملخص"],
    icon: BarChart3,
  },
];

/** Hub entries in the user's persisted order, minus the hidden ones.
 *  Hidden entries are appended (greyed) only while editing. */
export function hubEntriesFor(
  settings: { hubOrder: string[]; hubHidden: string[] },
): { visible: HubEntry[]; hidden: HubEntry[] } {
  const byId = new Map(HUB_ENTRIES.map((e) => [e.id, e]));
  const ordered: HubEntry[] = [];
  for (const id of settings.hubOrder) {
    const e = byId.get(id as HubEntryId);
    if (e) ordered.push(e);
  }
  for (const e of HUB_ENTRIES) {
    if (!ordered.includes(e)) ordered.push(e);
  }
  const hidden = ordered.filter((e) => settings.hubHidden.includes(e.id));
  const visible = ordered.filter((e) => !settings.hubHidden.includes(e.id));
  return { visible, hidden };
}

export function hubLabel(entry: HubEntry, lang: string): string {
  return /^ar(-|_|$)/i.test(lang) ? entry.labelAr : entry.labelEn;
}

export function hubDesc(entry: HubEntry, lang: string): string {
  return /^ar(-|_|$)/i.test(lang) ? entry.descAr : entry.descEn;
}

export function dockTabLabel(tab: DockTab, lang: string): string {
  return /^ar(-|_|$)/i.test(lang) ? tab.labelAr : tab.labelEn;
}
