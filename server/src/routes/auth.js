import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { pool, withRetry } from "../db.js";
import {
  hashPassword,
  verifyPassword,
  setSessionCookie,
  clearSessionCookie,
  requireTeam,
} from "../auth.js";
import { emit } from "../live.js";

const router = Router();

// Same reasoning as the submissions limiter: hackathon venues share one
// public IP across everyone. A registration burst at event start hits
// this exactly like a submission burst hits the deadline — same fix,
// same ceiling.
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please wait a moment and try again." },
});

const credentialsSchema = z.object({
  teamName: z.string().trim().min(2).max(100),
  password: z.string().min(8).max(200),
});

router.post("/register", authLimiter, async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors });
  }
  const { teamName, password } = parsed.data;

  try {
    const passwordHash = await hashPassword(password);
    const result = await withRetry(() =>
      pool.query(
        `INSERT INTO teams (team_name, password_hash) VALUES ($1, $2)
         RETURNING id, team_name`,
        [teamName, passwordHash],
      ),
    );
    const team = result.rows[0];
    setSessionCookie(res, { role: "team", teamId: team.id, teamName: team.team_name });
    emit({ type: "team_joined", teamName: team.team_name, at: new Date().toISOString() });
    return res.status(201).json({ team: { id: team.id, teamName: team.team_name } });
  } catch (err) {
    if (err.code === "23505") {
      // unique_violation on team_name_key
      return res.status(409).json({ error: "That team name is already taken." });
    }
    console.error("Register failed:", err);
    return res.status(503).json({ error: "Server is busy right now. Please retry." });
  }
});

router.post("/login", authLimiter, async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input" });
  }
  const { teamName, password } = parsed.data;

  try {
    const result = await pool.query(
      `SELECT id, team_name, password_hash, banned FROM teams WHERE team_name_key = lower($1)`,
      [teamName],
    );
    const team = result.rows[0];
    // Same generic message whether the team doesn't exist or the
    // password is wrong — don't leak which teams are registered.
    if (!team || !(await verifyPassword(password, team.password_hash))) {
      return res.status(401).json({ error: "Incorrect team name or password." });
    }
    if (team.banned) {
      return res.status(403).json({ error: "This team has been suspended. Contact an organizer." });
    }
    setSessionCookie(res, { role: "team", teamId: team.id, teamName: team.team_name });
    return res.json({ team: { id: team.id, teamName: team.team_name } });
  } catch (err) {
    console.error("Login failed:", err);
    return res.status(503).json({ error: "Server is busy right now. Please retry." });
  }
});

router.post("/logout", (req, res) => {
  clearSessionCookie(res, "team");
  res.json({ success: true });
});

router.get("/me", requireTeam, (req, res) => {
  res.json({ team: req.team });
});

export default router;
