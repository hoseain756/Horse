"use client";

// Harbor Web — Home view (port of Harbor home.tsx: hero carousel + CW + rails)
// Round-21: the top of the page (hero + continue watching) was rebuilt per the
// mobile reference spec — see views/home-hero.tsx and views/home-cw.tsx.
// Everything below (Top 10, addon rails, anchor rows) is unchanged.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNav, useSettings, useAddons, type AddonRecord } from "@/lib/harbor/store";
import type { Meta, CatalogDef } from "@/lib/harbor/types";
import { fetchCinemetaCatalog, fetchCatalog } from "@/lib/harbor/api";
import { Rail, RailSkeleton } from "../common/rail";
import { MetaCard } from "../common/meta-card";
import { PosterImage } from "../common/poster";
import { IntegrationsStrip } from "../chrome/integrations-strip";
import { HomeHero, type HeroSlide } from "./home-hero";
import { HomeCwSection } from "./home-cw";

// ---------- Home data rows ----------
type HomeRowData = {
  key: string;
  title: string;
  metas: Meta[];
  loading: boolean;
  type: string;
  catalogId: string;
};

const ANCHOR_ROWS: {
  key: string;
  title: string;
  type: "movie" | "series";
  catalog: string;
  genre?: string;
}[] = [
  { key: "trending-movies", title: "Trending Movies", type: "movie", catalog: "trailer" },
  { key: "in-theaters", title: "In Theaters", type: "movie", catalog: "top" },
  { key: "trending-series", title: "Trending Series", type: "series", catalog: "trailer" },
  { key: "popular-series", title: "Popular Series", type: "series", catalog: "imdbRating" },
  { key: "top-series", title: "Top Rated Series", type: "series", catalog: "top" },
];

