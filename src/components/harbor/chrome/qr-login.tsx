"use client";

// Harbor Web — QR sign-in (big screen ↔ logged-in phone)
//
// A TV / laptop / tablet that is NOT signed in shows a XXX-XXX code + QR
// deep link (#qrlogin=CODE). The phone — already signed in — scans the QR
// (or types the code), and one tap approves. The big screen polls
// /api/auth/qr/status every 2.5s; the moment the phone approves, the server
// mints the session cookie ON that poll response, the panel reloads the
// account, and the SAME merge-strategy handoff as password login runs
// (strategy dialog → mergeAccountSnapshotIntoLocal(strategy) → pushNow).
//
// Both sides live here:
//   • <QrLoginPanel />     — the third tab inside Settings → Account (signed out)
//   • <QrApproveDialog />  — phone-side approval; app-shell mounts it ONCE
//   • openQrApprove(code?) — app-shell calls this for #qrlogin= deep links
import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  Check,
  Copy,
  Loader2,
  LogIn,
  QrCode,
  RefreshCw,
  Smartphone,
  TriangleAlert,
} from "lucide-react";
import { useHorseAccount } from "@/lib/harbor/horse-account";
import { useNav } from "@/lib/harbor/store";
import { useT } from "@/hooks/use-t";
import { useToast } from "@/hooks/use-toast";
import { Bdi, RichBidi } from "../common/bidi";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CodeCountdown, CodeInput, formatCodeGroups } from "./code-input";

// App-shell dispatches this (detail = 6-char code, "" for manual entry) when
// the URL carries #qrlogin= — same receiver pattern as #pair=.
const QR_APPROVE_EVENT = "harbor:qr-approve";

export function openQrApprove(code = ""): void {
  window.dispatchEvent(new CustomEvent(QR_APPROVE_EVENT, { detail: code }));
}

// ---------------------------------------------------------------- panel ---

type QrPhase = "idle" | "creating" | "waiting" | "approved" | "denied" | "expired";

type QrUserPayload = {
  email: string;
  username: string;
  displayName: string | null;
  createdAt: string;
  emailVerified: boolean;
};

/**
 * Signed-out tab surface: generate a 5-minute login code, show it big with a
 * QR of #qrlogin=CODE, poll for approval. `onApproved` runs AFTER the session
 * cookie is set and the account store reloaded — HorseAccountCard wires it to
 * the same merge-strategy sequence password login uses.
 */
