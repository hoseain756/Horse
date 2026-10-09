"use client";
// Round 8: palette deep-link marker


// Harbor Web — Settings (port of Harbor settings.tsx: basics/player/theme/language/data sections)
import { Children, cloneElement, isValidElement, useEffect, useId, useRef, useState } from "react";
import { Settings as SettingsIcon, SlidersHorizontal, Palette, Globe2, DatabaseBackup, Info, Check, RotateCcw, Brush, Trash2, CloudUpload, CloudOff, RefreshCw, ShieldCheck, Plug, Unplug, DownloadCloud, Loader2, Square, KeyRound, Zap, History, TvMinimalPlay, UploadCloud, ChevronUp, ChevronDown, X, Network, CircleAlert, UserRound, UserPlus, LogOut, Eye, EyeOff, Download, MonitorSmartphone, MailCheck, MailWarning, RefreshCcwDot, ExternalLink, Server } from "lucide-react";
import { useNav, useSettings } from "@/lib/harbor/store";
import { useT } from "@/hooks/use-t";
import { RichBidi } from "../common/bidi";
import { DEFAULT_SETTINGS } from "@/lib/harbor/settings";
import { useCloudSync, deviceIdShort, lastSyncFromStorage } from "@/lib/harbor/cloud-sync";
import { useHorseAccount, fetchDevices, revokeDevice, exportAccountData, type DeviceRow } from "@/lib/harbor/horse-account";
import type { MergeStrategy } from "@/lib/harbor/cloud-sync";
import { usePwa } from "@/lib/harbor/pwa";
import {
  THEME_PRESETS,
  FONT_PAIRS,
  applyTheme,
  deleteUserTheme,
  loadUserThemes,
  type FontPairId,
  type UserTheme,
} from "@/lib/harbor/themes";
import { getWatchlist, getWatchlistLength } from "@/lib/harbor/cw";
import { serverCapabilities, type TorrentMode } from "@/lib/harbor/playback";
import { useTrakt, installTraktPushSync } from "@/lib/harbor/trakt";
import { useSimkl } from "@/lib/harbor/simkl";
import { useDebrid, type DebridService } from "@/lib/harbor/debrid";
import { p2pHealth, p2pCleanup, formatSpeed, P2P_PORT, refreshP2pCapabilities } from "@/lib/harbor/p2p";
import { getLocalEngine, setLocalEngine, clearLocalEngine, localEngineHealth, type LocalEngineConfig } from "@/lib/harbor/local-engine";
import { TmdbCard, TmdbAttribution } from "../chrome/tmdb-card";
import { LinkAccountFlow } from "../chrome/link-account-flow";
import { RatingsSettingsCard } from "../chrome/ratings-row";
import { useLinking } from "@/lib/harbor/linking";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ThemeStudio } from "../chrome/theme-studio";
import { QuickAccess } from "../chrome/quick-access";
import { UserChip } from "../chrome/account";
import { HorseMark } from "../chrome/brand";
import { cn } from "@/lib/utils";

type Section = "basics" | "player" | "theme" | "language" | "integrations" | "data" | "about";

const SECTIONS: { id: Section; labelKey: "tabBasics" | "tabPlayer" | "tabTheme" | "tabLanguage" | "tabIntegrations" | "tabData" | "tabAbout"; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "basics", labelKey: "tabBasics", icon: SettingsIcon },
  { id: "player", labelKey: "tabPlayer", icon: SlidersHorizontal },
  { id: "theme", labelKey: "tabTheme", icon: Palette },
  { id: "language", labelKey: "tabLanguage", icon: Globe2 },
  { id: "integrations", labelKey: "tabIntegrations", icon: Plug },
  { id: "data", labelKey: "tabData", icon: DatabaseBackup },
  { id: "about", labelKey: "tabAbout", icon: Info },
];

export function SettingsView() {
  const [section, setSection] = useState<Section>("basics");
  const tr = useT();

  // Round 8: command palette (and other callers) can jump straight to a section
  useEffect(() => {
    const h = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      if (SECTIONS.some((s) => s.id === id)) setSection(id as Section);
    };
    window.addEventListener("harbor:settings-section", h);
    return () => window.removeEventListener("harbor:settings-section", h);
  }, []);

  return (
    <div className="pt-20 md:pt-14 pb-16 px-4 md:px-8 max-w-6xl">
      <div className="flex items-center gap-3 mb-7">
        <SettingsIcon className="w-6 h-6 text-accent" />
        <h1 className="md-headline-small font-display font-bold text-ink">{tr("settingsTitle")}</h1>
        {/* Account chip moved here from the removed sidebar (sign in / sync state) */}
        <div className="ms-auto">
          <UserChip variant="settings" />
        </div>
      </div>

      {/* Quick Access hub — every destination that used to live in the sidebar */}
      <QuickAccess />

      {/* M3 primary tabs: active = primary text + 3px rounded indicator underneath.
          harbor-fs-clear reserves the floating-search zone so the LAST tab can
          always scroll fully past the fixed phone trigger (defect F).
          tabIndex=0 keeps the scrollable row keyboard-accessible (axe). */}
      <div
        className="harbor-scroll-x overflow-x-auto flex gap-1 mb-7 border-b border-edge-soft harbor-fs-clear"
        role="tablist"
        aria-label={tr("settingsSections")}
        tabIndex={0}
      >
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          const active = section === s.id;
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSection(s.id)}
              className={cn(
                "harbor-tv-focus md-state relative flex min-h-12 items-center gap-2 shrink-0 px-4 py-2.5 md-label-large transition-colors",
                active
                  ? "text-[var(--md-sys-color-primary)]"
                  : "text-ink-muted hover:text-ink",
              )}
            >
              <Icon className="w-4 h-4" /> {tr(s.labelKey)}
              <span
                aria-hidden
                className={cn(
                  "absolute inset-x-3 bottom-0 h-[3px] rounded-full bg-[var(--md-sys-color-primary)] transition-opacity duration-200",
                  active ? "opacity-100" : "opacity-0",
                )}
              />
            </button>
          );
        })}
      </div>

      {section === "basics" && <BasicsPanel />}
      {section === "player" && <PlayerPanel />}
      {section === "theme" && <ThemePanel />}
      {section === "language" && <LanguagePanel />}
      {section === "integrations" && <IntegrationsPanel />}
      {section === "data" && <DataPanel />}
      {section === "about" && <AboutPanel />}
    </div>
  );
}

// ---------- Shared M3 pieces ----------

/**
 * M3 segmented button group: rounded-full secondary-container track, selected
 * segment = primary-container. In a narrow SettingRow container (container
 * query < 520px) the group becomes full-width with EQUAL segments and nowrap
 * labels. If the labels still cannot fit (320px, 150% font scale), it degrades
 * to an M3-styled dropdown menu — a label never wraps into a sliver.
 */
function SegmentedControl<
  T extends string,
>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (v: T) => void;
  label: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);

  // Degrade to a dropdown when the equal segments can no longer fit their
  // nowrap labels (narrow container and/or large font scale).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const check = () => {
      const buttons = el.querySelectorAll<HTMLButtonElement>("[role=\"radio\"], button");
      let needed = 0;
      buttons.forEach((b) => { needed += Math.ceil(b.scrollWidth) + 8; });
      setOverflow(needed > el.clientWidth + 2 && el.clientWidth > 0);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [options]);

  if (overflow) {
    return (
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="md-field-outlined h-11 min-h-11 w-full max-w-56 rounded-[var(--md-sys-shape-corner-medium)] bg-[var(--md-sys-color-surface-container)] px-2.5 text-sm text-ink"
      >
        {options.map(([id, text]) => (
          <option key={id} value={id}>{text}</option>
        ))}
      </select>
    );
  }

  return (
    <div ref={wrapRef} className="harbor-segmented" role="group" aria-label={label}>
      {options.map(([id, text]) => {
        const selected = value === id;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(id)}
            className={cn(
              "md-state min-h-10 rounded-full px-4 py-1.5 md-label-large whitespace-nowrap transition-colors",
              selected
                ? "bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)]"
                : "text-[var(--md-sys-color-on-secondary-container)]",
            )}
          >
            {text}
          </button>
        );
      })}
    </div>
  );
}

/**
 * M3 list item: body-large headline + body-small supporting text, trailing
 * control. Container-query responsive (defect C): below ~520px container
 * width the row STACKS — title + description full width, control below at
 * full width — so the label can never collapse to one word per line.
 * A11y: the title <p> becomes the control's accessible name via
 * aria-labelledby (cloned onto the child control unless it names itself).
 */
