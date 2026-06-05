**FEATURE BUILD GUIDE**

BookingOS · booking.virajdomadia.com

12 features · \~83 hours · project setup to production

  -----------------------------------------------------------------------
  **How to use this document**

  Each feature is a vertical slice --- it touches DB, API, and frontend
  together.

  Build features in order. Each feature has a DONE WHEN section --- do
  not move to the

  next feature until every item in it passes. This is how you avoid
  carrying forward

  broken assumptions that cost 3x the time to fix later.

  Time estimates are per feature, not per day. Work at your own pace.

  When stuck for more than 30 minutes --- write the question, move to a
  smaller task within

  the same feature, come back to the blocker fresh.

  -----------------------------------------------------------------------

**Feature Overview**

  ---------------------------------------------------------------------------------
  **ID**    **Feature**                          **Est.**   **Depends   **Layer**
                                                            On**        
  --------- ------------------------------------ ---------- ----------- -----------
  **F0**    Project Setup & Infrastructure       6--8 hrs   None        DB + Config

  **F1**    Auth --- Register, Login, Tokens     8--10 hrs  F0          DB + API +
                                                                        UI

  **F2**    Tenant & Schedule Management         6--8 hrs   F1          API + UI

  **F3**    Service Management                   4--6 hrs   F1          API + UI

  **F4**    Public Booking Flow                  14--18 hrs F2 + F3     API + UI

  **F5**    Admin Booking Management             8--10 hrs  F4          API + UI

  **F6**    Email Notifications                  6--8 hrs   F4 + F5     API + Email

  **F7**    Customer Cancel via Email Link       4--5 hrs   F6          API + UI

  **F8**    Staff Management                     5--6 hrs   F1 + F6     API + UI

  **F9**    24hr Reminder Cron                   2--3 hrs   F6          API

  **F10**   Super Admin Panel                    4--5 hrs   F1          API + UI

  **F11**   Deploy & Go Live                     6--8 hrs   All         DevOps
  ---------------------------------------------------------------------------------

Total realistic estimate: 73--87 hours. Add 10--20 hours bug-fixing
buffer from the implementation plan = 83--107 hours total.

+---------+-----------------------------------------+--------+--------+
| **F0**  | **Project Setup & Infrastructure**      | Est.   | Needs  |
|         |                                         |        |        |
|         |                                         | **6--8 | **     |
|         |                                         | hrs**  | None** |
+---------+-----------------------------------------+--------+--------+

Everything that must exist before a single line of application code
runs. Get this right once and never touch it again.

**MONOREPO & TOOLING**

-   Init repo: git init, create root package.json with pnpm workspaces

-   Create pnpm-workspace.yaml pointing to apps/\* and packages/\*

-   Scaffold folders: apps/web (Next.js 14), apps/api (Express),
    packages/db, packages/types, packages/utils

-   Root package.json scripts: dev (concurrently), dev:api, dev:web,
    db:migrate, db:studio

-   TypeScript config: root tsconfig.json with path aliases, each
    app/package extends it

-   Install concurrently at root for running both apps simultaneously

**DATABASE**

-   docker-compose.yml: Postgres 15 container, port 5432, named volume
    for persistence

-   packages/db: Prisma schema (copy from 05_Schema_ImplPlan.docx
    verbatim)

-   packages/db: package.json with prisma commands (migrate, studio,
    generate)

-   Run prisma migrate dev --- verify all 5 tables created (Tenant,
    User, Service, Booking, Schedule)

-   packages/db/scripts/rls.sql --- copy from 06_Security_Access.docx

-   Apply RLS script to local DB: psql \$DATABASE_URL \<
    packages/db/scripts/rls.sql

**SEED DATA**

-   packages/db/seed.ts --- creates 2 tenants (demo-clinic, demo-salon)

```{=html}
<!-- -->
```
-   Each tenant: 1 owner user (bcrypt hashed password), 3 services, 1
    schedule (defaults)

-   Use realistic names: Dr. Anita\'s Clinic / Style Studio

```{=html}
<!-- -->
```
-   Run seed: pnpm \--filter db seed

-   Verify in Prisma Studio: both tenants visible, services correct,
    schedules present

**ENVIRONMENT VARIABLES**

-   Create .env.example at repo root documenting all required variables

-   Create .env files in apps/api and apps/web (gitignored)

-   Generate secrets: openssl rand -hex 32 for JWT_SECRET and
    JWT_REFRESH_SECRET

-   Verify DATABASE_URL connects: npx prisma db pull should succeed

**RLS VERIFICATION (CRITICAL --- DO NOT SKIP)**

-   Open psql or any Postgres client connected to local DB

-   Run: SELECT set_config(\'app.tenant_id\', \'\<demo-clinic-id\>\',
    true);

-   Run: SELECT COUNT(\*) FROM \"Booking\" WHERE \"tenantId\" =
    \'\<demo-salon-id\>\';

-   Expected result: 0. If result \> 0, RLS is not applied --- re-run
    rls.sql before proceeding

  -----------------------------------------------------------------------
  **DONE WHEN --- all of these pass before moving to next feature**

  **✓** pnpm dev starts both apps/web (port 3000) and apps/api (port
  4000) with no errors

  **✓** Prisma Studio opens and shows Tenant, User, Service, Booking,
  Schedule tables with seed data

  **✓** RLS cross-tenant query returns 0 rows

  **✓** .env.example documents every variable, .env files are gitignored

  **✓** docker compose up starts Postgres, docker compose down stops it
  cleanly

  -----------------------------------------------------------------------

