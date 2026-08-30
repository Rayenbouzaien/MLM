import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { pool } from "../db.js";
import { setSessionCookie, clearSessionCookie, requireAdmin, timingSafeStringEqual } from "../auth.js";

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
  setSessionCookie(res, { role: "admin" });
  res.json({ success: true });
});

router.post("/logout", (req, res) => {
  clearSessionCookie(res);
  res.json({ success: true });
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

router.patch("/teams/:id/ban", requireAdmin, async (req, res) => {
  const parsed = z.object({ banned: z.boolean() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Body must be { banned: boolean }" });
  const result = await pool.query(
    "UPDATE teams SET banned = $1 WHERE id = $2 RETURNING id, team_name, banned",
    [parsed.data.banned, req.params.id],
  );
  if (result.rows.length === 0) return res.status(404).json({ error: "Team not found" });
  res.json({ team: result.rows[0] });
});

router.delete("/teams/:id", requireAdmin, async (req, res) => {
  const result = await pool.query("DELETE FROM teams WHERE id = $1 RETURNING id", [req.params.id]);
  if (result.rows.length === 0) return res.status(404).json({ error: "Team not found" });
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
