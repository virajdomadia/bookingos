import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        tenantId: string;
        role: string;
        email?: string;
        iat?: number;
        exp?: number;
      };
      tenantId?: string;
    }
  }
}

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        error: "Missing authorization header",
        code: "UNAUTHORIZED",
      });
    }

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Invalid authorization header format",
        code: "UNAUTHORIZED",
      });
    }

    const token = authHeader.slice(7);

    if (!token) {
      return res.status(401).json({
        error: "Missing access token",
        code: "UNAUTHORIZED",
      });
    }

    // Verify JWT
    let user: any;
    try {
      user = jwt.verify(token, process.env.JWT_SECRET!);
    } catch (error: any) {
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({
          error: "Access token expired",
          code: "TOKEN_EXPIRED",
        });
      }
      return res.status(401).json({
        error: "Invalid access token",
        code: "UNAUTHORIZED",
      });
    }

    // Validate user payload
    if (!user.userId || !user.tenantId || !user.role) {
      return res.status(401).json({
        error: "Invalid token payload",
        code: "UNAUTHORIZED",
      });
    }

    // Re-check the user against the DB on every request. The access token is
    // valid for 15 minutes, so without this a role change, deactivation, or
    // tenant suspension would not take effect until the token expired. The
    // authoritative role/tenant come from the DB, not the (stale) token claims.
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { role: true, isActive: true, tenantId: true, tenant: { select: { isActive: true } } },
    });

    if (!dbUser || !dbUser.isActive || !dbUser.tenant.isActive) {
      return res.status(401).json({
        error: "Account is no longer active",
        code: "UNAUTHORIZED",
      });
    }

    // Guard against a token whose tenant claim no longer matches the user's
    // tenant (e.g. a re-provisioned account) — fail closed rather than trust it.
    if (dbUser.tenantId !== user.tenantId) {
      return res.status(401).json({
        error: "Invalid token payload",
        code: "UNAUTHORIZED",
      });
    }

    req.user = { ...user, role: dbUser.role };
    req.tenantId = dbUser.tenantId;

    // Note: the RLS tenant context is NOT set here. Because Prisma pools
    // connections, the tenant id must be set on the same connection that runs
    // the queries — see lib/tenantDb.ts `withTenant`, which wraps set_config +
    // the queries in one transaction. Setting it here would land on a different
    // pooled connection and silently do nothing.
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    });
  }
};

export const requireRole = (roles: string | string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: "User not authenticated",
        code: "UNAUTHORIZED",
      });
    }

    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Insufficient permissions. Required role: ${allowedRoles.join(" or ")}`,
        code: "FORBIDDEN",
      });
    }

    next();
  };
};