+---------+-----------------------------------------+--------+--------+
| **F1**  | **Auth --- Register, Login, Token       | Est.   | Needs  |
|         | Flow**                                  |        |        |
|         |                                         | *      | **F0** |
|         |                                         | *8--10 |        |
|         |                                         | hrs**  |        |
+---------+-----------------------------------------+--------+--------+

The auth system is the skeleton everything else attaches to. Custom JWT
on Express only --- no NextAuth. Get this right before building any
protected feature.

**EXPRESS API --- AUTH ROUTES**

-   POST /auth/register

```{=html}
<!-- -->
```
-   Validate body with Zod: businessName, slug, email, password

-   Check slug uniqueness (return 409 if taken)

-   Check email uniqueness (return 409 if taken)

-   Create Tenant, User (OWNER, bcrypt 12 rounds), default Schedule in a
    Prisma transaction

-   Return access token + set refresh cookie

```{=html}
<!-- -->
```
-   POST /auth/login

```{=html}
<!-- -->
```
-   Find user by email, compare bcrypt hash

-   Issue JWT access token (15min, payload: { userId, tenantId, role })

-   Generate opaque refresh token UUID, store in DB with 7-day expiry

-   Set httpOnly Secure SameSite=Strict cookie (domain:
    .virajdomadia.com in prod, undefined locally)

```{=html}
<!-- -->
```
-   POST /auth/refresh

```{=html}
<!-- -->
```
-   Read refresh_token cookie

-   Find in DB, verify not expired

-   Delete old token, create new one (rotation)

-   Issue new access token, set new cookie

```{=html}
<!-- -->
```
-   POST /auth/logout --- delete refresh token from DB, clear cookie

**EXPRESS --- AUTH MIDDLEWARE**

-   authMiddleware: extract Bearer token, jwt.verify, set req.user and
    req.tenantId

-   Set Postgres RLS context: SELECT set_config(\'app.tenant_id\',
    \${tenantId}, true)

-   Return 401 if no token, 401 if invalid/expired

-   Apply to all /admin/\* routes

-   requireRole(\...roles) middleware: check req.user.role, return 403
    if insufficient

**NEXT.JS FRONTEND --- AUTH**

-   AuthContext (apps/web/src/context/auth.tsx)

```{=html}
<!-- -->
```
-   State: accessToken (string\|null), user ({userId, tenantId,
    role}\|null)

-   Actions: login(), logout(), silentRefresh()

-   useEffect on mount: attempt silentRefresh() so page refresh keeps
    user logged in

```{=html}
<!-- -->
```
-   Axios instance (apps/web/src/lib/api.ts)

```{=html}
<!-- -->
```
-   baseURL: NEXT_PUBLIC_API_URL, withCredentials: true

-   Request interceptor: attach Authorization: Bearer \<token\> header

-   Response interceptor: on 401, call /auth/refresh, retry original
    request

-   On refresh failure: redirect to /book/\[slug\]/admin/login

```{=html}
<!-- -->
```
-   Admin login page: /book/\[slug\]/admin/login

```{=html}
<!-- -->
```
-   Email + password form, single column

-   On submit: call login(), redirect to /book/\[slug\]/admin on success

-   Error state: \'Invalid email or password\' inline message

```{=html}
<!-- -->
```
-   Route guard: /book/\[slug\]/admin/\* pages check AuthContext,
    redirect to login if no token

**RATE LIMITING**

-   Install express-rate-limit

-   POST /auth/login: max 10 requests per 15 minutes per IP

-   POST /auth/register: max 5 requests per 60 minutes per IP

  -----------------------------------------------------------------------
  **DONE WHEN --- all of these pass before moving to next feature**

  **✓** curl POST /auth/register creates tenant, returns JWT, sets
  httpOnly cookie

  **✓** curl POST /auth/login with wrong password returns 401

  **✓** curl GET /admin/bookings without token returns 401

  **✓** curl GET /admin/bookings with valid token returns 200 (empty
  array is fine)

  **✓** Refresh token visible in browser DevTools cookies as httpOnly ---
  not readable via document.cookie

  **✓** Page refresh on /book/demo-clinic/admin stays logged in
  (silentRefresh working)

  **✓** 11 rapid login attempts from same IP: 11th returns 429

  **✓** RLS context set: console.log(req.tenantId) in a protected route
  prints correct tenant ID

  -----------------------------------------------------------------------

+---------+-----------------------------------------+--------+--------+
| **F2**  | **Tenant & Schedule Management**        | Est.   | Needs  |
|         |                                         |        |        |
|         |                                         | **6--8 | **F1** |
|         |                                         | hrs**  |        |
+---------+-----------------------------------------+--------+--------+

The schedule is the source of truth for availability. Nothing in F4
(booking flow) works correctly until the schedule is configurable and
saved properly.

**EXPRESS API --- SCHEDULE**

-   GET /admin/schedule --- return tenant\'s schedule (created by
    default in F1 registration)

-   PUT /admin/schedule --- update all schedule fields

```{=html}
<!-- -->
```
-   Validate with Zod: workingDays object, workStart/workEnd HH:MM
    strings, slotInterval number, breakTimes array, bufferTime number,
    timezone string

-   Validate workStart \< workEnd

-   Validate break times don\'t overlap each other

```{=html}
<!-- -->
```
-   GET /admin/tenant --- return tenant name, logoUrl, primaryColor

-   PUT /admin/tenant --- update name, logoUrl, primaryColor

**NEXT.JS FRONTEND --- SCHEDULE SETTINGS**

-   Schedule settings page: /book/\[slug\]/admin/schedule

-   Working days: 7 toggle chips (Mon--Sun), active = brand colour,
    inactive = grey

-   Work start / work end: time picker inputs (HH:MM, 15-min increments)

-   Slot interval: dropdown (15 / 30 / 45 / 60 min)

