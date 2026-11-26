import os from "node:os";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { pool } from "./db.js";
import { liveBackend } from "./live.js";
import authRouter from "./routes/auth.js";
import submissionsRouter from "./routes/submissions.js";
import adminRouter from "./routes/admin.js";
import challengesRouter from "./routes/challenges.js";
import statsRouter from "./routes/stats.js";
import { metricsMiddleware, startMetricsPublisher } from "./metrics.js";

export function createApp() {
  const app = express();

  // The API runs behind a reverse proxy (the nginx "web" container, and an
  // Ingress controller on Kubernetes). The proxy sets X-Forwarded-For to
  // the real client IP; without trusting it, express-rate-limit would see
  // every request as coming from the proxy and share one bucket for all
  // users. TRUST_PROXY = number of proxy hops to trust (default 1).
  app.set("trust proxy", Number(process.env.TRUST_PROXY ?? 1));

  app.use(metricsMiddleware);
  startMetricsPublisher();
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

  // Liveness: the process is up. Also reports which replica answered
  // (useful to watch load-balancing across pods/containers).
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      instance: os.hostname(),
      live: liveBackend(),
      pool: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount,
      },
    });
  });

  // Readiness: the process can actually serve traffic (database reachable).
  app.get("/api/ready", async (req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ status: "ready", instance: os.hostname() });
    } catch (err) {
      res.status(503).json({ status: "not-ready", error: err.message });
    }
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