import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { pool, runMigrations } from "../../src/db.js";

const app = createApp();

beforeAll(async () => {
  await runMigrations();
  await pool.query("TRUNCATE teams, submissions, challenges RESTART IDENTITY CASCADE");
});

afterAll(async () => {
  await pool.end();
});

describe("rate limiting", () => {
  it("submissions: allows a realistic single-venue burst from one already-authenticated team", async () => {
    const registerRes = await request(app)
      .post("/api/auth/register")
      .send({ teamName: "Rate Limit Team", password: "password123" })
      .expect(201);
    const cookie = registerRes.headers["set-cookie"][0].split(";")[0];

    const requests = Array.from({ length: 300 }, (_, i) =>
      request(app)
        .post("/api/submissions")
        .set("Cookie", cookie)
        .send({ githubUrl: `https://github.com/rl/${i}` }),
    );
    const responses = await Promise.all(requests);
    expect(responses.filter((r) => r.status === 429)).toHaveLength(0);
    expect(Number(responses[0].headers["ratelimit-limit"])).toBe(1000);
  }, 30000);

  it("admin login: tight ceiling, since it's one high-value shared account rather than 300 independent teams", async () => {
    const res = await request(app).post("/api/admin/login").send({ password: "wrong" });
    expect(Number(res.headers["ratelimit-limit"])).toBe(20);
  });
});
