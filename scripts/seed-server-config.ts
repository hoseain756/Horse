// Harbor Web — seed ServerConfig rows from .env (wipe-resilience bootstrap).
//
// Mirrors the operator's integration keys into the DB-backed ServerConfig
// table so the running app can hydrate them via src/lib/harbor/env-hydrate.ts
// even after the sandbox wipes .env (it has happened twice).
//
// Usage:  bun scripts/seed-server-config.ts
// Safe to re-run: plain upserts, only touches rows whose env value is set.
// Secrets live in .env (gitignored) — this script never prints them.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

// .env parse — handles the "KEY=value" and quoted forms used by this repo
function loadEnv(): Record<string, string> {
  const raw = readFileSync(join(process.cwd(), ".env"), "utf8");
  const out: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (v) out[m[1]] = v;
  }
  return out;
}

// env var → ServerConfig row (dotted alias preferred for readability)
const SEED_MAP: [string, string][] = [
  ["TRAKT_CLIENT_ID", "trakt.client_id"],
  ["TRAKT_CLIENT_SECRET", "trakt.client_secret"],
  ["SIMKL_CLIENT_ID", "simkl.client_id"],
  ["SIMKL_CLIENT_SECRET", "simkl.client_secret"],
  ["TMDB_ACCESS_TOKEN", "tmdb.access_token"],
  ["TMDB_API_KEY", "tmdb.api_key"],
  ["OMDB_API_KEY", "omdb.api_key"],
  ["MDBLIST_API_KEY", "mdblist.api_key"],
];

async function main(): Promise<void> {
  const env = loadEnv();
  const runtimeUrl = env.POSTGRES_URL;
  if (!runtimeUrl) {
    console.error("POSTGRES_URL missing in .env — nothing to seed into.");
    process.exit(1);
  }
  // mirror src/lib/db.ts: strip sslmode, TLS without cert verification (pooler)
  const u = new URL(runtimeUrl);
  u.searchParams.delete("sslmode");
  const client = new pg.Client({
    connectionString: u.toString(),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  let seeded = 0;
  for (const [envName, rowKey] of SEED_MAP) {
    const value = env[envName]?.trim();
    if (!value) continue; // unset env → leave any existing row untouched
    await client.query(
      `INSERT INTO "ServerConfig" (key, value, "updatedAt") VALUES ($1, $2, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, "updatedAt" = now()`,
      [rowKey, value],
    );
    seeded++;
    console.log(`  seeded ${rowKey} (${value.length} chars)`);
  }
  await client.end();
  console.log(`seed-server-config: ${seeded} row(s) upserted into ServerConfig.`);
}

main().catch((e) => {
  console.error("seed failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
