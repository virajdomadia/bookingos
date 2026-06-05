**PRE-DEVELOPMENT SETUP GUIDE**

Multi-Tenant SaaS Booking System

Version 1.0 · Resolves all 5 blockers identified before Day 1 coding

  -----------------------------------------------------------------------
  **Purpose of this document**

  Five blockers were identified that would cause significant wasted time
  if hit mid-build:

  B1. Local environment not confirmed ready

  B2. Turborepo decision not made

  B3. NextAuth vs custom JWT architectural contradiction

  B4. Subdomain cookie scope unsolved

  B5. Email retry mechanism unresolved

  This document resolves every blocker with a concrete decision, the
  rationale, and the exact

  steps to execute. Complete all five sections before writing application
  code.

  -----------------------------------------------------------------------

**B1 --- Local Environment Setup**

  -----------------------------------------------------------------------
  **DECISION: Verify and install all dependencies before Day 1. Do not
  assume anything is ready.**

  Spending 30 minutes confirming your environment is ready saves 3+ hours
  of debugging on Day 1.

  -----------------------------------------------------------------------

**1.1 Required Tools --- Install in This Order**

  -----------------------------------------------------------------------------------
  **Tool**              **Required      **Verify         **Install If Missing**
                        Version**       Command**        
  --------------------- --------------- ---------------- ----------------------------
  Node.js               18.x or 20.x    node \--version  https://nodejs.org (LTS)
                        (LTS)                            

  pnpm                  8.x or later    pnpm \--version  npm install -g pnpm

  Docker Desktop        Any recent      docker           https://docker.com/desktop
                        version         \--version       

  Git                   Any recent      git \--version   Comes with Xcode CLI / Git
                        version                          SCM
  -----------------------------------------------------------------------------------

**1.2 Run This Verification Script**

Copy and run the following in your terminal. All lines must print OK.

> \# Paste this block into your terminal
>
> node \--version && echo \' Node OK\' \|\| echo \' Node MISSING\'
>
> pnpm \--version && echo \' pnpm OK\' \|\| echo \' pnpm MISSING\'
>
> docker \--version && echo \' Docker OK\' \|\| echo \'Docker MISSING\'
>
> git \--version && echo \' Git OK\' \|\| echo \' Git MISSING\'

**1.3 External Accounts --- Create Before Day 1**

All three must be set up and verified before you hit Day 10 (email) and
Day 20 (deploy).

  ------------------------------------------------------------------------
  **Service**     **What to Do Now**             **Why It Matters**
  --------------- ------------------------------ -------------------------
  Resend          Create account. Add your       DNS verification takes up
  (resend.com)    domain. Verify DNS records.    to 24hrs. Do not wait
                  Send one test email.           until Day 18.

  Railway         Create account. Create a new   Confirm free tier is
  (railway.app)   project. Add a Postgres        available in your region
                  database plugin.               before building against
                                                 it.

  Vercel          Create account. Link your      Vercel wildcard subdomain
  (vercel.com)    GitHub. Confirm you can deploy config requires domain
                  a blank Next.js app.           ownership verification.
  ------------------------------------------------------------------------

**1.4 Domain --- Purchase Today**

You need a domain that supports wildcard DNS and wildcard SSL. Do this
before Day 1.

-   Buy from: Cloudflare Registrar (cheapest, best DNS tooling) or
    Namecheap

-   After purchase: add an A record pointing \*.yourdomain.com to a
    placeholder IP (e.g. 127.0.0.1)

-   Verify wildcard SSL works: Cloudflare provides free wildcard SSL
    automatically. If using another registrar, confirm Let\'s Encrypt
    wildcard certs are supported.

-   This takes 10-30 minutes but DNS propagation can take up to 48 hours
    --- start it now.

**B2 --- Turborepo Decision**

  -----------------------------------------------------------------------
  **DECISION: Use pnpm workspaces only. Remove Turborepo.**

  Turborepo adds build pipeline orchestration. For a solo developer with
  3 packages and 2 apps,

  it provides zero practical benefit and adds a non-trivial configuration
  surface.

  The original TRD listed turbo.json but never defined a pipeline that
  would actually help.

  Every session would require understanding turbo pipeline config before
  making progress.

  Drop it. Use plain pnpm workspaces.

  -----------------------------------------------------------------------

**2.1 Correct Monorepo Structure (No Turborepo)**

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
> pnpm-workspace.yaml \# Workspace config
>
> package.json \# Root --- NO turbo dependency

**2.2 pnpm-workspace.yaml**

> packages:
>
> \- \'apps/\*\'
>
> \- \'packages/\*\'

**2.3 Root package.json scripts**

