import { Router, Request, Response } from "express";
import type { Router as ExpressRouter } from "express";
import rateLimit from "express-rate-limit";
import { ZodError } from "zod";
import { zonedWallTimeToUtc } from "@booking-os/utils";
import prisma from "../lib/prisma.js";
import { withTenant } from "../lib/tenantDb.js";
import {
  getAvailableSlots,
  type AvailabilityScheduleConfig,
  type BookingInterval,
} from "../lib/availability.js";
import { availabilityQuerySchema, bookingCreateSchema } from "../lib/validators.js";
import { ApiError, ErrorCode } from "../types/api.js";
import {
  sendBookingReceived,
  sendAdminNewBooking,
  sendBookingCancelled,
  sendAdminCustomerCancelled,
} from "../lib/email.js";

const router: ExpressRouter = Router();

// Throttle unauthenticated public endpoints to limit scraping / abuse.
const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || "unknown",
});

// Tight limit on booking creation specifically — it writes, sends email, and
// has no captcha/verification, so a loose cap lets one IP flood a tenant's
// future calendar with fake PENDING bookings (calendar-stuffing DoS).
const bookingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || "unknown",
});

router.use(publicLimiter);

const sendError = (res: Response, status: number, error: string, code: ErrorCode) => {
  const errorResponse: ApiError = { error, code };
  res.status(status).json(errorResponse);
};

const SLUG_RE = /^[a-z0-9-]{3,50}$/;
// cancelToken is a cuid (alphanumeric). Loose bound rejects obvious garbage
// before a DB lookup without coupling to the exact cuid format.
const CANCEL_TOKEN_RE = /^[a-z0-9]{10,64}$/i;

/**
 * The `Booking_no_overlap` GiST exclusion constraint (see migration
 * 20260606150000) is the database's final guard against double-booking: two
 * non-cancelled bookings whose `tsrange("startsAt","endsAt")` ranges overlap for
 * a tenant can never both commit. Postgres raises SQLSTATE 23P01
 * (exclusion_violation), which we treat as "slot taken". This is the backstop
 * for the phantom-write race that the SERIALIZABLE availability re-check alone
 * cannot fully close.
 *
 * IMPORTANT: the constraint guards only *true* time-range overlaps. The per-
 * tenant `bufferTime` clearance is NOT encoded in it (the buffer is dynamic
 * schedule data, not a constant the static constraint can reference). Buffer
 * enforcement under concurrency therefore relies solely on the SERIALIZABLE
 * re-check + retry below. With the default `bufferTime: 0` the two guards are
 * equivalent; with a non-zero buffer, two bookings inside the buffer window but
 * not actually overlapping are stopped by SERIALIZABLE, not the constraint.
 */
const isOverlapViolation = (err: unknown): boolean => {
  const meta = (err as { meta?: { code?: string } } | undefined)?.meta;
  if (meta?.code === "23P01") return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /Booking_no_overlap|exclusion constraint|23P01/i.test(msg);
};

// Shared tenant lookup used by all /:slug/* routes.
const resolveTenant = async (slug: string) => {
  if (!SLUG_RE.test(slug)) return null;
  return prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, isActive: true, name: true, slug: true, logoUrl: true, primaryColor: true },
  });
};

/** Reject calendar strings that pass the regex but aren't real dates (2026-02-30). */
const parseRealDate = (date: string): { year: number; month: number; day: number } | null => {
  const [year, month, day] = date.split("-").map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
};

// How far ahead a slot may be queried/booked. Without this the engine happily
// generates slots for any valid date (e.g. year 2099), letting a client fill the
// calendar arbitrarily far out. A generous bound keeps it sane.
const MAX_BOOKING_HORIZON_DAYS = 365;

/** True if y/m/d is today or within the booking horizon (timezone-agnostic sanity bound). */
const isWithinHorizon = (year: number, month: number, day: number): boolean => {
  const target = Date.UTC(year, month - 1, day);
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const daysAhead = (target - todayUtc) / (24 * 60 * 60 * 1000);
  // Allow a 1-day slack on the lower side for timezone edges; past dates that
  // slip through still produce no bookable slots downstream.
  return daysAhead >= -1 && daysAhead <= MAX_BOOKING_HORIZON_DAYS;
};

