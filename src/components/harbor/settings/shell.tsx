"use client";
// Harbor Web — Settings shell (Task 70 redesign, STEP 2 + STEP 4).
// Size-class layout per the principal-designer brief:
//   < 600   phone    : single column, home surface → drill-down per category
//   600–839 tablet   : same drill-down, content centered (≤720dp feel)
//   840–1599         : TWO-PANE list-detail (list 280–320dp, detail ≤880dp)
//   ≥ 1600 TV        : two-pane with ten-foot scale (72–80dp rows, big type)
// Deep links live in the page hash: `#settings/<category>` and
// `#settings/<category>/<settingKey>` — arrival scrolls to the row and paints
// a 2.4s highlight. The legacy `harbor:settings-section` event keeps working.
// Settings search indexes EVERY setting row (ar + en) and jumps to its anchor.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  ChevronLeft,
  Lock,
  Search,
  Settings as SettingsIcon,
  X,
} from "lucide-react";
import { useSettings } from "@/lib/harbor/store";
import { useT, type T as TFunc } from "@/hooks/use-t";
import { isArabic } from "@/lib/harbor/i18n";
import type { AppStringKey } from "@/lib/harbor/i18n";
import { hasParentPin, isParentUnlocked, verifyParentPin } from "@/lib/harbor/parent-pin";
import { UserChip } from "../chrome/account";
import { cn } from "@/lib/utils";

export type SettingsCatId =
  | "account" | "appearance" | "playback" | "subtitles"
  | "integrations" | "addons" | "kids" | "data" | "about";

export type SettingsCategory = {
  id: SettingsCatId;
  group: "general" | "content" | "system";
  icon: React.ComponentType<{ className?: string }>;
  labelKey: AppStringKey;
  summaryKey: AppStringKey;
  /** Lazy content factory — called only when the category renders. */
  content: () => React.ReactNode;
};

export type SettingsGroup = { id: SettingsCategory["group"]; labelKey: AppStringKey; ids: SettingsCatId[] };

/* --------------------------------------------------------------------------
 * Row index — every reachable setting row, for deep links + search.
 * ------------------------------------------------------------------------ */
type IndexEntry = { cat: SettingsCatId; key: string; labelKey: AppStringKey; kw?: string };

