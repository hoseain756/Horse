// Harbor Web — server-wide key/value config backed by the database.
// Purpose: operator-level settings that must SURVIVE .env resets in sandboxed
// environments (the sandbox wiped .env once, silently disabling Trakt linking).
// Resolution order everywhere: process.env first, then a ServerConfig row.
import { db } from "@/lib/db";

export async function getServerConfig(key: string): Promise<string | null> {
  try {
    const row = await db.serverConfig.findUnique({ where: { key } });
    return row?.value?.trim() ? row.value.trim() : null;
  } catch {
    // DB hiccup should never take an integration route down — env still works
    return null;
  }
}

export async function setServerConfig(key: string, value: string): Promise<void> {
  await db.serverConfig.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}
