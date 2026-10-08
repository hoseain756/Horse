"use client";
// Round 8: palette deep-link marker


// Harbor Web — Settings (port of Harbor settings.tsx: basics/player/theme/language/data sections)
import { Children, cloneElement, isValidElement, useEffect, useId, useRef, useState } from "react";
import { Settings as SettingsIcon, SlidersHorizontal, Palette, Globe2, DatabaseBackup, Info, Check, RotateCcw, Brush, Trash2, CloudUpload, CloudOff, RefreshCw, ShieldCheck, Plug, Unplug, DownloadCloud, Loader2, Square, KeyRound, Zap, History, TvMinimalPlay, UploadCloud, ChevronUp, ChevronDown, X, Network, CircleAlert } from "lucide-react";
import { useNav, useSettings } from "@/lib/harbor/store";
import { useT } from "@/hooks/use-t";
import { RichBidi, Bdi } from "../common/bidi";
import { DEFAULT_SETTINGS } from "@/lib/harbor/settings";
import { useCloudSync, deviceIdShort, lastSyncFromStorage } from "@/lib/harbor/cloud-sync";
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
import { serverCapabilities } from "@/lib/harbor/playback";
import { useTrakt, installTraktPushSync } from "@/lib/harbor/trakt";
import { useSimkl } from "@/lib/harbor/simkl";
import { useDebrid, type DebridService } from "@/lib/harbor/debrid";
import { p2pHealth, p2pCleanup, formatSpeed, P2P_PORT } from "@/lib/harbor/p2p";
import { TmdbCard, TmdbAttribution } from "../chrome/tmdb-card";
import { LinkAccountFlow } from "../chrome/link-account-flow";
import { RatingsSettingsCard } from "../chrome/ratings-row";
import { useLinking } from "@/lib/harbor/linking";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
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

/**
 * Animated disclosure (defect A): chevron mirrors in RTL (rtl:rotate-180),
 * content expands with a grid-rows transition (respects reduced motion).
 */
