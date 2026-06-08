import { Router, Request, Response } from "express";
import type { Router as ExpressRouter } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import crypto from "crypto";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import prisma from "../lib/prisma.js";
import { withTenant } from "../lib/tenantDb.js";
import { hashPassword } from "../utils/password.js";
import { hashToken } from "../utils/jwt.js";
import {
  serviceCreateSchema,
  serviceUpdateSchema,
  tenantUpdateSchema,
  scheduleUpdateSchema,
  validateScheduleCoherence,
  bookingListQuerySchema,
  bookingStatusPatchSchema,
  staffInviteSchema,
  staffUpdateSchema,
} from "../lib/validators.js";
import { ApiError, ErrorCode } from "../types/api.js";
import { getZonedDateParts, zonedDayRangeUtc } from "@booking-os/utils";
import {
  sendBookingConfirmed,
  sendBookingCancelled,
  sendStaffInvite,
  type BookingEmailData,
  type TenantEmailData,
} from "../lib/email.js";

const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";
// Invite links are valid for 7 days, matching the refresh-token lifetime.
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const router: ExpressRouter = Router();

// All routes in this file require authentication
router.use(authMiddleware);

// ============================================================================
// HELPERS
// ============================================================================

const sendError = (res: Response, status: number, error: string, code: ErrorCode) => {
  const errorResponse: ApiError = { error, code };
  res.status(status).json(errorResponse);
};

/** Translate a ZodError into a 400 with the first human-readable message. */
const sendValidationError = (res: Response, error: ZodError) => {
  sendError(res, 400, error.errors[0]?.message ?? "Invalid request", ErrorCode.VALIDATION_ERROR);
};

/**
 * The IANA timezone the tenant operates in. Day/week boundaries and date filters
 * must be computed in this zone, not UTC, or counts land in the wrong bucket for
 * any non-UTC tenant. Schedule is RLS-protected, so read it inside the context.
 */
const getTenantTimezone = async (tenantId: string): Promise<string> =>
  withTenant(tenantId, (tx) =>
    tx.schedule.findUnique({ where: { tenantId }, select: { timezone: true } })
  )
    .then((s) => s?.timezone ?? "Asia/Kolkata")
    .catch(() => "Asia/Kolkata");

/** Parse a validated "YYYY-MM-DD" string into numeric parts. */
const parseYmd = (date: string): { year: number; month: number; day: number } => {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day };
};

// ============================================================================
// GET /admin/schedule
// ============================================================================

router.get("/schedule", requireRole(["OWNER", "ADMIN"]), async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const schedule = await withTenant(tenantId, (tx) =>
      tx.schedule.findUnique({ where: { tenantId } })
    );

    if (!schedule) {
      return sendError(res, 404, "Schedule not found", ErrorCode.NOT_FOUND);
    }

    res.json({ data: schedule });
  } catch (error) {
    console.error("Get schedule error:", error);
    sendError(res, 500, "Failed to fetch schedule", ErrorCode.INTERNAL_ERROR);
  }
});

// ============================================================================
// PUT /admin/schedule
// ============================================================================

router.put("/schedule", requireRole(["OWNER", "ADMIN"]), async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const input = scheduleUpdateSchema.parse(req.body);

    const updated = await withTenant(tenantId, async (tx) => {
      const existing = await tx.schedule.findUnique({ where: { tenantId } });
      if (!existing) return null;

      // Merge incoming partial update with the persisted row so cross-field
      // coherence (work hours, break overlap) is validated against the
      // effective resulting schedule, not just the fields in this request.
      const effectiveBreaks = (input.breakTimes ?? (existing.breakTimes as { start: string; end: string }[])) ?? [];
      const coherenceError = validateScheduleCoherence({
        workStart: input.workStart ?? existing.workStart,
        workEnd: input.workEnd ?? existing.workEnd,
        breakTimes: Array.isArray(effectiveBreaks) ? effectiveBreaks : [],
      });
      if (coherenceError) return { coherenceError };

      return {
        schedule: await tx.schedule.update({
          where: { tenantId },
          data: {
            ...(input.timezone !== undefined && { timezone: input.timezone }),
            ...(input.workStart !== undefined && { workStart: input.workStart }),
            ...(input.workEnd !== undefined && { workEnd: input.workEnd }),
            ...(input.slotInterval !== undefined && { slotInterval: input.slotInterval }),
            ...(input.bufferTime !== undefined && { bufferTime: input.bufferTime }),
            ...(input.breakTimes !== undefined && { breakTimes: input.breakTimes }),
            ...(input.workingDays !== undefined && { workingDays: input.workingDays }),
          },
        }),
      };
    });

    if (updated === null) {
      return sendError(res, 404, "Schedule not found", ErrorCode.NOT_FOUND);
    }
    if ("coherenceError" in updated && updated.coherenceError) {
      return sendError(res, 400, updated.coherenceError, ErrorCode.VALIDATION_ERROR);
    }

    res.json({ data: updated.schedule });
  } catch (error) {
    if (error instanceof ZodError) return sendValidationError(res, error);
    console.error("Update schedule error:", error);
    sendError(res, 500, "Failed to update schedule", ErrorCode.INTERNAL_ERROR);
  }
});