function SettingRow({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const titleId = useId();
  const control = Children.map(children, (child) => {
    if (isValidElement(child)) {
      const props = child.props as { "aria-label"?: string; "aria-labelledby"?: string };
      if (!props["aria-label"] && !props["aria-labelledby"]) {
        return cloneElement(child as React.ReactElement<Record<string, unknown>>, {
          "aria-labelledby": titleId,
        });
      }
    }
    return child;
  });
  return (
    <div className="harbor-setting-row md-state px-4 py-3.5">
      <div className="harbor-setting-row-label">
        <p id={titleId} className="md-body-large text-ink">{title}</p>
        {description && <p className="md-body-small text-ink-muted mt-0.5">{description}</p>}
      </div>
      <div className="harbor-setting-row-control">{control}</div>
    </div>
  );
}

/**
 * Slider row (defect C spec): title and value on ONE line (value pinned at
 * the inline-end), slider full width below, 48dp touch height.
 */
function SettingSliderRow({
  title,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  title: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  const tr = useT();
  return (
    <div className="harbor-slider-row md-state rounded-[var(--md-sys-shape-corner-medium)] flex flex-col items-stretch gap-1 px-4 py-2">
      <div className="flex items-center justify-between gap-4 min-w-0">
        <p className="md-body-large text-ink min-w-0">{title}</p>
        <span className="shrink-0 md-label-large text-ink-muted tabular-nums">
          {format ? format(value) : tr.num(value)}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
        className="harbor-slider-touch"
        aria-label={title}
      />
    </div>
  );
}

/** Outlined section card (corner-large) that hosts M3 list items. The card is
 *  the container-query context for its SettingRows (defect C). */
function SectionCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "harbor-cq md-card-outlined rounded-[var(--md-sys-shape-corner-large)] p-2 sm:p-3 max-w-3xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

function BasicsPanel() {
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  const tr = useT();

  return (
    <SectionCard className="space-y-1">
      <SettingRow title={tr("instantPlay")} description={tr("instantPlayDesc")}>
        <Switch checked={settings.instantPlay} onCheckedChange={(v) => update({ instantPlay: v })} />
      </SettingRow>
      <SettingRow title={tr("autoPlayNext")} description={tr("autoPlayNextDesc")}>
        <Switch checked={settings.autoPlayNextEpisode} onCheckedChange={(v) => update({ autoPlayNextEpisode: v })} />
      </SettingRow>
      <SettingRow title={tr("resumePlayback")} description={tr("resumePlaybackDesc")}>
        <Switch checked={settings.resumePlayback} onCheckedChange={(v) => update({ resumePlayback: v })} />
      </SettingRow>
      <SettingRow title={tr("confirmLeave")} description={tr("confirmLeaveDesc")}>
        <Switch checked={settings.playerConfirmLeave} onCheckedChange={(v) => update({ playerConfirmLeave: v })} />
      </SettingRow>
      <SettingRow title={tr("showCardBadges")} description={tr("showCardBadgesDesc")}>
        <Switch checked={settings.showCardBadges} onCheckedChange={(v) => update({ showCardBadges: v })} />
      </SettingRow>
      <SettingRow title={tr("homeMode")} description={tr("homeModeDesc")}>
        <SegmentedControl
          label={tr("homeMode")}
          value={settings.homeMode}
          options={([
            ["harbor", tr("optHarbor")],
            ["classic", tr("optClassic")],
          ] as const).map(([id, label]) => [id, label] as const)}
          onChange={(m) => update({ homeMode: m })}
        />
      </SettingRow>
      <SettingRow title={tr("showAllAddonRows")} description={tr("showAllAddonRowsDesc")}>
        <Switch checked={settings.homeShowAllAddonRows} onCheckedChange={(v) => update({ homeShowAllAddonRows: v })} />
      </SettingRow>
      <SettingRow title={tr("hideWatched")} description={tr("hideWatchedDesc")}>
        <Switch checked={settings.hideWatchedInCatalogs} onCheckedChange={(v) => update({ hideWatchedInCatalogs: v })} />
      </SettingRow>
      <SettingRow title={tr("blurEpisodeThumbs")} description={tr("blurEpisodeThumbsDesc")}>
        <Switch checked={settings.blurEpisodeThumbnails} onCheckedChange={(v) => update({ blurEpisodeThumbnails: v })} />
      </SettingRow>
      <SettingRow title={tr("autoHideNav")} description={tr("autoHideNavDesc")}>
        <Switch checked={settings.dockAutoHide} onCheckedChange={(v) => update({ dockAutoHide: v })} />
      </SettingRow>
      <SettingSliderRow
        title={tr("posterSize")}
        value={Math.round(settings.posterScale * 100)}
        min={70}
        max={140}
        step={5}
        onChange={(v) => update({ posterScale: v / 100 })}
        format={(v) => `${tr.num(v)}%`}
      />
      <SettingSliderRow
        title={tr("posterRadius")}
        value={settings.posterRadius}
        min={0}
        max={28}
        step={1}
        onChange={(v) => update({ posterRadius: v })}
        format={(v) => `${tr.num(v)}px`}
      />
    </SectionCard>
  );
}

function PlayerPanel() {
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  const tr = useT();
  // Conversion support is a server capability — the control only shows when
  // the host actually runs ffmpeg with TRANSCODE_ENABLED.
  const [transcodeSupported, setTranscodeSupported] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    void serverCapabilities().then((c) => {
      if (alive) setTranscodeSupported(c.transcode);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <SectionCard className="space-y-1">
      <SettingRow
        title={tr("secureProxy")}
        description={tr("secureProxyDesc")}
      >
        <SegmentedControl
          label={tr("secureProxy")}
          value={settings.proxyMode}
          options={([
            ["auto", tr("optAuto")],
            ["always", tr("optAlways")],
            ["never", tr("optNever")],
          ] as const).map(([id, label]) => [id, label] as const)}
          onChange={(v) => update({ proxyMode: v })}
        />
      </SettingRow>
      {transcodeSupported && (
        <SettingRow
          title={tr("convertStreams")}
          description={tr("convertStreamsDesc")}
        >
          <SegmentedControl
            label={tr("convertStreams")}
            value={settings.transcodeMode}
            options={([
              ["auto", tr("optAuto")],
              ["ask", tr("optAsk")],
              ["never", tr("optNever")],
            ] as const).map(([id, label]) => [id, label] as const)}
            onChange={(v) => update({ transcodeMode: v })}
          />
        </SettingRow>
      )}
      <SettingRow
        title={tr("playableOnly")}
        description={tr("playableOnlyDesc")}
      >
        <Switch checked={settings.playableOnly} onCheckedChange={(v) => update({ playableOnly: v })} />
      </SettingRow>
      <SettingRow
        title={tr("preferH264")}
        description={tr("preferH264Desc")}
      >
        <Switch checked={settings.preferH264} onCheckedChange={(v) => update({ preferH264: v })} />
      </SettingRow>
      <SettingSliderRow
        title={tr("seekStep")}
        value={settings.seekBackStepSec}
        min={5}
        max={60}
        step={5}
        onChange={(v) => update({ seekBackStepSec: v, seekForwardStepSec: v })}
        format={(v) => `${tr.num(v)}s`}
      />
      <SettingSliderRow
        title={tr("subSize")}
        value={settings.subFontSize}
        min={14}
        max={56}
        step={2}
        onChange={(v) => update({ subFontSize: v })}
        format={(v) => `${tr.num(v)}px`}
      />
      <SettingSliderRow
        title={tr("subBackground")}
        value={Math.round(settings.subBackgroundOpacity * 100)}
        min={0}
        max={100}
        step={5}
        onChange={(v) => update({ subBackgroundOpacity: v / 100 })}
        format={(v) => `${tr.num(v)}%`}
      />
      <SettingSliderRow
        title={tr("subBorder")}
        value={settings.subBorderSize}
        min={0}
        max={8}
        step={1}
        onChange={(v) => update({ subBorderSize: v })}
        format={(v) => `${tr.num(v)}px`}
      />
      <SettingRow title={tr("videoFill")} description={tr("videoFillDesc")}>
        <SegmentedControl
          label={tr("videoFill")}
          value={settings.videoFill}
          options={([
            ["fit", tr("optFit")],
            ["fill", tr("optFill")],
            ["zoom", tr("optZoom")],
          ] as const).map(([id, label]) => [id, label] as const)}
          onChange={(m) => update({ videoFill: m })}
        />
      </SettingRow>
      <SettingRow title={tr("playerChrome")} description={tr("playerChromeDesc")}>
        <SegmentedControl
          label={tr("playerChrome")}
          value={settings.playerTheme}
          options={([
            ["auto", tr("optAuto")],
            ["default", tr("optDefault")],
            ["stremio", tr("optStremio")],
          ] as const).map(([id, label]) => [id, label] as const)}
          onChange={(m) => update({ playerTheme: m })}
        />
      </SettingRow>
      <SettingRow title={tr("pickerLayout")} description={tr("pickerLayoutDesc")}>
        <SegmentedControl
          label={tr("pickerLayout")}
          value={settings.pickerLayout}
          options={([
            ["stremio", tr("optStremio")],
            ["condensed", tr("optCondensed")],
          ] as const).map(([id, label]) => [id, label] as const)}
          onChange={(m) => update({ pickerLayout: m })}
        />
      </SettingRow>
      <SettingRow title={tr("qualityInfo")} description={tr("qualityInfoDesc")}>
        <Switch checked={settings.showQualityInfo} onCheckedChange={(v) => update({ showQualityInfo: v })} />
      </SettingRow>
    </SectionCard>
  );
}

function ThemePanel() {
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [studioOpen, setStudioOpen] = useState(false);
  const [userThemes, setUserThemes] = useState<UserTheme[]>([]);

  // Load saved themes after mount (client-only storage; avoids hydration mismatch)
  useEffect(() => {
    const t = setTimeout(() => setUserThemes(loadUserThemes()), 0);
    return () => clearTimeout(t);
  }, []);

  const setPreset = (preset: string) => {
    update({ theme: { ...settings.theme, preset, customColors: null, customName: null } });
  };

  const applyUserTheme = (t: UserTheme) => {
    update({
      theme: {
        ...settings.theme,
        preset: "custom",
        customColors: t.colors,
        fontPair: t.fontPair,
        customLayout: t.layout,
        customCardStyle: t.cardStyle,
        customButtonStyle: t.buttonStyle,
        customName: t.name,
      },
    });
  };

  const removeUserTheme = (id: string) => {
    const next = deleteUserTheme(id);
    setUserThemes(next);
    // If the deleted theme was active, fall back to the default preset
    if (settings.theme.preset === "custom") {
      const stillExists = next.some((t) => t.name === settings.theme.customName);
      if (!stillExists) {
        update({ theme: { ...settings.theme, preset: "cool-grey", customColors: null, customName: null } });
      }
    }
  };

  const onBgUpload = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 3 * 1024 * 1024) {
      toast({ title: "Image too large", description: "Use an image under 3 MB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      update({ theme: { ...settings.theme, backgroundImage: reader.result as string } });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-7 max-w-4xl">
      {/* NEW M3 controls — Appearance & Contrast (existing sanitized settings keys,
          consumed live by app-shell's applyTheme; UI only, no new logic) */}
      <SectionCard className="space-y-1">
        <SettingRow title="Appearance" description="Light or dark Material 3 scheme of your current palette">
          <SegmentedControl
            label="Appearance"
            value={settings.appearance}
            options={[
              ["dark", "Dark"],
              ["light", "Light"],
            ] as const}
            onChange={(v) => update({ appearance: v })}
          />
        </SettingRow>
        <SettingRow title="Contrast" description="Scheme contrast level — higher for stronger legibility">
          <SegmentedControl
            label="Contrast"
            value={settings.contrastLevel}
            options={[
              ["standard", "Standard"],
              ["medium", "Medium"],
              ["high", "High"],
            ] as const}
            onChange={(v) => update({ contrastLevel: v })}
          />
        </SettingRow>
      </SectionCard>

      {/* Theme Studio */}
      <div className="md-card-outlined rounded-[var(--md-sys-shape-corner-large)] p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h2 className="md-title-medium font-display font-bold text-ink flex items-center gap-2">
              <Brush className="w-[18px] h-[18px] text-accent" /> Theme Studio
            </h2>
            <p className="md-body-small text-ink-muted mt-0.5">
              Build a fully custom palette, fonts and layout — with live preview. Your accent color
              seeds the Material 3 palette.
              {settings.theme.preset === "custom" && settings.theme.customName && (
                <span className="text-accent font-medium"> Active: {settings.theme.customName}</span>
              )}
            </p>
          </div>
          <Button onClick={() => setStudioOpen(true)}>
            <Brush className="w-4 h-4 me-1.5" /> Open Theme Studio
          </Button>
        </div>
        {userThemes.length > 0 && (
          <div className="mt-4">
            <p className="md-label-small uppercase tracking-wide text-ink-subtle mb-2">Your saved themes</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {userThemes.map((t) => (
                <div
                  key={t.id}
                  className={cn(
                    "md-card-outlined group relative p-2.5 cursor-pointer transition-all hover:scale-[1.02]",
                    settings.theme.preset === "custom" && settings.theme.customName === t.name
                      ? "ring-2 ring-[var(--md-sys-color-primary)] border-transparent"
                      : "",
                  )}
                  style={{ background: t.colors.canvas }}
                  onClick={() => applyUserTheme(t)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && applyUserTheme(t)}
                  aria-label={`Apply theme ${t.name}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1">
                      {[t.colors.canvas, t.colors.accent, t.colors.elevated].map((c, i) => (
                        <span key={i} className="w-3.5 h-3.5 rounded-full border border-white/20" style={{ background: c }} />
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeUserTheme(t.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-white/50 hover:text-danger transition-all"
                      aria-label={`Delete theme ${t.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs font-semibold mt-1.5 truncate" style={{ color: t.colors.accent }}>
                    {t.name}
                  </p>
                  <p className="text-[10px] text-white/50 capitalize">{t.layout} · {t.fontPair.split("-")[0]}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div>
        <h2 className="md-label-large text-ink-muted uppercase tracking-wide mb-1">Theme presets</h2>
        <p className="md-body-small text-ink-subtle mb-3">Your accent color seeds the Material 3 palette.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {THEME_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPreset(p.id)}
              className={cn(
                "md-card-outlined harbor-tv-focus p-3 text-start transition-all hover:scale-[1.02]",
                settings.theme.preset === p.id
                  ? "ring-2 ring-[var(--md-sys-color-primary)] border-transparent"
                  : "",
              )}
              style={{ background: p.canvas }}
              aria-pressed={settings.theme.preset === p.id}
            >
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex gap-1.5">
                  {p.swatch.map((c) => (
                    <span key={c} className="w-4 h-4 rounded-full border border-white/20" style={{ background: c }} />
                  ))}
                </div>
                {settings.theme.preset === p.id && (
                  <span className="w-5 h-5 rounded-full bg-accent flex items-center justify-center">
                    <Check className="w-3 h-3 text-black" />
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold" style={{ color: p.accent }}>
                {p.name}
              </p>
              <p className="text-[11px] text-white/50 capitalize">{p.layout} layout</p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-ink-muted uppercase tracking-wide mb-3">Font pairing</h2>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(FONT_PAIRS) as FontPairId[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                update({ theme: { ...settings.theme, fontPair: id } });
                // live preview: apply font immediately
                const pair = FONT_PAIRS[id];
                document.documentElement.style.setProperty("--font-display-var", pair.display);
                document.documentElement.style.setProperty("--font-sans-var", pair.sans);
              }}
              className={cn(
                "md-chip harbor-tv-focus px-4 !h-11 transition-colors",
                settings.theme.fontPair === id
                  ? "md-chip-selected border-transparent"
                  : "hover:text-ink",
              )}
              style={{ fontFamily: FONT_PAIRS[id].display }}
              aria-pressed={settings.theme.fontPair === id}
            >
              {FONT_PAIRS[id].name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h2 className="md-label-large text-ink-muted uppercase tracking-wide mb-3">Custom background</h2>
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            Upload image
          </Button>
          {settings.theme.backgroundImage && (
            <Button
              variant="outline"
              onClick={() => update({ theme: { ...settings.theme, backgroundImage: null } })}
            >
              <RotateCcw className="w-4 h-4 me-1" /> Remove
            </Button>
          )}
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-subtle">Dim</span>
            <div className="w-32">
              <Slider
                value={[settings.theme.backgroundDim]}
                min={0}
                max={1}
                step={0.05}
                onValueChange={([v]) => update({ theme: { ...settings.theme, backgroundDim: v } })}
              />
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onBgUpload(e.target.files[0])}
            aria-label="Upload background image"
          />
        </div>
      </div>

      <ThemeStudio
        open={studioOpen}
        onClose={() => {
          setStudioOpen(false);
          // Restore the persisted theme in case the draft preview diverged, and refresh the saved list
          applyTheme(useSettings.getState().settings.theme);
          setUserThemes(loadUserThemes());
        }}
      />
    </div>
  );
}

function LanguagePanel() {
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  const LANGS = ["English", "Spanish", "French", "German", "Japanese", "Korean", "Chinese", "Arabic", "Hindi", "Portuguese", "Russian", "Italian"];
  const preferred = settings.preferredSubLangs;

  const toggleLang = (lang: string) => {
    // Read live store state (not the hook snapshot) so rapid successive toggles
    // within one render batch can't silently drop each other's changes.
    const cur = useSettings.getState().settings.preferredSubLangs;
    const set = new Set(cur);
    if (set.has(lang)) set.delete(lang);
    else set.add(lang);
    update({ preferredSubLangs: Array.from(set) });
  };

  // Move a language in the priority list (index-based; bounds-safe)
  const move = (from: number, to: number) => {
    const cur = useSettings.getState().settings.preferredSubLangs;
    if (from === to || to < 0 || to >= cur.length) return;
    const next = [...cur];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    update({ preferredSubLangs: next });
  };

  // Drag-to-reorder state (HTML5 DnD; buttons below cover keyboard/touch)
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const dropOn = (to: number) => {
    if (dragIdx !== null) move(dragIdx, to);
    setDragIdx(null);
    setOverIdx(null);
  };

  return (
    <div className="space-y-3 max-w-3xl">
      {/* Interface language (UI language) — drives RTL + the Arabic text layer + Tajawal font */}
      <div className="md-card-outlined rounded-[var(--md-sys-shape-corner-large)] px-4 py-4">
        <p className="md-body-large text-ink mb-1">
          Interface language · <span lang="ar">لغة الواجهة</span>
        </p>
        <p className="md-body-small text-ink-muted mb-3">
          Switch the whole app interface. Arabic applies the approved translation, right-to-left
          layout and the Tajawal font.
          <span lang="ar"> — يبدّل واجهة التطبيق بالكامل: الترجمة المعتمدة، والاتجاه من اليمين إلى اليسار، وخط Tajawal.</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["en", "English"],
              ["ar", "العربية"],
            ] as const
          ).map(([code, label]) => (
            <button
              key={code}
              type="button"
              onClick={() => update({ uiLanguage: code })}
              className={cn(
                "md-chip md-state harbor-tv-focus",
                settings.uiLanguage === code && "md-chip-selected border-transparent",
              )}
              aria-pressed={settings.uiLanguage === code}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="md-card-outlined rounded-[var(--md-sys-shape-corner-large)] px-4 py-4">
        <p className="md-body-large text-ink mb-1">Preferred subtitle languages</p>
        <p className="md-body-small text-ink-muted mb-3">
          Toggle languages below, then order them — the player picks the highest-priority match first.
        </p>
        <div className="flex flex-wrap gap-2">
          {LANGS.map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => toggleLang(lang)}
              className={cn(
                "md-chip harbor-tv-focus",
                preferred.includes(lang) && "md-chip-selected border-transparent",
              )}
              aria-pressed={preferred.includes(lang)}
            >
              {lang}
            </button>
          ))}
        </div>

        {preferred.length > 0 && (
          <div className="mt-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-muted mb-2">
              Priority order
            </p>
            <div className="space-y-1.5" role="list" aria-label="Subtitle language priority">
              {preferred.map((lang, i) => (
                <div
                  key={lang}
                  role="listitem"
                  draggable
                  onDragStart={() => setDragIdx(i)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOverIdx(i);
                  }}
                  onDragLeave={() => setOverIdx((v) => (v === i ? null : v))}
                  onDrop={(e) => {
                    e.preventDefault();
                    dropOn(i);
                  }}
                  onDragEnd={() => {
                    setDragIdx(null);
                    setOverIdx(null);
                  }}
                  className={cn(
                    "harbor-card flex items-center gap-2.5 rounded-xl border px-2.5 py-2 transition-all",
                    dragIdx === i
                      ? "border-accent/60 bg-accent-soft opacity-70"
                      : overIdx === i && dragIdx !== null
                        ? "border-accent/60 bg-accent-soft/40"
                        : "border-edge-soft bg-raised/60",
                  )}
                >
                  <span
                    className={cn(
                      "shrink-0 w-8 h-8 rounded-[var(--md-sys-shape-corner-small)] flex items-center justify-center text-xs font-bold tabular-nums cursor-grab active:cursor-grabbing",
                      i === 0 ? "bg-accent text-black" : "bg-raised text-ink-muted",
                    )}
                    title="Drag to reorder"
                  >
                    {i + 1}
                  </span>
                  <span className="flex-1 text-sm text-ink harbor-clamp-1">{lang}</span>
                  {i === 0 && (
                    <span className="shrink-0 rounded-full bg-accent-soft text-accent px-2 py-0.5 text-[9px] font-bold tracking-wide">
                      TOP PICK
                    </span>
                  )}
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => move(i, i - 1)}
                      disabled={i === 0}
                      className="md-icon-btn harbor-tv-focus !w-11 !h-11 text-ink-muted hover:!text-ink hover:!bg-raised disabled:opacity-30 disabled:hover:!bg-transparent"
                      aria-label={`Move ${lang} up`}
                      title="Move up"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(i, i + 1)}
                      disabled={i === preferred.length - 1}
                      className="md-icon-btn harbor-tv-focus !w-11 !h-11 text-ink-muted hover:!text-ink hover:!bg-raised disabled:opacity-30 disabled:hover:!bg-transparent"
                      aria-label={`Move ${lang} down`}
                      title="Move down"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleLang(lang)}
                      className="md-icon-btn harbor-tv-focus !w-11 !h-11 text-ink-muted hover:!text-danger hover:!bg-raised"
                      aria-label={`Remove ${lang}`}
                      title="Remove"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <SettingRow title="Subtitles off by default" description="Don't auto-enable subtitle tracks">
        <Switch checked={settings.subtitlesOffByDefault} onCheckedChange={(v) => update({ subtitlesOffByDefault: v })} />
      </SettingRow>
    </div>
  );
}

function DataPanel() {
  const { toast } = useToast();
  const settings = useSettings((s) => s.settings);
  const fileRef = useRef<HTMLInputElement>(null);

  const exportBackup = () => {
    const data: Record<string, string> = {};
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key?.startsWith("harbor-web.")) {
        const v = window.localStorage.getItem(key);
        if (v) data[key] = v;
      }
    }
    const backup = {
      format: "harbor-web-backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      data,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `harbor-web-backup-${new Date().toISOString().slice(0, 10)}.harbx`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Backup exported", description: `${Object.keys(data).length} keys saved.` });
  };

  const importBackup = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as { format?: string; data?: Record<string, string> };
      if (parsed.format !== "harbor-web-backup" || !parsed.data) {
        throw new Error("Not a Horse backup file");
      }
      let restored = 0;
      for (const [key, value] of Object.entries(parsed.data)) {
        if (key.startsWith("harbor-web.")) {
          window.localStorage.setItem(key, value);
          restored++;
        }
      }
      toast({ title: "Backup restored", description: `${restored} keys restored. Reloading…` });
      setTimeout(() => window.location.reload(), 900);
    } catch (e) {
      toast({
        title: "Restore failed",
        description: e instanceof Error ? e.message : "Invalid file",
        variant: "destructive",
      });
    }
  };

  const clearData = () => {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key?.startsWith("harbor-web.")) keys.push(key);
    }
    keys.forEach((k) => window.localStorage.removeItem(k));
    toast({ title: "Local data cleared", description: "Reloading…" });
    setTimeout(() => window.location.reload(), 900);
  };

  return (
    <div className="space-y-3 max-w-3xl">
      <HorseAccountCard />
      <CloudSyncCard />
      <SectionCard className="space-y-1">
        <SettingRow title="Export backup" description={`Save settings, addons, watchlist (${getWatchlist().length} items) to a .harbx file`}>
          <Button onClick={exportBackup}>Export</Button>
        </SettingRow>
        <SettingRow title="Restore backup" description="Import a .harbx backup file">
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            Restore
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".harbx,.json"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && importBackup(e.target.files[0])}
            aria-label="Import backup file"
          />
        </SettingRow>
        <SettingRow title="Clear local data" description="Remove all Horse data from this browser">
          <Button variant="destructive" onClick={clearData}>
            Clear
          </Button>
        </SettingRow>
        <SettingRow
          title="Current settings size"
          description={`${(JSON.stringify(settings).length / 1024).toFixed(1)} KB in localStorage`}
        >
          <span />
        </SettingRow>
      </SectionCard>
    </div>
  );
}

// ---------- HORSE platform account card (v2: email auth + devices + export) ----------
type MergeChoice = MergeStrategy;

function passwordStrength(pw: string): 0 | 1 | 2 | 3 {
  if (pw.length < 10) return 0;
  let score = 1;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw) && (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw))) score++;
  if (pw.length >= 16 && /[^A-Za-z0-9]/.test(pw) && /\d/.test(pw)) score++;
  return Math.min(3, score) as 0 | 1 | 2 | 3;
}

