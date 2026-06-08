import { Router, Request, Response } from "express";
import type { Router as ExpressRouter } from "express";
import { z, ZodError } from "zod";
import rateLimit from "express-rate-limit";
import { generateTokens, hashToken } from "../utils/jwt.js";
import { verifyPassword, hashPassword, validatePassword, DUMMY_PASSWORD_HASH } from "../utils/password.js";
import { acceptInviteSchema } from "../lib/validators.js";
import prisma from "../lib/prisma.js";
import { refreshCookieOptions, clearRefreshCookieOptions } from "../lib/cookies.js";
import { ApiError, AuthResponse, ErrorCode } from "../types/api.js";

const router: ExpressRouter = Router();

// ============================================================================
// VALIDATION & NORMALIZATION
// ============================================================================

const normalizeEmail = (email: string): string => {
  return email.toLowerCase().trim();
};

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  // 1 000-char cap: bcrypt's effective input is 72 bytes, but letting multi-KB
  // strings reach it wastes CPU. Body limit (100 kb) is the hard outer wall.
  password: z.string().min(1, "Password is required").max(1000),
});

// ============================================================================
// RATE LIMITING
// ============================================================================

// NOTE: the default store is in-memory and per-process, so this limit is NOT
// shared across multiple API instances and resets on every redeploy. If the API
// is ever scaled horizontally (F11), switch to a shared store (e.g. Redis).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  // Only failed logins count toward the limit, so a legitimate user isn't locked
  // out by their own successful sign-ins (matters on shared/NAT IPs).
  skipSuccessfulRequests: true,
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

// ============================================================================
// ROUTES: POST /auth/login
// ============================================================================
//
// There is no public registration endpoint. Tenants and their owner users are
// provisioned exclusively through the super admin panel (see routes/superadmin).

router.post("/login", authLimiter, async (req: Request, res: Response) => {
  try {
    const { email: rawEmail, password } = loginSchema.parse(req.body);
    const email = normalizeEmail(rawEmail);

    // Find user (email is globally unique)
    const user = await prisma.user.findUnique({
      where: { email },
      include: { tenant: true },
    });

    // Always run a bcrypt comparison — against a dummy hash when the email is
    // unknown — so response time is identical whether or not the email exists
    // (no timing-based email enumeration).
    const passwordMatch = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
    if (!user || !passwordMatch) {
      return sendError(res, 401, "Invalid credentials", ErrorCode.INVALID_CREDENTIALS);
    }

    // Only reveal deactivation AFTER the password is proven correct, so the
    // distinct 403 can't be used to probe which emails are registered.
    if (!user.isActive || !user.tenant.isActive) {
      return sendError(res, 403, "Account is deactivated. Please contact support.", ErrorCode.FORBIDDEN);
    }

    // Generate tokens
    const { accessToken, refreshToken, refreshTokenExpiry } = generateTokens({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
    });

    // Create new token and prune any already-expired ones for this user in one
    // shot so the table doesn't accumulate stale rows across repeated logins.
    const expiresAt = new Date(Date.now() + refreshTokenExpiry * 1000);
    await prisma.$transaction([
      prisma.refreshToken.deleteMany({
        where: { userId: user.id, expiresAt: { lt: new Date() } },
      }),
      prisma.refreshToken.create({
        data: { userId: user.id, token: hashToken(refreshToken), expiresAt },
      }),
    ]);

    // Set refresh token cookie
    res.cookie("refreshToken", refreshToken, refreshCookieOptions(refreshTokenExpiry * 1000));

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

    // The entire lookup + validation + rotation runs in one transaction so two
    // concurrent requests with the same cookie cannot both succeed (the second
    // delete would fail with P2025 if they raced outside a transaction).
    type RefreshResult =
      | { ok: true; accessToken: string; newRefreshToken: string; refreshTokenExpiry: number }
      | { ok: false; reason: "expired" | "deactivated" };

    const result = await prisma.$transaction(async (tx): Promise<RefreshResult> => {
      const tokenRecord = await tx.refreshToken.findUnique({
        where: { token: hashToken(refreshToken) },
        include: { user: { include: { tenant: true } } },
      });

      if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
        if (tokenRecord) await tx.refreshToken.delete({ where: { id: tokenRecord.id } });
        return { ok: false, reason: "expired" };
      }

      const user = tokenRecord.user;
      if (!user.isActive || !user.tenant.isActive) {
        await tx.refreshToken.delete({ where: { id: tokenRecord.id } });
        return { ok: false, reason: "deactivated" };
      }

      const {
        accessToken,
        refreshToken: newRefreshToken,
        refreshTokenExpiry,
      } = generateTokens({
        userId: user.id,
        tenantId: user.tenantId,
        role: user.role,
        email: user.email,
      });

      await tx.refreshToken.delete({ where: { id: tokenRecord.id } });
      await tx.refreshToken.create({
        data: {
          userId: user.id,
          token: hashToken(newRefreshToken),
          expiresAt: new Date(Date.now() + refreshTokenExpiry * 1000),
        },
      });

      return { ok: true, accessToken, newRefreshToken, refreshTokenExpiry };
    });

    if (!result.ok) {
      if (result.reason === "deactivated") {
        res.clearCookie("refreshToken", clearRefreshCookieOptions());
        return sendError(res, 403, "Account is deactivated. Please contact support.", ErrorCode.FORBIDDEN);
      }
      return sendError(res, 401, "Refresh token expired or invalid", ErrorCode.TOKEN_EXPIRED);
    }

    res.cookie("refreshToken", result.newRefreshToken, refreshCookieOptions(result.refreshTokenExpiry * 1000));

    res.json({
      data: {
        accessToken: result.accessToken,
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
        where: { token: hashToken(refreshToken) },
      }).catch(() => {
        // Token might already be deleted, that's fine
      });
    }

    res.clearCookie("refreshToken", clearRefreshCookieOptions());
    res.json({ data: { message: "Logged out successfully" } });
  } catch (error) {
    console.error("Logout error:", error);
    sendError(res, 500, "Logout failed", ErrorCode.INTERNAL_ERROR);
  }
});

