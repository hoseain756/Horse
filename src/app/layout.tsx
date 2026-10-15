import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import ChunkRecovery from "@/components/harbor/chrome/chunk-recovery";

export const metadata: Metadata = {
  title: "Horse — A Stremio Client Built for Adventure",
  description:
    "Horse is an open-source media center and client for the Stremio addon protocol. Bring your own addons: catalogs, streams, subtitles. A faithful web port of the Harbor desktop app.",
  keywords: [
    "Horse",
    "Stremio",
    "addon protocol",
    "media center",
    "streaming",
    "open source",
  ],
  authors: [{ name: "Horse" }],
  robots: { index: true, follow: true },
  icons: {
    icon: [
      { url: "/favicon-64.png", type: "image/png", sizes: "64x64" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

/**
 * Boot guard — raw, pre-React crash recovery. Runs from the HTML shell before
 * any framework chunk executes, so it still fires when the bootstrap chunk
 * itself fails (the exact stale-shell-after-deploy scenario where the in-app
 * ChunkRecovery component can never hydrate).
 *
 * Detection: failed sub-resources whose URL is a build asset (/next/static/)
 * or classic chunk-load exception messages. Reaction (one-shot per 20s):
 * purge Cache Storage, unregister service workers, hard reload — after which
 * the network-first SW delivers a fresh, self-consistent shell.
 *
 * Sets window.__horseChunkRecovery so the React-level ChunkRecovery stays
 * dormant (this guard supersedes it; both share the same reload guard key).
 */
const BOOT_GUARD_SCRIPT = `(function(){
if(window.__horseChunkRecovery)return;window.__horseChunkRecovery=1;
var K="horse.chunkrecovery.at",W=20000;
function chunky(m){return /ChunkLoadError|Loading chunk \\d+ failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|dynamically imported module.*mimetype/i.test(m||"")}
function heal(){
try{var l=Number(sessionStorage.getItem(K)||0);if(Date.now()-l<W)return;sessionStorage.setItem(K,String(Date.now()))}catch(_){}
setTimeout(function(){
try{if(window.caches&&caches.keys)caches.keys().then(function(ks){ks.forEach(function(k){caches.delete(k)})})}catch(_){}
try{if(navigator.serviceWorker&&navigator.serviceWorker.getRegistrations)navigator.serviceWorker.getRegistrations().then(function(rs){rs.forEach(function(r){r.unregister()})})}catch(_){}
setTimeout(function(){try{window.location.reload()}catch(_){}},150);
},80);
}
window.addEventListener("error",function(e){
var t=e&&e.target;
if(t&&t!==window){
var u=(t.src||t.href||"");
if(u.indexOf("/_next/static/")!==-1){heal();return}
}
if(e&&e.message&&chunky(e.message))heal();
},true);
window.addEventListener("unhandledrejection",function(e){
var r=e&&e.reason;var m=(r&&r.message)||(typeof r==="string"?r:"");
if(chunky(m))heal();
});
})();`;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Hero is full-bleed under the status bar (installed PWA mode); black theme
  // color per the Home design spec (OLED black).
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased bg-canvas text-ink" style={{ fontFamily: "var(--font-sans-var)" }}>
        <script dangerouslySetInnerHTML={{ __html: BOOT_GUARD_SCRIPT }} />
        {children}
        <ChunkRecovery />
        <Toaster />
      </body>
    </html>
  );
}
