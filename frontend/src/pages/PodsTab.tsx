import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";

interface Pod {
  name: string; app: string; phase: string; ready: string; isReady: boolean; restarts: number;
  lastRestart: { reason: string; exitCode: number | null; at: string | null } | null;
  node: string | null; podIP: string | null; ageS: number | null;
  cpuMilli: number | null; memMi: number | null; cpuReqMilli: number | null; cpuLimMilli: number | null;
  memReqMi: number | null; memLimMi: number | null;
}
interface Workload { kind: string; name: string; desired: number; ready: number; updated: number; image: string | null }
interface Hpa { name: string; target: string | null; min: number; max: number | null; current: number; desired: number; cpuPercent: number | null; cpuTargetPercent: number | null; limited: string[] }
interface Warning { at: string | null; reason: string; object: string; message: string; count: number }
type PodsView =
  | { available: false; reason: string }
  | { available: true; namespace: string; at: number; pods: Pod[]; workloads: Workload[]; hpas: Hpa[]; warnings: Warning[]; metricsAvailable: boolean };

const POLL_MS = 3000;

function age(s: number | null) {
  if (s === null) return "—";
  if (s < 120) return `${s}s`;
  if (s < 7200) return `${Math.floor(s / 60)}m`;
  if (s < 172800) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function phaseTone(p: Pod) {
  if (p.isReady) return "ok";
  if (["Pending", "ContainerCreating", "PodInitializing", "Terminating"].includes(p.phase)) return "warn";
  return "bad";
}

function Usage({ used, req, lim, unit }: { used: number | null; req: number | null; lim: number | null; unit: string }) {
  if (used === null) return <span className="sc-muted">n/a</span>;
  const cap = lim ?? req ?? Math.max(used, 1);
  const pct = Math.min(100, (used / cap) * 100);
  const tone = pct >= 85 ? "bad" : pct >= 60 ? "warn" : "ok";
  return <div className="sc-cell" title={`request ${req ?? "—"}${unit} · limit ${lim ?? "—"}${unit}`}>
    <div className="sc-meter" role="meter" aria-valuemin={0} aria-valuemax={cap} aria-valuenow={used} aria-label={`usage ${used}${unit}`}><i className={`is-${tone}`} style={{ width: `${pct}%` }} /></div>
    <b>{Math.round(used)}{unit}</b>
  </div>;
}

export default function PodsTab() {
  const [view, setView] = useState<PodsView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    let alive = true;
    const tick = () => api.get<PodsView>("/api/admin/pods")
      .then((v) => { if (alive) { setView(v); setError(null); } })
      .catch((err) => { if (alive) setError(err instanceof ApiError ? err.message : "Pod data is unavailable."); });
    void tick();
    const id = window.setInterval(() => void tick(), POLL_MS);
    return () => { alive = false; window.clearInterval(id); };
  }, [paused]);

  const ok = view && view.available ? view : null;
  const total = ok?.pods.length ?? 0;
  const ready = ok?.pods.filter((p) => p.isReady).length ?? 0;
  const restarts = ok?.pods.reduce((a, p) => a + p.restarts, 0) ?? 0;

  return <section className="admin-panel sc" aria-labelledby="admin-pods-title">
    <header className="admin-panel__head">
      <div><p>Cloud operations</p><h2 id="admin-pods-title">Pods</h2></div>
      <button onClick={() => setPaused((p) => !p)}>{paused ? "Resume live →" : "Pause"}</button>
    </header>
    {error && <p className="admin-alert" role="alert">{error}</p>}
    {!view ? <div className="admin-skeleton" aria-busy="true"><i /><i /></div>
      : !view.available ? <div className="admin-empty"><h3>Kubernetes not detected</h3><p>{view.reason}</p></div>
      : <>
        <p className="sc-note"><span className={`sc-dot ${paused ? "" : "is-live"}`} />{paused ? "Paused" : `Live · refreshing every ${POLL_MS / 1000}s`} · namespace <code>{view.namespace}</code>{!view.metricsAvailable && " · CPU/memory unavailable (enable metrics-server)"}</p>
        <dl className="sc-kpis">
          <div className="sc-kpi"><dt>Pods</dt><dd>{total}</dd></div>
          <div className={`sc-kpi ${ready === total ? "is-ok" : "is-warn"}`}><dt>Ready</dt><dd>{ready}/{total}</dd></div>
          <div className={`sc-kpi ${restarts ? "is-warn" : ""}`}><dt>Restarts</dt><dd>{restarts}</dd></div>
          <div className="sc-kpi"><dt>Warnings</dt><dd>{view.warnings.length}</dd></div>
        </dl>

        {view.hpas.map((h) => <div className="sc-card" key={h.name}>
          <p>Autoscaler · {h.name} → {h.target}</p>
          <dl>
            <div><dt>Replicas</dt><dd>{h.current} <small>({h.min}–{h.max})</small></dd></div>
            <div><dt>Desired</dt><dd>{h.desired}</dd></div>
            <div><dt>CPU / target</dt><dd>{h.cpuPercent ?? "—"}% / {h.cpuTargetPercent ?? "—"}%</dd></div>
          </dl>
          {h.desired !== h.current && <span className="sc-muted">{h.desired > h.current ? "Scaling up…" : "Scaling down…"}</span>}
          {h.limited.length > 0 && <span className="sc-muted">Limited: {h.limited.join(", ")}</span>}
        </div>)}

        <h3 className="sc-h">Pods</h3>
        <div className="admin-team-table"><table>
          <thead><tr><th>Pod</th><th>Status</th><th>Ready</th><th>Restarts</th><th>CPU (m)</th><th>Memory (Mi)</th><th>Node / IP</th><th>Age</th></tr></thead>
          <tbody>{view.pods.map((p) => <tr key={p.name}>
            <td><strong style={{ textTransform: "none" }}>{p.name}</strong><span>{p.app}</span></td>
            <td><b className={phaseTone(p) === "ok" ? "is-ready" : phaseTone(p) === "bad" ? "is-held" : ""}>{p.phase}</b></td>
            <td>{p.ready}</td>
            <td>{p.restarts}{p.lastRestart && <span className="sc-bad">{p.lastRestart.reason}{p.lastRestart.exitCode !== null && ` (exit ${p.lastRestart.exitCode})`}</span>}</td>
            <td><Usage used={p.cpuMilli} req={p.cpuReqMilli} lim={p.cpuLimMilli} unit="m" /></td>
            <td><Usage used={p.memMi} req={p.memReqMi} lim={p.memLimMi} unit="Mi" /></td>
            <td>{p.node ?? "—"}<span>{p.podIP ?? ""}</span></td>
            <td>{age(p.ageS)}</td>
          </tr>)}
          {view.pods.length === 0 && <tr><td colSpan={8}><div className="admin-empty"><h3>No pods</h3></div></td></tr>}</tbody>
        </table></div>

        <h3 className="sc-h">Workloads</h3>
        <div className="admin-team-table"><table>
          <thead><tr><th>Name</th><th>Kind</th><th>Ready / desired</th><th>Up to date</th><th>Image</th></tr></thead>
          <tbody>{view.workloads.map((w) => <tr key={`${w.kind}/${w.name}`}>
            <td><strong>{w.name}</strong></td><td>{w.kind}</td>
            <td className={w.ready < w.desired ? "sc-bad" : ""}>{w.ready} / {w.desired}</td><td>{w.updated}</td><td>{w.image ?? "—"}</td>
          </tr>)}</tbody>
        </table></div>

        <h3 className="sc-h">Recent warnings</h3>
        {view.warnings.length === 0 ? <p className="sc-muted">No warning events.</p>
          : <ul className="sc-events">{view.warnings.map((w, i) => <li key={i} className="is-down"><time>{w.at ? new Date(w.at).toLocaleTimeString() : "—"}</time><b>{w.reason}</b> {w.object}{w.count > 1 && ` ×${w.count}`} — {w.message}</li>)}</ul>}
      </>}
  </section>;
}
