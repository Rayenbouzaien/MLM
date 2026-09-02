const API_URL = (process.env.API_URL || "http://localhost:4000").replace(/\/$/, "");
const IDLE_MINUTES = Number(process.env.IDLE_MINUTES || 16);

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function timedHealth(label) {
  const started = performance.now();
  const response = await fetch(`${API_URL}/api/health`, { cache: "no-store" });
  const latencyMs = Math.round(performance.now() - started);
  const body = await response.json().catch(() => ({}));
  console.log(`${label}: ${response.status} in ${latencyMs}ms`, body.pool || body);
  if (!response.ok || body.status !== "ok") throw new Error(`${label} health check failed`);
  return latencyMs;
}

async function main() {
  console.log(`Warming ${API_URL} before ${IDLE_MINUTES} minutes of request-free idle time ...`);
  await timedHealth("Warm-up");
  await delay(IDLE_MINUTES * 60 * 1000);
  const firstRequestMs = await timedHealth("Post-idle first request");
  const warmRequestMs = await timedHealth("Follow-up warm request");
  console.log(`\nCold-start delta: ${firstRequestMs - warmRequestMs}ms`);
}

main().catch((error) => {
  console.error("Cold-start test failed:", error.message);
  process.exitCode = 1;
});