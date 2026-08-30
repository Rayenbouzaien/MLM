import "dotenv/config";
import { pool, runMigrations } from "./db.js";

runMigrations()
  .then(() => {
    console.log("Migrations applied.");
    return pool.end();
  })
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
