**SECURITY & ACCESS CONTROL DOCUMENT**

**Multi-Tenant Booking System**

Tenant Isolation · Auth · API Security · RLS

Version 1.0 · Viraj Patil · Portfolio Project

**1. Security Overview**

The booking system has one security concern above all others: tenant
data isolation. A clinic owner must be physically unable to see another
clinic\'s bookings, services, or customer data --- even if there is a
bug in the application code. Every other security requirement is
secondary to this. The solution is PostgreSQL Row-Level Security (RLS),
which enforces isolation at the database layer independently of
application logic.

  -----------------------------------------------------------------------
  **Threat model: what we are protecting against**

  • Cross-tenant data leakage: Tenant A reads or modifies Tenant B\'s
  bookings, customers, or services

  • Unauthorised admin access: unauthenticated user accesses admin
  dashboard

  • Booking manipulation: customer cancels or modifies a booking they do
  not own

  • Token theft: attacker steals a JWT and impersonates a legitimate
  admin user

  • Brute-force login: attacker guesses admin passwords by making
  unlimited login attempts

  • Injection attacks: attacker sends malicious input through booking
  form or API

  • Role escalation: STAFF account attempts actions reserved for
  OWNER/ADMIN
  -----------------------------------------------------------------------

**2. Tenant Isolation --- PostgreSQL RLS**

Row-Level Security is the foundation of the entire security model. It
enforces that a database session can only read or write rows belonging
to the current tenant --- this is enforced inside Postgres itself, not
in application code.

**How it works**

-   Every user-facing table (Booking, Service, User, Schedule) has a
    tenantId column

