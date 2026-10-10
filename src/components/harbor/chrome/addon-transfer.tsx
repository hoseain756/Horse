"use client";

// Harbor Web — addon transfer codes (device ↔ device)
//
// A device shows a XXX-XXX-XXX code + QR deep link (#transfer=CODE) that
// stands for ALL of its installed addons (sealed server-side, single-use,
// 6-minute TTL). Another device scans/types the code, claims it, and the
// addons are merged NON-destructively into its local set: an addon is added
// only when its manifest id is NOT already installed (existing local wins),
// and fresh tombstones are cleared so the additions survive future syncs.
//
// Both dialogs live here and are mounted ONCE in app-shell:
//   • openTransferSender()     — "Transfer addons" (no auth needed)
//   • openTransferReceiver(c?) — "Receive addons" / #transfer= deep link
import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  ArrowLeftRight,
  Check,
  Copy,
  Loader2,
  QrCode,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import {
  useAddons,
  persistAddons,
  type AddonRecord,
} from "@/lib/harbor/store";
import { clearAddonRemoval } from "@/lib/harbor/tombstones";
import type { Manifest } from "@/lib/harbor/types";
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

// App-shell dispatches these; receiver detail = 9-char code ("" = manual).
const TRANSFER_SEND_EVENT = "harbor:transfer-send";
const TRANSFER_RECEIVE_EVENT = "harbor:transfer-receive";

export function openTransferSender(): void {
  window.dispatchEvent(new CustomEvent(TRANSFER_SEND_EVENT));
}

export function openTransferReceiver(code = ""): void {
  window.dispatchEvent(new CustomEvent(TRANSFER_RECEIVE_EVENT, { detail: code }));
}

/** Wire shape both transfer endpoints speak (manifest validated server-side:
 *  non-empty string id + name; extra manifest fields preserved verbatim). */
type TransferAddonPayload = {
  transportUrl: string;
  enabled: boolean;
  order: number;
  manifest: Manifest;
};

