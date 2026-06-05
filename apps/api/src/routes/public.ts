import { Router, Request, Response } from "express";
import type { Router as ExpressRouter } from "express";
import prisma from "../lib/prisma.js";
import { ApiError, ErrorCode } from "../types/api.js";

const router: ExpressRouter = Router();

const sendError = (res: Response, status: number, error: string, code: ErrorCode) => {
  const errorResponse: ApiError = { error, code };
  res.status(status).json(errorResponse);
};

// ============================================================================
// GET /public/:slug/services
// ============================================================================

router.get("/:slug/services", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      select: { id: true, isActive: true },
    });

    if (!tenant || !tenant.isActive) {
      return sendError(res, 404, "Tenant not found", ErrorCode.NOT_FOUND);
    }

    const services = await prisma.service.findMany({
      where: { tenantId: tenant.id, isActive: true },
      select: { id: true, name: true, durationMinutes: true, price: true },
      orderBy: { createdAt: "asc" },
    });

    res.json({ data: services });
  } catch (error) {
    console.error("Public get services error:", error);
    sendError(res, 500, "Failed to fetch services", ErrorCode.INTERNAL_ERROR);
  }
});

export default router;