-   RLS policies on each table use current_setting(\'app.tenant_id\') to
    filter rows

-   The Express auth middleware sets this session variable on every
    authenticated request

-   Result: even if application code omits a WHERE tenantId = ? clause,
    Postgres enforces it

**RLS Policy Setup**

> \-- Run after every prisma migrate deploy in production
>
> \-- Store in packages/db/scripts/setup-rls.sql
>
> ALTER TABLE \"Booking\" ENABLE ROW LEVEL SECURITY;
>
> ALTER TABLE \"Service\" ENABLE ROW LEVEL SECURITY;
>
> ALTER TABLE \"User\" ENABLE ROW LEVEL SECURITY;
>
> ALTER TABLE \"Schedule\" ENABLE ROW LEVEL SECURITY;
>
> \-- Drop before recreating (idempotent)
>
> DROP POLICY IF EXISTS tenant_iso ON \"Booking\";
>
> DROP POLICY IF EXISTS tenant_iso ON \"Service\";
>
> DROP POLICY IF EXISTS tenant_iso ON \"User\";
>
> DROP POLICY IF EXISTS tenant_iso ON \"Schedule\";
>
> \-- Policy: rows are only visible if tenantId matches session variable
>
> CREATE POLICY tenant_iso ON \"Booking\"
>
> USING (\"tenantId\" = current_setting(\'app.tenant_id\', true));
>
> CREATE POLICY tenant_iso ON \"Service\"
>
> USING (\"tenantId\" = current_setting(\'app.tenant_id\', true));
>
> CREATE POLICY tenant_iso ON \"User\"
>
> USING (\"tenantId\" = current_setting(\'app.tenant_id\', true));
>
> CREATE POLICY tenant_iso ON \"Schedule\"
>
> USING (\"tenantId\" = current_setting(\'app.tenant_id\', true));

**Setting Tenant Context Per Request**

> // apps/api/src/middleware/auth.ts
>
> export const authMiddleware = async (req, res, next) =\> {
>
> const token = req.headers.authorization?.split(\" \")\[1\];
>
> if (!token) return res.status(401).json({ error: \"Unauthorized\" });
>
> try {
>
> const payload = jwt.verify(token, process.env.JWT_SECRET) as
> JwtPayload;
>
> req.user = payload;
>
> req.tenantId = payload.tenantId;
>
> // Set Postgres session variable --- RLS policies read this
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
> return res.status(401).json({ error: \"Invalid or expired token\" });
>
> }
>
> };

**RLS Verification Test (Run Before Every Deploy)**

> \-- Create two tenants and one booking per tenant
>
> \-- Then set context to tenant_a and query --- must return 0 rows for
> tenant_b
>
> SELECT set_config(\'app.tenant_id\', \'\<tenant_a_id\>\', true);
>
> SELECT COUNT(\*) FROM \"Booking\" WHERE \"tenantId\" =
> \'\<tenant_b_id\>\';
>
> \-- Expected result: 0
>
> \-- If result \> 0: RLS is not working --- DO NOT DEPLOY

  -----------------------------------------------------------------------
  **RLS is not active by default**

  • Running prisma migrate deploy does NOT automatically enable RLS. The
  setup-rls.sql script must be run separately after every migration.

  • Add this to your GitHub Actions CI/CD pipeline: after migration,
  always run the RLS script.

  • If RLS policies are dropped and not recreated, the system becomes
  multi-tenant in name only --- application WHERE clauses are the only
  protection.
  -----------------------------------------------------------------------

**3. Authentication --- JWT Strategy**

  ------------ ---------- ------------ ------------------- -----------------
  **Token**    **Type**   **Expiry**   **Storage**         **Contains**

  Access token JWT        15 minutes   React state (memory { userId,
               (signed)                only --- never      tenantId, role,
                                       localStorage)       iat, exp }

  Refresh      Opaque     7 days       httpOnly Secure     Random UUID ---
  token        random                  SameSite=Strict     looked up in DB
               string                  cookie              on use
  ------------ ---------- ------------ ------------------- -----------------

**Why 15-minute access tokens**

-   If an access token is stolen from memory (XSS), it expires in 15
    minutes

-   Short expiry limits the window of a stolen token being useful

-   Refresh token in httpOnly cookie is NOT accessible to JavaScript ---
    cannot be stolen via XSS

-   On every 401 response, the frontend silently calls POST
    /auth/refresh. If refresh succeeds, original request retried. User
    notices nothing.

**Token Rotation**

> // apps/api/src/routes/auth.ts --- POST /auth/refresh
>
> export async function refresh(req, res) {
>
> const refreshToken = req.cookies.refresh_token;
>
> if (!refreshToken) return res.status(401).json({ error: \"No refresh
> token\" });
>
> // Find token in DB --- validates it exists and has not been rotated
>
> const stored = await prisma.refreshToken.findUnique({
>
> where: { token: refreshToken },
>
> include: { user: true },
>
> });
>
> if (!stored \|\| stored.expiresAt \< new Date()) {
>
> res.clearCookie(\"refresh_token\");
>
> return res.status(401).json({ error: \"Refresh token expired or
> invalid\" });
>
> }
>
> // Rotate: delete old token, issue new one
>
> await prisma.refreshToken.delete({ where: { token: refreshToken } });
>
> const newRefresh = crypto.randomUUID();
>
> await prisma.refreshToken.create({
>
> data: { token: newRefresh, userId: stored.userId,
>
> expiresAt: addDays(new Date(), 7) },
>
> });
>
> // Issue new access token
>
> const accessToken = jwt.sign(
>
> { userId: stored.userId, tenantId: stored.user.tenantId, role:
> stored.user.role },
>
> process.env.JWT_SECRET,
>
> { expiresIn: \"15m\" }
>
> );
>
> res.cookie(\"refresh_token\", newRefresh, {
>
> httpOnly: true, secure: true,
>
> sameSite: \"strict\", maxAge: 7 \* 24 \* 60 \* 60 \* 1000,
>
> });
>
> return res.json({ accessToken });
>
> }

**4. Role-Based Access Control**

  ---------- ------------------------------ ------------------------------
  **Role**   **Permissions**                **Restrictions**

  OWNER      All permissions. Create/delete Cannot be demoted or deleted
             staff. Change tenant settings. by other roles
             View all bookings.             

  ADMIN      All booking operations. Manage Cannot delete the OWNER
             services and schedule. View    account. Cannot change
             staff list.                    billing.

  STAFF      View bookings for their day.   Cannot cancel bookings, manage
             Confirm and complete bookings. services, or access schedule
             Add notes.                     settings

  Public     Create a booking via the       No admin access whatsoever.
             public booking page. Cancel    Identity is email +
             via email link.                cancelToken only
  ---------- ------------------------------ ------------------------------

**RBAC Middleware**

> export const requireRole = (\...roles: Role\[\]) =\> (req, res, next)
> =\> {
>
> if (!req.user) return res.status(401).json({ error: \"Unauthorized\"
> });
>
> if (!roles.includes(req.user.role)) {
>
> return res.status(403).json({ error: \"Insufficient permissions\" });
>
> }
>
> next();
>
> };
>
> // Applied to routes:
>
> router.delete(\'/services/:id\', authMiddleware,
> requireRole(\"OWNER\",\"ADMIN\"), deleteService);
>
> router.patch(\'/bookings/:id\', authMiddleware,
> requireRole(\"OWNER\",\"ADMIN\",\"STAFF\"), updateBooking);
>
> router.get(\'/staff\', authMiddleware,
> requireRole(\"OWNER\",\"ADMIN\"), listStaff);

**5. Public Booking Security**

**cancelToken --- Customer Cancel Link**

-   Every Booking row has a cancelToken: String \@unique
    \@default(cuid())

-   cuid() generates a 25-character cryptographically random string ---
    not guessable by enumeration

-   Cancel links in emails contain this token:
    yourdomain.com/cancel/\[cancelToken\]

-   No authentication required to cancel --- the token IS the
    authentication

-   Once cancelled, the token remains in the DB to prevent replay
    (status check on use)

**Race Condition on Booking Creation**

> // Serializable transaction + SELECT FOR UPDATE
>
> // Prevents two customers booking the same slot simultaneously
>
> await prisma.\$transaction(async (tx) =\> {
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
> if (conflict.length \> 0) throw new Error(\"SLOT_TAKEN\");
>
> return tx.booking.create({ data: bookingData });
>
> }, { isolationLevel: \"Serializable\" });

**6. Input Validation**

All user input validated with Zod schemas before touching the database.
Validation errors return 400 with field-level messages --- never passed
to the DB raw.

> // Example: booking creation schema
>
> const CreateBookingSchema = z.object({
>
> serviceId: z.string().cuid(),
>
> startsAt: z.string().datetime(),
>
> customerName: z.string().min(1).max(100).trim(),
>
> customerEmail: z.string().email().toLowerCase(),
>
> customerPhone:
> z.string().regex(/\^\[+\]?\[0-9\]{10,13}\$/).optional(),
>
> notes: z.string().max(500).optional(),
>
> });

**7. Rate Limiting**

  ---------------------------- ------------ ---------------- --------------------
  **Endpoint**                 **Limit**    **Window**       **Purpose**

  POST /auth/login             10 requests  15 minutes per   Prevent brute-force
                                            IP               password guessing

  POST /auth/register          5 requests   60 minutes per   Prevent spam tenant
                                            IP               creation

  POST /public/:slug/bookings  20 requests  60 minutes per   Prevent booking slot
                                            IP               flooding

  GET                          60 requests  60 minutes per   Prevent availability
  /public/:slug/availability                IP               scraping

  All admin routes             200 requests 60 minutes per   General API rate
                                            user             limiting
  ---------------------------- ------------ ---------------- --------------------

**8. CORS Configuration**

> // apps/api/src/app.ts
>
> app.use(cors({
>
> origin: (origin, cb) =\> {
>
> const allowed = \[
>
> process.env.ROOT_DOMAIN, // yourdomain.com
>
> \`www.\${process.env.ROOT_DOMAIN}\`, // www.yourdomain.com
>
> \];
>
> // Allow any subdomain of ROOT_DOMAIN (tenant pages)
>
> const isSubdomain =
> origin?.endsWith(\`.\${process.env.ROOT_DOMAIN}\`);
>
> if (!origin \|\| allowed.includes(origin) \|\| isSubdomain) {
>
> cb(null, true);
>
> } else {
>
> cb(new Error(\"Not allowed by CORS\"));
>
> }
>
> },
>
> credentials: true, // required for httpOnly cookie on refresh token
>
> }));

**9. Security Checklist --- Before Every Deploy**

  -----------------------------------------------------------------------
  **Run every item. In order.**

  • 1. RLS VERIFICATION: Run SELECT set_config(\'app.tenant_id\',
  tenant_a_id, true); SELECT COUNT(\*) FROM \"Booking\" WHERE
  \"tenantId\" = tenant_b_id; → must return 0

  • 2. Auth test: curl GET /admin/bookings without token → 401. With
  valid Viewer token → 403. With valid OWNER token → 200.

  • 3. Refresh token: after login, check browser cookies in DevTools ---
  refresh_token must be httpOnly (not readable by JS console)

  • 4. Role escalation: log in as STAFF, attempt DELETE
  /admin/services/\[id\] → must return 403

  • 5. cancelToken: verify minimum 25 character length in DB. Attempt to
  cancel with a made-up token → 404.

  • 6. Rate limiting: send 11 POST /auth/login requests in 15 minutes
  from same IP → 11th must return 429

  • 7. CORS: attempt API call from an unrelated domain → blocked by CORS
  policy

  • 8. Input validation: send booking creation with customerEmail =
  \"not-an-email\" → 400 with field error

  • 9. Concurrent booking: 50 simultaneous POST /public/:slug/bookings
  for same slot → exactly 1 succeeds

  • 10. setup-rls.sql was run after last migration --- verify with:
  SELECT polname FROM pg_policies WHERE tablename = \'Booking\';
  -----------------------------------------------------------------------

*--- End of Security & Access Document --- Project 1 ---*
