-- Staff invite flow (F8). A pending invitee is a User row with isActive=false and
-- a hashed, expiring invite token; accepting the invite sets the password,
-- activates the account, and clears these fields.
ALTER TABLE "User" ADD COLUMN "inviteTokenHash" TEXT;
ALTER TABLE "User" ADD COLUMN "inviteExpiresAt" TIMESTAMP(3);

-- Unique so an invite token resolves to exactly one user (lookup is by hash).
CREATE UNIQUE INDEX "User_inviteTokenHash_key" ON "User"("inviteTokenHash");
