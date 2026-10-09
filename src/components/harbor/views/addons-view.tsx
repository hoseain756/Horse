"use client";

// Harbor Web — Addons manager: install by URL, manage installed, curated community list.
//
// Round 32 (defect E) — shared AddonCard redesign:
//  · row 1 = logo 48dp + FULL name (dir="auto", 2-line clamp, ellipsis only at
//    the end, full name in title tooltip) + version chip (LTR isolated);
//  · row 2 = status chip + info chips (streams/catalogs count, response time,
//    last checked via Intl.RelativeTimeFormat → "منذ 8 دقائق");
//  · row 3 = action icon buttons (health test, open/configure, show/hide,
//    delete with confirmation dialog) each 48dp with tooltips, spread evenly;
//  · no dead empty areas: text column flexes, actions wrap under on narrow;
//  · multi-column grid on wide screens.
// Install bar: labeled, dir="ltr" (URLs never clip at the start), 56dp Install
// button stacked below on compact / inline on md+, disabled until a plausible
// URL. Health pill fully translated (no "checked 5/5").
import { useCallback, useEffect, useMemo, useState } from "react";
import { Puzzle, Plus, Trash2, ExternalLink, Check, Eye, EyeOff, Activity, Loader2, RefreshCw } from "lucide-react";
import { useAddons, useNav } from "@/lib/harbor/store";
import { useHorseAccount } from "@/lib/harbor/horse-account";
import { UserPlus, X } from "lucide-react";
import { fetchManifest } from "@/lib/harbor/api";
import { describeProbe, probeAddon, type StoredProbe } from "@/lib/harbor/addon-probe";
import { PageHeader } from "../chrome/page-header";
import type { Addon, Manifest } from "@/lib/harbor/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useT } from "@/hooks/use-t";
import { Bdi, RichBidi } from "../common/bidi";
import { cn } from "@/lib/utils";

// Neutral curated list: well-known open community addons (user-installed, optional)
const COMMUNITY_SUGGESTIONS: { name: string; url: string; description: string }[] = [
  {
    name: "Cinemeta",
    url: "https://v3-cinemeta.strem.io/manifest.json",
    description: "Official Stremio catalog & metadata for movies and series.",
  },
  {
    name: "OpenSubtitles v3",
    url: "https://opensubtitles-v3.strem.io/manifest.json",
    description: "Subtitles from the OpenSubtitles community addon.",
  },
  {
    name: "Stremio Community Addons catalog",
    url: "https://addon-list.stremio.workers.dev/manifest.json",
    description: "Meta-catalog of community addons.",
  },
];

/** Plausible manifest URL — the Install button stays disabled until this passes. */
function isPlausibleManifestUrl(url: string): boolean {
  return /^https?:\/\/\S+\/manifest\.json\/?$/i.test(url.trim());
}

const PROBE_RESOURCE_KEY = {
  stream: "nStreams",
  subtitles: "nSubtitles",
  catalog: "nCatalogItems",
} as const;

