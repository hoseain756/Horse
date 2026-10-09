"use client";

// Harbor Web — Device pairing (big screen ↔ phone)
//
// A big screen (TV / laptop / iPad) shows a short XXX-XXX code + QR deep link
// (#pair=CODE). The phone — which already holds the Debrid API key in its
// localStorage — scans the QR (or types the code), and one tap sends the key
// over. The server is only a relay: the payload is encrypted at rest,
// single-use, deleted the moment the waiting screen picks it up.
//
// Both directions live here:
//   • <DevicePairingCard />  — the pairing surface inside Settings → Debrid
//   • openPairingReceiver()  — app-shell calls this for #pair= deep links
import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  Check,
  Copy,
  Loader2,
  MonitorSmartphone,
  RefreshCw,
  Send,
  Smartphone,
  Square,
  TriangleAlert,
} from "lucide-react";
import { useDebrid, type DebridService, type DebridProfile } from "@/lib/harbor/debrid";
import { useT } from "@/hooks/use-t";
import { useToast } from "@/hooks/use-toast";
import { RichBidi, Bdi } from "../common/bidi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// App-shell dispatches this (detail = 6-char code) when the URL carries #pair=
const PAIR_RECEIVE_EVENT = "harbor:pairing-receive";

export function openPairingReceiver(code: string): void {
  window.dispatchEvent(new CustomEvent(PAIR_RECEIVE_EVENT, { detail: code }));
}

type SenderPhase = "idle" | "creating" | "waiting" | "linked" | "expired";

const SERVICES: readonly (readonly [DebridService, string])[] = [
  ["torbox", "TorBox"],
  ["realdebrid", "Real-Debrid"],
  ["alldebrid", "AllDebrid"],
];

/** "K7Q2XD" → "K7Q-2XD" (Latin-only → safe to render without bidi wrapping). */
function formatCode(raw: string): string {
  const up = raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return up.length > 3 ? `${up.slice(0, 3)}-${up.slice(3)}` : up;
}

// ---------------------------------------------------------------- sender ---