-   Buffer time: dropdown (0 / 5 / 10 / 15 min)

-   Break windows manager:

```{=html}
<!-- -->
```
-   List of existing breaks with delete button

-   \'Add Break\' button → two time pickers (start, end) + confirm

-   Validate: break end must be after break start

```{=html}
<!-- -->
```
-   Save button: PUT /admin/schedule, success toast, error toast on
    failure

-   Unsaved changes warning: if user navigates away with unsaved
    changes, show browser confirm dialog

**EXPRESS API --- TENANT BRANDING**

-   PUT /admin/tenant: update name, primaryColor

-   Logo upload: accept multipart/form-data, store as base64 string in
    logoUrl (V1 simplification --- no S3)

**NEXT.JS FRONTEND --- BRANDING SETTINGS**

-   Branding settings page: /book/\[slug\]/admin/settings

-   Business name input

-   Primary colour: hex input + colour swatch preview

-   Logo upload: file input, preview thumbnail after selection

-   Save: PUT /admin/tenant

  -----------------------------------------------------------------------
  **DONE WHEN --- all of these pass before moving to next feature**

  **✓** GET /admin/schedule returns default schedule (Mon--Sat,
  09:00--18:00, 30min slots)

  **✓** Update schedule via UI: change Tuesday to OFF, save, reload page
  --- Tuesday still OFF

  **✓** Add a lunch break 13:00--14:00, save --- break persists on reload

  **✓** Update primary colour, save --- colour updates in UI immediately

  **✓** Invalid schedule (workEnd before workStart) shows validation
  error, does not save

  -----------------------------------------------------------------------

+---------+-----------------------------------------+--------+--------+
| **F3**  | **Service Management**                  | Est.   | Needs  |
|         |                                         |        |        |
|         |                                         | **4--6 | **F1** |
|         |                                         | hrs**  |        |
+---------+-----------------------------------------+--------+--------+

Services are what customers book. Simple CRUD but the isActive
soft-delete and sortOrder fields matter for the booking flow.

**EXPRESS API --- SERVICES**

-   GET /admin/services --- return all services for tenant (active and
    inactive), ordered by sortOrder

-   POST /admin/services --- create service

```{=html}
<!-- -->
```
-   Zod validation: name (required), description (optional), duration
    (15\|30\|45\|60\|90\|120), price (optional float), sortOrder
    (default: count of existing + 1)

```{=html}
<!-- -->
```
-   PUT /admin/services/:id --- update any field

-   DELETE /admin/services/:id --- soft delete: set isActive = false
    (never hard delete --- bookings reference services)

-   PATCH /admin/services/:id/restore --- set isActive = true

**NEXT.JS FRONTEND --- SERVICES**

-   Services list page: /book/\[slug\]/admin/services

-   Two sections: Active Services, Inactive Services (collapsed by
    default)

-   Each service row: name, duration badge, price (if set), edit button,
    deactivate button

-   \'Add Service\' button → slide-over panel from right

```{=html}
<!-- -->
```
-   Fields: Name, Description (textarea), Duration (dropdown), Price
    (optional, with currency label)

-   POST /admin/services on submit, new service appears at bottom of
    list

```{=html}
<!-- -->
```
-   Edit button → same slide-over pre-filled with existing data, PUT on
    submit

