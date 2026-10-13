// Harbor Web — Next.js instrumentation hook (server boot).
// Runs once per server process (dev + production start). Used to hydrate
// operator integration keys from the DB-backed ServerConfig table so a wiped
// .env can never silently darken TMDB/OMDb/MDBList/Trakt/Simkl again.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return; // never on edge
  try {
    const { hydrateEnv } = await import("@/lib/harbor/env-hydrate");
    const applied = await hydrateEnv();
    if (applied > 0) {
      console.log(`[horse:boot] hydrated ${applied} integration key(s) from ServerConfig`);
    }
  } catch {
    // boot must never fail because of hydration
  }
}
