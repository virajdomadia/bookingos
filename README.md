# BookingOS v1.3

A white-label SaaS appointment booking platform for small service businesses (salons, trainers, tutors, consultants).

## Tech Stack

- **Frontend:** Next.js 14 (App Router, TypeScript) → Vercel
- **Backend:** Express 4 + Node.js 18+ → Railway
- **Database:** PostgreSQL 15 (Row-Level Security for multi-tenant isolation)
- **Auth:** Custom JWT (15-min access token, 7-day refresh token in httpOnly cookie)
- **Email:** Resend + React Email templates
- **Monorepo:** pnpm workspaces

## Project Structure

```
.
├── apps/
│   ├── web/           # Next.js 14 frontend
│   └── api/           # Express backend
├── packages/
│   ├── db/            # Prisma schema + migrations
│   ├── types/         # Shared TypeScript types
│   └── utils/         # Shared utility functions
├── docker-compose.yml # PostgreSQL local development
└── pnpm-workspace.yaml
```

## Setup Instructions

### Prerequisites

- Node.js 18+ LTS
- pnpm 8+
- Docker Desktop (for local PostgreSQL)

### 1. Environment Setup

```bash
# Copy environment files
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp packages/db/.env.example packages/db/.env
```

**Generate JWT secrets:**
```bash
# On Mac/Linux:
openssl rand -hex 32

# On Windows PowerShell:
[System.Convert]::ToHexString((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

Update the following in `apps/api/.env`:
```
JWT_SECRET=<your-32-char-hex-string>
JWT_REFRESH_SECRET=<your-32-char-hex-string>
```

### 2. Start PostgreSQL

```bash
# Start Docker Desktop (if not running)

# Start PostgreSQL container
docker compose up -d

# Verify connection
psql -h localhost -U postgres -d booking_os -c "SELECT 1"
```

### 3. Database Setup

```bash
# Install dependencies
pnpm install

# Run Prisma migrations
pnpm db:migrate

# Seed test data
pnpm db:seed

# (Optional) Open Prisma Studio
pnpm db:studio
```

### 4. Start Development Servers

```bash
# Terminal 1: Both frontend and backend
pnpm dev

# OR separately:

# Terminal 1: Backend (Express on :4000)
pnpm dev:api

