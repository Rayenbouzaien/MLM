import { describe, it, expect, beforeAll, beforeEach, afterAll } from "@jest/globals";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { pool, runMigrations } from "../../src/db.js";

const app = createApp();

beforeAll(async () => {
  await runMigrations();
});

beforeEach(async () => {
  await pool.query("TRUNCATE teams, submissions, challenges RESTART IDENTITY CASCADE");
});

afterAll(async () => {
  await pool.end();
});

async function registeredAgent(teamName) {
  const agent = request.agent(app);
  await agent.post("/api/auth/register").send({ teamName, password: "password123" }).expect(201);
  return agent;
}

describe("POST /api/submissions", () => {
  it("rejects an unauthenticated request", async () => {
    await request(app)
      .post("/api/submissions")
      .send({ githubUrl: "https://github.com/a/b" })
      .expect(401);
  });

  it("creates a submission for the logged-in team", async () => {
    const agent = await registeredAgent("Data Drifters");
    const res = await agent
      .post("/api/submissions")
      .send({ githubUrl: "https://github.com/data-drifters/gridlock" })
      .expect(200);
    expect(res.body.submission.team_name).toBe("Data Drifters");
  });

  it("rejects an invalid github link", async () => {
    const agent = await registeredAgent("Wrong Host Team");
    await agent.post("/api/submissions").send({ githubUrl: "https://gitlab.com/a/b" }).expect(400);
  });

  it("upserts on resubmission (idempotent)", async () => {
    const agent = await registeredAgent("Apex Engineers");
    await agent.post("/api/submissions").send({ githubUrl: "https://github.com/apex/v1" }).expect(200);
    const second = await agent.post("/api/submissions").send({ githubUrl: "https://github.com/apex/v2" }).expect(200);
    expect(second.body.submission.github_url).toBe("https://github.com/apex/v2");

    const { rows } = await pool.query("SELECT * FROM submissions");
    expect(rows).toHaveLength(1);
  });

  it("one team cannot see or overwrite another team's submission (core security fix from v1)", async () => {
    const teamA = await registeredAgent("Team A");
    const teamB = await registeredAgent("Team B");

    await teamA.post("/api/submissions").send({ githubUrl: "https://github.com/team-a/repo" }).expect(200);
    await teamB.post("/api/submissions").send({ githubUrl: "https://github.com/team-b/repo" }).expect(200);

    const meA = await teamA.get("/api/submissions/me").expect(200);
    const meB = await teamB.get("/api/submissions/me").expect(200);

    expect(meA.body.github_url).toBe("https://github.com/team-a/repo");
    expect(meB.body.github_url).toBe("https://github.com/team-b/repo");
  });

  it("handles 20 concurrent submits from the same authenticated team without duplicating rows", async () => {
    const registerRes = await request(app)
      .post("/api/auth/register")
      .send({ teamName: "Circuit Breakers", password: "password123" })
      .expect(201);
    const cookie = registerRes.headers["set-cookie"][0].split(";")[0];

    const requests = Array.from({ length: 20 }, (_, i) =>
      request(app)
        .post("/api/submissions")
        .set("Cookie", cookie)
        .send({ githubUrl: `https://github.com/circuit-breakers/v${i}` }),
    );
    const responses = await Promise.all(requests);
    responses.forEach((res) => expect(res.status).toBe(200));

    const { rows } = await pool.query("SELECT * FROM submissions");
    expect(rows).toHaveLength(1);
  });
});

describe("GET /api/submissions/me", () => {
  it("404s when the team hasn't submitted yet", async () => {
    const agent = await registeredAgent("No Submission Team");
    await agent.get("/api/submissions/me").expect(404);
  });
});
