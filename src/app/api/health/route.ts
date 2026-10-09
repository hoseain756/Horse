// GET /api/health — deployment diagnostics. Shows WHICH database backend is
// live (remote libsql:// vs ephemeral local file) and whether the schema is
// reachable. No secrets — only the host portion of the URL.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureDb } from "@/lib/ensure-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const url = process.env.HORSE_DATABASE_URL?.trim() || "";
  const isRemote = /^(libsql|https?):/i.test(url);
  let host = "unset";
  if (url) {
    try {
      host = new URL(url).host || (isRemote ? url.split("//")[1] ?? "remote" : "local-file");
    } catch {
      host = isRemote ? "remote (unparsed)" : "local-file";
    }
  }
  let ok = true;
  let error: string | null = null;
  let tables = 0;
  try {
    await ensureDb();
    const rows = (await db.$queryRawUnsafe<{ name: string }[]>(
      "SELECT name FROM sqlite_master WHERE type='table'",
    )) as { name: string }[];
    tables = rows.length;
  } catch (e) {
    ok = false;
    error = e instanceof Error ? e.message : String(e);
  }
  return NextResponse.json(
    {
      ok,
      mode: isRemote ? "remote" : "ephemeral-file",
      host,
      tables,
      hasAuthToken: isRemote ? !!process.env.HORSE_DB_AUTH_TOKEN?.trim() : undefined,
      error,
      time: new Date().toISOString(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
