"use client";

// Harbor Web — Theme Studio: build, preview, save and share custom themes.
// Port of Harbor's theme studio idea: full palette control (10 tokens), font pair,
// layout + card/button styles, live preview, saved themes, export/import as JSON.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Download,
  Link2,
  Loader2,
  Palette,
  RotateCcw,
  Save,
  Share2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  applyTheme,
  customColorsToTokens,
  decodeThemeShare,
  encodeThemeShare,
  FONT_PAIRS,
  isValidColor,
  loadUserThemes,
  deleteUserTheme,
  presetTokens,
  putUserTheme,
  type ActiveTheme,
  type ButtonStyle,
  type CardStyle,
  type CustomColors,
  type FontPairId,
  type ThemeLayout,
  type UserTheme,
} from "@/lib/harbor/themes";
import { useSettings } from "@/lib/harbor/store";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// ---------- color helpers ----------

let convCtx: CanvasRenderingContext2D | null = null;
function anyColorToHex(color: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  if (typeof document === "undefined") return "#000000";
  if (!convCtx) {
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = 1;
    convCtx = c.getContext("2d", { willReadFrequently: true });
  }
  if (!convCtx) return "#000000";
  try {
    convCtx.clearRect(0, 0, 1, 1);
    convCtx.fillStyle = "#000000";
    convCtx.fillStyle = color;
    convCtx.fillRect(0, 0, 1, 1);
    const d = convCtx.getImageData(0, 0, 1, 1).data;
    const to2 = (n: number) => n.toString(16).padStart(2, "0");
    return `#${to2(d[0])}${to2(d[1])}${to2(d[2])}`;
  } catch {
    return "#000000";
  }
}

const COLOR_FIELDS: { key: keyof CustomColors; label: string; hint: string }[] = [
  { key: "canvas", label: "Canvas", hint: "App background" },
  { key: "surface", label: "Surface", hint: "Panels & rails" },
  { key: "elevated", label: "Elevated", hint: "Cards & dialogs" },
  { key: "raised", label: "Raised", hint: "Buttons & chips" },
  { key: "ink", label: "Text", hint: "Primary text" },
  { key: "inkMuted", label: "Text muted", hint: "Secondary text" },
  { key: "inkSubtle", label: "Text subtle", hint: "Captions & hints" },
  { key: "edge", label: "Edge", hint: "Borders & dividers" },
  { key: "accent", label: "Accent", hint: "Highlights & actions" },
  { key: "danger", label: "Danger", hint: "Destructive actions" },
];

const LAYOUTS: ThemeLayout[] = ["sidebar", "stremio", "topdock", "rail", "dracula", "nord", "forest", "royal"];
const CARD_STYLES: CardStyle[] = ["flat", "glass", "stremio", "crunch", "noir", "glossy"];
const BUTTON_STYLES: ButtonStyle[] = ["flat", "crunch", "noir", "glossy"];

type Draft = {
  id: string;
  name: string;
  colors: CustomColors;
  fontPair: FontPairId;
  layout: ThemeLayout;
  cardStyle: CardStyle;
  buttonStyle: ButtonStyle;
};

function draftFromTheme(theme: ActiveTheme): Draft {
  if (theme.preset === "custom" && theme.customColors) {
    return {
      id: "custom",
      name: theme.customName ?? "My theme",
      colors: { ...theme.customColors },
      fontPair: theme.fontPair,
      layout: theme.customLayout ?? "sidebar",
      cardStyle: theme.customCardStyle ?? "flat",
      buttonStyle: theme.customButtonStyle ?? "flat",
    };
  }
  const tokens = presetTokens(theme.preset);
  return {
    id: "custom",
    name: "My theme",
    colors: tokens ? { ...tokens.colors } : (presetTokens("cool-grey")?.colors as CustomColors),
    fontPair: theme.fontPair,
    layout: "sidebar",
    cardStyle: "flat",
    buttonStyle: "flat",
  };
}

// ---------- component ----------