function Disclosure({ summary, children }: { summary: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="harbor-tv-focus md-state flex w-full items-center gap-1.5 rounded-full px-2 py-1.5 text-xs font-medium text-ink-muted hover:text-ink transition-colors"
      >
        <ChevronDown
          className={cn("w-3.5 h-3.5 shrink-0 rtl:rotate-180 transition-transform duration-200", open && "rotate-180 rtl:rotate-0")}
          aria-hidden
        />
        <span className="text-start min-w-0">{summary}</span>
      </button>
      <div className="harbor-disclosure-content" data-open={open}>
        <div>
          <div className="px-2 pb-1">{children}</div>
        </div>
      </div>
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
            <h2 className="md-title-large font-display font-bold text-ink flex items-center gap-2">
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

// ---------- Cloud sync card ----------
function CloudSyncCard() {
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
    ? "Off"
    : status === "synced"
      ? "Up to date"
      : status === "syncing"
        ? "Syncing…"
        : status === "error"
          ? "Sync error"
          : "Idle";

  return (
    <div className="md-card-outlined rounded-[var(--md-sys-shape-corner-large)] p-5 relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" aria-hidden />
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {enabled ? <CloudUpload className="w-4 h-4 text-accent" /> : <CloudOff className="w-4 h-4 text-ink-subtle" />}
            <h3 className="md-title-small text-ink">Cloud sync</h3>
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
              toast({ title: v ? "Cloud sync enabled" : "Cloud sync disabled", description: v ? "A first sync will start now." : "Local data stays untouched." });
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
            <h2 className="md-title-large font-display font-bold text-ink">Horse</h2>
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
        <h2 className="md-title-large font-display font-bold text-ink mb-1">{tr("integrationsTitle")}</h2>
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
  const connect = useTrakt((s) => s.connect);
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

  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [connecting, setConnecting] = useState(false);
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

  const startConnect = async () => {
    // PKCE apps have no secret — only the Client ID is required
    if (!clientId.trim()) {
      toast({ title: "Client ID is required", variant: "destructive" });
      return;
    }
    setConnecting(true);
    const ok = await connect(clientId, clientSecret || undefined);
    setConnecting(false);
    if (ok) toast({ title: "Enter the code on Trakt", description: "Approve access to continue." });
    else toast({ title: "Could not start Trakt flow", description: useTrakt.getState().error ?? undefined, variant: "destructive" });
  };

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
        <>
          {/* Zero-config activation-code linking (preferred) */}
          <LinkAccountFlow service="trakt" />
          {/* Legacy BYO flow — collapsed by default (animated, RTL-mirrored chevron) */}
          <Disclosure summary={tr("advancedOwnCreds", { name: "Trakt" })}>
            <div className="mt-3 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1.5" htmlFor="trakt-client-id">
                Client ID
              </label>
              <Input
                id="trakt-client-id"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="Your Trakt app client id"
                className="md-field-outlined px-3 font-mono text-xs bg-transparent"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1.5" htmlFor="trakt-client-secret">
                Client secret (optional — PKCE apps have none)
              </label>
              <Input
                id="trakt-client-secret"
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="Your Trakt app client secret"
                className="md-field-outlined px-3 font-mono text-xs bg-transparent"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          </div>
          <p className="text-xs text-ink-subtle">
            Create a free app at{" "}
            <a
              href="https://trakt.tv/oauth/applications/new"
              target="_blank"
              rel="noreferrer noopener"
              className="text-accent underline underline-offset-2"
            >
              <Bdi>trakt.tv/oauth/applications/new</Bdi>
            </a>{" "}
            (name it anything; redirect URI is unused for device flow). Credentials never leave this
            browser except to authenticate with Trakt itself.
          </p>
          <div className="flex items-center gap-3">
            <Button onClick={startConnect} disabled={connecting} className="md-btn-filled">
              {connecting ? <Loader2 className="w-4 h-4 me-1.5 animate-spin" /> : <Plug className="w-4 h-4 me-1.5" />}
              Connect
            </Button>
            {error && <span className="text-xs text-danger">{error}</span>}
          </div>
            </div>
          </Disclosure>
        </>
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
  const connect = useSimkl((s) => s.connect);
  const pollOnce = useSimkl((s) => s.pollOnce);
  const cancelConnect = useSimkl((s) => s.cancelConnect);
  const disconnect = useSimkl((s) => s.disconnect);
  const importWatchlist = useSimkl((s) => s.importWatchlist);
  const importingHistory = useSimkl((s) => s.importingHistory);
  const importHistory = useSimkl((s) => s.importHistory);

  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [connecting, setConnecting] = useState(false);
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

  const startConnect = async () => {
    if (!clientId.trim()) {
      toast({ title: "Client ID is required", variant: "destructive" });
      return;
    }
    setConnecting(true);
    const ok = await connect(clientId, clientSecret || undefined);
    setConnecting(false);
    if (ok) toast({ title: "Enter the code on Simkl", description: "Approve access to continue." });
    else toast({ title: "Could not start Simkl flow", description: useSimkl.getState().error ?? undefined, variant: "destructive" });
  };

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
        <>
          {/* Zero-config activation-code linking (preferred) */}
          <LinkAccountFlow service="simkl" />
          {/* Legacy BYO flow — collapsed by default (animated, RTL-mirrored chevron) */}
          <Disclosure summary={tr("advancedOwnCreds", { name: "Simkl" })}>
            <div className="mt-3 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1.5" htmlFor="simkl-client-id">
                Client ID
              </label>
              <Input
                id="simkl-client-id"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="Your Simkl app client id"
                className="md-field-outlined px-3 font-mono text-xs bg-transparent"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1.5" htmlFor="simkl-client-secret">
                Client secret <span className="text-ink-subtle">(optional)</span>
              </label>
              <Input
                id="simkl-client-secret"
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="Only if your Simkl app has one"
                className="md-field-outlined px-3 font-mono text-xs bg-transparent"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          </div>
          <p className="text-xs text-ink-subtle">
            Create a free app at{" "}
            <a
              href="https://simkl.com/apps/new"
              target="_blank"
              rel="noreferrer noopener"
              className="text-accent underline underline-offset-2"
            >
              <Bdi>simkl.com/apps/new</Bdi>
            </a>{" "}
            (pick any name; you only need the client id). Credentials never leave this browser except
            to authenticate with Simkl itself.
          </p>
          <div className="flex items-center gap-3">
            <Button onClick={startConnect} disabled={connecting} className="md-btn-filled">
              {connecting ? <Loader2 className="w-4 h-4 me-1.5 animate-spin" /> : <Plug className="w-4 h-4 me-1.5" />}
              Connect
            </Button>
            {error && <span className="text-xs text-danger">{error}</span>}
          </div>
            </div>
          </Disclosure>
        </>
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

function P2pCard() {
  const { toast } = useToast();
  const tr = useT();
  const p2pEnabled = useSettings((s) => s.settings.p2pEnabled);
  const update = useSettings((s) => s.update);
  const [health, setHealth] = useState<P2pHealthState | null>(null);
  const [checking, setChecking] = useState(false);
  const [clearing, setClearing] = useState(false);

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
    void check();
  }, []);

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

  const activeCount = health?.torrents.length ?? 0;
  const totalSpeed = health?.torrents.reduce((a, t) => a + (t.downloadSpeed ?? 0), 0) ?? 0;

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
        {/* Status chip — M3 semantic tokens (error-container for down state) */}
        <span
          className={cn(
            "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold",
            health === null
              ? "bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface-variant)]"
              : health.ok
                ? "bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)]"
                : "bg-[var(--md-sys-color-error-container)] text-[var(--md-sys-color-on-error-container)]",
          )}
          role="status"
        >
          <span
            aria-hidden
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              health === null ? "bg-[var(--md-sys-color-outline)]" : health.ok ? "bg-[var(--md-sys-color-primary)]" : "bg-[var(--md-sys-color-error)]",
            )}
          />
          {health === null
            ? tr("checking")
            : health.ok
              ? tr("online", { n: P2P_PORT })
              : tr("offline")}
        </span>
      </div>

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

      {health && !health.ok && (
        <p
          className="mt-4 flex items-start gap-2 rounded-[var(--md-sys-shape-corner-medium)] bg-[var(--md-sys-color-error-container)] text-[var(--md-sys-color-on-error-container)] px-3.5 py-2.5 md-body-small"
          role="alert"
        >
          <CircleAlert className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
          <RichBidi text={tr("p2pError")} />
        </p>
      )}

      <div className="mt-4 pt-4 border-t border-edge-soft space-y-3">
        <p className="text-xs text-ink-subtle"><RichBidi text={tr("p2pNote")} /></p>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            disabled={clearing || activeCount === 0}
            onClick={() => void doCleanup(false)}
          >
            {clearing ? <Loader2 className="w-4 h-4 me-1.5 animate-spin" /> : <Square className="w-3.5 h-3.5 me-1.5" />}
            {tr("p2pStopAll")}
          </Button>
          <Button
            variant="destructive"
            disabled={clearing}
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
