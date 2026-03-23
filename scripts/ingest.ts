/**
 * CLI script: run ETL bulk ingest
 * Usage: npx tsx scripts/ingest.ts <path-to-csv-or-xlsx>
 */

import path from "path";
import { runBulkIngest } from "../src/lib/etl/pipeline";
import { initIndices } from "../src/lib/es/indices";
import { recalculateAllScores } from "../src/lib/etl/activity-score";

async function main() {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error("Usage: npx tsx scripts/ingest.ts <path-to-data-file>");
    console.error("Supported formats: .csv, .xlsx, .xls");
    process.exit(1);
  }

  const absolutePath = path.resolve(filePath);
  console.log(`[Ingest] Starting pipeline for: ${absolutePath}`);

  // 1. Initialize Elasticsearch indices
  console.log("[Ingest] Initializing Elasticsearch indices...");
  await initIndices();

  // 2. Run ETL pipeline
  await runBulkIngest(absolutePath, {
    batchSize: 1000,
    maxRetries: 3,
    retryDelayMs: 1000,
  });

  // 3. Recalculate vendor activity scores
  console.log("[Ingest] Recalculating vendor activity scores...");
  await recalculateAllScores();

  console.log("[Ingest] Pipeline complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[Ingest] Fatal error:", err);
  process.exit(1);
});
