import { useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError } from "../lib/api";

interface Instance {
  instance: string; pid: number; at: number; startedAt: number; uptimeS: number;
  rps: number; errorRps: number; cpuPercent: number; loopLagMs: number; loopLagP99Ms: number;
  rssMb: number; heapMb: number; sseClients: number; totalRequests: number;
  pool: { total: number; idle: number; waiting: number; max: number | null };
}
interface Snapshot {
  at: number; served_by: string; live: "redis" | "memory"; bucketsMs: number[]; hist: number[];
  totals: {
    replicas: number; rps: number; errorRps: number; errorRate: number; windowRequests: number;
    sseClients: number; p50Ms: number | null; p95Ms: number | null; p99Ms: number | null;
    poolInUse: number; poolMax: number; poolWaiting: number;
  };
  routes: { route: string; count: number; errors: number; avgMs: number }[];
  instances: Instance[];
  db: { connections: number; active: number; maxConnections: number; sizeMb: number } | null;
  redis: { clients: number; usedMemoryMb: number; opsPerSec: number; uptimeS: number } | null;
}
interface Point { t: number; rps: number; p95: number | null; replicas: number }
interface ScaleEvent { t: number; text: string; kind: "up" | "down" }

const POLL_MS = 3000;
const HISTORY = 60; // points = 3 min

function fmtUptime(s: number) {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}
const fmtMs = (v: number | null) => (v === null ? "—" : v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `≤${v}ms`);

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "ok" | "warn" | "bad" }) {
  return <div className={`sc-kpi ${tone ? `is-${tone}` : ""}`}><dt>{label}</dt><dd>{value}</dd>{sub && <span>{sub}</span>}</div>;
}

function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const tone = pct >= 85 ? "bad" : pct >= 60 ? "warn" : "ok";
  return <div className="sc-meter" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}><i className={`is-${tone}`} style={{ width: `${pct}%` }} /></div>;
}

