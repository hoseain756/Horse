"use client";
// Harbor Web — Settings design system (Task 70 redesign, STEP 3).
// ONE source of truth for every settings control: rows, cards, sliders,
// segmented groups, selects, text/color fields, actions and preview cards.
// Every control is container-query responsive, RTL-logical, 48dp+ touch and
// keyboard/D-pad accessible. Panels compose these; nothing else styles rows.

import { Children, cloneElement, isValidElement, useEffect, useId, useRef, useState } from "react";
import { AlertTriangle, Check, Minus, Plus, RotateCcw } from "lucide-react";
import { useT } from "@/hooks/use-t";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

/* --------------------------------------------------------------------------
 * SettingRow — the M3 list item every setting lives in.
 * - `id`: setting key → DOM anchor `set-<id>` for deep links + highlight
 * - `badge`: small status chip (Synced / capability)
 * - `danger`: destructive tone for the title
 * - container-query stack below 520px (label can never collapse)
 * ------------------------------------------------------------------------ */
export function SettingRow({
  id,
  title,
  description,
  badge,
  danger,
  children,
  arrive,
}: {
  id?: string;
  title: string;
  description?: string;
  badge?: string;
  danger?: boolean;
  children: React.ReactNode;
  arrive?: boolean;
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
    <div
      id={id ? `set-${id}` : undefined}
      data-arrive={arrive ? "true" : undefined}
      className={cn("harbor-setting-row harbor-cq md-state px-4 py-3.5", arrive && "harbor-row-arrive")}
    >
      <div className="harbor-setting-row-label">
        <p id={titleId} className={cn("md-body-large text-ink", danger && "text-danger")}>
          {title}
        </p>
        {description && <p className="md-body-small text-ink-muted mt-0.5">{description}</p>}
      </div>
      <div className="harbor-setting-row-control flex items-center gap-2">
        {badge && (
          <span className="shrink-0 rounded-full border border-edge-soft bg-raised/70 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-ink-muted">
            {badge}
          </span>
        )}
        {control}
      </div>
    </div>
  );
}

/** Convenience: title/description + M3 switch (the most common row shape). */
export function ToggleRow({
  id,
  title,
  description,
  checked,
  onCheckedChange,
  badge,
  arrive,
}: {
  id?: string;
  title: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  badge?: string;
  arrive?: boolean;
}) {
  return (
    <SettingRow id={id} title={title} description={description} badge={badge} arrive={arrive}>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </SettingRow>
  );
}

/* --------------------------------------------------------------------------
 * SectionCard — surface-container card hosting rows; the container-query
 * context. Optional glass header with icon + title + per-section reset.
 * ------------------------------------------------------------------------ */
export function SectionCard({
  id,
  title,
  icon: Icon,
  onReset,
  children,
  className,
}: {
  id?: string;
  title?: string;
  icon?: React.ComponentType<{ className?: string }>;
  onReset?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const tr = useT();
  return (
    <section
      id={id}
      className={cn(
        "harbor-cq md-card-outlined rounded-[var(--md-sys-shape-corner-large)] p-2 sm:p-3 max-w-3xl",
        className,
      )}
      aria-label={title}
    >
      {title && (
        <div className="flex items-center gap-2.5 px-2 pt-1.5 pb-2.5">
          {Icon && (
            <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-accent-soft">
              <Icon className="h-4 w-4 text-accent" aria-hidden />
            </span>
          )}
          <h3 className="md-title-small font-display font-bold text-ink">{title}</h3>
          {onReset && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="ms-auto h-9 gap-1.5 text-ink-muted hover:text-ink"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              {tr("setResetSection")}
            </Button>
          )}
        </div>
      )}
      <div className="space-y-1">{children}</div>
    </section>
  );
}

/* --------------------------------------------------------------------------
 * SegmentedControl — M3 segmented buttons; degrades to a styled dropdown when
 * equal segments cannot fit their nowrap labels (320px @150% font scale).
 * ------------------------------------------------------------------------ */