/** Normalize a persisted Schedule row into the shape the engine expects. */
const toScheduleConfig = (schedule: {
  timezone: string;
  workingDays: unknown;
  workStart: string;
  workEnd: string;
  slotInterval: number;
  breakTimes: unknown;
  bufferTime: number;
}): AvailabilityScheduleConfig => ({
  timezone: schedule.timezone,
  workingDays: schedule.workingDays as Record<string, boolean>,
  workStart: schedule.workStart,
  workEnd: schedule.workEnd,
  slotInterval: schedule.slotInterval,
  breakTimes: Array.isArray(schedule.breakTimes)
    ? (schedule.breakTimes as { start: string; end: string }[])
    : [],
  bufferTime: schedule.bufferTime,
});

// ============================================================================
// GET /public/:slug  — tenant branding + active services (booking landing)
// ============================================================================

router.get("/:slug", async (req: Request, res: Response) => {
  try {
    const tenant = await resolveTenant(req.params.slug);
    if (!tenant || !tenant.isActive) {
      return sendError(res, 404, "Booking page not found", ErrorCode.NOT_FOUND);
    }

    const { services, schedule } = await withTenant(tenant.id, async (tx) => ({
      services: await tx.service.findMany({
        where: { tenantId: tenant.id, isActive: true },
        select: { id: true, name: true, durationMinutes: true, price: true },
        orderBy: { createdAt: "asc" },
      }),
      schedule: await tx.schedule.findUnique({
        where: { tenantId: tenant.id },
        select: { timezone: true },
      }),
    }));

    res.json({
      data: {
        tenant: {
          name: tenant.name,
          slug: tenant.slug,
          logoUrl: tenant.logoUrl,
          primaryColor: tenant.primaryColor,
          timezone: schedule?.timezone ?? "Asia/Kolkata",
        },
        services,
      },
    });
  } catch (error) {
    console.error("Public get tenant error:", error);
    sendError(res, 500, "Failed to load booking page", ErrorCode.INTERNAL_ERROR);
  }
});

// ============================================================================
// GET /public/:slug/services  — active services only
// ============================================================================

router.get("/:slug/services", async (req: Request, res: Response) => {
  try {
    const tenant = await resolveTenant(req.params.slug);
    if (!tenant || !tenant.isActive) {
      return sendError(res, 404, "Tenant not found", ErrorCode.NOT_FOUND);
    }

    const services = await withTenant(tenant.id, (tx) =>
      tx.service.findMany({
        where: { tenantId: tenant.id, isActive: true },
        select: { id: true, name: true, durationMinutes: true, price: true },
        orderBy: { createdAt: "asc" },
      })
    );

    res.json({ data: services });
  } catch (error) {
    console.error("Public get services error:", error);
    sendError(res, 500, "Failed to fetch services", ErrorCode.INTERNAL_ERROR);
  }
});

// ============================================================================
// GET /public/:slug/availability?serviceId=X&date=YYYY-MM-DD
// ============================================================================

