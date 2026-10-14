// Security middleware: security headers on every response + CSRF protection
// (Origin / Sec-Fetch-Site verification) for all state-changing API requests.
// Edge-safe by design (header/string checks only — no DB, no secrets).
import { NextRequest, NextResponse } from "next/server";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function csrfViolation(req: NextRequest): boolean {
  if (!MUTATING.has(req.method)) return false;
  const site = req.headers.get("sec-fetch-site");
  // Browsers (Chrome/Firefox/Safari/Samsung Internet, Chromium 76+) always
  // attach Sec-Fetch-* to fetch/XHR and JS cannot forge them — trust the
  // browser's own verdict FIRST and stop there. We deliberately do NOT also
  // compare Origin against Host here: behind host-rewriting proxies (this
  // sandbox's preview domain, tunnels) the internal Host header rarely
  // equals the public Origin host, which 403'd every real-browser POST
  // (e.g. the Trakt OAuth relay) while curl/agent tests silently passed.
  if (site) {
    return site !== "same-origin" && site !== "same-site" && site !== "none";
  }
  // No Sec-Fetch-Site → legacy browser or non-browser client (native apps,
  // curl). Fall back to an Origin/Host comparison across every host alias
  // the proxy chain may expose.
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    const o = new URL(origin);
    const hosts = [
      req.headers.get("x-forwarded-host"),
      req.headers.get("host"),
    ]
      .filter((h): h is string => typeof h === "string" && h.length > 0)
      .flatMap((h) => h.split(","))
      .map((h) => h.trim().toLowerCase());
    if (hosts.length === 0) return false;
    return !hosts.includes(o.host.toLowerCase());
  } catch {
    return true;
  }
}

export function middleware(req: NextRequest): NextResponse {
  if (csrfViolation(req)) {
    return NextResponse.json({ error: "blocked (cross-site request)" }, { status: 403 });
  }
  const res = NextResponse.next();
  const csp = [
    "default-src 'self'",
    "img-src 'self' data: blob: https: http:",
    "media-src 'self' data: blob: https: http:",
    "connect-src 'self' *", // addon catalogs/streams are user-supplied remote hosts
    "style-src 'self' 'unsafe-inline'", // Next injects inline styles
    // cdn.jsdelivr.net + unpkg.com: the in-browser torrent engine (WebTorrent)
    // is loaded on demand from its official CDN bundle — zero bundle-weight
    // for users who never enable it, and no node polyfill maze for the bundler.
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com" + (process.env.NODE_ENV !== "production" ? " 'unsafe-eval'" : ""),
    "font-src 'self' data:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env.NODE_ENV === "production") {
    res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon-64.png|icon.svg|apple-touch-icon.png|sw.js|manifest.webmanifest).*)"],
};
