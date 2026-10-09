// Harbor Web — server-wide key/value config backed by the database.
// Purpose: operator-level settings that must SURVIVE .env resets in sandboxed
// environments (the sandbox wiped .env once, silently disabling Trakt linking).
// Resolution order everywhere: process.env first, then a ServerConfig row.
import { db } from "@/lib/db";
import { ensureDb } from "@/lib/ensure-db";

export async function getServerConfig(key: string): Promise<string | null> {
  try {
    await ensureDb(); // create sqlite file + tables on cold serverless instances
    const row = await db.serverConfig.findUnique({ where: { key } });
    return row?.value?.trim() ? row.value.trim() : null;
  } catch {
    // DB hiccup should never take an integration route down — env still works
    return null;
  }
}

export async function setServerConfig(key: string, value: string): Promise<void> {
  await ensureDb(); // create sqlite file + tables on cold serverless instances
  await db.serverConfig.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}