router.get("/:slug/availability", async (req: Request, res: Response) => {
  try {
    const tenant = await resolveTenant(req.params.slug);
    if (!tenant || !tenant.isActive) {
      return sendError(res, 404, "Tenant not found", ErrorCode.NOT_FOUND);
    }

    const { serviceId, date } = availabilityQuerySchema.parse(req.query);
    const parsed = parseRealDate(date);
    if (!parsed) {
      return sendError(res, 400, "Invalid date", ErrorCode.VALIDATION_ERROR);
    }
    if (!isWithinHorizon(parsed.year, parsed.month, parsed.day)) {
      return sendError(res, 400, "Date is outside the booking window", ErrorCode.VALIDATION_ERROR);
    }

    const result = await withTenant(tenant.id, async (tx) => {
      const service = await tx.service.findFirst({
        where: { id: serviceId, tenantId: tenant.id, isActive: true },
        select: { durationMinutes: true },
      });
      if (!service) return { notFound: true as const };

      const schedule = await tx.schedule.findUnique({ where: { tenantId: tenant.id } });
      if (!schedule) return { slots: [] as BookingInterval[], config: null };

      const config = toScheduleConfig(schedule);
      const { year, month, day } = parsed;

      // Pull bookings overlapping the requested day (padded by the buffer so a
      // booking spilling in from an adjacent day is still considered).
      const dayStart = zonedWallTimeToUtc(year, month, day, 0, 0, config.timezone);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      const pad = (config.bufferTime + 60) * 60 * 1000;

      const bookings = await tx.booking.findMany({
        where: {
          tenantId: tenant.id,
          status: { not: "CANCELLED" },
          startsAt: { lt: new Date(dayEnd.getTime() + pad) },
          endsAt: { gt: new Date(dayStart.getTime() - pad) },
        },
        select: { startsAt: true, endsAt: true },
      });

      const slots = getAvailableSlots({
        date,
        schedule: config,
        serviceDurationMinutes: service.durationMinutes,
        existingBookings: bookings,
      });

      return { slots: slots.map((s) => ({ time: s.label, startsAt: s.startsAt.toISOString() })) };
    });

    if ("notFound" in result) {
      return sendError(res, 404, "Service not found", ErrorCode.NOT_FOUND);
    }

    res.json({ data: { slots: result.slots } });
  } catch (error) {
    if (error instanceof ZodError) {
      return sendError(res, 400, error.errors[0]?.message ?? "Invalid request", ErrorCode.VALIDATION_ERROR);
    }
    console.error("Public availability error:", error);
    sendError(res, 500, "Failed to fetch availability", ErrorCode.INTERNAL_ERROR);
  }
});

// ============================================================================
// POST /public/:slug/bookings  — create a booking (concurrency-safe)
// ============================================================================

