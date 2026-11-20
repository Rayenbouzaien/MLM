import pg from "pg";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * One small pool of connections per process, reused for every request.
 * When more requests arrive than there are free connections, pg.Pool
 * queues them in memory instead of rejecting them. Each API replica holds
 * at most PGPOOL_MAX connections, so total load on Postgres is
 * replicas x PGPOOL_MAX (keep it under Postgres' max_connections, 100 by
 * default).
 */
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === "false" ? false : { rejectUnauthorized: false },
  max: Number(process.env.PGPOOL_MAX || 15),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on("error", (err) => {
  // A background/idle client died. Log it — do NOT crash the process,
  // the pool will open a replacement connection on next use.
  console.error("Unexpected error on idle PG client:", err);
});

// Several API replicas start at the same time on Kubernetes. A session-level
// advisory lock makes them run migrations one after the other instead of
// racing each other (the other replicas wait, then re-run the idempotent
// migrations as no-ops).
const MIGRATION_LOCK_ID = 727274;

export async function runMigrations() {
  const dir = path.join(__dirname, "..", "migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_ID]);
    for (const file of files) {
      // eslint-disable-next-line no-await-in-loop
      await client.query(fs.readFileSync(path.join(dir, file), "utf8"));
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_ID]).catch(() => {});
    client.release();
  }
}

// Transient/contention error codes worth retrying automatically.
// 40001 = serialization_failure, 40P01 = deadlock_detected,
// 57P03 = cannot_connect_now, 08006/08001/08003 = connection issues.
const RETRYABLE_CODES = new Set([
  "40001",
  "40P01",
  "57P03",
  "08006",
  "08001",
  "08003",
]);

export async function withRetry(fn, { retries = 4, baseDelayMs = 100 } = {}) {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt += 1;
      if (attempt > retries || !RETRYABLE_CODES.has(err.code)) throw err;
      const jitter = 0.5 + Math.random();
      const delay = baseDelayMs * 2 ** (attempt - 1) * jitter;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