// ============================================================================
// GET /admin/services
// ============================================================================

router.get("/services", requireRole(["OWNER", "ADMIN"]), async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const services = await withTenant(tenantId, (tx) =>
      tx.service.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" } })
    );
    res.json({ data: services });
  } catch (error) {
    console.error("Get services error:", error);
    sendError(res, 500, "Failed to fetch services", ErrorCode.INTERNAL_ERROR);
  }
});

// ============================================================================
// POST /admin/services
// ============================================================================

router.post("/services", requireRole(["OWNER", "ADMIN"]), async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const input = serviceCreateSchema.parse(req.body);

    const service = await withTenant(tenantId, (tx) =>
      tx.service.create({
        data: {
          tenantId,
          name: input.name,
          durationMinutes: input.durationMinutes,
          price: input.price,
          isStaffService: input.isStaffService,
        },
      })
    );

    res.status(201).json({ data: service });
  } catch (error) {
    if (error instanceof ZodError) return sendValidationError(res, error);
    console.error("Create service error:", error);
    sendError(res, 500, "Failed to create service", ErrorCode.INTERNAL_ERROR);
  }
});

// ============================================================================
// PUT /admin/services/:id
// ============================================================================

router.put("/services/:id", requireRole(["OWNER", "ADMIN"]), async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;
    const input = serviceUpdateSchema.parse(req.body);

    const result = await withTenant(tenantId, async (tx) => {
      const service = await tx.service.findFirst({ where: { id, tenantId } });
      if (!service) return null;

      return tx.service.update({
        where: { id },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.durationMinutes !== undefined && { durationMinutes: input.durationMinutes }),
          ...(input.price !== undefined && { price: input.price }),
          ...(input.isActive !== undefined && { isActive: input.isActive }),
        },
      });
    });

    if (!result) {
      return sendError(res, 404, "Service not found", ErrorCode.NOT_FOUND);
    }

    res.json({ data: result });
  } catch (error) {
    if (error instanceof ZodError) return sendValidationError(res, error);
    console.error("Update service error:", error);
    sendError(res, 500, "Failed to update service", ErrorCode.INTERNAL_ERROR);
  }
});

// ============================================================================
// DELETE /admin/services/:id  (soft delete)
// ============================================================================

router.delete("/services/:id", requireRole(["OWNER"]), async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;

    const result = await withTenant(tenantId, async (tx) => {
      const service = await tx.service.findFirst({ where: { id, tenantId } });
      if (!service) return null;
      return tx.service.update({ where: { id }, data: { isActive: false } });
    });

    if (!result) {
      return sendError(res, 404, "Service not found", ErrorCode.NOT_FOUND);
    }

    res.json({ data: { message: "Service deleted successfully" } });
  } catch (error) {
    console.error("Delete service error:", error);
    sendError(res, 500, "Failed to delete service", ErrorCode.INTERNAL_ERROR);
  }
});

// ============================================================================
// GET /admin/tenant
// ============================================================================

router.get("/tenant", requireRole(["OWNER", "ADMIN", "STAFF"]), async (req: Request, res: Response) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId! },
      select: { id: true, name: true, slug: true, logoUrl: true, primaryColor: true, plan: true },
    });

    if (!tenant) {
      return sendError(res, 404, "Tenant not found", ErrorCode.NOT_FOUND);
    }

    res.json({ data: tenant });
  } catch (error) {
    console.error("Get tenant error:", error);
    sendError(res, 500, "Failed to fetch tenant", ErrorCode.INTERNAL_ERROR);
  }
});

// ============================================================================
// PUT /admin/tenant
// ============================================================================

