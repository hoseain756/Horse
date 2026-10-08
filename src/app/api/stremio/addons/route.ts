// Harbor Web — Stremio addon collection sync (addonCollectionGet / addonCollectionSet proxies)
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API = "https://api.strem.io/api";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as {
      authKey?: unknown;
      action?: unknown;
      addons?: unknown;
    };
    const authKey = typeof body.authKey === "string" ? body.authKey : "";
    const action = body.action === "set" ? "set" : "get";
    if (!authKey || authKey.length > 512) {
      return NextResponse.json({ error: "missing authKey" }, { status: 400 });
    }

    if (action === "get") {
      const res = await fetch(`${API}/addonCollectionGet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authKey, type: "user", update: false }),
        signal: AbortSignal.timeout(20_000),
      });
      const data = (await res.json()) as {
        result?: { addons?: unknown };
        error?: unknown;
      };
      if (data.error) {
        return NextResponse.json({ error: "addonCollectionGet failed" }, { status: 401 });
      }
      return NextResponse.json({ addons: data.result?.addons ?? [] });
    }

    if (!Array.isArray(body.addons)) {
      return NextResponse.json({ error: "missing addons" }, { status: 400 });
    }
    const res = await fetch(`${API}/addonCollectionSet`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authKey, type: "user", addons: body.addons.slice(0, 100) }),
      signal: AbortSignal.timeout(20_000),
    });
    const data = (await res.json()) as { error?: unknown };
    if (data.error) {
      return NextResponse.json({ error: "addonCollectionSet failed" }, { status: 401 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "addon collection request failed" }, { status: 502 });
  }
}