export function DevicePairingCard() {
  const { toast } = useToast();
  const tr = useT();
  const applyLinked = useDebrid((s) => s.applyLinked);

  const [phase, setPhase] = useState<SenderPhase>("idle");
  const [code, setCode] = useState("");
  const [displayCode, setDisplayCode] = useState("");
  const [expiresAt, setExpiresAt] = useState(0);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [linked, setLinked] = useState<{ username: string | null; plan: string } | null>(null);

  // Receiver dialog (phone side) — also opened by the #pair= deep link.
  const [rxOpen, setRxOpen] = useState(false);
  const [rxCode, setRxCode] = useState("");

  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(false);

  const stopPolling = useCallback(() => {
    alive.current = false;
    if (pollTimer.current) clearTimeout(pollTimer.current);
    pollTimer.current = null;
  }, []);

  useEffect(
    () => () => {
      stopPolling();
    },
    [stopPolling],
  );

  // #pair=CODE deep link (phone scanned the TV's QR)
  useEffect(() => {
    const h = (e: Event) => {
      const c = (e as CustomEvent<string>).detail ?? "";
      setRxCode(c);
      setRxOpen(true);
    };
    window.addEventListener(PAIR_RECEIVE_EVENT, h);
    return () => window.removeEventListener(PAIR_RECEIVE_EVENT, h);
  }, []);

  const schedulePoll = useCallback(
    (c: string, exp: number) => {
      pollTimer.current = setTimeout(async () => {
        if (!alive.current) return;
        if (Date.now() >= exp) {
          setPhase("expired");
          return;
        }
        try {
          const res = await fetch(`/api/pairing/status?code=${encodeURIComponent(c)}`, {
            cache: "no-store",
            signal: AbortSignal.timeout(12_000),
          });
          const d = (await res.json()) as {
            status?: string;
            service?: DebridService;
            apiKey?: string;
            username?: string | null;
            premium?: boolean;
            expiresAt?: number | null;
            planName?: string | null;
          };
          if (!alive.current) return;
          if (res.ok && d.status === "linked" && d.apiKey && d.service) {
            applyLinked(d.service, d.apiKey, {
              username: d.username ?? null,
              premium: d.premium === true,
              expiresAt: typeof d.expiresAt === "number" ? d.expiresAt : null,
              planName: d.planName ?? null,
            });
            setLinked({
              username: d.username ?? null,
              plan: d.planName ?? (d.premium ? "Premium" : "Free"),
            });
            setPhase("linked");
            toast({ title: tr("pairLinkedTitle") });
            return;
          }
          if (res.ok && d.status === "missing") {
            setPhase("expired");
            return;
          }
        } catch {
          /* transient network hiccup → keep polling until expiry */
        }
        if (Date.now() >= exp) {
          setPhase("expired");
          return;
        }
        schedulePoll(c, exp);
      }, 2500);
    },
    [applyLinked, toast, tr],
  );

  const start = useCallback(async () => {
    setPhase("creating");
    try {
      const res = await fetch("/api/pairing/create", {
        method: "POST",
        signal: AbortSignal.timeout(15_000),
      });
      const d = (await res.json()) as { code?: string; displayCode?: string; expiresAt?: number; error?: string };
      if (!res.ok || !d.code) throw new Error(d.error ?? "create failed");
      const exp = typeof d.expiresAt === "number" ? d.expiresAt : Date.now() + 600_000;
      alive.current = true;
      setCode(d.code);
      setDisplayCode(d.displayCode ?? formatCode(d.code));
      setExpiresAt(exp);
      setLinked(null);
      setPhase("waiting");
      schedulePoll(d.code, exp);
    } catch {
      setPhase("idle");
      toast({ title: tr("pairFailed") });
    }
  }, [schedulePoll, toast, tr]);

  const cancel = useCallback(async () => {
    stopPolling();
    const c = code;
    setPhase("idle");
    setCode("");
    setQr(null);
    if (c) {
      try {
        await fetch("/api/pairing/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: c }),
          signal: AbortSignal.timeout(10_000),
        });
      } catch {
        /* the 10-min TTL cleans it up anyway */
      }
    }
  }, [code, stopPolling]);

  // QR of the deep link (white plate → scannable on dark TV skins)
  useEffect(() => {
    if (phase !== "waiting" || !code) {
      setQr(null);
      return;
    }
    let aliveQr = true;
    const url = `${window.location.origin}/#pair=${code}`;
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
    } catch {
      /* clipboard blocked — the code is big on screen anyway */
    }
  };

  return (
    <div className="rounded-[var(--md-sys-shape-corner-medium)] border border-edge-soft p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft">
          <MonitorSmartphone className="h-4.5 w-4.5 text-accent" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-ink">{tr("pairCardTitle")}</p>
          <p className="mt-0.5 text-xs text-ink-subtle">
            <RichBidi text={tr("pairCardDesc")} />
          </p>
        </div>
      </div>

      {phase === "idle" || phase === "creating" ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button onClick={() => void start()} disabled={phase === "creating"} className="md-btn-filled">
            {phase === "creating" ? (
              <Loader2 className="w-4 h-4 me-1.5 animate-spin" aria-hidden />
            ) : (
              <Smartphone className="w-4 h-4 me-1.5" aria-hidden />
            )}
            {phase === "creating" ? tr("pairStarting") : tr("pairStart")}
          </Button>
          <Button variant="outline" onClick={() => { setRxCode(""); setRxOpen(true); }} className="md-btn-outlined">
            <Send className="w-4 h-4 me-1.5" aria-hidden />
            {tr("pairReceiveOpen")}
          </Button>
        </div>
      ) : phase === "linked" && linked ? (
        <div
          className="mt-3 rounded-[var(--md-sys-shape-corner-medium)] bg-[var(--md-sys-color-tertiary-container)] text-[var(--md-sys-color-on-tertiary-container)] p-3.5 text-center harbor-pop-in"
          role="status"
        >
          <div className="mx-auto mb-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--md-sys-color-tertiary)] text-[var(--md-sys-color-on-tertiary)]">
            <Check className="h-4.5 w-4.5" aria-hidden />
          </div>
          <p className="md-title-small font-semibold">{tr("pairLinkedTitle")}</p>
          <p className="mt-0.5 text-xs">
            <RichBidi text={tr("pairLinkedDesc", { name: linked.username ?? "Debrid", plan: linked.plan })} />
          </p>
        </div>
      ) : phase === "expired" ? (
        <div className="mt-3 rounded-[var(--md-sys-shape-corner-medium)] bg-[var(--md-sys-color-error-container)] text-[var(--md-sys-color-on-error-container)] p-3.5" role="alert">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <TriangleAlert className="h-4 w-4" aria-hidden />
            <RichBidi text={tr("pairExpired")} />
          </p>
          <div className="mt-2.5 flex gap-2">
            <Button onClick={() => void start()} className="md-btn-filled !h-9 text-xs">
              <RefreshCw className="w-3.5 h-3.5 me-1.5" aria-hidden />
              {tr("pairNewCode")}
            </Button>
            <Button variant="ghost" onClick={() => setPhase("idle")} className="md-btn-text !h-9 text-xs">
              {tr("pairCancel")}
            </Button>
          </div>
        </div>
      ) : (
        // ---- waiting for the phone ----
        <div className="mt-3">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="min-w-0">
              <p className="md-label-medium text-ink-muted mb-1">{tr("pairCodeLabel")}</p>
              <button
                type="button"
                onClick={() => void copyCode()}
                title={tr("pairCodeLabel")}
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
              <PairCountdown expiresAt={expiresAt} />
            </div>

            {qr && (
              <div className="rounded-xl bg-white p-1.5 shadow-lg" title={tr("pairScanTitle")}>
                <img src={qr} alt={tr("pairScanTitle")} className="h-36 w-36" />
              </div>
            )}
          </div>

          <p className="mt-2.5 text-xs text-ink-subtle">
            <RichBidi text={tr("pairScanHint")} />
          </p>

          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1.5 text-xs text-ink-muted" role="status" aria-live="polite">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              {tr("pairWaiting")}
            </span>
            <div className="ms-auto flex gap-2">
              <Button onClick={() => void start()} variant="outline" className="md-btn-tonal !h-9 px-3 text-xs">
                <RefreshCw className="w-3.5 h-3.5 me-1.5" aria-hidden />
                {tr("pairNewCode")}
              </Button>
              <Button onClick={() => void cancel()} variant="ghost" className="md-btn-text !h-9 px-3 text-xs">
                <Square className="w-3.5 h-3.5 me-1.5" aria-hidden />
                {tr("pairCancel")}
              </Button>
            </div>
          </div>
        </div>
      )}

      <p className="mt-3 flex items-start gap-1.5 text-[11px] text-ink-subtle/80">
        <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" aria-hidden />
        <RichBidi text={tr("pairSecurity")} />
      </p>

      {/* Mount-on-open: fresh state per scan, no reset effects needed. */}
      {rxOpen && (
        <PairingReceiverDialog
          key={`${rxCode}-${String(rxOpen)}`}
          open
          initialCode={rxCode}
          onOpenChange={(v) => {
            if (!v) setRxOpen(false);
          }}
        />
      )}
    </div>
  );
}

