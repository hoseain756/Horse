// Harbor Web — Prisma client over the Supabase Postgres connection.
//
// Backend contract (operator rules — keep in one place, this file):
//   • POSTGRES_URL             → Supabase TRANSACTION pooler (port 6543).
//                                The running app connects ONLY through this.
//                                PgBouncer in transaction mode forbids server-
//                                side prepared statements, so the pg adapter
//                                is created with `prepare: false`.
//   • POSTGRES_URL_NON_POOLING → session pooler / direct (port 5432). Used by
//                                PRISMA MIGRATIONS ONLY (directUrl in
//                                prisma/schema.prisma → `prisma migrate
//                                deploy` in the build step / CI). Never at
//                                request time.
//   • Supabase is a plain Postgres host: no Supabase Auth, no client-side
//     Supabase. RLS on every table denies anon/authenticated roles; the app
//     reaches data exclusively through this server-side connection, scoped
//     by the authenticated user id in the query layer.
//
// If your environment uses different variable names (e.g. a Vercel-marketplace
// prefix), only THIS file needs editing: change the `runtimeUrl` fallbacks.
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function makeClient(): PrismaClient {
  // Runtime URL precedence: POSTGRES_URL (contract) → legacy HORSE_DATABASE_URL
  // (only accepted when it is a postgres:// / postgresql:// URL, so a stale
  // SQLite value can never silently downgrade the backend).
  const legacy = process.env.HORSE_DATABASE_URL?.trim() ?? "";
  const runtimeUrl =
    process.env.POSTGRES_URL?.trim() ||
    (/^postgres(ql)?:\/\//i.test(legacy) ? legacy : "");

  if (!runtimeUrl) {
    throw new Error(
      "[horse:db] POSTGRES_URL is not set — point it at the Supabase transaction pooler (port 6543). " +
        "Migrations use POSTGRES_URL_NON_POOLING (port 5432) via prisma migrate deploy.",
    );
  }

  // pg ≥ 8.23 treats `sslmode=require` as verify-full and fails against
  // Supabase's pooler certificate chain. Normalize: strip sslmode from the
  // string and set TLS explicitly — encrypted, cert NOT verified (the widely
  // used Supabase-pooler posture; access is still denied by RLS + no table
  // grants for anon/authenticated, and only this server holds the URL).
  const poolUrl = (() => {
    try {
      const u = new URL(runtimeUrl);
      u.searchParams.delete("sslmode");
      return u.toString();
    } catch {
      return runtimeUrl;
    }
  })();

  const adapter = new PrismaPg({
    connectionString: poolUrl,
    // PgBouncer transaction-pooler compatibility + serverless safety: the
    // adapter executes UNNAMED queries only (no server-side prepared
    // statements — verified in @prisma/adapter-pg source) — `prepare:false`
    // is kept as belt-and-braces for future adapter versions.
    prepare: false,
    // Small pool: every serverless instance gets its own; the transaction
    // pooler multiplexes them onto Supabase's shared connections.
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: { rejectUnauthorized: false },
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "production" ? ["error"] : ["query"],
  });
}

export const db = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
