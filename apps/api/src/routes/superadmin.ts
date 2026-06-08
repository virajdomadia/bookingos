import { Router, Request, Response, NextFunction } from "express";
import type { Router as ExpressRouter } from "express";
import { Prisma } from "@prisma/client";
import { z, ZodError } from "zod";
import crypto from "crypto";
import prisma from "../lib/prisma.js";
import { withTenant } from "../lib/tenantDb.js";
import { hashPassword, validatePassword } from "../utils/password.js";
import { ApiError, ErrorCode } from "../types/api.js";

/**
 * Super admin (internal ops) routes — the ONLY path that creates tenants.
 * There is no public self-service registration: every tenant + owner is
 * provisioned here. Protected by a single shared secret in the
 * `X-Super-Admin-Secret` header (value from SUPER_ADMIN_SECRET), not by the
 * tenant JWT flow, because these operations span all tenants.
 */
const router: ExpressRouter = Router();

const sendError = (res: Response, status: number, error: string, code: ErrorCode) => {
  const errorResponse: ApiError = { error, code };
  res.status(status).json(errorResponse);
};

// ============================================================================
// AUTH: shared-secret gate (constant-time compare, fail-closed)
// ============================================================================

const requireSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
  const configured = process.env.SUPER_ADMIN_SECRET;

  // Fail closed: if the secret isn't configured, the panel is unusable rather
  // than open. (Not added to the boot-time required-vars list so the rest of
  // the API still runs without it.)
  if (!configured) {
    return sendError(res, 503, "Super admin is not configured", ErrorCode.INTERNAL_ERROR);
  }

  const provided = req.header("x-super-admin-secret") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(configured);
  // timingSafeEqual throws on length mismatch, so length-check first; the
  // comparison itself stays constant-time for equal-length inputs.
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!ok) {
    return sendError(res, 403, "Forbidden", ErrorCode.FORBIDDEN);
  }

  next();
};

router.use(requireSuperAdmin);

// ============================================================================
// VALIDATION
// ============================================================================

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 50);

const createTenantSchema = z.object({
  name: z.string().trim().min(2, "Business name must be at least 2 characters").max(100),
  slug: z
    .string()
    .trim()
    .min(3, "Slug must be at least 3 characters")
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug may only contain lowercase letters, numbers, and hyphens")
    .optional(),
  ownerEmail: z.string().email("Invalid email format").max(255),
  ownerPassword: z.string().min(8, "Password must be at least 8 characters").max(1000),
  plan: z.string().trim().max(50).optional(),
});

const patchTenantSchema = z.object({
  isActive: z.boolean(),
});

// ============================================================================
// POST /superadmin/tenants — create tenant + owner + default schedule
// ============================================================================

