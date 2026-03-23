/**
 * CLI script: G2B OpenAPI-based full ingest
 *
 * Usage:
 *   npx tsx scripts/api-ingest.ts [options]
 *
 * Options:
 *   --from YYYYMMDD     조회 시작일 (default: 30일 전)
 *   --to   YYYYMMDD     조회 종료일 (default: 오늘)
 *   --category <keyword> 품목분류명 키워드 필터
 *   --products-only     품목만 수집 (납품요구 제외)
 *   --delivery-only     납품요구만 수집
 *   --dry-run           DB/ES 쓰기 없이 조회만 테스트
 *
 * Requires env: G2B_API_KEY
 */

import { initIndices } from "../src/lib/es/indices";
import { recalculateAllScores } from "../src/lib/etl/activity-score";
import {
  runFullApiIngest,
  runApiProductIngest,
  runApiDeliveryIngest,
  type G2bFetchOptions,
} from "../src/lib/etl/g2b-api-fetch";

function parseArgs(argv: string[]): G2bFetchOptions & {
  productsOnly: boolean;
  deliveryOnly: boolean;
  skipScores: boolean;
} {
  const args = argv.slice(2);
  const opts: G2bFetchOptions & {
    productsOnly: boolean;
    deliveryOnly: boolean;
    skipScores: boolean;
  } = {
    productsOnly: false,
    deliveryOnly: false,
    skipScores: false,
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--from":
        opts.fromDate = args[++i];
        break;
      case "--to":
        opts.toDate = args[++i];
        break;
      case "--category":
        opts.categoryKeyword = args[++i];
        break;
      case "--products-only":
        opts.productsOnly = true;
        break;
      case "--delivery-only":
        opts.deliveryOnly = true;
        break;
      case "--dry-run":
        opts.dryRun = true;
        break;
      case "--skip-scores":
        opts.skipScores = true;
        break;
      default:
        console.warn(`[api-ingest] Unknown argument: ${args[i]}`);
    }
  }
  return opts;
}

async function main() {
  if (!process.env.G2B_API_KEY) {
    console.error("[api-ingest] ERROR: G2B_API_KEY environment variable is not set.");
    console.error("  data.go.kr에서 '나라장터 종합쇼핑몰 품목정보 서비스' API 키를 발급받으세요.");
    console.error("  발급 후 .env.local 파일에 G2B_API_KEY=<your-key> 를 추가하세요.");
    process.exit(1);
  }

  const { productsOnly, deliveryOnly, skipScores, ...fetchOpts } = parseArgs(process.argv);

  console.log("[api-ingest] Options:", {
    ...fetchOpts,
    productsOnly,
    deliveryOnly,
    skipScores,
  });

  // 1. Ensure Elasticsearch indices exist
  if (!fetchOpts.dryRun) {
    console.log("[api-ingest] Initializing Elasticsearch indices...");
    await initIndices();
  }

  // 2. Fetch data from G2B API
  if (deliveryOnly) {
    await runApiDeliveryIngest(fetchOpts);
  } else if (productsOnly) {
    await runApiProductIngest(fetchOpts);
  } else {
    await runFullApiIngest(fetchOpts);
  }

  // 3. Recalculate vendor activity scores
  if (!fetchOpts.dryRun && !skipScores) {
    console.log("[api-ingest] Recalculating vendor activity scores...");
    await recalculateAllScores();
  }

  console.log("[api-ingest] Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[api-ingest] Fatal error:", err);
  process.exit(1);
});
