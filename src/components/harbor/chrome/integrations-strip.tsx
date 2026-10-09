"use client";

// Harbor Web — Home "Complete your setup" strip
// Makes the optional integrations (TMDB, ratings, Trakt, Simkl) VISIBLE:
// previously they existed only behind Settings → Integrations, so users never
// discovered them. Shows a live status dot per service (server env keys probed
// via /api/integrations/status, user-provided TMDB key read from settings),
// one-line benefit copy, and a CTA that deep-links to Settings → Integrations.
// Auto-hides when everything is configured or after dismissal (localStorage).
import { useEffect, useState } from "react";
import { Check, Plug, X } from "lucide-react";
import { useNav, useSettings } from "@/lib/harbor/store";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "harbor-web.integrations-strip-v1";

type EnvStatus = {
  tmdb: boolean;
  trakt: boolean;
  simkl: boolean;
  omdb: boolean;
  mdblist: boolean;
};

type ServiceStatus = {
  id: string;
  name: string;
  benefit: string;
  on: boolean;
};

function readDismissed(): boolean {
  if (typeof window === "undefined") return true; // avoid SSR flash
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export function IntegrationsStrip() {
  const push = useNav((s) => s.push);
  const tmdbUserKey = useSettings((s) => s.settings.tmdbUserKey);
  const tmdbEnabled = useSettings((s) => s.settings.tmdbEnabled);
  const ratingsEnabled = useSettings((s) => s.settings.ratingsEnabled);
  const [env, setEnv] = useState<EnvStatus | null>(null);
  const [dismissed, setDismissed] = useState(true); // SSR-safe default; re-hydrates on mount

  useEffect(() => {
    // Hydrate dismissal outside the effect body (set-state lint rule)
    const t = setTimeout(() => setDismissed(readDismissed()), 0);
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/integrations/status", { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return;
        const data = (await res.json()) as EnvStatus;
        if (alive) setEnv(data);
      } catch {
        /* status is best-effort; strip just stays hidden */
      }
    })();
    return () => {
      clearTimeout(t);
      alive = false;
    };
  }, []);

  if (env === null || dismissed) return null;

  const tmdbOn = env.tmdb || (!!tmdbUserKey.trim() && tmdbEnabled);
  const ratingsOn = env.omdb || env.mdblist || tmdbOn; // anime providers (AniList/Jikan/Kitsu) always work
  const services: ServiceStatus[] = [
    {
      id: "tmdb",
      name: "TMDB",
      benefit: "Better artwork, title logos, cast & recommendations",
      on: tmdbOn,
    },
    {
      id: "ratings",
      name: "Ratings",
      benefit: "IMDb, Rotten Tomatoes, Metacritic & Trakt scores on every title",
      on: ratingsEnabled && ratingsOn,
    },
    {
      id: "trakt",
      name: "Trakt",
      benefit: "Sync scrobbles, watchlist & history with link a code",
      on: env.trakt,
    },
    {
      id: "simkl",
      name: "Simkl",
      benefit: "Track what you watch across devices with a PIN code",
      on: env.simkl,
    },
  ];

  const allOn = services.every((s) => s.on);
  if (allOn) return null;
  const pending = services.filter((s) => !s.on);

  const openIntegrations = () => {
    push({ kind: "view", view: "settings" });
    // SettingsView listens for this and switches to the Integrations tab
    setTimeout(() => window.dispatchEvent(new CustomEvent("harbor:settings-section", { detail: "integrations" })), 50);
  };

  return (
    <section
      aria-label="Optional integrations to complete your setup"
      className="md-card-outlined relative overflow-hidden rounded-[var(--md-sys-shape-corner-large)] p-4 md:p-5"
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-accent-soft/60 via-transparent to-transparent" aria-hidden />
      <div className="relative flex items-start gap-3">
        <span className="w-9 h-9 shrink-0 rounded-[var(--md-sys-shape-corner-medium)] bg-accent-soft flex items-center justify-center" aria-hidden>
          <Plug className="w-4.5 h-4.5 text-accent" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="md-title-small text-ink">Complete your Horse setup</h2>
          <p className="md-body-small text-ink-muted mt-0.5">
            {pending.length} integration{pending.length === 1 ? "" : "s"} not active yet —
            free keys take about a minute to add.
          </p>

          {/* M3 list/card hybrids — status dots keep semantic state colors
              (emerald = active, amber = pending); documented M3 exception */}
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {services.map((s) => (
              <li
                key={s.id}
                className={cn(
                  "md-state flex items-start gap-2.5 rounded-[var(--md-sys-shape-corner-medium)] border px-3 py-2.5",
                  s.on
                    ? "border-transparent bg-[var(--md-sys-color-surface-container)]"
                    : "border-edge-soft bg-transparent",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 w-4 h-4 shrink-0 rounded-full flex items-center justify-center",
                    s.on ? "bg-emerald-500/20" : "bg-amber-500/15",
                  )}
                  aria-hidden
                >
                  {s.on ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block md-label-large text-ink">
                    {s.name}
                    <span className={cn("ms-2 md-label-small font-semibold", s.on ? "text-emerald-400" : "text-amber-400")}>
                      {s.on ? "Active" : "Not set up"}
                    </span>
                  </span>
                  <span className="block md-body-small leading-snug text-ink-muted mt-0.5">{s.benefit}</span>
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={openIntegrations}
              className="md-btn-filled harbor-tv-focus !h-11 !px-4 text-xs"
            >
              Set up in Settings → Integrations
            </button>
            <span className="md-label-small text-ink-subtle">
              Anime ratings (AniList · MyAnimeList · Kitsu) work without any keys.
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setDismissed(true);
            try {
              window.localStorage.setItem(DISMISS_KEY, "1");
            } catch {
              /* quota — ignore */
            }
          }}
          className="md-icon-btn shrink-0 !w-11 !h-11 text-ink-muted hover:!text-ink"
          aria-label="Dismiss setup suggestions"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </section>
  );
}
