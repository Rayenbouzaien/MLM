import { Router } from "express";
import rateLimit from "express-rate-limit";
import { pool, withRetry } from "../db.js";
import { submissionSchema } from "../validation.js";
import { requireTeam } from "../auth.js";
import { emit } from "../live.js";

const router = Router();

const submitLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many submission attempts. Please wait a moment and try again." },
});

// POST /api/submissions — create or update the CALLER's submission.
// Team identity comes from the session cookie now, not from the request
// body, so one team can no longer overwrite another's by typing their
// name (the v1 hole).
router.post("/", requireTeam, submitLimiter, async (req, res) => {
  const parsed = submissionSchema.omit({ teamName: true }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid submission",
      details: parsed.error.flatten().fieldErrors,
    });
  }
  const { githubUrl, driveUrl } = parsed.data;

  try {
    const result = await withRetry(() =>
      pool.query(
        `INSERT INTO submissions (team_name, team_id, github_url, drive_url)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (team_id)
         DO UPDATE SET github_url = EXCLUDED.github_url, drive_url = EXCLUDED.drive_url, updated_at = now()
         RETURNING id, team_name, github_url, drive_url, submitted_at, updated_at`,
        [req.team.teamName, req.team.id, githubUrl, driveUrl ?? null],
      ),
    );
    emit({ type: "submission", teamName: req.team.teamName, at: new Date().toISOString() });
    return res.status(200).json({ success: true, submission: result.rows[0] });
  } catch (err) {
    console.error("Submission failed:", err);
    return res.status(503).json({ error: "Server is busy right now. Please retry in a few seconds." });
  }
});

// GET /api/submissions/me — the caller's own submission, for prefill.
router.get("/me", requireTeam, async (req, res) => {
  const result = await pool.query(
    `SELECT id, team_name, github_url, drive_url, submitted_at, updated_at
     FROM submissions WHERE team_id = $1`,
    [req.team.id],
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ error: "No submission yet." });
  }
  return res.json(result.rows[0]);
});

export default router;
