-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "HorseUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT,
    "passwordHash" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HorseUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "uaSummary" TEXT,
    "uaRaw" TEXT,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "absoluteExpiresAt" TIMESTAMP(3) NOT NULL,
    "remember" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailToken" (
    "id" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthAccount" (
    "id" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "windowEnd" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "uid" TEXT,
    "event" TEXT NOT NULL,
    "ipHash" TEXT,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#7dd3fc',
    "avatar" TEXT,
    "isKid" BOOLEAN NOT NULL DEFAULT false,
    "kidAge" INTEGER,
    "pinHash" TEXT,
    "curfewMin" INTEGER,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Addon" (
    "id" TEXT NOT NULL,
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
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "profileId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "probeOk" BOOLEAN,
    "probeResource" TEXT,
    "probeCount" INTEGER,
    "probeMs" INTEGER,
    "probeError" TEXT,
    "probedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Addon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryItem" (
    "id" TEXT NOT NULL,
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
    "lastWatched" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LibraryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchEvent" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "videoId" TEXT,
    "season" INTEGER,
    "episode" INTEGER,
    "position" DOUBLE PRECISION NOT NULL,
    "duration" DOUBLE PRECISION NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomList" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "items" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkedAccount" (
    "id" TEXT NOT NULL,
    "ownerUid" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT,
    "expiresAt" TIMESTAMP(3),
    "username" TEXT,
    "avatar" TEXT,
    "scopes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinkedAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "profileId" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("profileId")
);

-- CreateTable
CREATE TABLE "ServerConfig" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServerConfig_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "HorseUser_email_key" ON "HorseUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "HorseUser_username_key" ON "HorseUser"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_uid_idx" ON "Session"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "EmailToken_tokenHash_key" ON "EmailToken"("tokenHash");

-- CreateIndex
CREATE INDEX "EmailToken_uid_kind_idx" ON "EmailToken"("uid", "kind");

-- CreateIndex
CREATE INDEX "OAuthAccount_uid_idx" ON "OAuthAccount"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAccount_provider_providerAccountId_key" ON "OAuthAccount"("provider", "providerAccountId");

-- CreateIndex
CREATE INDEX "AuditLog_uid_createdAt_idx" ON "AuditLog"("uid", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_event_createdAt_idx" ON "AuditLog"("event", "createdAt");

-- CreateIndex
CREATE INDEX "Addon_profileId_idx" ON "Addon"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "Addon_profileId_urlHash_key" ON "Addon"("profileId", "urlHash");

-- CreateIndex
CREATE INDEX "LibraryItem_profileId_removed_temp_idx" ON "LibraryItem"("profileId", "removed", "temp");

-- CreateIndex
CREATE INDEX "LibraryItem_profileId_favorite_idx" ON "LibraryItem"("profileId", "favorite");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryItem_profileId_itemId_key" ON "LibraryItem"("profileId", "itemId");

-- CreateIndex
CREATE INDEX "WatchEvent_profileId_itemId_idx" ON "WatchEvent"("profileId", "itemId");

-- CreateIndex
CREATE INDEX "WatchEvent_profileId_createdAt_idx" ON "WatchEvent"("profileId", "createdAt");

-- CreateIndex
CREATE INDEX "LinkedAccount_ownerUid_idx" ON "LinkedAccount"("ownerUid");

-- CreateIndex
CREATE UNIQUE INDEX "LinkedAccount_provider_ownerUid_key" ON "LinkedAccount"("provider", "ownerUid");


-- ============================================================================
-- RLS hardening (operator contract #3):
-- Supabase exposes PostgREST (SUPABASE_URL/rest/v1) with anon/authenticated
-- roles. This app never uses that surface — it talks to Postgres only from
-- the server via the pg pooler connection, scoped by user id in the query
-- layer. Belt-and-braces: enable ROW LEVEL SECURITY on EVERY public table
-- (no policies = deny-all) and strip all table privileges from the exposed
-- roles. Table owner (the migration role) keeps full access.
-- ============================================================================
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
