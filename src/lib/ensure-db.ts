// Harbor Web — runtime database bootstrap.
// Vercel serverless instances start with an EMPTY /tmp: HORSE_DATABASE_URL
// points at file:/tmp/horse.db, but nothing runs `prisma db push` at deploy
// time for runtime files, so the very first request on a cold instance would
// fail with "Unable to open the database file" / "no such table".
// The same applies to a BRAND-NEW remote Turso database (libsql://...): it
// exists but has zero tables.
//
// ensureDb() is awaited at the top of every DB-touching route. It:
//   1. file: URLs  → creates the sqlite file (zero-byte = valid empty db),
//   2. always      → applies defensive table migrations + idempotent
//      CREATE TABLE/INDEX IF NOT EXISTS DDL mirroring prisma/schema.prisma
//      (works identically on local SQLite and remote Turso, so a fresh Turso
//      db self-schemas on first request).
// It is memoized per process and never throws — if bootstrap fails the route's
// own error handling takes over and the next request retries.
//
// MAINTENANCE: if you change prisma/schema.prisma, mirror the DDL below.
import fs from "fs";
import path from "path";
import { db } from "@/lib/db";

const DDL_STATEMENTS: readonly string[] = [
  // ---- accounts ----
  `CREATE TABLE IF NOT EXISTS "HorseUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT,
    "passwordHash" TEXT NOT NULL,
    "emailVerifiedAt" DATETIME,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "HorseUser_email_key" ON "HorseUser"("email")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "HorseUser_username_key" ON "HorseUser"("username")`,
  `CREATE TABLE IF NOT EXISTS "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "uid" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "uaSummary" TEXT,
    "uaRaw" TEXT,
    "ipHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "absoluteExpiresAt" DATETIME NOT NULL,
    "remember" BOOLEAN NOT NULL DEFAULT true
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Session_tokenHash_key" ON "Session"("tokenHash")`,
  `CREATE INDEX IF NOT EXISTS "Session_uid_idx" ON "Session"("uid")`,
  `CREATE TABLE IF NOT EXISTS "EmailToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "uid" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "EmailToken_tokenHash_key" ON "EmailToken"("tokenHash")`,
  `CREATE INDEX IF NOT EXISTS "EmailToken_uid_kind_idx" ON "EmailToken"("uid", "kind")`,
  `CREATE TABLE IF NOT EXISTS "OAuthAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "uid" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "OAuthAccount_provider_providerAccountId_key" ON "OAuthAccount"("provider", "providerAccountId")`,
  `CREATE INDEX IF NOT EXISTS "OAuthAccount_uid_idx" ON "OAuthAccount"("uid")`,
  // ---- shared rate limiting + audit ----
  `CREATE TABLE IF NOT EXISTS "RateLimit" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowStart" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "windowEnd" DATETIME NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "uid" TEXT,
    "event" TEXT NOT NULL,
    "ipHash" TEXT,
    "detail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS "AuditLog_uid_createdAt_idx" ON "AuditLog"("uid", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "AuditLog_event_createdAt_idx" ON "AuditLog"("event", "createdAt")`,
  // ---- profiles / content mirrors ----
  `CREATE TABLE IF NOT EXISTS "Profile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#7dd3fc',
    "avatar" TEXT,
    "isKid" BOOLEAN NOT NULL DEFAULT false,
    "kidAge" INTEGER,
    "pinHash" TEXT,
    "curfewMin" INTEGER,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "Addon" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "urlHash" TEXT NOT NULL,
    "urlEnc" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT,
    "logo" TEXT,
    "description" TEXT,
    "background" TEXT,
    "contactEmail" TEXT,
    "types" TEXT NOT NULL,
    "catalogs" TEXT NOT NULL,
    "resources" TEXT NOT NULL,
    "idPrefixes" TEXT,
    "behaviorHints" TEXT,
    "flags" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "installedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "profileId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "probeOk" BOOLEAN,
    "probeResource" TEXT,
    "probeCount" INTEGER,
    "probeMs" INTEGER,
    "probeError" TEXT,
    "probedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Addon_profileId_urlHash_key" ON "Addon"("profileId", "urlHash")`,
  `CREATE INDEX IF NOT EXISTS "Addon_profileId_idx" ON "Addon"("profileId")`,
  `CREATE TABLE IF NOT EXISTS "LibraryItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "poster" TEXT,
    "background" TEXT,
    "logo" TEXT,
    "releaseInfo" TEXT,
    "imdbRating" TEXT,
    "state" TEXT,
    "removed" BOOLEAN NOT NULL DEFAULT false,
    "temp" BOOLEAN NOT NULL DEFAULT false,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "watched" BOOLEAN NOT NULL DEFAULT false,
    "lastWatched" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "LibraryItem_profileId_itemId_key" ON "LibraryItem"("profileId", "itemId")`,
  `CREATE INDEX IF NOT EXISTS "LibraryItem_profileId_removed_temp_idx" ON "LibraryItem"("profileId", "removed", "temp")`,
  `CREATE INDEX IF NOT EXISTS "LibraryItem_profileId_favorite_idx" ON "LibraryItem"("profileId", "favorite")`,
  `CREATE TABLE IF NOT EXISTS "WatchEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "videoId" TEXT,
    "season" INTEGER,
    "episode" INTEGER,
    "position" REAL NOT NULL,
    "duration" REAL NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS "WatchEvent_profileId_itemId_idx" ON "WatchEvent"("profileId", "itemId")`,
  `CREATE INDEX IF NOT EXISTS "WatchEvent_profileId_createdAt_idx" ON "WatchEvent"("profileId", "createdAt")`,
  `CREATE TABLE IF NOT EXISTS "CustomList" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "items" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  // ---- integrations (per-user) + config + canonical blob ----
  `CREATE TABLE IF NOT EXISTS "LinkedAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerUid" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT,
    "expiresAt" DATETIME,
    "username" TEXT,
    "avatar" TEXT,
    "scopes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "LinkedAccount_provider_ownerUid_key" ON "LinkedAccount"("provider", "ownerUid")`,
  `CREATE INDEX IF NOT EXISTS "LinkedAccount_ownerUid_idx" ON "LinkedAccount"("ownerUid")`,
  `CREATE TABLE IF NOT EXISTS "AppSettings" (
    "profileId" TEXT NOT NULL PRIMARY KEY,
    "data" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "ServerConfig" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
  )`,
];

