import { Router, Request, Response } from "express";
import type { Router as ExpressRouter } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { generateTokens, verifyAccessToken } from "../utils/jwt.js";
import { hashPassword, verifyPassword, validatePassword } from "../utils/password.js";
import prisma from "../lib/prisma.js";

const router: ExpressRouter = Router();

// Rate limiting for auth endpoints (Issue #7: No Rate Limiting)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per IP
  message: "Too many authentication attempts, please try again later",
  standardHeaders: false,
  legacyHeaders: false,
});

// Validation schemas
const registerSchema = z.object({
  tenantName: z.string().min(2, "Tenant name required").max(100, "Tenant name too long"),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be 8+ characters"),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password required"),
});

// POST /auth/register
router.post("/register", authLimiter, async (req: Request, res: Response) => {
  try {
    const { tenantName, email, password } = registerSchema.parse(req.body);

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.error });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: { email },
    });
    if (existingUser) {
      return res.status(409).json({ error: "Email already registered" });
    }

    // Generate slug (Issue #6: Slug Validation)
    const slug = tenantName
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .substring(0, 50);

    // Validate slug length
    if (slug.length < 3) {
      return res.status(400).json({
        error: "Business name too short (need at least 3 characters after formatting)"
      });
    }

    // Check if slug already exists
    const existingTenant = await prisma.tenant.findUnique({
      where: { slug },
    });
    if (existingTenant) {
      return res.status(409).json({ error: "Business name already taken" });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create tenant, schedule, and user in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create tenant
      const tenant = await tx.tenant.create({
        data: {
          name: tenantName,
          slug,
        },
      });

      // Create schedule with default settings
      await tx.schedule.create({
        data: {
          tenantId: tenant.id,
          timezone: "Asia/Kolkata",
          workStart: "09:00",
          workEnd: "18:00",
          slotInterval: 30,
        },
      });

      // Create user
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

    // Store refresh token in database (Issue #1: In-Memory Refresh Token Storage)
    const expiresAt = new Date(Date.now() + refreshTokenExpiry * 1000);
    await prisma.refreshToken.create({
      data: {
        userId: result.user.id,
        token: refreshToken,
        expiresAt,
      },
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: refreshTokenExpiry * 1000,
      path: "/",
    });

    res.status(201).json({
      accessToken,
      user: { userId: result.user.id, email: result.user.email, role: result.user.role },
      tenant: { id: result.tenant.id, name: result.tenant.name, slug: result.tenant.slug },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error("Register error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});

// POST /auth/login
router.post("/login", authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    // Find user
    const user = await prisma.user.findFirst({
      where: { email },
    });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Verify password
    const passwordMatch = await verifyPassword(password, user.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate tokens
    const { accessToken, refreshToken, refreshTokenExpiry } = generateTokens({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
    });

    // Store refresh token in database (Issue #1: In-Memory Refresh Token Storage)
    const expiresAt = new Date(Date.now() + refreshTokenExpiry * 1000);
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt,
      },
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: refreshTokenExpiry * 1000,
      path: "/",
    });

    res.json({
      accessToken,
      user: {
        userId: user.id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

// POST /auth/refresh
router.post("/refresh", async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ error: "No refresh token" });
    }

    // Find refresh token in database (Issue #1: In-Memory Refresh Token Storage)
    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
      // Clean up expired token
      if (tokenRecord) {
        await prisma.refreshToken.delete({
          where: { id: tokenRecord.id },
        });
      }
      return res.status(401).json({ error: "Refresh token expired or invalid" });
    }

    const user = tokenRecord.user;

    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken, refreshTokenExpiry } = generateTokens({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role, // Issue #3: Role from DB
    });

    // Delete old token and create new one in transaction (Issue #1: DB-based)
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

    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: refreshTokenExpiry * 1000,
      path: "/",
    });

    res.json({ accessToken, expiresIn: 15 * 60 }); // Issue #5: Include token expiry
  } catch (error) {
    console.error("Refresh error:", error);
    res.status(500).json({ error: "Token refresh failed" });
  }
});

// POST /auth/logout
router.post("/logout", async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    // Delete refresh token from database (Issue #1: DB-based)
    if (refreshToken) {
      await prisma.refreshToken.delete({
        where: { token: refreshToken },
      }).catch(() => {
        // Token might already be deleted, that's OK
      });
    }

    res.clearCookie("refreshToken");
    res.json({ message: "Logged out" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Logout failed" });
  }
});

export default router;