const ROW_INDEX: IndexEntry[] = [
  // playback
  { cat: "playback", key: "instantPlay", labelKey: "rowInstantPlay" },
  { cat: "playback", key: "autoPlayNextEpisode", labelKey: "rowAutoPlayNext" },
  { cat: "playback", key: "resumePlayback", labelKey: "rowResume" },
  { cat: "playback", key: "playerConfirmLeave", labelKey: "rowConfirmLeave" },
  { cat: "playback", key: "seekStep", labelKey: "rowSeekStep", kw: "seek arrows 10s قفز" },
  { cat: "playback", key: "proxy", labelKey: "rowProxy", kw: "cors media proxy وسيط" },
  { cat: "playback", key: "transcodeMode", labelKey: "rowTranscode", kw: "mkv hevc convert تحويل" },
  { cat: "playback", key: "videoFill", labelKey: "rowVideoFill", kw: "zoom fit fill" },
  { cat: "playback", key: "playerTheme", labelKey: "rowPlayerChrome" },
  { cat: "playback", key: "pickerLayout", labelKey: "rowPickerLayout" },
  { cat: "playback", key: "showQualityInfo", labelKey: "rowQualityInfo", kw: "codec 4k quality" },
  { cat: "playback", key: "playableOnly", labelKey: "rowPlayableOnly" },
  { cat: "playback", key: "preferH264", labelKey: "rowPreferH264", kw: "codec hevc h264" },
  { cat: "playback", key: "streamSort", labelKey: "streamSort", kw: "sort order ترتيب" },
  { cat: "playback", key: "p2p", labelKey: "rowP2p", kw: "torrent webtorrent تورنت" },
  // subtitles
  { cat: "subtitles", key: "preferredSubLangs", labelKey: "rowSubLangs", kw: "language عربي english" },
  { cat: "subtitles", key: "subtitlesOffByDefault", labelKey: "rowSubOff" },
  { cat: "subtitles", key: "subFontSize", labelKey: "rowSubSize", kw: "size caption حجم" },
  { cat: "subtitles", key: "subFontColor", labelKey: "subFontColor", kw: "color text لون" },
  { cat: "subtitles", key: "subBorderColor", labelKey: "subBorderColor", kw: "outline لون الحدود" },
  { cat: "subtitles", key: "subStyle", labelKey: "subStyle", kw: "shadow outline box ظل" },
  { cat: "subtitles", key: "subBackgroundOpacity", labelKey: "subBackground", kw: "opacity background خلفية" },
  { cat: "subtitles", key: "subBorderSize", labelKey: "subBorder", kw: "outline border حدود" },
  // appearance
  { cat: "appearance", key: "theme-preset", labelKey: "rowTheme", kw: "color preset سمة لون" },
  { cat: "appearance", key: "appearance", labelKey: "rowAppearanceMode", kw: "dark light داكن فاتح" },
  { cat: "appearance", key: "contrastLevel", labelKey: "rowContrast", kw: "contrast تباين" },
  { cat: "appearance", key: "uiLanguage", labelKey: "rowLanguage", kw: "arabic english عربي لغة rtl" },
  { cat: "appearance", key: "posterScale", labelKey: "rowPosterScale", kw: "poster size ملصق حجم" },
  { cat: "appearance", key: "posterRadius", labelKey: "rowPosterRadius", kw: "round corners زوايا" },
  { cat: "appearance", key: "showCardBadges", labelKey: "rowBadges", kw: "imdb rating badge شارة" },
  { cat: "appearance", key: "homeMode", labelKey: "rowHomeMode", kw: "hero classic الرئيسية" },
  { cat: "appearance", key: "dockAutoHide", labelKey: "rowDock", kw: "dock nav شريط" },
  { cat: "appearance", key: "railAutoHide", labelKey: "rowRail", kw: "side rail جانبي" },
  // kids
  { cat: "kids", key: "kidsMode", labelKey: "kidsModeRow", kw: "parental safe أطفال آمن" },
  { cat: "kids", key: "parentPin", labelKey: "rowPin", kw: "password lock رمز قفل" },
  { cat: "kids", key: "kidsCardSize", labelKey: "rowCardSize" },
  // data
  { cat: "data", key: "region", labelKey: "rowRegion", kw: "country country دولة" },
  { cat: "data", key: "export", labelKey: "exportBackupRow", kw: "backup harbx نسخة" },
  { cat: "data", key: "clear", labelKey: "rowClear", kw: "wipe reset مسح" },
  // account
  { cat: "account", key: "horse-account", labelKey: "catAccount", kw: "sign in register email دخول حساب" },
  { cat: "account", key: "cloudSync", labelKey: "rowCloudSync", kw: "sync account مزامنة" },
];

/* --------------------------------------------------------------------------
 * Small hooks
 * ------------------------------------------------------------------------ */
function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return match;
}

/** Legacy section ids → new categories (palette/integrations-strip/etc.). */
const LEGACY_MAP: Record<string, SettingsCatId> = {
  basics: "appearance",
  theme: "appearance",
  player: "playback",
  language: "subtitles",
  integrations: "integrations",
  data: "data",
  about: "about",
};

