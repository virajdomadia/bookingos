-- Enable RLS on all tables
ALTER TABLE "Tenant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Service" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Booking" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Schedule" ENABLE ROW LEVEL SECURITY;

-- Tenant policies
CREATE POLICY tenant_isolate ON "Tenant"
  FOR ALL
  USING (id = current_setting('app.tenant_id')::text)
  WITH CHECK (id = current_setting('app.tenant_id')::text);

-- User policies
CREATE POLICY user_isolate ON "User"
  FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id')::text)
  WITH CHECK ("tenantId" = current_setting('app.tenant_id')::text);

-- Service policies
CREATE POLICY service_isolate ON "Service"
  FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id')::text)
  WITH CHECK ("tenantId" = current_setting('app.tenant_id')::text);

-- Booking policies
CREATE POLICY booking_isolate ON "Booking"
  FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id')::text)
  WITH CHECK ("tenantId" = current_setting('app.tenant_id')::text);

-- Schedule policies
CREATE POLICY schedule_isolate ON "Schedule"
  FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id')::text)
  WITH CHECK ("tenantId" = current_setting('app.tenant_id')::text);
