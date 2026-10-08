"use client";

// Harbor Web — Settings Quick Access hub (glass-dock redesign)
// Every content/config destination that used to live in the sidebar renders
// here as an M3 card grid at the TOP of Settings. Cards open the original
// route (stack push → PageHeader back returns to Settings). Edit mode allows
// reorder + hide, persisted via settings.hubOrder / settings.hubHidden.
// Badges: installed addon count, Trakt/Simkl link state, LIVE dot, library size.
import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  EyeOff,
  Eye,
  Puzzle,
  Radio,
  Check,
} from "lucide-react";
import { useNav, useSettings, installedAddons } from "@/lib/harbor/store";
import { useTrakt } from "@/lib/harbor/trakt";
import { useSimkl } from "@/lib/harbor/simkl";
import { getWatchlistLength } from "@/lib/harbor/cw";
import { hubEntriesFor, hubLabel, hubDesc, HUB_ENTRIES, type HubEntry } from "./nav-items";
import { cn } from "@/lib/utils";

function useBadges() {
  const traktAuth = useTrakt((s) => s.auth);
  const simklAuth = useSimkl((s) => s.auth);
  return useMemo(
    () => ({
      "addons-count": installedAddons().length,
      "trakt": !!traktAuth,
      "simkl": !!simklAuth,
      "live-dot": true,
      "library-count": getWatchlistLength(),
    }),
    [traktAuth, simklAuth],
  );
}

function Badge({ entry, badges, lang }: { entry: HubEntry; badges: Record<string, unknown>; lang: string }) {
  const ar = /^ar(-|_|$)/i.test(lang);
  switch (entry.badge) {
    case "addons-count": {
      const n = badges["addons-count"] as number;
      if (!n) return null;
      return (
        <span className="md-chip md-chip-selected shrink-0 !min-h-0 !px-2 !py-0.5 !text-[11px]">
          {n} {ar ? "إضافة" : n === 1 ? "addon" : "addons"}
        </span>
      );
    }
    case "trakt":
      return badges["trakt"] ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--md-sys-color-primary-container)] px-2 py-0.5 text-[10px] font-bold text-[var(--md-sys-color-on-primary-container)]">
          <Check className="w-3 h-3" /> Trakt
        </span>
      ) : null;
    case "simkl":
      return badges["simkl"] ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--md-sys-color-primary-container)] px-2 py-0.5 text-[10px] font-bold text-[var(--md-sys-color-on-primary-container)]">
          <Check className="w-3 h-3" /> Simkl
        </span>
      ) : null;
    case "live-dot":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--md-sys-color-error-container)] px-2 py-0.5 text-[10px] font-bold text-[var(--md-sys-color-on-error-container)]">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--md-sys-color-error)] opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--md-sys-color-error)]" />
          </span>
          LIVE
        </span>
      );
    case "library-count": {
      const n = badges["library-count"] as number;
      if (!n) return null;
      return (
        <span className="md-chip md-chip-selected shrink-0 !min-h-0 !px-2 !py-0.5 !text-[11px]">
          {n}
        </span>
      );
    }
    default:
      return null;
  }
}

