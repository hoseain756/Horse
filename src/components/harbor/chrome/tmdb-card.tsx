"use client";

// Harbor Web — Settings → Integrations → TMDB card (Feature: TMDB integration)
// Toggle, metadata language, image quality, and an optional bring-your-own key
// validated live against TMDB /configuration with clear success/error feedback.
import { useEffect, useRef, useState } from "react";
import { Check, Database, Loader2, X } from "lucide-react";
import { useSettings } from "@/lib/harbor/store";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const LANGS: { id: string; label: string }[] = [
  { id: "en-US", label: "English" },
  { id: "ar-SA", label: "العربية (Arabic)" },
  { id: "es-ES", label: "Español" },
  { id: "fr-FR", label: "Français" },
  { id: "de-DE", label: "Deutsch" },
  { id: "pt-BR", label: "Português (BR)" },
  { id: "it-IT", label: "Italiano" },
  { id: "tr-TR", label: "Türkçe" },
  { id: "ru-RU", label: "Русский" },
  { id: "ja-JP", label: "日本語" },
  { id: "ko-KR", label: "한국어" },
  { id: "zh-CN", label: "简体中文" },
];

type ValidateState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "ok"; label: string }
  | { kind: "error"; message: string };

export function TmdbCard() {
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);

  const [keyInput, setKeyInput] = useState(settings.tmdbUserKey);
  const [validate, setValidate] = useState<ValidateState>({ kind: "idle" });
  const [serverHas, setServerHas] = useState<boolean | null>(null); // env key present?
  const validateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Probe whether the server has its own TMDB credential (one cheap call)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/tmdb?path=/configuration", { signal: AbortSignal.timeout(8000) });
        if (alive) setServerHas(res.ok);
      } catch {
        if (alive) setServerHas(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const runValidate = async (key: string) => {
    if (!key.trim()) {
      setValidate({ kind: "idle" });
      return;
    }
    setValidate({ kind: "checking" });
    try {
      const res = await fetch("/api/tmdb/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
        signal: AbortSignal.timeout(15_000),
      });
      const data = (await res.json()) as { ok?: boolean; kind?: string; error?: string };
      if (data.ok) {
        setValidate({ kind: "ok", label: data.kind === "v4" ? "Valid v4 Read Access Token" : "Valid v3 API key" });
      } else {
        setValidate({ kind: "error", message: data.error ?? "TMDB rejected this key." });
      }
    } catch {
      setValidate({ kind: "error", message: "Could not reach TMDB to validate — check your connection." });
    }
  };

  // Live validation: 700ms after typing stops
  const onKeyChange = (v: string) => {
    setKeyInput(v);
    update({ tmdbUserKey: v });
    if (validateTimer.current) clearTimeout(validateTimer.current);
    if (!v.trim()) {
      setValidate({ kind: "idle" });
      return;
    }
    validateTimer.current = setTimeout(() => void runValidate(v), 700);
  };

  useEffect(() => {
    return () => {
      if (validateTimer.current) clearTimeout(validateTimer.current);
    };
  }, []);

  return (
    <div className="md-card-outlined rounded-[var(--md-sys-shape-corner-large)] p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-1">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-[var(--md-sys-shape-corner-medium)] bg-accent-soft flex items-center justify-center">
            <Database className="w-5 h-5 text-accent" />
          </span>
          <div>
            <h3 className="md-title-small text-ink">TMDB metadata</h3>
            <p className="md-body-small text-ink-muted">
              Posters, backdrops, logos, cast, certifications and better search — layered on top of
              your addons.
            </p>
          </div>
        </div>
        <Switch
          id="tmdb-enabled"
          checked={settings.tmdbEnabled}
          onCheckedChange={(v) => update({ tmdbEnabled: v })}
          aria-label="Enable TMDB metadata"
        />
      </div>

      {settings.tmdbEnabled && (
        <div className="mt-4 space-y-4">
          {/* Server key status — dot keeps semantic state colors (emerald=ok / amber=warn), documented M3 exception */}
          <div className="flex items-center gap-2 md-body-small">
            <span
              className={cn(
                "w-2 h-2 rounded-full",
                serverHas === null ? "bg-ink-subtle animate-pulse" : serverHas ? "bg-emerald-400" : "bg-amber-400",
              )}
              aria-hidden
            />
            <span className="text-ink-muted">
              {serverHas === null
                ? "Checking server key…"
                : serverHas
                  ? "Server TMDB key active (set via environment)."
                  : "No server key — add your own below to enable TMDB."}
            </span>
          </div>

          {/* Language */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="md-body-large text-ink">Metadata language</p>
              <p className="md-body-small text-ink-muted mt-0.5">Titles, overviews and images returned by TMDB.</p>
            </div>
            <select
              aria-label="TMDB metadata language"
              value={settings.tmdbLanguage}
              onChange={(e) => update({ tmdbLanguage: e.target.value })}
              className="md-field-outlined rounded-[var(--md-sys-shape-corner-medium)] bg-[var(--md-sys-color-surface-container)] px-2.5 py-2 text-xs text-ink"
            >
              {LANGS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          {/* Image quality */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="md-body-large text-ink">Image quality</p>
              <p className="md-body-small text-ink-muted mt-0.5">Higher looks sharper but downloads more bytes.</p>
            </div>
            <div
              className="inline-flex rounded-full bg-[var(--md-sys-color-secondary-container)] p-1"
              role="group"
              aria-label="Image quality"
            >
              {(["low", "medium", "high"] as const).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => update({ tmdbImageQuality: q })}
                  aria-pressed={settings.tmdbImageQuality === q}
                  className={cn(
                    "md-state rounded-full min-h-10 px-4 py-1.5 md-label-large capitalize transition-colors",
                    settings.tmdbImageQuality === q
                      ? "bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)]"
                      : "text-[var(--md-sys-color-on-secondary-container)]",
                  )}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* BYO key */}
          <div>
            <label htmlFor="tmdb-user-key" className="block md-label-medium text-ink-muted mb-1.5">
              Your own TMDB API key (optional)
            </label>
            <div className="relative">
              <input
                id="tmdb-user-key"
                value={keyInput}
                onChange={(e) => onKeyChange(e.target.value)}
                placeholder="v3 key (32 hex chars) or v4 Read Access Token"
                spellCheck={false}
                autoComplete="off"
                className="md-field-outlined w-full px-3 py-2.5 pe-9 text-xs font-mono text-ink placeholder:text-ink-subtle placeholder:font-sans"
              />
              <span className="absolute end-2.5 top-1/2 -translate-y-1/2" aria-live="polite">
                {validate.kind === "checking" && <Loader2 className="w-4 h-4 text-ink-muted animate-spin" />}
                {validate.kind === "ok" && <Check className="w-4 h-4 text-emerald-400" />}
                {validate.kind === "error" && <X className="w-4 h-4 text-danger" />}
              </span>
            </div>
            {validate.kind === "ok" && <p className="mt-1.5 md-body-small text-emerald-400">{validate.label} — saved.</p>}
            {validate.kind === "error" && <p className="mt-1.5 md-body-small text-danger">{validate.message}</p>}
            {validate.kind === "idle" && !keyInput.trim() && (
              <div className="mt-1.5 rounded-[var(--md-sys-shape-corner-medium)] bg-[var(--md-sys-color-surface-container)] p-3">
                <p className="md-body-small font-semibold text-ink mb-1.5">Get a free key in ~1 minute:</p>
                <ol className="md-body-small leading-relaxed text-ink-muted list-decimal ms-4 space-y-0.5">
                  <li>
                    Create a free account at{" "}
                    <a
                      href="https://www.themoviedb.org/signup"
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-accent underline underline-offset-2"
                    >
                      themoviedb.org
                    </a>
                    .
                  </li>
                  <li>
                    Open{" "}
                    <a
                      href="https://www.themoviedb.org/settings/api"
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-accent underline underline-offset-2"
                    >
                      Settings → API
                    </a>{" "}
                    and copy the <span className="text-ink-muted">API Key (v3)</span> — or the longer{" "}
                    <span className="text-ink-muted">API Read Access Token (v4)</span>.
                  </li>
                  <li>Paste it above. It is validated live, stays in this browser only, and TMDB features switch on immediately.</li>
                </ol>
              </div>
            )}
          </div>

          {/* Required attribution */}
          <p className="text-[10px] leading-relaxed text-ink-subtle border-t border-edge-soft pt-3">
            This product uses the TMDB API but is not endorsed or certified by TMDB.
          </p>
        </div>
      )}
    </div>
  );
}

/** Compact TMDB attribution mark for footers/about pages. */
export function TmdbAttribution({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 align-middle", className)}>
      <span
        className="inline-flex h-4 items-center rounded-[4px] bg-[#01b4e4] px-1.5 text-[9px] font-black tracking-wide text-[#0d253f]"
        aria-hidden
      >
        TMDB
      </span>
      <span>This product uses the TMDB API but is not endorsed or certified by TMDB.</span>
    </span>
  );
}