-   Deactivate: confirm modal (\'Customers won\'t be able to book this
    service. Existing bookings are unaffected.\'), then DELETE

-   Empty state: \'No services yet --- add your first service to start
    accepting bookings\'

  -----------------------------------------------------------------------
  **DONE WHEN --- all of these pass before moving to next feature**

  **✓** Create 3 services via UI, all appear in list with correct
  duration and price

  **✓** Edit a service name, save, reload --- new name persists

  **✓** Deactivate a service --- it moves to Inactive section, no longer
  appears in GET /public/:slug/services

  **✓** Attempt to create service with no name --- inline validation
  error, form does not submit

  **✓** GET /public/demo-clinic/services returns only active services
  (test via curl before F4)

  -----------------------------------------------------------------------

+---------+-----------------------------------------+--------+--------+
| **F4**  | **Public Booking Flow**                 | Est.   | Needs  |
|         |                                         |        |        |
|         |                                         | **     | **F2 + |
|         |                                         | 14--18 | F3**   |
|         |                                         | hrs**  |        |
+---------+-----------------------------------------+--------+--------+

The most important feature. This is what customers use. Every edge case
here costs you a real booking if you ship it wrong. Build it slowly.
Test it on a real mobile phone before marking done.

**AVAILABILITY ENGINE (PACKAGES/UTILS)**

-   getAvailableSlots(date, schedule, existingBookings,
    serviceDuration): SlotArray

```{=html}
<!-- -->
```
-   Return empty array if date is a closed working day

-   Generate slots from workStart to workEnd at slotInterval increments

-   Filter: skip past slots (slot start \<= now)

-   Filter: skip booked slots (overlap check: cursor \< b.endsAt &&
    slotEnd \> b.startsAt)

-   Filter: skip break time slots (same overlap check against breakTimes
    array)

-   Apply bufferTime: treat each existing booking as endsAt + bufferTime
    for overlap check

-   All times converted using date-fns-tz with schedule.timezone

```{=html}
<!-- -->
```
-   Unit tests (Jest) --- all must pass before building the API
    endpoint:

```{=html}
<!-- -->
```
-   Returns empty array for a closed day

-   Returns empty array when all slots are booked

-   Lunch break (13:00--14:00) blocks correct slots

-   Past slots not returned (mock \'now\' to a fixed time)

-   60-minute service only fits in correct slots given slot interval

-   Buffer time adds gap after existing bookings

**EXPRESS API --- PUBLIC ENDPOINTS**

-   GET /public/:slug/services

```{=html}
<!-- -->
```
-   Find tenant by slug --- return 404 if not found or isActive=false

-   Return active services + tenant branding (name, logoUrl,
    primaryColor)

```{=html}
<!-- -->
```
-   GET /public/:slug/availability?serviceId=X&date=YYYY-MM-DD

```{=html}
<!-- -->
```
-   Fetch schedule for tenant

-   Fetch existing bookings for that date (status NOT IN CANCELLED)

-   Run getAvailableSlots(), return array of {start, end} in ISO strings

-   Return empty array (not 404) if no slots available

```{=html}
<!-- -->
```
-   POST /public/:slug/bookings

```{=html}
<!-- -->
```
-   Zod validation: serviceId, startsAt (ISO datetime), customerName,
    customerEmail, customerPhone (optional), notes (optional)

-   Calculate endsAt = startsAt + service.duration

-   SERIALIZABLE transaction + SELECT FOR UPDATE SKIP LOCKED conflict
    check

-   Return 409 { error: \'SLOT_TAKEN\' } if conflict found

-   Create booking, trigger confirmation email (non-blocking try-catch)

-   Return created booking with id and cancelToken

**NEXT.JS FRONTEND --- BOOKING PAGES**

-   Service list page: /book/\[slug\]/page.tsx

```{=html}
<!-- -->
```
-   Fetch tenant branding + services from /public/:slug/services

-   Show tenant logo + name in header

-   Service list: full-width tap targets, min 56px height, name +
    duration + price

-   Loading skeleton: 3 grey pill-height blocks

-   404 state: tenant not found or inactive

```{=html}
<!-- -->
```
-   Date picker page: /book/\[slug\]/\[serviceId\]/date/page.tsx

```{=html}
<!-- -->
```
-   Calendar grid (custom, not native input --- Android native is
    inconsistent)

-   Past dates disabled (grey)

-   Prefetch availability for next 14 days to grey out fully-booked
    dates

-   Selected date highlighted in brand colour

```{=html}
<!-- -->
```
-   Slot picker page: /book/\[slug\]/\[serviceId\]/slots/page.tsx

```{=html}
<!-- -->
```
-   Fetch /public/:slug/availability?serviceId&date on mount

-   Loading skeleton: 4 grey pill shapes in 2-column grid

-   Slot pills in 2-column grid, JetBrains Mono font for times

-   Empty state: \'No times available on \[date\] --- try another day\'
    with back link

-   Selected slot highlighted

```{=html}
<!-- -->
```
-   Customer details page: /book/\[slug\]/\[serviceId\]/details/page.tsx

```{=html}
<!-- -->
```
-   Single column form: Name (required), Email (required), Phone
    (optional --- labelled), Notes (optional --- labelled)

-   Inline validation on blur (not on submit)

-   No asterisks --- optional fields explicitly labelled \'(optional)\'

-   Submit: POST /public/:slug/bookings

-   409 response: \'This slot was just taken --- choose another time.\'
    → redirect back to slots page

```{=html}
<!-- -->
```
-   Confirmation page: /book/\[slug\]/\[serviceId\]/confirm/page.tsx

```{=html}
<!-- -->
```
-   Full-screen success state --- not a toast

-   Booking summary card: service, date, time, name, email

-   Unique booking reference (booking.id truncated to 8 chars)

-   \'Add to calendar\' hint (email has the .ics)

**CRITICAL UX REQUIREMENTS**

-   Each step is a real URL --- browser back button navigates correctly
    through all steps

-   State is passed via URL params or sessionStorage --- not React state
    that dies on back navigation

-   Tenant branding (primaryColor) applied to CTA buttons and selected
    states

-   All pages work at 375px viewport --- test in real phone browser, not
    DevTools

  -----------------------------------------------------------------------
  **DONE WHEN --- all of these pass before moving to next feature**

  **✓** All 6 availability engine unit tests pass (npx jest)

  **✓** Complete booking end-to-end in a real mobile phone browser ---
  not DevTools emulation

  **✓** Browser back button from each step returns to previous step
  correctly

  **✓** Fully-booked date shows as grey in calendar

  **✓** Empty availability returns \'No times available\' message, not a
  blank page

  **✓** Submit booking, immediately submit same slot in another tab ---
  second gets \'slot just taken\' message

  **✓** Confirmation page shows correct booking details

  **✓** GET /public/demo-clinic/services returns 404 for a slug that does
  not exist

  -----------------------------------------------------------------------

+---------+-----------------------------------------+--------+--------+
| **F5**  | **Admin Booking Management**            | Est.   | Needs  |
|         |                                         |        |        |
|         |                                         | *      | **F4** |
|         |                                         | *8--10 |        |
|         |                                         | hrs**  |        |
+---------+-----------------------------------------+--------+--------+

The admin\'s primary daily tool. Design for speed --- Dr. Anita should
be able to confirm her morning bookings in under 2 minutes.

**EXPRESS API --- ADMIN BOOKINGS**

-   GET /admin/bookings

```{=html}
<!-- -->
```
-   Query params: status (optional), date (optional, YYYY-MM-DD),
    serviceId (optional), page (default 1), limit (default 20)

-   Include: service name, customer details

-   Order by startsAt ASC

```{=html}
<!-- -->
```
-   GET /admin/bookings/today --- shortcut for today\'s bookings (used
    by dashboard KPIs)

-   PATCH /admin/bookings/:id

```{=html}
<!-- -->
```
-   status: CONFIRMED --- allowed from PENDING only

-   status: CANCELLED --- allowed from PENDING or CONFIRMED. Require
    cancelReason in body.

-   status: COMPLETED --- allowed from CONFIRMED only

-   status: NO_SHOW --- allowed from CONFIRMED only

-   adminNotes: update internal notes (any status)

-   Trigger appropriate email on status change (non-blocking)

**NEXT.JS FRONTEND --- DASHBOARD HOME**

-   Dashboard home: /book/\[slug\]/admin/page.tsx

-   4 KPI cards (top row):

```{=html}
<!-- -->
```
-   Today\'s Bookings (count)

-   This Week (count)

-   Pending Confirmation (count, amber if \> 0)

-   Next Booking (time + customer name, or \'None today\')

```{=html}
<!-- -->
```
-   Upcoming bookings list (next 5): time, customer name, service,
    status badge

-   Quick actions: \'View all bookings\' link

-   Loading: skeleton cards matching KPI shape

**NEXT.JS FRONTEND --- BOOKINGS LIST**

-   Bookings list page: /book/\[slug\]/admin/bookings/page.tsx

-   Filter bar: date range picker, status chips (All \| Pending \|
    Confirmed \| Cancelled \| Completed), service dropdown

-   Table columns: Time, Customer Name, Service, Status Badge, Actions

-   Status badges: Pending (amber), Confirmed (green), Cancelled (red),
    Completed (grey), No-Show (grey)

-   confirmationEmailStatus badge: small dot on row if email FAILED

-   Pagination: previous/next, show \'X--Y of Z bookings\'

-   Click any row → slide-over panel from right (do not navigate to new
    page)

**NEXT.JS FRONTEND --- BOOKING DETAIL SLIDE-OVER**

-   Customer: name, email, phone (click to copy), notes

-   Booking: service, date, time, duration, booking reference, created
    at

-   Status badge + current status

-   Admin notes: textarea, auto-saves on blur

-   Action buttons (shown based on current status):

```{=html}
<!-- -->
```
-   PENDING: \'Confirm Booking\' (green), \'Cancel\' (red)

-   CONFIRMED: \'Mark Complete\' (grey), \'Mark No-Show\' (grey),
    \'Cancel\' (red)

-   CANCELLED / COMPLETED / NO_SHOW: no action buttons

```{=html}
<!-- -->
```
-   Cancel action: modal with reason textarea (optional), confirm button

-   Optimistic updates: badge changes immediately, API fires in
    background, reverts on failure with error toast

  -----------------------------------------------------------------------
  **DONE WHEN --- all of these pass before moving to next feature**

  **✓** Dashboard KPIs show correct counts for seed data bookings

  **✓** Filter by status=PENDING returns only pending bookings

  **✓** Confirm a booking from UI --- status badge updates immediately
  (optimistic), API call succeeds

  **✓** Cancel a booking with reason --- status updates, cancelReason
  stored in DB

  **✓** Admin notes save on blur --- reload page, notes still there

  **✓** Email failure badge visible on a booking where
  confirmationEmailStatus=FAILED

  **✓** Attempting to confirm a CANCELLED booking returns 400 (invalid
  transition)

  -----------------------------------------------------------------------

+---------+-----------------------------------------+--------+--------+
| **F6**  | **Email Notifications**                 | Est.   | Needs  |
|         |                                         |        |        |
|         |                                         | **6--8 | **F4 + |
|         |                                         | hrs**  | F5**   |
+---------+-----------------------------------------+--------+--------+

Email is the only communication channel with customers. Every email must
look professional and render correctly on mobile Gmail. Build all
templates before wiring any of them up.

**REACT EMAIL TEMPLATES (APPS/API/SRC/EMAILS/)**

-   booking-confirmation.tsx --- sent to customer when booking created

```{=html}
<!-- -->
```
-   Content: service name, date, time, customer name, booking reference,
    cancel link

-   .ics calendar attachment (see below)

```{=html}
<!-- -->
```
-   booking-confirmed.tsx --- sent to customer when admin confirms

```{=html}
<!-- -->
```
-   Content: \'Your booking is confirmed\', same booking details

```{=html}
<!-- -->
```
-   booking-cancelled.tsx --- sent to customer when cancelled (by admin
    or self)

```{=html}
<!-- -->
```
-   Content: \'Your booking has been cancelled\', cancelReason if
    present, rebook link

```{=html}
<!-- -->
```
-   booking-reminder.tsx --- 24hr before appointment (sent by cron in
    F9)

```{=html}
<!-- -->
```
-   Content: reminder of date/time, cancel link, \'see you tomorrow\'
    tone

```{=html}
<!-- -->
```
-   admin-new-booking.tsx --- sent to tenant owner when new booking
    created

```{=html}
<!-- -->
```
-   Content: customer name, service, date/time, phone, notes

```{=html}
<!-- -->
```
-   admin-cancellation.tsx --- sent to tenant owner when booking
    cancelled

```{=html}
<!-- -->
```
-   Content: customer name, which booking, cancel reason

```{=html}
<!-- -->
```
-   staff-invite.tsx --- sent when owner invites a staff member (used in
    F8)

```{=html}
<!-- -->
```
-   Content: inviter name, business name, set-password link with invite
    token

**.ICS CALENDAR ATTACHMENT**

-   Install ical-generator package

-   Generate .ics content for each booking: summary (service name),
    dtstart, dtend, location (business name), description (booking
    reference)

-   Attach to booking-confirmation email as base64 encoded attachment

-   Test: .ics file opens correctly in Google Calendar and iPhone
    Calendar

**EMAIL SERVICE (APPS/API/SRC/SERVICES/EMAIL.TS)**

-   Single sendEmail(type, data) function --- all email sends go through
    here

-   Every call wrapped in try-catch --- email failure NEVER throws

-   On success: update booking.confirmationEmailStatus = \'SENT\' (for
    confirmation emails)

-   On failure: update booking.confirmationEmailStatus = \'FAILED\',
    console.error with booking ID

-   Send confirmation email immediately after booking creation (in POST
    /public/:slug/bookings)

-   Send admin-new-booking email immediately after booking creation

-   Send booking-confirmed email after PATCH status to CONFIRMED

-   Send booking-cancelled email (to customer AND admin) after PATCH
    status to CANCELLED

**RESEND CONFIGURATION**

-   RESEND_API_KEY in apps/api .env

-   From address: bookings@yourdomain.com (must match verified Resend
    domain)

-   Verify Resend domain DNS records before testing --- takes up to
    24hrs

  -----------------------------------------------------------------------
  **DONE WHEN --- all of these pass before moving to next feature**

  **✓** Create a booking --- confirmation email received in inbox within
  30 seconds

  **✓** .ics attachment opens in Google Calendar with correct date, time,
  and event name

  **✓** Confirm a booking from admin --- customer receives confirmed
  email

  **✓** Cancel a booking from admin --- customer AND admin receive
  cancellation emails

  **✓** All 6 email types render correctly in Gmail on a real mobile
  phone (not DevTools)

  **✓** Temporarily set RESEND_API_KEY to an invalid value --- booking
  still creates, confirmationEmailStatus = FAILED in DB

  **✓** Admin dashboard shows email failure badge on the booking from
  above test

  -----------------------------------------------------------------------

+---------+-----------------------------------------+--------+--------+
| **F7**  | **Customer Cancel via Email Link**      | Est.   | Needs  |
|         |                                         |        |        |
|         |                                         | **4--5 | **F6** |
|         |                                         | hrs**  |        |
+---------+-----------------------------------------+--------+--------+

Customers cancel themselves. This reduces admin workload and is a key
selling point. The cancelToken is the only authentication needed.

**EXPRESS API**

-   GET /public/bookings/cancel/:token

```{=html}
<!-- -->
```
-   Find booking by cancelToken

-   Return 404 { error: \'INVALID_TOKEN\' } if not found

-   Return booking details: service name, date/time, customer name,
    status

```{=html}
<!-- -->
```
-   POST /public/bookings/cancel/:token

```{=html}
<!-- -->
```
-   Find booking by cancelToken

-   Return 404 if not found

-   Return 400 { error: \'ALREADY_CANCELLED\' } if status is already
    CANCELLED

-   Return 400 { error: \'CANNOT_CANCEL\' } if status is COMPLETED or
    NO_SHOW

-   Update status to CANCELLED, set cancelReason = \'Cancelled by
    customer\'

-   Send booking-cancelled email to customer and admin (non-blocking)

**NEXT.JS FRONTEND**

-   Cancel page: /cancel/\[token\]/page.tsx

-   On load: GET /public/bookings/cancel/:token

```{=html}
<!-- -->
```
-   Loading state: spinner

-   Invalid token: \'This cancellation link is invalid or has already
    been used.\'

-   Already cancelled: \'This booking is already cancelled.\'

-   Valid: show booking summary card + single large \'Cancel this
    booking\' button

```{=html}
<!-- -->
```
-   On confirm: POST /public/bookings/cancel/:token

```{=html}
<!-- -->
```
-   Success: \'Your booking has been cancelled.\' + \'Book again\' link
    back to service list

-   Error: generic error message + \'contact us\' fallback

```{=html}
<!-- -->
```
-   No login required --- the cancel page is fully public

  -----------------------------------------------------------------------
  **DONE WHEN --- all of these pass before moving to next feature**

  **✓** Click cancel link in confirmation email --- cancel page loads
  with correct booking details

  **✓** Confirm cancellation --- status updates to CANCELLED in DB

  **✓** Both customer and admin receive cancellation emails

  **✓** Click same cancel link again --- \'already cancelled\' message,
  no duplicate processing

  **✓** Manually change token in URL to a random string --- \'invalid
  link\' message, 404 from API

  **✓** \'Book again\' link goes back to the correct tenant\'s service
  list

  -----------------------------------------------------------------------

+---------+-----------------------------------------+--------+--------+
| **F8**  | **Staff Management**                    | Est.   | Needs  |
|         |                                         |        |        |
|         |                                         | **5--6 | **F1 + |
|         |                                         | hrs**  | F6**   |
+---------+-----------------------------------------+--------+--------+

Staff accounts let the business owner delegate booking management
without giving away full admin access. Role restrictions are enforced
both on the API and in the UI.

**EXPRESS API**

-   POST /admin/staff/invite

```{=html}
<!-- -->
```
-   requireRole(\'OWNER\', \'ADMIN\')

-   Zod: email (required), role (ADMIN \| STAFF)

-   Check: email not already a user in this tenant (409 if exists)

-   Create User with role, isActive=false, inviteToken (cuid()),
    inviteExpiry (48hrs from now)

-   Send staff-invite email with link: /accept-invite/\[inviteToken\]

```{=html}
<!-- -->
```
-   POST /auth/accept-invite

```{=html}
<!-- -->
```
-   Zod: token (required), password (required, min 8 chars)

-   Find user by inviteToken

-   Return 400 if token not found, expired, or already used

-   Set passwordHash (bcrypt), isActive=true, clear inviteToken and
    inviteExpiry

-   Return access token + set refresh cookie (user is now logged in)

```{=html}
<!-- -->
```
-   GET /admin/staff --- list all users for tenant (id, name, email,
    role, isActive, lastLoginAt)

-   PATCH /admin/staff/:id

```{=html}
<!-- -->
```
-   requireRole(\'OWNER\', \'ADMIN\')

-   Can update: role, isActive

-   Cannot demote or deactivate the OWNER account

-   Cannot change own role

**NEXT.JS FRONTEND --- STAFF PAGE**

-   Staff page: /book/\[slug\]/admin/staff/page.tsx

-   Only visible to OWNER and ADMIN roles (hide from STAFF)

-   Staff list: name, email, role badge, active status, last login

-   \'Invite Staff\' button → slide-over: email input + role dropdown
    (Admin / Staff) + send button

-   Deactivate toggle: confirm modal, PATCH isActive=false

-   Role change dropdown: inline, PATCH on change

**ROLE-RESTRICTED DASHBOARD (STAFF ROLE)**

-   STAFF users see: Bookings list + detail (view, confirm, complete,
    add notes only)

-   STAFF users do NOT see: Services, Schedule, Staff, Settings nav
    items

-   STAFF users cannot cancel bookings (button hidden in UI, 403 from
    API)

-   Enforce both in the UI (hide elements) AND in the API (requireRole
    middleware)

**ACCEPT INVITE PAGE**

-   Accept invite page: /accept-invite/\[token\]/page.tsx

-   On load: validate token exists (GET /auth/accept-invite/:token for
    validation only)

```{=html}
<!-- -->
```
-   Invalid/expired token: \'This invitation link is invalid or has
    expired.\'

```{=html}
<!-- -->
```
-   Valid: show \'Set your password\' form (password + confirm password)

-   On submit: POST /auth/accept-invite, redirect to admin dashboard on
    success

  -----------------------------------------------------------------------
  **DONE WHEN --- all of these pass before moving to next feature**

  **✓** Owner invites staff via UI --- invite email received within 30
  seconds

  **✓** Staff clicks link, sets password, is redirected to admin
  dashboard

  **✓** Staff dashboard: Services, Schedule, Staff, Settings nav items
  are hidden

  **✓** Staff attempts DELETE /admin/services/:id via curl with staff JWT
  --- returns 403

  **✓** Invite the same email twice --- second invite returns 409
  conflict

  **✓** Use an expired invite link (manually set inviteExpiry in past)
  --- error shown

  **✓** Owner deactivates staff account --- staff JWT returns 401 on next
  request

  -----------------------------------------------------------------------

+---------+-----------------------------------------+--------+--------+
| **F9**  | **24hr Reminder Cron**                  | Est.   | Needs  |
|         |                                         |        |        |
|         |                                         | **2--3 | **F6** |
|         |                                         | hrs**  |        |
+---------+-----------------------------------------+--------+--------+

The cron job runs inside the Express process using node-cron. No Redis,
no external queue. Simple and sufficient for V1.

**IMPLEMENTATION**

-   Install node-cron

-   Create apps/api/src/jobs/reminder.ts

-   Schedule: runs every hour (cron: \'0 \* \* \* \*\')

-   Query: find bookings where

```{=html}
<!-- -->
```
-   status = CONFIRMED

-   reminderSentAt IS NULL

-   startsAt is between NOW + 20 hours and NOW + 28 hours

-   (8-hour window prevents double-sending if cron runs slightly
    early/late)

```{=html}
<!-- -->
```
-   For each booking: send booking-reminder email, set reminderSentAt =
    now()

-   Wrap entire job in try-catch --- cron failure must not crash Express
    process

-   Log: \'Reminder sent for booking \[id\]\' on success, error log on
    failure

-   Register cron job in apps/api/src/app.ts on server start

  -----------------------------------------------------------------------
  **DONE WHEN --- all of these pass before moving to next feature**

  **✓** Create a confirmed booking with startsAt = now + 24 hours

  **✓** Manually trigger reminder job (export and call directly in a test
  script)

  **✓** Reminder email received in inbox

  **✓** reminderSentAt field set on booking in DB

  **✓** Run trigger again --- no second email sent (reminderSentAt IS
  NULL filter prevents it)

  -----------------------------------------------------------------------

+---------+-----------------------------------------+--------+--------+
| **F10** | **Super Admin Panel**                   | Est.   | Needs  |
|         |                                         |        |        |
|         |                                         | **4--5 | **F1** |
|         |                                         | hrs**  |        |
+---------+-----------------------------------------+--------+--------+

Your operator dashboard. You use this to manage tenants. Separate from
tenant admin --- super admin can see all tenants, tenant admins see only
their own data.

**SCHEMA ADDITION**

-   Add isSuperAdmin: Boolean \@default(false) to User model

-   Create migration: prisma migrate dev \--name add_super_admin

-   Add one super admin user to seed script (or create via direct DB
    insert)

**EXPRESS API**

-   Super admin middleware: check req.user.isSuperAdmin === true, return
    403 if not

-   GET /superadmin/tenants

```{=html}
<!-- -->
```
-   Return: id, name, slug, plan, isActive, createdAt, user count,
    booking count

-   Order by createdAt DESC

```{=html}
<!-- -->
```
-   PATCH /superadmin/tenants/:id

```{=html}
<!-- -->
```
-   Toggle isActive (activate/deactivate)

-   Deactivating a tenant: their public booking pages return 404, admin
    login still works

**NEXT.JS FRONTEND**

-   Super admin login: /superadmin/login --- separate from tenant admin
    login

-   Super admin dashboard: /superadmin/page.tsx

```{=html}
<!-- -->
```
-   Table: tenant name, slug (as link to booking page), plan badge,
    status badge, created date, booking count

-   Activate/deactivate toggle per row

-   Search/filter by name or slug

```{=html}
<!-- -->
```
-   No tenant branding applied to super admin panel --- plain system UI

  -----------------------------------------------------------------------
  **DONE WHEN --- all of these pass before moving to next feature**

  **✓** Super admin can log in at /superadmin/login

  **✓** Tenant list shows both demo tenants with correct booking counts

  **✓** Deactivate demo-clinic --- /book/demo-clinic returns 404

  **✓** Reactivate demo-clinic --- /book/demo-clinic works again

  **✓** Tenant admin JWT cannot access /superadmin/\* routes (returns
  403)

  -----------------------------------------------------------------------

+---------+-----------------------------------------+--------+--------+
| **F11** | **Deploy & Go Live**                    | Est.   | Needs  |
|         |                                         |        |        |
|         |                                         | **6--8 | **All  |
|         |                                         | hrs**  | feat   |
|         |                                         |        | ures** |
+---------+-----------------------------------------+--------+--------+

Do not start this until every previous feature is working locally.
Fixing bugs through a deployment pipeline is 3x slower than fixing them
locally.

**PRE-DEPLOY CHECKLIST (RUN LOCALLY FIRST)**

-   All items in 07_PreDev_Setup.docx readiness checklist pass

-   Complete booking flow on real mobile phone (not DevTools)

-   Concurrent booking test: 50 simultaneous POST requests to same slot
    --- exactly 1 succeeds

-   RLS cross-tenant verification passes

-   All email types received and render correctly on mobile Gmail

**RAILWAY --- EXPRESS API**

-   Create Railway project, add Postgres database plugin

-   Deploy apps/api from GitHub (Railway detects Node.js automatically)

-   Set all environment variables in Railway dashboard (DATABASE_URL
    auto-set by plugin)

-   Run migrations on production DB: railway run pnpm \--filter db
    migrate

-   Run RLS script on production DB: railway run psql \$DATABASE_URL \<
    packages/db/scripts/rls.sql

-   Run seed script: railway run pnpm \--filter db seed

-   Verify: curl https://api.railway.app/auth/login returns expected
    response

**VERCEL --- NEXT.JS FRONTEND**

-   Import GitHub repo in Vercel, set root directory to apps/web

-   Set environment variables in Vercel dashboard (NEXT_PUBLIC_API_URL =
    Railway URL)

-   Add custom domain: booking.virajdomadia.com

-   In DNS provider: add CNAME record booking → cname.vercel-dns.com

-   Wait for DNS propagation (up to 48hrs, usually \<1hr on Cloudflare)

-   Verify SSL cert issued: https://booking.virajdomadia.com loads
    without security warning

**GITHUB ACTIONS CI/CD**

-   Create .github/workflows/deploy.yml

```{=html}
<!-- -->
```
-   Trigger: push to main branch

-   Steps: install → type check → run tests → prisma migrate deploy →
    run rls.sql → deploy to Railway + Vercel

```{=html}
<!-- -->
```
-   Add Railway and Vercel tokens as GitHub secrets

-   Verify: push a commit, watch Actions run, confirm deployment
    succeeds

**POST-DEPLOY VERIFICATION (RUN EVERY ITEM)**

-   Full booking flow on real mobile at
    booking.virajdomadia.com/book/demo-clinic

-   Admin login, confirm a booking, check email received

-   Cancel via email link, check status updates

-   Two tenants (demo-clinic, demo-salon) are independent --- Tenant A
    cannot see Tenant B bookings

-   Super admin panel accessible at booking.virajdomadia.com/superadmin

-   Railway logs show no errors on normal usage

  -----------------------------------------------------------------------
  **DONE WHEN --- all of these pass before moving to next feature**

  **✓** Live at https://booking.virajdomadia.com --- SSL cert valid, no
  browser warnings

  **✓** Full booking flow works end-to-end on real mobile at the live URL

  **✓** Confirmation email received within 30 seconds on the live URL

  **✓** Admin dashboard accessible and functional at live URL

  **✓** Two demo tenants are independent (RLS working in production)

  **✓** GitHub Actions pipeline runs green on push to main

  **✓** README has live demo link, setup instructions, and architecture
  overview

  -----------------------------------------------------------------------

**Appendix: Dependency Map**

Build strictly in this order. Starting a feature before its dependency
is done will create integration bugs that take longer to fix than doing
it right the first time.

  ----------------------------------------------------------------------------
  **Feature**   **Depends On**        **Why you can\'t skip ahead**
  ------------- --------------------- ----------------------------------------
  **F1 Auth**   F0                    Auth middleware sets RLS context ---
                                      without it, every protected route is
                                      unguarded

  **F2          F1                    Schedule requires auth. Availability
  Schedule**                          engine in F4 reads schedule directly.

  **F3          F1                    Services require auth. Availability
  Services**                          requires serviceId from F3.

  **F4 Booking  F2 + F3               Availability reads schedule. Booking
  Flow**                              creates reference to service. Both must
                                      exist.

  **F5 Admin**  F4                    Admin actions (confirm/cancel) must have
                                      bookings to act on. F4 creates them.

  **F6 Emails** F4 + F5               Email triggers fire from booking
                                      creation (F4) and status changes (F5).

  **F7 Cancel   F6                    Cancel link is in the confirmation
  Link**                              email. Email must exist first.

  **F8 Staff**  F1 + F6               Staff invite sends an email. Invite
                                      accept uses auth flow from F1.

  **F9 Cron**   F6                    Reminder cron sends the reminder email
                                      template built in F6.

  **F10 Super   F1                    Super admin login reuses auth
  Admin**                             infrastructure from F1.

  **F11         All                   Every feature must work locally before
  Deploy**                            deploying. Pipeline runs migrations.
  ----------------------------------------------------------------------------

*--- End of Feature Build Guide ---*
