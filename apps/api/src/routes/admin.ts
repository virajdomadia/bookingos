import { Router, Request, Response } from "express";
import type { Router as ExpressRouter } from "express";
import { ZodError } from "zod";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import prisma from "../lib/prisma.js";
import { withTenant } from "../lib/tenantDb.js";
import {
  serviceCreateSchema,
  serviceUpdateSchema,
  tenantUpdateSchema,
  scheduleUpdateSchema,
  validateScheduleCoherence,
} from "../lib/validators.js";
import { ApiError, ErrorCode } from "../types/api.js";

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

// ============================================================================
// GET /admin/schedule
// ============================================================================

router.get("/schedule", async (req: Request, res: Response) => {
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

router.get("/services", async (req: Request, res: Response) => {
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

router.delete("/services/:id", requireRole(["OWNER", "ADMIN"]), async (req: Request, res: Response) => {
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

export default router;
