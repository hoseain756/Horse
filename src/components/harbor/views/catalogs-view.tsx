"use client";

// Harbor Web — Catalogs view: browse every catalog your addons expose
// M3 (m3-3c): header → md-headline-small, CTA → .md-btn-filled, badges → .md-chip.
import { useMemo } from "react";
import { useAddons, useNav } from "@/lib/harbor/store";
import { Film, LayoutGrid, Search, Tv } from "lucide-react";
import type { CatalogDef } from "@/lib/harbor/types";
import { PageHeader } from "../chrome/page-header";

function TypeIcon({ type }: { type: string }) {
  if (type === "movie") return <Film className="w-5 h-5 text-accent" />;
  if (type === "series") return <Tv className="w-5 h-5 text-accent" />;
  return <LayoutGrid className="w-5 h-5 text-accent" />;
}

function catalogSupportsSearch(c: CatalogDef): boolean {
  return (
    (c.extra ?? []).some((e) => e.name === "search") ||
    (c.extraSupported ?? []).includes("search")
  );
}

export function CatalogsView() {
  const addons = useAddons((s) => s.addons);
  const push = useNav((s) => s.push);

  const catalogs = useMemo(
    () =>
      addons
        .filter((a) => a.enabled)
        .flatMap((a) =>
          (a.manifest.catalogs ?? []).map((c) => ({
            addon: a,
            catalog: c,
            key: `${a.manifest.id}:${c.type}:${c.id}`,
          })),
        ),
    [addons],
  );

  return (
    <div className="pb-16 px-4 md:px-8">
      <PageHeader view="catalogs" />
      <p className="md-body-medium text-ink-muted mb-8">
        Every catalog exposed by your installed addons, in one place.
      </p>

      {catalogs.length === 0 ? (
        <div className="text-center py-20 text-ink-subtle">
          <LayoutGrid className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No catalogs yet.</p>
          <button
            type="button"
            onClick={() => push({ kind: "view", view: "addons" })}
            className="md-btn md-btn-filled md-state mt-4"
          >
            Install addons
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {catalogs.map(({ addon, catalog, key }) => {
            const searchable = catalogSupportsSearch(catalog);
            const genreCount = catalog.genres?.length ?? 0;
            const needsSearch = (catalog.extraRequired ?? []).includes("search");
            return (
              <button
                key={key}
                type="button"
                onClick={() =>
                  push({
                    kind: "grid",
                    title: catalog.name,
                    query: { type: catalog.type, catalogId: catalog.id, addonId: addon.manifest.id },
                  })
                }
                className="harbor-card harbor-lift-card harbor-tv-focus flex items-center gap-3 rounded-2xl bg-elevated border border-edge-soft p-4 text-left hover:-translate-y-0.5"
              >
                <div className="relative w-11 h-11 shrink-0" aria-hidden>
                  <div className="w-11 h-11 rounded-xl bg-raised flex items-center justify-center overflow-hidden">
                    <TypeIcon type={catalog.type} />
                  </div>
                  {addon.manifest.logo && (
                    <img
                      src={addon.manifest.logo}
                      alt=""
                      className="absolute -bottom-1 -right-1 w-5 h-5 rounded-md object-cover bg-raised ring-1 ring-edge-soft"
                      loading="lazy"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="harbor-clamp-1 font-semibold text-ink text-sm">{catalog.name}</p>
                  <p className="harbor-clamp-1 text-xs text-ink-subtle">
                    {addon.manifest.name} · <span className="capitalize">{catalog.type}</span>
                  </p>
                  {(searchable || genreCount > 0 || needsSearch) && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {searchable && (
                        <span className="md-chip-selected md-label-small !h-6 !gap-1 !px-2 cursor-default!">
                          <Search className="w-2.5 h-2.5" />
                          Searchable
                        </span>
                      )}
                      {genreCount > 0 && (
                        <span className="md-chip md-label-small !h-6 !px-2 cursor-default!">
                          {genreCount} genres
                        </span>
                      )}
                      {needsSearch && (
                        // Warning chip: amber is a semantic warning color, kept as an
                        // intentional brand/semantic exception to the M3 palette.
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 md-label-small text-amber-400">
                          needs search term
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