function parseHash(): { cat: SettingsCatId | null; key: string | null } {
  if (typeof window === "undefined") return { cat: null, key: null };
  // BARE `#settings` (no trailing category) = settings home. The anchor must
  // be `\/?$` — `^#settings(\/|$)` would swallow every `#settings/<cat>` link.
  if (/^#settings\/?$/i.test(window.location.hash)) return { cat: null, key: null };
  const m = /^#settings\/([a-z]+)(?:\/([a-z0-9-]+))?/i.exec(window.location.hash);
  if (!m) return { cat: null, key: null };
  return { cat: m[1] as SettingsCatId, key: m[2] ?? null };
}

/* --------------------------------------------------------------------------
 * PIN gate dialog
 * ------------------------------------------------------------------------ */
function PinDialog({
  onSubmit,
  onClose,
  tr,
}: {
  onSubmit: (pin: string) => Promise<boolean>;
  onClose: () => void;
  tr: TFunc;
}) {
  const [pin, setPin] = useState("");
  const [bad, setBad] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    const ok = await onSubmit(pin);
    setBusy(false);
    if (!ok) {
      setBad(true);
      setPin("");
      inputRef.current?.focus();
      setTimeout(() => setBad(false), 900);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={tr("kidsPinEnter")}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div
        className={cn(
          "w-full max-w-xs rounded-[var(--md-sys-shape-corner-extra-large)] border border-edge-soft bg-raised p-5 shadow-2xl transition-transform",
          bad && "animate-[harbor-shake_0.35s_ease]",
        )}
      >
        <div className="mb-3 flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft">
            <Lock className="h-5 w-5 text-accent" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="md-title-medium text-ink">{tr("kidsPinEnter")}</p>
            <p className="md-body-small text-ink-muted">{tr("kidsPinEnterDesc")}</p>
          </div>
        </div>
        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          dir="ltr"
          maxLength={8}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
          aria-label={tr("kidsPinEnter")}
          aria-invalid={bad}
          className={cn(
            "h-14 w-full rounded-[var(--md-sys-shape-corner-large)] border bg-background text-center font-mono text-2xl tracking-[0.5em] text-ink outline-none",
            bad ? "border-danger" : "border-edge-soft focus:border-accent",
          )}
          placeholder="••••"
        />
        {bad && <p className="mt-2 text-center md-body-small text-danger">{tr("kidsPinWrong")}</p>}
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onClose} className="md-chip md-state min-h-11 flex-1">
            {tr("cancel")}
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={pin.length < 4 || busy}
            className="md-chip md-chip-selected md-state min-h-11 flex-1 font-semibold disabled:opacity-40"
          >
            {tr("kidsUnlock")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
 * The shell
 * ------------------------------------------------------------------------ */
export function SettingsShell({
  categories,
  groups,
  home,
}: {
  categories: SettingsCategory[];
  groups: SettingsGroup[];
  /** Home surface content (Quick Access + anything else) shown at the root. */
  home?: React.ReactNode;
}) {
  const settings = useSettings((s) => s.settings);
  const tr = useT();
  const wide = useMediaQuery("(min-width: 840px)");
  const tv = useMediaQuery("(min-width: 1600px)");
  const rtl = isArabic(settings.uiLanguage);

  // SSR-safe: the hash is applied client-side only (in the effect below) —
  // initializing state from the hash here would hydrate-mismatch AND could
  // render a protected category before the settings store (and its PIN gate)
  // has loaded.
  const [cat, setCat] = useState<SettingsCatId | null>(null);
  const [anchorKey, setAnchorKey] = useState<string | null>(null);
  const [pendingProtected, setPendingProtected] = useState<{ cat: SettingsCatId; key: string | null } | null>(null);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  /* ---- deep links: hash + legacy event ---- */
  useEffect(() => {
    // Read the LIVE store inside handlers — a mount-time closure would pin
    // kidsMode to its initial value and let the PIN gate go stale.
    const kidsLocked = () => {
      const s = useSettings.getState().settings;
      return s.kidsMode && !isParentUnlocked();
    };
    const apply = () => {
      const { cat: hCat, key: hKey } = parseHash();
      // Bare `#settings` (no category) = go home — never a no-op, or a stale
      // category would survive a deep link that cleared the hash.
      if (!hCat) {
        if (/^#settings\/?$/i.test(window.location.hash)) {
          setCat(null);
          setAnchorKey(null);
          setQuery("");
          setSearchOpen(false);
        }
        return;
      }
      if (hCat === "kids" && kidsLocked()) {
        setPendingProtected({ cat: hCat, key: hKey });
        return;
      }
      setCat(hCat);
      setAnchorKey(hKey);
      setQuery("");
      setSearchOpen(false);
    };
    const onHash = () => apply();
    const onEvent = (e: Event) => {
      const legacy = (e as CustomEvent<string>).detail;
      const mapped = LEGACY_MAP[legacy];
      if (mapped) {
        if (mapped === "kids" && kidsLocked()) {
          setPendingProtected({ cat: mapped, key: null });
          return;
        }
        setCat(mapped);
        setAnchorKey(null);
      }
    };
    window.addEventListener("hashchange", onHash);
    window.addEventListener("harbor:settings-section", onEvent);
    apply(); // honor a hash present at mount
    return () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("harbor:settings-section", onEvent);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* keep the hash in sync when the user navigates in-UI.
   * cat → `#settings/<cat>`; internal back → bare `#settings` (a reload then
   * restores the Settings home instead of dropping out to the app home).
   * Non-settings hashes / plain URLs are left untouched. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    const isSettingsHash = /^#settings(\/|$)/i.test(hash);
    if (cat) {
      const next = `#settings/${cat}`;
      if (hash !== next) window.history.replaceState(null, "", next);
    } else if (isSettingsHash && hash !== "#settings") {
      window.history.replaceState(null, "", "#settings");
    }
  }, [cat]);

  /* Post-hydration lock check: if the settings store loads AFTER the mount
   * apply() ran (fresh load with #settings/kids + kidsMode already on), the
   * early pass saw defaults and opened the pane — re-lock as soon as the
   * live state says otherwise. */
  useEffect(() => {
    if (cat === "kids" && settings.kidsMode && !isParentUnlocked()) {
      setPendingProtected((p) => p ?? { cat: "kids", key: null });
    }
  }, [cat, settings.kidsMode]);

  /* arrival: scroll to the anchor row + highlight */
  useEffect(() => {
    if (!cat || !anchorKey) return;
    const t = setTimeout(() => {
      const el = document.getElementById(`set-${anchorKey}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("harbor-row-arrive");
        setTimeout(() => el.classList.remove("harbor-row-arrive"), 2600);
      }
      setAnchorKey(null);
    }, 120);
    return () => clearTimeout(t);
  }, [cat, anchorKey]);

  /* new category → top of page */
  useEffect(() => {
    if (cat) window.scrollTo({ top: 0 });
  }, [cat]);

  /* close search on outside tap */
  useEffect(() => {
    if (!searchOpen) return;
    const onDown = (e: PointerEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [searchOpen]);

  const go = useCallback(
    (id: SettingsCatId, key?: string | null) => {
      if (id === "kids" && settings.kidsMode && !isParentUnlocked()) {
        setPendingProtected({ cat: id, key: key ?? null });
        return;
      }
      setCat(id);
      setAnchorKey(key ?? null);
      setQuery("");
      setSearchOpen(false);
    },
    [settings.kidsMode],
  );

  const tryUnlock = useCallback(
    async (pin: string) => {
      const ok = await verifyParentPin(pin);
      if (ok && pendingProtected) {
        setCat(pendingProtected.cat);
        setAnchorKey(pendingProtected.key);
        setPendingProtected(null);
      }
      return ok;
    },
    [pendingProtected],
  );

  /* Cancel leaves the protected category too — otherwise the post-hydration
   * lock effect would immediately re-open the gate (cancel = leave). */
  const closeGate = useCallback(() => {
    setPendingProtected(null);
    setCat((c) => (c === "kids" ? null : c));
  }, []);

  /* ---- search across every row (ar + en + synonyms) ---- */
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const out: { entry: IndexEntry; hit: string }[] = [];
    for (const entry of ROW_INDEX) {
      const catDef = categories.find((c) => c.id === entry.cat);
      if (!catDef) continue;
      const label = tr(entry.labelKey).toLowerCase();
      const catLabel = tr(catDef.labelKey).toLowerCase();
      const kw = (entry.kw ?? "").toLowerCase();
      const hay = `${label} ${catLabel} ${kw}`;
      if (hay.includes(q)) out.push({ entry, hit: label });
      if (out.length >= 12) break;
    }
    return out;
  }, [query, categories, tr]);

  const SearchField = (
    <div ref={searchRef} className="relative">
      <div className="set-search">
        <Search className="h-4.5 w-4.5 shrink-0 text-ink-muted" aria-hidden />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSearchOpen(true);
          }}
          onFocus={() => setSearchOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setQuery("");
              setSearchOpen(false);
              (e.target as HTMLInputElement).blur();
            }
            if (e.key === "Enter" && results[0]) go(results[0].entry.cat, results[0].entry.key);
          }}
          placeholder={tr("setSearch")}
          aria-label={tr("setSearch")}
          role="combobox"
          aria-expanded={searchOpen && results.length > 0}
          aria-controls="settings-search-results"
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(""); setSearchOpen(false); }}
            aria-label={tr("cancel")}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-muted hover:text-ink"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
      {searchOpen && query.trim().length >= 2 && (
        <div
          id="settings-search-results"
          role="listbox"
          className="absolute inset-x-0 top-[calc(100%+6px)] z-40 max-h-80 overflow-y-auto rounded-[var(--md-sys-shape-corner-large)] border border-edge-soft bg-raised/95 p-1.5 shadow-2xl backdrop-blur-xl"
        >
          {results.length === 0 ? (
            <p className="px-3 py-4 text-center md-body-small text-ink-muted">
              {tr("setSearchEmpty", { q: query.trim() })}
            </p>
          ) : (
            results.map(({ entry, hit }) => {
              const catDef = categories.find((c) => c.id === entry.cat)!;
              const Icon = catDef.icon;
              return (
                <button
                  key={`${entry.cat}/${entry.key}`}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => go(entry.cat, entry.key)}
                  className="md-state flex w-full items-center gap-2.5 rounded-[var(--md-sys-shape-corner-medium)] px-2.5 py-2.5 text-start hover:bg-raised"
                >
                  <Icon className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate md-body-medium text-ink">{hit}</span>
                    <span className="block truncate md-body-small text-ink-muted">{tr(catDef.labelKey)}</span>
                  </span>
                  {rtl ? <ChevronLeft className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden /> : <ChevronRight className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );

  /* ---- category list (shared by home surface + two-pane list) ---- */
  const renderCategoryButton = (c: SettingsCategory, active: boolean) => {
    const Icon = c.icon;
    return (
      <button
        key={c.id}
        type="button"
        className="set-cat-item md-state harbor-tv-focus"
        data-active={active}
        onClick={() => go(c.id)}
        aria-current={active ? "page" : undefined}
      >
        <span className="set-cat-icon">
          <Icon className="h-5 w-5 text-accent" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block md-title-medium text-ink">{tr(c.labelKey)}</span>
          <span className="block truncate md-body-small text-ink-muted">{tr(c.summaryKey)}</span>
        </span>
        {rtl ? (
          <ChevronLeft className="h-5 w-5 shrink-0 text-ink-subtle" aria-hidden />
        ) : (
          <ChevronRight className="h-5 w-5 shrink-0 text-ink-subtle" aria-hidden />
        )}
      </button>
    );
  };

  const CategoryList = (
    <nav aria-label={tr("setCategoryList")} className="space-y-4">
      {groups.map((g) => (
        <div key={g.id}>
          <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-widest text-ink-subtle">
            {tr(g.labelKey)}
          </p>
          <div className="space-y-1">
            {g.ids
              .map((id) => categories.find((c) => c.id === id))
              .filter((c): c is SettingsCategory => !!c)
              .map((c) => renderCategoryButton(c, cat === c.id))}
          </div>
        </div>
      ))}
    </nav>
  );

  const activeDef = cat ? categories.find((c) => c.id === cat) : undefined;
  const ActiveIcon = activeDef?.icon;

  const detailHeader = activeDef && (
    <div className="mb-4 flex items-start gap-3">
      {ActiveIcon && (
        <span className="set-cat-icon mt-0.5">
          <ActiveIcon className="h-5.5 w-5.5 text-accent" aria-hidden />
        </span>
      )}
      <div className="min-w-0">
        <h2 className="md-headline-small font-display font-bold text-ink">{tr(activeDef.labelKey)}</h2>
        <p className="md-body-small text-ink-muted">{tr(activeDef.summaryKey)}</p>
      </div>
    </div>
  );

  /* ============================== RENDER ============================== */
  if (wide) {
    /* ---- TWO-PANE (≥840) — list never re-mounts, scroll persists ---- */
    return (
      <div className="set-shell pb-16" data-layout="panes" data-size={tv ? "tv" : "standard"}>
        <div className="set-pane-list flex flex-col gap-4 pe-1">
          <div className="flex items-center gap-2.5 px-1">
            <SettingsIcon className="h-5.5 w-5.5 text-accent" aria-hidden />
            <h1 className="md-headline-small font-display font-bold text-ink">{tr("settingsTitle")}</h1>
          </div>
          {SearchField}
          <div className="px-0.5">
            <UserChip variant="settings" />
          </div>
          {CategoryList}
        </div>
        <div className="set-pane-detail min-w-0 pt-1">
          {cat === null || !activeDef ? (
            home
          ) : (
            <div className="pt-20 md:pt-6">
              {detailHeader}
              {activeDef.content()}
            </div>
          )}
        </div>
        {pendingProtected && (
          <PinDialog tr={tr} onSubmit={tryUnlock} onClose={closeGate} />
        )}
      </div>
    );
  }

  /* ---- DRILL-DOWN (<840) — home surface or one category ---- */
  return (
    <div className="set-shell pb-16" data-layout="drill" data-size={tv ? "tv" : "standard"}>
      {cat === null || !activeDef ? (
        <>
          <div className="set-appbar">
            <SettingsIcon className="h-6 w-6 shrink-0 text-accent" aria-hidden />
            <h1 className="md-headline-small min-w-0 truncate font-display font-bold text-ink">{tr("settingsTitle")}</h1>
            <div className="ms-auto shrink-0">
              <UserChip variant="settings" />
            </div>
          </div>
          <div className="mb-5">{SearchField}</div>
          {home}
          <div className="mt-6">{CategoryList}</div>
        </>
      ) : (
        <>
          <div className="set-appbar">
            <button
              type="button"
              onClick={() => setCat(null)}
              aria-label={tr("back")}
              className="md-icon-btn harbor-tv-focus flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-raised"
            >
              {rtl ? <ChevronRight className="h-5.5 w-5.5" aria-hidden /> : <ChevronLeft className="h-5.5 w-5.5" aria-hidden />}
            </button>
            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 md-title-medium">
              <button type="button" onClick={() => setCat(null)} className="shrink-0 text-ink-muted hover:text-ink">
                {tr("settingsTitle")}
              </button>
              <span aria-hidden className="text-ink-subtle">/</span>
              <span className="truncate font-bold text-ink">{tr(activeDef.labelKey)}</span>
            </nav>
            {activeDef.id === "kids" && hasParentPin() && (
              <span className="ms-auto flex shrink-0 items-center gap-1 rounded-full border border-edge-soft px-2 py-1 text-[10px] font-semibold text-ink-muted">
                <Lock className="h-3 w-3" aria-hidden />
                {tr("kidsPinProtected")}
              </span>
            )}
          </div>
          {detailHeader}
          {activeDef.content()}
        </>
      )}
      {pendingProtected && (
        <PinDialog tr={tr} onSubmit={tryUnlock} onClose={closeGate} />
      )}
    </div>
  );
}
