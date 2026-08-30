import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { pool } from "./db.js";
import authRouter from "./routes/auth.js";
import submissionsRouter from "./routes/submissions.js";
import adminRouter from "./routes/admin.js";
import challengesRouter from "./routes/challenges.js";
import statsRouter from "./routes/stats.js";

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(express.json({ limit: "10kb" }));
  app.use(cookieParser());

  const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error("Not allowed by CORS"));
      },
      credentials: true, // required so browsers send/receive the session cookie cross-origin
    }),
  );

  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      pool: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount,
      },
    });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/submissions", submissionsRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/challenges", challengesRouter);
  app.use("/api", statsRouter); // /api/stats, /api/teams, /api/live

  app.use((req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error("Unhandled error:", err);
    res.status(err.status || 500).json({ error: err.message || "Internal server error" });
  });

  return app;
}