function LineChart({ points, pick, label, unit, color }: { points: Point[]; pick: (p: Point) => number | null; label: string; unit: string; color: string }) {
  const W = 560, H = 150, PAD = 6;
  const vals = points.map(pick);
  const nums = vals.filter((v): v is number => v !== null);
  const max = Math.max(1, ...nums) * 1.15;
  const offset = HISTORY - points.length;
  const px = (i: number) => PAD + ((i + offset) / (HISTORY - 1)) * (W - PAD * 2);
  const py = (v: number) => H - PAD - (v / max) * (H - PAD * 2);
  const segs: string[] = [];
  let cur = "";
  vals.forEach((v, i) => {
    if (v === null) { if (cur) segs.push(cur); cur = ""; return; }
    cur += `${cur ? "L" : "M"}${px(i).toFixed(1)},${py(v).toFixed(1)}`;
  });
  if (cur) segs.push(cur);
  const last = nums.at(-1);
  return <figure className="sc-chart">
    <figcaption><span>{label}</span><b style={{ color }}>{last === undefined ? "—" : `${Math.round(last * 10) / 10} ${unit}`}</b></figcaption>
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label} over the last ${Math.round((HISTORY * POLL_MS) / 60000)} minutes`} preserveAspectRatio="none">
      {[0.25, 0.5, 0.75].map((g) => <line key={g} x1={0} x2={W} y1={H * g} y2={H * g} className="sc-grid" />)}
      {segs.map((d, i) => <path key={i} d={d} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" />)}
    </svg>
    <div className="sc-chart__axis"><span>−{Math.round((HISTORY * POLL_MS) / 60000)} min</span><span>peak {Math.round(max / 1.15 * 10) / 10} {unit}</span><span>now</span></div>
  </figure>;
}

function ReplicaChart({ points }: { points: Point[] }) {
  const W = 560, H = 60, PAD = 4;
  const max = Math.max(2, ...points.map((p) => p.replicas)) + 1;
  const offset = HISTORY - points.length;
  const px = (i: number) => PAD + ((i + offset) / (HISTORY - 1)) * (W - PAD * 2);
  const py = (v: number) => H - PAD - (v / max) * (H - PAD * 2);
  let d = "";
  points.forEach((p, i) => { d += `${i === 0 ? "M" : `H${px(i).toFixed(1)}V`}${i === 0 ? `${px(i).toFixed(1)},` : ""}${py(p.replicas).toFixed(1)}`; });
  return <figure className="sc-chart">
    <figcaption><span>Replicas</span><b style={{ color: "#f0cf70" }}>{points.at(-1)?.replicas ?? "—"}</b></figcaption>
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Replica count over time" preserveAspectRatio="none">
      <path d={d} fill="none" stroke="#f0cf70" strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  </figure>;
}

function Histogram({ hist, buckets }: { hist: number[]; buckets: number[] }) {
  const total = hist.reduce((a, b) => a + b, 0);
  const max = Math.max(1, ...hist);
  return <ul className="sc-hist" aria-label="Latency distribution, last 60 seconds">
    {hist.map((n, i) => {
      const label = i < buckets.length ? `≤${buckets[i]}ms` : `>${buckets.at(-1)}ms`;
      return <li key={label}><span>{label}</span><div><i style={{ width: `${(n / max) * 100}%` }} className={i >= 5 ? "is-slow" : ""} /></div><b>{total ? `${Math.round((n / total) * 100)}%` : "—"}</b></li>;
    })}
  </ul>;
}

export default function ScalabilityTab() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [events, setEvents] = useState<ScaleEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const known = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (paused) return;
    let alive = true;
    async function tick() {
      try {
        const s = await api.get<Snapshot>("/api/admin/scalability");
        if (!alive) return;
        setSnap(s); setError(null);
        setPoints((prev) => [...prev, { t: s.at, rps: s.totals.rps, p95: s.totals.p95Ms, replicas: s.totals.replicas }].slice(-HISTORY));
        const names = new Set(s.instances.map((i) => i.instance));
        if (known.current) {
          const added = [...names].filter((n) => !known.current!.has(n));
          const removed = [...known.current].filter((n) => !names.has(n));
          const fresh: ScaleEvent[] = [
            ...added.map((n) => ({ t: s.at, kind: "up" as const, text: `Replica ${n} joined (${names.size} running)` })),
            ...removed.map((n) => ({ t: s.at, kind: "down" as const, text: `Replica ${n} left (${names.size} running)` })),
          ];
          if (fresh.length) setEvents((e) => [...fresh, ...e].slice(0, 12));
        }
        known.current = names;
      } catch (err) {
        if (alive) setError(err instanceof ApiError ? err.message : "Metrics are unavailable.");
      }
    }
    void tick();
    const id = window.setInterval(() => void tick(), POLL_MS);
    return () => { alive = false; window.clearInterval(id); };
  }, [paused]);

  const headroom = useMemo(() => {
    if (!snap?.db || !snap.instances.length) return null;
    const perReplica = snap.instances[0].pool.max ?? 0;
    if (!perReplica) return null;
    // Keep ~10 % of Postgres connections free for admin/maintenance.
    return Math.floor((snap.db.maxConnections * 0.9) / perReplica);
  }, [snap]);

  const t = snap?.totals;
  const errTone = !t ? undefined : t.errorRate > 0.05 ? "bad" : t.errorRate > 0.01 ? "warn" : "ok";
  const p95Tone = !t || t.p95Ms === null ? undefined : t.p95Ms > 500 ? "bad" : t.p95Ms > 100 ? "warn" : "ok";

  return <section className="admin-panel sc" aria-labelledby="admin-scale-title">
    <header className="admin-panel__head">
      <div><p>Cloud operations</p><h2 id="admin-scale-title">Scalability</h2></div>
      <button onClick={() => setPaused((p) => !p)}>{paused ? "Resume live →" : "Pause"}</button>
    </header>
    {error && <p className="admin-alert" role="alert">{error}</p>}
    {!snap ? <div className="admin-skeleton" aria-busy="true"><i /><i /></div> : <>
      <p className="sc-note">
        <span className={`sc-dot ${paused ? "" : "is-live"}`} />{paused ? "Paused" : `Live · refreshing every ${POLL_MS / 1000}s`} · answered by <code>{snap.served_by}</code> · metrics bus: {snap.live}
        {snap.live === "memory" && " (single process — replicas cannot see each other without Redis)"}
      </p>
      <dl className="sc-kpis">
        <Kpi label="Replicas" value={String(t!.replicas)} sub={headroom ? `DB allows ~${headroom}` : undefined} />
        <Kpi label="Requests / s" value={t!.rps.toFixed(1)} sub="10 s avg, all replicas" />
        <Kpi label="p95 latency" value={fmtMs(t!.p95Ms)} sub={`p50 ${fmtMs(t!.p50Ms)} · p99 ${fmtMs(t!.p99Ms)}`} tone={p95Tone} />
        <Kpi label="5xx rate" value={`${(t!.errorRate * 100).toFixed(2)}%`} sub={`${t!.windowRequests} req / 60 s`} tone={errTone} />
        <Kpi label="Live viewers" value={String(t!.sseClients)} sub="open SSE streams" />
        <Kpi label="DB pool" value={`${t!.poolInUse}/${t!.poolMax}`} sub={t!.poolWaiting ? `${t!.poolWaiting} waiting` : "no queueing"} tone={t!.poolWaiting ? "bad" : undefined} />
      </dl>

      <div className="sc-grid-2">
        <LineChart points={points} pick={(p) => p.rps} label="Throughput" unit="req/s" color="#6ff5f5" />
        <LineChart points={points} pick={(p) => p.p95} label="p95 latency" unit="ms" color="#ff9b95" />
      </div>
      <ReplicaChart points={points} />

      <h3 className="sc-h">Replicas</h3>
      <div className="admin-team-table"><table>
        <thead><tr><th>Instance</th><th>req/s</th><th>CPU</th><th>Memory</th><th>Loop lag p99</th><th>DB pool</th><th>SSE</th><th>Uptime</th></tr></thead>
        <tbody>{snap.instances.map((i) => <tr key={i.instance}>
          <td><strong>{i.instance}</strong>{i.instance === snap.served_by && <span>answering this request</span>}</td>
          <td>{i.rps.toFixed(1)}</td>
          <td><div className="sc-cell"><Meter value={i.cpuPercent} max={100} label={`CPU ${i.instance}`} /><b>{i.cpuPercent.toFixed(0)}%</b></div></td>
          <td>{i.rssMb} MB<span>heap {i.heapMb}</span></td>
          <td>{i.loopLagP99Ms.toFixed(1)} ms</td>
          <td>{i.pool.total - i.pool.idle}/{i.pool.max ?? "?"}{i.pool.waiting > 0 && <span className="sc-bad"> {i.pool.waiting} waiting</span>}</td>
          <td>{i.sseClients}</td>
          <td>{fmtUptime(i.uptimeS)}</td>
        </tr>)}</tbody>
      </table></div>

      <div className="sc-grid-2">
        <div><h3 className="sc-h">Latency distribution · 60 s</h3><Histogram hist={snap.hist} buckets={snap.bucketsMs} /></div>
        <div><h3 className="sc-h">Scaling events</h3>
          {events.length === 0 ? <p className="sc-muted">No replica changes since you opened this page. Run <code>make k8s-hpa-load</code> or <code>docker compose up -d --scale api=3</code> to watch one happen.</p>
            : <ul className="sc-events">{events.map((e, i) => <li key={i} className={`is-${e.kind}`}><time>{new Date(e.t).toLocaleTimeString()}</time>{e.kind === "up" ? "▲" : "▼"} {e.text}</li>)}</ul>}
        </div>
      </div>

      <h3 className="sc-h">Data tier</h3>
      <div className="sc-grid-2">
        <div className="sc-card"><p>PostgreSQL</p>{snap.db ? <>
          <Meter value={snap.db.connections} max={snap.db.maxConnections} label="Postgres connections" />
          <dl><div><dt>Connections</dt><dd>{snap.db.connections} / {snap.db.maxConnections}</dd></div><div><dt>Active</dt><dd>{snap.db.active}</dd></div><div><dt>Size</dt><dd>{snap.db.sizeMb} MB</dd></div></dl>
          {headroom !== null && <span className="sc-muted">At {snap.instances[0].pool.max} connections per replica the database saturates at about {headroom} replicas — raise <code>max_connections</code> or add a pooler (PgBouncer) before scaling the HPA past that.</span>}
        </> : <span className="sc-muted">Unavailable</span>}</div>
        <div className="sc-card"><p>Redis</p>{snap.redis ? <dl><div><dt>Clients</dt><dd>{snap.redis.clients}</dd></div><div><dt>Ops / s</dt><dd>{snap.redis.opsPerSec}</dd></div><div><dt>Memory</dt><dd>{snap.redis.usedMemoryMb} MB</dd></div></dl> : <span className="sc-muted">Not configured — the API is running with the in-memory bus.</span>}</div>
      </div>

      <h3 className="sc-h">Busiest routes · 60 s</h3>
      <div className="admin-team-table"><table>
        <thead><tr><th>Route</th><th>Requests</th><th>Avg</th><th>5xx</th></tr></thead>
        <tbody>{snap.routes.map((r) => <tr key={r.route}><td><strong style={{ textTransform: "none" }}>{r.route}</strong></td><td>{r.count}</td><td>{r.avgMs.toFixed(1)} ms</td><td className={r.errors ? "sc-bad" : ""}>{r.errors}</td></tr>)}
          {snap.routes.length === 0 && <tr><td colSpan={4}><div className="admin-empty"><h3>No traffic yet</h3><p>Routes appear as requests arrive.</p></div></td></tr>}</tbody>
      </table></div>
    </>}
  </section>;
}
