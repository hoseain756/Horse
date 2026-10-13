// Harbor Web — env hydration from the DB-backed ServerConfig table.
//
// WHY: the sandbox wipes .env silently (it happened twice — TMDB went dark
// both times). Trakt/Simkl already fall back to ServerConfig rows, but the
// remaining integrations read process.env SYNCHRONOUSLY deep inside hot
// paths (ratings adapters `supports()`, tmdbEnvCreds(), the cron route…).
// Rather than converting every call site to async lookups, we do the reverse:
// HYDRATE process.env itself from ServerConfig once per server process.
//
// Contract (unchanged everywhere else):
//   • process.env wins — hydration NEVER overwrites a live env value.
//   • Rows may use either the dotted form ("tmdb.access_token") or the bare
//     env name ("TMDB_ACCESS_TOKEN") — both are recognized.
//   • Failures are swallowed: a DB hiccup must never break a request.
//   • Memoized per process; re-run costs one cached promise.
import { getServerConfig } from "@/lib/harbor/server-config";

/** ServerConfig row key → env var it hydrates (dotted aliases + bare names). */
const HYDRATION_MAP: Record<string, string> = {
  // dotted aliases (the original wipe-resilience row names)
  "trakt.client_id": "TRAKT_CLIENT_ID",
  "simkl.client_id": "SIMKL_CLIENT_ID",
  "simkl.client_secret": "SIMKL_CLIENT_SECRET",
  "tmdb.access_token": "TMDB_ACCESS_TOKEN",
  "tmdb.api_key": "TMDB_API_KEY",
  "omdb.api_key": "OMDB_API_KEY",
  "mdblist.api_key": "MDBLIST_API_KEY",
  // bare env-name rows are accepted verbatim
  TRAKT_CLIENT_ID: "TRAKT_CLIENT_ID",
  TRAKT_CLIENT_SECRET: "TRAKT_CLIENT_SECRET",
  SIMKL_CLIENT_ID: "SIMKL_CLIENT_ID",
  SIMKL_CLIENT_SECRET: "SIMKL_CLIENT_SECRET",
  TMDB_ACCESS_TOKEN: "TMDB_ACCESS_TOKEN",
  TMDB_API_KEY: "TMDB_API_KEY",
  OMDB_API_KEY: "OMDB_API_KEY",
  MDBLIST_API_KEY: "MDBLIST_API_KEY",
};

let hydration: Promise<number> | null = null;

async function runHydration(): Promise<number> {
  let applied = 0;
  for (const [rowKey, envName] of Object.entries(HYDRATION_MAP)) {
    if (typeof process.env[envName] === "string" && process.env[envName]!.trim()) continue; // env wins
    try {
      const value = await getServerConfig(rowKey);
      if (value) {
        process.env[envName] = value;
        applied++;
      }
    } catch {
      // swallowed — env-hydration is best-effort by design
    }
  }
  return applied;
}

/**
 * Hydrate missing integrations env vars from ServerConfig (idempotent,
 * memoized). Safe to await at the top of any route — resolves instantly
 * after the first call and never throws.
 */
export function hydrateEnv(): Promise<number> {
  if (!hydration) {
    hydration = runHydration().catch(() => 0);
  }
  return hydration;
}

/** Test/dev helper: forget the memo so the next hydrateEnv() re-reads the DB. */
export function resetEnvHydration(): void {
  hydration = null;
}
