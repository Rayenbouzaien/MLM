import os from "node:os";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { pool } from "./db.js";
import { getRedisClient } from "./live.js";

// Per-replica runtime metrics + cluster aggregation for the admin
// "Scalability" dashboard.
//
// Every API replica keeps a rolling 60 s window of request samples and
// publishes a snapshot to Redis (key gridlock:metrics:<hostname>, short TTL)
// every few seconds. Any replica can then answer /api/admin/scalability by
// reading all live snapshots: a replica that dies simply stops refreshing its
// key and drops out of the list after the TTL. Without REDIS_URL (tests,
// local `npm start`) the dashboard shows just this process.

const WINDOW_MS = 60_000;
const RATE_WINDOW_MS = 10_000;
const PUBLISH_EVERY_MS = 3_000;
const KEY_PREFIX = "gridlock:metrics:";
const KEY_TTL_S = 10;
const MAX_SAMPLES = 100_000;
export const LATENCY_BUCKETS_MS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500]; // + overflow bucket

const startedAt = Date.now();
const instance = os.hostname();
let samples = []; // { t, ms, status, route }
let sseClients = 0;
let totalRequests = 0;
let totalErrors = 0;

const loopDelay = monitorEventLoopDelay({ resolution: 20 });
loopDelay.enable();

let lastCpu = process.cpuUsage();
let lastCpuAt = process.hrtime.bigint();
let cpuPercent = 0;
function sampleCpu() {
  const now = process.hrtime.bigint();
  const usage = process.cpuUsage(lastCpu);
  const elapsedUs = Number(now - lastCpuAt) / 1000;
  if (elapsedUs > 0) cpuPercent = ((usage.user + usage.system) / elapsedUs) * 100;
  lastCpu = process.cpuUsage();
  lastCpuAt = now;
}

function prune(now) {
  const cutoff = now - WINDOW_MS;
  let i = 0;
  while (i < samples.length && samples[i].t < cutoff) i++;
  if (i > 0) samples = samples.slice(i);
  if (samples.length > MAX_SAMPLES) samples = samples.slice(-MAX_SAMPLES);
}

export function sseOpened() {
  sseClients++;
}
export function sseClosed() {
  sseClients = Math.max(0, sseClients - 1);
}

export function metricsMiddleware(req, res, next) {
  // Dashboard polling and probes would drown out real traffic.
  if (req.path === "/api/admin/scalability" || req.path === "/api/health" || req.path === "/api/ready") {
    return next();
  }
  const start = process.hrtime.bigint();
  let recorded = false;
  const record = (aborted) => {
    if (recorded) return;
    recorded = true;
    // Long-lived SSE streams would skew latency; they are tracked as a gauge.
    if (req.path === "/api/live") return;
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    const status = aborted ? 499 : res.statusCode;
    totalRequests++;
    if (status >= 500) totalErrors++;
    const route = req.route?.path ? `${req.method} ${req.baseUrl}${req.route.path}` : `${req.method} (unmatched)`;
    samples.push({ t: Date.now(), ms, status, route });
  };
  res.on("finish", () => record(false));
  res.on("close", () => record(true));
  next();
}

function bucketIndex(ms) {
  const i = LATENCY_BUCKETS_MS.findIndex((b) => ms <= b);
  return i === -1 ? LATENCY_BUCKETS_MS.length : i;
}

