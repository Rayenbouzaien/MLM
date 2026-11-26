import { describe, it, expect } from "@jest/globals";
import { parseCpuMilli, parseMemMi, buildPodsView } from "../../src/k8s.js";

describe("quantity parsing", () => {
  it("parses CPU", () => {
    expect(parseCpuMilli("250m")).toBe(250);
    expect(parseCpuMilli("2")).toBe(2000);
    expect(parseCpuMilli("12345678n")).toBeCloseTo(12.3, 1);
    expect(parseCpuMilli(undefined)).toBeNull();
  });
  it("parses memory to MiB", () => {
    expect(parseMemMi("128Mi")).toBe(128);
    expect(parseMemMi("131072Ki")).toBe(128);
    expect(parseMemMi("134217728")).toBe(128);
    expect(parseMemMi("1Gi")).toBe(1024);
  });
});

const NOW = Date.parse("2026-11-26T12:00:00Z");
const pod = (name, app, extra = {}) => ({
  metadata: { name, labels: { app }, creationTimestamp: "2026-11-26T11:59:00Z", ...extra.metadata },
  spec: { nodeName: "minikube", containers: [{ name: "c", resources: { requests: { cpu: "100m", memory: "128Mi" }, limits: { cpu: "500m", memory: "256Mi" } } }] },
  status: { phase: "Running", podIP: "10.0.0.1", containerStatuses: [{ ready: true, restartCount: 0, state: { running: {} } }], ...extra.status },
});

describe("buildPodsView", () => {
  const raw = {
    pods: { items: [
      pod("api-b", "api"),
      pod("api-a", "api", { status: { containerStatuses: [{ ready: false, restartCount: 3, state: { waiting: { reason: "CrashLoopBackOff" } }, lastState: { terminated: { reason: "OOMKilled", exitCode: 137, finishedAt: "2026-11-26T11:59:30Z" } } }] } }),
      pod("api-c", "api", { metadata: { deletionTimestamp: "2026-11-26T11:59:50Z" } }),
    ] },
    podMetrics: { items: [{ metadata: { name: "api-b" }, containers: [{ usage: { cpu: "45000000n", memory: "64Mi" } }] }] },
    deployments: { items: [{ metadata: { name: "api" }, spec: { replicas: 3, template: { spec: { containers: [{ image: "gridlock-api:1.0.0" }] } } }, status: { readyReplicas: 1, updatedReplicas: 3 } }] },
    statefulSets: { items: [] },
    hpas: { items: [{ metadata: { name: "api" }, spec: { scaleTargetRef: { name: "api" }, minReplicas: 2, maxReplicas: 6, metrics: [{ resource: { name: "cpu", target: { averageUtilization: 50 } } }] }, status: { currentReplicas: 3, desiredReplicas: 4, currentMetrics: [{ resource: { name: "cpu", current: { averageUtilization: 82 } } }], conditions: [{ type: "ScalingLimited", status: "True", reason: "TooManyReplicas" }] } }] },
    events: { items: [{ type: "Warning", reason: "BackOff", involvedObject: { kind: "Pod", name: "api-a" }, message: "Back-off restarting", lastTimestamp: "2026-11-26T11:59:40Z", count: 4 }, { type: "Normal", reason: "Pulled", involvedObject: {}, message: "ok" }] },
  };
  const view = buildPodsView(raw, NOW);

  it("sorts pods and computes state", () => {
    expect(view.pods.map((p) => p.name)).toEqual(["api-a", "api-b", "api-c"]);
    const [a, b, c] = view.pods;
    expect(a).toMatchObject({ phase: "CrashLoopBackOff", restarts: 3, isReady: false, ready: "0/1" });
    expect(a.lastRestart).toMatchObject({ reason: "OOMKilled", exitCode: 137 });
    expect(b).toMatchObject({ phase: "Running", isReady: true, ageS: 60, cpuReqMilli: 100, memLimMi: 256 });
    expect(b.cpuMilli).toBeCloseTo(45, 0);
    expect(b.memMi).toBe(64);
    expect(c.phase).toBe("Terminating");
  });
  it("reports workloads, HPA and warnings only", () => {
    expect(view.workloads[0]).toMatchObject({ kind: "Deployment", desired: 3, ready: 1 });
    expect(view.hpas[0]).toMatchObject({ min: 2, max: 6, current: 3, desired: 4, cpuPercent: 82, cpuTargetPercent: 50, limited: ["TooManyReplicas"] });
    expect(view.warnings).toHaveLength(1);
    expect(view.warnings[0].object).toBe("pod/api-a");
    expect(view.metricsAvailable).toBe(true);
  });
});
