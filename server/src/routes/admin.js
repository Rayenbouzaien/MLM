import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { pool } from "../db.js";
import { setAdminSessionCookie, clearAdminSessionCookie, clearTeamSessionCookie, hashPassword, requireAdmin, timingSafeStringEqual } from "../auth.js";
import { emit } from "../live.js";
import { clusterSnapshot } from "../metrics.js";

const router = Router();

if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 8) {
  throw new Error("ADMIN_PASSWORD env var is missing or too short (need 8+ chars).");
}

// A single shared admin account is a much higher-value brute-force
// target than any one team's account, so this stays tight regardless
// of the shared-venue-IP lesson learned earlier — legitimate admins
// don't need 200 login attempts in 10 minutes.
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please wait before trying again." },
});

router.post("/login", adminLoginLimiter, (req, res) => {
  const parsed = z.object({ password: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success || !timingSafeStringEqual(parsed.data.password, process.env.ADMIN_PASSWORD)) {
    return res.status(401).json({ error: "Incorrect password." });
  }
  clearTeamSessionCookie(res);
  setAdminSessionCookie(res, { role: "admin" });
  res.json({ success: true });
});

router.post("/logout", (req, res) => {
  clearAdminSessionCookie(res);
  res.json({ success: true });
});

router.get("/me", requireAdmin, (req, res) => {
  res.json({ admin: true });
});

// The public Challenge Board intentionally does not expose which teams entered
// which challenge. Race Control needs that operational view to manage the event.
// Cluster-wide runtime metrics for the Scalability dashboard.
router.get("/scalability", requireAdmin, async (req, res, next) => {
  try {
    res.json(await clusterSnapshot());
  } catch (err) {
    next(err);
  }
});

router.get("/challenges", requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.title, c.description, c.deliverables, c.color, c.image_key, c.sort_order,
              COALESCE(
                json_agg(json_build_object('id', t.id, 'teamName', t.team_name) ORDER BY tc.selected_at)
                FILTER (WHERE t.id IS NOT NULL),
                '[]'::json
              ) AS selected_teams
       FROM challenges c
       LEFT JOIN team_challenges tc ON tc.challenge_id = c.id
       LEFT JOIN teams t ON t.id = tc.team_id
       GROUP BY c.id
       ORDER BY c.sort_order ASC, c.created_at ASC`,
    );
    res.json({ challenges: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/teams — every team, plus whether they've submitted.
router.get("/teams", requireAdmin, async (req, res) => {
  const result = await pool.query(
    `SELECT t.id, t.team_name, t.banned, t.created_at,
            s.github_url, s.drive_url, s.submitted_at
     FROM teams t
     LEFT JOIN submissions s ON s.team_id = t.id
     ORDER BY t.created_at DESC`,
  );
  res.json({ teams: result.rows });
});

const teamCredentialsSchema = z.object({
  teamName: z.string().trim().min(2).max(100),
  password: z.string().min(8).max(200),
});

router.post("/teams", requireAdmin, async (req, res, next) => {
  const parsed = teamCredentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid team name or password." });
  }
  try {
    const passwordHash = await hashPassword(parsed.data.password);
    const result = await pool.query(
      "INSERT INTO teams (team_name, password_hash) VALUES ($1, $2) RETURNING id, team_name",
      [parsed.data.teamName, passwordHash],
    );
    const team = result.rows[0];
    emit({ type: "team_joined", teamName: team.team_name, at: new Date().toISOString() });
    emit({ type: "data_changed", resource: "teams", at: new Date().toISOString() });
    return res.status(201).json({ team: { id: team.id, teamName: team.team_name } });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "That team name is already taken." });
    }
    return next(err);
  }
});

router.patch("/teams/:id/ban", requireAdmin, async (req, res) => {
  const parsed = z.object({ banned: z.boolean() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Body must be { banned: boolean }" });
  const result = await pool.query(
    "UPDATE teams SET banned = $1 WHERE id = $2 RETURNING id, team_name, banned",
    [parsed.data.banned, req.params.id],
  );
  if (result.rows.length === 0) return res.status(404).json({ error: "Team not found" });
  emit({ type: "data_changed", resource: "teams", at: new Date().toISOString() });
  if (result.rows[0].banned) {
    emit({ type: "team_access_revoked", teamId: String(result.rows[0].id), at: new Date().toISOString() });
  }
  res.json({ team: result.rows[0] });
});

router.delete("/teams/:id", requireAdmin, async (req, res) => {
  const result = await pool.query("DELETE FROM teams WHERE id = $1 RETURNING id", [req.params.id]);
  if (result.rows.length === 0) return res.status(404).json({ error: "Team not found" });
  emit({ type: "team_access_revoked", teamId: String(result.rows[0].id), at: new Date().toISOString() });
  emit({ type: "data_changed", resource: "teams", at: new Date().toISOString() });
  res.json({ success: true });
});

router.get("/submissions", requireAdmin, async (req, res) => {
  const result = await pool.query(
    `SELECT s.id, t.team_name, s.github_url, s.drive_url, s.submitted_at, s.updated_at
     FROM submissions s JOIN teams t ON t.id = s.team_id
     ORDER BY s.submitted_at DESC`,
  );
  res.json({ count: result.rowCount, submissions: result.rows });
});

export default router;
