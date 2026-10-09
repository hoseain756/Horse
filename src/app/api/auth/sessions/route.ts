// GET /api/auth/sessions — device/session list for the signed-in user
// (Settings > Account > Devices). Never exposes tokens or raw IPs.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureDb } from "@/lib/ensure-db";
import { resolveSession } from "@/lib/harbor/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  await ensureDb();
  const session = await resolveSession(req);
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  try {
    const rows = await db.session.findMany({
      where: { uid: session.uid },
      orderBy: { lastSeenAt: "desc" },
      select: { id: true, uaSummary: true, createdAt: true, lastSeenAt: true },
    });
    return NextResponse.json({
      ok: true,
      currentId: session.id,
      devices: rows.map((r) => ({
        id: r.id,
        device: r.uaSummary ?? "Unknown device",
        createdAt: r.createdAt.toISOString(),
        lastSeenAt: r.lastSeenAt.toISOString(),
        current: r.id === session.id,
      })),
    });
  } catch (e) {
    console.error("sessions list failed", e);
    return NextResponse.json({ error: "Could not load sessions." }, { status: 500 });
  }
}
