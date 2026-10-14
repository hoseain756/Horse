-- Horse mobile app — direct Supabase access (Task 83)
-- =====================================================
-- Run once in the Supabase SQL editor (or via psql with the session-pooler
-- URL). Grants the `authenticated` role scoped access to user data and adds
-- an updatedAt trigger so PostgREST upserts keep audit columns current.
--
-- Identity model:
--   * The Flutter app signs in through Supabase Auth (GoTrue, email+password).
--   * Data buckets are the strings `acct:<auth-uid>` — the same convention the
--     web server uses, so RLS can scope rows with `auth.uid()` alone.
--   * Legacy web accounts (scrypt hashes in "HorseUser", cuid ids) stay
--     web-only until the lazy-rehash bridge ships; do NOT weaken the policies
--     below to "support" them.

-- ── 0. Schema access ─────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA public TO authenticated;

-- ── 1. Per-bucket user data ──────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE
  ON "AppSettings", "Addon", "LibraryItem", "CustomList", "WatchEvent"
  TO authenticated;

ALTER TABLE "AppSettings"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Addon"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LibraryItem"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CustomList"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WatchEvent"   ENABLE ROW LEVEL SECURITY;

CREATE POLICY mobile_appsettings ON "AppSettings"
  FOR ALL TO authenticated
  USING      ("profileId" = 'acct:' || auth.uid()::text)
  WITH CHECK ("profileId" = 'acct:' || auth.uid()::text);

CREATE POLICY mobile_addon ON "Addon"
  FOR ALL TO authenticated
  USING      ("profileId" = 'acct:' || auth.uid()::text)
  WITH CHECK ("profileId" = 'acct:' || auth.uid()::text);

CREATE POLICY mobile_libraryitem ON "LibraryItem"
  FOR ALL TO authenticated
  USING      ("profileId" = 'acct:' || auth.uid()::text)
  WITH CHECK ("profileId" = 'acct:' || auth.uid()::text);

CREATE POLICY mobile_customlist ON "CustomList"
  FOR ALL TO authenticated
  USING      ("profileId" = 'acct:' || auth.uid()::text)
  WITH CHECK ("profileId" = 'acct:' || auth.uid()::text);

CREATE POLICY mobile_watchevent ON "WatchEvent"
  FOR ALL TO authenticated
  USING      ("profileId" = 'acct:' || auth.uid()::text)
  WITH CHECK ("profileId" = 'acct:' || auth.uid()::text);

-- ── 2. Mirror account row (display name etc.) ────────────────────────────
-- Mobile-created users get a "HorseUser" row with id = auth uid and
-- passwordHash = 'gota:true' (GoTrue owns the credential).
GRANT SELECT, INSERT ("id","email","username","displayName","passwordHash","createdAt","updatedAt")
  ON "HorseUser" TO authenticated;

ALTER TABLE "HorseUser" ENABLE ROW LEVEL SECURITY;

CREATE POLICY mobile_own_user ON "HorseUser"
  FOR SELECT TO authenticated
  USING (id = auth.uid()::text);

CREATE POLICY mobile_own_user_insert ON "HorseUser"
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid()::text);

-- ── 3. Keep @updatedAt semantics for PostgREST writers ───────────────────
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW."updatedAt" := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_appsettings_touch ON "AppSettings";
CREATE TRIGGER trg_appsettings_touch
  BEFORE UPDATE ON "AppSettings"
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_addon_touch ON "Addon";
CREATE TRIGGER trg_addon_touch
  BEFORE UPDATE ON "Addon"
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_libraryitem_touch ON "LibraryItem";
CREATE TRIGGER trg_libraryitem_touch
  BEFORE UPDATE ON "LibraryItem"
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_customlist_touch ON "CustomList";
CREATE TRIGGER trg_customlist_touch
  BEFORE UPDATE ON "CustomList"
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── 4. Auto-provision the mirror account row on signup ───────────────────
CREATE OR REPLACE FUNCTION public.handle_new_horse_user() RETURNS trigger AS $$
BEGIN
  INSERT INTO "HorseUser" ("id","email","username","passwordHash","createdAt","updatedAt")
  VALUES (
    NEW.id::text,
    lower(NEW.email),
    split_part(coalesce(NEW.email, 'user'), '@', 1) || '-' || substring(NEW.id::text, 1, 6),
    'gota:true',
    now(),
    now()
  )
  ON CONFLICT ("id") DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_horse_user();

-- ── 5. Hard walls (unchanged; server-only tables stay unreachable) ───────
REVOKE ALL ON "EmailToken", "OAuthAccount", "RateLimit", "AuditLog",
              "ServerConfig", "Profile", "PairingCode", "QrLogin",
              "TransferCode", "Session"
  FROM authenticated;
REVOKE ALL ON "HorseUser" ("passwordHash") FROM authenticated;
