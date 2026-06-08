-- ============================================================================
-- Row-Level Security: tenant isolation (CANONICAL SCRIPT)
-- ============================================================================
-- Defense-in-depth that contains the blast radius if an application-level
-- `where: { tenantId }` filter is ever forgotten. The application sets the
-- active tenant per request via lib/tenantDb.ts `withTenant`, which runs
--     SELECT set_config('app.tenant_id', <tenantId>, true)
-- and the tenant-scoped queries inside ONE transaction (so they share a
-- pooled connection and the setting is visible to the policies).
--
-- RLS is applied only to the tenant-scoped DATA tables. "User" and "Tenant"
-- are intentionally left out so the unauthenticated auth flow (login/refresh)
-- and super admin tenant provisioning — which must look up / create users and
-- tenants BEFORE a tenant context exists — keep working.
--
-- ORDER OF OPERATIONS (important):
--   1. prisma migrate deploy        (create tables)
--   2. pnpm db:seed                 (insert demo data — runs WITHOUT a tenant
--                                    context, so it must happen BEFORE RLS is
--                                    forced, otherwise inserts are blocked)
--   3. psql "$DATABASE_URL" -f packages/db/scripts/setup-rls.sql   (this file)
--
-- Re-running this script is safe (policies are dropped first).
-- ============================================================================

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['Service', 'Booking', 'Schedule'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    -- FORCE so the policy applies even to the table owner (Supabase/Prisma
    -- typically connect as the owner). Without FORCE, RLS is silently bypassed.
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    -- current_setting(..., true) returns NULL when unset, so the comparison is
    -- false and access is denied by default. FOR ALL covers SELECT/INSERT/
    -- UPDATE/DELETE; WITH CHECK blocks writing rows for another tenant.
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I FOR ALL '
      'USING ("tenantId" = current_setting(''app.tenant_id'', true)) '
      'WITH CHECK ("tenantId" = current_setting(''app.tenant_id'', true))',
      t
    );
  END LOOP;
END $$;

-- ============================================================================
-- VERIFICATION (uncomment to confirm policies are active after running this)
-- ============================================================================
-- Expect rowsecurity = t AND relforcerowsecurity = t for all three tables:
--
--   SELECT relname, relrowsecurity, relforcerowsecurity
--   FROM pg_class
--   WHERE relname IN ('Service', 'Booking', 'Schedule');
--
-- Expect one tenant_isolation policy per table:
--
--   SELECT tablename, policyname, cmd
--   FROM pg_policies
--   WHERE tablename IN ('Service', 'Booking', 'Schedule');
