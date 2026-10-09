"use client";

// Harbor Web — shared section-rails view used by Movies / Shows / Anime / Discover
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { Meta } from "@/lib/harbor/types";
import { fetchCinemetaCatalog, fetchCatalog } from "@/lib/harbor/api";
import { useAddons, useNav, useSettings } from "@/lib/harbor/store";
import { Rail, RailSkeleton } from "../common/rail";
import { MetaCard } from "../common/meta-card";
import { HeroSpotlight } from "./hero-spotlight";

// ---------- Rail entrance reveal (shared IntersectionObserver, round 6) ----------
// One observer for every rail on the page: each section gets .harbor-stagger the first
// time it scrolls into view (threshold 0.08, once). Reduced-motion users skip it entirely.
let railRevealObserver: IntersectionObserver | null = null;
const railRevealCallbacks = new WeakMap<Element, () => void>();

function ensureRailRevealObserver(): IntersectionObserver | null {
  if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") return null;
  if (railRevealObserver) return railRevealObserver;
  railRevealObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        railRevealCallbacks.get(entry.target)?.();
        railRevealCallbacks.delete(entry.target);
        railRevealObserver?.unobserve(entry.target);
      }
    },
    { threshold: 0.08 },
  );
  return railRevealObserver;
}

function useRailReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = ensureRailRevealObserver();
    if (!observer) return;
    railRevealCallbacks.set(el, () => el.classList.add("harbor-stagger"));
    observer.observe(el);
    return () => {
      railRevealCallbacks.delete(el);
      observer.unobserve(el);
    };
  }, []);
  return ref;
}

/** Applies the staggered rise-in to its child the first time it enters the viewport. */
function RailReveal({ index, children }: { index: number; children: ReactNode }) {
  const ref = useRailReveal<HTMLDivElement>();
  return (
    <div ref={ref} style={{ "--stagger-i": index % 8 } as CSSProperties}>
      {children}
    </div>
  );
}

export type SectionSpec = {
  key: string;
  title: string;
  type: "movie" | "series" | string;
  catalog: string;
  genre?: string;
};

export function SectionRails({
  specs,
  hero,
  addonsFirst = false,
}: {
  specs: SectionSpec[];
  hero?: { type: "movie" | "series"; catalogs: string[] };
  addonsFirst?: boolean;
}) {
  const addons = useAddons((s) => s.addons);
  const settings = useSettings((s) => s.settings);
  const push = useNav((s) => s.push);
  const [rows, setRows] = useState<Record<string, Meta[]>>({});
  const [loading, setLoading] = useState(true);
  const [heroSlides, setHeroSlides] = useState<Meta[]>([]);

  const addonsDone = useAddons((s) => s.loaded);

  useEffect(() => {
    if (!addonsDone) return;
    let alive = true;
    const reset = setTimeout(() => {
      setLoading(true);
      setRows({});
      setHeroSlides([]);
    }, 0);
    (async () => {
      // Hero pool
      if (hero) {
        const heroResults = await Promise.allSettled(
          hero.catalogs.map((c) => fetchCinemetaCatalog(hero.type, c)),
        );
        if (!alive) return;
        const pool: Meta[] = [];
        for (const r of heroResults) {
          if (r.status === "fulfilled") pool.push(...r.value.slice(0, 3));
        }
        setHeroSlides(pool.slice(0, 5));
      }
      // Rows
      const results = await Promise.allSettled(
        specs.map((s) => fetchCinemetaCatalog(s.type as "movie" | "series", s.catalog, s.genre ? { genre: s.genre } : undefined)),
      );
      if (!alive) return;
      const map: Record<string, Meta[]> = {};
      specs.forEach((s, i) => {
        map[s.key] = results[i].status === "fulfilled" ? (results[i] as PromiseFulfilledResult<Meta[]>).value : [];
      });
      setRows(map);
      setLoading(false);
    })();
    return () => {
      alive = false;
      clearTimeout(reset);
    };
  }, [addonsDone, JSON.stringify(specs), JSON.stringify(hero)]);

  const addonCatalogRows = addonsFirst
    ? addons
        .filter((a) => a.enabled)
        .flatMap((a) =>
          (a.manifest.catalogs ?? [])
            .filter(
              (c) =>
                c.type !== "movie" &&
                c.type !== "series" &&
                !(c.extra ?? []).some((e) => e.name === "search" && e.isRequired),
            )
            .slice(0, 2)
            .map((c) => ({ addon: a, catalog: c })),
        )
        .slice(0, 4)
    : [];

  return (
    <div className="pt-4 pb-10">
      {hero && heroSlides.length > 0 && <HeroSpotlight metas={heroSlides} />}
      <div className="space-y-7 mt-4">
        {addonCatalogRows.map(({ addon, catalog }, i) => (
          <AddonCatalogRail
            key={`${addon.manifest.id}:${catalog.type}:${catalog.id}`}
            addon={addon}
            catalog={catalog}
            index={i}
          />
        ))}
        {specs.map((spec, i) => {
          const hasData = (rows[spec.key]?.length ?? 0) > 0;
          const isLoading = loading && !rows[spec.key];
          if (!isLoading && !hasData) return null; // keep dedupe/empty behavior identical
          return (
            <RailReveal key={spec.key} index={addonCatalogRows.length + i}>
              {isLoading ? (
                <section>
                  <h2 className="md-title-medium text-ink px-4 md:px-8 mb-2.5">{spec.title}</h2>
                  <RailSkeleton />
                </section>
              ) : (
                <Rail
                  title={spec.title}
                  onViewAll={() =>
                    push({
                      kind: "grid",
                      title: spec.title,
                      query: { type: spec.type, catalogId: spec.catalog, extra: spec.genre ? { genre: spec.genre } : undefined },
                    })
                  }
                >
                  {(rows[spec.key] ?? []).slice(0, 24).map((m) => (
                    <div key={m.id} className="shrink-0 w-[120px] md:w-[138px]">
                      <MetaCard meta={m} onOpen={() => push({ kind: "detail", type: m.type, id: m.id })} />
                    </div>
                  ))}
                </Rail>
              )}
            </RailReveal>
          );
        })}
        {loading && specs.length === 0 && <RailSkeleton />}
        {!loading && Object.values(rows).every((r) => r.length === 0) && (
          <div className="text-center py-24 text-ink-subtle">
            <p>Unable to load catalog content.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function AddonCatalogRail({
  addon,
  catalog,
  index = 0,
}: {
  addon: ReturnType<typeof useAddons.getState>["addons"][0];
  catalog: import("@/lib/harbor/types").CatalogDef;
  index?: number;
}) {
  const [metas, setMetas] = useState<Meta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchCatalog(addon, catalog)
      .then((m) => {
        if (!alive) return;
        setMetas(m);
        setLoading(false);
      })
      .catch(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [addon, catalog]);

  const push = useNav((s) => s.push);

  if (!loading && metas.length === 0) return null;

  return (
    <RailReveal index={index}>
      <Rail
        title={catalog.name}
        subtitle={addon.manifest.name}
        onViewAll={() =>
          push({
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
                <MetaCard meta={m} onOpen={() => push({ kind: "detail", type: m.type, id: m.id })} />
              </div>
            ))}
      </Rail>
    </RailReveal>
  );
}
