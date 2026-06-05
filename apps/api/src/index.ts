import express, { Express, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 4000;

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);

// Health check
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Placeholder routes
app.get("/api/test", (req: Request, res: Response) => {
  res.json({ message: "API is running" });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