export function AddonsView() {
  const addons = useAddons((s) => s.addons);
  const install = useAddons((s) => s.install);
  const uninstall = useAddons((s) => s.uninstall);
  const setEnabled = useAddons((s) => s.setEnabled);
  const push = useNav((s) => s.push);
  const { toast } = useToast();
  const tr = useT();

  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  // Per-addon health probe state: in-flight + last result.
  // Results persist on the addon record itself (localStorage + cloud sync), so the
  // status dots and "checked … ago" lines survive reloads and travel across devices.
  const [probing, setProbing] = useState<Record<string, boolean>>({});
  const probeResults = useMemo(() => {
    const map: Record<string, StoredProbe> = {};
    for (const a of addons) {
      if (a.probe) map[a.manifest.id] = a.probe;
    }
    return map;
  }, [addons]);

  const runProbe = useCallback(
    async (addon: Addon) => {
      const id = addon.manifest.id;
      if (probing[id]) return;
      setProbing((p) => ({ ...p, [id]: true }));
      const result = await probeAddon(addon.transportUrl, addon.manifest);
      const stored: StoredProbe = { ...result, probedAt: Date.now() };
      useAddons.getState().setProbe(id, stored);
      setProbing((p) => ({ ...p, [id]: false }));
      const { title, body } = describeProbe(addon.manifest.name, result);
      toast({ title, description: body, variant: result.ok ? "default" : "destructive" });
      return result;
    },
    [probing, toast],
  );

  const doInstall = useCallback(
    async (manifestUrl: string) => {
      if (!manifestUrl.trim()) return;
      setBusy(true);
      try {
        const { addon } = await fetchManifest(manifestUrl);
        install(manifestUrl, addon.manifest);
        toast({ title: tr("installedToast", { name: addon.manifest.name }), description: tr("addonReady") });
        setUrl("");
        // Background health probe: proves the addon serves real data, not just a manifest
        void runProbe(addon);
      } catch (e) {
        toast({
          title: tr("installFailed"),
          description: e instanceof Error ? e.message : undefined,
          variant: "destructive",
        });
      } finally {
        setBusy(false);
      }
    },
    [install, runProbe, toast, tr],
  );

  const filtered = addons.filter((a) =>
    a.manifest.name.toLowerCase().includes(filter.toLowerCase()),
  );

  // Fleet health summary for the header strip
  const probed = addons.filter((a) => a.probe);
  const healthy = probed.filter((a) => a.probe!.ok).length;
  const dead = probed.length - healthy;

  const confirmTarget = confirmId ? addons.find((a) => a.manifest.id === confirmId) : null;

  return (
    <div className="pb-16 px-4 md:px-8 max-w-5xl">
      <PageHeader view="addons" />
      <GuestSyncPrompt />
      <p className="md-body-medium text-ink-muted mb-4 max-w-2xl">
        <RichBidi text={tr("addonsIntro")} />
      </p>
      {addons.length > 0 && probed.length > 0 && (
        <div
          className="harbor-card mb-6 inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-full border border-edge-soft bg-elevated px-3.5 py-1.5 md-body-small"
          role="status"
          aria-label={tr("healthSummary")}
        >
          {/* Health dots keep semantic state colors (emerald=ok / danger=down) */}
          <span className="flex items-center gap-1.5 text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
            {tr("nHealthy", { n: tr.num(healthy) })}
          </span>
          {dead > 0 && (
            <span className="flex items-center gap-1.5 text-danger">
              <span className="h-1.5 w-1.5 rounded-full bg-danger" aria-hidden />
              {tr("nNotResponding", { n: tr.num(dead) })}
            </span>
          )}
          <span className="text-ink-subtle">{tr("checkedRatio", { a: tr.num(probed.length), b: tr.num(addons.length) })}</span>
          <button
            type="button"
            onClick={() => { for (const a of probed) void runProbe(a); }}
            disabled={Object.values(probing).some(Boolean)}
            className="ms-1 flex items-center gap-1 rounded-full bg-raised px-2 py-0.5 text-[10px] font-medium text-ink-muted transition-colors hover:text-ink disabled:opacity-50"
            title={tr("retestAllTitle")}
          >
            <RefreshCw className="w-3 h-3" />
            {tr("retestAll")}
          </button>
        </div>
      )}

      {/* Install bar — labeled; input dir=ltr (URL readable, never clipped at
          the start); 56dp Install button stacked below on compact screens. */}
      <div className="mb-10">
        <label htmlFor="addon-manifest-url" className="block md-label-medium text-ink-muted mb-1.5">
          {tr("manifestLabel")}
        </label>
        <div className="flex flex-col md:flex-row gap-2">
          <div className="relative flex-1">
            <Plus className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" aria-hidden />
            <Input
              id="addon-manifest-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && isPlausibleManifestUrl(url) && doInstall(url)}
              placeholder={tr("manifestPlaceholder")}
              dir="ltr"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              className="md-field-outlined !h-12 ps-9 text-xs font-mono text-start"
            />
          </div>
          <Button
            onClick={() => doInstall(url)}
            disabled={busy || !isPlausibleManifestUrl(url)}
            className="md-btn-filled md:!h-14 md:px-8 !h-12 shrink-0"
          >
            {busy ? tr("installing") : tr("install")}
          </Button>
        </div>
      </div>

      {/* Installed */}
      <h2 className="md-label-large text-ink-muted uppercase tracking-wide mb-3">
        {tr("installedCount", { n: tr.num(addons.length) })}
      </h2>
      {filtered.length === 0 ? (
        <div className="md-card-outlined text-center py-12 rounded-[var(--md-sys-shape-corner-large)] border-dashed mb-10 text-ink-muted">
          <Puzzle className="w-9 h-9 mx-auto mb-2 opacity-40" aria-hidden />
          <p className="md-body-medium">{addons.length === 0 ? tr("noAddonsYet") : tr("noAddonsMatch")}</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 mb-10">
          {filtered.map((a) => (
            <AddonCard
              key={a.manifest.id}
              addon={a}
              probe={probeResults[a.manifest.id]}
              probing={!!probing[a.manifest.id]}
              onTest={() => void runProbe(a)}
              onToggleEnabled={() => setEnabled(a.manifest.id, !a.enabled)}
              onOpen={() => push({ kind: "addon-detail", addonId: a.manifest.id })}
              onConfigure={() => window.open(a.transportUrl.replace(/manifest\.json$/, "configure"), "_blank", "noopener")}
              onDelete={() => setConfirmId(a.manifest.id)}
            />
          ))}
        </div>
      )}

      {/* Community suggestions */}
      <h2 className="md-label-large text-ink-muted uppercase tracking-wide mb-3">{tr("communityAddons")}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {COMMUNITY_SUGGESTIONS.map((s) => {
          const installed = addons.some((a) => a.transportUrl.startsWith(s.url.replace("/manifest.json", "")));
          return (
            <div key={s.url} className="md-card-outlined rounded-[var(--md-sys-shape-corner-large)] p-4 flex flex-col">
              <p className="md-title-small text-ink flex items-center gap-2">
                {s.name}
                {installed && <Check className="w-4 h-4 text-emerald-400" aria-hidden />}
              </p>
              <p className="md-body-small text-ink-muted mt-1 flex-1">{s.description}</p>
              <Button
                size="sm"
                variant={installed ? "outline" : "default"}
                className="mt-3 w-full"
                disabled={installed || busy}
                onClick={() => doInstall(s.url)}
              >
                {installed ? tr("installed") : tr("install")}
              </Button>
            </div>
          );
        })}
      </div>

      {/* Delete confirmation (defect E: destructive action needs a confirm) */}
      <AlertDialog open={!!confirmTarget} onOpenChange={(o) => !o && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {tr("uninstallConfirmTitle", { name: confirmTarget?.manifest.name ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>{tr("uninstallConfirmBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tr("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirmTarget) return;
                uninstall(confirmTarget.manifest.id);
                toast({ title: tr("removedToast", { name: confirmTarget.manifest.name }) });
                setConfirmId(null);
              }}
              className="md-btn-danger"
            >
              {tr("uninstall")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared AddonCard (defect E redesign)
// ---------------------------------------------------------------------------

function AddonCard({
  addon,
  probe,
  probing,
  onTest,
  onToggleEnabled,
  onOpen,
  onConfigure,
  onDelete,
}: {
  addon: Addon;
  probe?: StoredProbe;
  probing: boolean;
  onTest: () => void;
  onToggleEnabled: () => void;
  onOpen: () => void;
  onConfigure?: () => void;
  onDelete: () => void;
}) {
  const tr = useT();
  const m: Manifest = addon.manifest;
  const name = m.name || m.id;
  return (
    <div
      className={cn(
        "md-card-outlined md-state flex flex-col gap-2.5 rounded-[var(--md-sys-shape-corner-large)] p-3.5 transition-opacity",
        !addon.enabled && "opacity-60",
      )}
    >
      {/* Row 1 — logo 48dp + name (dir=auto, ≤2 lines, ellipsis end-only, tooltip) + version */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpen}
          className="w-12 h-12 rounded-xl bg-raised overflow-hidden flex items-center justify-center shrink-0 hover:ring-2 hover:ring-[var(--md-sys-color-outline)] transition-shadow"
          aria-label={name}
        >
          {m.logo ? (
            <img src={m.logo} alt="" className="w-full h-full object-contain" loading="lazy" />
          ) : (
            <Puzzle className="w-5 h-5 text-ink-subtle" aria-hidden />
          )}
        </button>
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-start" title={name}>
          <span className="flex items-baseline gap-1.5 min-w-0">
            <span
              dir="auto"
              className="md-title-small text-ink min-w-0 break-words"
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {name}
            </span>
            {m.version && (
              <span className="shrink-0 md-label-small font-normal text-ink-subtle">
                <Bdi>v{m.version}</Bdi>
              </span>
            )}
            {probing && (
              <Loader2 className="w-3 h-3 animate-spin text-accent shrink-0 self-center" aria-label={tr("testingAria")} />
            )}
            {!probing && probe && (
              <span
                className={cn("w-1.5 h-1.5 rounded-full shrink-0 self-center", probe.ok ? "bg-emerald-400" : "bg-danger")}
                aria-label={probe.ok ? tr("addonHealthyAria") : tr("addonDownAria")}
              />
            )}
          </span>
          {m.description && (
            <p dir="auto" className="md-body-small text-ink-muted mt-0.5" style={{
              display: "-webkit-box",
              WebkitLineClamp: 1,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}>
              {m.description}
            </p>
          )}
        </button>
      </div>

      {/* Row 2 — status chip + info chips (count, latency, relative last-checked) */}
      {(probe || addon.enabled === false) && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {probe && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide",
                probe.ok
                  ? "bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)]"
                  : "bg-[var(--md-sys-color-error-container)] text-[var(--md-sys-color-on-error-container)]",
              )}
            >
              {probe.ok ? tr("healthyChip") : tr("noReplyChip")}
            </span>
          )}
          {probe?.ok && typeof probe.count === "number" && (
            <span className="md-chip !h-6 text-[10px]">
              {tr(PROBE_RESOURCE_KEY[probe.resource ?? "catalog"] ?? "nItems", { n: tr.num(probe.count) })}
            </span>
          )}
          {probe?.ok && typeof probe.ms === "number" && (
            <span className="md-chip !h-6 text-[10px] tabular-nums"><Bdi>{(probe.ms / 1000).toFixed(1)}s</Bdi></span>
          )}
          {probe && (
            <span className="md-chip !h-6 text-[10px] text-ink-subtle" title={new Date(probe.probedAt).toLocaleString(tr.lang)}>
              {tr("checkedAgo", { time: tr.ago(probe.probedAt) })}
            </span>
          )}
          {!addon.enabled && (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)]">
              {tr("disable")}
            </span>
          )}
        </div>
      )}

      {/* Row 3 — actions: 48dp icon buttons spread evenly, each with a tooltip */}
      <div className="flex items-center justify-between gap-1 pt-0.5">
        <button
          type="button"
          onClick={onTest}
          disabled={probing}
          className="md-icon-btn harbor-tv-focus !w-12 !h-12 text-ink-muted hover:!text-accent disabled:opacity-50"
          aria-label={tr("testAria", { name })}
          title={tr("testAddon")}
        >
          {probing ? <Loader2 className="w-4.5 h-4.5 animate-spin" aria-hidden /> : <Activity className="w-4.5 h-4.5" aria-hidden />}
        </button>
        <button
          type="button"
          onClick={onOpen}
          className="md-icon-btn harbor-tv-focus !w-12 !h-12 text-ink-muted hover:!text-ink"
          aria-label={name}
          title={name}
        >
          <ExternalLink className="w-4.5 h-4.5" aria-hidden />
        </button>
        {onConfigure && m.behaviorHints?.configurable && (
          <button
            type="button"
            onClick={onConfigure}
            className="md-icon-btn harbor-tv-focus !w-12 !h-12 text-ink-muted hover:!text-ink"
            aria-label={tr("configureAria", { name })}
            title={tr("configure")}
          >
            <Puzzle className="w-4.5 h-4.5" aria-hidden />
          </button>
        )}
        <button
          type="button"
          onClick={onToggleEnabled}
          className="md-icon-btn harbor-tv-focus !w-12 !h-12 text-ink-muted hover:!text-ink"
          aria-label={addon.enabled ? tr("disableAria", { name }) : tr("enableAria", { name })}
          title={addon.enabled ? tr("disable") : tr("enable")}
        >
          {addon.enabled ? <Eye className="w-4.5 h-4.5" aria-hidden /> : <EyeOff className="w-4.5 h-4.5" aria-hidden />}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="md-icon-btn harbor-tv-focus !w-12 !h-12 !text-[var(--md-sys-color-error)] hover:!text-[var(--md-sys-color-on-error-container)] hover:!bg-[var(--md-sys-color-error-container)]"
          aria-label={tr("uninstallAria", { name })}
          title={tr("uninstall")}
        >
          <Trash2 className="w-4.5 h-4.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}

// ---------- guest sync prompt (dismissible, once per session) ----------
function GuestSyncPrompt() {
  const tr = useT();
  const user = useHorseAccount((s) => s.user);
  const loaded = useHorseAccount((s) => s.loaded);
  const push = useNav((s) => s.push);
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    // Deferred read (setState-in-effect lint-safe): null = not yet resolved.
    const id = setTimeout(() => {
      try {
        setDismissed(sessionStorage.getItem("harbor-web.guest-prompt") === "off");
      } catch {
        setDismissed(false);
      }
    }, 0);
    return () => clearTimeout(id);
  }, []);

  if (loaded && user) return null;
  if (dismissed !== false) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem("harbor-web.guest-prompt", "off");
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      className="mb-4 flex items-center gap-3 flex-wrap rounded-[var(--md-sys-shape-corner-large)] border border-accent/30 bg-accent-soft/30 px-4 py-3"
      role="note"
      aria-label={tr("guestPromptTitle")}
    >
      <UserPlus className="w-5 h-5 text-accent shrink-0" aria-hidden />
      <p className="md-body-small text-ink flex-1 min-w-40">{tr("guestPromptTitle")}</p>
      <Button
        size="sm"
        variant="outline"
        className="min-h-11 gap-1.5"
        onClick={() => {
          push({ kind: "view", view: "settings" });
          setTimeout(() => window.dispatchEvent(new CustomEvent("harbor:settings-section", { detail: "data" })), 60);
        }}
      >
        {tr("guestPromptCta")}
      </Button>
      <button
        type="button"
        onClick={dismiss}
        className="md-icon-btn !w-9 !h-9"
        aria-label={tr("guestPromptDismiss")}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
