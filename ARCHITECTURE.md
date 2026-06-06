# BookingOS — Architecture & Operations

A multitenant, white-label appointment-booking platform. This document is the
single source of truth for how the system fits together and how to run it
safely. For the product spec see [`Docs/`](Docs/).

## Topology

```
apps/web   Next.js 14 (App Router) — admin UI + public booking pages
apps/api   Express 4 + Prisma — REST API
packages/db     Prisma schema, migrations, RLS script, seed
packages/types  Shared wire/types (API contracts)
packages/utils  Shared helpers (date/timezone)
PostgreSQL with Row-Level Security for tenant isolation
```

## Tenant isolation (read this before touching data access)

Isolation is enforced at **two layers**:

1. **Application layer (primary):** every tenant-scoped query carries an
   explicit `where: { tenantId }`.
2. **Database layer (defense-in-depth):** PostgreSQL Row-Level Security on the
   `Service`, `Booking`, and `Schedule` tables, keyed off
   `current_setting('app.tenant_id')`.

Because Prisma pools connections, the tenant id must be set on the **same
connection** that runs the queries. That is the job of
[`apps/api/src/lib/tenantDb.ts`](apps/api/src/lib/tenantDb.ts) → `withTenant`,
which wraps `set_config('app.tenant_id', …, true)` **and** the queries in one
interactive transaction.

> ⚠️ **Rule:** any access to `Service` / `Booking` / `Schedule` MUST go through
> `withTenant(tenantId, tx => …)`. A bare `prisma.service.findMany()` will be
> blocked by RLS (returns nothing) once the policies are applied. `User` and
> `Tenant` are intentionally **not** under RLS so the unauthenticated auth flow
> can look them up before a tenant context exists.

### Applying RLS (run once per database, in this order)

```bash
pnpm --filter db migrate:prod      # 1. create tables
pnpm --filter db seed              # 2. seed demo data (no tenant ctx yet)
psql "$DATABASE_URL" -f packages/db/scripts/setup-rls.sql   # 3. enable RLS
```

Seeding must happen **before** RLS is forced, otherwise the seed's inserts
(which run without a tenant context) are rejected.

## Authentication

- **Access token:** JWT, 15-min expiry, claims `{ userId, tenantId, role, email }`,
  held in browser memory only (never localStorage).
- **Refresh token:** opaque 32-byte random value, 7-day expiry, **rotated on
  every use**, delivered as an `httpOnly` + `SameSite=strict` + `Secure`
  (in prod) cookie. Stored **hashed (SHA-256)** at rest, so a DB leak does not
  yield usable tokens.
- The web `api.ts` axios layer attaches the access token to every request and,
  on a 401, performs a single silent refresh + retry. `AuthContext` keeps the
  token in sync and reconstructs the `user` from the JWT after a reload.

## Request validation

All request validation lives in
[`apps/api/src/lib/validators.ts`](apps/api/src/lib/validators.ts) as Zod
schemas, shared between create/update handlers. Schedule updates additionally
run `validateScheduleCoherence` against the **merged** (existing + incoming)
schedule, so partial updates cannot leave work hours/breaks inconsistent.

## Local development

```bash
pnpm install
# Terminal 1 — API (hot reload via tsx)
pnpm dev:api
# Terminal 2 — Web
pnpm dev:web
# Tests
pnpm --filter api test
```

Required env vars are documented in the `.env.example` files. The API refuses to
boot if `JWT_SECRET` / `JWT_REFRESH_SECRET` / `DATABASE_URL` / `FRONTEND_URL`
are missing or if the secrets are shorter than 32 chars.

## Booking concurrency guard

Double-booking is prevented at **two layers**, mirroring the tenant-isolation
strategy:

1. **Application layer:** booking creation runs through `withTenant(..., {
   isolationLevel: "Serializable", maxRetries })` so the availability check and
   the insert see one stable snapshot, and aborted transactions are retried.
2. **Database layer (final arbiter):** a GiST `EXCLUDE` constraint
   (`Booking_no_overlap`, see migration `20260606150000`) makes overlapping
   non-cancelled bookings for the same tenant impossible regardless of timing —
   covering the phantom-write case that `SELECT ... FOR UPDATE` cannot. The F4
   POST handler catches the `23P01` violation and returns `409 SLOT_TAKEN`.

## Known not-yet-built (per the build plan)

F4 public booking flow (availability engine + endpoints + pages), F5 admin
booking management, F6 email (Resend), F9 reminder cron, F8 staff, F10
super-admin. The concurrency guard above is in place; F4 wires the POST handler
to it.
