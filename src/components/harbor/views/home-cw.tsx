"use client";

// Harbor Web — Continue Watching row (round-21 mobile rebuild per the
// Nuvio-reference spec: 16:9 cards, bidi-isolated S/E tag, episode-name
// subtitle, track-less red progress, "upcoming" badge with Arabic plurals,
// long-press M3 menu). Data: the existing watch-history store (cw.ts) —
// unchanged; per-series Cinemeta lookups only ADD the badge/dot metadata and
// fail soft. Every visual value lives in the --cw-* tokens (globals.css).

import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, ListPlus, X } from "lucide-react";
import { useNav, useSettings } from "@/lib/harbor/store";
import type { CwCard } from "@/lib/harbor/types";
import { getCwCards, getCwEntry, episodeWatchedSet, pushHistory, removeCw } from "@/lib/harbor/cw";
import { fetchMeta } from "@/lib/harbor/api";
import type { Meta, MetaVideo } from "@/lib/harbor/types";
import { PosterImage } from "../common/poster";
import {
  daysUntil,
  episodeFallback,
  homeT,
  remainingLabel,
  seasonEpisodeTag,
  upcomingLabel,
} from "@/lib/harbor/i18n";
import { useToast } from "@/hooks/use-toast";

// ---------- series metadata cache (badge/dot enrichment; fails soft) ----------
const seriesMetaCache = new Map<string, Promise<Meta | null>>();
function loadSeriesMeta(id: string): Promise<Meta | null> {
  let p = seriesMetaCache.get(id);
  if (!p) {
    p = fetchMeta("series", id).catch(() => null);
    seriesMetaCache.set(id, p);
  }
  return p;
}

type UpcomingInfo = {
  /** next episode airs at this epoch ms → show the badge */
  nextAirMs?: number;
  /** next episode already aired and unwatched → show the amber dot */
  fresh?: boolean;
};

/** Resolve the next-unwatched-episode state for a CW card. Only looks at the
 *  episode AFTER the saved position (or the saved one itself when it hasn't
 *  aired yet). Never throws; returns nothing when data is unavailable. */
function useUpcomingEpisode(card: CwCard, enabled: boolean, watched: Set<string>): UpcomingInfo {
  const [info, setInfo] = useState<UpcomingInfo>({});
  useEffect(() => {
    if (!enabled || card.type !== "series" || !card.season || !card.episode) return;
    let alive = true;
    (async () => {
      const meta = await loadSeriesMeta(card.id);
      if (!alive || !meta?.videos?.length) return;
      const videos = [...meta.videos]
        .filter((v) => v.season && v.episode)
        .sort((a, b) => a.season! - b.season! || a.episode! - b.episode!);
      const curIdx = videos.findIndex((v) => v.season === card.season && v.episode === card.episode);
      if (curIdx < 0) return;
      const finished = card.progress >= 0.92 || watched.has(videos[curIdx].id);
      if (!finished) {
        // Mid-episode: badge only when this very episode hasn't aired yet
        const rel = Date.parse(videos[curIdx].released ?? "");
        if (Number.isFinite(rel) && rel > Date.now()) {
          setInfo({ nextAirMs: rel });
        }
        return;
      }
      const next: MetaVideo | undefined = videos[curIdx + 1];
      if (!next) return;
      const rel = Date.parse(next.released ?? "");
      if (!Number.isFinite(rel)) return;
      if (rel > Date.now()) {
        setInfo({ nextAirMs: rel });
      } else if (!watched.has(next.id)) {
        setInfo({ fresh: true });
      }
    })();
    return () => {
      alive = false;
    };
  }, [card.id, card.type, card.season, card.episode, card.progress, enabled, watched]);
  return info;
}

function currentLang(): string {
  try {
    return useSettings.getState().settings.uiLanguage || "en";
  } catch {
    return "en";
  }
}

// ---------- long-press / context M3 menu ----------
type MenuState = { card: CwCard; x: number; y: number } | null;

