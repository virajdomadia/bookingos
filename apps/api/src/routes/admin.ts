import { Router, Request, Response, NextFunction } from "express";
import type { Router as ExpressRouter } from "express";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import prisma from "../lib/prisma.js";
import { ApiError, ErrorCode } from "../types/api.js";

const router: ExpressRouter = Router();

// All routes in this file require authentication
router.use(authMiddleware);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const sendError = (res: Response, status: number, error: string, code: ErrorCode) => {
  const errorResponse: ApiError = { error, code };
  res.status(status).json(errorResponse);
};

// ============================================================================
// GET /admin/schedule
// ============================================================================

router.get("/schedule", async (req: Request, res: Response) => {
  try {
    if (!req.tenantId) {
      return sendError(res, 401, "Tenant ID not found in context", ErrorCode.UNAUTHORIZED);
    }

    const schedule = await prisma.schedule.findUnique({
      where: { tenantId: req.tenantId },
    });

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
    if (!req.tenantId) {
      return sendError(res, 401, "Tenant ID not found in context", ErrorCode.UNAUTHORIZED);
    }

    const { timezone, workStart, workEnd, slotInterval, breakTimes, bufferTime, workingDays } =
      req.body;

    // Validate input
    if (workStart && !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(workStart)) {
      return sendError(res, 400, "Invalid workStart format. Use HH:MM (00:00–23:59)", ErrorCode.VALIDATION_ERROR);
    }

    if (workEnd && !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(workEnd)) {
      return sendError(res, 400, "Invalid workEnd format. Use HH:MM (00:00–23:59)", ErrorCode.VALIDATION_ERROR);
    }

    if (slotInterval !== undefined && (typeof slotInterval !== "number" || slotInterval < 5 || slotInterval > 120)) {
      return sendError(
        res,
        400,
        "Slot interval must be between 5 and 120 minutes",
        ErrorCode.VALIDATION_ERROR
      );
    }

    if (workingDays !== undefined) {
      const hasActiveDay = typeof workingDays === "object" && workingDays !== null &&
        Object.values(workingDays).some(Boolean);
      if (!hasActiveDay) {
        return sendError(res, 400, "At least one working day must be active", ErrorCode.VALIDATION_ERROR);
      }
    }

    // Update schedule
    const updatedSchedule = await prisma.schedule.update({
      where: { tenantId: req.tenantId },
      data: {
        ...(timezone !== undefined && { timezone }),
        ...(workStart !== undefined && { workStart }),
        ...(workEnd !== undefined && { workEnd }),
        ...(slotInterval !== undefined && { slotInterval }),
        ...(breakTimes !== undefined && { breakTimes }),
        ...(bufferTime !== undefined && { bufferTime }),
        ...(workingDays !== undefined && { workingDays }),
      },
    });

    res.json({ data: updatedSchedule });
  } catch (error) {
    console.error("Update schedule error:", error);
    sendError(res, 500, "Failed to update schedule", ErrorCode.INTERNAL_ERROR);
  }
});

// ============================================================================
// GET /admin/services
// ============================================================================

router.get("/services", async (req: Request, res: Response) => {
  try {
    if (!req.tenantId) {
      return sendError(res, 401, "Tenant ID not found in context", ErrorCode.UNAUTHORIZED);
    }

    const services = await prisma.service.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { createdAt: "desc" },
    });

    res.json({ data: services });
  } catch (error) {
    console.error("Get services error:", error);
    sendError(res, 500, "Failed to fetch services", ErrorCode.INTERNAL_ERROR);
  }
});

// ============================================================================
// POST /admin/services
// ============================================================================

router.post(
  "/services",
  requireRole(["OWNER", "ADMIN"]),
  async (req: Request, res: Response) => {
    try {
      if (!req.tenantId) {
        return sendError(res, 401, "Tenant ID not found in context", ErrorCode.UNAUTHORIZED);
      }

      const { name, durationMinutes, price } = req.body;

      // Validation
      if (!name || typeof name !== "string" || name.length < 1 || name.length > 100) {
        return sendError(res, 400, "Service name must be 1-100 characters", ErrorCode.VALIDATION_ERROR);
      }

      if (!durationMinutes || typeof durationMinutes !== "number" || durationMinutes < 5 || durationMinutes > 480) {
        return sendError(res, 400, "Duration must be 5-480 minutes", ErrorCode.VALIDATION_ERROR);
      }

      if (price === undefined || typeof price !== "number" || price < 0) {
        return sendError(res, 400, "Price must be a non-negative number", ErrorCode.VALIDATION_ERROR);
      }

      const service = await prisma.service.create({
        data: {
          tenantId: req.tenantId,
          name: name.trim(),
          durationMinutes,
          price,
        },
      });

      res.status(201).json({ data: service });
    } catch (error) {
      console.error("Create service error:", error);
      sendError(res, 500, "Failed to create service", ErrorCode.INTERNAL_ERROR);
    }
  }
);