> {
>
> \"scripts\": {
>
> \"dev:api\": \"pnpm \--filter api dev\",
>
> \"dev:web\": \"pnpm \--filter web dev\",
>
> \"dev\": \"concurrently \\\"pnpm dev:api\\\" \\\"pnpm dev:web\\\"\",
>
> \"db:migrate\": \"pnpm \--filter db migrate\",
>
> \"db:studio\": \"pnpm \--filter db studio\"
>
> }
>
> }

Run pnpm install at the root. All workspace packages will be linked
automatically.

**B3 --- Auth Architecture: Drop NextAuth, Use Custom JWT**

  -----------------------------------------------------------------------
  **DECISION: Remove NextAuth entirely. Custom JWT on Express only.**

  The original TRD listed both NextAuth and a custom Express JWT system.
  These are contradictory:

  NextAuth manages its own session cookies and session store. The Express
  backend manages its own

  JWTs and httpOnly refresh tokens. Having both creates two auth systems
  that do not speak to

  each other, doubling complexity and introducing hard-to-debug session
  inconsistencies.

  Since the auth middleware MUST set Postgres RLS context (app.tenant_id)
  on every request,

  and this runs on Express, Express must own auth. NextAuth is a
  Next.js-native solution

  designed for Next.js API routes --- not a separate Express backend.

  Removing NextAuth also removes the NextAuth subdomain cookie edge case
  (a known pain point

  flagged in the implementation plan).

  -----------------------------------------------------------------------

**3.1 Revised Auth Architecture**

  -----------------------------------------------------------------------
  **Concern**      **Solution**                      **Where It Lives**
  ---------------- --------------------------------- --------------------
  Access token     JWT signed with JWT_SECRET,       Express --- issued
                   15-min expiry, contains { userId, on login
                   tenantId, role }                  

  Refresh token    Opaque UUID, 7-day expiry, stored Express --- issued
                   in httpOnly cookie                on login, rotated on
                                                     use

  Frontend session Access token stored in React      Next.js --- no
  state            state (memory). Axios/fetch       NextAuth
                   interceptor handles refresh on    
                   401.                              

  Protected pages  Middleware reads access token     Next.js middleware
  (SSR)            from Authorization header. No SSR 
                   session needed --- public pages   
                   have no auth.                     

  RLS context      Auth middleware on Express sets   Express middleware
                   app.tenant_id via set_config      
                   before every request.             
  -----------------------------------------------------------------------

**3.2 Frontend Auth --- React State Pattern**

No NextAuth. No localStorage. Access token lives in React context only.

> // apps/web/src/context/auth.tsx
>
> const AuthContext = createContext\<AuthContextType\>(null);
>
> export function AuthProvider({ children }) {
>
> const \[accessToken, setAccessToken\] = useState\<string \|
> null\>(null);
>
> const login = async (email: string, password: string) =\> {
>
> const res = await fetch(\'/api/auth/login\', {
>
> method: \'POST\', credentials: \'include\', // sends/receives cookies
>
> body: JSON.stringify({ email, password })
>
> });
>
> const { accessToken } = await res.json();
>
> setAccessToken(accessToken); // stored in memory, not localStorage
>
> };
>
> return React.createElement(AuthContext.Provider,
> {value:{accessToken,login}}, children);
>
> }

**3.3 Axios Interceptor --- Silent Refresh**

Every API call goes through this interceptor. Token expiry is handled
invisibly.

