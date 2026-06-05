**TECHNICAL REQUIREMENTS DOCUMENT**

Multi-Tenant SaaS Booking System

Version 1.1 · Updated: NextAuth removed, cookie scope resolved,
Turborepo removed

  -----------------------------------------------------------------------
  **What changed in v1.1**

  Section 2 (Tech Stack): NextAuth removed. Turborepo removed.

  Section 10 (Auth Flow): Completely rewritten --- custom JWT only, no
  NextAuth.

  Section 11 (Env Variables): NEXTAUTH_URL and NEXTAUTH_SECRET removed.

  New Section 10b: Subdomain cookie scope resolution documented.

  Everything else is unchanged from v1.0.

  -----------------------------------------------------------------------

**1. System Architecture**

The system uses a monorepo structure with three logical services: a
Next.js frontend (Vercel), a Node.js + Express backend API (Railway),
and a managed PostgreSQL database (Railway add-on). Communication
between frontend and backend is REST over HTTPS. No microservices.

  ------------------------------------------------------------------------
  **Service**   **Technology**   **Host**   **Responsibility**
  ------------- ---------------- ---------- ------------------------------
  Frontend      Next.js 14 (App  Vercel     UI rendering, subdomain
                Router)                     routing middleware, custom
                                            auth context

  API           Node.js 18 +     Railway    Business logic, JWT auth,
                Express 4                   email triggers, availability
                                            engine, RLS context

  Database      PostgreSQL 15    Railway    All persistent data, RLS
                                            enforcement

  Email         Resend API       External   Transactional emails ---
                                            confirmations, reminders,
                                            cancellations

  ORM           Prisma 5         Bundled    Schema management, migrations,
                                            type-safe queries
  ------------------------------------------------------------------------

**2. Tech Stack --- Decisions & Rationale**

  -----------------------------------------------------------------------
  **v1.1 change: NextAuth removed. Turborepo removed.**

  NextAuth is designed for Next.js API routes, not a separate Express
  backend.

  The Express auth middleware must set Postgres RLS context on every
  request.

  Having two auth systems (NextAuth + custom JWT) creates unresolvable
  conflicts.

  Decision: custom JWT on Express only. See Section 10 for full
  implementation.

  Turborepo removed: provides zero practical benefit for a solo dev with
  3 packages.

  Plain pnpm workspaces with concurrently is sufficient and simpler.

  -----------------------------------------------------------------------

  -----------------------------------------------------------------------
  **Technology**     **Why Chosen**               **Why Not Alternative**
  ------------------ ---------------------------- -----------------------
  Next.js App Router Native middleware for        Pages Router lacks
                     subdomain routing; SSR for   middleware flexibility
                     public booking page SEO      for multi-tenant
                                                  subdomain logic

  Express (separate  Persistent server for        Next.js API routes are
  server)            complex middleware chains;   serverless --- cannot
                     must hold RLS session state  maintain connection
                     per request                  pools or run auth+RLS
                                                  middleware in sequence

  PostgreSQL + RLS   Row-Level Security enforces  MongoDB has no native
                     tenant isolation at DB layer RLS; isolation relies
                     --- survives application     entirely on app WHERE
                     bugs                         clauses

  Prisma ORM         Type-safe queries,           Drizzle is lighter but
                     schema-as-code migrations,   less mature migration
                     excellent TS support         tooling; TypeORM has
                                                  worse DX

  Custom JWT         Full control over token      NextAuth is
  (Express)          payload; required for RLS    Next.js-native and
                     context (tenantId in JWT);   conflicts with Express
                     no library conflicts         auth middleware.
                                                  Removed in v1.1.

  Resend             React Email templates,       Nodemailer requires
                     generous free tier, reliable SMTP config; SendGrid
                     deliverability               is heavier

  pnpm workspaces    Workspace linking, shared    Turborepo: adds build
                     packages, simple config      pipeline config
                                                  complexity with no
                                                  practical benefit at
                                                  this scale. Removed in
                                                  v1.1.

  Vercel + Railway   Vercel has native Next.js;   Render has slower cold
                     Railway has managed Postgres starts; Fly.io requires
                     add-on                       more DevOps knowledge
  -----------------------------------------------------------------------

**3. Monorepo Structure**

> booking-system/
>
> apps/
>
> web/ \# Next.js 14 (Vercel)
>
> api/ \# Express server (Railway)
>
> packages/
>
> db/ \# Prisma schema + migrations + seed
>
> types/ \# Shared TypeScript types
>
> utils/ \# Shared helpers (date, slug, etc.)
>
> .env.example \# All required env vars documented
>
> docker-compose.yml \# Local Postgres
>
> pnpm-workspace.yaml \# Workspace config --- NO turbo.json