# Terminal 2: Frontend (Next.js on :3000)
pnpm dev:web
```

### 5. Verify Setup

- **Frontend:** http://localhost:3000 (should show "BookingOS" placeholder)
- **Backend:** http://localhost:4000/health (should return `{"status":"ok","timestamp":"..."`)
- **Database:** http://localhost:5432 (PostgreSQL running)

## Build Features (F0-F11)

| Feature | Status | Priority | Time |
|---------|--------|----------|------|
| F0: Project Setup | ✓ In Progress | P0 | 6-8h |
| F1: Auth (Register/Login) | Planned | P0 | 8-10h |
| F2: Tenant & Schedule Mgmt | Planned | P0 | 6-8h |
| F3: Service Management | Planned | P0 | 4-6h |
| F4: Public Booking Flow | Planned | P0 | 14-18h |
| F5: Admin Dashboard | Planned | P0 | 8-10h |
| F6: Email Notifications | Planned | P0 | 6-8h |
| F7: Customer Cancel via Email | Planned | P1 | 4-5h |
| F8: Staff Management | Planned | P1 | 5-6h |
| F9: 24hr Reminder Cron | Planned | P1 | 2-3h |
| F10: Super Admin Panel | Planned | P2 | 4-5h |
| F11: Deploy & Go Live | Planned | P0 | 6-8h |

**Total Estimate:** 70-100 hours (35-50 days at 2 hrs/day)

## Key Architecture Decisions

- **Path-based routing:** `/book/[slug]` instead of subdomain (simpler SSL on Vercel free tier)
- **RLS mandatory:** Row-Level Security policies enforce tenant isolation at database layer
- **Custom JWT only:** NextAuth removed due to RLS context conflicts (Express sets `app.tenant_id`)
- **Race condition prevention:** SERIALIZABLE transactions + SELECT FOR UPDATE
- **pnpm workspaces:** Lightweight monorepo, Turborepo removed (added zero value at this scale)

## Important Constraints

✗ **No payments (V2):** Razorpay deferred  
✗ **No monitoring (V2):** Sentry/logging deferred  
✗ **No GDPR (V1):** Not targeting EU  
✗ **No mobile app:** Web-only, responsive at 375px

These are intentional. For production, add 60+ hours for SaaS concerns.

## Testing Checklist

Before shipping (all 23 items must pass):

### Security (5 items)
- [ ] RLS cross-tenant query returns 0 rows
- [ ] Refresh token httpOnly, not in DevTools
- [ ] /admin routes return 401 without JWT
- [ ] Rate limiting on login (15+ requests)
- [ ] CORS rejects non-ROOT_DOMAIN origins

### Booking Logic (5 items)
- [ ] Concurrent test: 50 simultaneous same slot → 1 succeeds, 49 rejected (409)
- [ ] Break times block slots
- [ ] Past slots not shown
- [ ] Service duration respected
- [ ] Closed days show no slots

### Email (5 items)
- [ ] Confirmation email in Gmail
- [ ] .ics calendar attachment opens in Google Calendar + iPhone
- [ ] Cancel link works
- [ ] All emails render on mobile
- [ ] Email failure doesn't fail booking

### Multi-Tenancy (3 items)
- [ ] Two demo tenants at two paths
- [ ] Tenant A can't see Tenant B bookings
- [ ] Branding shows per-tenant

### UX (5 items)
- [ ] Path-based routing works locally
- [ ] No middleware.ts file
- [ ] Demo DB has realistic seed data
- [ ] README with live link + setup instructions
- [ ] Mobile testing at 375px

## Deployment

### Frontend (Vercel)
```bash
git push origin main
# Vercel auto-deploys from GitHub
```

**Env vars in Vercel:**
```
NEXT_PUBLIC_API_URL=https://api.railway.app
NEXT_PUBLIC_ROOT_DOMAIN=booking.virajdomadia.com
```

### Backend (Railway)
```bash
git push origin main
# Railway auto-deploys from GitHub, runs migrations
```

**Env vars in Railway:**
```
PORT=4000
DATABASE_URL=<Railway Postgres>
JWT_SECRET=<from .env>
JWT_REFRESH_SECRET=<from .env>
RESEND_API_KEY=<from Resend>
FRONTEND_URL=https://booking.virajdomadia.com
ROOT_DOMAIN=virajdomadia.com
```

### DNS
- Add CNAME: `booking` → `cname.vercel-dns.com`
- Vercel auto-issues SSL certificate
- Wait for DNS propagation (<1 hr typical, up to 48 hrs)

## Troubleshooting

### "SERIALIZABLE isolation" tests failing
- Ensure PostgreSQL is running on :5432
- Check `SELECT isolation_level FROM pg_settings` → should be `serializable`

### JWT token expiry in dev
- Refresh tokens use httpOnly cookies (invisible in DevTools)
- Check: DevTools → Application → Cookies → `refreshToken`

### pnpm link issues
- Remove `node_modules` and `.pnpm-store`
- Run `pnpm install` again

### Database migrations failing
- `pnpm db:migrate` uses shadow database (separate DB for schema validation)
- Ensure both `DATABASE_URL` and `SHADOW_DATABASE_URL` point to valid Postgres

## Contributors

Built by Viraj Domadia as a portfolio project demonstrating:
- Multi-tenant SaaS architecture
- Row-Level Security (RLS) for data isolation
- Race condition prevention in booking systems
- Full-stack TypeScript development
- Production-grade email notifications

---

**Start Date:** June 5, 2026  
**Target Completion:** Late June 2026  
**Live Demo:** (link when deployed)
