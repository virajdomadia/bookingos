import { Router, Request, Response, NextFunction } from "express";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import prisma from "../lib/prisma.js";
import { ApiError, ErrorCode } from "../types/api.js";

const router = Router();

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

router.put("/schedule", requireRole("OWNER", "ADMIN"), async (req: Request, res: Response) => {
  try {
    if (!req.tenantId) {
      return sendError(res, 401, "Tenant ID not found in context", ErrorCode.UNAUTHORIZED);
    }

    const { timezone, workStart, workEnd, slotInterval, breakTimes, bufferTime, workingDays } =
      req.body;

    // Validate input
    if (workStart && !/^[0-2][0-9]:[0-5][0-9]$/.test(workStart)) {
      return sendError(res, 400, "Invalid workStart format. Use HH:MM", ErrorCode.VALIDATION_ERROR);
    }

    if (workEnd && !/^[0-2][0-9]:[0-5][0-9]$/.test(workEnd)) {
      return sendError(res, 400, "Invalid workEnd format. Use HH:MM", ErrorCode.VALIDATION_ERROR);
    }

    if (slotInterval && (slotInterval < 5 || slotInterval > 120)) {
      return sendError(
        res,
        400,
        "Slot interval must be between 5 and 120 minutes",
        ErrorCode.VALIDATION_ERROR
      );
    }

    // Update schedule
    const updatedSchedule = await prisma.schedule.update({
      where: { tenantId: req.tenantId },
      data: {
        ...(timezone && { timezone }),
        ...(workStart && { workStart }),
        ...(workEnd && { workEnd }),
        ...(slotInterval && { slotInterval }),
        ...(breakTimes && { breakTimes }),
        ...(bufferTime !== undefined && { bufferTime }),
        ...(workingDays && { workingDays }),
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
  requireRole("OWNER", "ADMIN"),
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
  requireRole("OWNER", "ADMIN"),
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
  requireRole("OWNER", "ADMIN"),
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

export default router;
