"use client";

import { useMemo, useState } from "react";
import {
  Check,
  Eye,
  EyeOff,
  MoveDown,
  MoveUp,
  Puzzle,
  Radio,
} from "lucide-react";
import { useNav, useSettings, installedAddons } from "@/lib/harbor/store";
import { useTrakt } from "@/lib/harbor/trakt";
import { useSimkl } from "@/lib/harbor/simkl";
import { getWatchlistLength } from "@/lib/harbor/cw";
import { hubEntriesFor, hubLabel, hubDesc, type HubEntry } from "./nav-items";
import { SearchHighlight } from "../settings/search-highlight";
import { cn } from "@/lib/utils";

function useBadges() {
  const traktAuth = useTrakt((s) => s.auth);
  const simklAuth = useSimkl((s) => s.auth);
  return useMemo(
    () => ({
      "addons-count": installedAddons().length,
      trakt: !!traktAuth,
      simkl: !!simklAuth,
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
      return <span className="qa-badge"><bdi>{n}</bdi> {ar ? "إضافة" : n === 1 ? "addon" : "addons"}</span>;
    }
    case "trakt":
      return badges.trakt ? <span className="qa-badge qa-badge-active"><Check aria-hidden /> <bdi dir="ltr">Trakt</bdi></span> : null;
    case "simkl":
      return badges.simkl ? <span className="qa-badge qa-badge-active"><Check aria-hidden /> <bdi dir="ltr">Simkl</bdi></span> : null;
    case "live-dot":
      return <span className="qa-badge qa-badge-live"><span className="qa-live-dot" aria-hidden />LIVE</span>;
    case "library-count": {
      const n = badges["library-count"] as number;
      if (!n) return null;
      return <span className="qa-badge"><bdi>{n}</bdi></span>;
    }
    default:
      return null;
  }
}

function matchesEntry(entry: HubEntry, lang: string, query: string): boolean {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return true;
  return [
    hubLabel(entry, lang),
    hubDesc(entry, lang),
    entry.labelEn,
    entry.labelAr,
    entry.descEn,
    entry.descAr,
    ...entry.keywordsEn,
    ...entry.keywordsAr,
  ].some((value) => value.toLocaleLowerCase().includes(q));
}

export function QuickAccess({ searchQuery = "" }: { searchQuery?: string }) {
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  const resetTo = useNav((s) => s.resetTo);
  const [editing, setEditing] = useState(false);
  const lang = settings.uiLanguage || "en";
  const ar = /^ar(-|_|$)/i.test(lang);
  const { visible, hidden } = hubEntriesFor(settings);
  const matchingVisible = visible.filter((entry) => matchesEntry(entry, lang, searchQuery));
  const matchingHidden = editing ? hidden.filter((entry) => matchesEntry(entry, lang, searchQuery)) : [];
  const badges = useBadges();

  const persist = (order: string[], hiddenIds: string[]) => update({ hubOrder: order, hubHidden: hiddenIds });
  const move = (id: string, dir: -1 | 1) => {
    const ids = visible.map((entry) => entry.id);
    const from = ids.indexOf(id as never);
    const to = from + dir;
    if (from < 0 || to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    persist(ids, settings.hubHidden);
  };
  const hide = (id: string) => {
    if (!settings.hubHidden.includes(id)) persist(settings.hubOrder, [...settings.hubHidden, id]);
  };
  const unhide = (id: string) => persist(settings.hubOrder, settings.hubHidden.filter((hiddenId) => hiddenId !== id));

  return (
    <section className="qa-section" aria-labelledby="quick-access-title">
      <div className="qa-heading">
        <span className="qa-heading-icon"><Puzzle aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <h2 id="quick-access-title">{ar ? "الوصول السريع" : "Quick access"}</h2>
          <p>{ar ? "انتقل مباشرةً إلى وجهاتك المفضلة في Horse" : "Go straight to your favorite Horse destinations"}</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing((value) => !value)}
          aria-pressed={editing}
          className={cn("qa-edit harbor-tv-focus", editing && "is-active")}
        >
          {editing ? <Check aria-hidden /> : <EyeOff aria-hidden />}
          {editing ? (ar ? "تم" : "Done") : ar ? "تعديل" : "Edit"}
        </button>
      </div>

      <div className="qa-list" role="list" aria-label={ar ? "وجهات التطبيق" : "App destinations"}>
        {matchingVisible.map((entry) => {
          const Icon = entry.icon;
          const fullIndex = visible.indexOf(entry);
          return (
            <div className="qa-entry" key={entry.id} role="listitem">
              <button
                type="button"
                onClick={() => useNav.getState().push({ kind: "view", view: entry.view })}
                aria-description={hubDesc(entry, lang)}
                title={hubDesc(entry, lang)}
                className="qa-entry-main harbor-tv-focus"
              >
                <span className="qa-entry-icon"><Icon aria-hidden /></span>
                <span className="qa-entry-copy">
                  <span className="qa-entry-title">
                    <span><SearchHighlight text={hubLabel(entry, lang)} query={searchQuery} /></span>
                    {entry.badge && <Badge entry={entry} badges={badges} lang={lang} />}
                  </span>
                </span>
              </button>
              {editing && (
                <div className="qa-entry-actions">
                  <button type="button" onClick={() => move(entry.id, -1)} disabled={fullIndex === 0} aria-label={ar ? "تحريك لأعلى" : "Move earlier"}>
                    <MoveUp aria-hidden />
                  </button>
                  <button type="button" onClick={() => move(entry.id, 1)} disabled={fullIndex === visible.length - 1} aria-label={ar ? "تحريك لأسفل" : "Move later"}>
                    <MoveDown aria-hidden />
                  </button>
                  <button type="button" onClick={() => hide(entry.id)} aria-label={ar ? "إخفاء" : "Hide destination"}>
                    <EyeOff aria-hidden />
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {matchingHidden.map((entry) => {
          const Icon = entry.icon;
          return (
            <div className="qa-entry qa-entry-hidden" key={entry.id} role="listitem">
              <div className="qa-entry-main" aria-disabled="true">
                <span className="qa-entry-icon"><Icon aria-hidden /></span>
                <span className="qa-entry-copy">
                  <span className="qa-entry-title"><span><SearchHighlight text={hubLabel(entry, lang)} query={searchQuery} /></span></span>
                </span>
              </div>
              <button type="button" className="qa-show" onClick={() => unhide(entry.id)}>
                <Eye aria-hidden /> {ar ? "إظهار" : "Show"}
              </button>
            </div>
          );
        })}

        {matchingVisible.length === 0 && matchingHidden.length === 0 && searchQuery.trim() && (
          <p className="qa-empty" role="listitem">{ar ? "لا توجد وجهات مطابقة لهذا البحث." : "No destinations match this search."}</p>
        )}
      </div>

      {editing && (
        <div className="qa-edit-note">
          <Radio aria-hidden />
          <p>{ar ? "رتّب الوجهات أو أخفِ ما لا تحتاج إليه. تُحفظ التغييرات تلقائياً." : "Reorder destinations or hide the ones you do not use. Changes save automatically."}</p>
          <button
            type="button"
            className="qa-reset harbor-tv-focus"
            onClick={() => {
              persist([], []);
              resetTo({ kind: "view", view: "settings" });
            }}
          >
            {ar ? "استعادة الافتراضي" : "Restore defaults"}
          </button>
        </div>
      )}
    </section>
  );
}
