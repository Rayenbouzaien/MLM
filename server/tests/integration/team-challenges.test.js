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

async function createChallenge(title) {
  const { rows } = await pool.query(
    "INSERT INTO challenges (title, description) VALUES ($1, $2) RETURNING id, title",
    [title, `${title} description`],
  );
  return rows[0];
}

describe("team challenge selections", () => {
  it("requires an active team session", async () => {
    await request(app).get("/api/challenges/me").expect(401);
    await request(app).put("/api/challenges/me").send({ challengeIds: [] }).expect(401);
  });

  it("persists multiple selected challenges for the signed-in team", async () => {
    const first = await createChallenge("Telemetry");
    const second = await createChallenge("Fan experience");
    const agent = request.agent(app);
    await agent.post("/api/auth/register").send({ teamName: "Multi Track", password: "password123" }).expect(201);

    const saved = await agent.put("/api/challenges/me").send({ challengeIds: [first.id, second.id] }).expect(200);
    expect(saved.body.challenges.map((challenge) => challenge.id)).toEqual([first.id, second.id]);

    const current = await agent.get("/api/challenges/me").expect(200);
    expect(current.body.challenges.map((challenge) => challenge.title)).toEqual(["Telemetry", "Fan experience"]);
  });

  it("rejects unknown challenge ids without replacing saved selections", async () => {
    const challenge = await createChallenge("Telemetry");
    const agent = request.agent(app);
    await agent.post("/api/auth/register").send({ teamName: "Verified Track", password: "password123" }).expect(201);
    await agent.put("/api/challenges/me").send({ challengeIds: [challenge.id] }).expect(200);

    await agent.put("/api/challenges/me").send({ challengeIds: [challenge.id, "999999"] }).expect(404);
    const current = await agent.get("/api/challenges/me").expect(200);
    expect(current.body.challenges.map((item) => item.id)).toEqual([challenge.id]);
  });
});
