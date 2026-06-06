import { Router, Request, Response } from "express";
import type { Router as ExpressRouter } from "express";
import rateLimit from "express-rate-limit";
import prisma from "../lib/prisma.js";
import { withTenant } from "../lib/tenantDb.js";
import { ApiError, ErrorCode } from "../types/api.js";

const router: ExpressRouter = Router();

// Throttle unauthenticated public endpoints to limit scraping / abuse.
const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
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

// Shared tenant lookup used by all /:slug/* routes.
const resolveTenant = async (slug: string) => {
  if (!SLUG_RE.test(slug)) return null;
  return prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, isActive: true },
  });
};

// ============================================================================
// GET /public/:slug/services
// ============================================================================

router.get("/:slug/services", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const tenant = await resolveTenant(slug);

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

export default router;
