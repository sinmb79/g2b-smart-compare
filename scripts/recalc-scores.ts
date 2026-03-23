/**
 * CLI: Recalculate all vendor activity scores
 * Usage: npm run scores:recalc
 */

import { recalculateAllScores } from "../src/lib/etl/activity-score";

async function main() {
  console.log("[Scores] Starting recalculation...");
  await recalculateAllScores();
  console.log("[Scores] Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[Scores] Error:", err);
  process.exit(1);
});
