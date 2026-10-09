"use client";

// Harbor Web — Stream picker overlay (port of Harbor play-picker: fetch streams from all
// addons, parse + score + rank, tier grouping, quality filters)
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  X, Loader2, RefreshCw, Search, Filter, Zap, Gauge, HardDrive, Signal, Globe, FileVideo, KeyRound,
  Network, ExternalLink, CheckCircle2, AlertTriangle, Wifi,
} from "lucide-react";
import type { Stream } from "@/lib/harbor/types";
import { useAddons, useNav, useSettings } from "@/lib/harbor/store";
import { useDebrid, type DebridService } from "@/lib/harbor/debrid";
import { fetchStreams, fetchMeta, defaultVideoId } from "@/lib/harbor/api";
import { runPipeline, tierOf, TIER_ORDER, formatSize } from "@/lib/harbor/scoring";
import {
  classifyStream,
  serverCapabilities,
  verdictRank,
  cachedTranscodeSupported,
  cachedTorrentMode,
  type StreamClass,
} from "@/lib/harbor/playback";
import {
  p2pPrepare,
  p2pStatus,
  p2pPlan,
  pickAudioRel,
  refreshP2pCapabilities,
  p2pEngineAvailable,
  cachedEngineAvailable,
  type P2pPlaybackPlan,
} from "@/lib/harbor/p2p";
import { browserEngineStreamGate } from "@/lib/harbor/browser-engine";
import { t } from "@/lib/harbor/i18n";
import { useToast } from "@/hooks/use-toast";
import { PlayerOverlay } from "../player/player-overlay";
import { cn } from "@/lib/utils";

