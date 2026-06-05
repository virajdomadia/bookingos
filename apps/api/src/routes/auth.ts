import { Router, Request, Response } from "express";
import { z } from "zod";
import { generateTokens, verifyAccessToken } from "../utils/jwt.js";
import { hashPassword, verifyPassword, validatePassword } from "../utils/password.js";

const router = Router();

// In-memory storage for demo (will be Prisma + PostgreSQL later)
const users: Record<
  string,
  {
    userId: string;
    tenantId: string;
    email: string;
    passwordHash: string;
    role: string;
  }
> = {};

const tenants: Record<
  string,
  {
    id: string;
    name: string;
    slug: string;
  }
> = {};

const refreshTokens: Record<
  string,
  {
    userId: string;
    tenantId: string;
    expiresAt: number;
  }
> = {};

// Validation schemas
const registerSchema = z.object({
  tenantName: z.string().min(2, "Tenant name required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be 8+ characters"),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password required"),
});

// POST /auth/register
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { tenantName, email, password } = registerSchema.parse(req.body);

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.error });
    }

    // Check if user already exists
    const existingUser = Object.values(users).find(u => u.email === email);
    if (existingUser) {
      return res.status(409).json({ error: "Email already registered" });
    }

    // Create tenant
    const tenantId = `tenant_${Date.now()}`;
    const slug = tenantName
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

    tenants[tenantId] = {
      id: tenantId,
      name: tenantName,
      slug: slug,
    };

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const userId = `user_${Date.now()}`;
    users[userId] = {
      userId,
      tenantId,
      email,
      passwordHash,
      role: "OWNER",
    };

    // Generate tokens
    const { accessToken, refreshToken, refreshTokenExpiry } = generateTokens({
      userId,
      tenantId,
      role: "OWNER",
    });

    // Store refresh token
    refreshTokens[refreshToken] = {
      userId,
      tenantId,
      expiresAt: Date.now() + refreshTokenExpiry * 1000,
    };

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: refreshTokenExpiry * 1000,
      path: "/",
    });

    res.status(201).json({
      accessToken,
      user: { userId, email, role: "OWNER" },
      tenant: { id: tenantId, name: tenantName, slug },
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
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    // Find user
    const user = Object.values(users).find(u => u.email === email);
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Verify password
    const passwordMatch = await verifyPassword(password, user.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Generate tokens
    const { accessToken, refreshToken, refreshTokenExpiry } = generateTokens({
      userId: user.userId,
      tenantId: user.tenantId,
      role: user.role,
    });

    // Store refresh token
    refreshTokens[refreshToken] = {
      userId: user.userId,
      tenantId: user.tenantId,
      expiresAt: Date.now() + refreshTokenExpiry * 1000,
    };

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
        userId: user.userId,
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
router.post("/refresh", (req: Request, res: Response) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({ error: "No refresh token" });
  }

  const tokenData = refreshTokens[refreshToken];
  if (!tokenData || tokenData.expiresAt < Date.now()) {
    delete refreshTokens[refreshToken];
    return res.status(401).json({ error: "Refresh token expired" });
  }

  // Generate new tokens
  const { accessToken, refreshToken: newRefreshToken, refreshTokenExpiry } = generateTokens({
    userId: tokenData.userId,
    tenantId: tokenData.tenantId,
    role: "OWNER", // TODO: get from DB
  });

  // Delete old token and store new one
  delete refreshTokens[refreshToken];
  refreshTokens[newRefreshToken] = {
    userId: tokenData.userId,
    tenantId: tokenData.tenantId,
    expiresAt: Date.now() + refreshTokenExpiry * 1000,
  };

  res.cookie("refreshToken", newRefreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: refreshTokenExpiry * 1000,
    path: "/",
  });

  res.json({ accessToken });
});

// POST /auth/logout
router.post("/logout", (req: Request, res: Response) => {
  const refreshToken = req.cookies.refreshToken;
  if (refreshToken) {
    delete refreshTokens[refreshToken];
  }
  res.clearCookie("refreshToken");
  res.json({ message: "Logged out" });
});

export default router;
