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

describe("POST /api/auth/register", () => {
  it("creates a team and sets a session cookie", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ teamName: "Apex Engineers", password: "vroomvroom" })
      .expect(201);

    expect(res.body.team.teamName).toBe("Apex Engineers");
    expect(res.headers["set-cookie"]).toBeDefined();
  });

  it("rejects a duplicate team name, case-insensitively", async () => {
    await request(app).post("/api/auth/register").send({ teamName: "Apex Engineers", password: "vroomvroom" }).expect(201);
    const res = await request(app)
      .post("/api/auth/register")
      .send({ teamName: "APEX ENGINEERS", password: "different1" })
      .expect(409);
    expect(res.body.error).toMatch(/already taken/i);
  });

  it("rejects a password shorter than 8 characters", async () => {
    await request(app).post("/api/auth/register").send({ teamName: "Short Pw Team", password: "short" }).expect(400);
  });

  it("never stores the plaintext password", async () => {
    await request(app).post("/api/auth/register").send({ teamName: "Hash Check Team", password: "vroomvroom" }).expect(201);
    const { rows } = await pool.query("SELECT password_hash FROM teams WHERE team_name = 'Hash Check Team'");
    expect(rows[0].password_hash).not.toBe("vroomvroom");
    expect(rows[0].password_hash).toMatch(/^\$2[aby]\$/); // bcrypt hash shape
  });
});

describe("leader and member registration", () => {
  it("creates a leader-owned team with its profile and a member session", async () => {
    const browser = request.agent(app);
    const response = await browser
      .post("/api/auth/leader/register")
      .send({
        teamName: "Night Shift Racing",
        description: "A data-driven endurance crew.",
        logoUrl: "https://images.example.test/night-shift.png",
        displayName: "Mina Driver",
        email: "mina@example.com",
        password: "password123",
      })
      .expect(201);

    expect(response.body.team).toMatchObject({ teamName: "Night Shift Racing", description: "A data-driven endurance crew." });
    expect(response.body.member).toMatchObject({ displayName: "Mina Driver", email: "mina@example.com", role: "leader" });
    await browser.get("/api/auth/me").expect(200);
    const memberProfile = await browser.get("/api/auth/member/me").expect(200);
    expect(memberProfile.body.member).toMatchObject({ role: "leader" });
  });

  it("lets an existing member accept an invitation and join the leader's team", async () => {
    const leader = request.agent(app);
    await leader.post("/api/auth/leader/register").send({
      teamName: "Invite Only Racing", displayName: "Lead Driver", email: "lead@example.com", password: "password123",
    }).expect(201);

    const member = request.agent(app);
    await member.post("/api/auth/member/register").send({
      displayName: "Guest Driver", email: "guest@example.com", password: "password123",
    }).expect(201);

    await leader.post("/api/auth/team/invitations").send({ email: "guest@example.com" }).expect(201);
    const invitations = await member.get("/api/auth/invitations").expect(200);
    expect(invitations.body.invitations).toHaveLength(1);

    await member.post(`/api/auth/invitations/${invitations.body.invitations[0].id}/accept`).expect(200);
    const teamSession = await member.get("/api/auth/me").expect(200);
    expect(teamSession.body.team).toMatchObject({ teamName: "Invite Only Racing" });
    const roster = await leader.get("/api/auth/team/members").expect(200);
    expect(roster.body.members).toEqual(expect.arrayContaining([expect.objectContaining({ email: "guest@example.com", role: "member" })]));
  });
});

describe("POST /api/auth/login", () => {
  beforeEach(async () => {
    await request(app).post("/api/auth/register").send({ teamName: "Grid Lords", password: "correcthorse" });
  });

  it("logs in with correct credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ teamName: "Grid Lords", password: "correcthorse" })
      .expect(200);
    expect(res.body.team.teamName).toBe("Grid Lords");
  });

  it("rejects a wrong password with a generic message", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ teamName: "Grid Lords", password: "wrongpassword" })
      .expect(401);
    expect(res.body.error).toBe("Incorrect team name or password.");
  });

  it("rejects a nonexistent team with the SAME generic message (doesn't leak which teams exist)", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ teamName: "Never Registered", password: "whatever1" })
      .expect(401);
    expect(res.body.error).toBe("Incorrect team name or password.");
  });

  it("blocks a banned team from logging in even with the correct password", async () => {
    await pool.query("UPDATE teams SET banned = true WHERE team_name = 'Grid Lords'");
    const res = await request(app)
      .post("/api/auth/login")
      .send({ teamName: "Grid Lords", password: "correcthorse" })
      .expect(403);
    expect(res.body.error).toMatch(/suspended/i);
  });
});

describe("session lifecycle", () => {
  it("GET /api/auth/me requires a session", async () => {
    await request(app).get("/api/auth/me").expect(401);
  });

  it("logout clears the session so /me stops working", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/register").send({ teamName: "Circuit Breakers", password: "shortcircuit" }).expect(201);
    await agent.get("/api/auth/me").expect(200);
    await agent.post("/api/auth/logout").expect(200);
    await agent.get("/api/auth/me").expect(401);
  });

  it("rejects an already-issued session after the team is banned", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/register").send({ teamName: "Session Revoked", password: "password123" }).expect(201);
    await pool.query("UPDATE teams SET banned = true WHERE team_name = 'Session Revoked'");

    const response = await agent.get("/api/auth/me").expect(403);
    expect(response.body.error).toMatch(/suspended/i);
    expect(response.headers["set-cookie"]).toBeDefined();
  });

  it("keeps a team session and an admin session separate in the same browser", async () => {
    const browser = request.agent(app);
    await browser.post("/api/auth/register").send({ teamName: "Two Roles", password: "password123" }).expect(201);
    await browser.post("/api/admin/login").send({ password: process.env.ADMIN_PASSWORD }).expect(200);

    await browser.get("/api/auth/me").expect(200);
    await browser.get("/api/admin/me").expect(200, { admin: true });

    await browser.post("/api/auth/logout").expect(200);
    await browser.get("/api/auth/me").expect(401);
    await browser.get("/api/admin/me").expect(200, { admin: true });
  });

  it("keeps the admin session active after deleting the matching team", async () => {
    const browser = request.agent(app);
    await browser.post("/api/auth/register").send({ teamName: "Deleted Driver", password: "password123" }).expect(201);
    await browser.post("/api/admin/login").send({ password: process.env.ADMIN_PASSWORD }).expect(200);
    const { rows } = await pool.query("SELECT id FROM teams WHERE team_name = 'Deleted Driver'");

    await browser.delete(`/api/admin/teams/${rows[0].id}`).expect(200);
    await browser.get("/api/auth/me").expect(403);
    await browser.get("/api/admin/me").expect(200, { admin: true });
  });
});
