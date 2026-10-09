// Absolute app URL resolution per environment — works on Vercel Production,
// Preview (each has its own deployment URL) and local dev, with an optional
// APP_URL override (e.g. a custom domain) that wins when set.
import type { NextRequest } from "next/server";

export function getAppUrl(req: NextRequest): string {
  const override = process.env.APP_URL?.trim().replace(/\/+$/, "");
  if (override) return override;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
