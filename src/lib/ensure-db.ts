// Harbor Web — runtime database bootstrap (RETIRED).
//
// With the Supabase Postgres backend the schema is owned by VERSIONED
// PRISMA MIGRATIONS:
//   • prisma/migrations/<ts>_init/migration.sql (+ RLS hardening block)
//   • applied by `prisma migrate deploy` in the BUILD step, using
//     POSTGRES_URL_NON_POOLING (session pooler/direct) — per the operator
//     contract, migrations NEVER run at request time.
//
// Every DB-touching route still awaits ensureDb() so the call sites stay
// stable across backends; on Postgres it is a resolved no-op.
export function ensureDb(): Promise<void> {
  return Promise.resolve();
}