**4. Database Design Principles**

**Multi-Tenancy Strategy: Row-Level Security (RLS)**

Every user-facing table carries a tenantId column. PostgreSQL Row-Level
Security policies are applied after migrations to enforce that a
database session operating under a given tenant context cannot read or
write rows belonging to another tenant. This provides a second line of
defence beyond application-layer WHERE filters.

  -----------------------------------------------------------------------
  **Why RLS over schema-per-tenant**
  -----------------------------------------------------------------------
  Schema-per-tenant requires dynamic schema switching on each request ---
  complex and error-prone

  RLS keeps migrations simple --- one Prisma schema, one migration,
  policies applied once

  RLS survives application bugs --- even a missing WHERE clause cannot
  leak cross-tenant data

  Demonstrating RLS knowledge signals senior-level Postgres understanding
  in interviews
  -----------------------------------------------------------------------

**Indexing Strategy**

-   All tenantId columns indexed --- every query filters by tenant first

-   Composite index on (tenantId, startsAt) on Booking table --- the
    most common query pattern

-   Unique constraint on Tenant.slug --- subdomain uniqueness enforced
    at DB level

-   Index on Booking.status --- filtered views (pending, confirmed) are
    frequent

**5. Full Database Schema**

See 05_Schema_ImplPlan.docx for the authoritative Prisma schema.
Reproduced here for reference.