export function SegmentedControl<T extends string>({
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

/** Row wrapper around SegmentedControl. */
export function SegmentedRow<T extends string>({
  id,
  title,
  description,
  value,
  options,
  onChange,
  badge,
  arrive,
}: {
  id?: string;
  title: string;
  description?: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (v: T) => void;
  badge?: string;
  arrive?: boolean;
}) {
  return (
    <SettingRow id={id} title={title} description={description} badge={badge} arrive={arrive}>
      <SegmentedControl label={title} value={value} options={options} onChange={onChange} />
    </SettingRow>
  );
}

/* --------------------------------------------------------------------------
 * SettingSliderRow — title + live value on one line, full-width slider below.
 * TV (≥1600): ± steppers for D-pad precision next to the slider.
 * ------------------------------------------------------------------------ */
export function SettingSliderRow({
  id,
  title,
  value,
  min,
  max,
  step,
  onChange,
  format,
  steppers,
  arrive,
}: {
  id?: string;
  title: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  steppers?: boolean;
  arrive?: boolean;
}) {
  const tr = useT();
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <div
      id={id ? `set-${id}` : undefined}
      className={cn("harbor-slider-row md-state rounded-[var(--md-sys-shape-corner-medium)] flex flex-col items-stretch gap-1 px-4 py-2", arrive && "harbor-row-arrive")}
    >
      <div className="flex items-center justify-between gap-4 min-w-0">
        <p className="md-body-large text-ink min-w-0">{title}</p>
        <span className="shrink-0 md-label-large text-ink-muted tabular-nums">
          {format ? format(value) : tr.num(value)}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        {steppers && (
          <button
            type="button"
            onClick={() => onChange(clamp(value - step))}
            disabled={value <= min}
            aria-label={`${title} −${step}`}
            className="md-icon-btn harbor-tv-focus h-11 w-11 shrink-0 text-ink-muted hover:text-ink disabled:opacity-30"
          >
            <Minus className="h-4 w-4" />
          </button>
        )}
        <Slider
          value={[value]}
          min={min}
          max={max}
          step={step}
          onValueChange={([v]) => onChange(v)}
          className="harbor-slider-touch flex-1"
          aria-label={title}
        />
        {steppers && (
          <button
            type="button"
            onClick={() => onChange(clamp(value + step))}
            disabled={value >= max}
            aria-label={`${title} +${step}`}
            className="md-icon-btn harbor-tv-focus h-11 w-11 shrink-0 text-ink-muted hover:text-ink disabled:opacity-30"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
 * SelectRow — native select (stable in TV/D-pad + RTL) styled to M3.
 * ------------------------------------------------------------------------ */
export function SelectRow<T extends string>({
  id,
  title,
  description,
  value,
  options,
  onChange,
  badge,
  arrive,
}: {
  id?: string;
  title: string;
  description?: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (v: T) => void;
  badge?: string;
  arrive?: boolean;
}) {
  return (
    <SettingRow id={id} title={title} description={description} badge={badge} arrive={arrive}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        dir="auto"
        className="md-field-outlined h-11 min-h-11 max-w-56 rounded-[var(--md-sys-shape-corner-medium)] bg-[var(--md-sys-color-surface-container)] px-2.5 text-sm text-ink"
      >
        {options.map(([v, label]) => (
          <option key={v} value={v}>{label}</option>
        ))}
      </select>
    </SettingRow>
  );
}

/* --------------------------------------------------------------------------
 * TextFieldRow — optional forced LTR (keys, codes), validation, masked secret.
 * ------------------------------------------------------------------------ */
export function TextFieldRow({
  id,
  title,
  description,
  value,
  onChange,
  placeholder,
  ltr,
  secret,
  error,
  maxLength,
  badge,
  arrive,
}: {
  id?: string;
  title: string;
  description?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  ltr?: boolean;
  secret?: boolean;
  error?: string;
  maxLength?: number;
  badge?: string;
  arrive?: boolean;
}) {
  const [reveal, setReveal] = useState(false);
  return (
    <SettingRow id={id} title={title} description={error ?? description} badge={badge} danger={!!error} arrive={arrive}>
      <div className="relative w-full max-w-56">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          dir={ltr ? "ltr" : undefined}
          type={secret && !reveal ? "password" : "text"}
          maxLength={maxLength}
          autoComplete="off"
          spellCheck={false}
          className={cn("h-11 min-h-11 pe-10 text-sm", error && "border-danger")}
        />
        {secret && (
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            aria-label={reveal ? "Hide" : "Show"}
            className="absolute inset-y-0 end-1 my-auto flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:text-ink"
          >
            <i className="text-[10px] font-bold" aria-hidden>{reveal ? "•••" : "ABC"}</i>
          </button>
        )}
      </div>
    </SettingRow>
  );
}

/* --------------------------------------------------------------------------
 * ColorRow — native color picker + hex echo (subtitles colors).
 * ------------------------------------------------------------------------ */
export function ColorRow({
  id,
  title,
  description,
  value,
  onChange,
  arrive,
}: {
  id?: string;
  title: string;
  description?: string;
  value: string;
  onChange: (v: string) => void;
  arrive?: boolean;
}) {
  return (
    <SettingRow id={id} title={title} description={description} arrive={arrive}>
      <label className="flex items-center gap-2.5">
        <span
          className="h-9 w-12 shrink-0 rounded-[10px] border border-edge-soft"
          style={{ background: value }}
          aria-hidden
        />
        <span className="md-label-large text-ink-muted tabular-nums" dir="ltr">{value}</span>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-11 w-11 cursor-pointer rounded-[10px] border-0 bg-transparent p-0"
          aria-label={title}
        />
      </label>
    </SettingRow>
  );
}

/* --------------------------------------------------------------------------
 * ActionRow — description + trailing button (no persisted value).
 * DangerActionRow — the same, wrapped in an AlertDialog confirm (audit F6).
 * ------------------------------------------------------------------------ */
export function ActionRow({
  id,
  title,
  description,
  actionLabel,
  onAction,
  variant = "default",
  icon: Icon,
  badge,
  arrive,
}: {
  id?: string;
  title: string;
  description?: string;
  actionLabel: string;
  onAction: () => void;
  variant?: "default" | "outline" | "destructive";
  icon?: React.ComponentType<{ className?: string }>;
  badge?: string;
  arrive?: boolean;
}) {
  return (
    <SettingRow id={id} title={title} description={description} badge={badge} danger={variant === "destructive"} arrive={arrive}>
      <Button variant={variant} onClick={onAction} className="min-h-11 gap-1.5">
        {Icon && <Icon className="h-4 w-4" aria-hidden />}
        {actionLabel}
      </Button>
    </SettingRow>
  );
}

export function DangerActionRow({
  id,
  title,
  description,
  actionLabel,
  confirmTitle,
  confirmBody,
  confirmLabel,
  onConfirm,
  icon: Icon,
  arrive,
}: {
  id?: string;
  title: string;
  description?: string;
  actionLabel: string;
  confirmTitle: string;
  confirmBody: string;
  confirmLabel: string;
  onConfirm: () => void;
  icon?: React.ComponentType<{ className?: string }>;
  arrive?: boolean;
}) {
  const tr = useT();
  return (
    <SettingRow id={id} title={title} description={description} danger arrive={arrive}>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" className="min-h-11 gap-1.5">
            {Icon && <Icon className="h-4 w-4" aria-hidden />}
            {actionLabel}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-danger" aria-hidden />
              {confirmTitle}
            </AlertDialogTitle>
            <AlertDialogDescription>{confirmBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tr("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirm}
              className="bg-danger text-white hover:bg-danger/90 focus-visible:ring-danger"
            >
              {confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingRow>
  );
}

/* --------------------------------------------------------------------------
 * PreviewCard — live WYSIWYG surface (subtitle style / poster look).
 * Children render inside a 16:9 cinematic frame.
 * ------------------------------------------------------------------------ */
export function PreviewCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="md-card-outlined overflow-hidden rounded-[var(--md-sys-shape-corner-large)] max-w-3xl" aria-label={title}>
      <div className="relative aspect-video w-full bg-gradient-to-br from-[#1b2430] via-[#10161f] to-[#060a10]">
        {/* faux movie frame so the preview reads as "in the player" */}
        <div className="absolute inset-0 opacity-40" aria-hidden>
          <div className="absolute bottom-0 start-0 end-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />
        </div>
        {children}
      </div>
      <div className="flex items-center gap-2.5 px-4 py-3">
        <Check className="h-4 w-4 shrink-0 text-accent" aria-hidden />
        <div className="min-w-0">
          <p className="md-body-medium text-ink">{title}</p>
          {description && <p className="md-body-small text-ink-muted">{description}</p>}
        </div>
      </div>
    </section>
  );
}