export function PickerOverlay({
  type,
  id,
  videoId,
  season,
  episode,
  runtimeSeconds,
}: {
  type: string;
  id: string;
  videoId?: string;
  season?: number;
  episode?: number;
  runtimeSeconds?: number;
}) {
  const pop = useNav((s) => s.pop);
  const push = useNav((s) => s.push);
  const addons = useAddons((s) => s.addons);
  const addonsLoaded = useAddons((s) => s.loaded);
  const settings = useSettings((s) => s.settings);
  const { toast } = useToast();
  const debridConfigured = useDebrid((s) => s.apiKey !== null);
  const [debridDialogOpen, setDebridDialogOpen] = useState(false);

  // Ensure a persisted debrid key is visible even when the user jumps straight
  // into a picker after a reload (idempotent; settings loads it too).
  useEffect(() => {
    useDebrid.getState().load();
  }, []);

  // Torrent rows: no debrid key → offer the inline setup dialog (does not leave the picker).
  const handleDebridNotConfigured = useCallback(() => {
    setDebridDialogOpen(true);
  }, []);

  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);
  const [progressAddons, setProgressAddons] = useState(0);
  const [totalAddons, setTotalAddons] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [playing, setPlaying] = useState<Stream | null>(null);
  // "Show all streams" toggle: default = playable only (per settings), with a
  // visible count of hidden entries so nothing feels missing.
  const [showAll, setShowAll] = useState(!settings.playableOnly);

  // Warm the server capability cache so badges classify correctly on first paint
  useEffect(() => {
    void serverCapabilities();
  }, []);

  // TV-mode auto focus: keyboard users landing in the picker should get focus moved
  // to the dialog without touching the mouse. Mouse use (dataset.tv flips off in
  // tvnav) never steals focus. The check happens inside the delayed callback so a
  // mouse jiggle during the settle window cancels the steal.
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const focusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleTvFocus = useCallback(() => {
    if (focusTimer.current) clearTimeout(focusTimer.current);
    focusTimer.current = setTimeout(() => {
      requestAnimationFrame(() => {
        if (document.documentElement.dataset.tv !== "on") return;
        const row = bodyRef.current?.querySelector<HTMLElement>(".harbor-picker-row");
        const target = row ?? closeRef.current;
        target?.focus({ preventScroll: true });
        row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
    }, 350);
  }, []);

  // On open: focus the first row if streams are already there, else the close button.
  useEffect(() => {
    scheduleTvFocus();
    return () => {
      if (focusTimer.current) clearTimeout(focusTimer.current);
    };
  }, [scheduleTvFocus]);

  // Once streams finish loading (or fail), settle for ~350ms then move focus in.
  useEffect(() => {
    if (!loading) scheduleTvFocus();
  }, [loading, scheduleTvFocus]);

  // Resolved stream target: `id:season:episode` for series (resolved from meta when
  // the picker was opened with a bare series id), else the raw id.
  const [targetId, setTargetId] = useState(videoId ?? id);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setStreams([]);
    const eligible = addons.filter(
      (a) => a.enabled && (a.manifest.resources ?? []).some((r) => (typeof r === "string" ? r === "stream" : r.name === "stream")),
    );
    setTotalAddons(eligible.length);
    setProgressAddons(0);
    if (eligible.length === 0) {
      setLoading(false);
      setError("No stream addons installed. Install a stream addon to watch titles.");
      return;
    }
    try {
      // Series opened without an episode id (bare tt-id): stream addons need
      // "id:season:episode" — resolve the default video from meta first.
      let tid = targetId;
      if (type === "series" && !tid.includes(":")) {
        const meta = await fetchMeta("series", id).catch(() => null);
        const vid = defaultVideoId(meta);
        if (vid) {
          tid = vid;
          setTargetId(vid);
        }
      }
      const results = await fetchStreams(addons, type, tid);
      await serverCapabilities();
      const ranked = runPipeline(results);
      // Playable-first ordering: verdict rank is the primary key, the existing
      // quality/score order is preserved inside each verdict band.
      const withVerdict = ranked
        .map((s, i) => ({ s, i, c: classifyStream(s) }))
        .sort((a, b) => verdictRank(a.c.verdict) - verdictRank(b.c.verdict) || a.i - b.i)
        .map((x) => x.s);
      setStreams(withVerdict);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch streams");
    } finally {
      setLoading(false);
    }
  }, [addons, type, targetId, id]);

  useEffect(() => {
    if (addonsLoaded) load();
  }, [addonsLoaded, load]);

  // progress simulation per addon completion
  useEffect(() => {
    if (!loading || totalAddons === 0) return;
    const t = setInterval(() => {
      setProgressAddons((p) => Math.min(totalAddons, p + 1));
    }, 700);
    return () => clearInterval(t);
  }, [loading, totalAddons]);

  const tiers = useMemo(() => {
    const map = new Map<string, Stream[]>();
    for (const s of streams) {
      const tier = tierOf(s);
      if (!map.has(tier)) map.set(tier, []);
      map.get(tier)!.push(s);
    }
    return TIER_ORDER.filter((t) => map.has(t)).map((t) => ({ tier: t, items: map.get(t)! }));
  }, [streams]);

  const filteredTiers = useMemo(() => {
    if (filter === "all" && !query.trim() && showAll) return tiers;
    return tiers
      .map(({ tier, items }) => ({
        tier,
        items: items.filter((s) => {
          // playable-only default: hide streams this browser+server cannot play
          if (!showAll) {
            const v = classifyStream(s);
            if (v.verdict === "unplayable") return false;
          }
          if (filter === "free" && !((!!s.url && s.url !== "#") || !!s.infoHash)) return false;
          if (filter === "4k" && !s.parsed?.resolution?.match(/4K/)) return false;
          if (filter === "1080p" && s.parsed?.resolution !== "1080p") return false;
          if (filter === "cached" && !Object.values(s.cached ?? {}).some(Boolean)) return false;
          if (query.trim()) {
            const q = query.toLowerCase();
            const text = `${s.title ?? ""} ${s.description ?? ""} ${s.addonName ?? ""}`.toLowerCase();
            if (!text.includes(q)) return false;
          }
          return true;
        }),
      }))
      .filter((t) => t.items.length > 0);
  }, [tiers, filter, query, showAll]);

  // Count of playable-only hidden entries (shown next to the toggle)
  const hiddenCount = useMemo(() => {
    if (showAll) return 0;
    return streams.filter((s) => classifyStream(s).verdict === "unplayable").length;
  }, [streams, showAll]);

  if (playing) {
    const metaName = playing.title?.split("\n")[0] ?? "";
    return (
      <PlayerOverlay
        payload={{
          url: playing.url ?? "",
          title: metaName,
          type,
          metaId: id,
          season,
          episode,
          videoId: targetId,
          streamTitle: playing.title,
          streamDescription: playing.description,
          deepLink: { type, id, videoId: targetId },
          stream: playing,
          runtimeSeconds,
          ...(playing.p2p ? { p2p: playing.p2p } : {}),
          ...(playing.p2pBrowser ? { p2pBrowser: playing.p2pBrowser } : {}),
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-end md:items-center justify-center" role="dialog" aria-modal="true" aria-label="Stream picker">
      <div className="md-sheet rounded-b-none! md:rounded-b-[28px]! w-full md:max-w-3xl md:max-h-[82vh] max-h-[88vh] flex flex-col overflow-hidden shadow-[var(--md-sys-elevation-3)]">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 py-4 border-b border-edge-soft shrink-0 sm:px-5">
          <div className="min-w-0">
            <h2 className="md-title-medium text-ink">Choose a stream</h2>
            <p className="text-xs text-ink-subtle truncate">
              {type === "series" ? `Series · ${targetId}` : targetId}
              {season ? ` · S${season}:E${episode}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={load}
              className="md-icon-btn md-state harbor-tv-focus"
              aria-label="Refresh streams"
              title="Refresh"
            >
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            </button>
            <button
              type="button"
              ref={closeRef}
              onClick={pop}
              className="md-icon-btn md-state harbor-tv-focus"
              aria-label="Close picker"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="px-4 py-3 border-b border-edge-soft flex items-center gap-2 flex-wrap shrink-0 sm:px-5">
          {(
            [
              ["all", "All"],
              ["free", "Free"],
              ["cached", "Cached"],
              ["4k", "4K"],
              ["1080p", "1080p"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className={cn("md-chip md-state", filter === key && "md-chip-selected")}
            >
              {label}
            </button>
          ))}
          {/* Playability visibility: playable-first by default, everything available on demand */}
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            aria-pressed={showAll}
            className={cn("md-chip md-state", showAll && "md-chip-selected")}
            title={
              showAll
                ? "Showing every stream"
                : `Showing streams that can play here${hiddenCount > 0 ? ` — ${hiddenCount} hidden` : ""}`
            }
          >
            {showAll ? "Showing all" : "Playable here"}
            {!showAll && hiddenCount > 0 ? ` (${hiddenCount} hidden)` : ""}
          </button>
          <div className="relative ms-auto w-36 sm:w-40">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-subtle" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter…"
              className="md-field-outlined w-full pl-8 pr-2 py-1.5 text-xs placeholder:text-ink-subtle"
              aria-label="Filter streams"
            />
          </div>
        </div>

        {/* No-debrid hint: honest per-environment — torrents need an engine or debrid */}
        {!loading && !debridConfigured && filteredTiers.length > 0 && (
          <div className="mx-4 mt-3 flex items-center gap-2.5 rounded-xl border border-accent/30 bg-accent/10 px-3.5 py-2.5 text-xs text-ink-muted shrink-0 sm:mx-5">
            <Network className="w-4 h-4 text-accent shrink-0" aria-hidden />
            <p className="min-w-0 flex-1">
              {t(
                cachedTorrentMode() === "browser"
                  ? "p2pBannerBrowser"
                  : cachedTorrentMode() === "none"
                    ? "p2pBannerServerless"
                    : "p2pBannerBuiltin",
                useSettings.getState().settings.uiLanguage,
              )}
            </p>
            <button
              type="button"
              onClick={handleDebridNotConfigured}
              className="harbor-tv-focus md-state shrink-0 rounded-full bg-accent-soft px-3 py-1 text-[11px] font-bold text-accent"
            >
              Connect
            </button>
          </div>
        )}

        {/* Body */}
        <div ref={bodyRef} className="harbor-picker-body flex-1 overflow-y-auto harbor-scroll px-4 py-4 space-y-5 sm:px-5">
          {loading && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-ink-muted">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                Querying {progressAddons}/{totalAddons || "?"} stream addons…
              </div>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="harbor-skeleton rounded-xl h-[68px] p-3 flex items-center gap-3.5" aria-hidden>
                  {/* shaped like a StreamRow: resolution chip / title+meta / unlock button */}
                  <div className="w-14 h-9 rounded-lg bg-white/10 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-2/3 rounded bg-white/10" />
                    <div className="h-2.5 w-1/3 rounded bg-white/10" />
                  </div>
                  <div className="w-16 h-7 rounded-lg bg-white/10 shrink-0" />
                </div>
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="rounded-xl border border-danger/40 bg-danger/10 text-danger px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {!loading && !error && filteredTiers.length === 0 && (
            <div className="text-center py-14 text-ink-subtle">
              <Filter className="w-9 h-9 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No streams match. Try refreshing or removing filters.</p>
            </div>
          )}

          {!loading &&
            filteredTiers.map(({ tier, items }) => (
              <section key={tier}>
                <div className="flex items-center gap-2 mb-2.5">
                  <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full shrink-0", tierDotColor(tier))} />
                  <h3 className="text-xs font-bold uppercase tracking-widest text-ink-muted">{tier}</h3>
                  <span className="text-[10px] text-ink-subtle">{items.length} streams</span>
                  <div className="flex-1 h-px bg-edge-soft" />
                </div>
                <div className="space-y-2">
                  {items.slice(0, 40).map((s, i) => (
                    <StreamRow
                      key={`${s.addonId}-${i}`}
                      stream={s}
                      onPick={setPlaying}
                      onNeedsSetup={handleDebridNotConfigured}
                      configured={debridConfigured}
                      showQuality={settings.showQualityInfo}
                    />
                  ))}
                </div>
              </section>
            ))}
        </div>
      </div>
      {debridDialogOpen && <DebridSetupDialog onClose={() => setDebridDialogOpen(false)} />}
    </div>
  );
}

// Quality-ladder dot per tier header: emerald top, amber mid, neutral low —
// colors follow Harbor's existing palette conventions (understated).
function tierDotColor(tier: string): string {
  if (tier === "4K HDR" || tier === "4K") return "bg-emerald-400";
  if (tier === "1080p HDR" || tier === "1080p") return "bg-amber-500";
  if (tier === "720p" || tier === "SD") return "bg-zinc-500";
  return "bg-zinc-600";
}

// Compatibility badge styles per verdict (green/yellow/gray per spec)
const BADGE_STYLES: Record<
  StreamClass["badge"],
  { label: string; title: string; className: string; dot: string }
> = {
  "plays-here": {
    label: "Plays here",
    title: "Direct play — this stream matches your browser",
    className: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
    dot: "bg-emerald-400",
  },
  "plays-proxy": {
    label: "Via proxy",
    title: "Plays through the secure proxy (CORS/headers handled)",
    className: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
    dot: "bg-amber-400",
  },
  "plays-browser": {
    label: "Via browser",
    title: "Plays through the in-browser engine (web peers over WebRTC)",
    className: "bg-purple-500/15 text-purple-300 border border-purple-500/30",
    dot: "bg-purple-400",
  },
  "plays-convert": {
    label: "Convert",
    title: "Needs on-demand conversion (MKV/HEVC/AC3-DTS) — server converts to H.264/AAC",
    className: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
    dot: "bg-amber-400",
  },
  external: {
    label: "External",
    title: "Opens in a new tab (external link or YouTube)",
    className: "bg-raised text-ink-muted border border-edge-soft",
    dot: "bg-zinc-400",
  },
  "not-playable": {
    label: "Can't play",
    title: "Cannot play in this browser with the current server settings",
    className: "bg-zinc-500/15 text-zinc-400 border border-zinc-500/30",
    dot: "bg-zinc-500",
  },
};

function StreamRow({
  stream,
  onPick,
  onNeedsSetup,
  configured,
  showQuality,
}: {
  stream: Stream;
  onPick: (s: Stream) => void;
  onNeedsSetup: () => void;
  configured: boolean;
  showQuality: boolean;
}) {
  const { toast } = useToast();
  const debridKey = useDebrid((s) => s.apiKey);
  const debridResolve = useDebrid((s) => s.resolve);
  const [resolving, setResolving] = useState(false);
  // P2P connecting state: null = idle, else seconds elapsed while joining the swarm
  const [p2pPhase, setP2pPhase] = useState<"idle" | "joining" | "planning">("idle");
  const [p2pInfo, setP2pInfo] = useState<{ peers: number; elapsed: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // Torrent engine reachability: null = probing, true/false = cached probe result.
  // Drives an honest tooltip on the P2P button (serverless hosts can't run it).
  const [engineOffline, setEngineOffline] = useState<boolean | null>(cachedEngineAvailable() === false ? true : null);
  const errTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const p2pAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (errTimer.current) clearTimeout(errTimer.current);
      p2pAbort.current?.abort();
    };
  }, []);

  // One shared engine probe (cached module-wide) → honest P2P button hint.
  useEffect(() => {
    let alive = true;
    void p2pEngineAvailable().then((ok) => {
      if (alive) setEngineOffline(!ok);
    });
    return () => {
      alive = false;
    };
  }, []);

  const cached = Object.values(stream.cached ?? {}).some(Boolean);
  const isTorrent = !!stream.infoHash && !stream.url; // torrent without a direct URL → debrid unlock OR P2P
  const p2pEnabled = useSettings((s) => s.settings.p2pEnabled);
  const p = stream.parsed;
  // Playback compatibility badge (computed BEFORE the user picks)
  const cls: StreamClass = classifyStream(stream);
  const badgeInfo = BADGE_STYLES[cls.badge];
  const titleLine = (stream.title ?? stream.description ?? "Stream").split("\n")[0];
  const detailLine = (stream.description ?? "").split("\n").filter(Boolean).slice(1).join(" ").slice(0, 140);

  const fail = (msg: string) => {
    setErr(msg);
    toast({ title: "Stream unavailable", description: msg, variant: "destructive" });
    if (errTimer.current) clearTimeout(errTimer.current);
    errTimer.current = setTimeout(() => setErr(null), 6000);
  };

  const unlock = async (e?: React.MouseEvent | React.KeyboardEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    if (resolving) return;
    if (debridKey === null) {
      onNeedsSetup();
      return;
    }
    setResolving(true);
    setErr(null);
    const res = await debridResolve(
      stream.infoHash!,
      stream.behaviorHints?.filename,
      stream.parsed?.size,
    );
    setResolving(false);
    if ("url" in res && res.url) {
      onPick({
        ...stream,
        url: res.url,
        behaviorHints: {
          ...stream.behaviorHints,
          ...(res.filename ? { filename: res.filename } : {}),
        },
      });
    } else {
      const msg = "error" in res ? res.error : "Unlock failed";
      fail(msg);
    }
  };

  // Play a torrent through the server-side P2P engine: join swarm → wait for
  // metadata → pick the right file (native container vs ffmpeg remux) → play.
  const playP2p = async (e?: React.MouseEvent | React.KeyboardEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    if (p2pPhase !== "idle") return;
    if (!useSettings.getState().settings.p2pEnabled) {
      onNeedsSetup();
      return;
    }
    const lang = useSettings.getState().settings.uiLanguage;
    // Engine probe first — on serverless deployments the torrent-service can't
    // run; fail fast with guidance instead of polling peers against a 404.
    if (!(await p2pEngineAvailable())) {
      // Zero-install rescue: the in-browser engine (WebTorrent in this page)
      // when the user opted in and this browser can actually do it.
      const gate = browserEngineStreamGate(stream);
      if (gate === "ok") {
        onPick({
          ...stream,
          url: "",
          p2pBrowser: {
            infoHash: stream.infoHash!.toLowerCase(),
            fileIdx: stream.fileIdx ?? null,
            filename: stream.behaviorHints?.filename ?? stream.parsed?.filename ?? null,
          },
        });
        return;
      }
      if (gate === "hevc") {
        fail(t("browserEngineHevc", lang));
        return;
      }
      if (gate === "container") {
        fail(t("browserEngineContainer", lang));
        return;
      }
      setEngineOffline(true);
      fail(t("p2pUnavailable", lang));
      return;
    }
    setErr(null);
    setP2pPhase("joining");
    setP2pInfo({ peers: 0, elapsed: 0 });
    const startedAt = Date.now();
    const abort = new AbortController();
    p2pAbort.current = abort;
    const infoHash = stream.infoHash!.toLowerCase();

    // progress ticker while the swarm join runs
    const ticker = setInterval(() => {
      setP2pInfo((prev) => (prev ? { ...prev, elapsed: Math.round((Date.now() - startedAt) / 1000) } : prev));
    }, 1000);

    try {
      // 1) prepare (join swarm). 202 = metadata still downloading → poll status.
      const prep = await p2pPrepare(infoHash, {
        fileIdx: stream.fileIdx,
        filename: stream.behaviorHints?.filename ?? stream.parsed?.filename,
      });

      // 2) poll while discovering (up to ~100s; the engine keeps the swarm alive)
      while (prep.pending) {
        if (abort.signal.aborted) throw new DOMException("cancelled", "AbortError");
        if (Date.now() - startedAt > 100_000) {
          throw new Error(
            "Could not find peers for this torrent. The swarm may be dead or this network blocks BitTorrent — a debrid service would unlock it instantly.",
          );
        }
        await new Promise((r) => setTimeout(r, 2500));
        if (abort.signal.aborted) throw new DOMException("cancelled", "AbortError");
        const st = await p2pStatus(infoHash).catch(() => null);
        setP2pInfo((prev) => (prev ? { ...prev, peers: st?.peers ?? prev.peers } : prev));
        if (st?.ready) break;
      }

      // 3) choose serving mode (native range stream vs ffmpeg remux for mkv)
      setP2pPhase("planning");
      await refreshP2pCapabilities(); // engine-level HEVC conversion flag
      const fileIdx = prep.pending
        ? await (async () => {
            const st = await p2pStatus(infoHash);
            const filename = stream.behaviorHints?.filename ?? stream.parsed?.filename;
            const idx = Number.isInteger(stream.fileIdx)
              ? stream.fileIdx!
              : st.files
                ? pickFileIndex(st.files, filename)
                : 0;
            return idx;
          })()
        : prep.fileIdx;
      const filename = stream.behaviorHints?.filename ?? stream.parsed?.filename;
      let plan: P2pPlaybackPlan;
      try {
        plan = await p2pPlan(infoHash, fileIdx, filename);
      } catch {
        plan = { key: infoHash, fileIdx, url: `/stream/${infoHash}/${fileIdx}`, mode: "unknown" };
      }
      if (plan.mode === "unknown" && plan.codec?.video === "hevc") {
        throw new Error(
          `This file uses ${plan.codec.video.toUpperCase()} video which browsers cannot play — unlock it with debrid instead.`,
        );
      }
      // Dub pre-selection: embed the preferred audio track in the first remux
      // URL so the player never attaches to the wrong dub (the player-side
      // discovery effect syncs its state from the same codec report).
      if (plan.mode === "remux") {
        const tracks = plan.codec?.audioTracks ?? [];
        if (tracks.length > 0) {
          const rel = pickAudioRel(tracks, useSettings.getState().settings.preferredLanguages);
          if (rel > 0) plan.url = `${plan.url}&audio=${rel}`;
        }
      }
      clearInterval(ticker);
      setP2pPhase("idle");
      setP2pInfo(null);
      onPick({
        ...stream,
        url: plan.url,
        behaviorHints: {
          ...stream.behaviorHints,
          filename: filename ?? plan.codec?.filename,
        },
        p2p: { key: plan.key, fileIdx: plan.fileIdx, infoHash, mode: plan.mode },
      });
    } catch (e) {
      clearInterval(ticker);
      setP2pPhase("idle");
      setP2pInfo(null);
      if ((e as Error)?.name === "AbortError") return;
      fail(e instanceof Error ? e.message : "P2P stream failed");
    }
  };

  const rowActivate = () => {
    // External destinations (YouTube ids / openInBrowser links) never enter the player
    if (cls.verdict === "external") {
      const target = cls.ytId
        ? `https://www.youtube.com/watch?v=${cls.ytId}`
        : cls.externalUrl;
      if (target) window.open(target, "_blank", "noopener,noreferrer");
      return;
    }
    if (isTorrent) {
      if (debridKey !== null) void unlock();
      else if (p2pEnabled) void playP2p();
      else onNeedsSetup();
    } else {
      onPick(stream);
    }
  };

  const busy = resolving || p2pPhase !== "idle";
  const direct = !!stream.url && !isTorrent;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={rowActivate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          rowActivate();
        }
      }}
      aria-label={`${titleLine} — play stream`}
      className={cn(
        "harbor-tv-focus harbor-picker-row md-state relative w-full flex flex-wrap items-center gap-2.5 overflow-hidden rounded-[var(--md-sys-shape-corner-medium)] border p-2.5 text-start transition-colors cursor-pointer sm:gap-3.5 sm:p-3",
        cached ? "border-emerald-500/30 bg-emerald-500/5" : "border-edge-soft bg-[var(--md-sys-color-surface-container)]",
        direct && "border-l-2 border-l-emerald-500/50",
      )}
    >
      {busy && (
        <span className="absolute inset-0 z-10 rounded-[var(--md-sys-shape-corner-medium)] bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-1" aria-live="polite">
          {resolving ? (
            <Loader2 className="w-5 h-5 text-accent animate-spin" />
          ) : (
            <>
              <span className="flex items-center gap-2 text-xs font-semibold text-ink">
                <Wifi className="w-4 h-4 text-accent animate-pulse" aria-hidden />
                {p2pPhase === "planning" ? "Preparing file…" : "Joining swarm…"}
              </span>
              <span className="text-[10px] text-ink-subtle">
                {p2pInfo?.peers ? `${p2pInfo.peers} peers` : "looking for peers"} · {p2pInfo?.elapsed ?? 0}s
              </span>
            </>
          )}
        </span>
      )}
      <div className="flex min-w-0 flex-col items-center gap-1 w-12 shrink-0 sm:w-14">
        <span className={cn("max-w-full truncate rounded-lg px-2 py-1 text-[11px] font-bold", cached ? "bg-emerald-500/20 text-emerald-300" : "bg-raised text-ink-muted")}>
          {p?.resolution ?? "—"}
        </span>
        {p?.hdrFormat && (
          <span className="max-w-full truncate rounded px-1.5 py-0.5 text-[9px] font-bold bg-accent-soft text-accent">{p.hdrFormat}</span>
        )}
        {/* Playability badge: where this stream will actually play */}
        <span
          className={cn(
            "max-w-full overflow-hidden rounded-full px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-wide inline-flex items-center gap-1 whitespace-nowrap",
            badgeInfo.className,
          )}
          title={cls.reasons.length > 0 ? cls.reasons.join(" · ") : badgeInfo.title}
        >
          <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", badgeInfo.dot)} />
          {badgeInfo.label}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="harbor-clamp-1 text-sm font-medium text-ink">{titleLine}</p>
        {detailLine && !showQuality && (
          <p className="harbor-clamp-1 text-xs text-ink-subtle mt-0.5">{detailLine}</p>
        )}
        {showQuality && (
          <div className="flex items-center gap-2.5 mt-1 text-[10px] text-ink-subtle flex-wrap">
            {p?.codec && (
              <span className="flex items-center gap-1"><FileVideo className="w-3 h-3" />{p.codec}</span>
            )}
            {p?.size && <span className="flex items-center gap-1"><HardDrive className="w-3 h-3" />{formatSize(p.size)}</span>}
            {p?.seeders !== undefined && <span className="flex items-center gap-1"><Signal className="w-3 h-3" />{p.seeders} seeders</span>}
            {p?.source && <span className="flex items-center gap-1"><Gauge className="w-3 h-3" />{p.source}</span>}
          </div>
        )}
        <p className="text-[10px] text-ink-subtle mt-0.5 flex items-center gap-1.5 flex-wrap">
          {cached && <Zap className="w-3 h-3 text-emerald-400" />}
          {isTorrent && (
            <span className="rounded border border-edge-soft bg-raised px-1 py-0.5 text-[9px] font-bold text-ink-muted">
              DEBRID
            </span>
          )}
          {isTorrent && p2pEnabled && (
            <span className="rounded border border-accent/40 bg-accent/10 px-1 py-0.5 text-[9px] font-bold text-accent flex items-center gap-1">
              <Network className="w-2.5 h-2.5" aria-hidden /> P2P
            </span>
          )}
          {stream.addonName ?? "addon"}
        </p>
        {err && (
          <p className="basis-full w-full text-xs text-danger mt-1" role="alert">
            {err}
          </p>
        )}
      </div>
      {isTorrent && (
        /* w-full on phones: the two actions wrap to their own aligned row
           (justify-end = inline-end, so they hug the reading edge in both
           directions) instead of crushing the title column or spilling
           off-sheet; sm+ restores the inline layout. */
        <div className="flex w-full items-center justify-end gap-1.5 shrink-0 sm:w-auto sm:justify-start">
          {p2pEnabled && (
            <button
              type="button"
              onClick={(e) => void playP2p(e)}
              disabled={busy}
              className={cn(
                "harbor-tv-focus md-btn md-state h-8! px-2.5! text-xs! sm:h-9! sm:px-3.5!",
                debridKey === null ? "md-btn-filled" : "md-btn-tonal",
              )}
              aria-label={
                engineOffline
                  ? "P2P engine offline — use debrid or direct streams"
                  : debridKey === null
                    ? "Play via P2P"
                    : "Play via P2P torrent engine"
              }
              title={
                engineOffline
                  ? t("engineStartingHint", useSettings.getState().settings.uiLanguage)
                  : debridKey === null
                    ? "Play free via the built-in P2P engine"
                    : "Play via the built-in P2P engine (slower)"
              }
            >
              {p2pPhase !== "idle" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : engineOffline ? <Network className="w-3.5 h-3.5 opacity-50" aria-hidden /> : <Network className="w-3.5 h-3.5" aria-hidden />}
              {p2pPhase !== "idle" ? "Connecting…" : engineOffline ? "P2P" : "Play"}
            </button>
          )}
          <button
            type="button"
            onClick={(e) => void unlock(e)}
            disabled={resolving}
            className={cn(
              "harbor-tv-focus md-btn md-state h-9! px-3.5!",
              debridKey === null ? "md-btn-tonal" : "md-btn-filled",
            )}
            aria-label="Unlock with debrid"
            title={debridKey === null ? "Connect a debrid service for instant links" : "Unlock with your debrid service"}
          >
            {resolving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" aria-hidden />}
            {resolving ? "Unlocking…" : debridKey === null ? "Debrid" : "Unlock"}
          </button>
        </div>
      )}
    </div>
  );
}

