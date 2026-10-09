"use client";

// Harbor Web — Player overlay (port of Harbor player.tsx + transport)
// HTML5 video + hls.js, subtitle engine (SRT/VTT/ASS via proxy), full keyboard shortcuts,
// continue-watching persistence, auto-next episode, stream switcher integration.
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Hls from "hls.js";
import {
  X, Play, Pause, Volume2, VolumeX, Maximize, Minimize, Subtitles, Settings2,
  Loader2, AlertTriangle, ChevronLeft, SkipForward, RotateCcw, RotateCw, ArrowLeftRight, PictureInPicture2, Gauge,
  AudioLines, Layers, Plus, Search, Network, StepBack, StepForward,
} from "lucide-react";
import type { PlayerPayload } from "@/lib/harbor/store";
import { useNav, useSettings } from "@/lib/harbor/store";
import type { LoadedSubtitle, SubCue } from "@/lib/harbor/subtitles";
import { fetchAndParseSubtitle, findActiveCue, subLabel } from "@/lib/harbor/subtitles";
import { SubtitleManager, mergeSubtitlesUnique, subtitleDedupeKey } from "@/lib/harbor/subtitle-manager";
import { langMatches, langChip } from "@/lib/harbor/languages";
import { fetchStreams, fetchSubtitles } from "@/lib/harbor/api";
import { runPipeline } from "@/lib/harbor/scoring";
import {
  classifyStream,
  classifyVideoError,
  resolveDirectSource,
  serverCapabilities,
  signSource,
  verdictRank,
  cachedTranscodeSupported,
  cachedTorrentMode,
  type FailureClass,
} from "@/lib/harbor/playback";
import { getLocalEngine } from "@/lib/harbor/local-engine";
import { attachBrowserTorrent, browserEngineStreamGate, type BrowserEngineErrCode } from "@/lib/harbor/browser-engine";
import { homeT, t, type AppStringKey } from "@/lib/harbor/i18n";
import { fetchMeta, defaultVideoId } from "@/lib/harbor/api";
import {
  PlaybackTimeline,
  formatClock,
  parseRuntimeToSeconds,
  spokenDuration,
  type TimelineSnapshot,
} from "@/lib/harbor/playback-timeline";
import type { MetaVideo, RawSubtitle, SubtitleResult, Stream } from "@/lib/harbor/types";
import { upsertCw, pushHistory, resumeMsFor } from "@/lib/harbor/cw";
import { useTrakt } from "@/lib/harbor/trakt";
import { p2pStatus, p2pRemuxUrl, p2pCodec, pickAudioRel, audioTrackLabel, formatSpeed, refreshP2pCapabilities, p2pEngineAvailable, type P2pAudioTrack } from "@/lib/harbor/p2p";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { PosterImage } from "../common/poster";
import { PickerOverlay } from "../views/picker-overlay";

type Phase = "resolving" | "loading" | "playing" | "error";

/** Localized error keys for the in-browser engine, by failure code. */
const BROWSER_ENGINE_ERR_KEYS: Record<BrowserEngineErrCode, AppStringKey> = {
  "no-webrtc": "browserEngineErrNoWebrtc",
  "load-failed": "browserEngineErrLoadFailed",
  "no-peers": "browserEngineErrNoPeers",
  "metadata-timeout": "browserEngineErrMetadataTimeout",
  "unsupported-container": "browserEngineErrUnsupportedContainer",
  "no-video-file": "browserEngineErrNoVideoFile",
  "render-failed": "browserEngineErrRenderFailed",
};

/** How the current <video> source is being served — drives the retry ladder. */
type SourceMode = "direct" | "proxy" | "transcode" | "p2p-native" | "p2p-remux" | "p2p-transcode" | "browser";

/** Classified playback failure — replaces the old one-size-fits-all string. */
export type PlaybackError = {
  message: string; // localized primary message
  cls: FailureClass | "torrent";
  code: number | string | null;
  host: string | null;
  canConvert: boolean; // conversion still available for this stream
  // Environment-aware actions for the error panel (all optional):
  canTryDirect?: boolean; // ranked candidates still hold a playable URL stream
  offerDebrid?: boolean;  // torrents exist but no debrid key is configured
};

