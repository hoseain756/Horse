// Harbor Web — Stremio cloud library sync (datastoreGet / datastorePut proxies)
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API = "https://api.strem.io/api";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as {
      authKey?: unknown;
      action?: unknown;
      changes?: unknown;
    };
    const authKey = typeof body.authKey === "string" ? body.authKey : "";
    const action = body.action === "put" ? "put" : "get";
    if (!authKey || authKey.length > 512) {
      return NextResponse.json({ error: "missing authKey" }, { status: 400 });
    }

    if (action === "get") {
      const res = await fetch(`${API}/datastoreGet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authKey,
          collection: "libraryItem",
          ids: [],
          all: true,
        }),
        signal: AbortSignal.timeout(20_000),
      });
      const data = (await res.json()) as { result?: unknown; error?: unknown };
      if (data.error) {
        return NextResponse.json({ error: "datastoreGet failed" }, { status: 401 });
      }
      return NextResponse.json({ result: data.result ?? [] });
    }

    // put
    if (!Array.isArray(body.changes)) {
      return NextResponse.json({ error: "missing changes" }, { status: 400 });
    }
    const changes = body.changes.slice(0, 100);
    const res = await fetch(`${API}/datastorePut`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authKey, collection: "libraryItem", changes }),
      signal: AbortSignal.timeout(20_000),
    });
    const data = (await res.json()) as { error?: unknown };
    if (data.error) {
      return NextResponse.json({ error: "datastorePut failed" }, { status: 401 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "library request failed" }, { status: 502 });
  }
}