// Defensive pre-DDL migrations: pre-v2 databases may hold tables whose shape
// no longer matches (e.g. Addon with a plaintext transportUrl column,
// LinkedAccount globally keyed by provider). All affected tables hold DERIVED
// data (rebuilt by the next sync push) or pre-email accounts (production data
// was ephemeral and lost anyway), so dropping is safe and simpler than
// column-by-column backfills. Runs before the idempotent DDL.
async function legacyTableShims(): Promise<void> {
  const tableColumns = new Map<string, Set<string>>();
  const tables = [
    "HorseUser",
    "Addon",
    "LinkedAccount",
    "Session",
    "RateLimit",
    "AuditLog",
    "EmailToken",
    "OAuthAccount",
  ];
  for (const t of tables) {
    try {
      const rows = (await db.$queryRawUnsafe<{ name: string }[]>(
        `SELECT name FROM pragma_table_info('${t}')`,
      )) as { name: string }[];
      tableColumns.set(t, new Set(rows.map((r) => r.name)));
    } catch {
      tableColumns.set(t, new Set()); // table missing → DDL will create it
    }
  }
  const drops: string[] = [];
  const dropIf = (t: string, needed: string[]): void => {
    const cols = tableColumns.get(t);
    if (!cols || cols.size === 0) return; // table absent — fine
    const missing = needed.filter((c) => !cols.has(c));
    if (missing.length > 0) {
      console.warn(`[horse:db] legacy "${t}" missing column(s) ${missing.join(", ")} — dropping for rebuild`);
      drops.push(t);
    }
  };
  dropIf("HorseUser", ["email", "passwordHash"]);
  dropIf("Addon", ["urlHash", "urlEnc"]);
  dropIf("LinkedAccount", ["ownerUid"]);
  // Await drops so the idempotent DDL below always sees the final state.
  for (const t of drops) {
    await db.$executeRawUnsafe(`DROP TABLE IF EXISTS "${t}"`);
  }
}

async function bootstrap(): Promise<void> {
  const url = process.env.HORSE_DATABASE_URL?.trim();
  if (!url) return;
  const isRemote = /^(libsql|https?):/i.test(url);
  if (!isRemote) {
    // Local/embedded SQLite: make sure the FILE exists before the engine opens it.
    let filePath = url.startsWith("file:") ? url.slice("file:".length) : url;
    const q = filePath.indexOf("?");
    if (q >= 0) filePath = filePath.slice(0, q);
    if (!filePath) return;
    // Env values in this project are absolute; resolve defensively anyway.
    const abs = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
    try {
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      if (!fs.existsSync(abs)) {
        // Zero-byte file = valid empty SQLite database for the query engine.
        fs.writeFileSync(abs, "");
      }
    } catch (e) {
      console.error("[horse:db] could not prepare sqlite file", abs, e);
      return;
    }
  }
  await legacyTableShims();
  // Remote (Turso) or fresh local file: apply idempotent schema. libSQL is
  // SQLite-compatible so the same DDL runs on both backends.
  for (const stmt of DDL_STATEMENTS) {
    await db.$executeRawUnsafe(stmt);
  }
}

let ensured: Promise<void> | null = null;

export function ensureDb(): Promise<void> {
  if (!ensured) {
    ensured = bootstrap().catch((e) => {
      ensured = null; // allow a retry on the next request
      console.error("[horse:db] runtime bootstrap failed (will retry)", e);
    });
  }
  return ensured;
}