function HorseAccountCard() {
  const t = useT();
  const user = useHorseAccount((s) => s.user);
  const loaded = useHorseAccount((s) => s.loaded);
  const busy = useHorseAccount((s) => s.busy);
  const registerAction = useHorseAccount((s) => s.register);
  const loginAction = useHorseAccount((s) => s.login);
  const logoutAction = useHorseAccount((s) => s.logout);
  const logoutAllAction = useHorseAccount((s) => s.logoutAllDevices);
  const deleteAccountAction = useHorseAccount((s) => s.deleteAccount);
  const pullAccountNow = useHorseAccount((s) => s.pullAccountNow);
  const changePasswordAction = useHorseAccount((s) => s.changePassword);
  const { toast } = useToast();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // merge-strategy dialog state (one-time on login)
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeChoice, setMergeChoice] = useState<MergeChoice>("merge");
  const [mergeOverwrite, setMergeOverwrite] = useState(false);
  const [pendingCreds, setPendingCreds] = useState<{ email: string; password: string } | null>(null);

  // devices / dialogs (signed-in)
  const [devicesOpen, setDevicesOpen] = useState(false);
  const [devices, setDevices] = useState<DeviceRow[] | null>(null);
  const [pwOpen, setPwOpen] = useState(false);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");

  useEffect(() => {
    void useHorseAccount.getState().load();
  }, []);

  useEffect(() => {
    if (devicesOpen) {
      void fetchDevices().then((r) => setDevices(r.devices ?? []));
    }
  }, [devicesOpen]);

  const hasLocalData = () => {
    try {
      const addons = window.localStorage.getItem("harbor-web.installed-addons");
      return !!addons && addons !== "[]";
    } catch {
      return false;
    }
  };

  const runLogin = async (em: string, pw: string, strategy: MergeStrategy) => {
    const res = await loginAction(em, pw, strategy, remember);
    if (res.ok) {
      setMergeOpen(false);
      setMergeOverwrite(false);
      setPendingCreds(null);
      toast({
        title: t("accountToastSignedIn", { name: em }),
        description:
          res.pulled && res.pulled > 0 ? t("accountToastPulled", { n: res.pulled }) : t("accountToastUpToDate"),
      });
      setPassword("");
    } else {
      setMergeOpen(false);
      setPendingCreds(null);
      setError(res.error ?? t("accountErrSignIn"));
    }
  };

  const submit = async () => {
    const em = email.trim().toLowerCase();
    if (!em || !password || busy) return;
    setError(null);
    if (mode === "login") {
      // One-time merge decision when this device already has local data (spec).
      if (hasLocalData()) {
        setMergeChoice("merge");
        setPendingCreds({ email: em, password });
        setMergeOpen(true);
        return;
      }
      await runLogin(em, password, "merge");
    } else {
      if (passwordStrength(password) === 0) {
        setError(t("accountErrPasswordShort"));
        return;
      }
      const res = await registerAction(em, password, displayName.trim() || undefined);
      if (res.ok) {
        toast({
          title: t("accountToastCreated"),
          description: t("accountToastCreatedDesc"),
        });
        setPassword("");
      } else {
        setError(res.error ?? t("accountErrRegister"));
      }
    }
  };

  const signOut = async () => {
    await logoutAction();
    toast({ title: t("accountToastSignedOut"), description: t("accountToastSignedOutDesc") });
  };

  const signOutAll = async () => {
    await logoutAllAction();
    toast({ title: t("accountToastSignedOut"), description: t("devicesToastRevoked") });
  };

  const removeAccount = async () => {
    const res = await deleteAccountAction();
    if (res.ok) {
      toast({ title: t("accountToastDeleted"), description: t("accountToastDeletedDesc") });
    } else {
      toast({ title: t("accountToastDeleteFailed"), description: res.error ?? t("accountTryAgain"), variant: "destructive" });
    }
  };

  const syncFromAccount = async () => {
    const res = await pullAccountNow();
    if (res.ok) {
      toast({
        title: t("accountToastSyncedTitle"),
        description:
          res.pulled && res.pulled > 0 ? t("accountToastPulled", { n: res.pulled }) : t("accountToastUpToDate"),
      });
    } else {
      toast({ title: t("accountToastSyncFailed"), description: res.error ?? t("accountTryAgain"), variant: "destructive" });
    }
  };

  const doExport = async () => {
    const res = await exportAccountData();
    if (res.ok) toast({ title: t("exportDone") });
    else toast({ title: t("exportFailed"), description: res.error, variant: "destructive" });
  };

  const doChangePassword = async () => {
    if (pwNew.length < 10) {
      toast({ title: t("accountErrPasswordShort"), variant: "destructive" });
      return;
    }
    if (pwNew !== pwConfirm) {
      toast({ title: t("accountErrPasswordMismatch"), variant: "destructive" });
      return;
    }
    const res = await changePasswordAction(pwCurrent, pwNew);
    if (res.ok) {
      setPwOpen(false);
      setPwCurrent("");
      setPwNew("");
      setPwConfirm("");
      toast({ title: t("passwordDone") });
    } else {
      toast({ title: t("passwordTitle"), description: res.error ?? t("accountErrGeneric"), variant: "destructive" });
    }
  };

  const revokeOne = async (id: string) => {
    const res = await revokeDevice(id);
    if (res.ok) {
      toast({ title: t("devicesToastRevoked") });
      const r = await fetchDevices();
      setDevices(r.devices ?? []);
    }
  };

  if (!loaded) {
    return (
      <div className="md-card-outlined rounded-[var(--md-sys-shape-corner-large)] p-5 min-h-[96px] flex items-center gap-3" aria-hidden>
        <Loader2 className="w-4 h-4 animate-spin text-ink-subtle" />
        <span className="md-body-small text-ink-subtle">{t("accountLoading")}</span>
      </div>
    );
  }

  const strength = passwordStrength(password);
  const strengthColor = ["bg-danger", "bg-amber-400", "bg-emerald-400", "bg-emerald-500"][strength];
  const strengthLabel = [t("accountStrengthWeak"), t("accountStrengthFair"), t("accountStrengthGood"), t("accountStrengthStrong")][strength];

  return (
    <div className="md-card-outlined rounded-[var(--md-sys-shape-corner-large)] p-5 relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" aria-hidden />

      {user ? (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3 min-w-0">
              <span className="w-10 h-10 rounded-full bg-accent text-black font-bold flex items-center justify-center shrink-0 md-title-medium" aria-hidden>
                {(user.displayName || user.username).charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <h3 className="md-title-small text-ink flex items-center gap-2">
                    <UserRound className="w-4 h-4 text-accent" />
                    {user.displayName || user.username}
                  </h3>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-raised border border-edge-soft px-2 py-0.5 md-label-small text-ink-muted">
                    {t("accountSignedInChip")}
                  </span>
                  {user.emailVerified ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-raised border border-edge-soft px-2 py-0.5 md-label-small text-emerald-300">
                      <MailCheck className="w-3 h-3" />
                      {t("accountVerifyDone")}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-raised border border-amber-500/40 px-2 py-0.5 md-label-small text-amber-300">
                      <MailWarning className="w-3 h-3" />
                      <span className="truncate">{t("accountVerifyNotice")}</span>
                    </span>
                  )}
                </div>
                <p className="md-body-small text-ink-muted truncate max-w-md" dir="ltr">
                  {user.email}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end max-[419px]:justify-start w-full sm:w-auto">
              <Button size="sm" variant="outline" className="gap-1.5 min-h-11 flex-1 min-[420px]:flex-none" disabled={busy} onClick={() => void syncFromAccount()}>
                <RefreshCw className={cn("w-3.5 h-3.5", busy && "animate-spin")} />
                {t("accountSyncNow")}
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 min-h-11 hover:!text-danger" disabled={busy} onClick={() => void signOut()}>
                <LogOut className="w-3.5 h-3.5" />
                {t("accountSignOut")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 min-h-11 hover:!text-danger hover:!border-danger/40"
                disabled={busy}
                onClick={() => setConfirmDelete(true)}
                aria-label={t("accountDelete")}
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t("accountDelete")}
              </Button>
            </div>
          </div>

          {/* management rows: change password / devices / export */}
          <div className="grid gap-2 sm:grid-cols-3 max-w-2xl">
            <button
              type="button"
              onClick={() => setPwOpen(true)}
              className="md-state flex min-h-11 items-center gap-2 rounded-[var(--md-sys-shape-corner-small)] border border-edge-soft bg-raised px-3 md-body-small text-ink hover:text-accent"
            >
              <KeyRound className="w-4 h-4 text-ink-subtle" />
              {t("passwordTitle")}
            </button>
            <button
              type="button"
              onClick={() => setDevicesOpen((v) => !v)}
              aria-expanded={devicesOpen}
              className="md-state flex min-h-11 items-center gap-2 rounded-[var(--md-sys-shape-corner-small)] border border-edge-soft bg-raised px-3 md-body-small text-ink hover:text-accent"
            >
              <MonitorSmartphone className="w-4 h-4 text-ink-subtle" />
              {t("devicesTitle")}
              <ChevronDown className={cn("w-4 h-4 ms-auto transition-transform", devicesOpen && "rotate-180")} />
            </button>
            <button
              type="button"
              onClick={() => void doExport()}
              className="md-state flex min-h-11 items-center gap-2 rounded-[var(--md-sys-shape-corner-small)] border border-edge-soft bg-raised px-3 md-body-small text-ink hover:text-accent"
            >
              <Download className="w-4 h-4 text-ink-subtle" />
              {t("exportBtn")}
            </button>
          </div>

          {devicesOpen && (
            <div className="rounded-[var(--md-sys-shape-corner-small)] border border-edge-soft bg-canvas/40 p-3 max-h-72 overflow-y-auto" role="region" aria-label={t("devicesTitle")}>
              <p className="md-label-small text-ink-subtle mb-2">{t("devicesDesc")}</p>
              {devices === null ? (
                <div className="flex items-center gap-2 py-3">
                  <Loader2 className="w-4 h-4 animate-spin text-ink-subtle" />
                  <span className="md-body-small text-ink-subtle">{t("accountLoading")}</span>
                </div>
              ) : devices.length === 0 ? (
                <p className="md-body-small text-ink-subtle">{t("devicesEmpty")}</p>
              ) : (
                <ul className="space-y-2">
                  {devices.map((d) => (
                    <li key={d.id} className="flex items-center gap-2 flex-wrap rounded-[var(--md-sys-shape-corner-small)] border border-edge-soft bg-raised px-3 py-2">
                      <MonitorSmartphone className="w-4 h-4 text-ink-subtle shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="md-body-small text-ink truncate" dir="ltr">
                          {d.device}
                          {d.current && <span className="text-accent"> · {t("devicesCurrent")}</span>}
                        </p>
                        <p className="md-label-small text-ink-subtle" dir="auto">
                          {t("devicesLastSeen", { when: t.ago(new Date(d.lastSeenAt).getTime()) })}
                        </p>
                      </div>
                      {!d.current && (
                        <Button size="sm" variant="outline" className="min-h-9 hover:!text-danger" onClick={() => void revokeOne(d.id)}>
                          {t("devicesSignOut")}
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {devices && devices.length > 1 && (
                <Button size="sm" variant="outline" className="mt-2 min-h-11 hover:!text-danger" onClick={() => void signOutAll()}>
                  <LogOut className="w-3.5 h-3.5" />
                  {t("devicesSignOutAll")}
                </Button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {mode === "login" ? (
                  <UserRound className="w-4 h-4 text-ink-subtle" />
                ) : (
                  <UserPlus className="w-4 h-4 text-ink-subtle" />
                )}
                <h3 className="md-title-small text-ink">{t("accountTitle")}</h3>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-raised border border-edge-soft px-2 py-0.5 md-label-small text-ink-muted">
                  {t("accountNotSignedInChip")}
                </span>
              </div>
              <p className="md-body-small text-ink-muted max-w-md">
                {t("accountLoggedOutDesc")}
              </p>
            </div>
            <div className="flex rounded-[var(--md-sys-shape-corner-full)] border border-edge-soft bg-raised p-1 shrink-0" role="tablist" aria-label={t("accountModeLabel")}>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "login"}
                onClick={() => { setMode("login"); setError(null); }}
                className={cn(
                  "min-h-9 px-4 rounded-full md-label-medium transition-colors",
                  mode === "login" ? "bg-accent text-black" : "text-ink-muted hover:text-ink",
                )}
              >
                {t("accountTabSignIn")}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "register"}
                onClick={() => { setMode("register"); setError(null); }}
                className={cn(
                  "min-h-9 px-4 rounded-full md-label-medium transition-colors",
                  mode === "register" ? "bg-accent text-black" : "text-ink-muted hover:text-ink",
                )}
              >
                {t("accountTabCreate")}
              </button>
            </div>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2 max-w-xl">
            <div className="sm:col-span-2">
              <label htmlFor="horse-email" className="md-label-medium text-ink-muted mb-1 block">{t("accountEmail")}</label>
              <input
                id="horse-email"
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void submit()}
                className="md-field-outlined w-full px-3 min-h-11 text-sm text-ink"
                placeholder={t("accountEmailPlaceholder")}
                autoComplete={mode === "login" ? "email" : "email"}
                maxLength={254}
                spellCheck={false}
                dir="ltr"
              />
            </div>
            {mode === "register" && (
              <div className="sm:col-span-2">
                <label htmlFor="horse-display" className="md-label-medium text-ink-muted mb-1 block">{t("accountDisplayName")}</label>
                <input
                  id="horse-display"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void submit()}
                  className="md-field-outlined w-full px-3 min-h-11 text-sm text-ink"
                  placeholder={t("accountDisplayNamePlaceholder")}
                  autoComplete="nickname"
                  maxLength={40}
                />
              </div>
            )}
            <div className="sm:col-span-2">
              <label htmlFor="horse-password" className="md-label-medium text-ink-muted mb-1 block">{t("accountPassword")}</label>
              <div className="relative">
                <input
                  id="horse-password"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void submit()}
                  className="md-field-outlined w-full px-3 min-h-11 text-sm text-ink pe-11"
                  placeholder="••••••••••"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  maxLength={128}
                  aria-describedby="horse-password-hint"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute end-1.5 top-1/2 -translate-y-1/2 md-icon-btn !w-8 !h-8"
                  aria-label={showPw ? t("accountHidePassword") : t("accountShowPassword")}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {mode === "register" && password.length > 0 && (
                <div className="mt-1.5" aria-live="polite">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 rounded-full bg-raised overflow-hidden" role="progressbar" aria-label={t("accountStrengthLabel")} aria-valuenow={strength} aria-valuemin={0} aria-valuemax={3}>
                      <div className={cn("h-full rounded-full transition-all", strengthColor)} style={{ width: `${((strength + 1) / 4) * 100}%` }} />
                    </div>
                    <span className="md-label-small text-ink-subtle w-14 text-end">{strengthLabel}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {error && (
            <p role="alert" className="rounded-[var(--md-sys-shape-corner-small)] bg-[var(--md-sys-color-error-container)] text-[var(--md-sys-color-on-error-container)] md-body-small px-3 py-2 max-w-xl">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => void submit()}
              disabled={busy || !email.trim() || !password}
              className="md-btn-filled inline-flex items-center gap-2 min-h-11 px-5 disabled:opacity-50"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === "login" ? t("accountBtnSignIn") : t("accountBtnCreate")}
            </button>
            <span id="horse-password-hint" className="md-label-small text-ink-subtle">{t("accountPasswordHint")}</span>
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap max-w-xl">
            <label className="flex items-center gap-2 md-label-medium text-ink-muted cursor-pointer select-none">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-4 h-4 accent-[var(--md-sys-color-primary)]"
              />
              {t("accountRememberDevice")}
            </label>
            {mode === "login" && (
              <ForgotPasswordLink onDone={(msg, bad) => bad ? toast({ title: msg, variant: "destructive" }) : toast({ title: msg })} />
            )}
          </div>
        </div>
      )}

      {/* Merge-strategy dialog (spec: one-time decision on first login with local data) */}
      <Dialog open={mergeOpen} onOpenChange={(o) => { if (!o) { setMergeOpen(false); setPendingCreds(null); } }}>
        <DialogContent className="md-dialog max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-start">
              <DownloadCloud className="w-4 h-4 text-accent" />
              {t("mergeTitle")}
            </DialogTitle>
            <DialogDescription className="text-start">{t("mergeDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2" role="radiogroup" aria-label={t("mergeTitle")}>
            {([
              ["merge", t("mergeOptMerge"), t("mergeOptMergeDesc"), true],
              ["account", t("mergeOptAccount"), t("mergeOptAccountDesc"), false],
              ["local", t("mergeOptLocal"), t("mergeOptLocalDesc"), false],
            ] as [MergeChoice, string, string, boolean][]).map(([value, title, desc, recommended]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={mergeChoice === value}
                onClick={() => setMergeChoice(value)}
                className={cn(
                  "md-state w-full text-start rounded-[var(--md-sys-shape-corner-small)] border px-3 py-2.5 min-h-11",
                  mergeChoice === value ? "border-accent bg-accent-soft/40" : "border-edge-soft bg-raised",
                )}
              >
                <span className="flex items-center gap-2 md-label-large text-ink">
                  {title}
                  {recommended && <span className="rounded-full bg-accent/20 text-accent px-2 py-0.5 md-label-small">★</span>}
                </span>
                <span className="block md-body-small text-ink-muted mt-0.5">{desc}</span>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" className="min-h-11" onClick={() => { setMergeOpen(false); setPendingCreds(null); }}>
              {t("accountCancel")}
            </Button>
            <Button className="min-h-11 md-btn-filled" onClick={() => {
              if (!pendingCreds) return;
              if (mergeChoice === "local") {
                setMergeOverwrite(true);
                return;
              }
              void runLogin(pendingCreds.email, pendingCreds.password, mergeChoice);
            }}>
              {t("mergeConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Overwrite-account confirmation (local-wins) */}
      <AlertDialog open={mergeOverwrite} onOpenChange={setMergeOverwrite}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("mergeOverwriteConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>{t("mergeOverwriteDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">{t("accountCancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11 bg-danger text-white hover:bg-danger/90 focus-visible:ring-danger/40"
              onClick={() => {
                setMergeOverwrite(false);
                if (pendingCreds) void runLogin(pendingCreds.email, pendingCreds.password, "local");
              }}
            >
              {t("mergeOverwriteBtn")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Change-password dialog */}
      <Dialog open={pwOpen} onOpenChange={setPwOpen}>
        <DialogContent className="md-dialog max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-start">
              <KeyRound className="w-4 h-4 text-accent" />
              {t("passwordTitle")}
            </DialogTitle>
            <DialogDescription className="text-start">{t("accountResetDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <div>
              <label htmlFor="pw-current" className="md-label-medium text-ink-muted mb-1 block">{t("passwordCurrent")}</label>
              <input
                id="pw-current"
                type="password"
                value={pwCurrent}
                onChange={(e) => setPwCurrent(e.target.value)}
                className="md-field-outlined w-full px-3 min-h-11 text-sm text-ink"
                autoComplete="current-password"
              />
            </div>
            <div>
              <label htmlFor="pw-new" className="md-label-medium text-ink-muted mb-1 block">{t("passwordNew")}</label>
              <input
                id="pw-new"
                type="password"
                value={pwNew}
                onChange={(e) => setPwNew(e.target.value)}
                className="md-field-outlined w-full px-3 min-h-11 text-sm text-ink"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label htmlFor="pw-confirm" className="md-label-medium text-ink-muted mb-1 block">{t("passwordConfirm")}</label>
              <input
                id="pw-confirm"
                type="password"
                value={pwConfirm}
                onChange={(e) => setPwConfirm(e.target.value)}
                className="md-field-outlined w-full px-3 min-h-11 text-sm text-ink"
                autoComplete="new-password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" className="min-h-11" onClick={() => setPwOpen(false)}>{t("accountCancel")}</Button>
            <Button className="min-h-11 md-btn-filled" disabled={busy || !pwCurrent || pwNew.length < 10} onClick={() => void doChangePassword()}>
              {t("passwordBtn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete-account confirmation (danger) */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-danger" />
              {t("accountDeleteConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("accountDeleteConfirmDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">{t("accountCancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11 bg-danger text-white hover:bg-danger/90 focus-visible:ring-danger/40"
              onClick={() => void removeAccount()}
            >
              <Trash2 className="w-4 h-4" />
              {t("accountDeleteConfirmBtn")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Forgot-password inline dialog trigger (sign-in mode)
function ForgotPasswordLink({ onDone }: { onDone: (msg: string, bad?: boolean) => void }) {
  const t = useT();
  const forgotAction = useHorseAccount((s) => s.forgotPassword);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const em = email.trim().toLowerCase();
    if (!em || busy) return;
    setBusy(true);
    const res = await forgotAction(em);
    setBusy(false);
    if (res.ok) {
      setOpen(false);
      onDone(t("accountForgotDone"));
    } else {
      onDone(res.error ?? t("accountForgotUnavailable"), true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="md-label-medium text-accent hover:underline underline-offset-4 min-h-9"
      >
        {t("accountForgotPassword")}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="md-dialog max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-start">{t("accountForgotTitle")}</DialogTitle>
            <DialogDescription className="text-start">{t("accountForgotDesc")}</DialogDescription>
          </DialogHeader>
          <input
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void send()}
            className="md-field-outlined w-full px-3 min-h-11 text-sm text-ink"
            placeholder={t("accountEmailPlaceholder")}
            aria-label={t("accountEmail")}
            dir="ltr"
            maxLength={254}
          />
          <DialogFooter>
            <Button variant="ghost" className="min-h-11" onClick={() => setOpen(false)}>{t("accountCancel")}</Button>
            <Button className="min-h-11 md-btn-filled" disabled={busy || !email.trim()} onClick={() => void send()}>
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {t("accountForgotSend")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------- Cloud sync card ----------
function CloudSyncCard() {
  const t = useT();
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  const { toast } = useToast();
  const status = useCloudSync((s) => s.status);
  const lastSync = useCloudSync((s) => s.lastSync);
  const error = useCloudSync((s) => s.error);
  const pushNow = useCloudSync((s) => s.pushNow);
  const [storedSync, setStoredSync] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setStoredSync(lastSyncFromStorage()), 0);
    return () => clearTimeout(t);
  }, [status]);

  const enabled = settings.cloudSyncEnabled;
  const shownSync = lastSync ?? storedSync;

  const dot = !enabled
    ? "bg-ink-subtle"
    : status === "synced"
      ? "bg-emerald-400"
      : status === "syncing"
        ? "bg-amber-300 animate-pulse"
        : status === "error"
          ? "bg-danger"
          : "bg-ink-subtle";
  const statusLabel = !enabled
    ? t("syncStatusOff")
    : status === "synced"
      ? t("syncStatusSynced")
      : status === "syncing"
        ? t("syncStatusSyncing")
        : status === "error"
          ? t("syncStatusError")
          : t("syncStatusIdle");

  return (
    <div className="md-card-outlined rounded-[var(--md-sys-shape-corner-large)] p-5 relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" aria-hidden />
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {enabled ? <CloudUpload className="w-4 h-4 text-accent" /> : <CloudOff className="w-4 h-4 text-ink-subtle" />}
            <h3 className="md-title-small text-ink">{t("cloudSyncTitle")}</h3>
            <span className={cn("inline-flex items-center gap-1.5 rounded-full bg-raised border border-edge-soft px-2 py-0.5 md-label-small text-ink-muted")}>
              <span className={cn("w-1.5 h-1.5 rounded-full", dot)} aria-hidden />
              {statusLabel}
            </span>
          </div>
          <p className="md-body-small text-ink-muted max-w-md">
            {enabled
              ? "Addons, settings, themes, watchlist, continue-watching and history are stored on this server (SQLite). Sign in to Stremio to restore them in any browser; without an account, sync keys to this device."
              : "Sync is disabled. Your data stays in this browser only — export a backup if you want a second copy."}
          </p>
          {enabled && (
            <p className="mt-2 md-label-small text-ink-subtle flex items-center gap-1.5 flex-wrap">
              <ShieldCheck className="w-3.5 h-3.5" />
              Anonymous device key <code className="rounded bg-raised px-1 py-0.5">{deviceIdShort()}</code>
              {shownSync ? ` · last sync ${new Date(shownSync).toLocaleTimeString()}` : " · not synced yet"}
              {error && <span className="text-danger"> · {error}</span>}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Switch
            checked={enabled}
            onCheckedChange={(v) => {
              update({ cloudSyncEnabled: v });
              toast({ title: v ? t("cloudSyncTitle") : t("cloudSyncTitle"), description: v ? t("syncStatusSyncing") : t("syncStatusOff") });
              if (v) setTimeout(() => void useCloudSync.getState().boot(), 300);
            }}
            aria-label="Toggle cloud sync"
          />
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={!enabled || status === "syncing"}
            onClick={() =>
              void pushNow().then(() => toast({ title: "Synced", description: "Your library is up to date on the server." }))
            }
          >
            <RefreshCw className={cn("w-3.5 h-3.5", status === "syncing" && "animate-spin")} />
            Sync now
          </Button>
        </div>
      </div>
    </div>
  );
}

function AboutPanel() {
  const canInstall = usePwa((s) => s.canInstall);
  const installed = usePwa((s) => s.installed);
  const promptInstall = usePwa((s) => s.promptInstall);
  const { toast } = useToast();

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="md-card-outlined rounded-[var(--md-sys-shape-corner-large)] p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-2">
          {/* Brand lockup: primary galloping-horse mark + app name */}
          <div className="flex items-center gap-3">
            <HorseMark className="h-12 w-auto text-accent" label="Horse logo" />
            <h2 className="md-title-medium font-display font-bold text-ink">Horse</h2>
          </div>
          {canInstall && (
            <Button
              size="sm"
              onClick={() =>
                void promptInstall().then((r) => {
                  if (r === "accepted") toast({ title: "Installing Horse…", description: "Find it in your apps list." });
                })
              }
            >
              Install app
            </Button>
          )}
          {installed && <span className="md-label-small text-ink-subtle rounded-full border border-edge-soft px-2 py-1">Installed as app</span>}
        </div>
        <p className="md-body-medium text-ink-muted">
          An independent web client for the Stremio addon protocol — a web port of the Harbor
          desktop app by the Harbor project (github.com/harborstremio/harbor), MIT licensed.
        </p>
        <div className="mt-4 space-y-2 md-body-small text-ink-subtle">
          <p>
            Horse is an independent, open-source media center for the Stremio addon protocol.
            It is <span className="text-ink-muted font-medium">not affiliated with Stremio</span>.
            It hosts, indexes, and ships no media and bundles no content addons — users install
            their own addons.
          </p>
          <p>
            Licensed MIT. Attribution: Harbor desktop (github.com/harborstremio/harbor).
          </p>
          <p className="pt-1 border-t border-edge-soft mt-2">
            <TmdbAttribution />
          </p>
        </div>
      </div>
      <div className="md-card-outlined rounded-[var(--md-sys-shape-corner-large)] p-6">
        <h3 className="md-title-small text-ink mb-3">Keyboard shortcuts</h3>
        <div className="grid grid-cols-2 gap-2 md-body-small text-ink-muted">
          {[
            ["/", "Focus search"],
            ["Space", "Play / pause"],
            ["F", "Fullscreen"],
            ["← / →", "Seek ±10s"],
            ["↑ / ↓", "Volume"],
            ["M", "Mute"],
            ["S / C", "Cycle subtitles"],
            ["N / B", "Next / prev episode"],
            ["W", "Stream switcher"],
            ["E", "Episodes panel"],
            ["Esc", "Close player"],
            ["0–9", "Seek to %"],
            ["Backspace", "Back"],
          ].map(([key, label]) => (
            <div key={key} className="flex items-center gap-2">
              <kbd className="rounded bg-raised border border-edge-soft px-1.5 py-0.5 font-mono text-[10px] text-ink">{key}</kbd>
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- Integrations panel ----------

function IntegrationsPanel() {
  const loadLinks = useLinking((s) => s.load);
  const checkEnv = useLinking((s) => s.checkEnv);
  const tr = useT();
  useEffect(() => {
    loadLinks();
    void checkEnv();
  }, [loadLinks, checkEnv]);
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="md-title-medium font-display font-bold text-ink mb-1">{tr("integrationsTitle")}</h2>
        <p className="md-body-medium text-ink-muted">
          <RichBidi text={tr("integrationsIntro")} />
        </p>
      </div>
      <TraktCard />
      <SimklCard />
      <TmdbCard />
      <RatingsSettingsCard />
      <DebridCard />
      <P2pCard />
      <div className="md-card-outlined rounded-[var(--md-sys-shape-corner-large)] px-4 py-3.5 flex items-start gap-3">
        <ShieldCheck className="w-4.5 h-4.5 text-accent mt-0.5 shrink-0" />
        <p className="md-body-small text-ink-muted">
          <RichBidi text={tr("privacyNote")} />
        </p>
      </div>
    </div>
  );
}

function TraktCard() {
  const { toast } = useToast();
  const tr = useT();
  const auth = useTrakt((s) => s.auth);
  const phase = useTrakt((s) => s.phase);
  const device = useTrakt((s) => s.device);
  const error = useTrakt((s) => s.error);
  const importing = useTrakt((s) => s.importing);
  const loaded = useTrakt((s) => s.loaded);
  const load = useTrakt((s) => s.load);
  const pollOnce = useTrakt((s) => s.pollOnce);
  const cancelConnect = useTrakt((s) => s.cancelConnect);
  const disconnect = useTrakt((s) => s.disconnect);
  const importWatchlist = useTrakt((s) => s.importWatchlist);
  const importingHistory = useTrakt((s) => s.importingHistory);
  const importHistory = useTrakt((s) => s.importHistory);
  const scrobbleEnabled = useTrakt((s) => s.scrobbleEnabled);
  const setScrobbleEnabled = useTrakt((s) => s.setScrobbleEnabled);
  const pushing = useTrakt((s) => s.pushing);
  const pushEnabled = useTrakt((s) => s.pushEnabled);
  const pushWatchlist = useTrakt((s) => s.pushWatchlist);
  const setPushEnabled = useTrakt((s) => s.setPushEnabled);

  const [wlCount, setWlCount] = useState<number | null>(null);
  const [histCount, setHistCount] = useState<number | null>(null);
  const [pushCount, setPushCount] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, [load]);

  // Install the watchlist auto-push listener once (module-level singleton).
  useEffect(() => installTraktPushSync(), []);

  // Poll Trakt while a device code is active
  useEffect(() => {
    if (phase !== "connecting" || !device) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      if (!alive) return;
      const result = await pollOnce();
      if (!alive) return;
      if (result === "authorized") {
        toast({ title: "Trakt connected", description: "You can now import your watchlist." });
        return; // stop polling
      }
      if (result === "pending") {
        timer = setTimeout(tick, 5000);
      }
      // "failed" → phase reset by store; stop
    };
    timer = setTimeout(tick, 5000);
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [phase, device, pollOnce, toast]);

  const doImport = async () => {
    const added = await importWatchlist();
    if (added >= 0) {
      setWlCount(added);
      toast({
        title: added > 0 ? `Imported ${added} ${added === 1 ? "title" : "titles"}` : "Watchlist already up to date",
        description: added > 0 ? "Merged into your Library watchlist." : undefined,
      });
    } else {
      toast({ title: "Import failed", description: useTrakt.getState().error ?? undefined, variant: "destructive" });
    }
  };

  const doImportHistory = async () => {
    const added = await importHistory();
    if (added >= 0) {
      setHistCount(added);
      toast({
        title: added > 0 ? `Imported ${added} ${added === 1 ? "play" : "plays"}` : "History already up to date",
        description: added > 0 ? "Merged into your playback history." : undefined,
      });
    } else {
      toast({ title: "History import failed", description: useTrakt.getState().error ?? undefined, variant: "destructive" });
    }
  };

  const doPush = async () => {
    const res = await pushWatchlist();
    if (res === null) {
      toast({ title: "Push failed", description: useTrakt.getState().error ?? undefined, variant: "destructive" });
      return;
    }
    if (res === "empty") {
      setPushCount(null);
      toast({
        title: "Nothing to push",
        description: "Your watchlist has no imdb-backed titles — install Cinemeta metadata to get imdb ids.",
      });
      return;
    }
    const total = res.pushed + res.notFound;
    setPushCount(
      res.notFound > 0
        ? `Last push: +${res.pushed} · ${res.notFound} not on Trakt`
        : `Last push: +${total}`,
    );
    toast({
      title: res.pushed > 0 ? `Pushed ${res.pushed} ${total === 1 ? "title" : "titles"} to Trakt` : "Trakt watchlist already up to date",
      description: res.notFound > 0 ? `${res.notFound} ${res.notFound === 1 ? "title" : "titles"} couldn't be matched on Trakt.` : undefined,
    });
  };

  if (!loaded) return null;

  return (
    <div className="md-card-outlined rounded-[var(--md-sys-shape-corner-large)] p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-1">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-accent-soft flex items-center justify-center">
            <Plug className="w-5 h-5 text-accent" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-ink">Trakt.tv</h3>
            <p className="text-xs text-ink-subtle">
              {auth ? (auth.username ? tr("connectedAs", { name: auth.username }) : tr("connectedTitle", { name: "Trakt.tv" })) : tr("importTraktWatchlist")}
            </p>
          </div>
        </div>
        {auth && (
          <button
            type="button"
            onClick={() => {
              disconnect();
              setWlCount(null);
              setHistCount(null);
              toast({ title: "Trakt disconnected" });
            }}
            className="md-btn-text harbor-tv-focus !h-9 px-3 text-xs font-semibold text-ink-muted hover:text-danger transition-colors"
          >
            <Unplug className="w-3.5 h-3.5" /> Disconnect
          </button>
        )}
      </div>

      {!auth && phase !== "connecting" && (
        <LinkAccountFlow service="trakt" />
      )}

      {phase === "connecting" && device && (
        <div className="mt-4 rounded-[var(--md-sys-shape-corner-large)] bg-[var(--md-sys-color-surface-container)] p-4">
          <p className="md-body-small text-ink-muted mb-2">
            Visit{" "}
            <a
              href={device.verificationUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="text-accent font-semibold underline underline-offset-2"
            >
              {device.verificationUrl.replace(/^https?:\/\//, "")}
            </a>{" "}
            and enter this code:
          </p>
          <div className="flex items-center gap-4 flex-wrap">
            <span className="font-mono text-3xl font-bold tracking-[0.3em] text-accent select-all" aria-label="Device code">
              {device.userCode}
            </span>
            <span className="flex items-center gap-2 md-body-small text-ink-muted">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Waiting for authorization…
            </span>
            <button
              type="button"
              onClick={() => {
                cancelConnect();
                toast({ title: "Trakt connection cancelled" });
              }}
              className="md-btn-text ms-auto !h-9 text-xs font-semibold text-ink-muted hover:text-ink"
            >
              <Square className="w-3 h-3" /> Cancel
            </button>
          </div>
        </div>
      )}

      {auth && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <Button onClick={doImport} disabled={importing} className="md-btn-filled">
                {importing ? <Loader2 className="w-4 h-4 me-1.5 animate-spin" /> : <DownloadCloud className="w-4 h-4 me-1.5" />}
                Import watchlist
              </Button>
              <span className="text-xs text-ink-subtle">
                {wlCount !== null
                  ? `Last import: +${wlCount} new`
                  : `Local watchlist has ${getWatchlistLength()} titles`}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={doImportHistory} disabled={importingHistory} className="md-btn-filled">
                {importingHistory ? <Loader2 className="w-4 h-4 me-1.5 animate-spin" /> : <History className="w-4 h-4 me-1.5" />}
                Import history
              </Button>
              {histCount !== null && <span className="text-xs text-ink-subtle">Last import: +{histCount} plays</span>}
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={doPush} disabled={pushing} className="md-btn-filled">
                {pushing ? <Loader2 className="w-4 h-4 me-1.5 animate-spin" /> : <UploadCloud className="w-4 h-4 me-1.5" />}
                Push watchlist
              </Button>
              {pushCount !== null && <span className="text-xs text-ink-subtle">{pushCount}</span>}
            </div>
            {error && <span className="text-xs text-danger w-full">{error}</span>}
          </div>
          <div className="flex items-center gap-3 w-fit">
            <Switch
              id="trakt-scrobble"
              checked={scrobbleEnabled}
              onCheckedChange={setScrobbleEnabled}
              aria-label="Scrobble to Trakt while playing"
            />
            <label
              htmlFor="trakt-scrobble"
              className="text-xs text-ink-muted cursor-pointer select-none"
            >
              Scrobble to Trakt while playing
            </label>
          </div>
          <div className="flex items-start gap-3 w-fit">
            <Switch
              id="trakt-push"
              checked={pushEnabled}
              onCheckedChange={(v) => {
                setPushEnabled(v);
                if (v) {
                  setPushCount(null);
                  toast({
                    title: "Watchlist sync on",
                    description: "Titles you add to your watchlist from now on are pushed to Trakt automatically.",
                  });
                }
              }}
              aria-label="Keep watchlist in sync with Trakt"
            />
            <div className="max-w-md">
              <label
                htmlFor="trakt-push"
                className="text-xs text-ink-muted cursor-pointer select-none block"
              >
                Keep watchlist in sync (push additions to Trakt)
              </label>
              <p className="text-[11px] text-ink-subtle mt-0.5">
                One-way: additions flow to Trakt a few seconds after you add them. Imports from Trakt
                are never pushed back, and nothing is ever removed from your Trakt list.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SimklCard() {
  const { toast } = useToast();
  const tr = useT();
  const auth = useSimkl((s) => s.auth);
  const phase = useSimkl((s) => s.phase);
  const pin = useSimkl((s) => s.pin);
  const error = useSimkl((s) => s.error);
  const importing = useSimkl((s) => s.importing);
  const loaded = useSimkl((s) => s.loaded);
  const load = useSimkl((s) => s.load);
  const pollOnce = useSimkl((s) => s.pollOnce);
  const cancelConnect = useSimkl((s) => s.cancelConnect);
  const disconnect = useSimkl((s) => s.disconnect);
  const importWatchlist = useSimkl((s) => s.importWatchlist);
  const importingHistory = useSimkl((s) => s.importingHistory);
  const importHistory = useSimkl((s) => s.importHistory);

  const [wlCount, setWlCount] = useState<number | null>(null);
  const [histCount, setHistCount] = useState<number | null>(null);

  useEffect(() => {
    load();
  }, [load]);

  // Poll Simkl while a PIN code is active
  useEffect(() => {
    if (phase !== "connecting" || !pin) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      if (!alive) return;
      const result = await pollOnce();
      if (!alive) return;
      if (result === "authorized") {
        toast({ title: "Simkl connected", description: "You can now import your watchlist." });
        return; // stop polling
      }
      if (result === "pending") {
        timer = setTimeout(tick, 5000);
      }
      // "failed" → phase reset by store; stop
    };
    timer = setTimeout(tick, 5000);
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [phase, pin, pollOnce, toast]);

  const doImport = async () => {
    const added = await importWatchlist();
    if (added >= 0) {
      setWlCount(added);
      toast({
        title: added > 0 ? `Imported ${added} ${added === 1 ? "title" : "titles"}` : "Watchlist already up to date",
        description: added > 0 ? "Merged into your Library watchlist." : undefined,
      });
    } else {
      toast({ title: "Import failed", description: useSimkl.getState().error ?? undefined, variant: "destructive" });
    }
  };

  const doImportHistory = async () => {
    const added = await importHistory();
    if (added >= 0) {
      setHistCount(added);
      toast({
        title: added > 0 ? `Imported ${added} ${added === 1 ? "play" : "plays"}` : "History already up to date",
        description: added > 0 ? "Merged into your playback history." : undefined,
      });
    } else {
      toast({ title: "History import failed", description: useSimkl.getState().error ?? undefined, variant: "destructive" });
    }
  };

  if (!loaded) return null;

  return (
    <div className="md-card-outlined rounded-[var(--md-sys-shape-corner-large)] p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-1">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-accent-soft flex items-center justify-center">
            <TvMinimalPlay className="w-5 h-5 text-accent" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-ink">Simkl</h3>
            <p className="text-xs text-ink-subtle">
              {auth ? (auth.username ? tr("connectedAs", { name: auth.username }) : tr("connectedTitle", { name: "Simkl" })) : tr("importSimklWatchlist")}
            </p>
          </div>
        </div>
        {auth && (
          <button
            type="button"
            onClick={() => {
              disconnect();
              setWlCount(null);
              setHistCount(null);
              toast({ title: "Simkl disconnected" });
            }}
            className="md-btn-text harbor-tv-focus !h-9 px-3 text-xs font-semibold text-ink-muted hover:text-danger transition-colors"
          >
            <Unplug className="w-3.5 h-3.5" /> Disconnect
          </button>
        )}
      </div>

      {!auth && phase !== "connecting" && (
        <LinkAccountFlow service="simkl" />
      )}

      {phase === "connecting" && pin && (
        <div className="mt-4 rounded-[var(--md-sys-shape-corner-large)] bg-[var(--md-sys-color-surface-container)] p-4">
          <p className="md-body-small text-ink-muted mb-2">
            Visit{" "}
            <a
              href={pin.verificationUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="text-accent font-semibold underline underline-offset-2"
            >
              {pin.verificationUrl.replace(/^https?:\/\//, "")}
            </a>{" "}
            and enter this code:
          </p>
          <div className="flex items-center gap-4 flex-wrap">
            <span className="font-mono text-3xl font-bold tracking-[0.3em] text-accent select-all" aria-label="PIN code">
              {pin.userCode}
            </span>
            <span className="flex items-center gap-2 md-body-small text-ink-muted">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Waiting for authorization…
            </span>
            <button
              type="button"
              onClick={() => {
                cancelConnect();
                toast({ title: "Simkl connection cancelled" });
              }}
              className="md-btn-text ms-auto !h-9 text-xs font-semibold text-ink-muted hover:text-ink"
            >
              <Square className="w-3 h-3" /> Cancel
            </button>
          </div>
        </div>
      )}

      {auth && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <Button onClick={doImport} disabled={importing} className="md-btn-filled">
                {importing ? <Loader2 className="w-4 h-4 me-1.5 animate-spin" /> : <DownloadCloud className="w-4 h-4 me-1.5" />}
                Import watchlist
              </Button>
              <span className="text-xs text-ink-subtle">
                {wlCount !== null
                  ? `Last import: +${wlCount} new`
                  : `Local watchlist has ${getWatchlistLength()} titles`}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={doImportHistory} disabled={importingHistory} className="md-btn-filled">
                {importingHistory ? <Loader2 className="w-4 h-4 me-1.5 animate-spin" /> : <History className="w-4 h-4 me-1.5" />}
                Import history
              </Button>
              {histCount !== null && <span className="text-xs text-ink-subtle">Last import: +{histCount} plays</span>}
            </div>
            {error && <span className="text-xs text-danger w-full">{error}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function DebridCard() {
  const { toast } = useToast();
  const service = useDebrid((s) => s.service);
  const apiKey = useDebrid((s) => s.apiKey);
  const username = useDebrid((s) => s.username);
  const premium = useDebrid((s) => s.premium);
  const expiresAt = useDebrid((s) => s.expiresAt);
  const status = useDebrid((s) => s.status);
  const loaded = useDebrid((s) => s.loaded);
  const error = useDebrid((s) => s.error);
  const load = useDebrid((s) => s.load);
  const validate = useDebrid((s) => s.validate);
  const disconnect = useDebrid((s) => s.disconnect);

  const [svcOverride, setSvcOverride] = useState<DebridService | null>(null);
  const [key, setKey] = useState("");
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    load();
  }, [load]);

  const svc: DebridService = svcOverride ?? (loaded ? service : "realdebrid");

  const serviceName = svc === "realdebrid" ? "Real-Debrid" : "AllDebrid";
  const isConnected = apiKey !== null && service === svc;

  const doValidate = async () => {
    if (!key.trim()) {
      toast({ title: "Paste your API key first", variant: "destructive" });
      return;
    }
    setChecking(true);
    const ok = await validate(svc, key.trim());
    setChecking(false);
    if (ok) {
      setKey("");
      toast({ title: "Debrid connected", description: `${serviceName} account verified.` });
    } else {
      toast({
        title: "Validation failed",
        description: useDebrid.getState().error ?? undefined,
        variant: "destructive",
      });
    }
  };

  if (!loaded) return null;

  return (
    <div className="md-card-outlined rounded-[var(--md-sys-shape-corner-large)] p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-accent-soft flex items-center justify-center">
            <KeyRound className="w-5 h-5 text-accent" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-ink">Debrid</h3>
            <p className="text-xs text-ink-subtle">
              {isConnected
                ? `Connected${username ? ` as ${username}` : ""}`
                : "Unlock cached torrent streams instantly"}
            </p>
          </div>
        </div>
        {isConnected && (
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-[10px] font-bold",
              premium ? "bg-accent-soft text-accent" : "bg-raised text-ink-muted",
            )}
          >
            {premium ? "Premium" : "Non-premium"}
          </span>
        )}
      </div>

      {/* Service segmented control (M3: secondary-container track, primary-container selected) */}
      <div
        className="inline-flex rounded-full bg-[var(--md-sys-color-secondary-container)] p-1 w-fit mb-4"
        role="tablist"
        aria-label="Debrid service"
      >
        {(
          [
            ["realdebrid", "Real-Debrid"],
            ["alldebrid", "AllDebrid"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={svc === id}
            onClick={() => setSvcOverride(id)}
            className={cn(
              "md-state harbor-tv-focus rounded-full min-h-10 px-4 py-1.5 md-label-large transition-colors",
              svc === id
                ? "bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)]"
                : "text-[var(--md-sys-color-on-secondary-container)]",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {isConnected ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-semibold text-ink">
              {username ?? serviceName}
            </span>
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-[10px] font-bold",
                premium ? "bg-accent-soft text-accent" : "bg-raised text-ink-muted",
              )}
            >
              {premium ? "Premium" : "Non-premium"}
            </span>
            {expiresAt !== null && Number.isFinite(expiresAt) && (
              <span className="text-xs text-ink-subtle">
                Expires {new Date(expiresAt).toLocaleDateString()}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              disconnect();
              setKey("");
              toast({ title: `${serviceName} disconnected` });
            }}
            className="md-btn-text harbor-tv-focus !h-9 px-3 text-xs font-semibold text-ink-muted hover:text-danger transition-colors"
          >
            <Unplug className="w-3.5 h-3.5" /> Disconnect
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="block md-label-medium text-ink-muted mb-1.5" htmlFor="debrid-api-key">
              {serviceName} API key
            </label>
            <Input
              id="debrid-api-key"
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={svc === "realdebrid" ? "Your Real-Debrid API key" : "Your AllDebrid API key"}
              className="md-field-outlined px-3 font-mono text-xs bg-transparent"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <p className="text-xs text-ink-subtle">
            Find it on your{" "}
            <a
              href={svc === "realdebrid" ? "https://real-debrid.com/account" : "https://alldebrid.com/api/"}
              target="_blank"
              rel="noreferrer noopener"
              className="text-accent underline underline-offset-2"
            >
              {svc === "realdebrid" ? "real-debrid.com/account" : "alldebrid.com/api"}
            </a>{" "}
            page, then validate it here.
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <Button onClick={doValidate} disabled={checking} className="md-btn-filled">
              {checking ? <Loader2 className="w-4 h-4 me-1.5 animate-spin" /> : <ShieldCheck className="w-4 h-4 me-1.5" />}
              Validate
            </Button>
            {status === "invalid" && error && (
              <span className="text-xs text-danger" role="alert">
                {error}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-edge-soft space-y-2">
        <p className="text-xs text-ink-subtle">
          Your key is stored in this browser only and relayed server-side per request. Torrent streams
          cached by the service unlock instantly; uncached torrents are skipped (honest error).
        </p>
        <p className="flex items-center gap-2 text-[11px] text-ink-subtle">
          <Zap className="w-3.5 h-3.5 text-accent shrink-0" />
          <span>
            Streams unlocked with Debrid — resolved links live only for the current session; nothing is
            counted or stored.
          </span>
        </p>
      </div>
    </div>
  );
}


// ---------- P2P torrent engine (server-side webtorrent) ----------

type P2pHealthState = {
  ok: boolean;
  paused: boolean;
  torrents: { key: string; name: string | null; ready: boolean; progress: number; peers: number; downloadSpeed: number }[];
};

// Operator docs for self-hosting the torrent engine (also rendered in deploy/README.md).
const DEPLOY_GUIDE_URL = "https://github.com/hoseain756/Horse/blob/main/deploy/README.md";
// $0 always-on hosting walkthrough (Oracle Always Free + Cloudflare Tunnel) + the
// documented proof of why the engine can never run on Vercel functions itself.
const FREE_HOSTING_GUIDE_URL = "https://github.com/hoseain756/Horse/blob/main/deploy/HOSTING-FREE.md";
const ENGINE_ENV_VARS = ["ENGINE_URL", "ENGINE_PUBLIC_URL", "ENGINE_API_KEY"] as const;
type EngineTestState = "idle" | "testing" | "ok" | "unset" | "unreachable" | "unauthorized";
type LocalTestState = "idle" | "testing" | "ok" | "unreachable" | "unauthorized" | "badurl";

// Free path for serverless deployments: the engine runs on the USER's own
// computer (one command); the browser talks to it directly over localhost —
// config lives in localStorage (this device only, never cloud-synced).

function P2pCard() {
  const { toast } = useToast();
  const tr = useT();
  const p2pEnabled = useSettings((s) => s.settings.p2pEnabled);
  const update = useSettings((s) => s.update);
  const [health, setHealth] = useState<P2pHealthState | null>(null);
  const [checking, setChecking] = useState(false);
  const [clearing, setClearing] = useState(false);
  // Deployment truth from /api/media/capabilities: "builtin" (engine beside the
  // app), "external" (ENGINE_URL self-hosted), "none" (serverless, no engine).
  const [mode, setMode] = useState<TorrentMode | null>(null);
  const [engineHost, setEngineHost] = useState<string | null>(null);
  const [testState, setTestState] = useState<EngineTestState>("idle");
  // Device-local engine (browser-direct)
  const [localCfg, setLocalCfg] = useState<LocalEngineConfig | null>(null);
  const [localUrl, setLocalUrl] = useState("http://localhost:3031");
  const [localKey, setLocalKey] = useState("");
  const [localTest, setLocalTest] = useState<LocalTestState>("idle");

  const check = async () => {
    setChecking(true);
    try {
      const h = await p2pHealth();
      setHealth({
        ok: !!h.ok,
        paused: h.paused === true,
        torrents: (h.torrents ?? []).map((t) => ({
          key: t.key,
          name: t.name,
          ready: t.ready,
          progress: t.progress,
          peers: t.peers,
          downloadSpeed: t.downloadSpeed,
        })),
      });
    } catch {
      setHealth({ ok: false, paused: false, torrents: [] });
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    void serverCapabilities().then((c) => {
      setMode(c.torrent);
      const local = getLocalEngine();
      setLocalCfg(local);
      if (local) {
        setLocalUrl(local.base);
        setLocalKey(local.key);
      }
      // Serverless without a local engine: no engine can ever exist — skip the probe.
      if (c.torrent === "none" && !local) setHealth(null);
      if (c.enginePublicUrl) {
        try {
          setEngineHost(new URL(c.enginePublicUrl).host);
        } catch {
          setEngineHost(c.enginePublicUrl);
        }
      }
      // Probe the engine only where one can actually exist (builtin/external/local);
      // in external mode the JSON health call relays server-side with the key.
      if (c.torrent !== "none" || local) void check();
    });
  }, []);

  // Direct relay test — works for external engines and for diagnosing a
  // serverless deployment where ENGINE_URL is (not yet) configured.
  const testEngine = async () => {
    setTestState("testing");
    try {
      const res = await fetch("/api/engine/health", { signal: AbortSignal.timeout(15_000), cache: "no-store" });
      if (res.ok) setTestState("ok");
      else if (res.status === 404) setTestState("unset");
      else if (res.status === 401 || res.status === 403) setTestState("unauthorized");
      else setTestState("unreachable");
    } catch {
      setTestState("unreachable");
    }
  };

  const doCleanup = async (purge: boolean) => {
    setClearing(true);
    try {
      await p2pCleanup(purge);
      toast({
        title: purge ? tr("cacheWiped") : tr("torrentsStopped"),
        description: purge ? tr("cacheWipedBody") : tr("torrentsStoppedBody"),
      });
      void check();
    } catch (e) {
      toast({ title: tr("cleanupFailed"), description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setClearing(false);
    }
  };

  const serverless = mode === "none" && !localCfg;
  const localActive = mode === "none" && !!localCfg;
  const activeCount = health?.torrents.length ?? 0;
  const totalSpeed = health?.torrents.reduce((a, t) => a + (t.downloadSpeed ?? 0), 0) ?? 0;

  // Test the engine DIRECTLY from this browser before saving — a typo never
  // gets persisted, and success immediately flips the effective torrent mode
  // to "local" (cachedTorrentMode folds it in) so playback unlocks at once.
  const saveLocalEngine = async () => {
    const base = localUrl.trim();
    try {
      const u = new URL(base);
      if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("bad protocol");
    } catch {
      setLocalTest("badurl");
      return;
    }
    setLocalTest("testing");
    const probe = await localEngineHealth({ base: base.replace(/\/+$/, ""), key: localKey.trim() });
    if (!probe.ok) {
      setLocalTest(probe.unauthorized ? "unauthorized" : "unreachable");
      return;
    }
    const cfg = setLocalEngine(base, localKey);
    setLocalCfg(cfg);
    setLocalTest("ok");
    if (cfg) {
      void refreshP2pCapabilities(); // engine-level HEVC flag (local branch)
      void check();
    }
    toast({ title: tr("localEngineSaved") });
  };

  const removeLocalEngine = () => {
    clearLocalEngine();
    setLocalCfg(null);
    setLocalTest("idle");
    setHealth(null);
    toast({ title: tr("localEngineRemoved") });
  };

  const localFeedback =
    localTest === "ok" ? (
      <p
        className="flex items-start gap-2 rounded-[var(--md-sys-shape-corner-medium)] bg-accent-soft px-3.5 py-2.5 text-xs font-semibold text-accent"
        role="status"
      >
        <Check className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
        <RichBidi text={tr("localEngineTestOk")} />
      </p>
    ) : localTest === "badurl" ? (
      <p
        className="flex items-start gap-2 rounded-[var(--md-sys-shape-corner-medium)] bg-[var(--md-sys-color-error-container)] px-3.5 py-2.5 text-[var(--md-sys-color-on-error-container)] md-body-small"
        role="alert"
      >
        <CircleAlert className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
        <RichBidi text={tr("localEngineTestBad")} />
      </p>
    ) : localTest === "unreachable" || localTest === "unauthorized" ? (
      <p
        className="flex items-start gap-2 rounded-[var(--md-sys-shape-corner-medium)] bg-[var(--md-sys-color-error-container)] px-3.5 py-2.5 text-[var(--md-sys-color-on-error-container)] md-body-small"
        role="alert"
      >
        <CircleAlert className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
        <RichBidi text={tr(localTest === "unreachable" ? "localEngineTestUnreachable" : "localEngineTestUnauthorized")} />
      </p>
    ) : null;

  const testFeedback =
    testState === "ok" ? (
      <p
        className="flex items-start gap-2 rounded-[var(--md-sys-shape-corner-medium)] bg-accent-soft px-3.5 py-2.5 text-xs font-semibold text-accent"
        role="status"
      >
        <Check className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
        <RichBidi text={tr("engineTestOk")} />
      </p>
    ) : testState === "unset" ? (
      <p
        className="flex items-start gap-2 rounded-[var(--md-sys-shape-corner-medium)] bg-[var(--md-sys-color-surface-container-highest)] px-3.5 py-2.5 text-xs text-ink-muted"
        role="status"
      >
        <Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
        <RichBidi text={tr("engineTestUnset")} />
      </p>
    ) : testState === "unreachable" || testState === "unauthorized" ? (
      <p
        className="flex items-start gap-2 rounded-[var(--md-sys-shape-corner-medium)] bg-[var(--md-sys-color-error-container)] px-3.5 py-2.5 text-[var(--md-sys-color-on-error-container)] md-body-small"
        role="alert"
      >
        <CircleAlert className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
        <RichBidi text={tr(testState === "unreachable" ? "engineTestUnreachable" : "engineTestUnauthorized")} />
      </p>
    ) : null;

  const testControls = (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" onClick={() => void testEngine()} disabled={testState === "testing"}>
          {testState === "testing" ? (
            <Loader2 className="w-4 h-4 me-1.5 animate-spin" />
          ) : (
            <Zap className="w-3.5 h-3.5 me-1.5" />
          )}
          {tr("engineTest")}
        </Button>
        <a
          href={DEPLOY_GUIDE_URL}
          target="_blank"
          rel="noreferrer"
          className="md-state harbor-tv-focus inline-flex h-10 items-center gap-1.5 rounded-full border border-edge px-4 text-xs font-semibold text-ink-muted transition-colors hover:border-accent hover:text-accent"
        >
          <ExternalLink className="w-3.5 h-3.5" aria-hidden />
          {tr("engineSetupGuide")}
        </a>
        <a
          href={FREE_HOSTING_GUIDE_URL}
          target="_blank"
          rel="noreferrer"
          className="md-state harbor-tv-focus inline-flex h-10 items-center gap-1.5 rounded-full border border-edge px-4 text-xs font-semibold text-ink-muted transition-colors hover:border-accent hover:text-accent"
        >
          <Server className="w-3.5 h-3.5" aria-hidden />
          {tr("freeHostingGuide")}
        </a>
      </div>
      {testFeedback}
    </>
  );

  return (
    <div className="harbor-cq md-card-outlined rounded-[var(--md-sys-shape-corner-large)] p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-accent-soft flex items-center justify-center">
            <Network className="w-5 h-5 text-accent" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-ink">{tr("p2pTitle")}</h3>
            <p className="text-xs text-ink-subtle"><RichBidi text={tr("p2pSubtitle")} /></p>
          </div>
        </div>
        {/* Status chip — M3 semantic tokens (error-container for unavailable state) */}
        <span
          className={cn(
            "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold",
            mode === null || (health === null && !serverless)
              ? "bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface-variant)]"
              : serverless || health?.ok === false
                ? "bg-[var(--md-sys-color-error-container)] text-[var(--md-sys-color-on-error-container)]"
                : "bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)]",
          )}
          role="status"
        >
          <span
            aria-hidden
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              mode === null || (health === null && !serverless)
                ? "bg-[var(--md-sys-color-outline)]"
                : serverless || health?.ok === false
                  ? "bg-[var(--md-sys-color-error)]"
                  : "bg-[var(--md-sys-color-primary)]",
            )}
          />
          {serverless
            ? tr("engineChipNone")
            : localActive
              ? tr("localEngineChip")
              : mode === "external"
                ? tr("engineChipExternal")
                : health === null
                  ? tr("checking")
                  : health.ok
                    ? tr("online", { n: P2P_PORT })
                    : tr("offline")}
        </span>
      </div>

      {/* Engine host (external mode) */}
      {mode === "external" && engineHost && (
        <p className="mb-3 flex items-center gap-1.5 text-[11px] text-ink-subtle">
          <Server className="w-3.5 h-3.5 shrink-0" aria-hidden />
          {tr("engineHostLabel")}:{" "}
          <code className="rounded-md bg-[var(--md-sys-color-surface-container-high)] px-1.5 py-0.5 font-mono text-[10px] text-ink" dir="ltr">
            {engineHost}
          </code>
        </p>
      )}

      {/* Engine host (device-local mode) */}
      {localActive && localCfg && (
        <p className="mb-3 flex items-center gap-1.5 text-[11px] text-ink-subtle">
          <MonitorSmartphone className="w-3.5 h-3.5 shrink-0" aria-hidden />
          {tr("localEngineUrlLabel")}:{" "}
          <code className="rounded-md bg-[var(--md-sys-color-surface-container-high)] px-1.5 py-0.5 font-mono text-[10px] text-ink" dir="ltr">
            {localCfg.base}
          </code>
        </p>
      )}

      {!serverless && (
        <div className="harbor-setting-row rounded-[var(--md-sys-shape-corner-medium)] bg-[var(--md-sys-color-surface-container-high)] px-3.5 py-3">
          <div className="harbor-setting-row-label">
            <p className="md-label-large text-ink">{tr("p2pToggle")}</p>
            <p className="md-body-small text-ink-muted"><RichBidi text={tr("p2pToggleDesc")} /></p>
          </div>
          <div className="harbor-setting-row-control">
            <Switch
              checked={p2pEnabled}
              onCheckedChange={(v) => update({ p2pEnabled: v })}
              aria-label={tr("p2pAria")}
            />
          </div>
        </div>
      )}

      {/* Serverless deployment: honest setup panel instead of a dead-end error */}
      {serverless && (
        <div
          className="mt-4 rounded-[var(--md-sys-shape-corner-medium)] bg-[var(--md-sys-color-surface-container-high)] px-3.5 py-3.5 space-y-3"
          role="note"
        >
          <p className="text-xs font-bold text-ink">{tr("engineServerlessTitle")}</p>
          <p className="md-body-small text-ink-muted"><RichBidi text={tr("engineServerlessBody")} /></p>
          <ul className="space-y-2.5">
            <li className="flex gap-2 text-xs text-ink-muted">
              <KeyRound className="w-3.5 h-3.5 shrink-0 mt-0.5 text-accent" aria-hidden />
              <span className="flex-1"><RichBidi text={tr("engineDebridOption")} /></span>
            </li>
            <li className="flex gap-2 text-xs text-ink-muted">
              <Server className="w-3.5 h-3.5 shrink-0 mt-0.5 text-accent" aria-hidden />
              <span className="flex-1">
                <RichBidi text={tr("engineSelfhostOption")} />
                <span className="mt-1.5 flex flex-wrap gap-1.5">
                  {ENGINE_ENV_VARS.map((v) => (
                    <code
                      key={v}
                      className="rounded-md bg-[var(--md-sys-color-surface-container-highest)] px-1.5 py-0.5 font-mono text-[10px] text-ink"
                      dir="ltr"
                    >
                      {v}
                    </code>
                  ))}
                </span>
              </span>
            </li>
            <li className="flex gap-2 text-xs text-ink-muted">
              <MonitorSmartphone className="w-3.5 h-3.5 shrink-0 mt-0.5 text-accent" aria-hidden />
              <span className="flex-1"><RichBidi text={tr("engineLocalOption")} /></span>
            </li>
          </ul>
          {testControls}
        </div>
      )}

      {/* Option 3 — free local engine, browser-direct (device-only config).
          Shown in serverless mode (setup) AND while connected (manage/remove). */}
      {mode === "none" && (
        <div
          className={cn(
            "space-y-2.5 rounded-[var(--md-sys-shape-corner-medium)] border border-edge-soft bg-[var(--md-sys-color-surface-container)] p-3",
            serverless ? "mt-3" : "mt-4",
          )
          }
        >
            <div className="flex items-center gap-2">
              <MonitorSmartphone className="w-4 h-4 text-accent" aria-hidden />
              <p className="text-xs font-bold text-ink">{tr("localEngineTitle")}</p>
            </div>
            <p className="md-body-small text-ink-muted"><RichBidi text={tr("localEngineBody")} /></p>
            <p className="text-xs text-ink-muted"><RichBidi text={tr("localEngineHowLabel")} /></p>
            <div
              className="overflow-x-auto rounded-md bg-[var(--md-sys-color-surface-container-highest)] px-2.5 py-1.5 font-mono text-[10.5px] leading-relaxed text-ink"
              dir="ltr"
              aria-label="Engine setup commands"
            >
              {[
                "git clone https://github.com/hoseain756/Horse.git",
                "cd Horse/mini-services/torrent-service",
                "npm install && npm start",
              ].map((line) => (
                <span key={line} className="block whitespace-pre">{line}</span>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="block text-[11px] font-semibold text-ink-muted">{tr("localEngineUrlLabel")}</span>
                <Input
                  dir="ltr"
                  value={localUrl}
                  onChange={(e) => {
                    setLocalUrl(e.target.value);
                    if (localTest !== "idle" && localTest !== "testing") setLocalTest("idle");
                  }}
                  placeholder="http://localhost:3031"
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
              <label className="space-y-1">
                <span className="block text-[11px] font-semibold text-ink-muted">{tr("localEngineKeyLabel")}</span>
                <Input
                  dir="ltr"
                  type="password"
                  value={localKey}
                  onChange={(e) => {
                    setLocalKey(e.target.value);
                    if (localTest !== "idle" && localTest !== "testing") setLocalTest("idle");
                  }}
                  placeholder="ENGINE_API_KEY"
                  autoComplete="off"
                />
              </label>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button onClick={() => void saveLocalEngine()} disabled={localTest === "testing"}>
                {localTest === "testing" ? (
                  <Loader2 className="w-4 h-4 me-1.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5 me-1.5" />
                )}
                {tr("localEngineSave")}
              </Button>
              {localCfg && (
                <Button variant="outline" onClick={removeLocalEngine}>
                  <Trash2 className="w-3.5 h-3.5 me-1.5" />
                  {tr("localEngineRemove")}
                </Button>
              )}
            </div>
            {localFeedback}
            <p className="flex items-start gap-2 border-t border-edge-soft pt-2.5 text-[11px] text-ink-subtle">
              <Server className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden />
              <span className="flex-1">
                <RichBidi text={tr("freeHostingHint")} />{" "}
                <a
                  href={FREE_HOSTING_GUIDE_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="harbor-tv-focus inline-flex items-center gap-1 rounded-md font-semibold text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
                >
                  {tr("freeHostingGuide")}
                  <ExternalLink className="w-3 h-3" aria-hidden />
                </a>
              </span>
            </p>
        </div>
      )}

      {health?.ok && (
        <div className="mt-4 rounded-[var(--md-sys-shape-corner-medium)] bg-[var(--md-sys-color-surface-container-high)] px-3.5 py-3 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-ink-muted">
            <span>
              {activeCount === 0
                ? tr("p2pNoSwarms")
                : tr("p2pSwarms", { n: tr.num(activeCount), speed: totalSpeed > 0 ? formatSpeed(totalSpeed) : "" })}
            </span>
            <button
              type="button"
              onClick={() => void check()}
              disabled={checking}
              className="harbor-tv-focus flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold text-ink-muted hover:text-ink disabled:opacity-50"
            >
              <RefreshCw className={cn("w-3 h-3", checking && "animate-spin")} /> {tr("refresh")}
            </button>
          </div>
          {health.torrents.slice(0, 4).map((t) => (
            <div key={t.key} className="flex items-center gap-2.5 text-[11px]">
              <span className="harbor-clamp-1 flex-1 text-ink" dir="auto" title={t.name ?? undefined}>{t.name ?? t.key.slice(0, 12)}</span>
              <span className="text-ink-subtle tabular-nums">{tr.num(Math.round((t.progress ?? 0) * 100))}%</span>
              <span className="text-ink-subtle tabular-nums w-14 text-right">{tr("p2pPeers", { n: tr.num(t.peers) })}</span>
              <span className="text-ink-subtle tabular-nums w-16 text-right">{formatSpeed(t.downloadSpeed)}</span>
            </div>
          ))}
        </div>
      )}

      {health && !health.ok && !serverless && (
        <div className="mt-4 space-y-2">
          <p
            className="flex items-start gap-2 rounded-[var(--md-sys-shape-corner-medium)] bg-[var(--md-sys-color-error-container)] text-[var(--md-sys-color-on-error-container)] px-3.5 py-2.5 md-body-small"
            role="alert"
          >
            <CircleAlert className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
            <RichBidi text={tr("p2pError")} />
          </p>
          {mode === "external" && testControls}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-edge-soft space-y-3">
        <p className="text-xs text-ink-subtle"><RichBidi text={tr("p2pNote")} /></p>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            disabled={clearing || serverless || activeCount === 0}
            onClick={() => void doCleanup(false)}
          >
            {clearing ? <Loader2 className="w-4 h-4 me-1.5 animate-spin" /> : <Square className="w-3.5 h-3.5 me-1.5" />}
            {tr("p2pStopAll")}
          </Button>
          <Button
            variant="destructive"
            disabled={clearing || serverless}
            onClick={() => void doCleanup(true)}
          >
            {clearing ? <Loader2 className="w-4 h-4 me-1.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 me-1.5" />}
            {tr("p2pWipe")}
          </Button>
        </div>
      </div>
    </div>
  );
}