export function PlayerOverlay({ payload }: { payload: PlayerPayload }) {
  const pop = useNav((s) => s.pop);
  const push = useNav((s) => s.push);
  const replace = useNav((s) => s.replace);
  const settings = useSettings((s) => s.settings);
  const { toast } = useToast();
  const [current, setCurrent] = useState<PlayerPayload>(payload);
  const [phase, setPhase] = useState<Phase>(payload.url || payload.p2pBrowser ? "loading" : "resolving");
  const [error, setError] = useState<PlaybackError | null>(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [resolveStatus, setResolveStatus] = useState<string>("Finding the best stream…");
  // When an episode switch fails to resolve, auto-open the stream picker
  // (spec: "if unavailable, open the stream picker") instead of a dead end.
  const autoPickerRef = useRef(false);
  // Auto-fallback state: ranked candidates from the resolve path + attempts used
  const candidatesRef = useRef<Stream[]>([]);
  const fallbackAttemptsRef = useRef(0);
  const currentRef = useRef<PlayerPayload>(payload);
  currentRef.current = current;

  // Stable callbacks — identity must never change, otherwise VideoStage re-attaches HLS every render
  const handlePhase = useCallback((p: "loading" | "playing") => {
    if (p === "playing") autoPickerRef.current = false;
    setPhase(p);
  }, []);

  // Auto-fallback: when a chosen stream fails after the proxy/convert ladder,
  // try the next best playable candidate (max 3 automatic attempts).
  // Returns "fell" (switched to another stream), "exhausted" (the attempt cap
  // was reached but ranked candidates still hold playable URL streams) or
  // "empty" (nothing left that could play).
  const tryFallback = useCallback(async (): Promise<"fell" | "exhausted" | "empty"> => {
    if (fallbackAttemptsRef.current >= 3) {
      return candidatesRef.current.some((s) => !!s.url) ? "exhausted" : "empty";
    }
    const cur = currentRef.current;
    if (!/^tt\d+$|^kitsu|^demo/.test(cur.metaId) && !cur.stream) return "empty";
    fallbackAttemptsRef.current += 1;
    const lang = useSettings.getState().settings.uiLanguage;
    toast({ title: homeT("tryingAnother", lang) });
    try {
      let candidates = candidatesRef.current;
      if (candidates.length === 0) {
        const { useAddons } = await import("@/lib/harbor/store");
        await serverCapabilities();
        const targetId = cur.videoId ?? cur.metaId;
        const results = await fetchStreams(useAddons.getState().addons, cur.type, targetId);
        candidates = runPipeline(results);
        candidatesRef.current = candidates;
      }
      const usedKey = `${cur.stream?.infoHash ?? ""}|${cur.stream?.url ?? cur.url}`;
      const pool = candidates
        .map((s, i) => ({ s, i, c: classifyStream(s) }))
        .filter(
          ({ s, c }) =>
            `${s.infoHash ?? ""}|${s.url ?? ""}` !== usedKey &&
            !!s.url && // fallback targets direct-URL streams only (torrents join via the resolver)
            c.verdict !== "unplayable" &&
            c.verdict !== "external",
        )
        .sort((a, b) => verdictRank(a.c.verdict) - verdictRank(b.c.verdict) || a.i - b.i);
      const next = pool[0];
      if (!next) return "empty";
      candidatesRef.current = candidates.filter((s) => `${s.infoHash ?? ""}|${s.url ?? ""}` !== `${next.s.infoHash ?? ""}|${next.s.url ?? ""}`);
      setCurrent((c) => ({
        ...c,
        url: next.s.url!,
        stream: next.s,
        streamTitle: next.s.title ?? c.streamTitle,
        streamDescription: next.s.description,
        p2p: undefined,
        p2pBrowser: undefined,
      }));
      setPhase("loading");
      setError(null);
      return "fell";
    } catch {
      return "empty";
    }
  }, [toast]);

  const handleError = useCallback(
    (err: PlaybackError) => {
      void tryFallback().then((outcome) => {
        if (outcome === "fell") return;
        setPhase("error");
        setError({ ...err, canTryDirect: outcome === "exhausted" });
      });
    },
    [tryFallback],
  );

  /** Wrap a plain message into a classified PlaybackError (resolve-path failures). */
  const setErrorMsg = useCallback((msg: string, cls: PlaybackError["cls"] = "fatal") => {
    setError({ message: msg, cls, code: null, host: null, canConvert: false });
  }, []);

  // Resolve stream via addons when payload.url is empty (instant play path)
  useEffect(() => {
    if (current.url || phase !== "resolving") return;
    let alive = true;
    setResolveStatus("Finding the best stream…");
    (async () => {
      const { useAddons: addons } = await import("@/lib/harbor/store");
      try {
        // Series opened without an episode id (bare tt-id): stream addons need
        // "id:season:episode" — resolve the default video from meta first.
        let targetId = current.videoId ?? current.metaId;
        if (current.type === "series" && !targetId.includes(":")) {
          const meta = await fetchMeta("series", current.metaId).catch(() => null);
          const vid = defaultVideoId(meta);
          if (vid) {
            targetId = vid;
            if (alive) {
              const vidMeta = (meta?.videos ?? []).find((v) => v.id === vid);
              setCurrent((c) => ({
                ...c,
                videoId: vid,
                season: c.season ?? vidMeta?.season,
                episode: c.episode ?? vidMeta?.episode,
                episodeName: c.episodeName ?? vidMeta?.name ?? vidMeta?.title,
              }));
            }
          }
        }
        const results = await fetchStreams(addons.getState().addons, current.type, targetId);
        if (!alive) return;
        const caps = await serverCapabilities();
        const ranked = runPipeline(results);
        candidatesRef.current = ranked;
        // Prefer browser-playable candidates: verdict-ranked URL streams first
        // (direct > proxy > convert; VideoStage escalates automatically), then
        // torrents whose parsed video codec isn't HEVC — unless conversion is
        // available server-side, which rescues HEVC releases too. Torrents are
        // NEVER auto-selected when this environment cannot run/see an engine
        // (caps.torrent === "none" on serverless without ENGINE_URL) — unless
        // THIS device has its own local engine configured (browser-direct).
        const transcodeAvail = cachedTranscodeSupported();
        const torrentsPossible =
          caps.torrent !== "none" || !!getLocalEngine() || cachedTorrentMode() === "browser";
        const p2pCandidate = (s: Stream) =>
          torrentsPossible && !!s.infoHash && !s.url && (transcodeAvail || s.parsed?.codec !== "HEVC");
        const urlBest = ranked
          .map((s, i) => ({ s, i, c: classifyStream(s) }))
          .filter(({ s, c }) => s.url && c.verdict !== "unplayable" && c.verdict !== "external")
          .sort((a, b) => verdictRank(a.c.verdict) - verdictRank(b.c.verdict) || a.i - b.i)[0];
        const best = urlBest?.s ?? ranked.find(p2pCandidate) ?? ranked[0];
        if (!best) {
          setPhase("error");
          setError({
            message: t("noStreamsFound", useSettings.getState().settings.uiLanguage),
            cls: "fatal",
            code: null,
            host: null,
            canConvert: false,
          });
          return;
        }
        if (best.url) {
          setCurrent((c) => ({
            ...c,
            url: best.url!,
            stream: best,
            streamTitle: best.title ?? c.streamTitle,
            streamDescription: best.description,
          }));
          setPhase("loading");
          return;
        }
        // Best candidate is a torrent → debrid unlock first (instant, works on
        // any host), then the server-side P2P engine. Both fail honestly.
        const lang = useSettings.getState().settings.uiLanguage;
        if (!best.infoHash) {
          setPhase("error");
          setErrorMsg(
            ranked.length > 0 ? t("noPlayableStream", lang) : t("noStreamsFound", lang),
            "torrent",
          );
          return;
        }
        const { useDebrid } = await import("@/lib/harbor/debrid");
        useDebrid.getState().load(); // idempotent hydration when the picker never mounted
        const debrid = useDebrid.getState();
        const debridCta = !debrid.apiKey && ranked.length > 0; // torrents exist — debrid would unlock them
        let debridError: string | null = null;
        if (debrid.apiKey) {
          setResolveStatus(t("debridUnlocking", lang));
          const res = await debrid.resolve(
            best.infoHash.toLowerCase(),
            best.behaviorHints?.filename ?? best.parsed?.filename,
            best.parsed?.size,
          );
          if (!alive) return;
          if ("url" in res && res.url) {
            setCurrent((c) => ({
              ...c,
              url: res.url,
              stream: {
                ...best,
                url: res.url,
                behaviorHints: {
                  ...best.behaviorHints,
                  ...("filename" in res && res.filename ? { filename: res.filename } : {}),
                },
              },
              streamTitle: best.title ?? c.streamTitle,
              streamDescription: best.description,
            }));
            setPhase("loading");
            return;
          }
          debridError = "error" in res ? res.error : null;
        }
        if (!useSettings.getState().settings.p2pEnabled) {
          setPhase("error");
          setError({
            message: debridError
              ? `${t("debridUnlockFailed", lang)} — ${debridError}`
              : t("noPlayableStream", lang),
            cls: "torrent",
            code: null,
            host: null,
            canConvert: false,
            offerDebrid: debridCta,
          });
          return;
        }
        // Engine probe — serverless deployments cannot run the torrent-service
        // (caps.torrent === "none" answers false instantly, no network);
        // fail fast with guidance instead of 100 s of hopeless peer polling.
        setResolveStatus(t("p2pChecking", lang));
        const engineOk = await p2pEngineAvailable();
        if (!alive) return;
        if (!engineOk) {
          // Zero-install rescue: the in-browser engine (WebTorrent in this
          // page). One switch in Settings turns this on; the gate honestly
          // refuses HEVC/MKV/AVI that a browser cannot decode/remux.
          const gate = browserEngineStreamGate(best);
          if (gate === "ok") {
            setResolveStatus(t("browserEngineJoining", lang));
            setCurrent((c) => ({
              ...c,
              url: "",
              stream: best,
              streamTitle: best.title ?? c.streamTitle,
              streamDescription: best.description,
              p2p: undefined,
              p2pBrowser: {
                infoHash: best.infoHash!.toLowerCase(),
                fileIdx: best.fileIdx ?? null,
                filename: best.behaviorHints?.filename ?? best.parsed?.filename ?? null,
              },
            }));
            setPhase("loading");
            return;
          }
          if (gate === "hevc" || gate === "container") {
            setPhase("error");
            setError({
              message: t(gate === "hevc" ? "browserEngineHevc" : "browserEngineContainer", lang),
              cls: "torrent",
              code: null,
              host: null,
              canConvert: false,
              offerDebrid: debridCta,
            });
            return;
          }
          setPhase("error");
          setError({
            message: t("p2pUnavailable", lang),
            cls: "torrent",
            code: "P2P_UNAVAILABLE",
            host: "P2P swarm",
            canConvert: false,
            offerDebrid: debridCta,
          });
          return;
        }
        const { p2pPrepare, p2pStatus, p2pPlan } = await import("@/lib/harbor/p2p");
        const infoHash = best.infoHash.toLowerCase();
        setResolveStatus("Joining the torrent swarm…");
        const prep = await p2pPrepare(infoHash, {
          fileIdx: best.fileIdx,
          filename: best.behaviorHints?.filename ?? best.parsed?.filename,
        });
        for (let i = 0; prep.pending && i < 40 && alive; i++) {
          await new Promise((r) => setTimeout(r, 2500));
          setResolveStatus((s) => (s.startsWith("Finding peers") ? s : `Finding peers… (${i * 2.5 | 0}s)`));
          const st = await p2pStatus(infoHash).catch(() => null);
          if (st?.peers) setResolveStatus(`Finding peers… (${st.peers} found)`);
          if (st?.ready) break;
        }
        if (!alive) return;
        const st = prep.pending ? await p2pStatus(infoHash).catch(() => null) : null;
        if (prep.pending && !st?.ready) {
          setPhase("error");
          setErrorMsg(t("noPeersFound", lang), "torrent");
          return;
        }
        const fileIdx = prep.pending
          ? (Number.isInteger(best.fileIdx)
              ? best.fileIdx!
              : (st?.files ?? []).length > 0
                ? (st!.files ?? []).reduce(
                    (a, b) => (b.length > a.length ? b : a),
                    (st!.files ?? [{ index: 0, name: "", length: 0 }])[0],
                  ).index
                : 0)
          : prep.fileIdx;
        const filename = best.behaviorHints?.filename ?? best.parsed?.filename;
        setResolveStatus("Checking video codecs…");
        await refreshP2pCapabilities(); // engine-level HEVC conversion flag
        const plan = await p2pPlan(infoHash, fileIdx, filename).catch(() => null);
        if (!alive) return;
        if (!plan) {
          setPhase("error");
          setError({
            message: t("engineNoServe", lang),
            cls: "torrent",
            code: "P2P_NO_PLAN",
            host: "P2P swarm",
            canConvert: false,
          });
          return;
        }
        // Audio/dub pre-selection: the plan's codec report lists every audio
        // track — embed the preferred dub in the FIRST remux URL (VideoStage's
        // discovery effect syncs the same report into the panel state).
        if (plan.mode === "remux") {
          const tracks = plan.codec?.audioTracks ?? [];
          if (tracks.length > 0) {
            const rel = pickAudioRel(tracks, useSettings.getState().settings.preferredLanguages);
            if (rel > 0) plan.url = `${plan.url}&audio=${rel}`;
          }
        }
        setCurrent((c) => ({
          ...c,
          url: plan.url,
          stream: best,
          streamTitle: best.title ?? c.streamTitle,
          streamDescription: best.description,
          p2p: { key: plan.key, fileIdx: plan.fileIdx, infoHash, mode: plan.mode },
        }));
        setPhase("loading");
      } catch (e) {
        if (!alive) return;
        setPhase("error");
        setError({
          message: e instanceof Error ? e.message : "Failed to resolve streams",
          cls: "fatal",
          code: null,
          host: null,
          canConvert: false,
        });
      }
    })();
    return () => {
      alive = false;
    };
  }, [current.url, current.type, current.videoId, current.metaId, phase]);

  const setPayload = useCallback((p: PlayerPayload) => {
    setCurrent(p);
    setPhase(p.url ? "loading" : "resolving");
    setError(null);
  }, []);

  const openSwitcher = useCallback(() => setSwitcherOpen(true), []);

  // Convert-and-play after a final codec failure (or from the ask dialog):
  // re-signs the original upstream through /api/transcode and reattaches.
  const convertAndPlay = useCallback(async () => {
    const cur = currentRef.current;
    const upstream = cur.stream?.url ?? cur.url;
    if (!upstream || !/^https?:\/\//i.test(upstream)) return;
    const lang = useSettings.getState().settings.uiLanguage;
    try {
      const signed = await signSource({ ...(cur.stream ?? { url: upstream }), url: upstream }, "transcode");
      setPhase("loading");
      setError(null);
      setCurrent((c) => ({ ...c, url: signed.url, stream: cur.stream }));
    } catch {
      setPhase("error");
      setError({
        message: homeT("convertingNeeds", lang),
        cls: "codec",
        code: null,
        host: null,
        canConvert: false,
      });
    }
  }, []);

  // Advance to another episode in-place (Up Next card / auto-advance /
  // prev-next buttons / n & Shift+N keys). Empty url re-enters the resolving
  // path so addons fetch streams for the new episode. The VideoStage unmount
  // flush saves the OUTGOING episode's progress before the switch, subtitles
  // re-resolve for the new videoId, and the scrobble effect closes the old
  // session (stop) then starts the new one (start) — all via existing effects.
  const handlePlayNext = useCallback(
    (next: { season: number; episode: number; videoId: string; episodeName?: string }) => {
      autoPickerRef.current = true;
      setCurrent((c) => ({
        ...c,
        url: "",
        season: next.season,
        episode: next.episode,
        videoId: next.videoId,
        episodeName: next.episodeName,
        streamTitle: undefined,
        streamDescription: undefined,
        resumeAt: 0,
      }));
      setPhase("resolving");
      setError(null);
    },
    [],
  );

  // Resolve failure while an episode switch is in flight → open the picker
  useEffect(() => {
    if (phase === "error" && autoPickerRef.current) {
      autoPickerRef.current = false;
      setSwitcherOpen(true);
    }
  }, [phase, error]);

  return (
    <div className="fixed inset-0 z-[180] bg-black" role="dialog" aria-modal="true" aria-label={`Playing ${current.title}`}>
      {phase === "resolving" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          <div className="relative">
            <Loader2 className="w-12 h-12 text-accent animate-spin" />
          </div>
          <p className="text-sm text-ink-muted" aria-live="polite">{resolveStatus}</p>
        </div>
      )}
      {phase === "error" && error ? (
        <PlaybackErrorPanel
          error={error}
          lang={settings.uiLanguage}
          onConvert={error.canConvert ? () => void convertAndPlay() : undefined}
          onTryDirect={
            error.canTryDirect
              ? () => {
                  void tryFallback().then((outcome) => {
                    if (outcome === "fell") return;
                    toast({ title: t("noPlayableStream", settings.uiLanguage) });
                  });
                }
              : undefined
          }
          onDebridSetup={
            error.offerDebrid
              ? () => {
                  // Deep link: close the player, land on Settings → Integrations
                  // (push keeps the title's detail view reachable via Back).
                  pop();
                  push({ kind: "view", view: "settings" });
                  window.setTimeout(
                    () => window.dispatchEvent(new CustomEvent("harbor:settings-section", { detail: "integrations" })),
                    120,
                  );
                }
              : undefined
          }
          onRetry={() => {
            setError(null);
            setPhase(currentRef.current.url ? "loading" : "resolving");
            // Force a fresh attach even for the same URL
            setCurrent((c) => ({ ...c }));
          }}
          onPicker={() => setSwitcherOpen(true)}
          onBack={pop}
        />
      ) : (
        // Browser-engine sources have NO url (WebTorrent renders via MSE) —
        // key off the infoHash so switching torrents remounts the stage.
        (current.url || current.p2pBrowser) && (
          <VideoStage
            key={current.url || `browser:${current.p2pBrowser!.infoHash}`}
            payload={current}
            settings={settings}
            onPhase={handlePhase}
            onError={handleError}
            onPlayNext={handlePlayNext}
            onOpenSwitcher={openSwitcher}
          />
        )
      )}

      {/* Top bar */}
      {phase !== "error" && (
        <div className="absolute top-0 inset-x-0 z-20 flex items-center gap-3 bg-gradient-to-b from-black/80 to-transparent px-4 py-3 pb-10 transition-opacity">
          <button
            type="button"
            onClick={() => {
              if (settings.playerConfirmLeave && !window.confirm("Leave playback?")) return;
              pop();
            }}
            className="md-icon-btn md-state h-12! w-12! text-white!"
            aria-label="Close player (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <p className="harbor-clamp-1 text-sm font-semibold text-ink">{current.title}</p>
            {current.episode && (
              <p className="text-xs text-ink-muted">
                S{current.season}:E{current.episode}
                {current.episodeName ? ` · ${current.episodeName}` : ""}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setSwitcherOpen(true)}
            className="md-state ml-auto flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-xs font-medium text-ink"
            title="Switch stream (W)"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" /> Streams
          </button>
        </div>
      )}

      {switcherOpen && (
        <PickerOverlay
          type={current.type}
          id={current.deepLink?.id ?? current.metaId}
          videoId={current.videoId ?? current.deepLink?.videoId}
          season={current.season}
          episode={current.episode}
        />
      )}
    </div>
  );
}

// ---------------- Classified error panel ----------------
function PlaybackErrorPanel({
  error,
  lang,
  onConvert,
  onTryDirect,
  onDebridSetup,
  onRetry,
  onPicker,
  onBack,
}: {
  error: PlaybackError;
  lang: string;
  onConvert?: () => void;
  /** Auto-pick the next best playable (URL) stream — shown when ranked
   *  candidates still hold one after the automatic fallback cap. */
  onTryDirect?: () => void;
  /** Deep link to Settings → Integrations — shown when torrent streams exist
   *  that a debrid key would unlock but none is configured. */
  onDebridSetup?: () => void;
  onRetry: () => void;
  onPicker: () => void;
  onBack: () => void;
}) {
  const { toast } = useToast();
  const [showTech, setShowTech] = useState(false);
  const copyDiagnostics = () => {
    const lines = [
      `class: ${error.cls}`,
      `code: ${error.code ?? "n/a"}`,
      `host: ${error.host ?? "n/a"}`,
      `user-agent: ${navigator.userAgent}`,
      `page: ${location.host}${location.pathname}`,
    ];
    void navigator.clipboard
      .writeText(lines.join("\n"))
      .then(() => toast({ title: homeT("diagnosticsCopied", lang) }))
      .catch(() => {
        /* clipboard denied */
      });
  };
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
      <AlertTriangle className="w-12 h-12 text-danger" />
      <p className="md-title-medium text-ink">{homeT("playbackErrorTitle", lang)}</p>
      <p className="text-sm text-ink-muted max-w-md" role="alert">{error.message}</p>
      <div className="flex gap-3 flex-wrap justify-center">
        {onTryDirect && (
          <button type="button" onClick={onTryDirect} className="md-btn md-btn-filled md-state">
            {t("errTryDirect", lang)}
          </button>
        )}
        {onDebridSetup && (
          <button type="button" onClick={onDebridSetup} className="md-btn md-btn-filled md-state">
            {t("errSetupDebrid", lang)}
          </button>
        )}
        {onConvert && (
          <button type="button" onClick={onConvert} className="md-btn md-btn-filled md-state">
            {homeT("convertAndPlay", lang)}
          </button>
        )}
        <button type="button" onClick={onPicker} className="md-btn md-btn-tonal md-state">
          {homeT("pickAnother", lang)}
        </button>
        <button type="button" onClick={onRetry} className="md-btn md-btn-tonal md-state">
          {homeT("retry", lang)}
        </button>
        <button type="button" onClick={onBack} className="md-btn md-btn-text md-state">
          Back
        </button>
      </div>
      <div className="mt-1 max-w-md w-full">
        <button
          type="button"
          onClick={() => setShowTech((v) => !v)}
          className="text-xs text-ink-subtle underline underline-offset-2 hover:text-ink-muted"
          aria-expanded={showTech}
        >
          {homeT("showTechnical", lang)}
        </button>
        {showTech && (
          <div className="mt-2 rounded-xl border border-edge-soft bg-raised/60 p-3 text-start text-[11px] text-ink-subtle space-y-1" dir="ltr">
            <p>{homeT("errClass", lang)}: {error.cls}</p>
            <p>{homeT("errCode", lang)}: {error.code ?? "n/a"}</p>
            <p className="break-all">{homeT("sourceHost", lang)}: {error.host ?? "n/a"}</p>
            <button
              type="button"
              onClick={copyDiagnostics}
              className="mt-1 rounded-full border border-edge-soft px-2.5 py-1 text-[10px] font-semibold text-ink-muted hover:text-ink"
            >
              {homeT("copyDiagnostics", lang)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------- Video stage ----------------
function VideoStage({
  payload,
  settings,
  onPhase,
  onError,
  onPlayNext,
  onOpenSwitcher,
}: {
  payload: PlayerPayload;
  settings: ReturnType<typeof useSettings.getState>["settings"];
  onPhase: (p: "loading" | "playing") => void;
  onError: (err: PlaybackError) => void;
  onPlayNext: (next: { season: number; episode: number; videoId: string; episodeName?: string }) => void;
  onOpenSwitcher: () => void;
}) {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  // Single source of truth for subtitle rendering — the custom overlay. This
  // manager guarantees no native <track>/TextTrack layer ever paints alongside
  // it (the root cause of the duplicate-subtitles bug).
  const subManagerRef = useRef<SubtitleManager | null>(null);
  if (!subManagerRef.current) subManagerRef.current = new SubtitleManager();
  // Player-height-based subtitle scaling (measured via ResizeObserver)
  const [stageHeight, setStageHeight] = useState(0);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  // Time is owned by the PlaybackTimeline (single source of truth — see
  // lib/harbor/playback-timeline.ts). time/duration below are projections of
  // its snapshot; no component ever reads video.duration directly anymore.
  const timelineRef = useRef<PlaybackTimeline | null>(null);
  if (!timelineRef.current) {
    timelineRef.current = new PlaybackTimeline({
      approximateDurationS: payload.runtimeSeconds ?? null,
    });
  }
  const timeline = timelineRef.current;
  const tlSnap: TimelineSnapshot = useSyncExternalStore(timeline.subscribe, timeline.getSnapshot);
  const time = tlSnap.currentTime;
  const duration = tlSnap.duration;
  const [buffering, setBuffering] = useState(true);
  // Source override: the proxy/convert ladder replaces the raw URL through this
  // channel without remounting the stage (attach effect re-runs on change).
  // Declared BEFORE doSeek, which reads it to un-wrap signed transcode URLs.
  const [srcOverride, setSrcOverride] = useState<{ url: string; mode: SourceMode } | null>(null);

  // ---- Audio / dub switcher (P2P remux path) ----
  // The engine probes ALL audio tracks (/codec audioTracks) and the remux maps
  // ?audio=<rel>. Switching re-opens the remux URL at the current position
  // (same restart contract as seek). Ref mirrors state for the restart paths
  // (restartAt / escalateFailure) which must not re-render on audio change.
  const [audioTracks, setAudioTracks] = useState<P2pAudioTrack[] | null>(null);
  const [audioSel, setAudioSel] = useState(0);
  const [audioMenuOpen, setAudioMenuOpen] = useState(false);
  const audioSelRef = useRef(0);
  /** Guard: dub list fetched once per torrent+file (discovery effect). */
  const dubFetchedRef = useRef<string | null>(null);

  // ---- Seeks (timeline-mapped) ----
  // Element seeks are issued by the timeline; unseekable targets on
  // conversion/remux sources restart the server session at a signed offset
  // (same stage, same timeline instance — no remount, no state loss).

  /** Set when a seek-restart re-opens the source: restore paused state after
   *  the first frame (the attach path auto-plays; a paused seek must stay
   *  paused). */
  const pauseAfterRestartRef = useRef(false);

  // Restart sources that cannot re-fetch an arbitrary position:
  //   transcode      → re-sign the upstream with a new -ss offset
  //   p2p-remux      → re-open the remux URL with ?ss=N (engine drops packets
  //                    until the target — progressive pipes cannot input-seek)
  //   p2p-transcode  → same, plus the vtrans=h264 flag
  const restartAt = useCallback(
    (offsetS: number) => {
      const target = Math.max(0, offsetS);
      pauseAfterRestartRef.current = videoRef.current?.paused ?? false;
      if (payload.p2p) {
        const vtrans = sourceModeRef.current === "p2p-transcode";
        timeline.setOffset(target);
        gotFirstFrameRef.current = false;
        setBuffering(true);
        setSrcOverride({
          url: p2pRemuxUrl(payload.p2p.key, payload.p2p.fileIdx, vtrans, target, audioSelRef.current),
          mode: vtrans ? "p2p-transcode" : "p2p-remux",
        });
        return;
      }
      let upstream = payload.stream?.url ?? payload.url;
      const signedNow = srcOverride?.url ?? payload.url;
      if (!payload.stream && signedNow.includes("/api/transcode?")) {
        try {
          const inner = new URL(signedNow, window.location.origin).searchParams.get("url");
          if (inner) upstream = inner;
        } catch {
          /* keep payload.url */
        }
      }
      void signSource(
        { ...(payload.stream ?? { url: upstream, title: payload.title }), url: upstream },
        "transcode",
        target,
      )
        .then((r) => {
          if (!aliveRef.current) return;
          timeline.setOffset(target);
          gotFirstFrameRef.current = false;
          setBuffering(true);
          setSrcOverride({ url: r.url, mode: "transcode" });
        })
        .catch(() => {
          /* keep playing from the current position */
        });
    },
    [timeline, payload.p2p, payload.stream, payload.url, payload.title, srcOverride],
  );

  const doSeek = useCallback(
    (titleSeconds: number) => {
      const out = timeline.seekTo(titleSeconds);
      if (out.type === "element") {
        // Chunked fMP4 gotcha: Chromium's seekable range reports the PARSED
        // extent even when it cannot actually re-fetch (no Range support on a
        // pipe) — a seek beyond buffered gets silently clamped. Verify the
        // element honored the seek; if it drifted, restart server-side.
        const video = videoRef.current;
        const expected = out.titleTime - timeline.offset;
        window.setTimeout(() => {
          if (!video || video.seeking) return;
          let bufferedEnd = 0;
          try {
            const b = video.buffered;
            for (let i = 0; i < b.length; i++) bufferedEnd = Math.max(bufferedEnd, b.end(i));
          } catch {
            /* ignore */
          }
          const honored = Math.abs(video.currentTime - expected) < 1.5;
          const mode = sourceModeRef.current;
          if (
            !honored &&
            out.titleTime > bufferedEnd + 1 &&
            (mode === "transcode" || mode === "p2p-remux" || mode === "p2p-transcode")
          ) {
            restartAt(out.titleTime);
          }
        }, 900);
        return;
      }
      // Restart-class sources: p2p remux/transcode (progressive pipes) and
      // signed transcode sessions. Direct/proxy rely on native ranges; the
      // restart lands exactly on the requested offset.
      if (payload.p2p || sourceModeRef.current === "transcode") {
        restartAt(out.offsetS);
      }
    },
    [timeline, restartAt, payload.p2p],
  );

  const [fullscreen, setFullscreen] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [volumeHudVisible, setVolumeHudVisible] = useState(false);
  const volumeHudTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [subMenuOpen, setSubMenuOpen] = useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);

  /** Dub switch: re-open the remux at the current position with the new audio
   *  track (restartAt reuses the seek-restart plumbing: pause restore, offset,
   *  buffering, first-frame gate). Only valid on the p2p remux paths. */
  const switchAudioTrack = useCallback(
    (rel: number) => {
      const video = videoRef.current;
      if (!payload.p2p || video == null) return;
      if (rel === audioSelRef.current && sourceModeRef.current !== "direct") {
        setAudioMenuOpen(false);
        return;
      }
      audioSelRef.current = rel;
      setAudioSel(rel);
      setAudioMenuOpen(false);
      const lang = useSettings.getState().settings.uiLanguage;
      toast({ title: homeT("audioSwitching", lang) });
      restartAt((video.currentTime || 0) + timeline.offset);
    },
    // restartAt / timeline / videoRef are all declared above (stable deps)
    [payload.p2p, restartAt, timeline, toast],
  );

  // P2P engine: live swarm stats + one-shot remux fallback when the native stream can't demux
  const [p2pStats, setP2pStats] = useState<{ progress: number; peers: number; downloadSpeed: number; ready: boolean } | null>(null);
  const sourceModeRef = useRef<SourceMode>("direct");
  const sourceHostRef = useRef<string | null>(null);
  const remuxTriedRef = useRef(false);
  const vtransTriedRef = useRef(false);
  const convertAskShownRef = useRef(false);
  const [convertAsk, setConvertAsk] = useState(false);
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);
  const gotFirstFrameRef = useRef(false);
  const firstFrameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [subtitles, setSubtitles] = useState<LoadedSubtitle[]>([]);
  // Full ranked subtitle pool + how many are loaded — powers the "Load more" affordance
  const subPoolRef = useRef<RawSubtitle[]>([]); // ranked by preferred languages
  const subEffectiveRef = useRef<RawSubtitle[]>([]); // currently displayed ranking (lang filter)
  const subAttemptedRef = useRef(0);
  const [subPoolSize, setSubPoolSize] = useState(0);
  const [subLoadingMore, setSubLoadingMore] = useState(false);
  const [subLangFilter, setSubLangFilter] = useState<string | null>(null);
  // Free-text search over the ranked pool (label / language / provider) — composes
  // with the language chips: chip re-ranks, search then narrows.
  const [subSearch, setSubSearch] = useState(""); // committed (drives the pool view)
  const [subSearchInput, setSubSearchInput] = useState(""); // typing value
  const subViewTokenRef = useRef(0); // invalidates stale parse batches when the view changes
  const subSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Language chips derived from the pool: chip code + available count
  const subLangChips = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of subPoolRef.current) {
      const chip = langChip(s.lang);
      counts.set(chip, (counts.get(chip) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [subPoolSize, subLangFilter]);
  // How many entries the CURRENT view (chip re-rank + search filter) contains
  const [subEffectiveCount, setSubEffectiveCount] = useState(0);
  const subtitlesRef = useRef<LoadedSubtitle[]>([]);
  subtitlesRef.current = subtitles; // latest committed list for stable index math
  const [activeSub, setActiveSub] = useState<number>(-1); // -1 = off
  const [subCue, setSubCue] = useState<SubCue | null>(null);
  const [availableTracks, setAvailableTracks] = useState<{ label: string }[]>([]);
  const [levels, setLevels] = useState<{ index: number; label: string }[]>([]);
  const [levelSel, setLevelSel] = useState<number>(-1); // -1 = adaptive (auto)
  const [autoLevel, setAutoLevel] = useState<number>(-1); // level currently playing in auto mode
  const [activeAudio, setActiveAudio] = useState(0);
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seekHandled = useRef(false);
  // Trakt scrobble state (dedupe: one scrobble per action per 10s)
  const scrobbleStartSent = useRef(false);
  const scrobbleLastSent = useRef<Record<"start" | "pause" | "stop", number>>({
    start: 0,
    pause: 0,
    stop: 0,
  });

  const resumeAt = useRef(
    payload.resumeAt ??
      (settings.resumePlayback && payload.metaId
        ? resumeMsFor(payload.metaId, payload.videoId) / 1000
        : 0),
  );

  // ---- P2P swarm stats polling ----
  // Server engines are polled here; the IN-BROWSER engine pushes stats through
  // its own callbacks (no polling endpoint exists in the page).
  useEffect(() => {
    if (payload.p2pBrowser) return; // stats arrive via engine callbacks
    if (!payload.p2p) {
      setP2pStats(null);
      return;
    }
    let alive = true;
    const key = payload.p2p.key;
    const tick = async () => {
      try {
        const st = await p2pStatus(key);
        if (!alive) return;
        setP2pStats({
          progress: st.progress ?? 0,
          peers: st.peers ?? 0,
          downloadSpeed: st.downloadSpeed ?? 0,
          ready: st.ready === true,
        });
      } catch {
        if (alive) setP2pStats(null);
      }
    };
    void tick();
    const iv = setInterval(tick, 2500);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [payload.p2p?.key, payload.p2pBrowser?.infoHash]);

  // ---- Resolve HOW to serve this source (direct vs signed proxy) ----
  // Direct http(s) streams with a stream object get a header probe: hosts that
  // serve CORS headers play direct, everything else is re-signed through
  // /api/media (same-origin → CORS can never block, proxyHeaders still apply).
  useEffect(() => {
    const url = payload.url;
    if (!url) return;
    setSrcOverride(null);
    setAudioTracks(null);
    setAudioSel(0);
    setAudioMenuOpen(false);
    audioSelRef.current = 0;
    dubFetchedRef.current = null;
    sourceModeRef.current = payload.p2p ? "p2p-native" : "direct";
    gotFirstFrameRef.current = false;
    const isHttp = /^https?:\/\//i.test(url);
    const stream = payload.stream;
    if (payload.p2p || !isHttp || !stream) return; // P2P / already-proxied / no metadata → attach as-is
    let alive = true;
    (async () => {
      try {
        await serverCapabilities();
        const live = useSettings.getState().settings;
        if (!alive || live.proxyMode === "never") return;
        const resolved = await resolveDirectSource(stream, { proxyMode: live.proxyMode });
        if (!alive) return;
        sourceHostRef.current = resolved.host;
        if (resolved.viaProxy) {
          // Media elements play cross-origin WITHOUT CORS (no crossOrigin
          // attribute here) — a host lacking CORS headers can still be playing
          // perfectly. Do NOT tear down a stream that is demonstrably working:
          // the serverless media proxy has a hard function-time cap on hosts
          // like Vercel (maxDuration=60), so re-attaching a healthy direct
          // source through it kills playback mid-stream (TorBox CDN evidence:
          // no ACAO advertised, plays direct, dies when proxied).
          const el = videoRef.current;
          if (el && el.error !== null) return; // escalation ladder owns recovery
          if (el && el.readyState >= 2) return; // already rendering direct frames
          const directHls = /\.m3u8(\?|$)/i.test(url) || url.includes("m3u8");
          if (!directHls) {
            // The probe usually resolves BEFORE the element has buffered
            // anything — give the direct attach a short, bounded chance to
            // prove itself (frames or error) before switching to the proxy.
            const gotData = await new Promise<boolean>((done) => {
              const v = videoRef.current;
              if (!v) return done(false);
              if (v.error !== null) return done(false);
              if (v.readyState >= 2) return done(true);
              const cleanup = () => {
                v.removeEventListener("loadeddata", ok);
                v.removeEventListener("error", bad);
                clearTimeout(timer);
              };
              const ok = () => {
                cleanup();
                done(true);
              };
              const bad = () => {
                cleanup();
                done(false);
              };
              const timer = setTimeout(() => {
                cleanup();
                done(false);
              }, 2_500);
              v.addEventListener("loadeddata", ok, { once: true });
              v.addEventListener("error", bad, { once: true });
            });
            if (!alive) return;
            if (gotData) return; // direct is delivering — keep it out of the proxy
          }
          sourceModeRef.current = "proxy";
          setSrcOverride({ url: resolved.url, mode: "proxy" });
        }
      } catch {
        /* keep direct attach */
      }
    })();
    return () => {
      alive = false;
    };
  }, [payload.url, payload.stream, payload.p2p?.key]);

  // ---- Dub discovery (unified, P2P remux sources) ----
  // One path covers EVERY way a remux can be reached (auto-resolve plan step,
  // stream picker, native→remux escalation): fetch /codec once per torrent+file,
  // populate the track list, auto-select the user's preferred dub, and — when
  // that differs from what is playing — re-open the remux at the current
  // position with ?audio=<rel> (same restart contract as seek).
  useEffect(() => {
    const p2p = payload.p2p;
    const overrideMode = srcOverride?.mode;
    if (!p2p) return;
    const onRemux = p2p.mode === "remux" || overrideMode === "p2p-remux" || overrideMode === "p2p-transcode";
    if (!onRemux) return;
    const sig = `${p2p.key}:${p2p.fileIdx}`;
    if (dubFetchedRef.current === sig) return;
    dubFetchedRef.current = sig;
    let alive = true;
    void (async () => {
      try {
        const rep = await p2pCodec(p2p.key, p2p.fileIdx);
        const tracks = rep.audioTracks ?? [];
        if (!alive || tracks.length === 0) return;
        setAudioTracks(tracks);
        const rel = pickAudioRel(tracks, useSettings.getState().settings.preferredLanguages);
        if (rel === audioSelRef.current) return;
        audioSelRef.current = rel;
        setAudioSel(rel);
        if (payload.url.includes(`audio=${rel}`)) return; // source already targets this dub
        const video = videoRef.current;
        const vtrans = sourceModeRef.current === "p2p-transcode";
        const at = Math.max(0, (video?.currentTime ?? 0) + timeline.offset);
        timeline.setOffset(at);
        gotFirstFrameRef.current = false;
        setBuffering(true);
        setSrcOverride({
          url: p2pRemuxUrl(p2p.key, p2p.fileIdx, vtrans, at, rel),
          mode: vtrans ? "p2p-transcode" : "p2p-remux",
        });
      } catch {
        /* track list unavailable — playback continues on the current track */
      }
    })();
    return () => {
      alive = false;
    };
  }, [payload.p2p?.key, payload.p2p?.fileIdx, payload.p2p?.mode, payload.url, srcOverride?.mode, timeline]);

  // ---- Failure escalation ladder ----
  // direct → proxy (secure media proxy) → transcode (ffmpeg) → classified error
  // p2p-native → p2p-remux → p2p-transcode → classified error
  const escalateFailure = useCallback(
    (cls: FailureClass, code: number | string | null, rawMsg: string | null) => {
      const lang = settings.uiLanguage;
      const mode = sourceModeRef.current;
      const stream = payload.stream;
      const upstream = stream?.url ?? (/^https?:\/\//i.test(payload.url) ? payload.url : null);
      const live = useSettings.getState().settings;

      // ---- P2P ladder ----
      // In-browser engine: no remux/transcode ladder exists in the page — the
      // engine's own callbacks already surfaced the honest error.
      if (payload.p2pBrowser) {
        onError({
          message: homeT("torrentNotPlayable", lang),
          cls: "torrent",
          code,
          host: "WebRTC swarm",
          canConvert: false,
        });
        return;
      }
      if (payload.p2p) {
        if (mode === "p2p-native" && !remuxTriedRef.current) {
          remuxTriedRef.current = true;
          sourceModeRef.current = "p2p-remux";
          setBuffering(true);
          setSrcOverride({
            url: p2pRemuxUrl(payload.p2p.key, payload.p2p.fileIdx, false, undefined, audioSelRef.current),
            mode: "p2p-remux",
          });
          // The unified dub-discovery effect (fires on srcOverride mode change)
          // populates the track list and re-attaches if the preferred dub ≠ 0.
          return;
        }
        if (mode === "p2p-remux" && !vtransTriedRef.current && cachedTranscodeSupported()) {
          vtransTriedRef.current = true;
          sourceModeRef.current = "p2p-transcode";
          setBuffering(true);
          setSrcOverride({
            url: `${p2pRemuxUrl(payload.p2p.key, payload.p2p.fileIdx, true, undefined, audioSelRef.current)}`,
            mode: "p2p-transcode",
          });
          return;
        }
        onError({
          message: homeT("torrentNotPlayable", lang),
          cls: "torrent",
          code,
          host: "P2P swarm",
          canConvert: false,
        });
        return;
      }

      // ---- Direct ladder ----
      if (mode === "direct" && upstream && live.proxyMode !== "never") {
        toast({ title: homeT("tryingProxy", lang) });
        sourceModeRef.current = "proxy";
        setBuffering(true);
        signSource({ ...(stream ?? { url: upstream }), url: upstream }, "media")
          .then((r) => {
            if (!aliveRef.current) return;
            sourceHostRef.current = r.host;
            setSrcOverride({ url: r.url, mode: "proxy" });
          })
          .catch(() => {
            if (!aliveRef.current) return;
            onError({
              message: homeT("sourceBlocks", lang),
              cls,
              code,
              host: sourceHostRef.current,
              canConvert: false,
            });
          });
        return;
      }

      const canConvert =
        !!upstream &&
        cachedTranscodeSupported() &&
        live.transcodeMode !== "never" &&
        mode !== "transcode";
      if (canConvert && live.transcodeMode === "ask" && !convertAskShownRef.current) {
        convertAskShownRef.current = true;
        setConvertAsk(true);
        return;
      }
      if (canConvert) {
        toast({ title: homeT("tryingConvert", lang) });
        sourceModeRef.current = "transcode";
        setBuffering(true);
        signSource({ ...(stream ?? { url: upstream }), url: upstream }, "transcode")
          .then((r) => {
            if (!aliveRef.current) return;
            sourceHostRef.current = r.host;
            setSrcOverride({ url: r.url, mode: "transcode" });
          })
          .catch(() => {
            if (!aliveRef.current) return;
            onError({
              message: homeT("convertingNeeds", lang),
              cls,
              code,
              host: sourceHostRef.current,
              canConvert: false,
            });
          });
        return;
      }

      // ---- Exhausted: classified, localized final error ----
      const expired = code != null && /40[134]|410/.test(String(code));
      const message =
        cls === "timeout"
          ? homeT("networkRetry", lang)
          : expired
            ? homeT("linkExpired", lang)
            : cls === "codec"
              ? homeT("convertingNeeds", lang)
              : mode === "proxy" || mode === "transcode"
                ? homeT("sourceBlocks", lang)
                : homeT("sourceBlocks", lang);
      onError({
        message,
        cls,
        code,
        host: sourceHostRef.current ?? (upstream ? safeHostOf(upstream) : null),
        canConvert: false,
      });
    },
    [payload.p2p, payload.stream, payload.url, onError, settings.uiLanguage, toast],
  );

  // ---- Attach source (HLS or native) ----
  useEffect(() => {
    const video = videoRef.current;
    const url = srcOverride?.url ?? payload.url;
    if (!video) return;
    // ---- In-browser engine branch: WebTorrent renders into this element via
    // MediaSource — no URL exists. Status/errors arrive through the engine's
    // callbacks; the element's own media events drive phase/buffering.
    if (payload.p2pBrowser) {
      const bt = payload.p2pBrowser;
      if (!bt.infoHash) return;
      sourceModeRef.current = "browser";
      gotFirstFrameRef.current = false;
      timeline.setOffset(0);
      timeline.markLive(false);
      timeline.setElementUntrusted(false); // MSE duration is real
      setLevels([]);
      setAvailableTracks([]);
      setAudioTracks(null);
      setAudioSel(0);
      setAudioMenuOpen(false);
      audioSelRef.current = 0;
      dubFetchedRef.current = null;
      onPhase("loading");
      let cancelled = false;
      let readyOnce = false;
      const stop = attachBrowserTorrent(
        video,
        { infoHash: bt.infoHash, fileIdx: bt.fileIdx, filename: bt.filename },
        {
          onStatus: (s) => {
            if (cancelled) return;
            setP2pStats({
              progress: s.progress,
              peers: s.peers,
              downloadSpeed: s.downloadSpeed,
              ready: s.ready,
            });
          },
          onReady: () => {
            if (cancelled || readyOnce) return;
            readyOnce = true;
            setBuffering(false);
            video.play().catch(() => {
              /* autoplay blocked; user gesture needed */
            });
          },
          onError: (code, detail) => {
            if (cancelled) return;
            const lang = useSettings.getState().settings.uiLanguage;
            const key = BROWSER_ENGINE_ERR_KEYS[code];
            onError({
              message: t(key, lang) + (detail ? ` — ${detail}` : ""),
              cls: "torrent",
              code: `BROWSER_ENGINE_${code.toUpperCase()}`,
              host: "WebRTC swarm",
              canConvert: false,
              offerDebrid: true,
            });
          },
        },
      );
      return () => {
        cancelled = true;
        stop();
      };
    }
    if (!url) return;
    if (srcOverride) sourceModeRef.current = srcOverride.mode;
    // Signed deep-link/demo payloads can BE transcode URLs without ever having
    // gone through the ladder — reflect the true serving mode so seek-restarts
    // and the untrust rules engage.
    if (url.includes("/api/transcode?")) sourceModeRef.current = "transcode";
    let cancelled = false;
    const isHls = /\.m3u8(\?|$)/i.test(url) || url.includes("m3u8");

    // Timeline: re-attach to the element for this source. For transcode-mode
    // sources the signed URL may carry an ?ss=N start offset — element time 0
    // then equals TITLE time N, and the piped fMP4's element duration is
    // untrustworthy by construction (empty_moov, no mehd — see timeline docs).
    const ssParam = (() => {
      try {
        return Number(new URL(url, window.location.origin).searchParams.get("ss") ?? 0) || 0;
      } catch {
        return 0;
      }
    })();
    timeline.setOffset(ssParam);
    timeline.markLive(false);
    timeline.setElementUntrusted(
      sourceModeRef.current === "transcode" ||
        sourceModeRef.current === "p2p-remux" ||
        // Demo/QA payloads and signed deep links carry the transcode origin in
        // the URL itself — same empty_moov fMP4 class, same untrust rule.
        url.includes("/api/transcode?"),
    );

    const tryPlay = () => {
      video.play().catch(() => {
        /* autoplay blocked; user gesture needed */
      });
    };

    // First-frame watchdog: 15 s to first frame or escalate as a timeout
    gotFirstFrameRef.current = false;
    if (firstFrameTimerRef.current) clearTimeout(firstFrameTimerRef.current);
    const armFirstFrameWatchdog = () => {
      if (firstFrameTimerRef.current) clearTimeout(firstFrameTimerRef.current);
      firstFrameTimerRef.current = setTimeout(() => {
        if (cancelled || !videoRef.current || !aliveRef.current) return;
        // A paused element was never ASKED to play (autoplay blocked, user
        // hasn't tapped yet) — that is not a failure. Re-arm and wait.
        if (videoRef.current.paused) {
          armFirstFrameWatchdog();
          return;
        }
        if (!gotFirstFrameRef.current) {
          // Metadata parsed but no frame in 15s ⇒ near-always a container/codec
          // problem (MKV/AC3 silent-stall evidence, round 25) — route to the
          // Convert ladder, not the generic network retry.
          escalateFailure("codec", "TIMEOUT_FIRST_FRAME", "no media within 15s");
        }
      }, 15_000);
    };
    armFirstFrameWatchdog();

    if (isHls && !video.canPlayType("application/vnd.apple.mpegurl")) {
      const hls = new Hls({
        enableWorker: true,
        maxBufferLength: 30,
        // Subtitle rendering belongs to our custom overlay ONLY — hls.js must
        // never flip embedded subtitle tracks to showing on its own.
        renderTextTracksNatively: false,
      });
      hlsRef.current = hls;
      timeline.attachHls(hls); // LEVEL_LOADED → VOD totalduration / live verdict
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, (_evt, data) => {
        if (cancelled) return;
        // Quality levels (video renditions) — dedupe by height, sort hi-fi first
        const seen = new Set<number>();
        const lvls: { index: number; label: string; h: number }[] = [];
        (data?.levels ?? []).forEach((l, i) => {
          const h = typeof l.height === "number" && l.height > 0 ? l.height : 0;
          const label = h > 0 ? `${h}p` : `${Math.round(l.bitrate / 1000)} kbps`;
          const key = h > 0 ? h : Math.round(l.bitrate / 1000);
          if (seen.has(key)) return;
          seen.add(key);
          lvls.push({ index: i, label, h });
        });
        lvls.sort((a, b) => b.h - a.h);
        setLevels(lvls.map(({ index, label }) => ({ index, label })));
        // Alternative audio tracks served by the HLS manifest
        const tracks = hls.audioTracks ?? [];
        if (tracks.length > 1) {
          setAvailableTracks(tracks.map((t, i) => ({ label: t.name || t.lang || `Audio ${i + 1}` })));
        }
        onPhase("loading");
        tryPlay();
      });
      hls.on(Hls.Events.LEVEL_SWITCHED, (_evt, d) => {
        if (!cancelled) setAutoLevel(d.level);
      });
      let networkRetries = 0;
      let mediaRetries = 0;
      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (cancelled || !data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          if (networkRetries >= 3) {
            escalateFailure("cors-or-network", data.details ?? "HLS_NETWORK", data.reason ?? null);
            return;
          }
          networkRetries += 1;
          hls.startLoad();
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          if (mediaRetries >= 2) {
            escalateFailure("codec", data.details ?? "HLS_MEDIA", data.reason ?? null);
            return;
          }
          mediaRetries += 1;
          hls.recoverMediaError();
        } else {
          escalateFailure("cors-or-network", data.details ?? "HLS_OTHER", data.reason ?? null);
        }
      });
    } else {
      video.src = url;
      onPhase("loading");
      tryPlay();
    }

    return () => {
      cancelled = true;
      if (firstFrameTimerRef.current) {
        clearTimeout(firstFrameTimerRef.current);
        firstFrameTimerRef.current = null;
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [payload.url, payload.stream, payload.p2pBrowser?.infoHash, srcOverride, onPhase, onError]);

  // ---- SubtitleManager lifecycle ----
  // Attach on mount, keep native layers dead, destroy on unmount. The stage
  // remounts on stream source change (key={url} in PlayerOverlay), so unmount
  // cleanup also covers source switches and episode changes.
  useEffect(() => {
    const video = videoRef.current;
    const mgr = subManagerRef.current;
    if (!video || !mgr) return;
    mgr.attach(video);
    // hls.js / the UA can add TextTracks mid-flight — kill them the moment
    // they appear so the custom overlay stays the only renderer.
    const onTracksChanged = () => mgr.sweep();
    video.textTracks?.addEventListener?.("addtrack", onTracksChanged);
    video.textTracks?.addEventListener?.("removetrack", onTracksChanged);
    return () => {
      video.textTracks?.removeEventListener?.("addtrack", onTracksChanged);
      video.textTracks?.removeEventListener?.("removetrack", onTracksChanged);
      mgr.destroy();
      subManagerRef.current = null;
    };
  }, []);

  // Sweep + dev assertion whenever the subtitle state graph changes: track
  // selection (incl. subtitles off), language change (new list), fullscreen
  // in/out (UA may rebuild media tracks), and source overrides (remux path).
  useEffect(() => {
    const mgr = subManagerRef.current;
    if (!mgr) return;
    mgr.sweep();
    if (process.env.NODE_ENV !== "production") {
      const video = videoRef.current;
      let nativeShowing = 0;
      if (video?.textTracks) {
        for (let i = 0; i < video.textTracks.length; i++) {
          const t = video.textTracks[i];
          if (t && (t.mode === "showing" || t.mode === "hidden") && t.kind !== "metadata") nativeShowing++;
        }
      }
      const overlayActive = activeSub >= 0 && !!subtitles[activeSub];
      const strayOverlays = containerRef.current?.querySelectorAll(".harbor-subtitle").length ?? 0;
      if (nativeShowing > 0 || (overlayActive && strayOverlays > 1) || (!overlayActive && strayOverlays > 0)) {
        console.warn(
          `[Harbor] subtitle layer assertion: nativeShowing=${nativeShowing} overlayActive=${overlayActive} overlayEls=${strayOverlays} — exactly ONE layer is allowed`,
        );
      }
    }
  }, [activeSub, subtitles, fullscreen, srcOverride]);

  // Player-height-driven subtitle scaling (fullscreen / small viewports scale)
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height ?? 0;
      if (h > 0) setStageHeight(h);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ---- Resume ----
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (resumeAt.current > 1 && !seekHandled.current) {
      const seek = () => {
        // Resume position is TITLE seconds; the timeline maps it onto the
        // element (offset-aware). Resume no longer requires a known duration —
        // unknown-length streams resume too (the near-end guard only applies
        // when a duration is actually known).
        if (!seekHandled.current) {
          const dur = timeline.getSnapshot().duration;
          if (dur == null || resumeAt.current < dur - 5) {
            video.currentTime = Math.max(0, timeline.elementTimeFor(resumeAt.current));
          }
        }
        seekHandled.current = true;
      };
      if (video.readyState >= 1) seek();
      else video.addEventListener("loadedmetadata", seek, { once: true });
    }
  }, [ready, timeline]);

  // ---- PlaybackTimeline wiring ----
  // The element persists across srcOverride swaps (no stage remount), so the
  // timeline attaches once and owns every time/duration read from here on.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    timeline.attach(video);
    return () => {
      timeline.detachMedia();
    };
  }, [timeline]);

  // Duration truth from the server (ladder source #4): probe the ORIGINAL
  // source (stream url, or the payload URL for signed/demo flows) with an
  // ffprobe-backed wantsDuration request. Retries while the ladder is still
  // empty or approximate; the server caches per source (10 min).
  useEffect(() => {
    const src = payload.stream?.url ?? payload.url;
    if (!src) return;
    let alive = true;
    const headers = payload.stream?.behaviorHints?.proxyHeaders?.request ?? {};
    const run = () => {
      void fetch("/api/media/probe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: src, proxyHeaders: headers, wantsDuration: true }),
      })
        .then((r) => (r.ok ? (r.json() as Promise<{ durationS?: number | null }>) : null))
        .then((j) => {
          if (alive && j && typeof j.durationS === "number" && j.durationS > 1) {
            timeline.applyProbe(j.durationS);
          }
        })
        .catch(() => {});
    };
    let attempts = 0;
    const iv = setInterval(() => {
      attempts++;
      const source = timeline.getSnapshot().durationSource;
      if ((source !== "none" && source !== "meta") || attempts > 4) {
        clearInterval(iv);
        return;
      }
      run();
    }, 2500);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [payload.url, payload.stream, timeline]);

  // Approximate duration (ladder source #5): payload runtime first…
  useEffect(() => {
    timeline.setApproximateDuration(payload.runtimeSeconds ?? null);
  }, [payload.runtimeSeconds, timeline]);

  // …then a lazy metadata fetch when nothing real is known (picker flows and
  // deep links skip the runtime forwarding; one attempt per stage).
  const metaApproxTriedRef = useRef(false);
  useEffect(() => {
    if (!/^tt\d+/.test(payload.metaId)) return;
    const t = setTimeout(() => {
      if (metaApproxTriedRef.current) return;
      const snap = timeline.getSnapshot();
      if (snap.durationSource !== "none") return; // real value exists or is coming
      metaApproxTriedRef.current = true;
      void fetchMeta(payload.type === "series" ? "series" : "movie", payload.metaId.split(":")[0])
        .then((meta) => {
          if (!meta) return;
          const perEpisode =
            payload.season != null && payload.episode != null
              ? meta.videos?.find(
                  (v) => v.season === payload.season && v.episode === payload.episode,
                )?.duration
              : null;
          const seconds = parseRuntimeToSeconds(perEpisode) ?? parseRuntimeToSeconds(meta.runtime);
          if (seconds != null && timeline.getSnapshot().durationSource === "none") {
            timeline.setApproximateDuration(seconds);
          }
        })
        .catch(() => {});
    }, 4000); // give real sources time to land first
    return () => clearTimeout(t);
  }, [payload.metaId, payload.type, payload.season, payload.episode, timeline]);

  // ---- Media event handlers ----
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    // Time/duration state lives in the PlaybackTimeline (attached above) —
    // these handlers only manage play state, buffering and the watchdog.
    const onLoaded = () => {
      setReady(true);
      setBuffering(false);
      // NOTE: loadedmetadata is NOT a first frame — matroska/fMP4 containers
      // report metadata while being unplayable (silent-stall evidence, round
      // 25). The watchdog stays armed until real frames render (onPlaying).
      updateTrackList(video, setAvailableTracks);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onWaiting = () => setBuffering(true);
    const onPlaying = () => {
      setBuffering(false);
      gotFirstFrameRef.current = true;
      // A paused seek that triggered a server restart re-opens the source via
      // the auto-play attach path — restore the paused session on first frame.
      if (pauseAfterRestartRef.current) {
        pauseAfterRestartRef.current = false;
        video.pause();
      }
      onPhase("playing");
    };
    // Stall watchdog (silent-stall class): metadata arrived but the element
    // never produces frames — the media events above never fire an error.
    // Detected via timeupdate silence while nominally "playing".
    let cancelledLocal = false;
    const stall = { last: -1, checks: 0 };
    const stallIv = setInterval(() => {
      if (cancelledLocal) return;
      if (!gotFirstFrameRef.current) return; // pre-first-frame: media watchdog owns this
      if (video.paused || video.ended) return;
      const ct = video.currentTime;
      if (Math.abs(ct - stall.last) < 0.01) {
        stall.checks++;
        if (stall.checks >= 4) {
          // ~8s without a single timeupdate while "playing" — dead element
          clearInterval(stallIv);
          escalateFailure("codec", "STALL_NO_TIMEUPDATE", "element not advancing");
        }
      } else {
        stall.last = ct;
        stall.checks = 0;
      }
    }, 2000);
    // Named onVideoError so it never shadows the onError prop from the closure
    const onVideoError = () => {
      const code = video.error?.code ?? null;
      const msg = video.error?.message ?? null;
      const failed = classifyVideoError({ code, message: msg });
      escalateFailure(failed.cls, code, msg);
    };
    const onVolume = () => {
      setMuted(video.muted);
      setVolume(video.volume);
      setVolumeHudVisible(true);
      if (volumeHudTimer.current) clearTimeout(volumeHudTimer.current);
      volumeHudTimer.current = setTimeout(() => setVolumeHudVisible(false), 1400);
    };
    // Buffered ranges live in the timeline snapshot (title time); no listener needed.
    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("error", onVideoError);
    video.addEventListener("volumechange", onVolume);
    return () => {
      cancelledLocal = true;
      clearInterval(stallIv);
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("error", onVideoError);
      video.removeEventListener("volumechange", onVolume);
    };
  }, [payload, settings, onPhase, onError, escalateFailure]);

  // ---- Finalize watch progress on unmount + when tab is hidden/closed (Harbor flush parity) ----
  useEffect(() => {
    const flush = () => {
      // Values come from the timeline (title seconds, real duration or a
      // clearly-flagged approximate one) — never raw video.duration.
      const snap = timeline.getSnapshot();
      if (snap.currentTime > 1) {
        saveProgress(payload, snap.currentTime, snap.duration, settings, true, snap.isApproximate);
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
      flush();
    };
     
  }, []);

  // ---- Trakt scrobble (fire-and-forget; demo/unmatched streams never scrobble) ----
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!/^tt\d+$/.test(payload.metaId)) return;
    const type: "movie" | "episode" = payload.type === "series" ? "episode" : "movie";
    if (type === "episode" && (payload.season === undefined || payload.episode === undefined)) return;

    scrobbleStartSent.current = false;
    scrobbleLastSent.current = { start: 0, pause: 0, stop: 0 };

    const send = (action: "start" | "pause" | "stop") => {
      const now = Date.now();
      if (now - scrobbleLastSent.current[action] < 10_000) return; // dedupe per action
      scrobbleLastSent.current[action] = now;
      if (action === "start") scrobbleStartSent.current = true;
      // Timeline progress: null duration (unknown) scrobbles as 0 — Trakt
      // treats sub-5% progress as scrobble-start anyway; approximate durations
      // are still better than a fabricated 0 for real titles.
      const snap = timeline.getSnapshot();
      const pct = snap.progress != null ? Math.min(100, Math.max(0, snap.progress * 100)) : 0;
      const scrobblePayload = {
        progress: pct,
        type,
        imdbId: payload.metaId,
        season: payload.season,
        episode: payload.episode,
      };
      void useTrakt.getState().scrobble(action, scrobblePayload);
      // Fan out to vault-linked services (Trakt + Simkl activation-code links)
      void import("@/lib/harbor/linking").then(({ scrobbleToLinkedServices }) =>
        scrobbleToLinkedServices(action, scrobblePayload),
      );
    };

    let playStart = 0;
    let cumulativeMs = 0;
    const foldElapsed = () => {
      if (playStart > 0) {
        cumulativeMs += Date.now() - playStart;
        playStart = 0;
      }
    };

    const onPlaying = () => {
      if (playStart === 0) playStart = Date.now();
      const total = cumulativeMs + (Date.now() - playStart);
      if (total > 3000 && !scrobbleStartSent.current) send("start");
    };
    const onPause = () => {
      foldElapsed();
      if (video.ended) return; // ended handler sends the final stop
      if (scrobbleStartSent.current) send("pause");
    };
    const onEnded = () => {
      foldElapsed();
      if (scrobbleStartSent.current) send("stop");
    };
    const onPageHide = () => {
      if (scrobbleStartSent.current) send("stop");
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && scrobbleStartSent.current) send("stop");
    };

    video.addEventListener("playing", onPlaying);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      // Unmount or stream switch: close the scrobble session
      if (scrobbleStartSent.current) send("stop");
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [payload]);

  // ---- Continue Watching persistence (timeline-driven, 5s internal throttle) ----
  // Re-runs on every timeline emit (≈8/s); saveProgressThrottled self-throttles.
  useEffect(() => {
    if (!ready) return;
    if (time > 0.5) {
      saveProgressThrottled(payload, time, duration, settings, tlSnap.isApproximate);
    }
     
  }, [time]);

  // ---- Subtitle cue rendering ----
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTime = () => {
      if (activeSub < 0 || subtitles[activeSub] === undefined) {
        setSubCue(null);
        return;
      }
      // Title time (element time + server offset): subtitle cues are authored
      // against the full title, and -ss restarts keep cues title-relative.
      setSubCue(findActiveCue(subtitles[activeSub].cues, timeline.getSnapshot().currentTime));
    };
    video.addEventListener("timeupdate", onTime);
    return () => video.removeEventListener("timeupdate", onTime);
  }, [activeSub, subtitles, timeline]);

  // ---- Auto-load preferred subtitles ----
  // Fetches every installed subtitles addon + built-in mirrors, ranks by preferred
  // language, then incrementally loads the top of the pool ("Load more" extends).
  useEffect(() => {
    if (payload.type === "movie" || payload.type === "series") {
      let alive = true;
      subPoolRef.current = [];
      subAttemptedRef.current = 0;
      setSubPoolSize(0);
      setSubEffectiveCount(0);
      setSubtitles([]);
      setActiveSub(-1);
      (async () => {
        try {
          const { useAddons: addons } = await import("@/lib/harbor/store");
          const subs = await fetchSubtitles(
            addons.getState().addons,
            payload.type,
            payload.metaId,
            payload.videoId ?? payload.deepLink?.videoId,
          );
          if (!alive) return;
          // Read live store state, NOT the render closure: when the player mounts
          // via a deep link at app boot, child effects run BEFORE AppShell's
          // settings hydration effect, so the closure can still hold defaults.
          const live = useSettings.getState().settings;
          const preferred = live.preferredSubLangs;
          const sorted = [...subs].sort((a, b) => subScore(b, preferred) - subScore(a, preferred));
          subPoolRef.current = sorted;
          subEffectiveRef.current = sorted;
          setSubPoolSize(sorted.length);
          setSubEffectiveCount(sorted.length);
          const batch = sorted.slice(0, 8);
          subAttemptedRef.current = batch.length;
          const loaded = await parseSubBatch(batch);
          if (!alive || loaded.length === 0) return;
          // Idempotent commit: dedupe by stable key against whatever is committed
          setSubtitles((prev) => mergeSubtitlesUnique(prev, loaded));
          if (!live.subtitlesOffByDefault) setActiveSub(0);
        } catch {
          /* subtitles optional */
        }
      })();
      return () => {
        alive = false;
      };
    }
  }, [payload.metaId, payload.videoId]);

  // Rebuild the displayed subtitle view from the ranked pool:
  // 1) language chip re-ranks matches first, 2) free-text search narrows.
  // Commits are token-guarded so a fast retyping session can't let an older
  // batch clobber a newer view.
  const applySubView = useCallback(async (chip: string | null, search: string) => {
    const token = ++subViewTokenRef.current;
    setSubLangFilter(chip);
    setSubSearch(search);
    const query = search.trim().toLowerCase();
    const pool = subPoolRef.current;
    const afterChip = chip
      ? pool
          .map((s, i) => ({ s, i, match: langChip(s.lang) === chip ? 0 : 1 }))
          .sort((a, b) => a.match - b.match || a.i - b.i)
          .map((x) => x.s)
      : pool;
    const effective = query
      ? afterChip.filter((s) =>
          `${subLabel(s)} ${s.lang ?? ""} ${s.addonName ?? s.source ?? ""}`
            .toLowerCase()
            .includes(query),
        )
      : afterChip;
    subEffectiveRef.current = effective;
    setSubEffectiveCount(effective.length);
    subAttemptedRef.current = 0;
    setSubtitles([]);
    setActiveSub(-1);
    const batch = effective.slice(0, 8);
    subAttemptedRef.current = batch.length;
    if (batch.length === 0) return;
    setSubLoadingMore(true);
    const loaded = await parseSubBatch(batch);
    if (token !== subViewTokenRef.current) return; // superseded by a newer view
    if (loaded.length > 0) {
      setSubtitles((prev) => mergeSubtitlesUnique(prev, loaded));
      setActiveSub(0);
    }
    setSubLoadingMore(false);
  }, []);

  // Language chip click: keep the committed search, change the chip.
  const applySubFilter = useCallback(
    (chip: string | null) => {
      void applySubView(chip, subSearch);
    },
    [applySubView, subSearch],
  );

  // Debounced search input: ~280ms after typing stops, re-derive the view.
  const onSubSearchInput = useCallback(
    (value: string) => {
      setSubSearchInput(value);
      if (subSearchTimer.current) clearTimeout(subSearchTimer.current);
      subSearchTimer.current = setTimeout(() => {
        void applySubView(subLangFilter, value);
      }, 280);
    },
    [applySubView, subLangFilter],
  );

  useEffect(() => {
    return () => {
      if (subSearchTimer.current) clearTimeout(subSearchTimer.current);
    };
  }, []);

  const loadMoreSubtitles = useCallback(async () => {
    const pool = subEffectiveRef.current;
    const attempted = subAttemptedRef.current;
    if (subLoadingMore || attempted >= pool.length) return;
    setSubLoadingMore(true);
    const batch = pool.slice(attempted, attempted + 8);
    const loaded = await parseSubBatch(batch);
    subAttemptedRef.current = attempted + batch.length;
    if (loaded.length > 0) setSubtitles((prev) => mergeSubtitlesUnique(prev, loaded));
    setSubLoadingMore(false);
  }, [subLoadingMore]);

  // ---- Episode navigation: ordered episode list for series (season-crossing) ----
  // Fetches the series' videos once per title; prev/next are ordered-list
  // neighbors, so "last episode of season N → first of N+1" and season-0
  // specials ordering all fall out of the sort. Movies never render the
  // episode buttons.
  const [epList, setEpList] = useState<MetaVideo[]>([]);
  useEffect(() => {
    setEpList([]);
    if (payload.type !== "series" || !/^tt\d+$/.test(payload.metaId)) return;
    let alive = true;
    (async () => {
      try {
        const meta = await fetchMeta("series", payload.metaId);
        if (!alive || !meta?.videos) return;
        const vids = meta.videos
          .filter((v) => typeof v.season === "number" && typeof v.episode === "number")
          .sort(
            (a, b) =>
              (a.season as number) - (b.season as number) || (a.episode as number) - (b.episode as number),
          );
        if (alive) setEpList(vids);
      } catch {
        /* episode navigation is optional */
      }
    })();
    return () => {
      alive = false;
    };
  }, [payload.metaId, payload.type]);

  // Ordered-list neighbors: disabled (not hidden) at the series/season edges.
  const { prevEp, nextEp } = useMemo(() => {
    const idx = epList.findIndex((v) => v.season === payload.season && v.episode === payload.episode);
    if (idx < 0) return { prevEp: null as MetaVideo | null, nextEp: null as MetaVideo | null };
    return {
      prevEp: idx > 0 ? epList[idx - 1] : null,
      nextEp: idx < epList.length - 1 ? epList[idx + 1] : null,
    };
  }, [epList, payload.season, payload.episode]);
  const [upNextDismissed, setUpNextDismissed] = useState(false);

  // Switch to an episode: the VideoStage unmount flush saves the OUTGOING
  // episode's progress (CW + history) before the new payload enters the
  // resolving path; subtitles re-resolve for the new videoId and the scrobble
  // effect stops the old session / starts the new one via its own lifecycle.
  const switchEpisode = useCallback(
    (v: MetaVideo) => {
      onPlayNext({
        season: v.season as number,
        episode: v.episode as number,
        videoId: v.id,
        episodeName: v.name ?? v.title,
      });
    },
    [onPlayNext],
  );

  const playNext = useCallback(() => {
    if (!nextEp) return;
    switchEpisode(nextEp);
  }, [nextEp, switchEpisode]);

  // Auto-advance when playback ends (honors the autoPlayNextEpisode setting)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onEnded = () => {
      if (nextEp && settings.autoPlayNextEpisode && !upNextDismissed) switchEpisode(nextEp);
    };
    video.addEventListener("ended", onEnded);
    return () => video.removeEventListener("ended", onEnded);
  }, [nextEp, upNextDismissed, settings.autoPlayNextEpisode, switchEpisode]);

  // ---- Skip ±10s HUD + double-tap zones (touch) ----
  const [skipHud, setSkipHud] = useState<"back" | "fwd" | null>(null);
  const skipHudTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef<{ t: number; side: "back" | "fwd" } | null>(null);
  const pendingTapRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClickRef = useRef(false);
  const lastPointerTypeRef = useRef<string>("mouse");
  const showSkipHud = useCallback((dir: "back" | "fwd") => {
    setSkipHud(dir);
    if (skipHudTimer.current) clearTimeout(skipHudTimer.current);
    skipHudTimer.current = setTimeout(() => setSkipHud(null), 650);
  }, []);
  // Clamped, timeline-mapped skip used by buttons, double-tap and (indirectly)
  // the keyboard — real elapsed time and subtitle sync follow the timeline.
  const skipBy = useCallback(
    (deltaS: number) => {
      const snap = timeline.getSnapshot();
      const target = Math.min(snap.duration ?? Number.POSITIVE_INFINITY, Math.max(0, snap.currentTime + deltaS));
      doSeek(target);
      showSkipHud(deltaS < 0 ? "back" : "fwd");
    },
    [timeline, doSeek, showSkipHud],
  );

  // ---- Fullscreen tracking ----
  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // ---- Controls auto-hide ----
  const bumpControls = useCallback(() => {
    setControlsVisible(true);
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setControlsVisible(false);
        setSubMenuOpen(false);
        setSettingsMenuOpen(false);
      }
    }, 3200);
  }, []);

  useEffect(() => {
    bumpControls();
    return () => {
      if (controlsTimer.current) clearTimeout(controlsTimer.current);
    };
  }, [bumpControls]);

  // ---- Keyboard shortcuts (ported from Harbor hotkeys.ts) ----
  // All seeks go through the timeline (element move or server restart).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const video = videoRef.current;
      if (!video) return;
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      bumpControls();
      const seekBy = (deltaS: number) => {
        const snap = timeline.getSnapshot();
        doSeek(Math.max(0, snap.currentTime + deltaS));
      };
      const seekTo = (titleS: number) => doSeek(titleS);
      switch (e.key) {
        case " ":
          e.preventDefault();
          if (video.paused) video.play();
          else video.pause();
          break;
        case "f":
          toggleFullscreen();
          break;
        case "u":
          togglePip();
          break;
        case "m":
          video.muted = !video.muted;
          break;
        case "ArrowLeft":
          e.preventDefault();
          seekBy(-settings.seekBackStepSec);
          break;
        case "ArrowRight":
          e.preventDefault();
          seekBy(settings.seekForwardStepSec);
          break;
        case "ArrowUp":
          e.preventDefault();
          video.muted = false;
          video.volume = Math.min(1, video.volume + 0.1);
          break;
        case "ArrowDown":
          e.preventDefault();
          video.volume = Math.max(0, video.volume - 0.1);
          break;
        case "s":
        case "c":
          setActiveSub((i) => (i + 1 < subtitles.length ? i + 1 : -1));
          break;
        case "n":
        case "N": // Shift+N — next episode
          if (nextEp) switchEpisode(nextEp);
          break;
        case "P": // Shift+P — previous episode
          if (prevEp) switchEpisode(prevEp);
          break;
        case "w":
          onOpenSwitcher();
          break;
        case "Escape":
          if (document.fullscreenElement) {
            document.exitFullscreen();
          } else {
            useNav.getState().pop();
          }
          break;
        case "PageUp":
          e.preventDefault();
          seekBy(60);
          break;
        case "PageDown":
          e.preventDefault();
          seekBy(-60);
          break;
        case "Home":
          e.preventDefault();
          seekTo(0);
          break;
        case "End":
          e.preventDefault();
          {
            const snap = timeline.getSnapshot();
            if (snap.duration != null) seekTo(Math.max(0, snap.duration - 5));
          }
          break;
        default:
          if (/^[0-9]$/.test(e.key)) {
            const snap = timeline.getSnapshot();
            if (snap.duration != null) seekTo(snap.duration * (parseInt(e.key, 10) / 10));
          }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settings.seekBackStepSec, settings.seekForwardStepSec, subtitles.length, bumpControls, nextEp, prevEp, switchEpisode, onOpenSwitcher, timeline]);

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen().catch(() => {});
  };

  const togglePip = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await video.requestPictureInPicture();
    } catch {
      /* pip unsupported */
    }
  };

  const fillClass =
    settings.videoFill === "fill"
      ? "object-cover"
      : settings.videoFill === "zoom"
        ? "object-cover scale-105"
        : "object-contain";

  const stremioChrome = settings.playerTheme === "stremio" || (settings.playerTheme === "auto" && document.documentElement.dataset.themeLayout === "stremio");

  const selectAudioTrack = (i: number) => {
    setActiveAudio(i);
    const hls = hlsRef.current;
    if (hls && hls.audioTracks.length > 1) {
      hls.audioTrack = i;
      return;
    }
    // Native audioTracks (Safari native HLS)
    const video = videoRef.current as
      | (HTMLVideoElement & { audioTracks?: { length: number; [i: number]: { enabled: boolean } } })
      | null;
    if (video?.audioTracks && video.audioTracks[i]) {
      for (let k = 0; k < video.audioTracks.length; k++) video.audioTracks[k].enabled = k === i;
    }
  };

  const progressPct = tlSnap.progress != null ? tlSnap.progress * 100 : 0;
  const bufferedPct =
    duration != null && duration > 0
      ? Math.max(progressPct, Math.min(100, ((tlSnap.buffered[tlSnap.buffered.length - 1]?.end ?? 0) / duration) * 100))
      : progressPct;
  const nearEnd = duration != null && (duration - time <= 30 || time / duration >= 0.95);
  const nextCountdown = duration != null ? Math.max(0, Math.ceil(duration - time)) : 0;
  // Subtitle font scales with the player height: 720p reference → ×1, clamped
  // to [0.55, 1.6] so fullscreen grows and PiP/small windows stay readable.
  const subFontScale = stageHeight > 0 ? Math.min(1.6, Math.max(0.55, stageHeight / 720)) : 1;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 bg-black flex items-center justify-center"
      onMouseMove={bumpControls}
      onPointerDown={(e) => {
        lastPointerTypeRef.current = e.pointerType || "mouse";
      }}
      onPointerUp={(e) => {
        lastPointerTypeRef.current = e.pointerType || "mouse";
        // Touch double-tap on the video surface = skip ±10 s. Zones are
        // TIME-TRUE: the left side always rewinds because the seek bar is
        // dir=ltr even in RTL locales — only the control-bar row mirrors.
        if (e.pointerType !== "touch" || e.target !== videoRef.current) return;
        const side: "back" | "fwd" = e.clientX < window.innerWidth / 2 ? "back" : "fwd";
        const now = Date.now();
        const last = lastTapRef.current;
        if (last && now - last.t < 350 && last.side === side) {
          lastTapRef.current = null;
          if (pendingTapRef.current) {
            clearTimeout(pendingTapRef.current);
            pendingTapRef.current = null;
          }
          suppressClickRef.current = true;
          skipBy(side === "back" ? -10 : 10);
        } else {
          lastTapRef.current = { t: now, side };
        }
      }}
      onDoubleClick={(e) => {
        // Double-click video surface = fullscreen (mouse only — touch
        // double-taps are ±10 s skips, HTML5 convention preserved for mice)
        if (lastPointerTypeRef.current !== "mouse") return;
        if (e.target === videoRef.current || e.target === e.currentTarget) {
          const el = containerRef.current;
          if (!el) return;
          if (document.fullscreenElement) document.exitFullscreen();
          else el.requestFullscreen().catch(() => {});
        }
      }}
      onClick={(e) => {
        if (e.target === videoRef.current || e.target === e.currentTarget) {
          const video = videoRef.current;
          if (!video) return;
          if (lastPointerTypeRef.current === "touch") {
            // Touch: defer the tap toggle briefly so a quick second tap on the
            // same side can become a ±10 s skip instead.
            if (suppressClickRef.current) {
              suppressClickRef.current = false;
              return;
            }
            if (pendingTapRef.current) {
              clearTimeout(pendingTapRef.current);
              pendingTapRef.current = null;
              return;
            }
            pendingTapRef.current = setTimeout(() => {
              pendingTapRef.current = null;
              const v = videoRef.current;
              if (v) {
                if (v.paused) v.play();
                else v.pause();
              }
            }, 300);
            return;
          }
          if (video.paused) video.play();
          else video.pause();
        }
      }}
    >
      {/* Convert-first consent (transcodeMode="ask"): appears when a codec
          failure can still be rescued by server-side conversion */}
      {convertAsk && (
        <div
          className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-6"
          role="alertdialog"
          aria-modal="true"
          aria-label={homeT("convertingNeeds", settings.uiLanguage)}
        >
          <div className="md-dialog w-full max-w-sm p-5">
            <p className="md-title-medium text-ink">{homeT("convertingNeeds", settings.uiLanguage)}</p>
            <p className="text-xs text-ink-muted mt-1.5">
              {settings.uiLanguage.startsWith("ar")
                ? "يمكن للخادم تحويل هذا البث إلى صيغة متوافقة (H.264/AAC). قد يستهلك التحويل وقتاً ومعالجة."
                : "The server can convert this stream to a browser-friendly format (H.264/AAC). Conversion takes time and CPU."}
            </p>
            <div className="flex gap-2.5 mt-4">
              <button
                type="button"
                onClick={() => {
                  setConvertAsk(false);
                  toast({ title: homeT("tryingConvert", settings.uiLanguage) });
                  sourceModeRef.current = "transcode";
                  setBuffering(true);
                  const stream = payload.stream;
                  const upstream = stream?.url ?? (/^https?:\/\//i.test(payload.url) ? payload.url : null);
                  if (!upstream) return;
                  signSource({ ...(stream ?? { url: upstream }), url: upstream }, "transcode")
                    .then((r) => {
                      if (!aliveRef.current) return;
                      sourceHostRef.current = r.host;
                      setSrcOverride({ url: r.url, mode: "transcode" });
                    })
                    .catch(() => {
                      if (!aliveRef.current) return;
                      onError({
                        message: homeT("convertingNeeds", settings.uiLanguage),
                        cls: "codec",
                        code: null,
                        host: sourceHostRef.current,
                        canConvert: false,
                      });
                    });
                }}
                className="md-btn md-btn-filled md-state flex-1"
              >
                {homeT("convertAndPlay", settings.uiLanguage)}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConvertAsk(false);
                  onOpenSwitcher();
                }}
                className="md-btn md-btn-tonal md-state flex-1"
              >
                {homeT("pickAnother", settings.uiLanguage)}
              </button>
            </div>
          </div>
        </div>
      )}
      <video
        ref={videoRef}
        className={cn("w-full h-full", fillClass)}
        playsInline
      >
        {/* NO native <track> children — SubtitleManager + the overlay below are
            the single rendering path (duplicate-subs bug: native track AND
            overlay rendered the same cue at the same time) */}
      </video>

      {subtitles[activeSub] && subCue && (
        <div
          className={cn(
            "absolute inset-x-0 z-[15] flex justify-center pointer-events-none px-4 md:px-6",
            "transition-[bottom] duration-300 ease-out motion-reduce:transition-none",
            // Single positioning rule: sit ABOVE the control bar while controls
            // are visible, settle near the bottom edge when they auto-hide —
            // never overlapping the seek bar or transport.
            controlsVisible ? (stremioChrome ? "bottom-40" : "bottom-36") : "bottom-5 md:bottom-8",
          )}
        >
          <p
            className="harbor-subtitle max-w-[min(56rem,94%)]"
            style={{
              // Scale with player height (fullscreen scales up, small windows down)
              fontSize: `${Math.round(settings.subFontSize * subFontScale)}px`,
              color: settings.subFontColor,
              WebkitTextStroke: settings.subBorderSize > 0 ? `${settings.subBorderSize}px ${settings.subBorderColor}` : undefined,
              paintOrder: "stroke fill",
              background:
                settings.subStyle === "box"
                  ? `rgba(0,0,0,${settings.subBackgroundOpacity})`
                  : undefined,
              borderRadius: settings.subStyle === "box" ? "8px" : undefined,
              padding: settings.subStyle === "box" ? "4px 12px" : undefined,
              textShadow:
                settings.subStyle === "shadow"
                  ? "0 0 4px rgba(0,0,0,0.9), 0 2px 8px rgba(0,0,0,0.8)"
                  : settings.subStyle === "outline"
                    ? "0 0 2px #000"
                    : undefined,
            }}
          >
            {subCue.text}
          </p>
        </div>
      )}

      {/* Buffering */}
      {buffering && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
          <Loader2 className="w-12 h-12 text-accent animate-spin" />
          {(payload.p2p || payload.p2pBrowser) && (
            <div className="rounded-xl bg-black/70 backdrop-blur px-4 py-2.5 text-center" aria-live="polite">
              <p className="flex items-center justify-center gap-1.5 text-xs font-semibold text-ink">
                <Network className="w-3.5 h-3.5 text-accent" aria-hidden />{" "}
                {payload.p2pBrowser ? "Downloading via the in-browser engine…" : "Downloading via P2P…"}
              </p>
              <p className="text-[10px] text-ink-subtle mt-0.5 tabular-nums">
                {Math.round((p2pStats?.progress ?? 0) * 100)}% · {p2pStats?.peers ?? 0} peers · {formatSpeed(p2pStats?.downloadSpeed)}
              </p>
              {(payload.p2p?.mode === "remux") && !fullscreen && (
                <p className="text-[10px] text-ink-subtle mt-0.5">transmuxed — seeking restarts the transcoder at the target position</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* P2P status pill (persistent while a torrent stream is active) */}
      {/* Hidden while fullscreen: diagnostic telemetry (incl. the "transmux"
          mode suffix) must not sit on the movie. Windowed mode keeps it. */}
      {(payload.p2p || payload.p2pBrowser) && !buffering && !fullscreen && (
        <div
          className="md-card-elevated rounded-[var(--md-sys-shape-corner-large)]! absolute left-4 top-16 z-20 flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold text-ink tabular-nums transition-opacity"
          title={payload.p2pBrowser ? "In-browser WebTorrent stream (web peers)" : "Server-side P2P torrent stream"}
        >
          <Network className="w-3 h-3 text-accent" aria-hidden />
          P2P {Math.round((p2pStats?.progress ?? 0) * 100)}%
          <span className="text-ink-subtle">·</span>
          {formatSpeed(p2pStats?.downloadSpeed)}
          <span className="text-ink-subtle">·</span>
          {p2pStats?.peers ?? 0} peers
          {payload.p2p?.mode === "remux" && <span className="text-ink-subtle">· transmux</span>}
        </div>
      )}

      {/* Volume HUD (Harbor parity) */}
      <VolumeHud show={volumeHudVisible} muted={muted} volume={volume} />

      {/* Skip ±10 s feedback (buttons + touch double-tap) */}
      {skipHud && <SkipHud dir={skipHud} />}

      {/* Up Next card (series) — appears near the end of the episode */}
      {nextEp && nearEnd && !upNextDismissed && (
        <div
          className="absolute bottom-28 right-4 z-30 w-72 harbor-pop-in"
          role="alert"
          aria-label="Up next episode"
        >
          <div className="md-card-elevated rounded-[var(--md-sys-shape-corner-large)]! p-3.5">
            <div className="flex items-center gap-1.5 mb-2.5">
              <SkipForward className="w-3.5 h-3.5 text-accent" />
              <p className="md-label-medium uppercase text-ink-muted">Up next</p>
              <span className="ml-auto rounded-full bg-raised border border-edge-soft px-2 py-0.5 text-[10px] font-semibold text-ink-subtle tabular-nums">
                {nextCountdown > 0 ? `in ${nextCountdown}s` : "now"}
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-11 h-16 rounded-lg overflow-hidden relative shrink-0 bg-raised border border-edge-soft">
                {payload.poster && <PosterImage src={payload.poster} alt="" className="absolute inset-0" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="harbor-clamp-1 text-sm font-semibold text-ink">{payload.title}</p>
                <p className="harbor-clamp-1 text-xs text-ink-muted mt-0.5">
                  S{nextEp.season}:E{nextEp.episode}
                  {nextEp.episodeName ? ` · ${nextEp.episodeName}` : ""}
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={playNext}
                className="md-btn md-btn-filled md-state h-9! flex-1"
              >
                <Play className="md-btn-icon fill-current" /> {homeT("nextEpisode", settings.uiLanguage)}
              </button>
              <button
                type="button"
                onClick={() => setUpNextDismissed(true)}
                className="md-btn md-btn-tonal md-state h-9!"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom transport */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-4 pb-4 pt-12 transition-opacity duration-300",
          controlsVisible ? "opacity-100" : "opacity-0",
        )}
      >
        {/* Seek bar FLANKED by the two times — logical order: TOTAL anchors the
            inline-START edge (left in EN, right in AR), RUNNING time anchors the
            inline-END edge (right in EN, left in AR). No dir on this container:
            it mirrors with the document automatically. Digits are dir="ltr"
            inside each label so clock strings never scramble under bidi. */}
        <div className="group/seek relative mb-2.5 flex items-center gap-2.5" onClick={(e) => e.stopPropagation()}>
          <TimeEdge kind="total" snap={tlSnap} lang={settings.uiLanguage ?? "en"} />
          <div className="min-w-0 flex-1">
            <SeekBar snap={tlSnap} doSeek={doSeek} bumpControls={bumpControls} />
          </div>
          <TimeEdge kind="running" snap={tlSnap} lang={settings.uiLanguage ?? "en"} />
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => {
              const video = videoRef.current;
              if (video) {
                if (video.paused) video.play();
                else video.pause();
              }
            }}
            className="md-icon-btn md-icon-btn-filled md-state h-16! w-16! bg-white! text-black! shadow-[var(--md-sys-elevation-1)] transition-shadow hover:shadow-[var(--md-sys-elevation-2)]"
            aria-label={playing ? "Pause (Space)" : "Play (Space)"}
          >
            {playing ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-0.5" />}
          </button>
          <button
            type="button"
            onClick={() => skipBy(-settings.seekBackStepSec)}
            className="md-icon-btn md-state h-12! w-12! text-white!"
            aria-label={
              settings.uiLanguage.startsWith("ar")
                ? `رجوع ${settings.seekBackStepSec} ثوانٍ`
                : `Back ${settings.seekBackStepSec}s`
            }
            title={
              settings.uiLanguage.startsWith("ar")
                ? `رجوع ${settings.seekBackStepSec} ثوانٍ (←)`
                : `Back ${settings.seekBackStepSec}s (←)`
            }
          >
            <RotateCcw className="w-4.5 h-4.5" />
          </button>
          <button
            type="button"
            onClick={() => skipBy(settings.seekForwardStepSec)}
            className="md-icon-btn md-state h-12! w-12! text-white!"
            aria-label={
              settings.uiLanguage.startsWith("ar")
                ? `تقديم ${settings.seekForwardStepSec} ثوانٍ`
                : `Forward ${settings.seekForwardStepSec}s`
            }
            title={
              settings.uiLanguage.startsWith("ar")
                ? `تقديم ${settings.seekForwardStepSec} ثوانٍ (→)`
                : `Forward ${settings.seekForwardStepSec}s (→)`
            }
          >
            <RotateCw className="w-4.5 h-4.5" />
          </button>

          {/* Previous / next episode — series only; disabled (not hidden) at
              the series edges. Shift+P / Shift+N on the keyboard. */}
          {payload.type === "series" && (
            <>
              <button
                type="button"
                onClick={() => prevEp && switchEpisode(prevEp)}
                disabled={!prevEp}
                className="md-icon-btn md-state h-12! w-12! text-white! disabled:opacity-40"
                aria-label={`${homeT("prevEpisode", settings.uiLanguage)} (Shift+P)`}
                title={`${homeT("prevEpisode", settings.uiLanguage)} (Shift+P)`}
              >
                <StepBack className="w-4.5 h-4.5" />
              </button>
              <button
                type="button"
                onClick={() => nextEp && switchEpisode(nextEp)}
                disabled={!nextEp}
                className="md-icon-btn md-state h-12! w-12! text-white! disabled:opacity-40"
                aria-label={`${homeT("nextEpisode", settings.uiLanguage)} (Shift+N)`}
                title={`${homeT("nextEpisode", settings.uiLanguage)} (Shift+N)`}
              >
                <StepForward className="w-4.5 h-4.5" />
              </button>
            </>
          )}

          {/* Volume */}
          <div className="flex items-center gap-1.5 group/vol">
            <button
              type="button"
              onClick={() => {
                const video = videoRef.current;
                if (video) video.muted = !video.muted;
              }}
              className="md-icon-btn md-state h-12! w-12! text-white!"
              aria-label={muted ? "Unmute (M)" : "Mute (M)"}
            >
              {muted || volume === 0 ? <VolumeX className="w-4.5 h-4.5" /> : <Volume2 className="w-4.5 h-4.5" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => {
                const video = videoRef.current;
                if (video) {
                  video.volume = Number(e.target.value);
                  video.muted = Number(e.target.value) === 0;
                }
              }}
              className="w-16 md:w-24 h-1 rounded-full appearance-none bg-white/25 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_1px_3px_1px_rgba(0,0,0,0.15)] [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-150 hover:[&::-webkit-slider-thumb]:scale-110"
              aria-label="Volume"
            />
          </div>

          {/* relative anchor for BOTH popover panels (subtitles + settings):
              this group hugs the bar's physical right edge in BOTH directions
              (ml-auto is physical), so a physical right-0 anchor always leaves
              the panels fully on-screen — a logical end-0 here was measured
              overflowing the viewport in RTL (button sits at the far right
              edge, panel extended outward). */}
          <div className="relative ml-auto flex items-center gap-1">
            {/* Audio / dub — only when the engine listed MORE than one audio
                track for a torrent remux (multi-dub releases). Panel mirrors
                the subtitles panel geometry (group-anchored right-0). */}
            {payload.p2p && audioTracks && audioTracks.length > 1 && (
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setAudioMenuOpen((v) => !v);
                    setSubMenuOpen(false);
                    setSettingsMenuOpen(false);
                  }}
                  className={cn("md-icon-btn md-state h-12! w-12!", audioMenuOpen || audioSel > 0 ? "text-accent!" : "text-white!")}
                  aria-label="Audio / dub"
                  aria-expanded={audioMenuOpen}
                >
                  <AudioLines className="w-4.5 h-4.5" />
                </button>
                {audioMenuOpen && (
                  <div
                    className="md-dialog bg-[var(--md-sys-color-surface-container-low)]! absolute bottom-12 right-0 w-72 max-w-[calc(100vw-2rem)] p-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p className="md-label-medium uppercase text-ink-muted mb-2 px-1">
                      {homeT("audioPanelTitle", settings.uiLanguage)}
                    </p>
                    <div className="max-h-64 overflow-y-auto harbor-scroll flex flex-col gap-0.5">
                      {audioTracks.map((t) => {
                        const active = t.rel === audioSel;
                        return (
                          <button
                            key={t.rel}
                            type="button"
                            onClick={() => switchAudioTrack(t.rel)}
                            aria-pressed={active}
                            className={cn(
                              "md-state flex items-center gap-2 w-full text-start rounded-lg px-2.5 py-2 text-xs transition-colors",
                              active ? "bg-accent/15 text-accent font-semibold" : "text-ink hover:bg-white/8",
                            )}
                          >
                            {active ? (
                              <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" aria-hidden />
                            ) : (
                              <span className="w-1.5 h-1.5 rounded-full bg-white/25 shrink-0" aria-hidden />
                            )}
                            <span className="truncate flex-1">{audioTrackLabel(t, homeT("audioTrackFallback", settings.uiLanguage))}</span>
                            {t.rel === 0 && (
                              <span className="md-chip h-5! px-1.5! text-[9px]! shrink-0">{homeT("audioOriginal", settings.uiLanguage)}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-ink-subtle mt-2 px-1">
                      {audioTracks.length} audio tracks · switching restarts the stream at the current position
                    </p>
                  </div>
                )}
              </div>
            )}
            {/* Subtitles — NOT a positioning context anymore: the panel anchors
              to the button GROUP above (see comment there). */}
            <div>
              <button
                type="button"
                onClick={() => {
                  setSubMenuOpen((v) => !v);
                  setSettingsMenuOpen(false);
                }}
                className={cn(
                  "md-icon-btn md-state h-12! w-12!",
                  subMenuOpen || activeSub >= 0 ? "text-accent!" : "text-white!",
                )}
                aria-label="Subtitles (S)"
              >
                <Subtitles className="w-4.5 h-4.5" />
              </button>
              {subMenuOpen && (
                /* Anchored to the button GROUP (physical right-0): stable at
                   the bar's right edge in LTR and RTL; max-w guards 320px. */
                <div className="md-dialog bg-[var(--md-sys-color-surface-container-low)]! absolute bottom-12 right-0 w-72 max-w-[calc(100vw-2rem)] p-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-2 px-1">
                    <p className="md-label-medium uppercase text-ink-muted">Subtitles</p>
                    {subEffectiveCount > 0 && (
                      <span className="text-[10px] text-ink-subtle tabular-nums">
                        {subtitles.length}/{subEffectiveCount} loaded
                      </span>
                    )}
                  </div>
                  {subLangChips.length > 1 && (
                    <div className="flex items-center gap-1 mb-2 overflow-x-auto harbor-scroll -mx-1 px-1 pb-0.5" role="group" aria-label="Filter subtitles by language">
                      <button
                        type="button"
                        onClick={() => applySubFilter(null)}
                        aria-pressed={subLangFilter === null}
                        className={cn(
                          "md-chip md-state shrink-0 h-7! px-2.5! text-[10px]! font-bold tracking-wide",
                          subLangFilter === null && "md-chip-selected",
                        )}
                      >
                        All
                      </button>
                      {subLangChips.map(([chip, count]) => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => applySubFilter(chip)}
                          aria-pressed={subLangFilter === chip}
                          className={cn(
                            "md-chip md-state shrink-0 h-7! px-2.5! text-[10px]! font-bold tracking-wide",
                            subLangFilter === chip && "md-chip-selected",
                          )}
                        >
                          {chip}
                          <span className={cn("tabular-nums", subLangFilter === chip ? "opacity-60" : "text-ink-subtle")}>{count}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {subPoolSize > 6 && (
                    <div className="relative mb-2">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-subtle" aria-hidden />
                      <input
                        value={subSearchInput}
                        onChange={(e) => onSubSearchInput(e.target.value)}
                        onKeyDown={(e) => {
                          // Keep player hotkeys (arrows/space) out of the way while typing
                          e.stopPropagation();
                        }}
                        placeholder="Filter subtitles…"
                        className="md-field-outlined w-full pl-8 pr-8 py-1.5 text-xs placeholder:text-ink-subtle"
                        aria-label="Filter subtitles by name, language or provider"
                      />
                      {subSearchInput && (
                        <button
                          type="button"
                          onClick={() => onSubSearchInput("")}
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded flex items-center justify-center text-ink-subtle hover:text-ink hover:bg-white/10"
                          aria-label="Clear subtitle filter"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                  <div className="max-h-64 overflow-y-auto harbor-scroll -mx-1 px-1 space-y-0.5">
                    <button
                      type="button"
                      onClick={() => setActiveSub(-1)}
                      className={cn(
                        "md-state w-full text-left rounded-[var(--md-sys-shape-corner-small)] px-2.5 py-2 text-sm",
                        activeSub === -1 ? "bg-accent-soft text-accent" : "text-ink-muted hover:text-ink",
                      )}
                    >
                      Off
                    </button>
                    {subtitles.map((s, i) => (
                      <button
                        key={`${s.url}-${i}`}
                        type="button"
                        onClick={() => setActiveSub(i)}
                        className={cn(
                          "md-state w-full flex items-center gap-2 rounded-[var(--md-sys-shape-corner-small)] px-2 py-2 text-left",
                          activeSub === i ? "bg-accent-soft text-accent" : "text-ink-muted hover:text-ink",
                        )}
                      >
                        <span
                          className={cn(
                            "shrink-0 w-9 text-center rounded px-1 py-0.5 text-[9px] font-bold tracking-widest",
                            activeSub === i ? "bg-accent text-black" : "bg-raised text-ink-subtle",
                          )}
                        >
                          {langChip(s.lang)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="harbor-clamp-1 block text-xs font-medium leading-4">{s.label}</span>
                          {(s.source || s.aiTranslated) && (
                            <span className="mt-0.5 flex items-center gap-1.5 text-[9px] text-ink-subtle">
                              {s.source && <span className="harbor-clamp-1 max-w-[9rem]">{s.source}</span>}
                              {s.aiTranslated && (
                                <span className={cn("shrink-0 rounded px-1 py-px font-bold", activeSub === i ? "bg-accent text-black" : "bg-raised")}>
                                  AI
                                </span>
                              )}
                            </span>
                          )}
                        </span>
                      </button>
                    ))}
                    {subtitles.length === 0 && subEffectiveCount === 0 && subSearch.trim() && (
                      <p className="text-xs text-ink-subtle px-2.5 py-2">
                        No subtitles match “{subSearch.trim()}”.
                      </p>
                    )}
                    {subtitles.length === 0 && !subSearch.trim() && (
                      <p className="text-xs text-ink-subtle px-2.5 py-2">No subtitles found for this title.</p>
                    )}
                  </div>
                  {subEffectiveCount > subtitles.length && (
                    <button
                      type="button"
                      onClick={() => void loadMoreSubtitles()}
                      disabled={subLoadingMore}
                      className="md-state mt-1.5 w-full flex items-center justify-center gap-1.5 rounded-[var(--md-sys-shape-corner-small)] border border-dashed border-edge px-3 py-2 text-xs text-ink-muted hover:text-ink disabled:opacity-50 transition-colors"
                    >
                      {subLoadingMore ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Plus className="w-3.5 h-3.5" />
                      )}
                      Load more{subEffectiveCount > subtitles.length ? ` (${subEffectiveCount - subtitles.length} more)` : ""}
                    </button>
                  )}
                  <label className="md-state mt-1.5 flex items-center justify-center gap-2 rounded-[var(--md-sys-shape-corner-small)] border border-dashed border-edge px-3 py-2 text-xs text-ink-muted hover:text-ink cursor-pointer transition-colors">
                    Load local file (.srt / .vtt)
                    <input
                      type="file"
                      accept=".srt,.vtt,.ass,.ssa"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const text = await file.text();
                        const { parseSubtitle } = await import("@/lib/harbor/subtitles");
                        const cues = parseSubtitle(text);
                        if (cues.length === 0) {
                          toast({ title: "No readable cues found in that file." });
                          return;
                        }
                        // Idempotent append against the LATEST committed list
                        // (avoids the stale-index race while a batch is parsing)
                        const next = mergeSubtitlesUnique(subtitlesRef.current, [
                          { label: file.name, url: "", cues, source: "Local file" },
                        ]);
                        if (next.length === subtitlesRef.current.length) {
                          toast({ title: "This subtitle is already loaded." });
                          return;
                        }
                        subtitlesRef.current = next;
                        setSubtitles(next);
                        setActiveSub(next.length - 1);
                        setSubMenuOpen(false);
                      }}
                    />
                  </label>
                </div>
              )}
            </div>

            {/* Settings / speed — same group-anchored panel as subtitles */}
            <div>
              <button
                type="button"
                onClick={() => {
                  setSettingsMenuOpen((v) => !v);
                  setSubMenuOpen(false);
                }}
                className={cn(
                  "md-icon-btn md-state h-12! w-12!",
                  settingsMenuOpen ? "text-accent!" : "text-white!",
                )}
                aria-label="Playback settings"
              >
                <Settings2 className="w-4.5 h-4.5" />
              </button>
              {settingsMenuOpen && (
                /* Group-anchored (physical right-0) — see subtitles panel */
                <div className="md-dialog bg-[var(--md-sys-color-surface-container-low)]! absolute bottom-12 right-0 w-64 max-w-[calc(100vw-2rem)] max-h-[70vh] overflow-y-auto harbor-scroll p-3" onClick={(e) => e.stopPropagation()}>
                  <p className="md-label-medium uppercase text-ink-muted mb-2 flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5" /> Speed
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map((spd) => (
                      <button
                        key={spd}
                        type="button"
                        onClick={() => {
                          setSpeed(spd);
                          if (videoRef.current) videoRef.current.playbackRate = spd;
                        }}
                        className={cn(
                          "md-chip md-state justify-center",
                          speed === spd && "md-chip-selected",
                        )}
                      >
                        {spd}×
                      </button>
                    ))}
                  </div>
                  {levels.length > 1 && (
                    <>
                      <p className="md-label-medium uppercase text-ink-muted mt-3 mb-2 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5" /> Quality
                      </p>
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setLevelSel(-1);
                            if (hlsRef.current) hlsRef.current.currentLevel = -1;
                          }}
                          className={cn(
                            "md-chip md-state justify-center",
                            levelSel === -1 && "md-chip-selected",
                          )}
                          title={levelSel === -1 && autoLevel >= 0 ? `Now playing ${levels.find((l) => l.index === autoLevel)?.label ?? ""}` : "Adaptive bitrate"}
                        >
                          Auto
                        </button>
                        {levels.map((l) => (
                          <button
                            key={l.index}
                            type="button"
                            onClick={() => {
                              setLevelSel(l.index);
                              if (hlsRef.current) hlsRef.current.currentLevel = l.index;
                            }}
                            className={cn(
                              "md-chip md-state justify-center",
                              levelSel === l.index && "md-chip-selected",
                            )}
                          >
                            {l.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  {availableTracks.length > 1 && (
                    <>
                      <p className="md-label-medium uppercase text-ink-muted mt-3 mb-2 flex items-center gap-1.5">
                        <AudioLines className="w-3.5 h-3.5" /> Audio
                      </p>
                      <div className="max-h-28 overflow-y-auto harbor-scroll space-y-1">
                        {availableTracks.map((t, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => selectAudioTrack(i)}
                            className={cn(
                              "md-state w-full text-left rounded-[var(--md-sys-shape-corner-small)] px-3 py-1.5 text-xs harbor-clamp-1",
                              activeAudio === i ? "bg-accent-soft text-accent" : "text-ink-muted hover:text-ink",
                            )}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  <p className="md-label-medium uppercase text-ink-muted mt-3 mb-2">Video fit</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(["fit", "fill", "zoom"] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => useSettings.getState().update({ videoFill: f })}
                        className={cn(
                          "md-chip md-state justify-center",
                          settings.videoFill === f && "md-chip-selected",
                        )}
                      >
                        {f === "fit" ? "Fit" : f === "fill" ? "Fill" : "Zoom"}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={togglePip}
              className="md-icon-btn md-state h-12! w-12! text-white!"
              aria-label="Picture in picture (U)"
            >
              <PictureInPicture2 className="w-4.5 h-4.5" />
            </button>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="md-icon-btn md-state h-12! w-12! text-white!"
              aria-label={fullscreen ? "Exit fullscreen (F)" : "Fullscreen (F)"}
            >
              {fullscreen ? <Minimize className="w-4.5 h-4.5" /> : <Maximize className="w-4.5 h-4.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------- Helpers ----------------
function VolumeHud({ show, muted, volume }: { show: boolean; muted: boolean; volume: number }) {
  const pct = Math.round((muted ? 0 : volume) * 100);
  return (
    <div
      className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none transition-all duration-300 ${
        show ? "opacity-100 scale-100" : "opacity-0 scale-90"
      }`}
      aria-hidden
    >
      <div className="rounded-2xl bg-black/70 backdrop-blur-md px-5 py-4 flex flex-col items-center gap-2.5 min-w-[120px]">
        {muted || volume === 0 ? (
          <VolumeX className="w-7 h-7 text-ink" />
        ) : (
          <Volume2 className="w-7 h-7 text-ink" />
        )}
        <div className="w-full h-1.5 rounded-full bg-white/20 overflow-hidden">
          <div className="h-full bg-white rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs text-ink-muted tabular-nums">{pct}%</span>
      </div>
    </div>
  );
}

// ---------------- Skip ±10 s feedback HUD ----------------
// Brief center chip mirroring the VolumeHud language (icon + "±10 s");
// dir=ltr — the ± sign is time-true in every locale.
function SkipHud({ dir }: { dir: "back" | "fwd" }) {
  return (
    <div
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none harbor-pop-in"
      aria-hidden
    >
      <div className="flex items-center gap-2 rounded-full bg-black/70 backdrop-blur-md px-4 py-2.5" dir="ltr">
        {dir === "back" ? <RotateCcw className="w-5 h-5 text-ink" /> : <RotateCw className="w-5 h-5 text-ink" />}
        <span className="text-sm font-semibold text-ink tabular-nums">{dir === "back" ? "−10 s" : "+10 s"}</span>
      </div>
    </div>
  );
}

// ---------------- Seek bar (M3, timeline-driven) ----------------
// Pointer/touch/keyboard seeking against the PlaybackTimeline. The bar always
// renders dir=ltr (media convention — value grows rightward in every locale);
// the surrounding flex row mirrors in RTL. Unknown durations render an honest
// indeterminate track (elapsed-only, no fake percentage) instead of a 0% bar.
const TIME_DISPLAY_KEY = "harbor-web.time-display";

function SeekBar({
  snap,
  doSeek,
  bumpControls,
}: {
  snap: TimelineSnapshot;
  doSeek: (titleSeconds: number) => void;
  bumpControls: () => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<number | null>(null); // preview title-seconds while scrubbing
  // Committed drag target kept in a ref so pointerup NEVER reads a stale
  // closure (down+up processed in the same task / fast taps must not lose the
  // seek — the state alone can lag one render behind the pointer).
  const dragRef = useRef<number | null>(null);
  const duration = snap.duration;
  const known = duration != null && duration > 0;
  const shownTime = drag ?? snap.currentTime;
  const pct = (t: number) => (known ? Math.min(100, Math.max(0, (t / (duration as number)) * 100)) : 0);

  const posFromEvent = (clientX: number): number | null => {
    const el = trackRef.current;
    if (!el || !known) return null;
    const r = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    return ratio * (duration as number);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!known) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic/edge pointers — drag still works within the element */
    }
    const p = posFromEvent(e.clientX);
    if (p != null) {
      dragRef.current = p;
      setDrag(p);
      bumpControls();
    }
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current == null) return;
    const p = posFromEvent(e.clientX);
    if (p != null) {
      dragRef.current = p;
      setDrag(p);
    }
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current == null) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    const target = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (target != null) doSeek(target);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!known && !["Home", "End", "ArrowLeft", "ArrowRight"].includes(e.key)) return;
    const step = 10;
    let handled = true;
    switch (e.key) {
      case "ArrowLeft":
        doSeek(Math.max(0, snap.currentTime - step));
        break;
      case "ArrowRight":
        doSeek(snap.currentTime + step);
        break;
      case "PageUp":
        doSeek(snap.currentTime + 60);
        break;
      case "PageDown":
        doSeek(Math.max(0, snap.currentTime - 60));
        break;
      case "Home":
        doSeek(0);
        break;
      case "End":
        if (known) doSeek(Math.max(0, (duration as number) - 5));
        break;
      default:
        if (/^[0-9]$/.test(e.key) && known) {
          doSeek((duration as number) * (parseInt(e.key, 10) / 10));
        } else {
          handled = false;
        }
    }
    if (handled) {
      e.preventDefault();
      // The window-level hotkey handler also seeks on arrows — without this,
      // focused-slider arrow keys would resolve twice (same absolute target,
      // so it was benign, but strictly single-seek is correct).
      e.stopPropagation();
      bumpControls();
    }
  };

  const ariaText = known
    ? `${spokenDuration(shownTime)} of ${spokenDuration(duration as number)}`
    : `Elapsed ${spokenDuration(snap.currentTime)}, total length unknown`;

  return (
    <div
      dir="ltr"
      role="slider"
      tabIndex={0}
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={known ? Math.round(duration as number) : 0}
      aria-valuenow={known ? Math.round(shownTime) : undefined}
      aria-valuetext={ariaText}
      aria-disabled={!known}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
      className="relative flex h-11 w-full touch-none select-none items-center outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded-full"
      title={
        known
          ? "Seek — click, drag, or use arrow keys"
          : "Total length unknown for this stream — showing elapsed time; seeking may be limited"
      }
    >
      <div ref={trackRef} className="relative h-1 w-full overflow-visible rounded-full bg-white/25">
        {/* Buffered ranges (lighter track) */}
        {known &&
          snap.buffered.map((r, i) => {
            const left = Math.min(100, pct(r.start));
            const width = Math.max(0, Math.min(100, pct(r.end)) - left);
            if (width <= 0) return null;
            return (
              <div
                key={i}
                className="absolute inset-y-0 rounded-full bg-white/40"
                style={{ left: `${left}%`, width: `${width}%` }}
              />
            );
          })}
        {/* Watched fill */}
        {known ? (
          <div
            className={`absolute inset-y-0 left-0 rounded-full bg-white ${drag == null ? "transition-[width] duration-150 ease-linear" : ""}`}
            style={{ width: `${pct(shownTime)}%` }}
          />
        ) : (
          // Indeterminate: honest "unknown length" state — slow shimmer, no % claim
          <div className="absolute inset-y-0 left-0 w-1/4 rounded-full bg-white/35 harbor-seek-indeterminate" />
        )}
        {/* Thumb */}
        {known && (
          <div
            className={`absolute top-1/2 -mt-2 -ml-2 h-4 w-4 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.3),0_1px_3px_1px_rgba(0,0,0,0.15)] transition-transform duration-150 ${
              drag != null ? "scale-125" : "scale-100 group-hover/seek:scale-110"
            } pointer-events-none`}
            style={{ left: `${pct(shownTime)}%` }}
          />
        )}
        {/* Drag tooltip */}
        {drag != null && known && (
          <div
            className="pointer-events-none absolute bottom-full mb-2 -translate-x-1/2 rounded-lg bg-black/90 px-2 py-1 text-[11px] font-semibold text-white tabular-nums shadow-lg"
            style={{ left: `${pct(drag)}%` }}
          >
            {formatClock(drag)}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------- Seek-bar edge time labels ----------------
// LOGICAL placement chosen by the user: the TOTAL duration anchors the
// inline-START edge (left side in English, right side in Arabic) and the
// RUNNING time anchors the inline-END edge (right in English, left in
// Arabic). The parent flex row has no dir attribute, so the mirror is
// automatic. Tapping the running edge still toggles elapsed ↔ remaining
// (TIME_DISPLAY_KEY preserved). dir="ltr" on each label keeps clock digits
// in canonical order under bidi.
function TimeEdge({
  kind,
  snap,
  lang,
}: {
  kind: "total" | "running";
  snap: TimelineSnapshot;
  lang: string;
}) {
  const [mode, setMode] = useState<"elapsed" | "remaining">(() => {
    if (typeof window === "undefined") return "elapsed";
    try {
      return window.localStorage.getItem(TIME_DISPLAY_KEY) === "remaining" ? "remaining" : "elapsed";
    } catch {
      return "elapsed";
    }
  });
  const toggle = () => {
    const next = mode === "elapsed" ? "remaining" : "elapsed";
    setMode(next);
    try {
      window.localStorage.setItem(TIME_DISPLAY_KEY, next);
    } catch {
      /* private mode */
    }
  };
  const ar = lang.startsWith("ar");
  const { currentTime, duration, remaining, isApproximate } = snap;
  const totalKnown = duration != null;

  if (kind === "total") {
    const value = totalKnown ? `${isApproximate ? "~" : ""}${formatClock(duration)}` : null;
    return (
      <span
        dir="ltr"
        title={
          totalKnown
            ? ar ? "المدة الكاملة" : "Total length"
            : ar ? "المدة غير معروفة لهذا البث" : "Total length unknown for this stream"
        }
        className={cn(
          "shrink-0 select-none rounded-md px-1 py-0.5 text-xs tabular-nums",
          totalKnown ? "text-ink-muted" : "text-ink-subtle",
        )}
      >
        {value ?? (ar ? "غير معروفة" : "unknown")}
      </span>
    );
  }

  const runningValue =
    mode === "remaining" && remaining != null ? `-${formatClock(remaining)}` : formatClock(currentTime);
  const ariaText = totalKnown
    ? `${spokenDuration(currentTime)} of ${spokenDuration(duration as number)}`
    : `Elapsed ${spokenDuration(currentTime)}, total length unknown`;
  return (
    <button
      type="button"
      dir="ltr"
      onClick={toggle}
      title={
        totalKnown
          ? ar ? "تبديل بين الوقت المنقضي والمتبقي" : "Toggle elapsed / remaining time"
          : ar ? "المدة غير معروفة — يظهر الوقت المنقضي" : "Total length unknown — showing elapsed time"
      }
      className="shrink-0 rounded-md px-1 py-0.5 text-xs text-ink-muted tabular-nums md-state hover:text-ink"
      aria-label={
        ar
          ? `الوقت: ${ariaText}. اضغط للتبديل إلى عرض الوقت المتبقي.`
          : `Time: ${ariaText}. Activate to toggle remaining time display.`
      }
    >
      <span aria-live="off">{runningValue}</span>
    </button>
  );
}

function fmtTime(t: number): string {
  if (!Number.isFinite(t) || t < 0) return "0:00";
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}
void fmtTime; // retained for potential debug overlays; UI uses formatClock now

/** Host-only URL display for diagnostics (never the full tokenized URL). */
function safeHostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function subScore(s: RawSubtitle, preferred: string[]): number {
  let score = 0;
  preferred.forEach((p, i) => {
    if (langMatches(s.lang, p)) score += 100 - i * 10;
  });
  return score;
}

// Fetch + parse a batch of subtitle entries, skipping failures.
// Dedupe within the batch itself (two providers often serve the same file)
// and against `existingKeys` so re-parses can never double-commit a track.
async function parseSubBatch(
  batch: RawSubtitle[],
  existingKeys?: Set<string>,
): Promise<LoadedSubtitle[]> {
  const seen = existingKeys ?? new Set<string>();
  const loaded: LoadedSubtitle[] = [];
  for (const s of batch) {
    const label = subLabel(s);
    const key = subtitleDedupeKey({ url: s.url, lang: s.lang, label });
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      loaded.push(
        await fetchAndParseSubtitle(s.url, label, s.lang, {
          source: s.addonName ?? s.source,
          aiTranslated: s.ai_translated === true || s.ai_translated === "true",
        }),
      );
    } catch {
      /* skip bad sub */
    }
  }
  return loaded;
}

let lastSave = 0;
let lastHistorySave = 0;
function saveProgressThrottled(
  payload: PlayerPayload,
  position: number,
  duration: number | null,
  settings: ReturnType<typeof useSettings.getState>["settings"],
  approximate = false,
) {
  const now = Date.now();
  if (now - lastSave < 5000) return;
  lastSave = now;
  saveProgress(payload, position, duration, settings, false, approximate);
  // Record into history every 30s of progress so stats survive reloads/crashes
  if (now - lastHistorySave >= 30_000) {
    lastHistorySave = now;
    pushHistory({
      id: payload.metaId,
      type: payload.type === "series" ? "series" : "movie",
      name: payload.title,
      poster: payload.poster,
      videoId: payload.videoId,
      season: payload.season,
      episode: payload.episode,
      episodeName: payload.episodeName,
      positionMs: Math.round(position * 1000),
      // Unknown durations store 0 — history consumers treat 0/0 as "unmeasured"
      durationMs: duration != null ? Math.round(duration * 1000) : 0,
    });
  }
}

function saveProgress(
  payload: PlayerPayload,
  position: number,
  duration: number | null,
  settings: ReturnType<typeof useSettings.getState>["settings"],
  final: boolean,
  approximate = false,
) {
  // Never fabricate: unknown durations still persist the resume POSITION
  // (durationMs 0 → no progress bar, no false "completed"), approximate
  // durations are stored but clearly flagged.
  const entry = {
    id: payload.metaId,
    type: payload.type === "series" ? ("series" as const) : ("movie" as const),
    name: payload.title,
    poster: payload.poster,
    season: payload.season,
    episode: payload.episode,
    videoId: payload.videoId,
    episodeName: payload.episodeName,
    positionMs: Math.round(position * 1000),
    durationMs: duration != null ? Math.round(duration * 1000) : 0,
    durationApprox: approximate && duration != null ? true : undefined,
    t: Date.now(),
  };
  const progress = duration != null && duration > 0 ? position / duration : 0;
  if (!final || (duration == null || progress < 0.92)) {
    upsertCw(entry);
  }
  if (final) {
    pushHistory(entry);
  }
}

function updateTrackList(
  video: HTMLVideoElement,
  setTracks: (t: { label: string }[]) => void,
) {
  const el = video as HTMLVideoElement & { audioTracks?: { length: number; [i: number]: { label?: string; language?: string } } };
  if (el.audioTracks && el.audioTracks.length > 1) {
    const list: { label: string }[] = [];
    for (let i = 0; i < el.audioTracks.length; i++) {
      const t = el.audioTracks[i];
      list.push({ label: t.label || t.language || `Track ${i + 1}` });
    }
    setTracks(list);
  }
}
