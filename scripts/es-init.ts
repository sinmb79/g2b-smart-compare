/**
 * CLI: Initialize Elasticsearch indices
 * Usage: npm run es:init
 */

import { initIndices } from "../src/lib/es/indices";

async function main() {
  console.log("[ES Init] Creating Elasticsearch indices...");
  await initIndices();
  console.log("[ES Init] Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[ES Init] Error:", err);
  process.exit(1);
});
