"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type Phase = "relaying" | "ok" | "denied" | "error";

/**
 * Trakt OAuth return handler (root query branch).
 *
 * When the user approves the link on trakt.tv, Trakt redirects the browser
 * back to the registered HTTPS redirect URI — this page — with
 * `?code=…&state=…` (or `?error=…` on denial). This bridge relays the pair
 * to /api/trakt/relay so the Noor app — which polls that endpoint — can
 * finish the PKCE exchange (the code_verifier never leaves the app), then
 * shows a confirmation card telling the user to return to the app.
 *
 * Normal visits (no OAuth query params) render nothing at all.
 */
export function TraktCallbackBridge() {
  const [phase, setPhase] = useState<Phase | null>(null);
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let alive = true;

    void (async () => {
      // Yield before touching state so nothing is set synchronously inside
      // the effect body (avoids cascading renders).
      await Promise.resolve();

      const params = new URLSearchParams(window.location.search);
      const error = params.get("error");
      const state = params.get("state") ?? "";
      const authCode = params.get("code") ?? "";

      if (!error && !authCode) return; // ordinary app visit — stay invisible

      // Clean the address bar immediately so refreshes/re-shares don't
      // replay the OAuth payload (the code is single-use anyway).
      try {
        window.history.replaceState(null, "", window.location.pathname);
      } catch {
        /* older browsers — harmless */
      }

      if (!alive) return;
      if (error) {
        setPhase("denied");
        return;
      }

      setCode(authCode);
      setPhase("relaying");
      // Primary: POST the pair to the relay. Some proxy chains mangle or
      // challenge browser POSTs (WAF/CSRF layers), so on any failure fall
      // back to a GET push — the auth code alone is useless without the
      // code_verifier that never leaves the app (RFC 7636), and it is
      // single-use with a short lifetime, so the URL exposure is safe.
      let ok = false;
      try {
        const res = await fetch("/api/trakt/relay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state, code: authCode }),
        });
        ok = res.ok;
      } catch {
        ok = false;
      }
      if (!ok) {
        try {
          const res = await fetch(
            `/api/trakt/relay?state=${encodeURIComponent(state)}&code=${encodeURIComponent(authCode)}`,
          );
          ok = res.ok;
        } catch {
          ok = false;
        }
      }
      if (alive) setPhase(ok ? "ok" : "error");
    })();

    return () => {
      alive = false;
    };
  }, []);

  if (!phase) return null;

  const headline =
    phase === "ok"
      ? "تم ربط Trakt بنجاح"
      : phase === "relaying"
        ? "جارٍ استلام تفويض Trakt…"
        : phase === "denied"
          ? "تم رفض التفويض في Trakt"
          : "تعذر إيصال التفويض إلى التطبيق";

  const bodyText =
    phase === "ok"
      ? "يمكنك الآن العودة إلى تطبيق Noor — سيكتمل الربط هناك تلقائيًا خلال ثوانٍ."
      : phase === "relaying"
        ? "لحظة واحدة — يتم الآن تمرير رمز التفويض إلى تطبيق Noor."
        : phase === "denied"
          ? "لم تتم الموافقة على ربط التطبيق. يمكنك إعادة المحاولة من تطبيق Noor في أي وقت."
          : "انسخ رمز التفويض أدناه وأعد محاولة الربط من تطبيق Noor، أو تأكد من اتصالك بالإنترنت.";

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Trakt authorization status"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
        <button
          type="button"
          aria-label="إغلاق"
          onClick={() => setPhase(null)}
          className="absolute left-3 top-3 rounded-full p-1.5 text-zinc-500 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center gap-3 text-center">
          {phase === "ok" ? (
            <CheckCircle2 className="h-12 w-12 text-emerald-400" />
          ) : phase === "relaying" ? (
            <span className="h-12 w-12 animate-spin rounded-full border-2 border-amber-400/30 border-t-amber-400" />
          ) : (
            <AlertTriangle
              className={`h-12 w-12 ${phase === "denied" ? "text-amber-400" : "text-red-400"}`}
            />
          )}
          <h2 className="text-lg font-bold text-white">{headline}</h2>
          <p className="text-sm leading-relaxed text-zinc-400">{bodyText}</p>

          {(phase === "ok" || phase === "error") && code && (
            <div className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 p-3">
              <div className="mb-1 text-[11px] font-medium text-zinc-500">
                رمز التفويض (للنسخ اليدوي عند الحاجة)
              </div>
              <div className="flex items-center gap-2">
                <code
                  dir="ltr"
                  className="min-w-0 flex-1 truncate rounded bg-white/5 px-2 py-1 text-left font-mono text-xs text-amber-300"
                >
                  {code}
                </code>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 shrink-0 gap-1 px-2 text-xs"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(code);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    } catch {
                      /* clipboard blocked — the code stays selectable */
                    }
                  }}
                >
                  {copied ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  {copied ? "تم النسخ" : "نسخ"}
                </Button>
              </div>
            </div>
          )}

          {phase === "ok" && (
            <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
              <ExternalLink className="h-3 w-3" />
              عد إلى تطبيق Noor لإكمال الربط
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
