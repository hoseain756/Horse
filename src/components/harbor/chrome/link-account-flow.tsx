"use client";

// Harbor Web — Account linking via activation code (Trakt + Simkl)
// The user enters ONLY a short code on the provider's official site:
//   1. large readable code with one-click copy
//   2. official verification URL as a button (new tab)
//   3. QR code of that URL
//   4. live expiry countdown
//   5. automatic polling with status indicator
//   6. success screen with the linked username/avatar
// Plus "Generate new code" and "Cancel" and clear error states.
//
// Round 32 (defect A): shared M3 button styling (52dp, fully rounded, leading
// icon inline + centered label — the base styles now live on the variant
// classes themselves), full i18n (t() dictionary), bidi isolation for the
// provider hosts/URLs inside Arabic sentences (RichBidi), and an Advanced
// disclosure with a mirrored chevron + expand animation.
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  Check, Copy, Loader2, ExternalLink, RefreshCw, Square, Unplug, CloudDownload, KeyRound,
} from "lucide-react";
import { useLinking, type ServiceId } from "@/lib/harbor/linking";
import { useToast } from "@/hooks/use-toast";
import { useT } from "@/hooks/use-t";
import { RichBidi, Bdi } from "../common/bidi";
import { cn } from "@/lib/utils";

const SERVICE_META: Record<ServiceId, { name: string; host: string }> = {
  trakt: { name: "Trakt.tv", host: "trakt.tv/activate" },
  simkl: { name: "Simkl", host: "simkl.com/pin" },
};

/** Split "Visit {url} and enter this code:" into [head, tail] around {url}. */
function splitTemplate(template: string, varName: string): [string, string] {
  const parts = template.split(`{${varName}}`);
  return [parts[0] ?? "", parts[1] ?? ""];
}

