const API_URL = (process.env.API_URL || "http://localhost:4000").replace(/\/$/, "");
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:8080";
const results = [];

function check(condition, message) {
  if (!condition) throw new Error(message);
}

async function call(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { Accept: "application/json", ...options.headers },
  });
  const text = await response.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  return { response, body };
}

async function run(name, test) {
  try {
    await test();
    results.push({ name, status: "PASS" });
  } catch (error) {
    results.push({ name, status: "FAIL", error: error.message });
  }
}

await run("health endpoint", async () => {
  const { response, body } = await call("/api/health");
  check(response.status === 200, `expected 200, got ${response.status}`);
  check(body.status === "ok", `expected status ok, got ${body.status}`);
  check(body.pool && typeof body.pool.total === "number", "pool metrics are missing");
});

await run("public API collections", async () => {
  const [challenges, stats, teams] = await Promise.all([
    call("/api/challenges"),
    call("/api/stats"),
    call("/api/teams"),
  ]);
  check(challenges.response.status === 200 && Array.isArray(challenges.body.challenges), "challenges contract failed");
  check(
    stats.response.status === 200 &&
      Number.isInteger(Number(stats.body.team_count)) &&
      Number.isInteger(Number(stats.body.submission_count)),
    "stats contract failed",
  );
  check(teams.response.status === 200 && Array.isArray(teams.body.teams), "teams contract failed");
});

await run("frontend origin is allowed by CORS", async () => {
  const { response } = await call("/api/challenges", {
    headers: { Origin: FRONTEND_ORIGIN },
  });
  check(response.status === 200, `expected 200, got ${response.status}`);
  check(response.headers.get("access-control-allow-origin") === FRONTEND_ORIGIN, "frontend origin was not allowed");
  check(response.headers.get("access-control-allow-credentials") === "true", "credentialed CORS is not enabled");
});

await run("protected endpoints reject anonymous requests", async () => {
  const [me, submission, admin] = await Promise.all([
    call("/api/auth/me"),
    call("/api/submissions/me"),
    call("/api/admin/me"),
  ]);
  check(me.response.status === 401, `auth/me returned ${me.response.status}`);
  check(submission.response.status === 401, `submissions/me returned ${submission.response.status}`);
  check(admin.response.status === 401, `admin/me returned ${admin.response.status}`);
});

if (process.env.SMOKE_WRITE === "true") {
  await run("disposable registration and submission flow", async () => {
    const teamName = `Smoke Test ${Date.now()}`;
    const registration = await call("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamName, password: "smoke-test-password" }),
    });
    check(registration.response.status === 201, `registration returned ${registration.response.status}`);
    const cookie = registration.response.headers.getSetCookie?.()[0]?.split(";", 1)[0];
    check(cookie, "registration did not set a session cookie");

    const me = await call("/api/auth/me", { headers: { Cookie: cookie } });
    check(me.response.status === 200 && me.body.team?.teamName === teamName, "session was not retained");

    const submission = await call("/api/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ githubUrl: "https://github.com/octocat/Hello-World" }),
    });
    check(submission.response.status === 200, `submission returned ${submission.response.status}`);
  });
}

for (const result of results) {
  console.log(`${result.status} ${result.name}${result.error ? `: ${result.error}` : ""}`);
}

const failures = results.filter((result) => result.status === "FAIL");
if (process.env.SMOKE_WRITE !== "true") {
  console.log("Read-only mode. Set SMOKE_WRITE=true to exercise registration and submission with disposable data.");
}
if (failures.length > 0) process.exitCode = 1;
