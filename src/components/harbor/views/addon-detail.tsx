"use client";

// Harbor Web — Addon detail view (manifest info, catalogs, resources)
import { ArrowLeft, Puzzle, Check } from "lucide-react";
import { useAddons, useNav } from "@/lib/harbor/store";

export function AddonDetail({ addonId }: { addonId: string }) {
  const addons = useAddons((s) => s.addons);
  const pop = useNav((s) => s.pop);
  const addon = addons.find((a) => a.manifest.id === addonId);

  if (!addon) {
    return (
      <div className="pt-24 text-center text-ink-subtle">
        <p>Addon not found.</p>
      </div>
    );
  }

  const m = addon.manifest;
  const resources = (m.resources ?? []).map((r) => (typeof r === "string" ? r : r.name));

  return (
    <div className="pt-20 md:pt-14 pb-16 px-4 md:px-8 max-w-4xl">
      <button
        type="button"
        onClick={pop}
        className="md-icon-btn harbor-tv-focus !w-12 !h-12 mb-6 bg-[var(--md-sys-color-surface-container)] text-ink-muted hover:!text-ink"
        aria-label="Go back"
      >
        <ArrowLeft className="w-4.5 h-4.5" />
      </button>

      <div className="flex items-start gap-5 mb-8">
        <div className="w-20 h-20 rounded-[var(--md-sys-shape-corner-large)] bg-[var(--md-sys-color-surface-container)] overflow-hidden flex items-center justify-center shrink-0">
          {m.logo ? (
             
            <img src={m.logo} alt="" className="w-full h-full object-contain" />
          ) : (
            <Puzzle className="w-8 h-8 text-ink-subtle" />
          )}
        </div>
        <div className="min-w-0">
          <h1 className="md-headline-small font-display font-bold text-ink">{m.name}</h1>
          <p className="md-body-small text-ink-muted mt-1">
            {m.id} · v{m.version ?? "?"}
          </p>
          {m.description && <p className="md-body-medium text-ink-muted mt-3 max-w-2xl">{m.description}</p>}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <InfoCard title="Types" items={(m.types ?? []).map((t) => t)} />
        <InfoCard title="Resources" items={resources} />
        <InfoCard
          title="Catalogs"
          items={(m.catalogs ?? []).map((c) => `${c.name} (${c.type})`)}
        />
        <InfoCard title="Contact" items={m.contactEmail ? [m.contactEmail] : []} />
      </div>

      <div className="mt-8 md-card-outlined rounded-[var(--md-sys-shape-corner-large)] p-4">
        <p className="md-body-small text-ink-muted break-all">
          <span className="font-semibold text-ink">Transport URL:</span> {addon.transportUrl}
        </p>
      </div>
    </div>
  );
}

function InfoCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="md-card-outlined rounded-[var(--md-sys-shape-corner-large)] p-4">
      <p className="md-label-large text-ink-muted uppercase tracking-wide mb-2">{title}</p>
      {items.length === 0 ? (
        <p className="md-body-small text-ink-muted">None</p>
      ) : (
        <ul className="space-y-1">
          {items.map((it) => (
            <li key={it} className="flex items-center gap-2 md-body-medium text-ink capitalize">
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="harbor-clamp-1">{it}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
