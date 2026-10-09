// GET /api/health — deployment diagnostics. Shows WHICH database backend is
// live (Supabase Postgres pooler vs unset) and whether the schema is
// reachable. No secrets — only the host portion of the URL.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const url = process.env.POSTGRES_URL?.trim() || "";
  let host = "unset";
  if (url) {
    try {
      host = new URL(url).host || "unparsed";
    } catch {
      host = "unparsed";
    }
  }
  let ok = true;
  let error: string | null = null;
  let tables = 0;
  let rlsEnabled = 0;
  try {
    const rows = (await db.$queryRawUnsafe<{ count: bigint }[]>(
      'SELECT count(*)::bigint AS count FROM pg_tables WHERE schemaname = \'public\'',
    )) as { count: bigint }[];
    tables = Number(rows[0]?.count ?? 0);
    // RLS verification: every public table must be row-security enabled
    // (deny-by-default for the exposed anon/authenticated PostgREST roles).
    const rls = (await db.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT count(*)::bigint AS count FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = true`,
    )) as { count: bigint }[];
    rlsEnabled = Number(rls[0]?.count ?? 0);
  } catch (e) {
    ok = false;
    error = e instanceof Error ? e.message : String(e);
  }
  return NextResponse.json(
    {
      ok,
      mode: url ? "postgres-pooler" : "unset",
      host,
      tables,
      rlsTables: rlsEnabled,
      hasMigrationsUrl: !!process.env.POSTGRES_URL_NON_POOLING?.trim(),
      error,
      time: new Date().toISOString(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
