// Harbor Web — POST /api/debrid/user
// Validates the caller's own debrid API key and returns account info
// {username, premium, expiresAt}. The key is relayed upstream per request
// and never stored or logged server-side. The per-service lookups live in
// debrid-server.ts (shared with the device-pairing claim validation).
import { NextRequest, NextResponse } from "next/server";
import {
  UpstreamError,
  guardDebrid,
  lookupDebridUser,
  validApiKey,
} from "@/lib/harbor/debrid-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!guardDebrid(req, "debrid-user")) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }
  let body: { service?: unknown; apiKey?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (body.service !== "realdebrid" && body.service !== "alldebrid" && body.service !== "torbox") {
    return NextResponse.json({ error: "invalid service (realdebrid | alldebrid | torbox)" }, { status: 400 });
  }
  if (!validApiKey(body.apiKey)) {
    return NextResponse.json({ error: "invalid API key (10-200 characters required)" }, { status: 400 });
  }
  const apiKey = body.apiKey;
  const service = body.service;

  try {
    const result = await lookupDebridUser(service, apiKey);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof UpstreamError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    const message = e instanceof Error ? e.message : "debrid service unreachable";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
