// Simulates the actual scenario: ~300 teams registering AND submitting
// around the same moment (registration burst right when the event
// opens, submission burst right at the deadline — this script covers
// both by doing register+submit per simulated team, all teams fired
// concurrently). Run against a LIVE server process, not supertest,
// since supertest bypasses the real network/socket layer and would
// hide connection-exhaustion bugs.
//
// Usage:
//   Terminal 1: npm start                 (server on :4000)
//   Terminal 2: npm run test:load
//
// Or point it at a deployed instance:
//   API_URL=http://localhost:8080 node tests/load/burst-submit.js

const API_URL = process.env.API_URL || "http://localhost:4000";
const TEAM_COUNT = Number(process.env.TEAM_COUNT || 300);
const MAX_CONCURRENCY = Math.max(1, Number(process.env.MAX_CONCURRENCY || TEAM_COUNT));

function extractCookie(res) {
  const raw = res.headers.get("set-cookie");
  return raw ? raw.split(";")[0] : "";
}

async function simulateTeam(i) {
  const teamName = `Load Team ${i} ${Date.now()}`; // unique per run
  const password = "loadtestpassword123";

  const regStart = Date.now();
  const regRes = await fetch(`${API_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ teamName, password }),
  });
  const regDurationMs = Date.now() - regStart;
  if (!regRes.ok) return { registerStatus: regRes.status, submitStatus: null, regDurationMs, subDurationMs: null };

  const cookie = extractCookie(regRes);
  const payload = {
    githubUrl: `https://github.com/load-team-${i}/gridlock`,
    ...(i % 3 === 0 ? { driveUrl: `https://drive.google.com/drive/folders/${i}` } : {}),
  };

  const subStart = Date.now();
  const subRes = await fetch(`${API_URL}/api/submissions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(payload),
  });
  const subDurationMs = Date.now() - subStart;

  return { registerStatus: regRes.status, submitStatus: subRes.status, regDurationMs, subDurationMs };
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

async function main() {
  console.log(`Firing ${TEAM_COUNT} register+submit pairs at ${API_URL} (max ${MAX_CONCURRENCY} in flight) ...`);

  const healthBefore = await fetch(`${API_URL}/api/health`).then((r) => r.json());
  console.log("Pool before:", healthBefore.pool);

  const start = Date.now();
  const results = [];
  let nextTeam = 0;
  async function worker() {
    while (nextTeam < TEAM_COUNT) {
      const team = nextTeam;
      nextTeam += 1;
      try {
        results.push({ status: "fulfilled", value: await simulateTeam(team) });
      } catch (reason) {
        results.push({ status: "rejected", reason });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENCY, TEAM_COUNT) }, () => worker()));
  const totalMs = Date.now() - start;

  const regStatuses = {};
  const subStatuses = {};
  const regDurations = [];
  const subDurations = [];
  let crashed = 0;

  for (const r of results) {
    if (r.status !== "fulfilled") {
      crashed++;
      continue;
    }
    const { registerStatus, submitStatus, regDurationMs, subDurationMs } = r.value;
    regStatuses[registerStatus] = (regStatuses[registerStatus] || 0) + 1;
    regDurations.push(regDurationMs);
    if (submitStatus !== null) {
      subStatuses[submitStatus] = (subStatuses[submitStatus] || 0) + 1;
      subDurations.push(subDurationMs);
    }
  }

  regDurations.sort((a, b) => a - b);
  subDurations.sort((a, b) => a - b);

  const healthAfter = await fetch(`${API_URL}/api/health`).then((r) => r.json());

  console.log("\n=== RESULTS ===");
  console.log(`Total wall time for ${TEAM_COUNT} concurrent teams: ${totalMs}ms`);
  console.log("Register status breakdown:", regStatuses);
  console.log("Submit status breakdown:", subStatuses);
  console.log(`Register latency (ms) — p50: ${percentile(regDurations, 50)}, p95: ${percentile(regDurations, 95)}, max: ${regDurations[regDurations.length - 1]}`);
  console.log(`Submit latency (ms) — p50: ${percentile(subDurations, 50)}, p95: ${percentile(subDurations, 95)}, max: ${subDurations[subDurations.length - 1]}`);
  console.log("Pool after:", healthAfter.pool);
  if (crashed) console.log(`${crashed} requests crashed (network error, not an HTTP response)`);

  const registerSuccess = regStatuses["201"] || 0;
  const submitSuccess = subStatuses["200"] || 0;
  console.log(`\n${registerSuccess}/${TEAM_COUNT} registrations succeeded, ${submitSuccess}/${TEAM_COUNT} submissions succeeded`);

  process.exit(registerSuccess === TEAM_COUNT && submitSuccess === TEAM_COUNT ? 0 : 1);
}

main().catch((err) => {
  console.error("Load test crashed:", err);
  process.exit(1);
});