export function QrLoginPanel({ onApproved }: { onApproved: () => void | Promise<void> }) {
  const { toast } = useToast();
  const tr = useT();

  const [phase, setPhase] = useState<QrPhase>("idle");
  const [code, setCode] = useState("");
  const [displayCode, setDisplayCode] = useState("");
  const [expiresAt, setExpiresAt] = useState(0);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // The poll token is a bearer secret for the status endpoint — held in a
  // ref, never rendered, never logged.
  const pollToken = useRef("");
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  const started = useRef(false);
  // Latest-callback ref: the handoff prop may change identity, and the poll
  // continuation must always call the current one.
  const onApprovedRef = useRef(onApproved);
  useEffect(() => {
    onApprovedRef.current = onApproved;
  });

  const stopPolling = useCallback(() => {
    if (pollTimer.current) clearTimeout(pollTimer.current);
    pollTimer.current = null;
  }, []);

  useEffect(
    () => () => {
      mounted.current = false;
      stopPolling();
    },
    [stopPolling],
  );

  const schedulePoll = useCallback(
    (exp: number) => {
      pollTimer.current = setTimeout(async () => {
        if (!mounted.current) return;
        if (Date.now() >= exp) {
          setPhase("expired");
          return;
        }
        try {
          const res = await fetch("/api/auth/qr/status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pollToken: pollToken.current }),
            cache: "no-store",
            signal: AbortSignal.timeout(12_000),
          });
          const d = (await res.json()) as {
            status?: "waiting" | "approved" | "denied" | "expired";
            expiresAt?: number;
            user?: QrUserPayload;
          };
          if (!mounted.current) return;
          if (res.ok && d.status === "approved") {
            stopPolling();
            setPhase("approved");
            // Brief success beat, then adopt the minted session and hand
            // over to the merge-strategy sequence (same as password login).
            await new Promise((r) => setTimeout(r, 1200));
            if (!mounted.current) return;
            await useHorseAccount.getState().load();
            if (!useHorseAccount.getState().user) {
              // Cookie didn't stick (network hiccup) — offer a retry instead
              // of a dead end.
              if (mounted.current) setPhase("expired");
              return;
            }
            await onApprovedRef.current();
            return;
          }
          if (res.ok && d.status === "denied") {
            stopPolling();
            setPhase("denied");
            return;
          }
          if (res.ok && d.status === "expired") {
            stopPolling();
            setPhase("expired");
            return;
          }
          if (res.ok && typeof d.expiresAt === "number") setExpiresAt(d.expiresAt);
        } catch {
          /* transient network hiccup → keep polling until expiry */
        }
        if (!mounted.current) return;
        if (Date.now() >= exp) {
          setPhase("expired");
          return;
        }
        schedulePoll(exp);
      }, 2500);
    },
    [stopPolling],
  );

  const start = useCallback(async () => {
    stopPolling();
    setPhase("creating");
    setQr(null);
    try {
      const res = await fetch("/api/auth/qr/create", {
        method: "POST",
        signal: AbortSignal.timeout(15_000),
      });
      const d = (await res.json()) as {
        code?: string;
        displayCode?: string;
        pollToken?: string;
        expiresAt?: number;
        error?: string;
      };
      if (!res.ok || !d.code || !d.pollToken) throw new Error(d.error ?? "create failed");
      pollToken.current = d.pollToken;
      const exp = typeof d.expiresAt === "number" ? d.expiresAt : Date.now() + 300_000;
      setCode(d.code);
      setDisplayCode(d.displayCode ?? formatCodeGroups(d.code, 2));
      setExpiresAt(exp);
      setPhase("waiting");
      schedulePoll(exp);
    } catch {
      if (!mounted.current) return;
      setPhase("idle");
      toast({ title: tr("qrCreateFailed"), variant: "destructive" });
    }
  }, [schedulePoll, stopPolling, toast, tr]);

  // The tab itself is the intent — generate the code immediately on mount
  // (deferred: no setState inside the effect body — lint-safe cascades).
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const id = setTimeout(() => void start(), 0);
    return () => clearTimeout(id);
  }, [start]);

  // Regenerate: cancel the previous code server-side (best-effort — the
  // 5-minute TTL cleans it up anyway), then create a fresh one.
  const regenerate = useCallback(async () => {
    const old = code;
    stopPolling();
    if (old) {
      try {
        await fetch("/api/auth/qr/deny", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: old }),
          signal: AbortSignal.timeout(10_000),
        });
      } catch {
        /* best-effort */
      }
    }
    if (!mounted.current) return;
    await start();
  }, [code, start, stopPolling]);

  // QR of the deep link (white plate → scannable on dark TV skins)
  useEffect(() => {
    if (phase !== "waiting" || !code) {
      setQr(null);
      return;
    }
    let aliveQr = true;
    const url = `${window.location.origin}/#qrlogin=${code}`;
    QRCode.toDataURL(url, { margin: 1, width: 240, color: { dark: "#0b0b0d", light: "#ffffff" } })
      .then((u) => {
        if (aliveQr) setQr(u);
      })
      .catch(() => {
        if (aliveQr) setQr(null);
      });
    return () => {
      aliveQr = false;
    };
  }, [phase, code]);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
      toast({ title: tr("qrCodeCopied") });
    } catch {
      /* clipboard blocked — the code is big on screen anyway */
    }
  };

  const steps = [
    { icon: Smartphone, text: tr("qrLoginStep1") },
    { icon: QrCode, text: tr("qrLoginStep2") },
    { icon: Check, text: tr("qrLoginStep3") },
  ];

  return (
    <div>
      {phase === "creating" ? (
        <div className="flex items-center justify-center gap-2 py-10 text-xs text-ink-subtle" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {tr("pairStarting")}
        </div>
      ) : phase === "approved" ? (
        <div
          className="mt-3 rounded-[var(--md-sys-shape-corner-medium)] bg-[var(--md-sys-color-tertiary-container)] text-[var(--md-sys-color-on-tertiary-container)] p-3.5 text-center harbor-pop-in"
          role="status"
        >
          <div className="mx-auto mb-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--md-sys-color-tertiary)] text-[var(--md-sys-color-on-tertiary)]">
            <Check className="h-4.5 w-4.5" aria-hidden />
          </div>
          <p className="md-title-small font-semibold">{tr("qrApproved")}</p>
        </div>
      ) : phase === "denied" || phase === "expired" || phase === "idle" ? (
        <div
          className="mt-3 rounded-[var(--md-sys-shape-corner-medium)] bg-[var(--md-sys-color-error-container)] text-[var(--md-sys-color-on-error-container)] p-3.5"
          role="alert"
        >
          <p className="flex items-center gap-2 text-sm font-semibold">
            <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />
            <RichBidi text={phase === "denied" ? tr("qrDenied") : tr("qrExpired")} />
          </p>
          <div className="mt-2.5 flex gap-2">
            <Button onClick={() => void regenerate()} className="md-btn-filled !h-9 text-xs">
              <RefreshCw className="w-3.5 h-3.5 me-1.5" aria-hidden />
              {tr("qrTryAgain")}
            </Button>
          </div>
        </div>
      ) : (
        // ---- waiting for the phone ----
        <div className="mt-3">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="min-w-0">
              <p className="md-label-medium text-ink-muted mb-1">{tr("qrCodeLabel")}</p>
              <button
                type="button"
                onClick={() => void copyCode()}
                title={tr("qrCodeLabel")}
                className="md-state harbor-tv-focus group flex items-center gap-3 rounded-[28px] bg-[var(--md-sys-color-surface-container-highest)] px-5 py-3.5"
              >
                <Bdi className="font-mono text-4xl font-bold tracking-[0.22em] text-accent select-all">
                  {displayCode}
                </Bdi>
                {copied ? (
                  <Check className="h-5 w-5 text-emerald-400" aria-hidden />
                ) : (
                  <Copy className="h-4 w-4 text-ink-muted group-hover:text-ink" aria-hidden />
                )}
              </button>
              <CodeCountdown expiresAt={expiresAt} />
            </div>

            {qr && (
              <div className="rounded-xl bg-white p-1.5 shadow-lg" title={tr("qrLoginHint")}>
                <img src={qr} alt={tr("qrLoginHint")} className="h-36 w-36" />
              </div>
            )}
          </div>

          <p className="mt-2.5 text-xs text-ink-subtle">
            <RichBidi text={tr("qrLoginHint")} />
          </p>

          {/* 3-step hint row — stacks on narrow, 3 columns ≥840px */}
          <ol className="mt-3 grid grid-cols-1 min-[840px]:grid-cols-3 gap-2">
            {steps.map((s, i) => (
              <li
                key={i}
                className="flex items-center gap-2 rounded-[var(--md-sys-shape-corner-small)] border border-edge-soft bg-raised px-3 py-2 min-h-11"
              >
                <s.icon className="w-4 h-4 text-accent shrink-0" aria-hidden />
                <span className="text-xs text-ink-muted">
                  <RichBidi text={s.text} />
                </span>
              </li>
            ))}
          </ol>

          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1.5 text-xs text-ink-muted" role="status" aria-live="polite">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              {tr("qrWaiting")}
            </span>
            <div className="ms-auto flex gap-2">
              <Button onClick={() => void regenerate()} variant="outline" className="md-btn-tonal !h-9 px-3 text-xs">
                <RefreshCw className="w-3.5 h-3.5 me-1.5" aria-hidden />
                {tr("qrNewCode")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------- approval ---

type ApproveStep = "input" | "checking" | "confirm" | "approving" | "success";

/**
 * Phone-side approval dialog. Mounted ONCE in app-shell; opened by the
 * #qrlogin= deep link (code pre-filled) or by the "Approve a sign-in code"
 * row in Settings → Account (manual entry). Requires a signed-in account on
 * this device — approval is impossible otherwise, by design.
 */
export function QrApproveDialog() {
  const { toast } = useToast();
  const tr = useT();
  const user = useHorseAccount((s) => s.user);

  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [deviceHint, setDeviceHint] = useState<string | null>(null);
  const [step, setStep] = useState<ApproveStep>("input");
  const [err, setErr] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);

  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoFor = useRef("");
  /** Latest `check`, so the event handler (declared before it) can fire it. */
  const checkRef = useRef<(raw: string) => Promise<void>>(undefined);

  useEffect(() => {
    const h = (e: Event) => {
      const c = formatCodeGroups((e as CustomEvent<string>).detail ?? "", 2);
      setCode(c);
      setDeviceHint(null);
      setErr(null);
      setAuthRequired(false);
      setStep("input");
      const raw = c.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
      autoFor.current = raw; // the handler itself resolves a complete code
      setOpen(true);
      if (raw.length === 6) {
        // Deep link / prefilled code — resolve the asking device right away.
        const id = setTimeout(() => void checkRef.current?.(raw), 0);
        return () => clearTimeout(id);
      }
    };
    window.addEventListener(QR_APPROVE_EVENT, h);
    return () => window.removeEventListener(QR_APPROVE_EVENT, h);
  }, []);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  const rawCode = code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

  /** Peek the code (logged-in only): resolves the asking device. */
  const check = useCallback(
    async (raw: string) => {
      if (raw.length !== 6) return;
      setStep("checking");
      setErr(null);
      setDeviceHint(null);
      try {
        const res = await fetch("/api/auth/qr/peek", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: raw }),
          signal: AbortSignal.timeout(25_000),
        });
        const d = (await res.json()) as {
          ok?: boolean;
          reason?: "missing" | "used";
          deviceHint?: string;
          error?: string;
        };
        if (res.status === 401) {
          setAuthRequired(true);
          setStep("input");
          return;
        }
        if (!res.ok || !d.ok) {
          setStep("input");
          setErr(
            d.reason === "used"
              ? tr("qrApproveUsed")
              : d.reason === "missing"
                ? tr("qrApproveInvalid")
                : d.error ?? tr("qrApproveFailed"),
          );
          return;
        }
        setDeviceHint(d.deviceHint ?? "");
        setStep("confirm");
      } catch {
        setStep("input");
        setErr(tr("qrApproveFailed"));
      }
    },
    [tr],
  );
  useEffect(() => {
    checkRef.current = check;
  }, [check]);

  // Prefilled-code fallback (e.g. the code arrived before this listener was
  // attached, or state was restored): check once when a complete code is
  // present and hasn't been resolved by the event handler already.
  useEffect(() => {
    if (!open || rawCode.length !== 6) {
      autoFor.current = "";
      return;
    }
    if (autoFor.current === rawCode) return;
    autoFor.current = rawCode;
    const id = setTimeout(() => void check(rawCode), 0);
    return () => clearTimeout(id);
  }, [open, rawCode, check]);

  const approve = async () => {
    setStep("approving");
    setErr(null);
    try {
      const res = await fetch("/api/auth/qr/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: rawCode }),
        signal: AbortSignal.timeout(25_000),
      });
      const d = (await res.json()) as { ok?: boolean; reason?: "missing" | "used"; error?: string };
      if (!res.ok || !d.ok) {
        setStep("confirm");
        setErr(
          d.reason === "used"
            ? tr("qrApproveUsed")
            : d.reason === "missing"
              ? tr("qrApproveInvalid")
              : d.error ?? tr("qrApproveFailed"),
        );
        return;
      }
      setStep("success");
      closeTimer.current = setTimeout(() => {
        setOpen(false);
        toast({ title: tr("qrApproveSuccess") });
      }, 1200);
    } catch {
      setStep("confirm");
      setErr(tr("qrApproveFailed"));
    }
  };

  const deny = async () => {
    try {
      await fetch("/api/auth/qr/deny", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: rawCode }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      /* deny is idempotent server-side; the request dies with the code anyway */
    }
    setOpen(false);
  };

  const goLogin = () => {
    setOpen(false);
    const top = useNav.getState().top();
    if (top?.kind !== "view" || top.view !== "settings") {
      useNav.getState().push({ kind: "view", view: "settings" });
    }
    // Deep link straight to the account category (#settings/account).
    setTimeout(() => {
      window.location.hash = "#settings/account";
    }, 60);
  };

  const needLogin = !user || authRequired;
  const busy = step === "approving";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && step === "approving") return; // don't slam shut mid-approve
        setOpen(v);
      }}
    >
      <DialogContent className="md-dialog sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-start">
            <LogIn className="h-4.5 w-4.5 text-accent" aria-hidden />
            {tr("qrApproveTitle")}
          </DialogTitle>
          <DialogDescription className="text-start">
            {needLogin ? tr("qrApproveNeedLogin") : tr("qrApproveDesc")}
          </DialogDescription>
        </DialogHeader>

        {step === "success" ? (
          <div
            className="rounded-[var(--md-sys-shape-corner-medium)] bg-[var(--md-sys-color-tertiary-container)] text-[var(--md-sys-color-on-tertiary-container)] p-4 text-center harbor-pop-in"
            role="status"
          >
            <div className="mx-auto mb-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--md-sys-color-tertiary)] text-[var(--md-sys-color-on-tertiary)]">
              <Check className="h-4.5 w-4.5" aria-hidden />
            </div>
            <p className="md-title-small font-semibold">{tr("qrApproveSuccess")}</p>
          </div>
        ) : needLogin ? (
          <div className="space-y-3.5">
            <p className="text-xs text-ink-subtle">
              <RichBidi text={tr("qrApproveNeedLoginDesc")} />
            </p>
            <Button onClick={goLogin} className="md-btn-filled w-full !h-12">
              <LogIn className="w-4 h-4 me-1.5" aria-hidden />
              {tr("qrApproveGoLogin")}
            </Button>
          </div>
        ) : (
          <div className="space-y-3.5">
            {deviceHint === null && (
              <div>
                <label htmlFor="qr-approve-code" className="mb-1.5 block md-label-medium text-ink-muted">
                  {tr("qrCodeLabel")}
                </label>
                <CodeInput
                  id="qr-approve-code"
                  groups={2}
                  value={code}
                  onChange={(v) => {
                    setCode(v);
                    setErr(null);
                  }}
                  onSubmit={() => void check(rawCode)}
                  disabled={step !== "input"}
                  autoFocus
                  ariaLabel={tr("qrApproveEnterCode")}
                />
              </div>
            )}

            {deviceHint !== null && (
              <div className="rounded-[var(--md-sys-shape-corner-small)] border border-edge-soft bg-raised px-3 py-3 text-center">
                <p className="text-[11px] uppercase tracking-wider text-ink-muted">{tr("qrCodeLabel")}</p>
                {deviceHint ? (
                  <p className="mt-1 font-mono text-sm font-semibold text-ink">
                    <Bdi>{deviceHint}</Bdi>
                  </p>
                ) : (
                  <p className="mt-1 font-mono text-sm font-semibold text-ink-muted">—</p>
                )}
              </div>
            )}

            {err && (
              <p className="text-xs text-danger" role="alert">
                <RichBidi text={err} />
              </p>
            )}

            {deviceHint !== null ? (
              <div className="flex gap-2">
                <Button onClick={() => void approve()} disabled={busy} className="md-btn-filled flex-1 !h-12">
                  {busy ? (
                    <Loader2 className="w-4 h-4 me-1.5 animate-spin" aria-hidden />
                  ) : (
                    <Check className="w-4 h-4 me-1.5" aria-hidden />
                  )}
                  {tr("qrApproveConfirm")}
                </Button>
                <Button
                  onClick={() => void deny()}
                  disabled={busy}
                  variant="ghost"
                  className="md-btn-text !h-12 hover:!text-danger"
                >
                  {tr("qrApproveDeny")}
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => void check(rawCode)}
                disabled={rawCode.length !== 6 || step !== "input"}
                className="md-btn-filled w-full !h-12"
              >
                {step === "checking" ? (
                  <Loader2 className="w-4 h-4 me-1.5 animate-spin" aria-hidden />
                ) : (
                  <QrCode className="w-4 h-4 me-1.5" aria-hidden />
                )}
                {step === "checking" ? tr("qrApproveChecking") : tr("qrApproveCheck")}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
