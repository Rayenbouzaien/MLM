import fs from "node:fs";
import https from "node:https";

// Read-only Kubernetes view for the admin "Pods" dashboard. Uses the pod's
// own service-account token (k8s/80-rbac.yaml grants get/list on pods,
// events, workloads, HPAs and pod metrics in this namespace only).
// Outside a cluster (docker compose, tests) it reports { available: false }.

const SA_DIR = "/var/run/secrets/kubernetes.io/serviceaccount";
const CACHE_MS = 2000;
let cache = null;

export function inCluster() {
  return Boolean(process.env.KUBERNETES_SERVICE_HOST) && fs.existsSync(`${SA_DIR}/token`);
}

// "250m" -> 250, "1" -> 1000, "12345678n" -> 12.3
export function parseCpuMilli(q) {
  if (q == null || q === "") return null;
  const m = /^([0-9.]+)([a-zA-Z]*)$/.exec(String(q));
  if (!m) return null;
  const n = Number(m[1]);
  switch (m[2]) {
    case "n": return n / 1e6;
    case "u": return n / 1e3;
    case "m": return n;
    case "": return n * 1000;
    default: return null;
  }
}

// "128Mi" -> 128, "131072Ki" -> 128, "134217728" -> 128 (MiB)
export function parseMemMi(q) {
  if (q == null || q === "") return null;
  const m = /^([0-9.]+)([a-zA-Z]*)$/.exec(String(q));
  if (!m) return null;
  const n = Number(m[1]);
  const mult = { "": 1, Ki: 1024, Mi: 1024 ** 2, Gi: 1024 ** 3, K: 1e3, M: 1e6, G: 1e9 }[m[2]];
  return mult === undefined ? null : (n * mult) / 1048576;
}

function containerState(cs) {
  const s = cs.state ?? {};
  if (s.running) return { state: "running", reason: null };
  if (s.waiting) return { state: "waiting", reason: s.waiting.reason ?? null };
  if (s.terminated) return { state: "terminated", reason: s.terminated.reason ?? null };
  return { state: "unknown", reason: null };
}

const round1 = (v) => (v == null ? null : Math.round(v * 10) / 10);

// Pure: raw API lists -> what the dashboard renders. Unit-tested.
export function buildPodsView({ pods, podMetrics, deployments, statefulSets, hpas, events }, now = Date.now()) {
  const usage = new Map();
  for (const pm of podMetrics?.items ?? []) {
    let cpu = 0, mem = 0;
    for (const c of pm.containers ?? []) {
      cpu += parseCpuMilli(c.usage?.cpu) ?? 0;
      mem += parseMemMi(c.usage?.memory) ?? 0;
    }
    usage.set(pm.metadata.name, { cpu, mem });
  }

  const podRows = (pods?.items ?? []).map((p) => {
    const spec = p.spec ?? {};
    const status = p.status ?? {};
    const css = status.containerStatuses ?? [];
    const readyCount = css.filter((c) => c.ready).length;
    const restarts = css.reduce((a, c) => a + (c.restartCount ?? 0), 0);
    const worst = css.map(containerState).find((c) => c.state !== "running") ?? { state: "running", reason: null };
    const lastTerm = css.map((c) => c.lastState?.terminated).find(Boolean);
    const req = { cpu: 0, mem: 0 }, lim = { cpu: 0, mem: 0 };
    for (const c of spec.containers ?? []) {
      req.cpu += parseCpuMilli(c.resources?.requests?.cpu) ?? 0;
      req.mem += parseMemMi(c.resources?.requests?.memory) ?? 0;
      lim.cpu += parseCpuMilli(c.resources?.limits?.cpu) ?? 0;
      lim.mem += parseMemMi(c.resources?.limits?.memory) ?? 0;
    }
    const u = usage.get(p.metadata.name);
    const terminating = Boolean(p.metadata.deletionTimestamp);
    const created = Date.parse(p.metadata.creationTimestamp);
    let display = terminating ? "Terminating" : status.phase ?? "Unknown";
    if (!terminating && worst.state === "waiting" && worst.reason) display = worst.reason; // CrashLoopBackOff, ImagePullBackOff…
    return {
      name: p.metadata.name,
      app: p.metadata.labels?.app ?? "—",
      phase: display,
      ready: `${readyCount}/${spec.containers?.length ?? css.length}`,
      isReady: css.length > 0 && readyCount === css.length && !terminating,
      restarts,
      lastRestart: lastTerm ? { reason: lastTerm.reason ?? "Terminated", exitCode: lastTerm.exitCode ?? null, at: lastTerm.finishedAt ?? null } : null,
      node: spec.nodeName ?? null,
      podIP: status.podIP ?? null,
      ageS: Number.isFinite(created) ? Math.max(0, Math.round((now - created) / 1000)) : null,
      cpuMilli: u ? round1(u.cpu) : null,
      memMi: u ? round1(u.mem) : null,
      cpuReqMilli: req.cpu || null,
      cpuLimMilli: lim.cpu || null,
      memReqMi: round1(req.mem || null),
      memLimMi: round1(lim.mem || null),
    };
  }).sort((a, b) => a.app.localeCompare(b.app) || a.name.localeCompare(b.name));

  const workloads = [
    ...(deployments?.items ?? []).map((d) => ({ kind: "Deployment", d })),
    ...(statefulSets?.items ?? []).map((d) => ({ kind: "StatefulSet", d })),
  ].map(({ kind, d }) => ({
    kind,
    name: d.metadata.name,
    desired: d.spec?.replicas ?? 0,
    ready: d.status?.readyReplicas ?? 0,
    updated: d.status?.updatedReplicas ?? 0,
    image: d.spec?.template?.spec?.containers?.[0]?.image ?? null,
  }));

  const hpaRows = (hpas?.items ?? []).map((h) => {
    const cpuMetric = (h.status?.currentMetrics ?? []).find((m) => m.resource?.name === "cpu");
    const cpuTarget = (h.spec?.metrics ?? []).find((m) => m.resource?.name === "cpu");
    return {
      name: h.metadata.name,
      target: h.spec?.scaleTargetRef?.name ?? null,
      min: h.spec?.minReplicas ?? 1,
      max: h.spec?.maxReplicas ?? null,
      current: h.status?.currentReplicas ?? 0,
      desired: h.status?.desiredReplicas ?? 0,
      cpuPercent: cpuMetric?.resource?.current?.averageUtilization ?? null,
      cpuTargetPercent: cpuTarget?.resource?.target?.averageUtilization ?? null,
      limited: (h.status?.conditions ?? []).filter((c) => c.type === "ScalingLimited" && c.status === "True").map((c) => c.reason),
    };
  });

  const warnings = (events?.items ?? [])
    .filter((e) => e.type === "Warning")
    .map((e) => ({
      at: e.lastTimestamp ?? e.eventTime ?? e.metadata?.creationTimestamp ?? null,
      reason: e.reason,
      object: `${(e.involvedObject?.kind ?? "").toLowerCase()}/${e.involvedObject?.name ?? ""}`,
      message: e.message,
      count: e.count ?? 1,
    }))
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .slice(0, 10);

  return { pods: podRows, workloads, hpas: hpaRows, warnings, metricsAvailable: usage.size > 0 };
}

