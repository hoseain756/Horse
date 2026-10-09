// Security middleware: security headers on every response + CSRF protection
// (Origin / Sec-Fetch-Site verification) for all state-changing API requests.
// Edge-safe by design (header/string checks only — no DB, no secrets).
import { NextRequest, NextResponse } from "next/server";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function csrfViolation(req: NextRequest): boolean {
  if (!MUTATING.has(req.method)) return false;
  const site = req.headers.get("sec-fetch-site");
  // Browsers on modern Chrome/Firefox/Safari send Sec-Fetch-* — trust it.
  if (site && site !== "same-origin" && site !== "same-site" && site !== "none") return true;
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      const o = new URL(origin);
      const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
      if (host && o.host !== host) return true;
    } catch {
      return true;
    }
  }
  return false;
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
    "script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV !== "production" ? " 'unsafe-eval'" : ""),
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