function HubCard({
  entry,
  editing,
  first,
  last,
  onMove,
  onHide,
  lang,
}: {
  entry: HubEntry;
  editing: boolean;
  first: boolean;
  last: boolean;
  onMove: (dir: -1 | 1) => void;
  onHide: () => void;
  lang: string;
}) {
  const push = useNav((s) => s.push);
  const badges = useBadges();
  const Icon = entry.icon;
  const ar = /^ar(-|_|$)/i.test(lang);

  return (
    <div className="md-card-outlined md-state group relative flex flex-col rounded-[var(--md-sys-shape-corner-large)] p-3.5 text-start transition-shadow hover:shadow-[var(--md-sys-elevation-2)]">
      {editing && (
        <div className="absolute top-1.5 end-1.5 z-10 flex gap-0.5">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={first}
            className="md-icon-btn md-state !w-7 !h-7 !bg-[var(--md-sys-color-surface-container-high)] text-ink-muted hover:!text-ink disabled:opacity-30"
            aria-label={ar ? "تحريك لأعلى" : "Move earlier"}
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={last}
            className="md-icon-btn md-state !w-7 !h-7 !bg-[var(--md-sys-color-surface-container-high)] text-ink-muted hover:!text-ink disabled:opacity-30"
            aria-label={ar ? "تحريك لأسفل" : "Move later"}
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onHide}
            className="md-icon-btn md-state !w-7 !h-7 !bg-[var(--md-sys-color-surface-container-high)] text-ink-muted hover:!text-danger"
            aria-label={ar ? "إخفاء" : "Hide"}
          >
            <EyeOff className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={() => push({ kind: "view", view: entry.view })}
        className="harbor-tv-focus flex flex-1 flex-col items-start gap-2.5 text-start"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-accent-soft">
          <Icon className="h-5.5 w-5.5 text-accent" />
        </span>
        <span className="min-w-0 w-full">
          <span className="md-title-medium text-ink flex items-center gap-1.5 flex-wrap">
            {hubLabel(entry, lang)}
            {!editing && entry.id === "live" && <Badge entry={entry} badges={badges} lang={lang} />}
            {!editing && entry.id === "addons" && <Badge entry={entry} badges={badges} lang={lang} />}
            {!editing && entry.id === "library" && <Badge entry={entry} badges={badges} lang={lang} />}
          </span>
          <span className="md-body-small text-ink-muted mt-0.5 line-clamp-2">{hubDesc(entry, lang)}</span>
        </span>
      </button>
      {!editing && (entry.badge === "trakt" || entry.badge === "simkl") && (
        <span className="mt-2.5">
          <Badge entry={entry} badges={badges} lang={lang} />
        </span>
      )}
    </div>
  );
}

export function QuickAccess() {
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  const resetTo = useNav((s) => s.resetTo);
  const [editing, setEditing] = useState(false);
  const lang = settings.uiLanguage || "en";
  const ar = /^ar(-|_|$)/i.test(lang);

  const { visible, hidden } = hubEntriesFor(settings);

  const persist = (order: string[], hiddenIds: string[]) =>
    update({ hubOrder: order, hubHidden: hiddenIds });

  const move = (id: string, dir: -1 | 1) => {
    const ids = visible.map((e) => e.id);
    const i = ids.indexOf(id as never);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    persist(ids, settings.hubHidden);
  };

  const hide = (id: string) => {
    if (!settings.hubHidden.includes(id)) persist(settings.hubOrder, [...settings.hubHidden, id]);
  };
  const unhide = (id: string) => {
    persist(settings.hubOrder, settings.hubHidden.filter((h) => h !== id));
  };

  return (
    <section className="mb-8" aria-labelledby="quick-access-title">
      <div className="flex items-center justify-between gap-3 mb-3.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft">
            <Puzzle className="h-4.5 w-4.5 text-accent" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 id="quick-access-title" className="md-title-medium font-display font-bold text-ink">
              {ar ? "الوصول السريع" : "Quick Access"}
            </h2>
            <p className="md-body-small text-ink-muted truncate">
              {ar ? "كل الصفحات التي كانت في القائمة الجانبية" : "Everything that used to live in the sidebar"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          aria-pressed={editing}
          className={cn(
            "md-chip md-state harbor-tv-focus shrink-0 min-h-11",
            editing && "md-chip-selected",
          )}
        >
          {editing ? <Check className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          {editing ? (ar ? "تم" : "Done") : ar ? "تعديل" : "Edit"}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        {visible.map((entry, i) => (
          <HubCard
            key={entry.id}
            entry={entry}
            editing={editing}
            first={i === 0}
            last={i === visible.length - 1}
            onMove={(dir) => move(entry.id, dir)}
            onHide={() => hide(entry.id)}
            lang={lang}
          />
        ))}
        {editing &&
          hidden.map((entry) => {
            const Icon = entry.icon;
            return (
              <div
                key={entry.id}
                className="md-card-outlined flex flex-col items-start gap-2.5 rounded-[var(--md-sys-shape-corner-large)] p-3.5 opacity-60"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-raised">
                  <Icon className="h-5.5 w-5.5 text-ink-subtle" />
                </span>
                <span className="md-title-medium text-ink-muted">{hubLabel(entry, lang)}</span>
                <button
                  type="button"
                  onClick={() => unhide(entry.id)}
                  className="md-chip md-state mt-auto"
                >
                  <Eye className="w-3.5 h-3.5" /> {ar ? "إظهار" : "Show"}
                </button>
              </div>
            );
          })}
      </div>

      {editing && (
        <p className="md-body-small text-ink-subtle mt-3 flex items-center gap-2 flex-wrap">
          <Radio className="w-3.5 h-3.5" aria-hidden />
          {ar
            ? "استخدم الأسهم لإعادة الترتيب وعلامة العين للإخفاء — يتم الحفظ تلقائياً."
            : "Use the arrows to reorder and the eye to hide — changes save automatically."}
          <button
            type="button"
            onClick={() => {
              persist([], []);
              resetTo({ kind: "view", view: "settings" });
            }}
            className="md-chip md-state"
          >
            {ar ? "استعادة الافتراضي" : "Reset to default"}
          </button>
        </p>
      )}
    </section>
  );
}