export function localSnapshot() {
  const now = Date.now();
  prune(now);
  const hist = new Array(LATENCY_BUCKETS_MS.length + 1).fill(0);
  const routes = new Map();
  let recent = 0;
  let recentErrors = 0;
  let errors = 0;
  for (const s of samples) {
    hist[bucketIndex(s.ms)]++;
    if (s.status >= 500) errors++;
    if (now - s.t <= RATE_WINDOW_MS) {
      recent++;
      if (s.status >= 500) recentErrors++;
    }
    const r = routes.get(s.route) ?? { count: 0, errors: 0, totalMs: 0 };
    r.count++;
    r.totalMs += s.ms;
    if (s.status >= 500) r.errors++;
    routes.set(s.route, r);
  }
  const mem = process.memoryUsage();
  return {
    instance,
    pid: process.pid,
    at: now,
    startedAt,
    uptimeS: Math.round((now - startedAt) / 1000),
    rps: recent / (RATE_WINDOW_MS / 1000),
    errorRps: recentErrors / (RATE_WINDOW_MS / 1000),
    windowRequests: samples.length,
    windowErrors: errors,
    totalRequests,
    totalErrors,
    hist,
    routes: [...routes.entries()]
      .map(([route, r]) => ({ route, count: r.count, errors: r.errors, avgMs: r.totalMs / r.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    cpuPercent: Math.round(cpuPercent * 10) / 10,
    loopLagMs: Math.round((loopDelay.mean / 1e6) * 100) / 100,
    loopLagP99Ms: Math.round((loopDelay.percentile(99) / 1e6) * 100) / 100,
    rssMb: Math.round(mem.rss / 1048576),
    heapMb: Math.round(mem.heapUsed / 1048576),
    sseClients,
    pool: { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount, max: pool.options?.max ?? null },
  };
}

export function percentileFromHist(hist, q) {
  const total = hist.reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  const target = total * q;
  let acc = 0;
  for (let i = 0; i < hist.length; i++) {
    acc += hist[i];
    if (acc >= target) return i < LATENCY_BUCKETS_MS.length ? LATENCY_BUCKETS_MS[i] : LATENCY_BUCKETS_MS.at(-1) * 2;
  }
  return null;
}

let publishTimer = null;
export function startMetricsPublisher() {
  if (publishTimer) return;
  publishTimer = setInterval(() => {
    sampleCpu();
    const redis = getRedisClient();
    if (!redis) return;
    redis
      .set(KEY_PREFIX + instance, JSON.stringify(localSnapshot()), { EX: KEY_TTL_S })
      .catch(() => {});
  }, PUBLISH_EVERY_MS);
  publishTimer.unref();
}

export function stopMetricsPublisher() {
  clearInterval(publishTimer);
  publishTimer = null;
  loopDelay.disable();
}

async function readInstances() {
  const redis = getRedisClient();
  const local = localSnapshot();
  if (!redis) return [local];
  try {
    const keys = [];
    for await (const key of redis.scanIterator({ MATCH: KEY_PREFIX + "*", COUNT: 100 })) {
      if (Array.isArray(key)) keys.push(...key);
      else keys.push(key);
    }
    const values = keys.length ? await redis.mGet(keys) : [];
    const list = values.filter(Boolean).map((v) => JSON.parse(v));
    // Use our own fresh numbers rather than the ≤3 s old published copy.
    const rest = list.filter((s) => s.instance !== instance);
    return [local, ...rest];
  } catch {
    return [local];
  }
}

function parseRedisInfo(text) {
  const out = {};
  for (const line of text.split("\r\n")) {
    const i = line.indexOf(":");
    if (i > 0) out[line.slice(0, i)] = line.slice(i + 1);
  }
  return out;
}

async function redisStats() {
  const redis = getRedisClient();
  if (!redis) return null;
  try {
    const info = parseRedisInfo(await redis.info());
    return {
      clients: Number(info.connected_clients),
      usedMemoryMb: Math.round((Number(info.used_memory) / 1048576) * 10) / 10,
      opsPerSec: Number(info.instantaneous_ops_per_sec),
      uptimeS: Number(info.uptime_in_seconds),
    };
  } catch {
    return null;
  }
}

async function dbStats() {
  try {
    const { rows } = await pool.query(`
      SELECT
        (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database())::int AS connections,
        (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND state = 'active')::int AS active,
        current_setting('max_connections')::int AS max_connections,
        pg_database_size(current_database()) AS size_bytes
    `);
    const r = rows[0];
    return {
      connections: r.connections,
      active: r.active,
      maxConnections: r.max_connections,
      sizeMb: Math.round((Number(r.size_bytes) / 1048576) * 10) / 10,
    };
  } catch {
    return null;
  }
}

export async function clusterSnapshot() {
  const [instances, redis, db] = await Promise.all([readInstances(), redisStats(), dbStats()]);
  instances.sort((a, b) => a.instance.localeCompare(b.instance));

  const hist = new Array(LATENCY_BUCKETS_MS.length + 1).fill(0);
  const routeMap = new Map();
  for (const s of instances) {
    s.hist.forEach((n, i) => (hist[i] += n));
    for (const r of s.routes) {
      const m = routeMap.get(r.route) ?? { route: r.route, count: 0, errors: 0, weighted: 0 };
      m.count += r.count;
      m.errors += r.errors;
      m.weighted += r.avgMs * r.count;
      routeMap.set(r.route, m);
    }
  }
  const sum = (k) => instances.reduce((a, s) => a + s[k], 0);
  const windowRequests = sum("windowRequests");
  const windowErrors = sum("windowErrors");
  const poolMax = instances.reduce((a, s) => a + (s.pool.max ?? 0), 0);
  const poolInUse = instances.reduce((a, s) => a + (s.pool.total - s.pool.idle), 0);

  return {
    at: Date.now(),
    served_by: instance,
    live: redis ? "redis" : "memory",
    bucketsMs: LATENCY_BUCKETS_MS,
    totals: {
      replicas: instances.length,
      rps: Math.round(sum("rps") * 10) / 10,
      errorRps: Math.round(sum("errorRps") * 10) / 10,
      errorRate: windowRequests ? windowErrors / windowRequests : 0,
      windowRequests,
      sseClients: sum("sseClients"),
      p50Ms: percentileFromHist(hist, 0.5),
      p95Ms: percentileFromHist(hist, 0.95),
      p99Ms: percentileFromHist(hist, 0.99),
      poolInUse,
      poolMax,
      poolWaiting: instances.reduce((a, s) => a + s.pool.waiting, 0),
    },
    hist,
    routes: [...routeMap.values()]
      .map((r) => ({ route: r.route, count: r.count, errors: r.errors, avgMs: r.weighted / r.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    instances: instances.map(({ hist: _h, routes: _r, ...rest }) => rest),
    db,
    redis,
  };
}
