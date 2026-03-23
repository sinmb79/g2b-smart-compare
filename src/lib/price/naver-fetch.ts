/**
 * Naver Shopping API — reference price fetcher
 *
 * Weekly batch: fetch market prices for matched products.
 * Only stores prices for products with TF-IDF match score >= 0.7.
 * All prices are labeled "참고 가격" in the UI — never "comparison" or "savings".
 *
 * Naver Shopping Search API v1:
 *   GET https://openapi.naver.com/v1/search/shop.json
 *   Headers: X-Naver-Client-Id, X-Naver-Client-Secret
 */

import db from "@/lib/db/client";
import { findBestMatch } from "@/lib/matching/tfidf";
import { normalizeProductName } from "@/lib/etl/normalizer";

const NAVER_API_URL = "https://openapi.naver.com/v1/search/shop.json";
const MATCH_THRESHOLD = 0.7;
const BATCH_SIZE = 50;
const REQUEST_DELAY_MS = 100; // rate limiting

interface NaverShopItem {
  title: string;         // product name (HTML-encoded)
  link: string;          // product URL
  image: string;
  lprice: string;        // lowest price
  hprice: string;        // highest price (may be empty)
  mallName: string;
  productId: string;
  productType: string;
  brand: string;
  maker: string;
  category1: string;
  category2: string;
  category3: string;
  category4: string;
}

interface NaverSearchResponse {
  lastBuildDate: string;
  total: number;
  start: number;
  display: number;
  items: NaverShopItem[];
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch top Naver Shopping results for a search query.
 */
async function fetchNaverShopResults(query: string): Promise<NaverShopItem[]> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("NAVER_CLIENT_ID / NAVER_CLIENT_SECRET not configured");
  }

  const url = new URL(NAVER_API_URL);
  url.searchParams.set("query", query);
  url.searchParams.set("display", "10");
  url.searchParams.set("sort", "sim"); // similarity

  const res = await fetch(url.toString(), {
    headers: {
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret,
    },
  });

  if (!res.ok) {
    throw new Error(`Naver API error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as NaverSearchResponse;
  return data.items ?? [];
}

/**
 * Match a 나라장터 product to a Naver Shopping product.
 * Returns null if no match meets the threshold.
 */
async function matchProduct(productId: string, normalizedName: string): Promise<void> {
  const items = await fetchNaverShopResults(normalizedName);
  if (items.length === 0) return;

  const candidateNames = items.map((item) => stripHtml(item.title));
  const best = findBestMatch(normalizedName, candidateNames, MATCH_THRESHOLD);

  if (!best) return;

  const matched = items[best.index];
  const price = parseInt(matched.lprice);
  const hprice = matched.hprice ? parseInt(matched.hprice) : null;

  if (!price || isNaN(price)) return;

  // Upsert product_mappings
  const mapping = await db.one(
    `INSERT INTO product_mappings (
       product_id, external_id, external_source, match_method,
       match_score, external_name, external_url
     ) VALUES ($1, $2, 'naver', 'tfidf', $3, $4, $5)
     ON CONFLICT (product_id, external_id, external_source) DO UPDATE SET
       match_score = EXCLUDED.match_score,
       external_name = EXCLUDED.external_name,
       external_url = EXCLUDED.external_url,
       updated_at = NOW()
     RETURNING id`,
    [productId, matched.productId, best.score, stripHtml(matched.title), matched.link]
  );

  // Mark previous prices as not latest
  await db.none(
    `UPDATE price_references SET is_latest = FALSE
     WHERE product_id = $1 AND is_latest = TRUE`,
    [productId]
  );

  // Insert new price reference
  await db.none(
    `INSERT INTO price_references (
       mapping_id, product_id, price, price_min, price_max,
       seller_count, source, is_latest
     ) VALUES ($1, $2, $3, $4, $5, NULL, 'naver', TRUE)`,
    [mapping.id, productId, price, price, hprice ?? price]
  );
}

/**
 * Run the weekly price fetch batch.
 * Processes products that have been normalized (have a normalized_name).
 * Skips products already fetched within the last 6 days.
 */
export async function runPriceFetchBatch(options: { limit?: number } = {}): Promise<void> {
  const { limit = 5000 } = options;

  console.log("[Price] Starting Naver Shopping price fetch batch...");

  const products = await db.manyOrNone<{ id: string; normalized_name: string }>(
    `SELECT p.id, p.normalized_name
     FROM products p
     WHERE p.normalized_name IS NOT NULL
       AND p.is_active = TRUE
       AND NOT EXISTS (
         SELECT 1 FROM price_references pr
         WHERE pr.product_id = p.id
           AND pr.is_latest = TRUE
           AND pr.fetched_at > NOW() - INTERVAL '6 days'
       )
     ORDER BY p.updated_at DESC
     LIMIT $1`,
    [limit]
  );

  console.log(`[Price] Processing ${products.length} products`);

  let ok = 0;
  let failed = 0;
  let matched = 0;

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(products.length / BATCH_SIZE);
    console.log(`[Price] Batch ${batchNum}/${totalBatches}`);

    for (const product of batch) {
      try {
        const beforeCount = await db.one<{ count: string }>(
          `SELECT COUNT(*) as count FROM price_references WHERE product_id = $1 AND is_latest = TRUE`,
          [product.id]
        );
        await matchProduct(product.id, product.normalized_name);
        const afterCount = await db.one<{ count: string }>(
          `SELECT COUNT(*) as count FROM price_references WHERE product_id = $1 AND is_latest = TRUE`,
          [product.id]
        );
        if (parseInt(afterCount.count) > parseInt(beforeCount.count)) matched++;
        ok++;
        await sleep(REQUEST_DELAY_MS);
      } catch (err) {
        console.warn(`[Price] Failed for product ${product.id}:`, err);
        failed++;
      }
    }
  }

  console.log(`[Price] Done. ok=${ok} matched=${matched} failed=${failed}`);
}
