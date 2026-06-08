import express, { Express, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import authRouter from "./routes/auth.js";
import adminRouter from "./routes/admin.js";
import publicRouter from "./routes/public.js";
import superadminRouter from "./routes/superadmin.js";

// Load .env from the correct directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// Validate critical environment variables
const validateEnvironment = () => {
  // Refresh tokens are opaque random strings (crypto.randomBytes), not JWTs, so
  // there is no JWT_REFRESH_SECRET to sign them with — only JWT_SECRET (access
  // tokens) is actually used.
  const requiredVars = ["JWT_SECRET", "DATABASE_URL", "FRONTEND_URL"];

  const missingVars: string[] = [];

  for (const envVar of requiredVars) {
    if (!process.env[envVar]) {
      missingVars.push(envVar);
    }
  }

  if (missingVars.length > 0) {
    console.error("❌ Missing required environment variables:");
    missingVars.forEach((v) => console.error(`   - ${v}`));
    process.exit(1);
  }

  // Validate secret lengths (minimum 32 chars for 256-bit security)
  const minSecretLength = 32;
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < minSecretLength) {
    console.error(
      `❌ JWT_SECRET too short. Must be at least ${minSecretLength} characters, ` +
        `got ${process.env.JWT_SECRET.length}`
    );
    process.exit(1);
  }

  // Super admin is optional (the API runs without it) but the panel fails closed
  // when it's unset — warn loudly so a misconfigured prod is noticed at boot,
  // not at first tenant-creation attempt.
  if (!process.env.SUPER_ADMIN_SECRET) {
    console.warn(
      "⚠️  SUPER_ADMIN_SECRET not set — the super admin panel (tenant creation) is disabled."
    );
  }

  console.log("✓ All environment variables validated");
};

validateEnvironment();

const app: Express = express();
const port = process.env.PORT || 4000;

// Behind a reverse proxy (Railway/Vercel/etc.) so req.ip reflects the real
// client address — required for IP-based rate limiting to work correctly.
app.set("trust proxy", 1);

// Security & performance middleware
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: "100kb" }));
// Turn body-parser's SyntaxError (malformed JSON / oversized body) into a clean
// 400 instead of letting it fall through to the generic 500 error handler.
app.use((err: any, _req: Request, res: Response, next: any) => {
  if (err?.type === "entity.parse.failed" || err instanceof SyntaxError) {
    return res.status(400).json({ error: "Invalid JSON body", code: "VALIDATION_ERROR" });
  }
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body too large", code: "VALIDATION_ERROR" });
  }
  next(err);
});
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);

// Routes
app.use("/auth", authRouter);
app.use("/admin", adminRouter);
app.use("/public", publicRouter);
app.use("/superadmin", superadminRouter);

// Health check (public)
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API status (public, for checking)
app.get("/api/status", (req: Request, res: Response) => {
  res.json({ status: "ok", version: "1.0.0", timestamp: new Date().toISOString() });
});

// Unknown routes → explicit 404 (instead of falling through to the error handler)
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "Not found", code: "NOT_FOUND" });
});

// Global error handler middleware (must be last)
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error("❌ Unhandled error:", {
    message: err.message,
    status: err.status,
    path: req.path,
    method: req.method,
  });

  const isDev = process.env.NODE_ENV !== "production";
  const status = err.status || 500;
  const message = isDev ? err.message : "Internal server error";

  res.status(status).json({
    error: message,
    ...(isDev && { stack: err.stack }),
  });
});

// Graceful shutdown handler
const server = app.listen(port, () => {
  console.log(`✓ Server running on port ${port}`);
});

const gracefulShutdown = async (signal: string) => {
  console.log(`\n📌 Received ${signal}, shutting down gracefully...`);
  server.close(async () => {
    try {
      const prisma = (await import("./lib/prisma.js")).default;
      await prisma.$disconnect();
      console.log("✓ Database disconnected");
      process.exit(0);
    } catch (error) {
      console.error("Error during shutdown:", error);
      process.exit(1);
    }
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error("⚠️ Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