router.post("/:slug/bookings", bookingLimiter, async (req: Request, res: Response) => {
  try {
    const tenant = await resolveTenant(req.params.slug);
    if (!tenant || !tenant.isActive) {
      return sendError(res, 404, "Tenant not found", ErrorCode.NOT_FOUND);
    }

    const input = bookingCreateSchema.parse(req.body);
    const parsed = parseRealDate(input.date);
    if (!parsed) {
      return sendError(res, 400, "Invalid date", ErrorCode.VALIDATION_ERROR);
    }
    if (!isWithinHorizon(parsed.year, parsed.month, parsed.day)) {
      return sendError(res, 400, "Date is outside the booking window", ErrorCode.VALIDATION_ERROR);
    }

    // SERIALIZABLE + retry: the availability re-check and the insert see a stable
    // snapshot, so two concurrent attempts on the same slot cannot both commit —
    // the loser aborts with a serialization failure, retries, then sees the
    // winning booking and is rejected as SLOT_TAKEN.
    const outcome = await withTenant(
      tenant.id,
      async (tx) => {
        const service = await tx.service.findFirst({
          where: { id: input.serviceId, tenantId: tenant.id, isActive: true },
          select: { durationMinutes: true },
        });
        if (!service) return { error: "SERVICE" as const };

        const schedule = await tx.schedule.findUnique({ where: { tenantId: tenant.id } });
        if (!schedule) return { error: "NO_SCHEDULE" as const };

        const config = toScheduleConfig(schedule);
        const { year, month, day } = parsed;
        const [hour, minute] = input.time.split(":").map(Number);
        const startsAt = zonedWallTimeToUtc(year, month, day, hour, minute, config.timezone);
        const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60 * 1000);

        const dayStart = zonedWallTimeToUtc(year, month, day, 0, 0, config.timezone);
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
        const pad = (config.bufferTime + 60) * 60 * 1000;

        const bookings = await tx.booking.findMany({
          where: {
            tenantId: tenant.id,
            status: { not: "CANCELLED" },
            startsAt: { lt: new Date(dayEnd.getTime() + pad) },
            endsAt: { gt: new Date(dayStart.getTime() - pad) },
          },
          select: { startsAt: true, endsAt: true },
        });

        // Re-derive the bookable slots authoritatively on the server: the slot
        // must be a real, currently-available slot, not just any timestamp the
        // client posted.
        const slots = getAvailableSlots({
          date: input.date,
          schedule: config,
          serviceDurationMinutes: service.durationMinutes,
          existingBookings: bookings,
        });
        const match = slots.find((s) => s.startsAt.getTime() === startsAt.getTime());

        if (!match) {
          const bufferMs = config.bufferTime * 60 * 1000;
          const conflict = bookings.some(
            (b) =>
              startsAt.getTime() < b.endsAt.getTime() + bufferMs &&
              endsAt.getTime() > b.startsAt.getTime() - bufferMs
          );
          return { error: conflict ? ("SLOT_TAKEN" as const) : ("SLOT_INVALID" as const) };
        }

        const booking = await tx.booking.create({
          data: {
            tenantId: tenant.id,
            serviceId: input.serviceId,
            customerName: input.customerName,
            customerEmail: input.customerEmail,
            customerPhone: input.customerPhone || null,
            customerNotes: input.customerNotes || null,
            startsAt,
            endsAt,
            status: "PENDING",
          },
          select: {
            id: true,
            startsAt: true,
            endsAt: true,
            cancelToken: true,
            customerName: true,
            customerEmail: true,
            customerPhone: true,
            customerNotes: true,
            status: true,
            service: { select: { name: true, durationMinutes: true, price: true } },
          },
        });

        return { booking, timezone: config.timezone };
      },
      { isolationLevel: "Serializable", maxRetries: 5 }
    );

    if ("error" in outcome) {
      switch (outcome.error) {
        case "SERVICE":
          return sendError(res, 404, "Service not found", ErrorCode.NOT_FOUND);
        case "NO_SCHEDULE":
          return sendError(res, 409, "This business is not accepting bookings yet", ErrorCode.CONFLICT);
        case "SLOT_TAKEN":
          return sendError(res, 409, "That slot was just taken — please pick another time", ErrorCode.CONFLICT);
        case "SLOT_INVALID":
          return sendError(res, 400, "That time is not available", ErrorCode.VALIDATION_ERROR);
      }
      // Unreachable (switch is exhaustive) — keeps the type narrowing honest.
      return sendError(res, 500, "Failed to create booking", ErrorCode.INTERNAL_ERROR);
    }

    // Fire emails asynchronously — email failure must never fail the booking.
    const emailTenant = {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      primaryColor: tenant.primaryColor ?? "#4F46E5",
      timezone: outcome.timezone,
    };
    void sendBookingReceived(outcome.booking, emailTenant);
    void sendAdminNewBooking(outcome.booking, emailTenant);

    res.status(201).json({ data: outcome.booking });
  } catch (error) {
    if (error instanceof ZodError) {
      return sendError(res, 400, error.errors[0]?.message ?? "Invalid request", ErrorCode.VALIDATION_ERROR);
    }
    if (isOverlapViolation(error)) {
      return sendError(res, 409, "That slot was just taken — please pick another time", ErrorCode.CONFLICT);
    }
    console.error("Public create booking error:", error);
    sendError(res, 500, "Failed to create booking", ErrorCode.INTERNAL_ERROR);
  }
});

// ============================================================================
// GET /public/:slug/cancel/:token  — booking detail for the cancel page (F7)
// ============================================================================
// Booking is RLS-protected, so the tenant is resolved by slug first (Tenant has
// no RLS), then the cancelToken is looked up inside that tenant's context.