router.post("/tenants", async (req: Request, res: Response) => {
  try {
    const input = createTenantSchema.parse(req.body);
    const email = input.ownerEmail.toLowerCase().trim();
    const slug = slugify(input.slug ?? input.name);

    if (slug.length < 3) {
      return sendError(
        res,
        400,
        "Slug must have at least 3 alphanumeric characters",
        ErrorCode.VALIDATION_ERROR
      );
    }

    const passwordCheck = validatePassword(input.ownerPassword);
    if (!passwordCheck.valid) {
      return sendError(res, 400, passwordCheck.error ?? "Weak password", ErrorCode.WEAK_PASSWORD);
    }

    // Friendly pre-checks; the unique constraints below are the real guard
    // against a concurrent create taking the same email/slug (TOCTOU).
    const [emailTaken, slugTaken] = await Promise.all([
      prisma.user.findUnique({ where: { email } }),
      prisma.tenant.findUnique({ where: { slug } }),
    ]);
    if (emailTaken) {
      return sendError(res, 409, "Email is already registered", ErrorCode.EMAIL_TAKEN);
    }
    if (slugTaken) {
      return sendError(res, 409, "This slug is already taken", ErrorCode.SLUG_TAKEN);
    }

    const passwordHash = await hashPassword(input.ownerPassword);

    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: input.name,
          slug,
          ...(input.plan ? { plan: input.plan } : {}),
        },
      });

      // Schedule is RLS-protected (FORCE). Set the tenant context on THIS
      // connection — the one running the transaction — before inserting it, or
      // the WITH CHECK policy rejects the row. Tenant/User have no RLS, so their
      // ordering relative to this call doesn't matter.
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenant.id}, true)`;

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email,
          passwordHash,
          role: "OWNER",
        },
      });

      await tx.schedule.create({
        data: {
          tenantId: tenant.id,
          timezone: "Asia/Kolkata",
          workStart: "09:00",
          workEnd: "18:00",
          slotInterval: 30,
        },
      });

      return { tenant, user };
    });

    res.status(201).json({
      data: {
        id: result.tenant.id,
        name: result.tenant.name,
        slug: result.tenant.slug,
        ownerEmail: result.user.email,
        isActive: result.tenant.isActive,
        plan: result.tenant.plan,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return sendError(res, 400, error.errors[0].message, ErrorCode.VALIDATION_ERROR);
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const target = (error.meta?.target as string[] | string | undefined) ?? "";
      const onEmail = Array.isArray(target)
        ? target.includes("email")
        : String(target).includes("email");
      return onEmail
        ? sendError(res, 409, "Email is already registered", ErrorCode.EMAIL_TAKEN)
        : sendError(res, 409, "This slug is already taken", ErrorCode.SLUG_TAKEN);
    }
    console.error("Super admin create tenant error:", error);
    sendError(res, 500, "Failed to create tenant", ErrorCode.INTERNAL_ERROR);
  }
});

// ============================================================================
// GET /superadmin/tenants — list all tenants with owner + booking count
// ============================================================================

router.get("/tenants", async (_req: Request, res: Response) => {
  try {
    const tenants = await prisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        isActive: true,
        createdAt: true,
        users: { where: { role: "OWNER" }, select: { email: true }, take: 1 },
      },
    });

    // Booking is RLS-protected, so a single cross-tenant count returns 0. Count
    // under each tenant's context instead. Fine for an internal ops tool with a
    // modest number of tenants.
    const data = await Promise.all(
      tenants.map(async (t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        plan: t.plan,
        isActive: t.isActive,
        createdAt: t.createdAt,
        ownerEmail: t.users[0]?.email ?? null,
        bookingCount: await withTenant(t.id, (tx) => tx.booking.count()),
      }))
    );

    res.json({ data });
  } catch (error) {
    console.error("Super admin list tenants error:", error);
    sendError(res, 500, "Failed to load tenants", ErrorCode.INTERNAL_ERROR);
  }
});

// ============================================================================
// PATCH /superadmin/tenants/:id — activate / deactivate
// ============================================================================

router.patch("/tenants/:id", async (req: Request, res: Response) => {
  try {
    const { isActive } = patchTenantSchema.parse(req.body);

    const tenant = await prisma.tenant.update({
      where: { id: req.params.id },
      data: { isActive },
      select: { id: true, name: true, slug: true, isActive: true },
    });

    res.json({ data: tenant });
  } catch (error) {
    if (error instanceof ZodError) {
      return sendError(res, 400, error.errors[0].message, ErrorCode.VALIDATION_ERROR);
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return sendError(res, 404, "Tenant not found", ErrorCode.NOT_FOUND);
    }
    console.error("Super admin patch tenant error:", error);
    sendError(res, 500, "Failed to update tenant", ErrorCode.INTERNAL_ERROR);
  }
});

// ============================================================================
// DELETE /superadmin/tenants/:id — hard delete (non-production only)
// ============================================================================

router.delete("/tenants/:id", async (req: Request, res: Response) => {
  // Hard delete is a dev/testing convenience. The FK cascades remove the
  // tenant's Users/Services/Bookings/Schedule (cascades bypass RLS), which is
  // irreversible — keep it out of production.
  if (process.env.NODE_ENV === "production") {
    return sendError(res, 403, "Hard delete is disabled in production", ErrorCode.FORBIDDEN);
  }

  try {
    await prisma.tenant.delete({ where: { id: req.params.id } });
    res.json({ data: { message: "Tenant deleted" } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return sendError(res, 404, "Tenant not found", ErrorCode.NOT_FOUND);
    }
    console.error("Super admin delete tenant error:", error);
    sendError(res, 500, "Failed to delete tenant", ErrorCode.INTERNAL_ERROR);
  }
});

export default router;