router.put("/tenant", requireRole(["OWNER"]), async (req: Request, res: Response) => {
  try {
    const input = tenantUpdateSchema.parse(req.body);

    const updatedTenant = await prisma.tenant.update({
      where: { id: req.tenantId! },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.logoUrl !== undefined && { logoUrl: input.logoUrl }),
        ...(input.primaryColor !== undefined && { primaryColor: input.primaryColor }),
      },
      select: { id: true, name: true, slug: true, logoUrl: true, primaryColor: true, plan: true },
    });

    res.json({ data: updatedTenant });
  } catch (error) {
    if (error instanceof ZodError) return sendValidationError(res, error);
    console.error("Update tenant error:", error);
    sendError(res, 500, "Failed to update tenant", ErrorCode.INTERNAL_ERROR);
  }
});

// ============================================================================
// GET /admin/stats  — KPI counts for dashboard
// ============================================================================

router.get("/stats", requireRole(["OWNER", "ADMIN", "STAFF"]), async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;

    // Day/week windows are computed in the tenant's timezone, not UTC, so a
    // booking near midnight is counted under the correct local day.
    const timezone = await getTenantTimezone(tenantId);
    const { year, month, day, weekday } = getZonedDateParts(timezone);

    // Today: tenant-local midnight → next tenant-local midnight.
    const { start: todayStart, end: todayEnd } = zonedDayRangeUtc(year, month, day, timezone);

    // This week: Monday → Sunday, anchored to the tenant-local week.
    const daysFromMonday = weekday === 0 ? 6 : weekday - 1; // 0=Sun … 6=Sat
    const { start: weekStart } = zonedDayRangeUtc(year, month, day - daysFromMonday, timezone);
    const { start: weekEnd } = zonedDayRangeUtc(year, month, day - daysFromMonday + 7, timezone);

    // Booking is RLS-protected (FORCE) — these counts must run inside a tenant
    // context, otherwise the policy filters every row and they all return 0.
    const [todayCount, weekCount, pendingCount] = await withTenant(tenantId, (tx) =>
      Promise.all([
        tx.booking.count({
          where: { tenantId, status: { not: "CANCELLED" }, startsAt: { gte: todayStart, lt: todayEnd } },
        }),
        tx.booking.count({
          where: { tenantId, status: { not: "CANCELLED" }, startsAt: { gte: weekStart, lt: weekEnd } },
        }),
        tx.booking.count({
          where: { tenantId, status: "PENDING" },
        }),
      ])
    );

    res.json({ data: { today: todayCount, thisWeek: weekCount, pending: pendingCount } });
  } catch (error) {
    console.error("Get stats error:", error);
    sendError(res, 500, "Failed to fetch stats", ErrorCode.INTERNAL_ERROR);
  }
});

// ============================================================================
// GET /admin/bookings  — list with filters + pagination
// ============================================================================

router.get("/bookings", async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const query = bookingListQuerySchema.parse(req.query);

    const where: Prisma.BookingWhereInput = { tenantId };

    if (query.status) where.status = query.status;
    if (query.serviceId) where.serviceId = query.serviceId;
    if (query.dateFrom || query.dateTo) {
      // dateFrom/dateTo are calendar days in the tenant's timezone. Resolve them
      // to UTC instants in that zone (inclusive from-day start, exclusive
      // day-after-to start), or a +5:30 tenant's filter is off by the offset.
      const timezone = await getTenantTimezone(tenantId);
      where.startsAt = {
        ...(query.dateFrom && (() => {
          const { year, month, day } = parseYmd(query.dateFrom);
          return { gte: zonedDayRangeUtc(year, month, day, timezone).start };
        })()),
        ...(query.dateTo && (() => {
          const { year, month, day } = parseYmd(query.dateTo);
          return { lt: zonedDayRangeUtc(year, month, day, timezone).end };
        })()),
      };
    }

    const skip = (query.page - 1) * query.limit;

    // Booking is RLS-protected (FORCE) — run the list + count inside a tenant
    // context, otherwise the policy hides every row and the list is always empty.
    const [bookings, total] = await withTenant(tenantId, (tx) =>
      Promise.all([
        tx.booking.findMany({
          where,
          orderBy: { startsAt: "asc" },
          skip,
          take: query.limit,
          select: {
            id: true,
            customerName: true,
            customerEmail: true,
            customerPhone: true,
            customerNotes: true,
            adminNotes: true,
            startsAt: true,
            endsAt: true,
            status: true,
            cancelToken: true,
            confirmationEmailStatus: true,
            createdAt: true,
            service: { select: { id: true, name: true, durationMinutes: true, price: true } },
          },
        }),
        tx.booking.count({ where }),
      ])
    );

    res.json({
      data: {
        bookings,
        total,
        page: query.page,
        limit: query.limit,
        hasMore: skip + bookings.length < total,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) return sendValidationError(res, error);
    console.error("Get bookings error:", error);
    sendError(res, 500, "Failed to fetch bookings", ErrorCode.INTERNAL_ERROR);
  }
});

