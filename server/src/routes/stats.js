import { Router } from "express";
import { pool } from "../db.js";
import { getRecent, subscribe } from "../live.js";
import { sseOpened, sseClosed } from "../metrics.js";

const router = Router();

router.get("/stats", async (req, res) => {
  const result = await pool.query(`
    SELECT
      (SELECT count(*) FROM teams WHERE NOT banned) AS team_count,
      (SELECT count(*) FROM submissions) AS submission_count
  `);
  res.json(result.rows[0]);
});

// Public roster: just names + whether they've submitted. No project
// descriptions/tracks collected from teams themselves (YAGNI — nothing
// asked for that data), so this stays honest rather than inventing flavor text.
router.get("/teams", async (req, res) => {
  const result = await pool.query(`
    SELECT t.team_name, t.description, t.logo_url, (s.id IS NOT NULL) AS submitted
    FROM teams t
    LEFT JOIN submissions s ON s.team_id = t.id
    WHERE NOT t.banned
    ORDER BY t.created_at DESC
  `);
  res.json({ teams: result.rows });
});

// Server-Sent Events: pushes team_joined / submission events live to
// the Paddock's "Pit Wall Feed" instead of static mock data.
router.get("/live", async (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // tell nginx not to buffer the stream
  });

  for (const event of await getRecent()) {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  const unsubscribe = subscribe((event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });

  sseOpened();
  const keepAlive = setInterval(() => res.write(":\n\n"), 25000);

  req.on("close", () => {
    sseClosed();
    clearInterval(keepAlive);
    unsubscribe();
  });
});

export default router;