> model Tenant {
>
> id String \@id \@default(cuid())
>
> name String
>
> slug String \@unique
>
> logoUrl String?
>
> primaryColor String \@default(\'#4F46E5\')
>
> plan Plan \@default(FREE)
>
> isActive Boolean \@default(true)
>
> createdAt DateTime \@default(now())
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
> startsAt DateTime // UTC always
>
> endsAt DateTime
>
> status BookingStatus \@default(PENDING)
>
> notes String?
>
> adminNotes String?
>
> cancelToken String \@unique \@default(cuid())
>
> cancelReason String?
>
> reminderSentAt DateTime?
>
> confirmationEmailStatus String \@default(\'PENDING\') //
> PENDING\|SENT\|FAILED
>
> createdAt DateTime \@default(now())
>
> updatedAt DateTime \@updatedAt
>
> @@index(\[tenantId, startsAt\])
>
> @@index(\[tenantId, status\])
>
> @@index(\[cancelToken\])
>
> @@index(\[reminderSentAt\])
>
> }

**6. Row-Level Security Policies**

Run this SQL after every prisma migrate deploy in production. Store it
at packages/db/scripts/rls.sql.

> ALTER TABLE \"Booking\" ENABLE ROW LEVEL SECURITY;
>
> ALTER TABLE \"Service\" ENABLE ROW LEVEL SECURITY;
>
> ALTER TABLE \"User\" ENABLE ROW LEVEL SECURITY;
>
> ALTER TABLE \"Schedule\" ENABLE ROW LEVEL SECURITY;
>
> CREATE POLICY tenant_isolation ON \"Booking\"
>
> USING (\"tenantId\" = current_setting(\'app.tenant_id\', true));
>
> CREATE POLICY tenant_isolation ON \"Service\"
>
> USING (\"tenantId\" = current_setting(\'app.tenant_id\', true));
>
> CREATE POLICY tenant_isolation ON \"User\"
>
> USING (\"tenantId\" = current_setting(\'app.tenant_id\', true));

Set per-request in Express auth middleware:

> await prisma.\$executeRaw\`
>
> SELECT set_config(\'app.tenant_id\', \${tenantId}, true)
>
> \`;

**7. API Design**

**Auth Endpoints**

  ----------------------------------------------------------------------------------
  **Method**   **Path**              **Auth**   **Description**
  ------------ --------------------- ---------- ------------------------------------
  POST         /auth/register        None       Create tenant + owner account

  POST         /auth/login           None       Returns access token + sets refresh
                                                cookie

  POST         /auth/refresh         Cookie     Rotates access token

  POST         /auth/logout          JWT        Clears refresh cookie

  POST         /auth/invite          JWT        Invite staff member by email

  POST         /auth/accept-invite   None       Validate invite token, set password
  ----------------------------------------------------------------------------------

**Public Booking Endpoints (no auth)**

  --------------------------------------------------------------------------------------
  **Method**   **Path**                         **Description**
  ------------ -------------------------------- ----------------------------------------
  GET          /public/:slug/services           List active services for tenant

  GET          /public/:slug/availability       Returns available slots for a service +
                                                date

  POST         /public/:slug/bookings           Create a booking (triggers confirmation
                                                email)

  GET          /public/bookings/cancel/:token   Show booking details for cancel
                                                confirmation

  POST         /public/bookings/cancel/:token   Cancel booking via email link
  --------------------------------------------------------------------------------------

**Admin Endpoints (JWT required)**

  -----------------------------------------------------------------------------
  **Method**   **Path**              **Description**
  ------------ --------------------- ------------------------------------------
  GET          /admin/bookings       List bookings with filters (status, date,
                                     service)

  PATCH        /admin/bookings/:id   Update status (confirm, cancel, complete)

  GET          /admin/services       List services

  POST         /admin/services       Create service

  PUT          /admin/services/:id   Update service

  DELETE       /admin/services/:id   Soft-delete service (isActive=false)

  GET          /admin/schedule       Get schedule config

  PUT          /admin/schedule       Update schedule config

  GET          /admin/staff          List staff accounts

  PATCH        /admin/staff/:id      Update role or deactivate
  -----------------------------------------------------------------------------

**8. Availability Algorithm**

The availability engine generates open time slots for a given service on
a given date, accounting for working hours, breaks, existing bookings,
and service duration.

> // apps/api/src/services/availability.ts
>
> export function getAvailableSlots(
>
> date: Date,
>
> schedule: Schedule,
>
> existingBookings: { startsAt: Date; endsAt: Date }\[\],
>
> serviceDuration: number // minutes
>
> ): { start: Date; end: Date }\[\] {
>
> const day = getDayKey(date);
>
> if (!schedule.workingDays\[day\]) return \[\];
>
> const tz = schedule.timezone;
>
> const workStart = toZonedTime(parseTime(schedule.workStart, date),
> tz);
>
> const workEnd = toZonedTime(parseTime(schedule.workEnd, date), tz);
>
> const interval = schedule.slotInterval \* 60_000;
>
> const duration = serviceDuration \* 60_000;
>
> const now = new Date();
>
> const slots = \[\];
>
> let cursor = workStart;
>
> while (cursor.getTime() + duration \<= workEnd.getTime()) {
>
> const slotEnd = new Date(cursor.getTime() + duration);
>
> const isPast = cursor \<= now;
>
> const isBooked = existingBookings.some(b =\>
>
> cursor \< b.endsAt && slotEnd \> b.startsAt);
>
> const isOnBreak = schedule.breakTimes.some(br =\> {
>
> const bs = parseTime(br.start, date);
>
> const be = parseTime(br.end, date);
>
> return cursor \< be && slotEnd \> bs;
>
> });
>
> if (!isPast && !isBooked && !isOnBreak)
>
> slots.push({ start: cursor, end: slotEnd });
>
> cursor = new Date(cursor.getTime() + interval);
>
> }
>
> return slots;
>
> }

**8b. Race Condition Prevention --- Booking Creation**

  -----------------------------------------------------------------------
  **CRITICAL: Both SELECT FOR UPDATE and SERIALIZABLE isolation are
  required.**

  SELECT FOR UPDATE alone is insufficient. Two transactions can both pass
  the conflict check

  before either has committed. SERIALIZABLE isolation prevents this
  phantom read scenario.

  Load test requirement: 50 concurrent POSTs to same slot must produce
  exactly 1 booking.

  -----------------------------------------------------------------------

> await prisma.\$transaction(
>
> async (tx) =\> {
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
> if (conflict.length \> 0) throw new Error(\'SLOT_TAKEN\');
>
> return tx.booking.create({ data: bookingData });
>
> },
>
> { isolationLevel: \'Serializable\' } // mandatory
>
> );

**9. Tenant Routing --- Path-Based (v1.2)**

Deployment is at booking.virajdomadia.com. Wildcard SSL for
sub-subdomains (clinic.booking.virajdomadia.com) is not available on
Vercel free tier. Subdomain routing is therefore replaced with
path-based routing. No middleware.ts file is needed. The Next.js App
Router handles tenant routing natively via a \[slug\] folder.

**URL structure:**

> booking.virajdomadia.com ← landing page
>
> booking.virajdomadia.com/book/\[slug\] ← tenant booking flow
>
> booking.virajdomadia.com/book/\[slug\]/admin ← admin dashboard

**9.1 App Router Folder Structure**

No middleware.ts required. Delete it if it exists. The \[slug\] dynamic
segment is the tenant identifier everywhere --- passed to API calls
as-is.

> apps/web/src/app/
>
> page.tsx ← landing page
>
> book/
>
> \[slug\]/
>
> page.tsx ← service list
>
> \[serviceId\]/
>
> date/page.tsx ← date picker
>
> slots/page.tsx ← time slot picker
>
> details/page.tsx ← customer details form
>
> confirm/page.tsx ← confirmation page
>
> admin/
>
> page.tsx ← admin dashboard home
>
> bookings/page.tsx
>
> services/page.tsx
>
> schedule/page.tsx
>
> staff/page.tsx

**9.2 Reading the slug in page components**

> // apps/web/src/app/book/\[slug\]/page.tsx
>
> export default function BookingPage({ params }: { params: { slug:
> string } }) {
>
> const { slug } = params; // \"clinic\", \"salon\", etc.
>
> // slug passes straight to every API call
>
> const services = await api.get(\`/public/\${slug}/services\`);
>
> }

**9.3 Vercel Deployment Config**

In Vercel project settings, add custom domain: booking.virajdomadia.com.
In your DNS provider (Cloudflare recommended), add a CNAME record
pointing booking.virajdomadia.com to cname.vercel-dns.com. Vercel issues
the SSL cert automatically on the free tier. No wildcard cert needed.

> DNS record (add in Cloudflare / your registrar):
>
> Type: CNAME
>
> Name: booking
>
> Value: cname.vercel-dns.com

**10. Authentication Flow (v1.1 --- Custom JWT, No NextAuth)**

  -----------------------------------------------------------------------
  **This section completely replaces the v1.0 auth section.**

  NextAuth has been removed. All auth is handled by Express with custom
  JWTs.

  The frontend uses React context + Axios interceptors, not NextAuth
  sessions.

  See 07_PreDev_Setup.docx Section B3 for the full rationale and
  migration steps.

  -----------------------------------------------------------------------

**10.1 Token Strategy**

  ---------------------------------------------------------------------------
  **Token**    **Type**   **Expiry**   **Storage**        **Contains**
  ------------ ---------- ------------ ------------------ -------------------
  Access token JWT        15 minutes   React state        { userId, tenantId,
               (signed)                (memory only)      role, iat, exp }

  Refresh      Opaque     7 days       httpOnly Secure    Random UUID ---
  token        UUID                    cookie             looked up in DB on
                                                          use
  ---------------------------------------------------------------------------

**10.2 Frontend Session --- AuthContext**

No NextAuth. Access token lives in React context. Page refreshes require
silent token refresh.

> // apps/web/src/context/auth.tsx
>
> const AuthContext = createContext(null);
>
> export function AuthProvider({ children }) {
>
> const \[accessToken, setAccessToken\] = useState(null);
>
> const \[user, setUser\] = useState(null);
>
> // On mount: try silent refresh (user may have a valid refresh cookie)
>
> useEffect(() =\> {
>
> silentRefresh().catch(() =\> {});
>
> }, \[\]);
>
> const silentRefresh = async () =\> {
>
> const res = await fetch(\`\${API_URL}/auth/refresh\`, {
>
> method: \'POST\', credentials: \'include\'
>
> });
>
> if (res.ok) {
>
> const { accessToken, user } = await res.json();
>
> setAccessToken(accessToken);
>
> setUser(user);
>
> }
>
> };
>
> }

**10.3 Axios Interceptor --- Handles 401 Silently**

> // apps/web/src/lib/api.ts
>
> const api = axios.create({
>
> baseURL: process.env.NEXT_PUBLIC_API_URL,
>
> withCredentials: true, // sends httpOnly cookie on every request
>
> });
>
> api.interceptors.request.use(config =\> {
>
> const token = getAccessToken();
>
> if (token) config.headers.Authorization = \`Bearer \${token}\`;
>
> return config;
>
> });
>
> api.interceptors.response.use(res =\> res, async error =\> {
>
> if (error.response?.status === 401 && !error.config.\_retry) {
>
> error.config.\_retry = true;
>
> const { data } = await axios.post(\'/auth/refresh\',
>
> {}, { withCredentials: true });
>
> setAccessToken(data.accessToken);
>
> error.config.headers.Authorization = \`Bearer \${data.accessToken}\`;
>
> return api(error.config);
>
> }
>
> if (error.response?.status === 401) router.push(\'/admin/login\');
>
> return Promise.reject(error);
>
> });

**10.4 Express Auth Middleware**

> // apps/api/src/middleware/auth.ts
>
> export const authMiddleware = async (req, res, next) =\> {
>
> const token = req.headers.authorization?.split(\' \')\[1\];
>
> if (!token) return res.status(401).json({ error: \'Unauthorized\' });
>
> try {
>
> const payload = jwt.verify(token, process.env.JWT_SECRET);
>
> req.user = payload;
>
> req.tenantId = payload.tenantId;
>
> // Set Postgres RLS context --- required for tenant isolation
>
> await prisma.\$executeRaw\`
>
> SELECT set_config(\'app.tenant_id\', \${payload.tenantId}, true)
>
> \`;
>
> next();
>
> } catch (e) {
>
> return res.status(401).json({ error: \'Invalid or expired token\' });
>
> }
>
> };

**10b. Subdomain Cookie Scope (v1.1 Addition)**

  -----------------------------------------------------------------------
  **The refresh token cookie must be scoped to .yourdomain.com (leading
  dot).**

  The Next.js frontend runs at clinic.yourdomain.com.

  The Express API runs at api.yourdomain.com.

  For cookies to be sent from the frontend to the API, they must be
  scoped to the root domain.

  Setting domain: .yourdomain.com (leading dot) covers all subdomains.

  Security: httpOnly cookies are not readable by JavaScript regardless of
  domain scope.

  -----------------------------------------------------------------------

> // apps/api/src/routes/auth.ts --- cookie config
>
> res.cookie(\'refresh_token\', refreshToken, {
>
> httpOnly: true,
>
> secure: process.env.NODE_ENV === \'production\',
>
> sameSite: \'strict\',
>
> domain: process.env.NODE_ENV === \'production\'
>
> ? \`.\${process.env.ROOT_DOMAIN}\` // .yourdomain.com --- all
> subdomains
>
> : undefined, // localhost --- no scoping needed
>
> maxAge: 7 \* 24 \* 60 \* 60 \* 1000,
>
> });

Local development: no /etc/hosts entries needed. Path-based routing
works on plain localhost:3000. Visit
http://localhost:3000/book/demo-clinic directly.

**11. Environment Variables (v1.1 --- NextAuth removed)**

  -------------------------------------------------------------------------
  **Variable**          **Where**   **Description**
  --------------------- ----------- ---------------------------------------
  DATABASE_URL          api + db    Postgres connection string

  JWT_SECRET            api         256-bit random secret --- openssl rand
                                    -hex 32

  JWT_REFRESH_SECRET    api         Separate 256-bit secret --- openssl
                                    rand -hex 32

  RESEND_API_KEY        api         From resend.com dashboard (verify
                                    domain first)

  FRONTEND_URL          api         http://localhost:3000 (dev) /
                                    https://yourdomain.com (prod) --- CORS
                                    origin

  ROOT_DOMAIN           api + web   yourdomain.com --- for cookie domain
                                    and subdomain parsing

  NEXT_PUBLIC_API_URL   web         http://localhost:4000 (dev) /
                                    https://api.yourdomain.com (prod)
  -------------------------------------------------------------------------

  -----------------------------------------------------------------------
  **Removed from v1.0: NEXTAUTH_URL, NEXTAUTH_SECRET, NEXTAUTH_URL**

  These were NextAuth-specific variables. They are no longer used.

  Do not add them --- they have no effect without NextAuth installed.

  -----------------------------------------------------------------------

**12. Security & Quality Checklist**

  -----------------------------------------------------------------------
  **Before going live --- verify each item**
  -----------------------------------------------------------------------
  RLS policies applied and tested: create two tenants, verify
  cross-tenant query returns empty

  Refresh token is httpOnly --- not visible in browser DevTools JS
  console (document.cookie)

  Cookie domain scoped to .yourdomain.com in production --- verified from
  Network tab

  All admin routes return 401 without valid JWT --- verified with curl

  cancelToken minimum 25 characters --- cuid() generates 25+ by default

  Rate limiting on /auth/login: max 10 attempts per IP per 15 minutes

  CORS configured to only allow ROOT_DOMAIN and subdomains

  All user inputs validated with Zod before hitting the database

  Concurrent booking load test: 50 simultaneous POSTs to same slot →
  exactly 1 created

  All booking flows tested on real mobile phone browser (375px) --- not
  browser DevTools

  Email send failure does not fail booking --- verified by temporarily
  disabling Resend API key

  No NextAuth code anywhere in the repository --- search for
  \'next-auth\' to confirm

  confirmationEmailStatus visible in admin dashboard for failed emails
  -----------------------------------------------------------------------

*--- End of Technical Requirements Document v1.1 ---*
