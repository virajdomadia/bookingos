import { Router, Request, Response } from "express";
import type { Router as ExpressRouter } from "express";
import { z, ZodError } from "zod";
import rateLimit from "express-rate-limit";
import { generateTokens, verifyAccessToken } from "../utils/jwt.js";
import { hashPassword, verifyPassword, validatePassword } from "../utils/password.js";
import prisma from "../lib/prisma.js";
import { ApiError, AuthResponse, ErrorCode } from "../types/api.js";

const router: ExpressRouter = Router();

// ============================================================================
// VALIDATION & NORMALIZATION
// ============================================================================

const sanitizeSlug = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 50);
};

const normalizeEmail = (email: string): string => {
  return email.toLowerCase().trim();
};

const validateEmailFormat = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  return emailRegex.test(email) && email.length <= 255;
};

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const registerSchema = z.object({
  tenantName: z
    .string()
    .min(2, "Business name must be at least 2 characters")
    .max(100, "Business name must be at most 100 characters")
    .trim(),
  email: z.string().email("Invalid email format").max(255),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

// ============================================================================
// RATE LIMITING
// ============================================================================

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many authentication attempts, please try again later",
  standardHeaders: false,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.socket.remoteAddress || "unknown";
  },
  skip: (req) => {
    return process.env.NODE_ENV === "development" && req.query.skipRateLimit === "true";
  },
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const sendError = (res: Response, status: number, error: string, code: ErrorCode, details?: any) => {
  const errorResponse: ApiError = { error, code };
  if (details && process.env.NODE_ENV === "development") {
    errorResponse.details = details;
  }
  res.status(status).json(errorResponse);
};

const sendSuccess = (res: Response, data: any, status: number = 200) => {
  res.status(status).json({ data });
};

// ============================================================================
// ROUTES: POST /auth/register
// ============================================================================

router.post("/register", authLimiter, async (req: Request, res: Response) => {
  try {
    // Parse request body
    const { tenantName, email: rawEmail, password } = registerSchema.parse(req.body);

    // Normalize email
    const email = normalizeEmail(rawEmail);

    // Validate email format (additional check)
    if (!validateEmailFormat(email)) {
      return sendError(res, 400, "Invalid email format", ErrorCode.INVALID_EMAIL);
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return sendError(
        res,
        400,
        passwordValidation.error || "Password does not meet requirements",
        ErrorCode.WEAK_PASSWORD
      );
    }

    // Check email uniqueness
    const existingUser = await prisma.user.findFirst({
      where: { email },
    });
    if (existingUser) {
      return sendError(res, 409, "Email is already registered", ErrorCode.EMAIL_TAKEN);
    }

    // Sanitize and validate slug
    const slug = sanitizeSlug(tenantName);
    if (slug.length < 3) {
      return sendError(
        res,
        400,
        "Business name is too short. Must have at least 3 alphanumeric characters.",
        ErrorCode.VALIDATION_ERROR
      );
    }

    // Check slug uniqueness
    const existingTenant = await prisma.tenant.findUnique({
      where: { slug },
    });
    if (existingTenant) {
      return sendError(res, 409, "This business name is already taken", ErrorCode.SLUG_TAKEN);
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create tenant, schedule, and user in transaction
    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: tenantName,
          slug,
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

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email,
          passwordHash,
          role: "OWNER",
        },
      });

      return { tenant, user };
    });

    // Generate tokens
    const { accessToken, refreshToken, refreshTokenExpiry } = generateTokens({
      userId: result.user.id,
      tenantId: result.tenant.id,
      role: "OWNER",
    });

    // Store refresh token in database
    const expiresAt = new Date(Date.now() + refreshTokenExpiry * 1000);
    await prisma.refreshToken.create({
      data: {
        userId: result.user.id,
        token: refreshToken,
        expiresAt,
      },
    });

    // Set refresh token cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: refreshTokenExpiry * 1000,
      path: "/",
    });

    // Send success response
    const authResponse: AuthResponse = {
      accessToken,
      expiresIn: 15 * 60, // 15 minutes
      user: {
        userId: result.user.id,
        email: result.user.email,
        role: result.user.role,
      },
      tenant: {
        id: result.tenant.id,
        name: result.tenant.name,
        slug: result.tenant.slug,
      },
    };

    res.status(201).json({ data: authResponse });
  } catch (error) {
    if (error instanceof ZodError) {
      const firstError = error.errors[0];
      return sendError(res, 400, firstError.message, ErrorCode.VALIDATION_ERROR);
    }

    console.error("Register error:", error);
    sendError(res, 500, "Registration failed. Please try again.", ErrorCode.INTERNAL_ERROR);
  }
});