export function ThemeStudio({ open, onClose }: { open: boolean; onClose: () => void }) {
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [savedThemes, setSavedThemes] = useState<UserTheme[]>([]);
  const [saving, setSaving] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteValue, setPasteValue] = useState("");

  // (Re)initialize the draft each time the studio opens
  useEffect(() => {
    if (open) {
      setDraft(draftFromTheme(settings.theme));
      setSavedThemes(loadUserThemes());
    }
  }, [open]);

  // Live preview whenever the draft changes
  useEffect(() => {
    if (!open || !draft) return;
    applyTheme({
      ...settings.theme,
      preset: "custom",
      customColors: draft.colors,
      fontPair: draft.fontPair,
      customLayout: draft.layout,
      customCardStyle: draft.cardStyle,
      customButtonStyle: draft.buttonStyle,
      customName: draft.name,
    });
  }, [open, draft]);

  const patch = (p: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...p } : d));
  const setColor = (key: keyof CustomColors, value: string) =>
    setDraft((d) => (d ? { ...d, colors: { ...d.colors, [key]: value } } : d));

  const restoreDraft = () => {
    applyTheme(settings.theme);
    setDraft(draftFromTheme(settings.theme));
  };

  const save = () => {
    if (!draft) return;
    const name = draft.name.trim() || "My theme";
    if (COLOR_FIELDS.some((f) => !isValidColor(draft.colors[f.key]))) {
      toast({
        title: "Invalid colors",
        description: "Fix the highlighted color values before saving.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const next = putUserTheme({
        id: draft.id,
        name,
        colors: draft.colors,
        fontPair: draft.fontPair,
        layout: draft.layout,
        cardStyle: draft.cardStyle,
        buttonStyle: draft.buttonStyle,
      });
      setSavedThemes(next);
      update({
        theme: {
          ...settings.theme,
          preset: "custom",
          customColors: draft.colors,
          fontPair: draft.fontPair,
          customLayout: draft.layout,
          customCardStyle: draft.cardStyle,
          customButtonStyle: draft.buttonStyle,
          customName: name,
        },
      });
      toast({ title: "Theme saved", description: `"${name}" is now your active theme.` });
    } finally {
      setSaving(false);
    }
  };

  const exportDraft = () => {
    if (!draft) return;
    const payload = {
      format: "harbor-web-theme",
      version: 1,
      name: draft.name,
      colors: draft.colors,
      fontPair: draft.fontPair,
      layout: draft.layout,
      cardStyle: draft.cardStyle,
      buttonStyle: draft.buttonStyle,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${draft.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || "theme"}.harbor-theme.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const buildShareLink = (theme: ActiveTheme): string | null => {
    const code = encodeThemeShare(theme);
    if (!code) return null;
    // Must carry the #theme= prefix — that's what the app-shell deep-link handler matches
    return `${window.location.origin}/#theme=${encodeURIComponent(code)}`;
  };

  const shareDraft = async () => {
    if (!draft) return;
    const link = buildShareLink({
      ...settings.theme,
      preset: "custom",
      customColors: draft.colors,
      fontPair: draft.fontPair,
      customLayout: draft.layout,
      customCardStyle: draft.cardStyle,
      customButtonStyle: draft.buttonStyle,
      customName: draft.name,
    });
    if (!link) {
      toast({ title: "Could not build share link", variant: "destructive" });
      return;
    }
    await copyWithToast(link, "Share link copied");
  };

  const shareSaved = async (t: UserTheme) => {
    const link = buildShareLink({
      ...settings.theme,
      preset: "custom",
      customColors: t.colors,
      fontPair: t.fontPair,
      customLayout: t.layout,
      customCardStyle: t.cardStyle,
      customButtonStyle: t.buttonStyle,
      customName: t.name,
    });
    if (!link) {
      toast({ title: "Could not build share link", variant: "destructive" });
      return;
    }
    await copyWithToast(link, `“${t.name}” link copied`);
  };

  const copyWithToast = async (text: string, title: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title, description: "Anyone opening it can preview the theme." });
    } catch {
      // Clipboard can be blocked — let the user copy manually
      setPasteValue(text);
      setPasteOpen(true);
      toast({ title: "Copy blocked — copy the link manually" });
    }
  };

  const importFromCode = () => {
    const decoded = decodeThemeShare(pasteValue);
    if (!decoded || decoded.preset !== "custom" || !decoded.customColors) {
      toast({ title: "Invalid theme link", description: "Paste a harbor theme link you received.", variant: "destructive" });
      return;
    }
    patch({
      id: "custom",
      name: decoded.customName ?? "Shared theme",
      colors: { ...decoded.customColors },
      fontPair: decoded.fontPair,
      layout: decoded.customLayout ?? "sidebar",
      cardStyle: decoded.customCardStyle ?? "flat",
      buttonStyle: decoded.customButtonStyle ?? "flat",
    });
    setPasteOpen(false);
    setPasteValue("");
    toast({ title: "Theme link applied", description: "Previewing — save it to keep it." });
  };

  const importThemeFile = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as Partial<Draft> & { format?: string };
      if (parsed.format !== "harbor-web-theme" || !parsed.colors) {
        throw new Error("Not a Horse theme file");
      }
      const colors = parsed.colors as CustomColors;
      if (COLOR_FIELDS.some((f) => !isValidColor(colors[f.key]))) {
        throw new Error("Theme file contains invalid colors");
      }
      setDraft((d) =>
        d
          ? {
              ...d,
              name: parsed.name ?? d.name,
              colors,
              fontPair: (parsed.fontPair as FontPairId) ?? d.fontPair,
              layout: (parsed.layout as ThemeLayout) ?? d.layout,
              cardStyle: (parsed.cardStyle as CardStyle) ?? d.cardStyle,
              buttonStyle: (parsed.buttonStyle as ButtonStyle) ?? d.buttonStyle,
            }
          : d,
      );
      toast({ title: "Theme imported", description: "Previewing imported theme — save it to keep it." });
    } catch (e) {
      toast({
        title: "Import failed",
        description: e instanceof Error ? e.message : "Invalid file",
        variant: "destructive",
      });
    }
  };

  const applySaved = (t: UserTheme) => {
    patch({
      id: t.id,
      name: t.name,
      colors: { ...t.colors },
      fontPair: t.fontPair,
      layout: t.layout,
      cardStyle: t.cardStyle,
      buttonStyle: t.buttonStyle,
    });
  };

  const removeSaved = (id: string) => {
    const next = deleteUserTheme(id);
    setSavedThemes(next);
    if (draft?.id === id) patch({ id: "custom" });
  };

  const draftValid = useMemo(
    () => (draft ? COLOR_FIELDS.every((f) => isValidColor(draft.colors[f.key])) : false),
    [draft],
  );

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="md-dialog max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 md-title-large font-display">
            <Palette className="w-5 h-5 text-accent" /> Theme Studio
          </DialogTitle>
          <DialogDescription>
            Design your own theme with live preview. Save it to reuse, or export and share it. Your
            accent color seeds the Material 3 palette.
          </DialogDescription>
        </DialogHeader>

        {draft && (
          <>
            {/* Saved themes strip */}
            {savedThemes.length > 0 && (
              <div className="harbor-scroll-x overflow-x-auto flex gap-2 pb-1 shrink-0" aria-label="Saved themes">
                {savedThemes.map((t) => (
                  <div
                    key={t.id}
                    className={cn(
                      "md-card-outlined md-state group relative shrink-0 p-2 ps-2 pe-7 flex items-center gap-2 cursor-pointer transition-colors",
                      draft.id === t.id
                        ? "ring-2 ring-[var(--md-sys-color-primary)] border-transparent"
                        : "hover:!border-accent/40",
                    )}
                    onClick={() => applySaved(t)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && applySaved(t)}
                    aria-label={`Load theme ${t.name}`}
                  >
                    <span className="flex gap-1">
                      {[t.colors.canvas, t.colors.accent, t.colors.elevated].map((c, i) => (
                        <span key={i} className="w-3.5 h-3.5 rounded-full border border-white/20" style={{ background: c }} />
                      ))}
                    </span>
                    <span className="text-xs font-medium text-ink whitespace-nowrap max-w-28 truncate">{t.name}</span>
                    <span className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void shareSaved(t);
                        }}
                        className="text-ink-subtle hover:text-accent transition-colors"
                        aria-label={`Share theme ${t.name}`}
                        title="Copy share link"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeSaved(t.id);
                        }}
                        className="text-ink-subtle hover:text-danger transition-colors"
                        aria-label={`Delete theme ${t.name}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="harbor-scroll overflow-y-auto pe-1 flex-1 min-h-0">
              {/* Colors */}
              <h3 className="md-label-large text-ink-muted uppercase tracking-wide mb-1">Palette</h3>
              <p className="md-body-small text-ink-subtle mb-2">
                Your accent color seeds the Material 3 palette — tones, containers and surfaces are
                derived from it.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">
                {COLOR_FIELDS.map((f) => {
                  const value = draft.colors[f.key];
                  const valid = isValidColor(value);
                  return (
                    <div key={f.key} className="rounded-[var(--md-sys-shape-corner-medium)] bg-[var(--md-sys-color-surface-container)] px-3 py-2 flex items-center gap-3">
                      <label
                        className="relative w-8 h-8 rounded-[var(--md-sys-shape-corner-small)] overflow-hidden shrink-0 cursor-pointer border border-edge-soft"
                        style={{ background: valid ? value : "#000" }}
                        title={`Pick ${f.label.toLowerCase()} color`}
                      >
                        <input
                          type="color"
                          value={anyColorToHex(value)}
                          onChange={(e) => setColor(f.key, e.target.value)}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          aria-label={`${f.label} color picker`}
                        />
                      </label>
                      <div className="min-w-0 flex-1">
                        <p className="md-label-medium text-ink leading-none">
                          {f.label}
                          <span className="ms-1.5 font-normal text-ink-subtle">{f.hint}</span>
                        </p>
                        <input
                          value={value}
                          onChange={(e) => setColor(f.key, e.target.value)}
                          spellCheck={false}
                          className={cn(
                            "md-field-outlined mt-1 w-full bg-transparent px-2 py-1 text-[11px] font-mono text-ink-muted",
                            !valid && "!border-danger !shadow-none text-danger",
                          )}
                          aria-label={`${f.label} color value`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Typography + structure */}
              <h3 className="md-label-large text-ink-muted uppercase tracking-wide mb-2">Typography</h3>
              <div className="flex flex-wrap gap-2 mb-5">
                {(Object.keys(FONT_PAIRS) as FontPairId[]).map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => patch({ fontPair: id })}
                    className={cn(
                      "md-chip !h-11 px-4",
                      draft.fontPair === id && "md-chip-selected border-transparent",
                    )}
                    style={{ fontFamily: FONT_PAIRS[id].display }}
                    aria-pressed={draft.fontPair === id}
                  >
                    {FONT_PAIRS[id].name}
                  </button>
                ))}
              </div>

              <h3 className="md-label-large text-ink-muted uppercase tracking-wide mb-2">Structure</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                <SelectRow label="Layout" value={draft.layout} options={LAYOUTS} onChange={(v) => patch({ layout: v as ThemeLayout })} />
                <SelectRow label="Cards" value={draft.cardStyle} options={CARD_STYLES} onChange={(v) => patch({ cardStyle: v as CardStyle })} />
                <SelectRow label="Buttons" value={draft.buttonStyle} options={BUTTON_STYLES} onChange={(v) => patch({ buttonStyle: v as ButtonStyle })} />
              </div>
            </div>

            {/* Footer actions */}
            <div className="shrink-0 border-t border-edge-soft pt-4 flex items-center gap-2 flex-wrap">
              <Input
                value={draft.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder="Theme name"
                className="w-44 md-field-outlined px-3"
                aria-label="Theme name"
                maxLength={32}
              />
              <Button
                onClick={save}
                disabled={saving || !draftValid}
              >
                {saving ? <Loader2 className="w-4 h-4 me-1.5 animate-spin" /> : <Save className="w-4 h-4 me-1.5" />}
                Save theme
              </Button>
              <Button variant="outline" onClick={exportDraft}>
                <Download className="w-4 h-4 me-1.5" /> Export
              </Button>
              <Button variant="outline" onClick={shareDraft}>
                <Share2 className="w-4 h-4 me-1.5" /> Share
              </Button>
              <Button variant="outline" onClick={() => setPasteOpen(true)}>
                <Link2 className="w-4 h-4 me-1.5" /> From link
              </Button>
              <Button variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload className="w-4 h-4 me-1.5" /> Import
              </Button>
              <Button variant="outline" onClick={restoreDraft} className="ms-auto">
                <RotateCcw className="w-4 h-4 me-1.5" /> Reset preview
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".json,.harbor-theme"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && importThemeFile(e.target.files[0])}
                aria-label="Import theme file"
              />
            </div>

            {/* Paste-a-theme-link mini dialog (also used as manual-copy fallback) */}
            {pasteOpen && (
              <div
                className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                role="dialog"
                aria-modal="true"
                aria-label="Import theme from link"
                onClick={(e) => {
                  if (e.target === e.currentTarget) setPasteOpen(false);
                }}
              >
                <div className="md-dialog w-full max-w-lg p-5">
                  <h3 className="md-title-large font-display font-bold text-ink mb-1">Theme link</h3>
                  <p className="md-body-small text-ink-muted mb-3">
                    Paste a shared theme link (or the raw hbtheme1 code). Nothing is sent to any server.
                  </p>
                  <input
                    value={pasteValue}
                    onChange={(e) => setPasteValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && importFromCode()}
                    placeholder="https://…/#hbtheme1.…"
                    className="md-field-outlined w-full px-3.5 py-2.5 text-sm font-mono text-ink"
                    autoFocus
                  />
                  <div className="flex justify-end gap-2 mt-4">
                    <button
                      type="button"
                      onClick={() => setPasteOpen(false)}
                      className="md-btn-text"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={importFromCode}
                      disabled={!pasteValue.trim()}
                      className="md-btn-filled disabled:opacity-40"
                    >
                      Apply link
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SelectRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="rounded-[var(--md-sys-shape-corner-medium)] bg-[var(--md-sys-color-surface-container)] px-3 py-2">
      <p className="md-label-small uppercase tracking-wide text-ink-subtle mb-1">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={cn(
              "md-chip transition-colors",
              value === o && "md-chip-selected border-transparent",
            )}
            aria-pressed={value === o}
          >
            {value === o && <Check className="w-3 h-3 inline me-0.5 -mt-0.5" />}
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
