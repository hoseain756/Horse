// Harbor Web — Stremio account login (server-side to avoid browser CORS)
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API = "https://api.strem.io/api";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as { email?: unknown; password?: unknown };
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!email || !password || email.length > 254 || password.length > 512) {
      return NextResponse.json({ error: "invalid credentials format" }, { status: 400 });
    }
    const res = await fetch(`${API}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, facebook: false }),
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await res.json()) as {
      error?: { message?: string } | null;
      result?: { authKey?: string; user?: unknown };
    };
    if (data.error || !data.result?.authKey) {
      return NextResponse.json(
        { error: data.error?.message ?? "login failed" },
        { status: 401 },
      );
    }
    // Never log authKey
    return NextResponse.json({
      authKey: data.result.authKey,
      user: data.result.user ?? null,
    });
  } catch {
    return NextResponse.json({ error: "login request failed" }, { status: 502 });
  }
}