> // apps/web/src/lib/api.ts
>
> const api = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL,
>
> withCredentials: true });
>
> api.interceptors.request.use(config =\> {
>
> const token = getAccessToken(); // from AuthContext
>
> if (token) config.headers.Authorization = \`Bearer \${token}\`;
>
> return config;
>
> });
>
> api.interceptors.response.use(
>
> res =\> res,
>
> async error =\> {
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
> return api(error.config); // retry original request
>
> }
>
> if (error.response?.status === 401) redirect(\'/admin/login\');
>
> return Promise.reject(error);
>
> }
>
> );

**3.4 Remove These Dependencies**

-   Remove: next-auth from apps/web/package.json

-   Remove: \@auth/prisma-adapter if added

-   Do not add: any NextAuth-related environment variables
    (NEXTAUTH_URL, NEXTAUTH_SECRET)

-   Do not add: apps/web/src/app/api/auth/\[\...nextauth\]/route.ts

**3.5 Updated Environment Variables**

Remove the NextAuth variables. The correct set for the web app is:

  ------------------------------------------------------------------------
  **Variable**          **Where**     **Value**
  --------------------- ------------- ------------------------------------
  NEXT_PUBLIC_API_URL   apps/web      http://localhost:4000 (dev) /
                                      https://api.yourdomain.com (prod)

  ROOT_DOMAIN           apps/web      yourdomain.com

  DATABASE_URL          apps/api      Postgres connection string

  JWT_SECRET            apps/api      256-bit random secret (openssl rand
                                      -hex 32)

  JWT_REFRESH_SECRET    apps/api      Separate 256-bit secret (openssl
                                      rand -hex 32)

  RESEND_API_KEY        apps/api      From resend.com dashboard after
                                      domain verified

  FRONTEND_URL          apps/api      http://localhost:3000 (dev) /
                                      https://yourdomain.com (prod)
  ------------------------------------------------------------------------

**B4 --- Subdomain Cookie Scope**

  -----------------------------------------------------------------------
  **DECISION: Cookie scoped to .yourdomain.com (root domain with leading
  dot). CORS credentials: true.**

  The refresh token cookie must be accessible from clinic.yourdomain.com
  (the Next.js frontend)

  when making requests to api.yourdomain.com (the Express backend).

  Solution: set the cookie domain to .yourdomain.com (note the leading
  dot). This makes the

  cookie available to all subdomains including the api subdomain.

  Security concern: does this expose the httpOnly cookie to tenant
  subdomains?

  No --- httpOnly cookies are never readable by JavaScript regardless of
  domain scope.

  The cookie is only sent in HTTP requests. A customer on
  clinic.yourdomain.com cannot

  read the admin\'s refresh token via JavaScript.

  -----------------------------------------------------------------------

**4.1 Cookie Configuration on Express**

> // apps/api/src/routes/auth.ts --- POST /auth/login
>
> res.cookie(\'refresh_token\', refreshToken, {
>
> httpOnly: true,
>
> secure: process.env.NODE_ENV === \'production\', // false in local dev
> (no HTTPS)
>
> sameSite: \'strict\',
>
> domain: process.env.NODE_ENV === \'production\'
>
> ? \`.\${process.env.ROOT_DOMAIN}\` // .yourdomain.com --- all
> subdomains
>
> : undefined, // localhost --- no domain scoping needed
>
> maxAge: 7 \* 24 \* 60 \* 60 \* 1000, // 7 days
>
> });

**4.2 CORS Configuration Update**

Both the web app origin and the API must allow credentials. Update
Express CORS:

> // apps/api/src/app.ts
>
> app.use(cors({
>
> origin: (origin, cb) =\> {
>
> const ROOT = process.env.ROOT_DOMAIN;
>
> const allowed = \[
>
> \`https://\${ROOT}\`, // yourdomain.com
>
> \`https://www.\${ROOT}\`, // www.yourdomain.com
>
> \'http://localhost:3000\', // Next.js local dev
>
> \];
>
> const isSubdomain = origin?.endsWith(\`.\${ROOT}\`);
>
> const isLocalSubdomain = origin?.endsWith(\'.localhost:3000\');
>
> if (!origin \|\| allowed.includes(origin) \|\| isSubdomain \|\|
> isLocalSubdomain) {
>
> cb(null, true);
>
> } else {
>
> cb(new Error(\'Not allowed by CORS\'));
>
> }
>
> },
>
> credentials: true, // REQUIRED for cookies to be sent cross-origin
>
> }));

**4.3 Local Development Setup**

Deployment is at booking.virajdomadia.com using path-based routing. No
subdomain routing, no middleware.ts, no /etc/hosts entries needed.
Tenant routing is handled by the Next.js App Router \[slug\] folder.

-   Local dev URLs (no setup needed --- just run pnpm dev):

> http://localhost:3000/book/demo-clinic ← tenant booking
>
> http://localhost:3000/book/demo-clinic/admin ← admin dashboard
>
> http://localhost:3000/book/demo-salon ← second tenant

-   No cookie domain scoping needed locally --- cookies on localhost
    work without a domain attribute.

**4.4 Verification Test (Run After Day 4)**

1.  Log in at http://localhost:3000/book/demo-clinic/admin

2.  Open browser DevTools → Application → Cookies

3.  Confirm refresh_token is present and httpOnly column shows a
    checkmark

4.  Open browser console. Run: document.cookie

5.  Expected result: refresh_token does NOT appear in the output
    (httpOnly = not readable by JS)

6.  Open Network tab, make any admin API call. Confirm the cookie is
    sent in Request Headers.

**B5 --- Email Retry Mechanism**

  -----------------------------------------------------------------------
  **DECISION: V1 uses best-effort email with logged failures. No retry
  queue in V1.**

  The original docs said \'add a cron job for retry\' but the tech stack
  has no cron runtime.

  Railway free tier has no cron. There is no Redis for a job queue.

  Adding a cron/queue system (BullMQ + Redis, or pg-boss) is a genuine
  infrastructure addition

  that would add 1-2 days to the build. It is not justified for a
  portfolio project.

  The correct V1 approach: best-effort with visibility. Email failures
  are logged, surfaced in

  the admin dashboard, and the booking is never blocked by email failure.
  This is honest,

  implementable in 30 minutes, and sufficient for V1.

  -----------------------------------------------------------------------

**5.1 Email Failure Handling --- V1 Implementation**

Add an emailStatus field to Booking. This is the only schema addition
required.

> // Add to Booking model in schema.prisma
>
> confirmationEmailStatus String \@default(\'PENDING\')
>
> // Values: PENDING \| SENT \| FAILED
>
> // adminEmailStatus field is optional --- add if you want admin-side
> visibility

**5.2 Resend Call Pattern --- Wrap Everything**

> // apps/api/src/services/email.ts
>
> export async function sendConfirmationEmail(booking: Booking):
> Promise\<void\> {
>
> try {
>
> await resend.emails.send({
>
> from: \'bookings@yourdomain.com\',
>
> to: booking.customerEmail,
>
> subject: \'Your booking is confirmed\',
>
> react: ConfirmationEmail({ booking }),
>
> });
>
> await prisma.booking.update({
>
> where: { id: booking.id },
>
> data: { confirmationEmailStatus: \'SENT\' }
>
> });
>
> } catch (error) {
>
> // Email failure NEVER throws --- booking is already created
>
> console.error(\'Email failed for booking\', booking.id, error);
>
> await prisma.booking.update({
>
> where: { id: booking.id },
>
> data: { confirmationEmailStatus: \'FAILED\' }
>
> });
>
> // Admin sees FAILED status in dashboard --- no silent failures
>
> }
>
> }

**5.3 Admin Dashboard --- Email Failure Visibility**

In the admin booking list, show a small warning badge on bookings where
confirmationEmailStatus is FAILED. This is a 30-minute UI addition. The
admin can manually follow up or resend from their own email.

-   Add a column or badge to the booking list: Email: Sent / Failed

-   Filter option: \'Email failed\' --- so admin can action these
    specifically

-   No retry button in V1 --- the admin is informed and can follow up
    manually

**5.4 V2 Email Queue Path**

When a paying client needs reliable email delivery, the correct upgrade
path is:

-   Add pg-boss (Postgres-based job queue --- no Redis needed) to the
    Express API

-   Email sends become jobs instead of direct calls

-   Retries are automatic with exponential backoff

-   This adds approximately 4-6 hours of work and requires no new
    infrastructure

**Pre-Development Readiness Checklist**

Complete every item before writing application code. Do not start Day 1
until all boxes are checked.

**B1 --- Environment**

-   node \--version prints 18.x or 20.x

-   pnpm \--version prints 8.x or later

-   docker \--version prints successfully

-   Resend account created and domain DNS verified (send a test email)

-   Railway account created, Postgres add-on provisioned

-   Vercel account created, linked to GitHub

-   Domain purchased (Cloudflare recommended), wildcard DNS A record
    added

**B2 --- Monorepo**

-   turbo.json deleted or never created

-   pnpm-workspace.yaml created with apps/\* and packages/\* entries

-   Root package.json has dev, dev:api, dev:web scripts using
    concurrently

-   pnpm install runs at root without errors

**B3 --- Auth**

-   next-auth NOT installed in apps/web

-   AuthContext created in apps/web with accessToken in React state

-   Axios instance created with request/response interceptors

-   .env.example updated --- no NEXTAUTH_URL or NEXTAUTH_SECRET

**B4 --- Cookies**

-   Cookie set with domain: .yourdomain.com in production

-   Cookie set with secure: true in production, false in development

-   Path-based routing confirmed: http://localhost:3000/book/demo-clinic
    loads correct tenant, http://localhost:3000/book/demo-salon loads
    second tenant independently

-   Verified: refresh_token cookie is httpOnly (not visible in
    document.cookie)

**B5 --- Email**

-   confirmationEmailStatus field added to Booking model in
    schema.prisma

-   All Resend calls wrapped in try-catch --- email failure does not
    throw

-   Failed emails update confirmationEmailStatus to FAILED in the
    database

-   Admin booking list shows email status badge

  -----------------------------------------------------------------------
  **You are ready to start Day 1 when every item above is checked.**

  Estimated time to complete pre-dev setup: 2-4 hours.

  This is not wasted time --- it prevents 10-20 hours of mid-build
  debugging.

  -----------------------------------------------------------------------
