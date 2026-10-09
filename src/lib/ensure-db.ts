// Harbor Web — runtime SQLite bootstrap.
// Vercel serverless instances start with an EMPTY /tmp: HORSE_DATABASE_URL
// points at file:/tmp/horse.db, but nothing runs `prisma db push` at deploy
// time for runtime files, so the very first request on a cold instance would
// fail with "Unable to open the database file" / "no such table".
//
// ensureDb() is awaited at the top of every DB-touching route. It:
//   1. creates the sqlite file (a zero-byte file is a valid empty SQLite db),
//   2. applies idempotent CREATE TABLE/INDEX IF NOT EXISTS DDL mirroring
//      prisma/schema.prisma (SQLite dialect).
// It is memoized per process and never throws — if bootstrap fails the route's
// own error handling takes over and the next request retries.
//
// MAINTENANCE: if you change prisma/schema.prisma, mirror the DDL below.
import fs from "fs";
import path from "path";
import { db } from "@/lib/db";

const DDL_STATEMENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS "HorseUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "HorseUser_username_key" ON "HorseUser"("username")`,
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
    "transportUrl" TEXT NOT NULL,
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
  `CREATE UNIQUE INDEX IF NOT EXISTS "Addon_profileId_transportUrl_key" ON "Addon"("profileId", "transportUrl")`,
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
  `CREATE TABLE IF NOT EXISTS "LinkedAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT,
    "expiresAt" DATETIME,
    "username" TEXT,
    "avatar" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "LinkedAccount_provider_key" ON "LinkedAccount"("provider")`,
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

async function bootstrap(): Promise<void> {
  const url = process.env.HORSE_DATABASE_URL?.trim();
  // Only SQLite file URLs need runtime bootstrap (a future hosted DB like
  // Turso already exists server-side and has its own schema management).
  if (!url || !url.startsWith("file:")) return;
  let filePath = url.slice("file:".length);
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