// ============================================================================
// PATCH /admin/bookings/:id  — update status + optional admin notes
// ============================================================================

// Fire CONFIRMED / CANCELLED emails non-blocking after a status update.
async function fireStatusEmail(
  tenantId: string,
  booking: BookingEmailData,
  newStatus: string
): Promise<void> {
  const tenant = await prisma.tenant
    .findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, slug: true, primaryColor: true },
    })
    .catch(() => null);
  if (!tenant) return;

  // Schedule carries the timezone the booking time must render in. It is
  // RLS-protected, so read it inside a tenant context.
  const timezone = await withTenant(tenantId, (tx) =>
    tx.schedule.findUnique({ where: { tenantId }, select: { timezone: true } })
  )
    .then((s) => s?.timezone ?? "Asia/Kolkata")
    .catch(() => "Asia/Kolkata");

  const tenantData: TenantEmailData = {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    primaryColor: tenant.primaryColor,
    timezone,
  };

  if (newStatus === "CONFIRMED") {
    await sendBookingConfirmed(booking, tenantData);
  } else if (newStatus === "CANCELLED") {
    await sendBookingCancelled(booking, tenantData);
  }
}

// Allowed status transitions
const TRANSITIONS: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "CANCELLED", "NO_SHOW"],
  COMPLETED: ["CANCELLED"],
  NO_SHOW: ["CANCELLED"],
  CANCELLED: [],
};

router.patch(
  "/bookings/:id",
  requireRole(["OWNER", "ADMIN", "STAFF"]),
  async (req: Request, res: Response) => {
    try {
      const tenantId = req.tenantId!;
      const { id } = req.params;
      const input = bookingStatusPatchSchema.parse(req.body);

      const result = await withTenant(tenantId, async (tx) => {
        const booking = await tx.booking.findFirst({ where: { id, tenantId } });
        if (!booking) return { notFound: true as const };

        const allowed = TRANSITIONS[booking.status] ?? [];
        if (!allowed.includes(input.status)) {
          return { invalidTransition: true as const, from: booking.status, to: input.status };
        }

        const updated = await tx.booking.update({
          where: { id },
          data: {
            status: input.status,
            ...(input.adminNotes !== undefined && { adminNotes: input.adminNotes }),
          },
          select: {
            id: true,
            customerName: true,
            customerEmail: true,
            customerPhone: true,
            customerNotes: true,
            adminNotes: true,
            startsAt: true,
            endsAt: true,
            status: true,
            cancelToken: true,
            confirmationEmailStatus: true,
            createdAt: true,
            service: { select: { id: true, name: true, durationMinutes: true, price: true } },
          },
        });

        return { booking: updated };
      });

      if ("notFound" in result) {
        return sendError(res, 404, "Booking not found", ErrorCode.NOT_FOUND);
      }
      if ("invalidTransition" in result) {
        return sendError(
          res,
          422,
          `Cannot change status from ${result.from} to ${result.to}`,
          ErrorCode.VALIDATION_ERROR
        );
      }

      res.json({ data: result.booking });

      // Fire notification emails non-blocking after response.
      if (input.status === "CONFIRMED" || input.status === "CANCELLED") {
        const { id, cancelToken, customerName, customerEmail, customerPhone, customerNotes, adminNotes, startsAt, endsAt, service } = result.booking;
        void fireStatusEmail(
          tenantId,
          { id, cancelToken, customerName, customerEmail, customerPhone, customerNotes, adminNotes, startsAt, endsAt, service },
          input.status
        );
      }
    } catch (error) {
      if (error instanceof ZodError) return sendValidationError(res, error);
      console.error("Patch booking error:", error);
      sendError(res, 500, "Failed to update booking", ErrorCode.INTERNAL_ERROR);
    }
  }
);

