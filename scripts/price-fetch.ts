/**
 * CLI: Run weekly Naver Shopping price fetch batch
 * Usage: npm run price:fetch
 */

import { runPriceFetchBatch } from "../src/lib/price/naver-fetch";

async function main() {
  const limit = process.argv[2] ? parseInt(process.argv[2]) : undefined;
  await runPriceFetchBatch({ limit });
  process.exit(0);
}

main().catch((err) => {
  console.error("[Price Fetch] Error:", err);
  process.exit(1);
});
