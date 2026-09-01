import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAdmin, requireTeam } from "../auth.js";
import { emit } from "../live.js";

const router = Router();

const challengeSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().min(1).max(4000),
  deliverables: z.string().trim().max(2000).optional().default(""),
  color: z.string().trim().regex(/^#[0-9a-f]{6}$/i, "Must be a hex color like #E10600").optional().default("#E10600"),
  imageKey: z.enum(["strategy", "fan-command", "logistics", "innovation"]).optional().default("strategy"),
  sortOrder: z.number().int().optional().default(0),
});

router.get("/", async (req, res) => {
  const result = await pool.query(
    `SELECT id, title, description, deliverables, color, image_key, sort_order
     FROM challenges ORDER BY sort_order ASC, created_at ASC`,
  );
  res.json({ challenges: result.rows });
});

const selectionsSchema = z.object({
  challengeIds: z.array(z.coerce.string().regex(/^\d+$/)).max(50),
});

router.get("/me", requireTeam, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.title, c.description, c.deliverables, c.color, c.image_key, c.sort_order
       FROM team_challenges tc
       JOIN challenges c ON c.id = tc.challenge_id
       WHERE tc.team_id = $1
       ORDER BY tc.selected_at ASC, c.id ASC`,
      [req.team.id],
    );
    res.json({ challenges: result.rows });
  } catch (err) {
    next(err);
  }
});

router.put("/me", requireTeam, async (req, res, next) => {
  if (!req.team.isLeader) {
    return res.status(403).json({ error: "Only the team leader can select challenges." });
  }
  const parsed = selectionsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "challengeIds must be an array of challenge ids." });
  }

  const challengeIds = [...new Set(parsed.data.challengeIds)];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const available = await client.query(
      "SELECT id FROM challenges WHERE id = ANY($1::bigint[]) FOR KEY SHARE",
      [challengeIds],
    );
    if (available.rowCount !== challengeIds.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "One or more selected challenges no longer exist." });
    }

    await client.query("DELETE FROM team_challenges WHERE team_id = $1", [req.team.id]);
    if (challengeIds.length > 0) {
      await client.query(
        "INSERT INTO team_challenges (team_id, challenge_id) SELECT $1, unnest($2::bigint[])",
        [req.team.id, challengeIds],
      );
    }
    const result = await client.query(
      `WITH selected(id, ordinality) AS (SELECT * FROM unnest($1::bigint[]) WITH ORDINALITY)
       SELECT c.id, c.title, c.description, c.deliverables, c.color, c.image_key, c.sort_order
       FROM selected
       JOIN challenges c ON c.id = selected.id
       ORDER BY selected.ordinality`,
      [challengeIds],
    );
    await client.query("COMMIT");
    emit({ type: "data_changed", resource: "team_challenges", at: new Date().toISOString() });
    return res.json({ challenges: result.rows });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    return next(err);
  } finally {
    client.release();
  }
});

router.post("/", requireAdmin, async (req, res) => {
  const parsed = challengeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid challenge", details: parsed.error.flatten().fieldErrors });
  }
  const { title, description, deliverables, color, imageKey, sortOrder } = parsed.data;
  const result = await pool.query(
    `INSERT INTO challenges (title, description, deliverables, color, image_key, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [title, description, deliverables, color, imageKey, sortOrder],
  );
  emit({ type: "data_changed", resource: "challenges", at: new Date().toISOString() });
  res.status(201).json({ challenge: result.rows[0] });
});

router.patch("/:id", requireAdmin, async (req, res) => {
  const parsed = challengeSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid challenge", details: parsed.error.flatten().fieldErrors });
  }
  const fields = parsed.data;
  const keys = Object.keys(fields);
  if (keys.length === 0) return res.status(400).json({ error: "No fields to update" });

  const colMap = { title: "title", description: "description", deliverables: "deliverables", color: "color", imageKey: "image_key", sortOrder: "sort_order" };
  const setClauses = keys.map((k, i) => `${colMap[k]} = $${i + 2}`);
  const values = keys.map((k) => fields[k]);

  const result = await pool.query(
    `UPDATE challenges SET ${setClauses.join(", ")}, updated_at = now()
     WHERE id = $1 RETURNING *`,
    [req.params.id, ...values],
  );
  if (result.rows.length === 0) return res.status(404).json({ error: "Challenge not found" });
  emit({ type: "data_changed", resource: "challenges", at: new Date().toISOString() });
  res.json({ challenge: result.rows[0] });
});

router.delete("/:id", requireAdmin, async (req, res) => {
  const result = await pool.query("DELETE FROM challenges WHERE id = $1 RETURNING id", [req.params.id]);
  if (result.rows.length === 0) return res.status(404).json({ error: "Challenge not found" });
  emit({ type: "data_changed", resource: "challenges", at: new Date().toISOString() });
  res.json({ success: true });
});

export default router;