router.get("/:slug/cancel/:token", async (req: Request, res: Response) => {
  try {
    const tenant = await resolveTenant(req.params.slug);
    if (!tenant || !tenant.isActive) {
      return sendError(res, 404, "Booking not found", ErrorCode.NOT_FOUND);
    }
    if (!CANCEL_TOKEN_RE.test(req.params.token)) {
      return sendError(res, 404, "Booking not found", ErrorCode.NOT_FOUND);
    }

    const result = await withTenant(tenant.id, async (tx) => {
      const booking = await tx.booking.findFirst({
        where: { cancelToken: req.params.token, tenantId: tenant.id },
        select: {
          status: true,
          startsAt: true,
          endsAt: true,
          customerName: true,
          service: { select: { name: true, durationMinutes: true, price: true } },
        },
      });
      const schedule = await tx.schedule.findUnique({
        where: { tenantId: tenant.id },
        select: { timezone: true },
      });
      return { booking, timezone: schedule?.timezone ?? "Asia/Kolkata" };
    });

    if (!result.booking) {
      return sendError(res, 404, "Booking not found", ErrorCode.NOT_FOUND);
    }

    const b = result.booking;
    const alreadyCancelled = b.status === "CANCELLED";
    const canCancel =
      (b.status === "PENDING" || b.status === "CONFIRMED") && b.startsAt.getTime() > Date.now();

    res.json({
      data: {
        booking: {
          status: b.status,
          startsAt: b.startsAt.toISOString(),
          endsAt: b.endsAt.toISOString(),
          customerName: b.customerName,
          service: b.service,
        },
        tenant: {
          name: tenant.name,
          slug: tenant.slug,
          logoUrl: tenant.logoUrl,
          primaryColor: tenant.primaryColor,
          timezone: result.timezone,
        },
        alreadyCancelled,
        canCancel,
      },
    });
  } catch (error) {
    console.error("Public get cancel error:", error);
    sendError(res, 500, "Failed to load booking", ErrorCode.INTERNAL_ERROR);
  }
});

// ============================================================================
// POST /public/:slug/cancel/:token  — customer cancels their booking (F7)
// ============================================================================

router.post("/:slug/cancel/:token", bookingLimiter, async (req: Request, res: Response) => {
  try {
    const tenant = await resolveTenant(req.params.slug);
    if (!tenant || !tenant.isActive) {
      return sendError(res, 404, "Booking not found", ErrorCode.NOT_FOUND);
    }
    if (!CANCEL_TOKEN_RE.test(req.params.token)) {
      return sendError(res, 404, "Booking not found", ErrorCode.NOT_FOUND);
    }

    const outcome = await withTenant(tenant.id, async (tx) => {
      const booking = await tx.booking.findFirst({
        where: { cancelToken: req.params.token, tenantId: tenant.id },
        select: { id: true, status: true, startsAt: true },
      });
      if (!booking) return { error: "NOT_FOUND" as const };
      // Idempotent: cancelling an already-cancelled booking is a no-op success.
      if (booking.status === "CANCELLED") return { error: "ALREADY" as const };
      // Past/finished bookings can't be cancelled by the customer.
      if (booking.status !== "PENDING" && booking.status !== "CONFIRMED") {
        return { error: "CANNOT" as const };
      }
      if (booking.startsAt.getTime() <= Date.now()) return { error: "CANNOT" as const };

      const updated = await tx.booking.update({
        where: { id: booking.id },
        data: { status: "CANCELLED" },
        select: {
          id: true,
          cancelToken: true,
          customerName: true,
          customerEmail: true,
          customerPhone: true,
          customerNotes: true,
          adminNotes: true,
          startsAt: true,
          endsAt: true,
          service: { select: { name: true, durationMinutes: true, price: true } },
        },
      });
      const schedule = await tx.schedule.findUnique({
        where: { tenantId: tenant.id },
        select: { timezone: true },
      });
      return { booking: updated, timezone: schedule?.timezone ?? "Asia/Kolkata" };
    });

    if ("error" in outcome) {
      switch (outcome.error) {
        case "NOT_FOUND":
          return sendError(res, 404, "Booking not found", ErrorCode.NOT_FOUND);
        case "ALREADY":
          return res.json({ data: { alreadyCancelled: true } });
        case "CANNOT":
          return sendError(res, 409, "This booking can no longer be cancelled", ErrorCode.CONFLICT);
      }
    }

    // Notify both sides — failures must never fail the cancellation.
    const tenantData = {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      primaryColor: tenant.primaryColor ?? "#4F46E5",
      timezone: outcome.timezone,
    };
    void sendBookingCancelled(outcome.booking, tenantData);
    void sendAdminCustomerCancelled(outcome.booking, tenantData);

    res.json({ data: { cancelled: true } });
  } catch (error) {
    console.error("Public cancel error:", error);
    sendError(res, 500, "Failed to cancel booking", ErrorCode.INTERNAL_ERROR);
  }
});

export default router;
