import pg from "pg";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * This is the actual fix for "300 people hit Submit and the DB falls over."
 *
 * Instead of opening a new Postgres connection per request (what kills a
 * naive serverless-per-request setup), this process opens ONE small pool
 * of connections at boot and reuses them for every request. When more
 * requests arrive than there are free connections, pg.Pool queues them
 * in memory and serves them as connections free up — it does NOT reject
 * or crash. Point DATABASE_URL at Neon's *pooled* connection string
 * (the one with "-pooler" in the hostname) and this pool sits on top of
 * Neon's own PgBouncer, so you get two layers of protection.
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

export async function runMigrations() {
  const dir = path.join(__dirname, "..", "migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    // eslint-disable-next-line no-await-in-loop
    await pool.query(fs.readFileSync(path.join(dir, file), "utf8"));
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
