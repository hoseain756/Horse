/*
 * Horse — service worker
 * Progressive enhancement: offline app shell + static asset caching.
 * Never caches API responses (/api/*) or cross-origin media.
 */
const CACHE = "harbor-web-v4"; // v4: rebrand assets (horse icon + manifest)
const PRECACHE = ["/", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Static build assets: cache-first (immutable, hashed)
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/icon.svg" ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ??
          fetch(req)
            .then((res) => {
              if (res.ok) {
                const clone = res.clone();
                caches.open(CACHE).then((c) => c.put(req, clone));
              }
              return res;
            })
            .catch(() => new Response("", { status: 504 })),
      ),
    );
    return;
  }

  // App shell / navigation: network-first, fall back to cached HTML shell.
  // NOTE: navigations only — RSC flight requests (text/x-component) must never be
  // cached under "/" or they'd poison the offline shell (previously did — fixed).
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const ct = res.headers.get("content-type") ?? "";
          if (res.ok && ct.includes("text/html")) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put("/", clone));
          }
          return res;
        })
        .catch(() =>
          caches.match("/").then((hit) => {
            const ct = hit?.headers.get("content-type") ?? "";
            if (hit && ct.includes("text/html")) return hit;
            return new Response("Offline", { status: 503 });
          }),
        ),
    );
  }
});