// ============================================================================
// PUT /admin/services/:id
// ============================================================================

router.put(
  "/services/:id",
  requireRole(["OWNER", "ADMIN"]),
  async (req: Request, res: Response) => {
    try {
      if (!req.tenantId) {
        return sendError(res, 401, "Tenant ID not found in context", ErrorCode.UNAUTHORIZED);
      }

      const { id } = req.params;
      const { name, durationMinutes, price, isActive } = req.body;

      // Check service exists and belongs to tenant
      const service = await prisma.service.findFirst({
        where: { id, tenantId: req.tenantId },
      });

      if (!service) {
        return sendError(res, 404, "Service not found", ErrorCode.NOT_FOUND);
      }

      // Validate input
      if (name !== undefined && (typeof name !== "string" || name.length < 1 || name.length > 100)) {
        return sendError(res, 400, "Service name must be 1-100 characters", ErrorCode.VALIDATION_ERROR);
      }

      if (durationMinutes !== undefined && (typeof durationMinutes !== "number" || durationMinutes < 5 || durationMinutes > 480)) {
        return sendError(res, 400, "Duration must be 5-480 minutes", ErrorCode.VALIDATION_ERROR);
      }

      if (price !== undefined && (typeof price !== "number" || price < 0)) {
        return sendError(res, 400, "Price must be a non-negative number", ErrorCode.VALIDATION_ERROR);
      }

      const updatedService = await prisma.service.update({
        where: { id },
        data: {
          ...(name && { name: name.trim() }),
          ...(durationMinutes !== undefined && { durationMinutes }),
          ...(price !== undefined && { price }),
          ...(isActive !== undefined && { isActive }),
        },
      });

      res.json({ data: updatedService });
    } catch (error) {
      console.error("Update service error:", error);
      sendError(res, 500, "Failed to update service", ErrorCode.INTERNAL_ERROR);
    }
  }
);

// ============================================================================
// DELETE /admin/services/:id
// ============================================================================

router.delete(
  "/services/:id",
  requireRole(["OWNER", "ADMIN"]),
  async (req: Request, res: Response) => {
    try {
      if (!req.tenantId) {
        return sendError(res, 401, "Tenant ID not found in context", ErrorCode.UNAUTHORIZED);
      }

      const { id } = req.params;

      // Check service exists and belongs to tenant
      const service = await prisma.service.findFirst({
        where: { id, tenantId: req.tenantId },
      });

      if (!service) {
        return sendError(res, 404, "Service not found", ErrorCode.NOT_FOUND);
      }

      // Soft delete
      await prisma.service.update({
        where: { id },
        data: { isActive: false },
      });

      res.json({ data: { message: "Service deleted successfully" } });
    } catch (error) {
      console.error("Delete service error:", error);
      sendError(res, 500, "Failed to delete service", ErrorCode.INTERNAL_ERROR);
    }
  }
);

// ============================================================================
// GET /admin/tenant
// ============================================================================

router.get("/tenant", requireRole(["OWNER", "ADMIN", "STAFF"]), async (req: Request, res: Response) => {
  try {
    if (!req.tenantId) {
      return sendError(res, 401, "Tenant ID not found in context", ErrorCode.UNAUTHORIZED);
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId },
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
    if (!req.tenantId) {
      return sendError(res, 401, "Tenant ID not found in context", ErrorCode.UNAUTHORIZED);
    }

    const { logoUrl, primaryColor, name } = req.body;

    if (primaryColor !== undefined && !/^#[0-9A-Fa-f]{6}$/.test(primaryColor)) {
      return sendError(res, 400, "Invalid primaryColor. Use hex format #RRGGBB", ErrorCode.VALIDATION_ERROR);
    }

    if (name !== undefined && (typeof name !== "string" || name.length < 1 || name.length > 100)) {
      return sendError(res, 400, "Tenant name must be 1-100 characters", ErrorCode.VALIDATION_ERROR);
    }

    const updatedTenant = await prisma.tenant.update({
      where: { id: req.tenantId },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(logoUrl !== undefined && { logoUrl: logoUrl || null }),
        ...(primaryColor !== undefined && { primaryColor }),
      },
      select: { id: true, name: true, slug: true, logoUrl: true, primaryColor: true, plan: true },
    });

    res.json({ data: updatedTenant });
  } catch (error) {
    console.error("Update tenant error:", error);
    sendError(res, 500, "Failed to update tenant", ErrorCode.INTERNAL_ERROR);
  }
});

export default router;