// Choose the torrent file index client-side when metadata arrives via polling
function pickFileIndex(files: { index: number; name: string; length: number }[], filename?: string): number {
  const VIDEO_RE = /\.(mp4|m4v|webm|mkv|avi|mov|ts|flv|wmv|mpg|mpeg)$/i;
  const videos = files.filter((f) => VIDEO_RE.test(f.name) || f.length > 100 * 1024 * 1024);
  const pool = videos.length > 0 ? videos : files;
  if (filename) {
    const want = filename.toLowerCase().replace(/[\s._-]+/g, "").slice(0, 24);
    const byName = pool.find((f) => f.name.toLowerCase().replace(/[\s._-]+/g, "").includes(want));
    if (byName) return byName.index;
  }
  return pool.reduce((a, b) => (b.length > a.length ? b : a)).index;
}

// ---------------- Inline debrid setup (no settings detour) ----------------
function DebridSetupDialog({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const validate = useDebrid((s) => s.validate);
  const [svc, setSvc] = useState<DebridService>("realdebrid");
  const [key, setKey] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const serviceName = svc === "realdebrid" ? "Real-Debrid" : "AllDebrid";

  const connect = async () => {
    if (key.trim().length < 10) {
      setError("That API key looks too short — copy the full key from your account page.");
      return;
    }
    setChecking(true);
    setError(null);
    const ok = await validate(svc, key.trim());
    setChecking(false);
    if (ok) {
      toast({ title: "Debrid connected", description: `${serviceName} verified — cached streams unlock instantly now.` });
      onClose();
    } else {
      setError(useDebrid.getState().error ?? "Could not verify the key.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[170] bg-black/80 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Connect a debrid service"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="md-dialog rounded-b-none! md:rounded-b-[28px]! w-full md:max-w-md p-5">
        <div className="flex items-center gap-3 mb-1">
          <span className="w-9 h-9 rounded-[var(--md-sys-shape-corner-medium)] bg-accent-soft flex items-center justify-center shrink-0">
            <KeyRound className="w-4.5 h-4.5 text-accent" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="md-title-medium text-ink">Connect debrid</h2>
            <p className="text-[11px] text-ink-subtle">Instant cached streams — your key stays in this browser.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="md-icon-btn md-state harbor-tv-focus"
            aria-label="Close"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-4" role="radiogroup" aria-label="Debrid service">
          {(
            [
              ["realdebrid", "Real-Debrid"],
              ["alldebrid", "AllDebrid"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={svc === id}
              onClick={() => setSvc(id)}
              className={cn(
                "md-state rounded-[var(--md-sys-shape-corner-medium)] border px-3 py-2.5 text-xs font-bold transition-colors",
                svc === id
                  ? "border-accent bg-accent-soft text-accent ring-2 ring-accent"
                  : "border-edge-soft bg-raised text-ink-muted hover:text-ink",
              )}
            >
              {svc === id && <CheckCircle2 className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5" aria-hidden />}
              {label}
            </button>
          ))}
        </div>

        <label className="block text-xs font-medium text-ink-muted mt-4 mb-1.5" htmlFor="picker-debrid-key">
          {serviceName} API key
        </label>
        <input
          id="picker-debrid-key"
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void connect();
            e.stopPropagation();
          }}
          placeholder={svc === "realdebrid" ? "Paste your Real-Debrid API key" : "Paste your AllDebrid API key"}
          autoComplete="off"
          className="md-field-outlined w-full px-3 py-2.5 text-sm placeholder:text-ink-subtle"
        />
        {error && (
          <p className="flex items-start gap-1.5 text-xs text-danger mt-2" role="alert">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden />
            {error}
          </p>
        )}

        <div className="flex items-center gap-2 mt-4">
          <button
            type="button"
            onClick={() => void connect()}
            disabled={checking}
            className="md-btn md-btn-filled md-state flex-1"
          >
            {checking ? <Loader2 className="md-btn-icon animate-spin" aria-hidden /> : null}
            {checking ? "Verifying…" : "Connect"}
          </button>
          <a
            href={svc === "realdebrid" ? "https://real-debrid.com/account" : "https://alldebrid.com/api/"}
            target="_blank"
            rel="noreferrer"
            className="md-btn md-btn-tonal md-state"
            title="Open your account page to find the API key"
          >
            Get key <ExternalLink className="md-btn-icon" aria-hidden />
          </a>
        </div>
        <p className="text-[10px] text-ink-subtle mt-3">
          No debrid account? Torrents still play free via the built-in P2P engine — debrid just makes cached
          streams instant.
        </p>
      </div>
    </div>
  );
}