// ============================================================================
// STAFF MANAGEMENT (F8) — OWNER only.
// ============================================================================
//
// The User table is intentionally NOT under RLS (the unauthenticated auth flow
// and super-admin provisioning must read/write it before any tenant context
// exists). So these handlers use the base prisma client with an explicit
// `where: { tenantId }` on every query as the isolation guard.

type StaffUserRow = {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  inviteTokenHash: string | null;
  inviteExpiresAt: Date | null;
  createdAt: Date;
};

type StaffStatus = "ACTIVE" | "DEACTIVATED" | "INVITE_PENDING" | "INVITE_EXPIRED";

/** Shape a User row into the staff list item the dashboard renders. */
function toStaffMember(u: StaffUserRow) {
  const pendingInvite = u.inviteTokenHash !== null;
  const inviteExpired =
    pendingInvite && u.inviteExpiresAt !== null && u.inviteExpiresAt.getTime() < Date.now();
  const status: StaffStatus = pendingInvite
    ? inviteExpired
      ? "INVITE_EXPIRED"
      : "INVITE_PENDING"
    : u.isActive
      ? "ACTIVE"
      : "DEACTIVATED";
  return {
    id: u.id,
    email: u.email,
    role: u.role,
    isActive: u.isActive,
    status,
    inviteExpiresAt: u.inviteExpiresAt,
    createdAt: u.createdAt,
  };
}

const STAFF_SELECT = {
  id: true,
  email: true,
  role: true,
  isActive: true,
  inviteTokenHash: true,
  inviteExpiresAt: true,
  createdAt: true,
} as const;

/** Build the TenantEmailData an invite email needs (branding + timezone). */
async function tenantEmailData(tenantId: string): Promise<TenantEmailData | null> {
  const tenant = await prisma.tenant
    .findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, slug: true, primaryColor: true },
    })
    .catch(() => null);
  if (!tenant) return null;
  return { ...tenant, timezone: await getTenantTimezone(tenantId) };
}

// ----------------------------------------------------------------------------
// GET /admin/staff — list all team members (active, deactivated, pending)
// ----------------------------------------------------------------------------

router.get("/staff", requireRole(["OWNER"]), async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      where: { tenantId: req.tenantId! },
      orderBy: { createdAt: "asc" },
      select: STAFF_SELECT,
    });
    res.json({ data: users.map(toStaffMember) });
  } catch (error) {
    console.error("List staff error:", error);
    sendError(res, 500, "Failed to load staff", ErrorCode.INTERNAL_ERROR);
  }
});

// ----------------------------------------------------------------------------
// POST /admin/staff/invite — create a pending invitee + email the invite link
// ----------------------------------------------------------------------------

router.post("/staff/invite", requireRole(["OWNER"]), async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const input = staffInviteSchema.parse(req.body);
    const email = input.email.toLowerCase().trim();

    // Friendly pre-check; the unique constraint below is the real TOCTOU guard.
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return sendError(res, 409, "That email already has an account", ErrorCode.EMAIL_TAKEN);
    }

    // Raw token goes in the email link only; the DB stores its SHA-256 so a DB
    // leak does not yield usable invite links (same posture as refresh tokens).
    const rawToken = crypto.randomBytes(32).toString("hex");
    // Placeholder password the invitee can never use: it's a hash of random
    // bytes and isActive=false blocks login until accept-invite sets a real one.
    const placeholderHash = await hashPassword(crypto.randomBytes(24).toString("hex"));

    const user = await prisma.user.create({
      data: {
        tenantId,
        email,
        role: input.role,
        isActive: false,
        passwordHash: placeholderHash,
        inviteTokenHash: hashToken(rawToken),
        inviteExpiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
      select: STAFF_SELECT,
    });

    const tenant = await tenantEmailData(tenantId);
    if (!tenant) {
      await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
      return sendError(res, 500, "Failed to send invite", ErrorCode.INTERNAL_ERROR);
    }

    // Unlike booking emails, the invite IS the deliverable — if it can't be sent,
    // roll back the pending invite rather than leave one the recipient never got.
    try {
      await sendStaffInvite({
        to: email,
        inviteUrl: `${FRONTEND_URL}/accept-invite/${rawToken}`,
        tenant,
        role: input.role,
      });
    } catch (err) {
      console.error("[staff] invite email failed:", err);
      await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
      return sendError(res, 502, "Couldn't send the invite email. Please try again.", ErrorCode.INTERNAL_ERROR);
    }

    res.status(201).json({ data: toStaffMember(user) });
  } catch (error) {
    if (error instanceof ZodError) return sendValidationError(res, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return sendError(res, 409, "That email already has an account", ErrorCode.EMAIL_TAKEN);
    }
    console.error("Invite staff error:", error);
    sendError(res, 500, "Failed to invite staff", ErrorCode.INTERNAL_ERROR);
  }
});