function CwContextMenu({
  state,
  onClose,
  onAction,
}: {
  state: NonNullable<MenuState>;
  onClose: () => void;
  onAction: (action: "details" | "watched" | "remove") => void;
}) {
  const lang = useSettings((s) => s.settings.uiLanguage || "en");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", onClose);
    window.addEventListener("scroll", onClose, true);
    return () => {
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);

  // Focus the first item when the menu opens (items are native buttons)
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
  }, []);

  const items: {
    id: "details" | "watched" | "remove";
    label: string;
    icon: React.ReactNode;
    danger?: boolean;
  }[] = [
    { id: "details", label: homeT("viewDetails", lang), icon: <ListPlus className="h-4 w-4" /> },
    { id: "watched", label: homeT("markWatched", lang), icon: <Eye className="h-4 w-4" /> },
    { id: "remove", label: homeT("removeFromCw", lang), icon: <X className="h-4 w-4" />, danger: true },
  ];

  // Clamp to the viewport (menu ≈ 220×176)
  const left = Math.max(8, Math.min(state.x, window.innerWidth - 228));
  const top = Math.max(8, Math.min(state.y, window.innerHeight - 184));

  return (
    <div ref={ref} className="cw-menu harbor-pop-in" role="menu" aria-label={state.card.name} style={{ left, top }}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          data-danger={item.danger || undefined}
          className="md-state harbor-tv-focus"
          onClick={() => onAction(item.id)}
        >
          {item.icon}
          <span className="truncate">{item.label}</span>
        </button>
      ))}
    </div>
  );
}

// ---------- card ----------
function CwCardItem({
  card,
  watched,
  enrich,
  onOpenMenu,
}: {
  card: CwCard;
  watched: Set<string>;
  enrich: boolean;
  onOpenMenu: (card: CwCard, x: number, y: number) => void;
}) {
  const lang = useSettings((s) => s.settings.uiLanguage || "en");
  const push = useNav((s) => s.push);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);
  const upcoming = useUpcomingEpisode(card, enrich, watched);

  const art = card.background ?? card.poster;
  const epTag = seasonEpisodeTag(card.season, card.episode);
  const isSeries = card.type === "series";

  // Subtitle: episode name (fallback "الحلقة {n}") for series; optional
  // remaining time for movies. Entry lookups are memoized per card id.
  const subtitle = useMemo(() => {
    if (isSeries) {
      return card.episodeName?.trim() || episodeFallback(card.episode, lang);
    }
    const e = getCwEntry(card.id);
    if (!e?.durationMs) return null;
    return remainingLabel(e.durationMs - e.positionMs, lang);
  }, [card.id, card.episode, card.episodeName, isSeries, lang]);

  const badge = upcoming.nextAirMs !== undefined ? upcomingLabel(upcoming.nextAirMs, lang) : null;

  const open = () => push({ kind: "detail", type: card.type, id: card.id });

  const clearPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    longPressed.current = false;
    const { clientX, clientY } = e;
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      onOpenMenu(card, clientX, clientY);
    }, 500);
  };

  const onClick = () => {
    if (longPressed.current) {
      longPressed.current = false;
      return;
    }
    open();
  };

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    onOpenMenu(card, e.clientX, e.clientY);
  };

  const ariaLabel = [
    `${homeT("resumeAria", lang)} ${card.name}`,
    epTag ?? "",
    subtitle ?? "",
    card.progress > 0 ? `${Math.round(card.progress * 100)}%` : "",
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="cw-card shrink-0">
      <button
        type="button"
        className="harbor-tv-focus absolute inset-0 h-full w-full cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-accent-var)]"
        aria-label={ariaLabel}
        onClick={onClick}
        onPointerDown={onPointerDown}
        onPointerUp={clearPress}
        onPointerLeave={clearPress}
        onPointerCancel={clearPress}
        onContextMenu={onContextMenu}
      >
        {art ? (
          <PosterImage src={art} alt="" className="absolute inset-0" landscape />
        ) : (
          <div className="cw-art-fallback" aria-hidden />
        )}
        <div className="cw-card-scrim" aria-hidden />

        <div className="cw-text">
          {epTag && <p className="cw-ep-tag harbor-clamp-1">{epTag}</p>}
          <p className="cw-title harbor-clamp-1">{card.name}</p>
          {subtitle && <p className="cw-sub harbor-clamp-1">{subtitle}</p>}
        </div>

        {card.progress > 0 && (
          <div
            className="cw-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(card.progress * 100)}
            aria-label={`${Math.round(card.progress * 100)}%`}
          >
            <span style={{ width: `${Math.min(100, Math.max(0, card.progress * 100))}%` }} />
          </div>
        )}
      </button>

      {badge && <span className="cw-badge harbor-clamp-1 max-w-[70%]">{badge}</span>}
      {upcoming.fresh && <span className="cw-fresh" aria-hidden title={homeT("newEpisode", lang)} />}
    </div>
  );
}

