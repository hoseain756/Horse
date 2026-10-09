// Harbor Web — Prisma client with libSQL driver adapter.
// One code path speaks BOTH backends, selected purely by env:
//   HORSE_DATABASE_URL=file:/path/to/horse.db        → local/embedded SQLite
//   HORSE_DATABASE_URL=libsql://<db>-<org>.turso.io  → remote Turso (durable,
//                                     shared by ALL serverless instances)
//   + HORSE_DB_AUTH_TOKEN required for remote URLs (Turso "Auth Token").
// This is what makes HORSE accounts + sync actually durable on Vercel: /tmp
// SQLite is per-instance and recycled; a Turso database is external storage.
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function makeClient(): PrismaClient {
  const url = process.env.HORSE_DATABASE_URL?.trim() || "file:./db/horse.db";
  const isRemote = /^(libsql|https?):/i.test(url);
  const authToken = isRemote ? process.env.HORSE_DB_AUTH_TOKEN?.trim() || undefined : undefined;
  // PrismaLibSQL is a SqlMigrationAwareDriverAdapterFactory wrapping
  // @libsql/client; it handles file: URLs (local SQLite) and libsql://
  // (Turso) identically — libSQL is wire-compatible with SQLite.
  const adapter = new PrismaLibSQL({ url, authToken });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "production" ? ["error"] : ["query"],
  });
}

export const db = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
