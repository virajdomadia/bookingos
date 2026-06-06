-- Make email globally unique (one account per email) instead of unique only
-- per tenant. Login looks up users by email alone, so a per-tenant constraint
-- allowed duplicate emails across tenants and made login non-deterministic.
DROP INDEX "User_tenantId_email_key";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
