import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAdmin } from "../auth.js";

const router = Router();

const challengeSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().min(1).max(4000),
  deliverables: z.string().trim().max(2000).optional().default(""),
  color: z.string().trim().regex(/^#[0-9a-f]{6}$/i, "Must be a hex color like #E10600").optional().default("#E10600"),
  sortOrder: z.number().int().optional().default(0),
});

router.get("/", async (req, res) => {
  const result = await pool.query(
    `SELECT id, title, description, deliverables, color, sort_order
     FROM challenges ORDER BY sort_order ASC, created_at ASC`,
  );
  res.json({ challenges: result.rows });
});

router.post("/", requireAdmin, async (req, res) => {
  const parsed = challengeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid challenge", details: parsed.error.flatten().fieldErrors });
  }
  const { title, description, deliverables, color, sortOrder } = parsed.data;
  const result = await pool.query(
    `INSERT INTO challenges (title, description, deliverables, color, sort_order)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [title, description, deliverables, color, sortOrder],
  );
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

  const colMap = { title: "title", description: "description", deliverables: "deliverables", color: "color", sortOrder: "sort_order" };
  const setClauses = keys.map((k, i) => `${colMap[k]} = $${i + 2}`);
  const values = keys.map((k) => fields[k]);

  const result = await pool.query(
    `UPDATE challenges SET ${setClauses.join(", ")}, updated_at = now()
     WHERE id = $1 RETURNING *`,
    [req.params.id, ...values],
  );
  if (result.rows.length === 0) return res.status(404).json({ error: "Challenge not found" });
  res.json({ challenge: result.rows[0] });
});

router.delete("/:id", requireAdmin, async (req, res) => {
  const result = await pool.query("DELETE FROM challenges WHERE id = $1 RETURNING id", [req.params.id]);
  if (result.rows.length === 0) return res.status(404).json({ error: "Challenge not found" });
  res.json({ success: true });
});

export default router;