export function LinkAccountFlow({ service }: { service: ServiceId }) {
  const flow = useLinking((s) => s.flow);
  const account = useLinking((s) => s[service]);
  const startLink = useLinking((s) => s.startLink);
  const regenerate = useLinking((s) => s.regenerate);
  const pollOnce = useLinking((s) => s.pollOnce);
  const cancelFlow = useLinking((s) => s.cancelFlow);
  const unlink = useLinking((s) => s.unlink);
  const syncNow = useLinking((s) => s.syncNow);
  const syncing = useLinking((s) => s.syncing[service]);
  const lastSync = useLinking((s) => s.lastSync[service]);
  const { toast } = useToast();
  const tr = useT();

  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const active = flow?.service === service ? flow : null;

  // Polling loop while waiting
  useEffect(() => {
    if (!active || active.status !== "waiting") return;
    let alive = true;
    const tick = async () => {
      if (!alive) return;
      const result = await pollOnce();
      if (!alive) return;
      if (result === "authorized") {
        toast({ title: tr("connectedTitle", { name: SERVICE_META[service].name }), description: tr("tokensSecure") });
        return;
      }
      if (result === "pending") {
        const retryIn = useLinking.getState().flow?.slowDown ? 8000 : (useLinking.getState().flow?.intervalSec ?? 5) * 1000;
        pollTimer.current = setTimeout(tick, Math.max(3000, retryIn));
      }
      // terminal → stop (UI shows the failure state)
    };
    pollTimer.current = setTimeout(tick, 2500);
    return () => {
      alive = false;
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [active?.status, active?.pollId, pollOnce, service, toast, tr]);

  // QR data URL for the verification URL
  useEffect(() => {
    if (!active?.verificationUrl) {
      setQr(null);
      return;
    }
    let alive = true;
    QRCode.toDataURL(active.verificationUrl, { margin: 1, width: 160, color: { dark: "#0b0b0d", light: "#ffffff" } })
      .then((url) => {
        if (alive) setQr(url);
      })
      .catch(() => {
        if (alive) setQr(null);
      });
    return () => {
      alive = false;
    };
  }, [active?.verificationUrl]);

  const copy = async () => {
    if (!active?.userCode) return;
    try {
      await navigator.clipboard.writeText(active.userCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast({ title: tr("copyFailed"), description: tr("copyFailedBody") });
    }
  };

  if (account && !active) {
    return <LinkedCard service={service} account={account} onUnlink={() => void unlink(service)} onSync={() => void handleSync()} syncing={!!syncing} lastSync={lastSync} />;
  }

  if (!active) {
    return (
      <div className="mt-4">
        {/* M3 filled button: 52dp, corner-full, leading icon inline, centered label */}
        <button
          type="button"
          onClick={() => void startLink(service)}
          className="md-btn-filled harbor-tv-focus w-full !h-[52px] px-6"
        >
          <KeyRound className="md-btn-icon" aria-hidden />
          {tr("linkWithCode", { name: SERVICE_META[service].name })}
        </button>
        <p className="mt-2 text-center md-body-small text-ink-muted">
          <RichBidi text={tr("noAccountNeeded", { host: SERVICE_META[service].host })} />
        </p>
      </div>
    );
  }

  // ---- Active flow ----
  if (active.status === "authorized") {
    return (
      <div className="mt-4 rounded-[var(--md-sys-shape-corner-large)] bg-[var(--md-sys-color-tertiary-container)] text-[var(--md-sys-color-on-tertiary-container)] p-4 text-center harbor-pop-in" role="status">
        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--md-sys-color-tertiary)] text-[var(--md-sys-color-on-tertiary)]">
          <Check className="h-5 w-5" aria-hidden />
        </div>
        <p className="md-title-small">{tr("connectedTitle", { name: SERVICE_META[service].name })}</p>
        {account?.username && (
          <p className="mt-0.5 md-body-small">
            {tr("linkedAs", { name: account.username })}
          </p>
        )}
      </div>
    );
  }

  if (active.status === "expired" || active.status === "denied" || active.status === "failed") {
    const msg =
      active.status === "expired"
        ? langExpired(tr)
        : active.status === "denied"
          ? langDenied(tr)
          : active.error ?? langGenericError(tr);
    return (
      <div className="mt-4 rounded-[var(--md-sys-shape-corner-large)] bg-[var(--md-sys-color-error-container)] text-[var(--md-sys-color-on-error-container)] p-4" role="alert">
        <p className="md-body-large font-semibold">{msg}</p>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => void regenerate()} className="md-btn-filled harbor-tv-focus !h-9 text-xs">
            <RefreshCw className="md-btn-icon" aria-hidden /> {tr("generateNewCode")}
          </button>
          <button type="button" onClick={cancelFlow} className="md-btn-text harbor-tv-focus !h-9 text-xs">
            {tr("cancel")}
          </button>
        </div>
      </div>
    );
  }

  // waiting
  const [visitHead, visitTail] = splitTemplate(tr("visitEnterCode", { url: "" }), "url");
  return (
    <div className="mt-4 md-card-outlined rounded-[var(--md-sys-shape-corner-large)] p-4">
      <p className="md-body-small text-ink-muted">
        {visitHead}
        <a
          href={active.verificationUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="font-semibold text-accent underline underline-offset-2"
        >
          <Bdi>{active.verificationUrl.replace(/^https?:\/\//, "")}</Bdi>
        </a>
        {visitTail}
      </p>

      <div className="mt-3 flex items-center gap-4 flex-wrap">
        <div className="min-w-0">
          {/* Activation code on surface-container-highest — mono, high-emphasis block.
              The code itself is always Latin/digits → bidi-isolated. */}
          <button
            type="button"
            onClick={() => void copy()}
            className="md-state harbor-tv-focus group flex items-center gap-3 rounded-[28px] bg-[var(--md-sys-color-surface-container-highest)] px-5 py-4 hover:!bg-[var(--md-sys-color-surface-container-highest)]"
            title={tr("clickToCopy")}
          >
            <Bdi className="font-mono text-4xl font-bold tracking-[0.28em] text-accent select-all">
              {active.userCode}
            </Bdi>
            {copied ? <Check className="w-5 h-5 text-emerald-400" aria-hidden /> : <Copy className="w-4.5 h-4.5 text-ink-muted group-hover:text-ink" aria-hidden />}
          </button>
          <Countdown expiresAt={active.expiresAt} />
        </div>

        {qr && (
          <div className="hidden sm:block rounded-xl bg-white p-1.5 shadow-lg" title={tr("scanQr")}>
            <img src={qr} alt={`QR code linking to ${active.verificationUrl}`} className="h-28 w-28" />
          </div>
        )}
      </div>

      <div className="mt-3.5 flex items-center gap-2 flex-wrap">
        <a
          href={active.verificationUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="md-btn-filled harbor-tv-focus !h-9 text-xs"
        >
          <ExternalLink className="md-btn-icon" aria-hidden /> {tr("openHost", { host: SERVICE_META[service].host })}
        </a>
        <span className="flex items-center gap-1.5 md-body-small text-ink-muted" role="status" aria-live="polite">
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
          {active.slowDown ? tr("waitingSlowDown") : active.error ? active.error : tr("waitingAuth")}
        </span>
        <span className="basis-full md-body-small text-ink-muted/80">
          {tr("approveAuto")}
        </span>
        <div className="ms-auto flex gap-2">
          <button type="button" onClick={() => void regenerate()} className="md-btn-tonal harbor-tv-focus !h-9 px-3 text-xs">
            <RefreshCw className="md-btn-icon" aria-hidden /> {tr("newCode")}
          </button>
          <button type="button" onClick={cancelFlow} className="md-btn-text harbor-tv-focus !h-9 text-xs">
            <Square className="md-btn-icon" aria-hidden /> {tr("cancel")}
          </button>
        </div>
      </div>
    </div>
  );

  async function handleSync() {
    const res = await syncNow(service);
    if (res) {
      toast({
        title: tr("syncedTitle", { name: SERVICE_META[service].name }),
        description: `+${res.watchlist} · +${res.history}`,
      });
    } else {
      toast({ title: tr("syncFailed"), description: tr("syncFailedBody"), variant: "destructive" });
    }
  }
}

// Localized terminal-flow messages (kept near the component that renders them)
function langExpired(tr: ReturnType<typeof useT>): string {
  const ar = tr.lang.startsWith("ar");
  return ar ? "انتهت صلاحية الرمز — ولّد رمزاً جديداً." : "The code expired — generate a new one.";
}
function langDenied(tr: ReturnType<typeof useT>): string {
  const ar = tr.lang.startsWith("ar");
  return ar ? "تم رفض الوصول في موقع المزوّد. يمكنك المحاولة من جديد." : "Access was denied on the provider's site. You can start again.";
}
function langGenericError(tr: ReturnType<typeof useT>): string {
  const ar = tr.lang.startsWith("ar");
  return ar ? "حدث خطأ ما — حاول مجدداً." : "Something went wrong — try again.";
}

function Countdown({ expiresAt }: { expiresAt: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);
  const tr = useT();
  const left = Math.max(0, Math.floor((expiresAt - now) / 1000));
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  return (
    <p className="mt-1.5 text-[11px] text-ink-subtle tabular-nums" role="timer" aria-label={tr("codeExpiresAria")}>
      {tr("expiresIn")} <Bdi className={cn("font-semibold", left < 60 && "text-danger")}>{mm}:{ss}</Bdi>
    </p>
  );
}

/** Linked state: avatar, username, Sync now, last-sync timestamp, Unlink. */
export function LinkedCard({
  service,
  account,
  onUnlink,
  onSync,
  syncing,
  lastSync,
}: {
  service: ServiceId;
  account: { username: string | null; avatar: string | null; linkedAt: number };
  onUnlink: () => void;
  onSync: () => void;
  syncing: boolean;
  lastSync?: number;
}) {
  const meta = SERVICE_META[service];
  const tr = useT();
  return (
    <div className="mt-4 space-y-3">
      {/* Linked = success state (M3 tertiary-container) */}
      <div className="flex items-center gap-3 rounded-[var(--md-sys-shape-corner-large)] border border-[var(--md-sys-color-tertiary)] bg-[var(--md-sys-color-tertiary-container)] text-[var(--md-sys-color-on-tertiary-container)] px-3.5 py-2.5">
        <span className="relative shrink-0">
          {account.avatar ? (

            <img src={account.avatar} alt="" className="h-9 w-9 rounded-full object-cover border border-edge-soft" />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent">
              {(account.username ?? "?").slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 border-2 border-canvas" aria-hidden>
            <Check className="h-2.5 w-2.5 text-black" />
          </span>
        </span>
        <div className="min-w-0">
          <p className="md-body-medium font-semibold truncate">
            {account.username ? <Bdi>@{account.username}</Bdi> : tr("connectedTitle", { name: meta.name })}
          </p>
          <p className="md-body-small">
            {lastSync
              ? tr("lastSync", { d: new Date(lastSync).toLocaleString(tr.lang) })
              : new Date(account.linkedAt).toLocaleDateString(tr.lang)}
          </p>
        </div>
        <div className="ms-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onSync}
            disabled={syncing}
            className="md-btn-tonal harbor-tv-focus !h-9 px-3 text-xs disabled:opacity-60"
          >
            {syncing ? <Loader2 className="md-btn-icon animate-spin" aria-hidden /> : <CloudDownload className="md-btn-icon" aria-hidden />} {tr("syncNow")}
          </button>
          <button
            type="button"
            onClick={onUnlink}
            className="md-btn-text harbor-tv-focus !h-9 text-xs hover:!text-danger"
          >
            <Unplug className="md-btn-icon" aria-hidden /> {tr("unlink")}
          </button>
        </div>
      </div>
    </div>
  );
}
