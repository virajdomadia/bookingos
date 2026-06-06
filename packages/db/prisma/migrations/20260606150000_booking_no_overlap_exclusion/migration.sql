-- ============================================================================
-- F4 prep: database-enforced double-booking prevention.
-- ============================================================================
-- The application uses a SERIALIZABLE transaction + availability check when
-- creating a booking, but isolation alone cannot prevent two concurrent inserts
-- for a slot that does not exist yet (the phantom-write problem): SELECT ... FOR
-- UPDATE has no row to lock. This GiST exclusion constraint makes the database
-- the final arbiter — two non-cancelled bookings for the same tenant whose
-- [startsAt, endsAt) ranges overlap can NEVER both commit, regardless of timing.
--
-- The model is single-resource per tenant (one practitioner), so any overlap
-- within a tenant is a conflict regardless of which service it is for — which is
-- exactly what the availability engine assumes.
--
-- F4's POST handler catches the resulting 23P01 (exclusion_violation) and
-- returns 409 SLOT_TAKEN.
--
-- btree_gist provides the "=" operator class for the scalar tenantId column so
-- it can sit in the same GiST index as the range overlap operator.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_no_overlap"
  EXCLUDE USING gist (
    "tenantId" WITH =,
    tsrange("startsAt", "endsAt") WITH &&
  )
  WHERE (status <> 'CANCELLED');