// ---------- section ----------
export function HomeCwSection() {
  const lang = useSettings((s) => s.settings.uiLanguage || "en");
  const [cards, setCards] = useState<CwCard[] | null>(null); // null = loading
  const [menu, setMenu] = useState<MenuState>(null);
  const { toast } = useToast();

  useEffect(() => {
    const load = () => setCards(getCwCards());
    const t = setTimeout(load, 0); // post-hydration (localStorage is client-only)
    window.addEventListener("harbor:data-changed", load);
    return () => {
      clearTimeout(t);
      window.removeEventListener("harbor:data-changed", load);
    };
  }, []);

  const watched = useMemo(() => (cards ? episodeWatchedSet() : new Set<string>()), [cards]);

  const onAction = (card: CwCard, action: "details" | "watched" | "remove") => {
    setMenu(null);
    if (action === "details") {
      useNav.getState().push({ kind: "detail", type: card.type, id: card.id });
      return;
    }
    if (action === "watched") {
      const e = getCwEntry(card.id);
      const duration = e?.durationMs || 1;
      pushHistory({
        id: card.id,
        type: card.type,
        name: card.name,
        poster: card.poster,
        videoId: card.videoId ?? e?.videoId,
        season: card.season,
        episode: card.episode,
        episodeName: e?.episodeName,
        positionMs: duration, // fully watched (1ms/1ms when duration unknown)
        durationMs: duration,
      });
      removeCw(card.id);
      toast({ title: homeT("watchedToast", lang) });
      return;
    }
    removeCw(card.id);
  };

  if (cards === null) return <CwSkeleton label={homeT("continueWatching", lang)} />;
  if (cards.length === 0) return null; // hide the whole section when empty

  return (
    <section className="cw-section" aria-label={homeT("continueWatching", lang)}>
      <h2 className="cw-header text-ink">{homeT("continueWatching", lang)}</h2>
      <div className="cw-row">
        {cards.slice(0, 12).map((card, i) => (
          <CwCardItem
            key={card.id}
            card={card}
            watched={watched}
            enrich={i < 6} // bound Cinemeta lookups to the first visible cards
            onOpenMenu={(c, x, y) => setMenu({ card: c, x, y })}
          />
        ))}
      </div>
      {menu && (
        <CwContextMenu state={menu} onClose={() => setMenu(null)} onAction={(a) => onAction(menu.card, a)} />
      )}
    </section>
  );
}

// ---------- skeleton (same dimensions, shimmering) ----------
function CwSkeleton({ label }: { label: string }) {
  return (
    <section className="cw-section" aria-label={label} aria-busy="true">
      <div
        className="harbor-skeleton mb-4 h-[22px] w-[150px] rounded-lg"
        style={{ marginInline: "var(--cw-pad)" }}
      />
      <div className="cw-row">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="cw-card shrink-0">
            <div className="harbor-skeleton absolute inset-0" />
          </div>
        ))}
      </div>
    </section>
  );
}
