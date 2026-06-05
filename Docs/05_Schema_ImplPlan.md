**BACKEND SCHEMA & IMPLEMENTATION PLAN**

**Multi-Tenant SaaS Booking System**

Day-by-day build order · What to build, in what order, and why

**Part 1: Complete Database Schema**

This is the authoritative schema. Copy it verbatim into
packages/db/prisma/schema.prisma. Every field, index, and enum is here
for a documented reason.

**1.1 Full Prisma Schema**

> generator client {
>
> provider = \"prisma-client-js\"
>
> }
>
> datasource db {
>
> provider = \"postgresql\"
>
> url = env(\"DATABASE_URL\")
>
> }
>
> // ─── TENANT ───────────────────────────────────────────────────
>
> model Tenant {
>
> id String \@id \@default(cuid())
>
> name String // \"Dr. Anita\'s Clinic\"
>
> slug String \@unique // \"dr-anita\" → dr-anita.yourdomain.com
>
> logoUrl String? // Uploaded logo URL
>
> primaryColor String \@default(\"#4F46E5\") // Tenant brand colour
>
> plan Plan \@default(FREE)
>
> isActive Boolean \@default(true) // Super-admin can deactivate
>
> createdAt DateTime \@default(now())
>
> updatedAt DateTime \@updatedAt
>
> users User\[\]
>
> services Service\[\]
>
> bookings Booking\[\]
>
> schedule Schedule?
>
> }
>
> // ─── USER ─────────────────────────────────────────────────────
>
> model User {
>
> id String \@id \@default(cuid())
>
> tenantId String // FK --- ties user to exactly one tenant
>
> email String \@unique
>
> passwordHash String // bcrypt 12 rounds --- NEVER store plain text
>
> name String
>
> role Role \@default(STAFF)
>
> isActive Boolean \@default(true)
>
> inviteToken String? \@unique // Set on invite, cleared on password set
>
> inviteExpiry DateTime?
>
> lastLoginAt DateTime?
>
> createdAt DateTime \@default(now())
>
> tenant Tenant \@relation(fields: \[tenantId\], references: \[id\])
>
> @@index(\[tenantId\]) // Every query filters by tenant first
>
> }
>
> // ─── SERVICE ──────────────────────────────────────────────────
>
> model Service {
>
> id String \@id \@default(cuid())
>
> tenantId String
>
> name String // \"General Consultation\"
>
> description String?
>
> duration Int // Minutes: 15, 30, 45, 60, 90, 120
>
> price Float? // Null = no price shown to customer
>
> sortOrder Int \@default(0) // Display order in booking flow
>
> isActive Boolean \@default(true) // Soft delete --- never hard delete
>
> createdAt DateTime \@default(now())
>
> tenant Tenant \@relation(fields: \[tenantId\], references: \[id\])
>
> bookings Booking\[\]
>
> @@index(\[tenantId\])
>
> @@index(\[tenantId, isActive\]) // Most queries filter active only
>
> }
>
> // ─── BOOKING ──────────────────────────────────────────────────
>
> model Booking {
>
> id String \@id \@default(cuid())
>
> tenantId String
>
> serviceId String
>
> customerName String
>
> customerEmail String
>
> customerPhone String?
>
> startsAt DateTime // Stored as UTC always
>
> endsAt DateTime // = startsAt + service.duration
>
> status BookingStatus \@default(PENDING)
>
> notes String? // Customer notes at booking time
>
> adminNotes String? // Admin-only internal notes
>
> cancelToken String \@unique \@default(cuid()) // For email cancel link
>
> cancelReason String? // Filled on cancellation
>
> reminderSentAt DateTime? // Null = reminder not yet sent
>
> createdAt DateTime \@default(now())
>
> updatedAt DateTime \@updatedAt
>
> tenant Tenant \@relation(fields: \[tenantId\], references: \[id\])
>
> service Service \@relation(fields: \[serviceId\], references: \[id\])
>
> @@index(\[tenantId, startsAt\]) // Primary query: tenant\'s bookings
> by date
>
> @@index(\[tenantId, status\]) // Filtered views: pending, confirmed
>
> @@index(\[cancelToken\]) // Cancel via email link lookup
>
> @@index(\[reminderSentAt\]) // Cron job finds bookings needing
> reminder
>
> }
>
> // ─── SCHEDULE ─────────────────────────────────────────────────
>
> model Schedule {
>
> id String \@id \@default(cuid())
>
> tenantId String \@unique // One schedule per tenant
>
> timezone String \@default(\"Asia/Kolkata\")
>
> workingDays Json // { mon:T, tue:T, wed:T, thu:T, fri:T, sat:T, sun:F
> }
>
> workStart String \@default(\"09:00\") // \"HH:MM\" 24hr format
>
> workEnd String \@default(\"18:00\")
>
> slotInterval Int \@default(30) // Minutes between slot start times
>
> breakTimes Json \@default(\"\[\]\") // \[{start:\"13:00\",
> end:\"14:00\"}\]
>
> bufferTime Int \@default(0) // Minutes after each booking before next
> slot
>
> tenant Tenant \@relation(fields: \[tenantId\], references: \[id\])
>
> }
>
> // ─── ENUMS ────────────────────────────────────────────────────
>
> enum Role { OWNER ADMIN STAFF }
>
> enum Plan { FREE PRO }
>
> enum BookingStatus { PENDING CONFIRMED CANCELLED COMPLETED NO_SHOW }

**1.2 RLS Setup Script**

Save as packages/db/scripts/setup-rls.sql. Run after every production
migration.

> \-- Enable RLS on all tenant-scoped tables
>
> ALTER TABLE \"User\" ENABLE ROW LEVEL SECURITY;
>
> ALTER TABLE \"Service\" ENABLE ROW LEVEL SECURITY;
>
> ALTER TABLE \"Booking\" ENABLE ROW LEVEL SECURITY;
>
> ALTER TABLE \"Schedule\" ENABLE ROW LEVEL SECURITY;
>
> \-- Drop existing policies (idempotent re-run safe)
>
> DROP POLICY IF EXISTS tenant_iso ON \"User\";
>
> DROP POLICY IF EXISTS tenant_iso ON \"Service\";
>
> DROP POLICY IF EXISTS tenant_iso ON \"Booking\";
>
> DROP POLICY IF EXISTS tenant_iso ON \"Schedule\";
>
> \-- Create isolation policy for each table
>
> CREATE POLICY tenant_iso ON \"User\"
>
> USING (\"tenantId\" = current_setting(\'app.tenant_id\', true));
>
> CREATE POLICY tenant_iso ON \"Service\"
>
> USING (\"tenantId\" = current_setting(\'app.tenant_id\', true));
>
> CREATE POLICY tenant_iso ON \"Booking\"
>
> USING (\"tenantId\" = current_setting(\'app.tenant_id\', true));
>
> CREATE POLICY tenant_iso ON \"Schedule\"
>
> USING (\"tenantId\" = current_setting(\'app.tenant_id\', true));
>
> \-- VERIFICATION TEST (run manually to confirm RLS works):
>
> \-- SELECT set_config(\'app.tenant_id\', \'tenant_a_id\', true);
>
> \-- SELECT COUNT(\*) FROM \"Booking\"; \-- must return only tenant_a
> bookings

**Part 2: Implementation Plan --- Day by Day**

Realistic total: 70--100 hours across 35--50 days at 2 hours/day. The
original 56-hour estimate assumed clean runs every session --- that
never happens in practice.

  -----------------------------------------------------------------------
  **Honest hour breakdown:**

  • Backend (auth, API, availability engine, RLS): 25--35 hours

  • Frontend (Next.js, booking flow, admin dashboard): 25--35 hours

  • Email templates + Resend integration: 3--5 hours

  • Deployment (DNS, Vercel, Railway, GitHub Actions): 3--5 hours

  • Bug fixing and integration issues: 10--20 hours --- this is NOT
  optional padding, this WILL happen

  • Total: 70--100 hours. Set this expectation now so you do not feel
  like you are failing at week 5.
  -----------------------------------------------------------------------

  -----------------------------------------------------------------------
  **Rule: every day ends with something that runs.**

  • Not \"I wrote some files\" --- the code must execute without crashing

  • Commit at the end of every session, even if the feature is incomplete

  • If you get stuck for more than 30 minutes, write the question down
  and move on --- come back to it

  • Platform: web-only. No mobile app work in any session. If you find
  yourself writing React Native or Expo code, stop.
  -----------------------------------------------------------------------

**Week 1: Foundation --- Monorepo, DB, Auth**

  --------- ----------- -------------------------------------------- -----------------
  **Day**   **Hours**   **Deliverable**                              **Done When**

  1         2hr         Monorepo scaffolded: pnpm workspaces,        pnpm dev starts
                        turbo.json, apps/web (Next.js), apps/api     both apps with no
                        (Express), packages/db. All packages install errors
                        without errors.                              

  2         2hr         Docker Compose running Postgres locally.     prisma studio
                        Prisma schema created (copy from this doc).  opens and shows
                        prisma migrate dev runs. Database tables     all tables empty
                        created.                                     

  3         2hr         RLS script applied to local DB. Seed script  Verification
                        creates 2 tenants, 1 owner per tenant, 3     SELECT returns 0
                        services per tenant. RLS verified: querying  cross-tenant rows
                        with tenant_a_id returns 0 rows for tenant_b 
                        data.                                        

  4         2hr         Express auth routes: POST /auth/register     curl /auth/login
                        (creates Tenant + User). bcrypt hashing.     returns valid JWT
                        POST /auth/login (returns JWT). POST         
                        /auth/refresh (rotates token).               

  5         2hr         Auth middleware: verifies JWT, sets req.user Protected route
                        and req.tenantId, sets Postgres session      returns 401
                        variable for RLS. Applied to all /admin      without token,
                        routes.                                      200 with it
  --------- ----------- -------------------------------------------- -----------------

**Week 2: Booking Engine + Public API**

  --------- ----------- -------------------------------------------- -----------------
  **Day**   **Hours**   **Deliverable**                              **Done When**

  6         2hr         Schedule CRUD: GET + PUT /admin/schedule.    Postman: update
                        Default schedule auto-created on tenant      schedule, GET
                        registration. Returns correct JSON           returns new
                        structure.                                   values

  7         2hr         Service CRUD: GET, POST, PUT, DELETE (soft)  Create 3 services
                        /admin/services. isActive filter on GET.     via API, list
                        sortOrder support.                           returns all 3

  8         2hr         Availability engine: getAvailableSlots()     Jest: all
                        function written and unit tested. Test       availability test
                        cases: closed day, fully booked, breaks,     cases pass
                        past slots, service duration overlap.        

  9         2hr         Public availability endpoint: GET            curl returns
                        /public/:slug/availability?serviceId&date.   correct slot
                        Fetches schedule + existing bookings for     array for
                        that day, runs availability engine, returns  tomorrow
                        slots array.                                 

  10        2hr         Public booking endpoint: POST                Create booking,
                        /public/:slug/bookings. Validates slot still receive
                        free (race condition check with SELECT FOR   confirmation
                        UPDATE). Creates booking. Triggers Resend    email in inbox
                        confirmation email.                          
  --------- ----------- -------------------------------------------- -----------------

**Week 3: Admin Dashboard + Frontend**

  --------- ----------- -------------------------------------------- -----------------
  **Day**   **Hours**   **Deliverable**                              **Done When**

  11        2hr         Admin booking endpoints: GET /admin/bookings Confirm a booking
                        (with status + date filters), PATCH          via API, customer
                        /admin/bookings/:id (status updates). Emails receives email
                        triggered on status change.                  

  12        2hr         Next.js middleware for subdomain routing.    Two different
                        Test with clinic.localhost:3000 and          tenants load at
                        salon.localhost:3000 in /etc/hosts. Both     two subdomains
                        resolve to correct tenant.                   locally

  13        2hr         Public booking flow UI: service list page →  Complete a
                        date picker → time slot picker.              booking
                        Mobile-first. Connects to live API.          end-to-end
                                                                     through the
                                                                     browser

  14        2hr         Customer details form + confirmation page.   Cancel a booking
                        Cancel via email link flow (GET + POST       via email link,
                        /public/bookings/cancel/:token).             status updates to
                                                                     CANCELLED

  15        2hr         Admin login + dashboard home. JWT stored in  Log in, see
                        React state. Auth token refresh on 401. KPI  today\'s bookings
                        cards + upcoming bookings list.              on dashboard
  --------- ----------- -------------------------------------------- -----------------

**Week 4: Polish, Emails, Deploy**

  --------- ----------- -------------------------------------------- ----------------------
  **Day**   **Hours**   **Deliverable**                              **Done When**

  16        2hr         Admin booking management UI: list with       Admin can confirm and
                        filters, slide-over detail panel,            cancel bookings from
                        confirm/cancel actions with optimistic       the UI
                        updates.                                     

  17        2hr         Services and Schedule management UI. Service Admin can add a
                        CRUD. Schedule form with working days        service and change
                        toggles, time pickers, break window manager. schedule from the UI

  18        2hr         React Email templates for all 5 email types. All 5 email types
                        Templates look professional in               received and look
                        Gmail/Outlook. .ics calendar attachment on   correct in Gmail
                        confirmation email.                          

  19        2hr         Staff invite flow: send invite email,        Invite a staff member,
                        accept-invite endpoint, role-restricted      they log in with
                        dashboard for STAFF role. Branding settings  restricted access
                        page (logo upload, colour picker).           

  20        2hr         Deploy: wildcard DNS on domain, Vercel       Live at
                        (frontend), Railway (API + Postgres), CI/CD  yourname-booking.com
                        GitHub Actions (test → migrate → deploy).    with two demo tenants
                        Seed production DB.                          

  21+       10--20hr    Bug fixing, integration issues, unexpected   All items in the
            BUFFER      blockers. This is NOT optional padding ---   testing checklist
                        DNS propagation alone can take 48hrs. Prisma below pass
                        migration issues, NextAuth subdomain cookie  
                        edge cases, and Resend deliverability        
                        debugging are all common.                    
  --------- ----------- -------------------------------------------- ----------------------

**Critical Implementation Notes**

**Race Condition on Booking Creation --- Requires Both Locking AND
Serializable Isolation**

Between a customer selecting a slot and submitting the form, another
customer could book the same slot. SELECT FOR UPDATE alone is not
sufficient --- SERIALIZABLE isolation level is also required. Without
it, two transactions can both pass the conflict check before either
commits.

> // apps/api/src/routes/bookings.ts
>
> await prisma.\$transaction(
>
> async (tx) =\> {
>
> // SELECT FOR UPDATE: locks conflicting rows
>
> // SKIP LOCKED: treats already-locked rows as conflicts immediately
>
> const conflict = await tx.\$queryRaw\`
>
> SELECT id FROM \"Booking\"
>
> WHERE \"tenantId\" = \${tenantId}
>
> AND status NOT IN (\'CANCELLED\')
>
> AND \"startsAt\" \< \${endsAt}
>
> AND \"endsAt\" \> \${startsAt}
>
> FOR UPDATE SKIP LOCKED
>
> \`;
>
> if (conflict.length \> 0) {
>
> throw new Error(\'SLOT_TAKEN\'); // → 409 response
>
> }
>
> return tx.booking.create({ data: { \...bookingData } });
>
> },
>
> { isolationLevel: \'Serializable\' } // ← mandatory --- without this,
> race condition still possible
>
> );

**All Times Stored as UTC**

The Schedule model stores workStart and workEnd as \"HH:MM\" strings in
the tenant\'s local timezone. All Booking.startsAt and endsAt are stored
as UTC DateTime in Postgres. The availability engine converts using
date-fns-tz. Never store local time in the database.

**Email Failures Must Not Fail the Booking**

Wrap all Resend calls in try-catch. A booking must be created even if
the email fails. Log the failure and implement a retry mechanism --- the
simplest approach is a cron job that checks for bookings created in the
last hour with no confirmation email sent (add a confirmationEmailSentAt
column).

**Testing Checklist Before Demo**

  -----------------------------------------------------------------------
  **Run through every item before showing to any client or hiring
  manager:**

  • 1. Create a new tenant at yourdomain.com/register --- verify
  subdomain works

  • 2. Add 3 services, configure schedule with a lunch break

  • 3. Complete a full customer booking in a real mobile phone browser
  (375px) --- verify email received with .ics

  • 4. Admin logs in, confirms the booking --- verify customer receives
  confirmation email

  • 5. Cancel via email link --- verify status updates and both
  customer + admin receive cancellation emails

  • 6. Invite a staff member --- verify they log in with restricted
  access (no Services/Schedule tabs)

  • 7. Create two tenants, confirm Tenant A cannot see Tenant B\'s
  bookings --- this is the RLS verification

  • 8. Run concurrent booking test: 50 simultaneous requests to same slot
  --- verify exactly 1 succeeds. DO NOT claim double-booking prevention
  without passing this test.

  • 9. Temporarily disable Resend API key --- verify booking still
  creates (email failure must not block booking)

  • 10. Check all emails render correctly in Gmail on a real mobile phone

  • 11. Confirm there is zero React Native, Expo, or app store code in
  the repository --- all three projects are web-only

  • 12. First outreach target: personal trainer, yoga studio, tutor,
  photographer, or consultant --- not a clinic
  -----------------------------------------------------------------------

*--- End of Backend Schema & Implementation Plan ---*
