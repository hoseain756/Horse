// Harbor Web — PWA support: service worker registration + install prompt capture
"use client";

import { create } from "zustand";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type PwaState = {
  canInstall: boolean;
  installed: boolean;
  swReady: boolean;
  init: () => Promise<void>;
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;

export const usePwa = create<PwaState>((set) => ({
  canInstall: false,
  installed: false,
  swReady: false,

  init: async () => {
    if (typeof window === "undefined") return;

    // Install prompt capture
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e as BeforeInstallPromptEvent;
      set({ canInstall: true });
    };
    const onInstalled = () => {
      deferredPrompt = null;
      set({ canInstall: false, installed: true });
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    if (window.matchMedia("(display-mode: standalone)").matches) {
      set({ installed: true });
    }

    // Service worker: PRODUCTION-ONLY asset cache + offline shell.
    // In dev, Turbopack reuses chunk URLs across edits, so a cache-first SW
    // serves STALE code (documented ops lesson — users literally cannot see new
    // features). In dev we unregister and purge instead, healing any browser
    // that already registered an old SW.
    if ("serviceWorker" in navigator) {
      if (process.env.NODE_ENV === "production") {
        try {
          const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
          await reg.update();
          set({ swReady: true });
        } catch {
          /* SW is a progressive enhancement — ignore failures */
        }
      } else {
        try {
          const regs = await navigator.serviceWorker.getRegistrations();
          for (const r of regs) await r.unregister();
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        } catch {
          /* best-effort cleanup */
        }
      }
    }
  },

  promptInstall: async () => {
    if (!deferredPrompt) return "unavailable";
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        set({ canInstall: false, installed: true });
      }
      deferredPrompt = null;
      return choice.outcome;
    } catch {
      return "unavailable";
    }
  },
}));