function apiGet(path, token, ca) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { host: process.env.KUBERNETES_SERVICE_HOST, port: process.env.KUBERNETES_SERVICE_PORT || 443, path, method: "GET", ca, headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, timeout: 4000 },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
          } else {
            const err = new Error(`Kubernetes API ${res.statusCode} for ${path}`);
            err.status = res.statusCode;
            reject(err);
          }
        });
      },
    );
    req.on("timeout", () => req.destroy(new Error("Kubernetes API timeout")));
    req.on("error", reject);
    req.end();
  });
}

export async function fetchPodsView() {
  if (!inCluster()) {
    return { available: false, reason: "Not running inside Kubernetes (docker compose or local process). Deploy with `make k8s-up` to see pods." };
  }
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;

  const token = fs.readFileSync(`${SA_DIR}/token`, "utf8").trim();
  const ca = fs.readFileSync(`${SA_DIR}/ca.crt`);
  const ns = fs.readFileSync(`${SA_DIR}/namespace`, "utf8").trim();
  const base = `/api/v1/namespaces/${ns}`;
  const get = (p) => apiGet(p, token, ca);
  // Metrics are optional (metrics-server may be missing) and must not fail the view.
  const optional = (p) => get(p).catch(() => null);

  try {
    const [pods, podMetrics, deployments, statefulSets, hpas, events] = await Promise.all([
      get(`${base}/pods`),
      optional(`/apis/metrics.k8s.io/v1beta1/namespaces/${ns}/pods`),
      get(`/apis/apps/v1/namespaces/${ns}/deployments`),
      get(`/apis/apps/v1/namespaces/${ns}/statefulsets`),
      get(`/apis/autoscaling/v2/namespaces/${ns}/horizontalpodautoscalers`),
      optional(`${base}/events`),
    ]);
    const value = { available: true, namespace: ns, at: Date.now(), ...buildPodsView({ pods, podMetrics, deployments, statefulSets, hpas, events }) };
    cache = { at: Date.now(), value };
    return value;
  } catch (err) {
    const forbidden = err.status === 403;
    return {
      available: false,
      reason: forbidden
        ? "The API's service account may not read pods. Apply k8s/80-rbac.yaml (kubectl apply -k k8s)."
        : `Kubernetes API unreachable: ${err.message}`,
    };
  }
}