function PairCountdown({ expiresAt }: { expiresAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);
  const left = Math.max(0, Math.floor((expiresAt - now) / 1000));
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  return (
    <p className="mt-1.5 text-[11px] text-ink-subtle tabular-nums" role="timer">
      <Bdi className={cn("font-semibold", left < 60 && "text-danger")}>{mm}:{ss}</Bdi>
    </p>
  );
}

// -------------------------------------------------------------- receiver ---

/**
 * Phone-side dialog: send THIS device's saved debrid key (or a freshly pasted
 * one) to the screen that shows the code. On success the key is ALSO saved
 * locally — so a phone that had no key yet ends up configured too.
 */
function PairingReceiverDialog({
  open,
  onOpenChange,
  initialCode,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialCode: string;
}) {
  const { toast } = useToast();
  const tr = useT();
  const loaded = useDebrid((s) => s.loaded);
  const load = useDebrid((s) => s.load);
  const savedService = useDebrid((s) => s.service);
  const savedKey = useDebrid((s) => s.apiKey);
  const savedStatus = useDebrid((s) => s.status);
  const savedUsername = useDebrid((s) => s.username);
  const applyLinked = useDebrid((s) => s.applyLinked);

  const [code, setCode] = useState(() => formatCode(initialCode));
  const [svc, setSvc] = useState<DebridService>(savedService);
  const [key, setKey] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ username: string | null; plan: string } | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!loaded) load();
  }, [loaded, load]);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  const hasSaved = savedStatus === "valid" && typeof savedKey === "string" && savedKey.length >= 10;
  const rawCode = code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const ready = rawCode.length === 6 && (hasSaved || key.trim().length >= 10) && !sending;

  const send = async (service: DebridService, apiKey: string) => {
    setSending(true);
    setErr(null);
    try {
      const res = await fetch("/api/pairing/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: rawCode, service, apiKey }),
        signal: AbortSignal.timeout(25_000),
      });
      const d = (await res.json()) as {
        ok?: boolean;
        username?: string | null;
        planName?: string | null;
        premium?: boolean;
        expiresAt?: number | null;
        error?: string;
      };
      if (!res.ok || !d.ok) {
        setErr(
          res.status === 404
            ? tr("pairWrongCode")
            : res.status === 409
              ? tr("pairAlreadyUsed")
              : d.error ?? tr("pairFailed"),
        );
        setSending(false);
        return;
      }
      // Save on THIS device too (no-op when the key was already saved here).
      const profile: DebridProfile = {
        username: d.username ?? null,
        premium: d.premium === true,
        expiresAt: typeof d.expiresAt === "number" ? d.expiresAt : null,
        planName: d.planName ?? null,
      };
      applyLinked(service, apiKey, profile);
      setDone({ username: profile.username, plan: profile.planName ?? (profile.premium ? "Premium" : "Free") });
      toast({ title: tr("pairSent") });
      closeTimer.current = setTimeout(() => onOpenChange(false), 1500);
    } catch (e) {
      setErr(e instanceof Error ? e.message : tr("pairFailed"));
      setSending(false);
    }
  };

  const serviceName = svc === "realdebrid" ? "Real-Debrid" : svc === "alldebrid" ? "AllDebrid" : "TorBox";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!sending) onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-4.5 w-4.5 text-accent" aria-hidden />
            {tr("pairReceiveTitle")}
          </DialogTitle>
          {rawCode.length === 6 && !done && (
            <DialogDescription>
              <RichBidi
                text={tr("pairReceiveDesc", { code: formatCode(rawCode), name: hasSaved ? serviceName : "Debrid" })}
              />
            </DialogDescription>
          )}
          {rawCode.length !== 6 && !done && (
            <DialogDescription>
              <RichBidi text={tr("pairReceiveEnterCode")} />
            </DialogDescription>
          )}
        </DialogHeader>

        {done ? (
          <div
            className="rounded-[var(--md-sys-shape-corner-medium)] bg-[var(--md-sys-color-tertiary-container)] text-[var(--md-sys-color-on-tertiary-container)] p-4 text-center harbor-pop-in"
            role="status"
          >
            <div className="mx-auto mb-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--md-sys-color-tertiary)] text-[var(--md-sys-color-on-tertiary)]">
              <Check className="h-4.5 w-4.5" aria-hidden />
            </div>
            <p className="md-title-small font-semibold">{tr("pairSent")}</p>
            {done.username && (
              <p className="mt-0.5 text-xs">
                <Bdi>@{done.username}</Bdi> · {done.plan}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3.5">
            {/* Screen code — pre-filled by the QR deep link, editable by hand */}
            <div>
              <label className="mb-1.5 block md-label-medium text-ink-muted" htmlFor="pair-code-input">
                {tr("pairReceiveEnterCode")}
              </label>
              <Input
                id="pair-code-input"
                value={code}
                onChange={(e) => setCode(formatCode(e.target.value))}
                placeholder="XXX-XXX"
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                maxLength={7}
                className="md-field-outlined bg-transparent text-center font-mono text-xl tracking-[0.3em] uppercase"
              />
            </div>

            {hasSaved ? (
              <Button onClick={() => void send(savedService, savedKey as string)} disabled={sending} className="md-btn-filled w-full !h-[52px]">
                {sending ? (
                  <Loader2 className="md-btn-icon animate-spin" aria-hidden />
                ) : (
                  <Send className="md-btn-icon" aria-hidden />
                )}
                {sending ? tr("pairSending") : tr("pairReceiveSavedKey")}
                {savedUsername && (
                  <span className="ms-1 opacity-80">
                    (<Bdi>@{savedUsername}</Bdi>)
                  </span>
                )}
              </Button>
            ) : (
              <div className="space-y-2.5">
                <p className="text-xs text-ink-subtle">
                  <RichBidi text={tr("pairReceiveNoKey")} />
                </p>
                <div
                  className="inline-flex rounded-full bg-[var(--md-sys-color-secondary-container)] p-1 w-fit"
                  role="tablist"
                  aria-label="Debrid service"
                >
                  {SERVICES.map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={svc === id}
                      onClick={() => setSvc(id)}
                      className={cn(
                        "md-state harbor-tv-focus rounded-full min-h-9 px-3 py-1 text-xs font-semibold transition-colors",
                        svc === id
                          ? "bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)]"
                          : "text-[var(--md-sys-color-on-secondary-container)]",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <Input
                  type="password"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder={`${serviceName} API key`}
                  autoComplete="off"
                  spellCheck={false}
                  className="md-field-outlined bg-transparent px-3 font-mono text-xs"
                />
                <Button
                  onClick={() => void send(svc, key.trim())}
                  disabled={!ready}
                  className="md-btn-filled w-full !h-[52px]"
                >
                  {sending ? (
                    <Loader2 className="md-btn-icon animate-spin" aria-hidden />
                  ) : (
                    <Send className="md-btn-icon" aria-hidden />
                  )}
                  {sending ? tr("pairSending") : tr("pairSend")}
                </Button>
              </div>
            )}

            {err && (
              <p className="text-xs text-danger" role="alert">
                <RichBidi text={err} />
              </p>
            )}

            <p className="flex items-start gap-1.5 text-[11px] text-ink-subtle/80">
              <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" aria-hidden />
              <RichBidi text={tr("pairSecurity")} />
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
