import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        tenantId: string;
        role: string;
        iat?: number;
        exp?: number;
      };
      tenantId?: string;
    }
  }
}

export const verifyJWT = (token: string): any => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET!);
  } catch (error) {
    return null;
  }
};

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

    req.user = user;
    req.tenantId = user.tenantId;

    // Set RLS context for database queries
    try {
      const prisma = (await import("../lib/prisma.js")).default;
      await prisma.$executeRaw`SELECT set_config('app.tenant_id', ${user.tenantId}, true)`;
    } catch (error) {
      console.error("Failed to set RLS context:", error);
      return res.status(500).json({
        error: "Failed to establish database context",
        code: "INTERNAL_ERROR",
      });
    }

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
