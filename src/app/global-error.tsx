"use client";

/**
 * GlobalError — the app's last-resort crash screen (replaces Next.js's dead-end
 * "Application error: a client-side exception has occurred" page).
 *
 * Why it exists: after a deploy, a browser that boots from a stale cached shell
 * can run old code that requests hashed chunks which no longer exist — the
 * import fails and the app crashes before the in-app recovery component ever
 * hydrates. Until now users were stranded on the default error page with no
 * way out short of clearing site data manually.
 *
 * This screen is deliberately dependency-free: it renders with inline styles
 * only (no Tailwind, no fonts, no image assets) so it always paints, even when
 * the stylesheet itself failed to load.
 *
 * Recovery paths, in order:
 *  1. Auto — chunk-shaped failures trigger a guarded one-shot self-heal
 *     (purge Cache Storage, unregister service workers, hard reload).
 *  2. Manual — "Try again" reloads the app.
 *  3. Nuclear — "Reset app data" wipes localStorage/sessionStorage + caches
 *     + service workers, then reloads (two-tap confirm to avoid accidents).
 */

import { useCallback, useEffect, useRef, useState } from "react";

const RELOAD_WINDOW_MS = 20_000;
const RELOAD_KEY = "horse.chunkrecovery.at";

const CHUNK_ERROR_RE =
  /ChunkLoadError|Loading chunk \d+ failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|dynamically imported module.*mimetype|Failed to load resource/i;

function isChunkShaped(message: string): boolean {
  return CHUNK_ERROR_RE.test(message);
}

async function purgeWorkersAndCaches(): Promise<void> {
  try {
    if (typeof caches !== "undefined" && caches.keys) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* ignore */
  }
  try {
    if (navigator.serviceWorker?.getRegistrations) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch {
    /* ignore */
  }
}

/** One-shot guarded self-heal: purge + reload. Safe against reload loops. */
function healAndReload(): void {
  let guarded = true;
  try {
    const last = Number(window.sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Number.isFinite(last) && Date.now() - last < RELOAD_WINDOW_MS) guarded = false;
    else window.sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    /* private mode — no loop guard, proceed */
  }
  if (!guarded) return;
  window.setTimeout(() => {
    void purgeWorkersAndCaches().then(() => {
      window.setTimeout(() => window.location.reload(), 120);
    });
  }, 60);
}

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [confirmReset, setConfirmReset] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto path: chunk-shaped crashes self-heal without any user action.
  useEffect(() => {
    if (error?.message && isChunkShaped(error.message)) healAndReload();
  }, [error]);

  useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  const handleRetry = useCallback(() => {
    window.location.reload();
  }, []);

  const handleReset = useCallback(() => {
    if (!confirmReset) {
      setConfirmReset(true);
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setConfirmReset(false), 4000);
      return;
    }
    try {
      window.localStorage.clear();
    } catch {
      /* ignore */
    }
    try {
      window.sessionStorage.clear();
    } catch {
      /* ignore */
    }
    void purgeWorkersAndCaches().then(() => {
      window.setTimeout(() => window.location.reload(), 120);
    });
  }, [confirmReset]);

  const message = error?.message || "Unknown client-side exception";

  return (
    <html lang="ar" dir="rtl">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#050505",
          color: "#f5f2ee",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Tahoma, 'Noto Sans Arabic', 'Helvetica Neue', Arial, sans-serif",
          padding: "24px",
          boxSizing: "border-box",
        }}
      >
        <main
          style={{
            width: "100%",
            maxWidth: "460px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "18px",
          }}
        >
          {/* Warning glyph — plain inline SVG, no assets required */}
          <svg
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#e8a468"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>

          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 700, lineHeight: 1.4 }}>
            حدث خطأ غير متوقع
            <span dir="ltr" style={{ display: "block", fontSize: "14px", fontWeight: 500, color: "#b9b3ac", marginTop: "4px" }}>
              Unexpected error
            </span>
          </h1>

          <p style={{ margin: 0, fontSize: "15px", lineHeight: 1.9, color: "#cfc9c2" }}>
            تعذّر تشغيل التطبيق بالكامل. السبب غالبًا نسخة قديمة مخزّنة من التطبيق بعد تحديث.
            جرّب إعادة المحاولة أولاً — وإذا تكرّرت المشكلة استخدم إعادة التعيين.
            <span dir="ltr" style={{ display: "block", fontSize: "12.5px", color: "#8f8a84", marginTop: "8px" }}>
              The app failed to fully start, usually due to a stale cached copy after an update.
              Try again first — if it keeps happening, use the reset option.
            </span>
          </p>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              width: "100%",
              maxWidth: "320px",
            }}
          >
            <button
              type="button"
              onClick={handleRetry}
              style={{
                appearance: "none",
                border: "none",
                borderRadius: "999px",
                padding: "13px 20px",
                minHeight: "48px",
                background: "#e8a468",
                color: "#1c1206",
                fontSize: "15px",
                fontWeight: 700,
                cursor: "pointer",
                width: "100%",
              }}
            >
              إعادة المحاولة
              <span dir="ltr" style={{ display: "block", fontSize: "11.5px", fontWeight: 500, opacity: 0.75 }}>
                Try again
              </span>
            </button>

            <button
              type="button"
              onClick={handleReset}
              aria-live="polite"
              style={{
                appearance: "none",
                borderRadius: "999px",
                padding: "13px 20px",
                minHeight: "48px",
                background: confirmReset ? "#7a2e2e" : "transparent",
                border: confirmReset ? "1px solid #a84444" : "1px solid #3a3631",
                color: confirmReset ? "#ffd9d9" : "#d8d3cc",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
                width: "100%",
              }}
            >
              {confirmReset ? (
                <>
                  اضغط مجددًا لتأكيد مسح البيانات
                  <span dir="ltr" style={{ display: "block", fontSize: "11px", opacity: 0.75 }}>
                    Tap again to confirm reset
                  </span>
                </>
              ) : (
                <>
                  إعادة تعيين التطبيق ومسح البيانات
                  <span dir="ltr" style={{ display: "block", fontSize: "11px", fontWeight: 500, opacity: 0.6 }}>
                    Reset app &amp; clear data
                  </span>
                </>
              )}
            </button>
          </div>

          <details
            style={{
              width: "100%",
              maxWidth: "380px",
              textAlign: "start",
              fontSize: "12px",
              color: "#8f8a84",
            }}
          >
            <summary style={{ cursor: "pointer", textAlign: "center", marginBottom: "8px" }}>
              التفاصيل التقنية · <span dir="ltr">Technical details</span>
            </summary>
            <pre
              dir="ltr"
              style={{
                margin: 0,
                padding: "10px 12px",
                borderRadius: "10px",
                background: "#111010",
                border: "1px solid #262421",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                fontSize: "11px",
                lineHeight: 1.6,
                color: "#a8a29b",
                maxHeight: "160px",
                overflowY: "auto",
              }}
            >
              {message}
              {error?.digest ? `\n\ndigest: ${error.digest}` : ""}
            </pre>
          </details>
        </main>
      </body>
    </html>
  );
}
