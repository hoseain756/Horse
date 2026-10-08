// Harbor Web — SSRF-safe JSON addon proxy
import { NextRequest, NextResponse } from "next/server";
import { MAX_BYTES, proxiedFetch } from "@/lib/harbor/proxy-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { res, upstream } = await proxiedFetch(req);
  if (!upstream) return res;
  try {
    const text = await upstream.text();
    if (Buffer.byteLength(text) > MAX_BYTES) {
      return NextResponse.json({ error: "response too large" }, { status: 413 });
    }
    const json = JSON.parse(text) as unknown;
    return NextResponse.json(json, {
      status: upstream.status === 200 ? 200 : upstream.status,
      headers: { "Cache-Control": "public, max-age=120" },
    });
  } catch {
    return NextResponse.json(
      { error: "invalid json from upstream", status: upstream.status },
      { status: 502 },
    );
  }
}