/** Best-effort cancel — the 6-minute TTL cleans abandoned codes up anyway. */
async function cancelTransfer(code: string): Promise<void> {
  try {
    await fetch("/api/transfer/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------- sender ---

function TransferSenderDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { toast } = useToast();
  const tr = useT();

  const [phase, setPhase] = useState<"creating" | "waiting" | "failed">("creating");
  const [code, setCode] = useState("");
  const [displayCode, setDisplayCode] = useState("");
  const [expiresAt, setExpiresAt] = useState(0);
  const [count, setCount] = useState(0);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Create on open (mount-on-open → fresh state each time; phase starts at
  // "creating" from the useState initializer — no setState in the effect).
  // If the dialog closes mid-create, cancel the code the moment it arrives.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const create = async () => {
      try {
        const addons: TransferAddonPayload[] = useAddons.getState().addons.map(
          (a: AddonRecord) => ({
            transportUrl: a.transportUrl,
            enabled: a.enabled,
            order: a.order,
            manifest: a.manifest,
          }),
        );
        if (addons.length === 0) throw new Error("no addons");
        const res = await fetch("/api/transfer/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ addons, senderHint: navigator.userAgent.slice(0, 120) }),
          signal: AbortSignal.timeout(15_000),
        });
        const d = (await res.json()) as {
          code?: string;
          displayCode?: string;
          expiresAt?: number;
          error?: string;
        };
        if (!res.ok || !d.code) throw new Error(d.error ?? "create failed");
        if (cancelled) {
          void cancelTransfer(d.code);
          return;
        }
        setCount(addons.length);
        setCode(d.code);
        setDisplayCode(d.displayCode ?? formatCodeGroups(d.code, 3));
        setExpiresAt(typeof d.expiresAt === "number" ? d.expiresAt : Date.now() + 360_000);
        setPhase("waiting");
      } catch {
        if (!cancelled) setPhase("failed");
      }
    };
    const id = setTimeout(() => void create(), 0);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [open]);

  // QR of the deep link (white plate → scannable on dark skins)
  useEffect(() => {
    if (phase !== "waiting" || !code) {
      setQr(null);
      return;
    }
    let aliveQr = true;
    const url = `${window.location.origin}/#transfer=${code}`;
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

  // Plain close (X / Esc / overlay): the code STAYS LIVE for its TTL so the
  // other device can still claim it after the sender moves on. Cancelling is
  // explicit only — the "Cancel transfer" button (and mid-create abandon).
  const closeAndCancel = (v: boolean) => {
    onOpenChange(v);
  };

  /** The explicit "Cancel transfer" button: kills the code server-side too. */
  const explicitCancel = () => {
    if (code) void cancelTransfer(code);
    onOpenChange(false);
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
      toast({ title: tr("transferCopied") });
    } catch {
      /* clipboard blocked — the code is big on screen anyway */
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) closeAndCancel(false);
      }}
    >
      <DialogContent className="md-dialog max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-start">
            <ArrowLeftRight className="h-4.5 w-4.5 text-accent" aria-hidden />
            {tr("transferSendTitle")}
          </DialogTitle>
          <DialogDescription className="text-start">
            <RichBidi text={tr("transferSendDesc")} />
          </DialogDescription>
        </DialogHeader>

        {phase === "creating" ? (
          <div className="flex items-center justify-center gap-2 py-8 text-xs text-ink-subtle" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {tr("pairStarting")}
          </div>
        ) : phase === "failed" ? (
          <div
            className="rounded-[var(--md-sys-shape-corner-medium)] bg-[var(--md-sys-color-error-container)] text-[var(--md-sys-color-on-error-container)] p-3.5"
            role="alert"
          >
            <p className="flex items-center gap-2 text-sm font-semibold">
              <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />
              <RichBidi text={tr("transferCreateFailed")} />
            </p>
            <div className="mt-2.5 flex gap-2">
              <Button onClick={() => closeAndCancel(false)} className="md-btn-filled !h-9 text-xs">
                {tr("accountCancel")}
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-start gap-4 flex-wrap">
              <div className="min-w-0">
                <p className="md-label-medium text-ink-muted mb-1">{tr("transferEnterCode")}</p>
                <button
                  type="button"
                  onClick={() => void copyCode()}
                  title={tr("transferEnterCode")}
                  className="md-state harbor-tv-focus group flex items-center gap-3 rounded-[28px] bg-[var(--md-sys-color-surface-container-highest)] px-5 py-3.5"
                >
                  <Bdi className="font-mono text-3xl font-bold tracking-[0.18em] text-accent select-all">
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
                <div className="rounded-xl bg-white p-1.5 shadow-lg" title={tr("transferSendTitle")}>
                  <img src={qr} alt={tr("transferSendTitle")} className="h-36 w-36" />
                </div>
              )}
            </div>

            <p className="mt-2.5 text-xs text-ink-subtle">
              <RichBidi text={tr("transferSendCount", { n: tr.num(count) })} />
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-subtle/80" role="status" aria-live="polite">
              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden />
              {tr("transferWaiting")}
            </p>

            <div className="mt-3.5 flex justify-end">
              <Button onClick={explicitCancel} variant="ghost" className="md-btn-text !h-11 px-3 text-xs hover:!text-danger">
                {tr("transferCancel")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// -------------------------------------------------------------- receiver ---

/**
 * Non-destructive merge of claimed addons into the local set, following the
 * cloud-sync bulk pattern: same localStorage key (via the store's own persist
 * helper), dedupe by manifest.id with EXISTING LOCAL WINNING, tombstones
 * cleared for additions so future sync merges don't drop them.
 */
function mergeTransferredAddons(incoming: TransferAddonPayload[]): { added: number; skipped: number } {
  useAddons.getState().load(); // fresh local view (deep links can land before boot effects run)
  const local = useAddons.getState().addons;
  const ids = new Set(local.map((a) => a.manifest.id));
  const additions: AddonRecord[] = [];
  let skipped = 0;
  for (const t of incoming) {
    const id = typeof t?.manifest?.id === "string" ? t.manifest.id : "";
    if (!id || typeof t?.transportUrl !== "string" || !t.transportUrl) {
      skipped += 1;
      continue;
    }
    if (ids.has(id)) {
      skipped += 1; // already installed here → local wins, never overwritten
      continue;
    }
    ids.add(id);
    additions.push({
      manifest: t.manifest,
      transportUrl: t.transportUrl,
      installedAt: Date.now(),
      enabled: t.enabled !== false,
      order: 0,
    });
  }
  if (additions.length > 0) {
    persistAddons([...local, ...additions]); // store helper normalizes order + slims descriptions
    for (const a of additions) clearAddonRemoval(a.manifest.id);
    useAddons.getState().load();
  }
  return { added: additions.length, skipped };
}

function TransferReceiverDialog({
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

  const [code, setCode] = useState(() => formatCodeGroups(initialCode, 3));
  const [claiming, setClaiming] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const autoFor = useRef("");

  const rawCode = code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

  const claim = useCallback(
    async (raw: string) => {
      if (raw.length !== 9) return;
      setClaiming(true);
      setErr(null);
      try {
        const res = await fetch("/api/transfer/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: raw }),
          signal: AbortSignal.timeout(25_000),
        });
        const d = (await res.json()) as {
          ok?: boolean;
          reason?: "missing" | "already";
          addons?: TransferAddonPayload[];
          error?: string;
        };
        if (!res.ok || !d.ok || !Array.isArray(d.addons)) {
          setClaiming(false);
          setErr(
            d.reason === "already"
              ? tr("transferAlready")
              : d.reason === "missing"
                ? tr("transferInvalid")
                : d.error ?? tr("transferFailed"),
          );
          return;
        }
        const { added, skipped } = mergeTransferredAddons(d.addons);
        setClaiming(false);
        if (added > 0) {
          toast({
            title: tr("transferSuccess", { count: tr.num(added) }),
            description:
              skipped > 0
                ? tr("transferPartial", { added: tr.num(added), skipped: tr.num(skipped) })
                : undefined,
          });
        } else {
          toast({
            title: tr("transferPartial", { added: tr.num(added), skipped: tr.num(skipped) }),
          });
        }
        onOpenChange(false);
      } catch {
        setClaiming(false);
        setErr(tr("transferFailed"));
      }
    },
    [onOpenChange, toast, tr],
  );

  // Prefilled (deep link) → auto-submit exactly once per code. An incomplete
  // code re-arms the guard, so retyping the same code re-claims it.
  useEffect(() => {
    if (!open || rawCode.length !== 9) {
      autoFor.current = "";
      return;
    }
    if (claiming || autoFor.current === rawCode) return;
    autoFor.current = rawCode;
    const id = setTimeout(() => void claim(rawCode), 0);
    return () => clearTimeout(id);
  }, [open, claiming, rawCode, claim]);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && claiming) return; // don't slam shut mid-claim
        onOpenChange(v);
      }}
    >
      <DialogContent className="md-dialog max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-start">
            <QrCode className="h-4.5 w-4.5 text-accent" aria-hidden />
            {tr("transferReceiverTitle")}
          </DialogTitle>
          <DialogDescription className="text-start">
            <RichBidi text={tr("transferReceiverDesc")} />
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5">
          <div>
            <label htmlFor="transfer-code-input" className="mb-1.5 block md-label-medium text-ink-muted">
              {tr("transferEnterCode")}
            </label>
            <CodeInput
              id="transfer-code-input"
              groups={3}
              value={code}
              onChange={(v) => {
                setCode(v);
                setErr(null);
              }}
              onSubmit={() => void claim(rawCode)}
              disabled={claiming}
              autoFocus={rawCode.length !== 9}
              ariaLabel={tr("transferEnterCode")}
            />
          </div>

          {err && (
            <p className="text-xs text-danger" role="alert">
              <RichBidi text={err} />
            </p>
          )}

          <Button
            onClick={() => void claim(rawCode)}
            disabled={rawCode.length !== 9 || claiming}
            className="md-btn-filled w-full !h-12"
          >
            {claiming ? (
              <Loader2 className="w-4 h-4 me-1.5 animate-spin" aria-hidden />
            ) : (
              <ArrowLeftRight className="w-4 h-4 me-1.5" aria-hidden />
            )}
            {claiming ? tr("transferClaiming") : tr("transferClaimBtn")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --------------------------------------------------------------- mount ----

/**
 * Mounted ONCE in app-shell (next to ResetPasswordDialog). Both dialogs are
 * mount-on-open, so each open starts from fresh state — same pattern as the
 * pairing receiver.
 */
export function AddonTransferDialogs() {
  const [sendOpen, setSendOpen] = useState(false);
  const [rxOpen, setRxOpen] = useState(false);
  const [rxCode, setRxCode] = useState("");

  useEffect(() => {
    const onSend = () => setSendOpen(true);
    const onRx = (e: Event) => {
      const c = ((e as CustomEvent<string>).detail ?? "").replace(/[^A-Za-z0-9]/gi, "").toUpperCase();
      setRxCode(c);
      setRxOpen(true);
    };
    window.addEventListener(TRANSFER_SEND_EVENT, onSend);
    window.addEventListener(TRANSFER_RECEIVE_EVENT, onRx);
    return () => {
      window.removeEventListener(TRANSFER_SEND_EVENT, onSend);
      window.removeEventListener(TRANSFER_RECEIVE_EVENT, onRx);
    };
  }, []);

  return (
    <>
      {sendOpen && <TransferSenderDialog open onOpenChange={setSendOpen} />}
      {rxOpen && (
        <TransferReceiverDialog
          key={`${rxCode}-${String(rxOpen)}`}
          open
          initialCode={rxCode}
          onOpenChange={setRxOpen}
        />
      )}
    </>
  );
}
