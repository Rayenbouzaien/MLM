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

async function adminAgent() {
  const agent = request.agent(app);
  await agent.post("/api/admin/login").send({ password: process.env.ADMIN_PASSWORD }).expect(200);
  return agent;
}

describe("POST /api/admin/login", () => {
  it("rejects a wrong password", async () => {
    await request(app).post("/api/admin/login").send({ password: "not-it" }).expect(401);
  });

  it("accepts the correct password and sets a session", async () => {
    const agent = await adminAgent();
    // Proven by being able to hit an admin-only route afterward.
    await agent.get("/api/admin/teams").expect(200);
  });

  it("confirms the current admin session without exposing credentials", async () => {
    await request(app).get("/api/admin/me").expect(401);
    const agent = await adminAgent();
    await agent.get("/api/admin/me").expect(200, { admin: true });
  });
});

describe("Challenges CRUD authorization", () => {
  it("GET is public", async () => {
    await request(app).get("/api/challenges").expect(200);
  });

  it("POST requires admin", async () => {
    await request(app)
      .post("/api/challenges")
      .send({ title: "X", description: "Y" })
      .expect(401);
  });

  it("admin can create, update, and delete a challenge", async () => {
    const agent = await adminAgent();

    const created = await agent
      .post("/api/challenges")
      .send({ title: "Predictive Analytics", description: "Build ML models.", color: "#00D2D2", imageKey: "fan-command" })
      .expect(201);
    const id = created.body.challenge.id;
    expect(created.body.challenge.image_key).toBe("fan-command");

    const updated = await agent
      .patch(`/api/challenges/${id}`)
      .send({ title: "Predictive Analytics 2.0", imageKey: "logistics" })
      .expect(200);
    expect(updated.body.challenge.title).toBe("Predictive Analytics 2.0");
    expect(updated.body.challenge.image_key).toBe("logistics");

    const list = await request(app).get("/api/challenges").expect(200);
    expect(list.body.challenges).toHaveLength(1);

    await agent.delete(`/api/challenges/${id}`).expect(200);
    const listAfter = await request(app).get("/api/challenges").expect(200);
    expect(listAfter.body.challenges).toHaveLength(0);
  });

  it("rejects an invalid hex color", async () => {
    const agent = await adminAgent();
    await agent
      .post("/api/challenges")
      .send({ title: "X", description: "Y", color: "not-a-color" })
      .expect(400);
  });

  it("rejects a challenge image outside the curated art library", async () => {
    const agent = await adminAgent();
    await agent
      .post("/api/challenges")
      .send({ title: "X", description: "Y", imageKey: "https://untrusted.example/image.png" })
      .expect(400);
  });

  it("shows Race Control which teams entered each challenge", async () => {
    const admin = await adminAgent();
    const created = await admin
      .post("/api/challenges")
      .send({ title: "Telemetry", description: "Build it." })
      .expect(201);
    const team = request.agent(app);
    await team.post("/api/auth/register").send({ teamName: "Selection Crew", password: "password123" }).expect(201);
    await team.put("/api/challenges/me").send({ challengeIds: [created.body.challenge.id] }).expect(200);

    const response = await admin.get("/api/admin/challenges").expect(200);
    expect(response.body.challenges[0].selected_teams).toEqual([
      expect.objectContaining({ teamName: "Selection Crew" }),
    ]);
  });
});

describe("Team management", () => {
  beforeEach(async () => {
    await request(app).post("/api/auth/register").send({ teamName: "Neural Racers", password: "password123" });
  });

  it("GET /api/admin/teams requires admin", async () => {
    await request(app).get("/api/admin/teams").expect(401);
  });

  it("admin can list teams", async () => {
    const agent = await adminAgent();
    const res = await agent.get("/api/admin/teams").expect(200);
    expect(res.body.teams).toHaveLength(1);
    expect(res.body.teams[0].team_name).toBe("Neural Racers");
  });

  it("admin can add a team without becoming that team", async () => {
    const admin = await adminAgent();
    const created = await admin
      .post("/api/admin/teams")
      .send({ teamName: "Pit Lane Crew", password: "password123" })
      .expect(201);

    expect(created.body.team.teamName).toBe("Pit Lane Crew");
    await admin.get("/api/admin/teams").expect(200);
    const publicTeams = await request(app).get("/api/teams").expect(200);
    expect(publicTeams.body.teams.map((team) => team.team_name)).toContain("Pit Lane Crew");
  });

  it("admin can ban a team, and the ban actually blocks their login", async () => {
    const agent = await adminAgent();
    const { rows } = await pool.query("SELECT id FROM teams WHERE team_name = 'Neural Racers'");
    const teamId = rows[0].id;

    await agent.patch(`/api/admin/teams/${teamId}/ban`).send({ banned: true }).expect(200);

    await request(app)
      .post("/api/auth/login")
      .send({ teamName: "Neural Racers", password: "password123" })
      .expect(403);
  });

  it("admin can delete a team", async () => {
    const agent = await adminAgent();
    const { rows } = await pool.query("SELECT id FROM teams WHERE team_name = 'Neural Racers'");
    await agent.delete(`/api/admin/teams/${rows[0].id}`).expect(200);

    const after = await pool.query("SELECT * FROM teams");
    expect(after.rows).toHaveLength(0);
  });

  it("deleting a team also removes their submission (cascade)", async () => {
    const teamAgent = request.agent(app);
    await teamAgent.post("/api/auth/login").send({ teamName: "Neural Racers", password: "password123" });
    await teamAgent.post("/api/submissions").send({ githubUrl: "https://github.com/neural/racers" }).expect(200);

    const admin = await adminAgent();
    const { rows } = await pool.query("SELECT id FROM teams WHERE team_name = 'Neural Racers'");
    await admin.delete(`/api/admin/teams/${rows[0].id}`).expect(200);

    const subs = await pool.query("SELECT * FROM submissions");
    expect(subs.rows).toHaveLength(0);
  });
});

describe("GET /api/admin/scalability", () => {
  it("requires an admin session", async () => {
    await request(app).get("/api/admin/scalability").expect(401);
  });

  it("returns cluster metrics including this replica and recorded traffic", async () => {
    const agent = await adminAgent();
    await request(app).get("/api/stats").expect(200);
    const res = await agent.get("/api/admin/scalability").expect(200);
    expect(res.body.totals.replicas).toBeGreaterThanOrEqual(1);
    expect(res.body.instances[0]).toHaveProperty("instance");
    expect(res.body.totals.windowRequests).toBeGreaterThan(0);
    expect(res.body.routes[0]).toMatchObject({ route: expect.stringMatching(/^[A-Z]+ \/api/), count: expect.any(Number) });
    expect(res.body.hist.length).toBe(res.body.bucketsMs.length + 1);
  });
});
