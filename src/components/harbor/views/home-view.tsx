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
      // Hero pool: interleave first 3 of first 3 rows (spec: 8 featured items)
      const pool: Meta[] = [];
      for (const r of results.slice(0, 3)) {
        if (r.status === "fulfilled") pool.push(...r.value.slice(0, 3));
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

      <div className="space-y-7">
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
              <h2 className="md-title-large text-ink px-4 md:px-8 mb-2.5">{row.title}</h2>
              <RailSkeleton />
            </section>
          ) : row.metas.length > 0 ? (
            <Rail key={row.key} title={row.title}>
              {row.metas.slice(0, 24).map((m) => (
                <div key={m.id} className="shrink-0 w-[130px] md:w-[150px]">
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

// ---------- Top 10 rank row (Harbor signature numerals) ----------
function Top10Row({ metas, onOpen }: { metas: Meta[]; onOpen: (m: Meta) => void }) {
  return (
    <section aria-label="Top 10 today">
      <div className="flex items-baseline justify-between px-4 md:px-8 mb-2.5">
        <h2 className="md-title-large text-ink">Top 10 Today</h2>
        <span className="md-body-small text-ink-subtle">trending on Stremio</span>
      </div>
      {/* Hover headroom: pt-3/-mt-1 keeps the 18px header→card gap while giving the hover lift room inside the scroll clip */}
      <div className="harbor-scroll-x overflow-x-auto flex items-end gap-1 px-4 md:px-8 pb-3 pt-3 -mt-1">
        {metas.map((m, i) => (
          <div key={m.id} className="shrink-0 flex items-end group/top10">
            <span
              aria-hidden
              className="font-display font-black leading-none select-none -mr-3 md:-mr-4 mb-1 text-transparent"
              style={{
                fontSize: "clamp(64px, 7vw, 110px)",
                WebkitTextStroke: "2.5px rgba(255,255,255,0.35)",
                transition: "color 0.25s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-accent-var)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "transparent")}
            >
              {i + 1}
            </span>
            <div className="w-[110px] md:w-[130px] relative z-10">
              <MetaCard meta={m} onOpen={() => onOpen(m)} />
            </div>
          </div>
        ))}
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
            <div key={i} className="harbor-skeleton rounded-xl shrink-0 w-[130px] md:w-[150px] aspect-[2/3]" />
          ))
        : metas.slice(0, 24).map((m) => (
            <div key={m.id} className="shrink-0 w-[130px] md:w-[150px]">
              <MetaCard meta={m} onOpen={() => onOpen(m)} />
            </div>
          ))}
    </Rail>
  );
}