// ============================================================================
// ROUTES: POST /auth/login
// ============================================================================

router.post("/login", authLimiter, async (req: Request, res: Response) => {
  try {
    const { email: rawEmail, password } = loginSchema.parse(req.body);
    const email = normalizeEmail(rawEmail);

    // Find user
    const user = await prisma.user.findFirst({
      where: { email },
      include: { tenant: true },
    });

    if (!user) {
      return sendError(res, 401, "Invalid credentials", ErrorCode.INVALID_CREDENTIALS);
    }

    // Verify password
    const passwordMatch = await verifyPassword(password, user.passwordHash);
    if (!passwordMatch) {
      return sendError(res, 401, "Invalid credentials", ErrorCode.INVALID_CREDENTIALS);
    }

    // Generate tokens
    const { accessToken, refreshToken, refreshTokenExpiry } = generateTokens({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
    });

    // Store refresh token in database
    const expiresAt = new Date(Date.now() + refreshTokenExpiry * 1000);
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt,
      },
    });

    // Set refresh token cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: refreshTokenExpiry * 1000,
      path: "/",
    });

    // Send success response
    const authResponse: AuthResponse = {
      accessToken,
      expiresIn: 15 * 60,
      user: {
        userId: user.id,
        email: user.email,
        role: user.role,
      },
    };

    res.json({ data: authResponse });
  } catch (error) {
    if (error instanceof ZodError) {
      const firstError = error.errors[0];
      return sendError(res, 400, firstError.message, ErrorCode.VALIDATION_ERROR);
    }

    console.error("Login error:", error);
    sendError(res, 500, "Login failed. Please try again.", ErrorCode.INTERNAL_ERROR);
  }
});

// ============================================================================
// ROUTES: POST /auth/refresh
// ============================================================================

router.post("/refresh", async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return sendError(res, 401, "No refresh token found", ErrorCode.UNAUTHORIZED);
    }

    // Find refresh token in database
    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
      if (tokenRecord) {
        await prisma.refreshToken.delete({
          where: { id: tokenRecord.id },
        });
      }
      return sendError(res, 401, "Refresh token expired or invalid", ErrorCode.TOKEN_EXPIRED);
    }

    const user = tokenRecord.user;

    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken, refreshTokenExpiry } = generateTokens({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
    });

    // Delete old token and create new one
    await prisma.$transaction(async (tx) => {
      await tx.refreshToken.delete({
        where: { id: tokenRecord.id },
      });

      const expiresAt = new Date(Date.now() + refreshTokenExpiry * 1000);
      await tx.refreshToken.create({
        data: {
          userId: user.id,
          token: newRefreshToken,
          expiresAt,
        },
      });
    });

    // Set new refresh token cookie
    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: refreshTokenExpiry * 1000,
      path: "/",
    });

    res.json({
      data: {
        accessToken,
        expiresIn: 15 * 60,
      },
    });
  } catch (error) {
    console.error("Refresh error:", error);
    sendError(res, 500, "Token refresh failed", ErrorCode.INTERNAL_ERROR);
  }
});

// ============================================================================
// ROUTES: POST /auth/logout
// ============================================================================

router.post("/logout", async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (refreshToken) {
      await prisma.refreshToken.delete({
        where: { token: refreshToken },
      }).catch(() => {
        // Token might already be deleted, that's fine
      });
    }

    res.clearCookie("refreshToken");
    res.json({ data: { message: "Logged out successfully" } });
  } catch (error) {
    console.error("Logout error:", error);
    sendError(res, 500, "Logout failed", ErrorCode.INTERNAL_ERROR);
  }
});

export default router;
