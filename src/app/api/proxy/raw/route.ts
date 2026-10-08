// Harbor Web — raw passthrough proxy (for subtitle text files)
import { NextRequest, NextResponse } from "next/server";
import { MAX_BYTES, proxiedFetch } from "@/lib/harbor/proxy-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { res, upstream } = await proxiedFetch(req);
  if (!upstream) return res;
  try {
    const buf = await upstream.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "response too large" }, { status: 413 });
    }
    return new NextResponse(buf, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=600",
      },
    });
  } catch {
    return NextResponse.json({ error: "upstream read failed" }, { status: 502 });
  }
}
