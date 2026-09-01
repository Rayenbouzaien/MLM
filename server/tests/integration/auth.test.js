import { describe, it, expect, beforeAll, beforeEach, afterAll } from "@jest/globals";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { pool, runMigrations } from "../../src/db.js";

const app = createApp();

beforeAll(async () => {
  await runMigrations();
});

beforeEach(async () => {
  await pool.query("TRUNCATE accounts, teams, submissions, challenges RESTART IDENTITY CASCADE");
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

  it("allows a team leader to create a team with a member count and a member to join it", async () => {
    const leader = request.agent(app);
    const create = await leader
      .post("/api/auth/register")
      .send({ teamName: "Apex Crew", password: "validpass1", role: "leader", memberCount: 5 })
      .expect(201);
    expect(create.body.team.teamName).toBe("Apex Crew");

    const member = request.agent(app);
    const join = await member
      .post("/api/auth/register")
      .send({ teamName: "Apex Crew", password: "validpass1", role: "member" })
      .expect(201);
    expect(join.body.team.teamName).toBe("Apex Crew");

    const { rows } = await pool.query("SELECT team_role, member_count FROM teams WHERE team_name = 'Apex Crew'");
    expect(rows[0].team_role).toBe("leader");
    expect(Number(rows[0].member_count)).toBe(5);
  });

  it("never stores the plaintext password", async () => {
    await request(app).post("/api/auth/register").send({ teamName: "Hash Check Team", password: "vroomvroom" }).expect(201);
    const { rows } = await pool.query("SELECT password_hash FROM teams WHERE team_name = 'Hash Check Team'");
    expect(rows[0].password_hash).not.toBe("vroomvroom");
    expect(rows[0].password_hash).toMatch(/^\$2[aby]\$/); // bcrypt hash shape
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

  it("switches from a team session to an admin session in the same browser", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/register").send({ teamName: "Admin Should Not Kick Team", password: "password123" }).expect(201);
    await agent.get("/api/auth/me").expect(200);

    await agent.post("/api/admin/login").send({ password: process.env.ADMIN_PASSWORD }).expect(200);

    await agent.get("/api/auth/me").expect(401);
    await agent.get("/api/admin/me").expect(200);
  });

  it("switches from an admin session to a team session in the same browser", async () => {
    const agent = request.agent(app);
    await agent.post("/api/admin/login").send({ password: process.env.ADMIN_PASSWORD }).expect(200);
    await agent.get("/api/admin/me").expect(200);

    await agent.post("/api/auth/register").send({ teamName: "Team Takes Over", password: "password123" }).expect(201);

    await agent.get("/api/admin/me").expect(401);
    await agent.get("/api/auth/me").expect(200);
  });

  it("creates separate leader and member accounts under one team", async () => {
    const leader = request.agent(app);
    await leader.post("/api/auth/register").send({
      role: "leader", name: "Alice", personalPassword: "alicepass1",
      teamName: "Separate Accounts", teamPassword: "teampass1", memberCount: 2,
    }).expect(201);

    const member = request.agent(app);
    await member.post("/api/auth/register").send({
      role: "member", name: "Bob", personalPassword: "bobpass1",
      teamName: "Separate Accounts", teamPassword: "teampass1",
    }).expect(201);

    const roster = await member.get("/api/auth/me").expect(200);
    expect(roster.body.team.memberName).toBe("Bob");
    expect(roster.body.team.isLeader).toBe(false);
    expect(roster.body.team.members.map((entry) => entry.name)).toEqual(["Alice", "Bob"]);

    const leaderRoster = await leader.get("/api/auth/me").expect(200);
    expect(leaderRoster.body.team.isLeader).toBe(true);
    expect(leaderRoster.body.team.members).toHaveLength(2);
  });

  it("allows only the leader to select a challenge", async () => {
    const leader = request.agent(app);
    await leader.post("/api/auth/register").send({ role: "leader", name: "Lead", personalPassword: "leadpass1", teamName: "Challenge Team", teamPassword: "teampass1", memberCount: 2 }).expect(201);
    const member = request.agent(app);
    await member.post("/api/auth/register").send({ role: "member", name: "Member", personalPassword: "memberpass1", teamName: "Challenge Team", teamPassword: "teampass1" }).expect(201);
    const admin = request.agent(app);
    await admin.post("/api/admin/login").send({ password: process.env.ADMIN_PASSWORD }).expect(200);
    const challenge = await admin.post("/api/challenges").send({ title: "Team Challenge", description: "Build it." }).expect(201);

    await member.put("/api/challenges/me").send({ challengeIds: [String(challenge.body.challenge.id)] }).expect(403);
    await leader.put("/api/challenges/me").send({ challengeIds: [String(challenge.body.challenge.id)] }).expect(200);
  });

  it("lets a leader log out of a team and log back into the same team", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/account/register").send({ name: "Relogin Leader", password: "leaderpass1" }).expect(201);
    await agent.post("/api/auth/team/create").send({ teamName: "Relogin Team", teamPassword: "teampass1", memberCount: 1 }).expect(201);
    await agent.post("/api/auth/logout").expect(200);
    await agent.get("/api/auth/me").expect(401);

    const account = await agent.post("/api/auth/account/login").send({ name: "Relogin Leader", password: "leaderpass1" }).expect(200);
    expect(account.body.teams[0].isLeader).toBe(true);
    await agent.post("/api/auth/team/join").send({ teamName: "Relogin Team", teamPassword: "teampass1" }).expect(200);
    await agent.get("/api/auth/me").expect(200);
  });

  it("allows a leader to create only one team", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/account/register").send({ name: "One Team Leader", password: "leaderpass1" }).expect(201);
    await agent.post("/api/auth/team/create").send({ teamName: "First Team", teamPassword: "teampass1", memberCount: 2 }).expect(201);
    await agent.post("/api/auth/logout").expect(200);
    await agent.post("/api/auth/team/create").send({ teamName: "Second Team", teamPassword: "teampass2", memberCount: 2 }).expect(409);
  });

  it("logs out the account and its active team session", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/account/register").send({ name: "Logout Account", password: "accountpass1" }).expect(201);
    await agent.post("/api/auth/team/create").send({ teamName: "Logout Team", teamPassword: "teampass1", memberCount: 1 }).expect(201);
    await agent.post("/api/auth/account/logout").expect(200);
    await agent.get("/api/auth/account/me").expect(401);
    await agent.get("/api/auth/me").expect(401);
  });
});
