-- Row-Level Security setup for tenant isolation.
-- Run this ONCE after migrations, as a superuser.
-- The app DB user must NOT be a superuser for RLS to take effect.
--
-- Usage: psql $DATABASE_URL -f packages/db/scripts/setup-rls.sql

-- Enable RLS on all tenant-scoped tables
ALTER TABLE "User"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Service"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Booking"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Schedule" ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running this script
DROP POLICY IF EXISTS "tenant_isolation_user"     ON "User";
DROP POLICY IF EXISTS "tenant_isolation_service"  ON "Service";
DROP POLICY IF EXISTS "tenant_isolation_booking"  ON "Booking";
DROP POLICY IF EXISTS "tenant_isolation_schedule" ON "Schedule";

-- Create policies: rows are visible only when tenantId matches the
-- value set by the API via: set_config('app.tenant_id', tenantId, true)
-- current_setting(..., true) returns NULL (not an error) when unset,
-- which causes the policy to evaluate to false — blocking access by default.
CREATE POLICY "tenant_isolation_user" ON "User"
  USING ("tenantId" = current_setting('app.tenant_id', true));

CREATE POLICY "tenant_isolation_service" ON "Service"
  USING ("tenantId" = current_setting('app.tenant_id', true));

CREATE POLICY "tenant_isolation_booking" ON "Booking"
  USING ("tenantId" = current_setting('app.tenant_id', true));

CREATE POLICY "tenant_isolation_schedule" ON "Schedule"
  USING ("tenantId" = current_setting('app.tenant_id', true));

-- NOTE: For RLS to work correctly with Prisma's connection pool,
-- each authenticated request must run set_config + its queries inside
-- the same transaction. The auth middleware already calls set_config;
-- wrap it in prisma.$transaction when you add the booking routes.
