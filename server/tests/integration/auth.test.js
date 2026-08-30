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
});
