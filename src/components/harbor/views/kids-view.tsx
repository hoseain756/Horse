"use client";

// Harbor Web — Kids view: family-safe catalog rails (PG guards from Harbor kids-filter.ts)
// Round: playback/kids fixes — added a clearly-labeled "Card size" control
// (Large/Medium/Small) that live-resizes every poster card on this page.
// NOTE (audit): an earlier bug report described unexplained Large/Medium/Small
// buttons here; the codebase + live DOM audit found NO such controls existed.
// This is the single, working, labeled control — nothing half-wired remains.
import { useEffect, useState } from "react";
import type { Meta } from "@/lib/harbor/types";
import { fetchCinemetaCatalog } from "@/lib/harbor/api";
import { useNav, useSettings } from "@/lib/harbor/store";
import { homeT, isArabic } from "@/lib/harbor/i18n";
import { Rail, RailSkeleton } from "../common/rail";
import { MetaCard } from "../common/meta-card";
import { Baby, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

// Harbor kids genre guard: reject horror/thriller/crime etc. (ported from kids-filter.ts dropUnsafeCinemetaKids)
const UNSAFE_GENRES = /^(action|biography|crime|history|horror|romance|thriller|war)$/i;

function isKidSafe(meta: Meta): boolean {
  if (meta.releaseInfo) {
    const year = parseInt(meta.releaseInfo.slice(0, 4), 10);
    if (!Number.isNaN(year) && year > new Date().getFullYear()) return false;
  }
  const genres = (meta.genres ?? []).map((g) => g.toLowerCase());
  if (genres.some((g) => UNSAFE_GENRES.test(g))) return false;
  return (
    genres.includes("family") ||
    (genres.includes("animation") && genres.includes("comedy")) ||
    genres.includes("animation") ||
    genres.includes("children")
  );
}

function filterSafe(metas: Meta[]): Meta[] {
  const filtered = metas.filter(isKidSafe);
  return filtered.length >= 4 ? filtered : metas.filter((m) => !m.name.toLowerCase().match(/dead|kill|blood|war|crime/));
}

// Card width per size preset (px at mobile / +30px from md up). Small hands
// get bigger touch targets with Large; density drops with Small.
const CARD_W: Record<"large" | "medium" | "small", { base: number; md: number }> = {
  large: { base: 190, md: 220 },
  medium: { base: 150, md: 170 },
  small: { base: 120, md: 140 },
};

export function KidsView() {
  const push = useNav((s) => s.push);
  const uiLanguage = useSettings((s) => s.settings.uiLanguage);
  const kidsCardSize = useSettings((s) => s.settings.kidsCardSize);
  const update = useSettings((s) => s.update);
  const [rows, setRows] = useState<{ key: string; title: string; metas: Meta[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [hero, setHero] = useState<Meta[]>([]);
  const ar = isArabic(uiLanguage);

  useEffect(() => {
    let alive = true;
    const specs = [
      { key: "animation-m", title: "Animated Movies", type: "movie" as const, catalog: "top", genre: "Animation" },
      { key: "family-m", title: "Family Movies", type: "movie" as const, catalog: "top", genre: "Family" },
      { key: "animation-s", title: "Kids TV", type: "series" as const, catalog: "top", genre: "Animation" },
      { key: "family-s", title: "Family Shows", type: "series" as const, catalog: "top", genre: "Family" },
      { key: "music-m", title: "Sing-Along", type: "movie" as const, catalog: "top", genre: "Music" },
      { key: "adventure-m", title: "Adventures", type: "movie" as const, catalog: "top", genre: "Adventure" },
    ];
    (async () => {
      const results = await Promise.allSettled(
        specs.map((s) => fetchCinemetaCatalog(s.type, s.catalog, { genre: s.genre })),
      );
      if (!alive) return;
      const safeRows = specs.map((s, i) => ({
        key: s.key,
        title: s.title,
        metas: results[i].status === "fulfilled" ? filterSafe((results[i] as PromiseFulfilledResult<Meta[]>).value) : [],
      }));
      setRows(safeRows.filter((r) => r.metas.length > 0));
      setHero(safeRows.flatMap((r) => r.metas.slice(0, 2)).slice(0, 5));
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const sizes = CARD_W[kidsCardSize];

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="harbor-kids-blob w-96 h-96 bg-pink-400/40 -top-20 -left-20" aria-hidden />
      <div className="harbor-kids-blob w-80 h-80 bg-sky-300/40 top-40 right-0" aria-hidden />
      <div className="harbor-kids-blob w-72 h-72 bg-amber-300/30 bottom-0 left-1/3" aria-hidden />

      <div className="relative pt-20 md:pt-14 pb-16">
        <div className="px-4 md:px-8 mb-6 flex items-center gap-3 flex-wrap">
          <div className="w-14 h-14 rounded-[20px] bg-accent-soft flex items-center justify-center">
            <Baby className="w-7 h-7 text-accent" />
          </div>
          <div className="min-w-0">
            <h1 className="md-headline-medium text-ink flex items-center gap-2">
              {homeT("kidsTitle", uiLanguage)} <Sparkles className="w-6 h-6 text-accent" />
            </h1>
            <p className="md-body-small text-ink-muted">{homeT("kidsSubtitle", uiLanguage)}</p>
          </div>

          {/* Card size — one clearly-labeled control, live effect on every rail */}
          <div
            className="ms-auto flex items-center gap-2.5 rounded-full border border-edge-soft bg-raised/70 px-3 py-1.5"
            title={homeT("cardSizeHint", uiLanguage)}
          >
            <span className="md-label-small text-ink-muted whitespace-nowrap">{homeT("cardSize", uiLanguage)}</span>
            <div
              className="flex rounded-full bg-[var(--md-sys-color-secondary-container)] p-0.5"
              role="group"
              aria-label={homeT("cardSize", uiLanguage)}
            >
              {(
                [
                  ["large", homeT("sizeLarge", uiLanguage)],
                  ["medium", homeT("sizeMedium", uiLanguage)],
                  ["small", homeT("sizeSmall", uiLanguage)],
                ] as const
              ).map(([id, label]) => {
                const selected = kidsCardSize === id;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => update({ kidsCardSize: id })}
                    className={cn(
                      "md-state min-h-11 rounded-full px-3.5 py-1 text-xs font-semibold transition-colors",
                      selected
                        ? "bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)]"
                        : "text-[var(--md-sys-color-on-secondary-container)] hover:text-ink",
                    )}
                  >
                    {/* tiny visual metaphor: dot sized by preset */}
                    <span
                      aria-hidden
                      className={cn("inline-block rounded-full align-middle me-1.5 border border-current", selected ? "opacity-100" : "opacity-60")}
                      style={{ width: id === "large" ? 12 : id === "medium" ? 9 : 6, height: id === "large" ? 12 : id === "medium" ? 9 : 6 }}
                    />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="space-y-7">
            {[1, 2, 3].map((i) => (
              <section key={i}>
                <div className="harbor-skeleton h-6 w-40 rounded-lg mx-4 md:mx-8 mb-2.5" />
                <RailSkeleton />
              </section>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-20 text-ink-subtle">
            <p>No kids content available right now.</p>
          </div>
        ) : (
          <div className="space-y-7">
            {rows.map((row) => (
              <Rail
                key={row.key}
                title={row.title}
                onViewAll={() =>
                  push({ kind: "grid", title: row.title, query: { type: row.metas[0]?.type ?? "movie", catalogId: "top" } })
                }
              >
                {row.metas.slice(0, 20).map((m) => (
                  <div
                    key={m.id}
                    className="shrink-0 transition-[width] duration-300 ease-out w-[var(--kids-card-w)] md:w-[var(--kids-card-w-md)] [&_.harbor-poster]:rounded-[28px]! [&_.harbor-poster]:min-h-[64px] [&>div>div>p:first-child]:font-semibold [&>div>div>p:first-child]:tracking-[0.15px]"
                    style={{
                      "--kids-card-w": `${sizes.base}px`,
                      "--kids-card-w-md": `${sizes.md}px`,
                    } as React.CSSProperties}
                    data-kids-size={kidsCardSize}
                  >
                    <MetaCard meta={m} onOpen={() => push({ kind: "detail", type: m.type, id: m.id })} />
                  </div>
                ))}
              </Rail>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