export function HomeView() {
  const settings = useSettings((s) => s.settings);
  const addons = useAddons((s) => s.addons);
  const push = useNav((s) => s.push);
  const [heroSlides, setHeroSlides] = useState<HeroSlide[]>([]);
  const [heroLoading, setHeroLoading] = useState(true);
  const [top10, setTop10] = useState<Meta[]>([]);
  const [rows, setRows] = useState<HomeRowData[]>(() =>
    ANCHOR_ROWS.map((a) => ({
      key: a.key,
      title: a.title,
      metas: [],
      loading: true,
      type: a.type,
      catalogId: a.catalog,
    })),
  );

  // Hero + anchor rows
  useEffect(() => {
    let alive = true;
    const anchors = ANCHOR_ROWS;
    (async () => {
      const results = await Promise.allSettled([
        ...anchors.map((a) => fetchCinemetaCatalog(a.type, a.catalog, a.genre ? { genre: a.genre } : undefined)),
        // Top 10 pool: merge trending movies + series, dedupe
        fetchCinemetaCatalog("movie", "trailer"),
        fetchCinemetaCatalog("series", "trailer"),
      ]);
      if (!alive) return;
      // Hero pool: interleave first 3 of first 3 rows (spec: 8 featured items),
      // deduped by type:id — a title can surface in two anchor rows (e.g.
      // trending + in-theaters) and the hero must never feature it twice
      // (React keys + the slideshow math assume unique ids).
      const pool: Meta[] = [];
      const heroSeen = new Set<string>();
      for (const r of results.slice(0, 3)) {
        if (r.status !== "fulfilled") continue;
        for (const m of (r.value as Meta[]).slice(0, 3)) {
          const k = `${m.type}:${m.id}`;
          if (heroSeen.has(k)) continue;
          heroSeen.add(k);
          pool.push(m);
        }
      }
      setHeroSlides(pool.slice(0, 8).map((m) => ({ meta: m })));
      setHeroLoading(false);

      // Top 10: interleave trending movies/series, dedupe by id
      const topPool: Meta[] = [];
      const topSeen = new Set<string>();
      const movies = results[anchors.length]?.status === "fulfilled" ? (results[anchors.length] as PromiseFulfilledResult<Meta[]>).value : [];
      const series = results[anchors.length + 1]?.status === "fulfilled" ? (results[anchors.length + 1] as PromiseFulfilledResult<Meta[]>).value : [];
      const maxLen = Math.max(movies.length, series.length);
      for (let i = 0; i < maxLen && topPool.length < 10; i++) {
        for (const m of [movies[i], series[i]]) {
          if (m && !topSeen.has(m.id) && topPool.length < 10) {
            topSeen.add(m.id);
            topPool.push(m);
          }
        }
      }
      setTop10(topPool);

      setRows(
        anchors.map((a, i) => ({
          key: a.key,
          title: a.title,
          type: a.type,
          catalogId: a.catalog,
          metas: results[i].status === "fulfilled" ? (results[i] as PromiseFulfilledResult<Meta[]>).value : [],
          loading: false,
        })),
      );
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Addon catalog rows — deduped by normalized catalog name (port of Harbor mergeRows),
  // skipping rows that collide with the anchor rows above.
  const addonRows = useMemo(() => {
    const seenNames = new Set(ANCHOR_ROWS.map((a) => a.title.toLowerCase()));
    const rows: { addon: AddonRecord; catalog: CatalogDef }[] = [];
    for (const a of addons) {
      if (!a.enabled) continue;
      for (const c of a.manifest.catalogs ?? []) {
        if (rows.length >= 6) break;
        if (c.type !== "movie" && c.type !== "series") continue;
        if ((c.extra ?? []).some((e) => e.name === "search" && e.isRequired)) continue;
        const name = c.name.toLowerCase().trim();
        if (seenNames.has(name)) continue;
        seenNames.add(name);
        rows.push({ addon: a, catalog: c });
      }
      if (rows.length >= 6) break;
    }
    return rows;
  }, [addons]);

  const openMeta = useCallback(
    (m: Meta) => push({ kind: "detail", type: m.type, id: m.id }),
    [push],
  );

  return (
    <div className="home-void min-h-screen">
      {!settings.homeMode || settings.homeMode === "harbor" ? (
        <HomeHero slides={heroSlides} loading={heroLoading} />
      ) : (
        <div className="h-6" />
      )}

      <div className="home-below space-y-7">
        <HomeCwSection />

        <div className="px-4 md:px-8">
          <IntegrationsStrip />
        </div>

        {top10.length > 0 && <Top10Row metas={top10} onOpen={openMeta} />}

        {addonRows.map(({ addon, catalog }) => (
          <AddonRail
            key={`${addon.manifest.id}:${catalog.type}:${catalog.id}`}
            addon={addon}
            catalog={catalog}
            onOpen={openMeta}
          />
        ))}

        {rows.map((row) =>
          row.loading ? (
            <section key={row.key} aria-label={`${row.title} loading`}>
              <h2 className="md-title-medium text-ink px-4 md:px-8 mb-2.5">{row.title}</h2>
              <RailSkeleton />
            </section>
          ) : row.metas.length > 0 ? (
            <Rail key={row.key} title={row.title}>
              {row.metas.slice(0, 24).map((m) => (
                <div key={m.id} className="shrink-0 w-[120px] md:w-[138px]">
                  <MetaCard meta={m} onOpen={() => openMeta(m)} />
                </div>
              ))}
            </Rail>
          ) : null,
        )}

        {rows.every((r) => !r.loading && r.metas.length === 0) && heroSlides.length === 0 && (
          <div className="text-center py-24 px-4">
            <p className="text-ink-muted">Unable to load catalog. Check your connection.</p>
            <p className="text-sm text-ink-subtle mt-2">
              Cinemeta provides the default catalog; install addons for more.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Top 10 rank row (exact port of the Noor app rail) ----------
// Constants live in CSS (.home-top10-track) and mirror the app's
// top10_rail.dart: poster 120 @ .68, Roboto Black numerals = posterH*1.05
// with height .78, digit width .58em, ranks 1–9 tuck the poster at 65% of
// the digit width, rank 10 is a one-digit-wide tight lockup ("1" pulled 30%
// onto "0") tucked at 88%, canvas fill under a 2.5px white rim.
function Top10Row({ metas, onOpen }: { metas: Meta[]; onOpen: (m: Meta) => void }) {
  const language = useSettings((s) => s.settings.uiLanguage || "en");
  const ar = /^ar(?:-|_|$)/i.test(language);
  const ranked = metas.slice(0, 10);
  return (
    <section className="home-top10" dir={ar ? "rtl" : "ltr"} aria-labelledby="home-top10-title">
      <div className="home-top10-heading">
        <h2 id="home-top10-title" className="home-top10-title text-ink">
          {ar ? "أفضل 10 اليوم" : "Top 10 Today"}
        </h2>
      </div>
      <div className="home-top10-track harbor-scroll-x">
        {ranked.map((m, i) => {
          const isTen = i === 9;
          return (
            <div key={m.id} className={`home-top10-item${isTen ? " is-ten" : ""}`}>
              <span className="home-top10-num" aria-hidden="true">
                {/* Inner LTR shell: pins the digit ORDER ("10", never "01")
                    without flipping the outer box's logical-inset mapping —
                    exactly the app's Directionality-over-PositionedDirectional
                    layering. */}
                <span className="home-top10-num-inner">
                  {isTen ? (
                    <>
                      <span className="home-top10-digit d0">
                        <span className="glyph-fill">0</span>
                        <span className="glyph-stroke">0</span>
                      </span>
                      <span className="home-top10-digit d1">
                        <span className="glyph-fill">1</span>
                        <span className="glyph-stroke">1</span>
                      </span>
                    </>
                  ) : (
                    <span className="home-top10-digit">
                      <span className="glyph-fill">{i + 1}</span>
                      <span className="glyph-stroke">{i + 1}</span>
                    </span>
                  )}
                </span>
              </span>
              <button
                type="button"
                className="home-top10-sticker"
                onClick={() => onOpen(m)}
                aria-label={`${i + 1}. ${m.name}`}
              >
                <PosterImage src={m.poster} alt="" className="absolute inset-0" />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function AddonRail({
  addon,
  catalog,
  onOpen,
}: {
  addon: AddonRecord;
  catalog: CatalogDef;
  onOpen: (m: Meta) => void;
}) {
  const [metas, setMetas] = useState<Meta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchCatalog(addon, catalog)
      .then((m) => {
        if (alive) {
          setMetas(m);
          setLoading(false);
        }
      })
      .catch(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [addon, catalog]);

  if (!loading && metas.length === 0) return null;

  return (
    <Rail
      title={catalog.name}
      subtitle={addon.manifest.name}
      onViewAll={() =>
        useNav.getState().push({
          kind: "grid",
          title: catalog.name,
          query: { type: catalog.type, catalogId: catalog.id, addonId: addon.manifest.id },
        })
      }
    >
      {loading
        ? Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="harbor-skeleton rounded-xl shrink-0 w-[120px] md:w-[138px] aspect-[2/3]" />
          ))
        : metas.slice(0, 24).map((m) => (
            <div key={m.id} className="shrink-0 w-[120px] md:w-[138px]">
              <MetaCard meta={m} onOpen={() => onOpen(m)} />
            </div>
          ))}
    </Rail>
  );
}
