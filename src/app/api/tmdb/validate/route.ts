// Harbor Web — TMDB key validation (Settings → Integrations live feedback)
// POST { key } → tries TMDB /configuration with the provided credential and
// reports success/kind or a clear error. Never persists anything.
import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/harbor/proxy-core";
import { parseUserKey } from "@/lib/harbor/tmdb-server";

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (!rateLimit(`${ip}:tmdb-validate`, 10, 60_000)) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }
  let key = "";
  try {
    const body = (await req.json()) as { key?: unknown };
    if (typeof body.key === "string") key = body.key;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid body" }, { status: 400 });
  }
  const creds = parseUserKey(key);
  if (!creds) {
    return NextResponse.json({
      ok: false,
      error:
        "That doesn't look like a TMDB key. A v3 API key is 32 hex characters; a v4 Read Access Token starts with “ey”.",
    });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const url = new URL("https://api.themoviedb.org/3/configuration");
    if (creds.kind === "v3") url.searchParams.set("api_key", creds.key);
    const res = await fetch(url.toString(), {
      headers:
        creds.kind === "v4"
          ? { Authorization: `Bearer ${creds.token}`, Accept: "application/json" }
          : { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (res.ok) {
      const body = (await res.json().catch(() => null)) as { images?: { secure_base_url?: string } } | null;
      return NextResponse.json({
        ok: true,
        kind: creds.kind,
        imagesBase: body?.images?.secure_base_url ?? "https://image.tmdb.org/t/p/",
      });
    }
    if (res.status === 401) {
      return NextResponse.json({ ok: false, error: "TMDB rejected this key (401 unauthorized)." });
    }
    return NextResponse.json({ ok: false, error: `TMDB responded ${res.status}. Try again in a moment.` });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error && e.message.includes("abort") ? "Validation timed out." : "Could not reach TMDB.",
    });
  } finally {
    clearTimeout(timer);
  }
}
