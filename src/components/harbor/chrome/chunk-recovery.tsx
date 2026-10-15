"use client";

/**
 * ChunkRecovery — last-resort auto-recovery for stale-deploy chunk failures.
 *
 * Background: after every deployment the server's hashed chunk set changes.
 * A browser that boots from a cached/offline app shell (service worker
 * fallback, PWA standalone restore, flaky mobile network) can end up running
 * OLD code that later requests a lazy chunk which no longer exists on the
 * server — the import fails and Next.js surfaces the uncaught error as the
 * full-screen "Application error: a client-side exception has occurred" page.
 *
 * Recovery: detect chunk-load-shaped failures and hard-reload ONCE per
 * 20-second window. The reload boots network-first, so a working connection
 * lands on the fresh deploy and the error is gone. The time-window guard
 * keeps this from ever becoming a reload loop on genuinely broken networks.
 *
 * Mounted in the root layout (outside the app shell) so it hydrates even when
 * a shell-level chunk is the one that failed on a LATER navigation.
 */

const RELOAD_WINDOW_MS = 20_000;
const RELOAD_KEY = "horse.chunkrecovery.at";

const CHUNK_ERROR_PATTERNS: RegExp[] = [
  /ChunkLoadError/i,
  /Loading chunk \d+ failed/i,
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,
  /dynamically imported module.*mimetype/i,
];

function isChunkLoadError(message: string): boolean {
  return CHUNK_ERROR_PATTERNS.some((re) => re.test(message));
}

function recover(message: string): void {
  if (!isChunkLoadError(message)) return;
  try {
    const last = Number(window.sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Number.isFinite(last) && Date.now() - last < RELOAD_WINDOW_MS) return;
    window.sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    /* sessionStorage unavailable (private mode) — proceed without loop guard */
  }
  // Small delay so browser logging/error reporting still fires.
  window.setTimeout(() => window.location.reload(), 120);
}

export default function ChunkRecovery() {
  if (typeof window !== "undefined") {
    const w = window as typeof window & { __horseChunkRecovery?: boolean };
    if (!w.__horseChunkRecovery) {
      w.__horseChunkRecovery = true;
      window.addEventListener(
        "error",
        (e) => {
          const msg =
            (e as ErrorEvent).message ||
            (e.target && e.target !== window
              ? `Failed to load resource: ${(e.target as HTMLScriptElement).src ?? ""}`
              : "");
          if (msg) recover(msg);
        },
        true,
      );
      window.addEventListener("unhandledrejection", (e) => {
        const reason = (e as PromiseRejectionEvent).reason;
        const msg =
          reason instanceof Error
            ? reason.message
            : typeof reason === "string"
              ? reason
              : "";
        if (msg) recover(msg);
      });
    }
  }
  return null;
}