// ----------------------------------------------------------------------------
// POST /admin/staff/:id/resend — regenerate token + re-send a pending invite
// ----------------------------------------------------------------------------

router.post("/staff/:id/resend", requireRole(["OWNER"]), async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const target = await prisma.user.findFirst({
      where: { id: req.params.id, tenantId },
      select: STAFF_SELECT,
    });
    if (!target) return sendError(res, 404, "Staff member not found", ErrorCode.NOT_FOUND);
    if (!target.inviteTokenHash) {
      return sendError(res, 409, "This member has already accepted their invite", ErrorCode.CONFLICT);
    }

    const tenant = await tenantEmailData(tenantId);
    if (!tenant) return sendError(res, 500, "Failed to send invite", ErrorCode.INTERNAL_ERROR);

    const rawToken = crypto.randomBytes(32).toString("hex");
    const updated = await prisma.user.update({
      where: { id: target.id },
      data: {
        inviteTokenHash: hashToken(rawToken),
        inviteExpiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
      select: STAFF_SELECT,
    });

    try {
      await sendStaffInvite({
        to: target.email,
        inviteUrl: `${FRONTEND_URL}/accept-invite/${rawToken}`,
        tenant,
        role: target.role,
      });
    } catch (err) {
      console.error("[staff] resend invite email failed:", err);
      return sendError(res, 502, "Couldn't send the invite email. Please try again.", ErrorCode.INTERNAL_ERROR);
    }

    res.json({ data: toStaffMember(updated) });
  } catch (error) {
    console.error("Resend invite error:", error);
    sendError(res, 500, "Failed to resend invite", ErrorCode.INTERNAL_ERROR);
  }
});

// ----------------------------------------------------------------------------
// PATCH /admin/staff/:id — change role and/or activate/deactivate
// ----------------------------------------------------------------------------

router.patch("/staff/:id", requireRole(["OWNER"]), async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const input = staffUpdateSchema.parse(req.body);

    const target = await prisma.user.findFirst({
      where: { id: req.params.id, tenantId },
      select: STAFF_SELECT,
    });
    if (!target) return sendError(res, 404, "Staff member not found", ErrorCode.NOT_FOUND);

    // The owner account is provisioned with the tenant and is not manageable
    // here — this also prevents the owner from locking themselves out.
    if (target.role === "OWNER") {
      return sendError(res, 403, "The owner account can't be modified", ErrorCode.FORBIDDEN);
    }

    const updated = await prisma.user.update({
      where: { id: target.id },
      data: {
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        ...(input.role !== undefined && { role: input.role }),
      },
      select: STAFF_SELECT,
    });

    res.json({ data: toStaffMember(updated) });
  } catch (error) {
    if (error instanceof ZodError) return sendValidationError(res, error);
    console.error("Update staff error:", error);
    sendError(res, 500, "Failed to update staff", ErrorCode.INTERNAL_ERROR);
  }
});

// ----------------------------------------------------------------------------
// DELETE /admin/staff/:id — revoke a still-pending invite
// ----------------------------------------------------------------------------

router.delete("/staff/:id", requireRole(["OWNER"]), async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const target = await prisma.user.findFirst({
      where: { id: req.params.id, tenantId },
      select: STAFF_SELECT,
    });
    if (!target) return sendError(res, 404, "Staff member not found", ErrorCode.NOT_FOUND);

    // Hard-delete is only for invites never accepted. Accepted accounts may own
    // historical data references; deactivate those instead of deleting.
    if (!target.inviteTokenHash) {
      return sendError(
        res,
        409,
        "This member has accepted their invite — deactivate them instead",
        ErrorCode.CONFLICT
      );
    }

    await prisma.user.delete({ where: { id: target.id } });
    res.json({ data: { message: "Invite revoked" } });
  } catch (error) {
    console.error("Revoke invite error:", error);
    sendError(res, 500, "Failed to revoke invite", ErrorCode.INTERNAL_ERROR);
  }
});

export default router;