// ============================================================================
// ROUTES: GET /auth/invite/:token  — validate a staff invite link (F8)
// ============================================================================
//
// Public, no auth: the invite token is the authorization. Returns the email and
// business name so the accept-invite page can greet the invitee, plus whether
// the link has expired. Like login, this runs without a tenant context (the
// User/Tenant tables are not under RLS).

router.get("/invite/:token", async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { inviteTokenHash: hashToken(req.params.token) },
      select: {
        email: true,
        role: true,
        inviteExpiresAt: true,
        tenant: { select: { name: true, isActive: true } },
      },
    });

    if (!user || !user.inviteExpiresAt) {
      return sendError(res, 404, "This invite link is invalid", ErrorCode.NOT_FOUND);
    }
    if (!user.tenant.isActive) {
      return sendError(res, 403, "This business account is no longer active", ErrorCode.FORBIDDEN);
    }

    const expired = user.inviteExpiresAt.getTime() < Date.now();
    res.json({
      data: {
        email: user.email,
        role: user.role,
        businessName: user.tenant.name,
        expired,
      },
    });
  } catch (error) {
    console.error("Get invite error:", error);
    sendError(res, 500, "Failed to load invite", ErrorCode.INTERNAL_ERROR);
  }
});

// ============================================================================
// ROUTES: POST /auth/accept-invite  — set password + activate account (F8)
// ============================================================================

router.post("/accept-invite", authLimiter, async (req: Request, res: Response) => {
  try {
    const { token, password } = acceptInviteSchema.parse(req.body);

    // Enforce the same password strength rules as super-admin tenant creation.
    const strength = validatePassword(password);
    if (!strength.valid) {
      return sendError(res, 400, strength.error ?? "Weak password", ErrorCode.WEAK_PASSWORD);
    }

    const user = await prisma.user.findUnique({
      where: { inviteTokenHash: hashToken(token) },
      include: { tenant: { select: { isActive: true } } },
    });

    if (!user || !user.inviteExpiresAt) {
      return sendError(res, 404, "This invite link is invalid", ErrorCode.NOT_FOUND);
    }
    if (user.inviteExpiresAt.getTime() < Date.now()) {
      return sendError(res, 410, "This invite link has expired. Ask for a new one.", ErrorCode.TOKEN_EXPIRED);
    }
    if (!user.tenant.isActive) {
      return sendError(res, 403, "This business account is no longer active", ErrorCode.FORBIDDEN);
    }

    const passwordHash = await hashPassword(password);
    // Setting the password, activating, and clearing the (single-use) token all
    // happen in one update so a replayed token can't re-activate the account.
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        isActive: true,
        inviteTokenHash: null,
        inviteExpiresAt: null,
      },
    });

    res.json({ data: { message: "Account activated. You can now sign in." } });
  } catch (error) {
    if (error instanceof ZodError) {
      return sendError(res, 400, error.errors[0].message, ErrorCode.VALIDATION_ERROR);
    }
    console.error("Accept invite error:", error);
    sendError(res, 500, "Failed to accept invite", ErrorCode.INTERNAL_ERROR);
  }
});

export default router;
