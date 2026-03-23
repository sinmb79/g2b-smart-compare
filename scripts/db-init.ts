/**
 * CLI: Initialize PostgreSQL schema from SQL files
 * Usage: npm run db:init
 *
 * Runs db/init/*.sql files in order against the configured database.
 */

import fs from "fs";
import path from "path";
import db from "../src/lib/db/client";

const SQL_DIR = path.resolve(__dirname, "../db/init");

async function main() {
  const files = fs
    .readdirSync(SQL_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort(); // 01_, 02_, 03_ order

  console.log(`[DB Init] Running ${files.length} SQL files from ${SQL_DIR}`);

  for (const file of files) {
    const filePath = path.join(SQL_DIR, file);
    const sql = fs.readFileSync(filePath, "utf-8");
    console.log(`[DB Init] Executing: ${file}`);
    await db.none(sql);
    console.log(`[DB Init] Done: ${file}`);
  }

  console.log("[DB Init] All schema files applied successfully.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[DB Init] Error:", err);
  process.exit(1);
});
