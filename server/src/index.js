import "dotenv/config";
import { createApp } from "./app.js";
import { pool, runMigrations } from "./db.js";
import { closeLive } from "./live.js";

const app = createApp();
const PORT = process.env.PORT || 4000;

runMigrations()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`API listening on :${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to run migrations:", err);
    process.exit(1);
  });

async function shutdown(signal) {
  console.log(`${signal} received, closing pool...`);
  try {
    await Promise.all([pool.end(), closeLive()]);
  } finally {
    process.exit(0);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
