/**
 * G2B OpenAPI ETL — ShoppingMallPrdctInfoService05
 *
 * Base URL: http://apis.data.go.kr/1230000/at/ShoppingMallPrdctInfoService05
 *
 * Operations covered:
 *  - getMASCntrctPrdctInfoList   (다수공급자계약 품목)
 *  - getUcntrctPrdctInfoList     (일반단가계약 품목)
 *  - getThptyUcntrctPrdctInfoList (제3자단가계약 품목)
 *  - getDlvrReqInfoList          (납품요구정보 → delivery_records)
 *
 * Requires env:
 *  G2B_API_KEY  — data.go.kr 공공데이터포털 서비스키 (decoded)
 */

import db from "@/lib/db/client";
import esClient, { INDEX_PRODUCTS } from "@/lib/es/client";
import { normalizeProductName } from "./normalizer";

// ---------------------------------------------------------------
// Constants
// ---------------------------------------------------------------

const BASE_URL =
  "http://apis.data.go.kr/1230000/at/ShoppingMallPrdctInfoService05";

const DEFAULT_PAGE_SIZE = 1000; // API max per page
const REQUEST_DELAY_MS = 200;   // polite rate limit between pages
const MAX_RETRIES = 3;

// ---------------------------------------------------------------
// API Response Types
// ---------------------------------------------------------------

interface ApiResponse {
  response: {
    header: { resultCode: string; resultMsg: string };
    body: {
      items: unknown;
      numOfRows: number;
      pageNo: number;
      totalCount: number;
    };
  };
}

/** 다수공급자계약 / 일반단가계약 / 제3자단가계약 공통 품목 필드 */
interface G2bProductItem {
  prdctIdntNo?: string;      // 물품식별번호 → g2b_product_id
  shopngCntrctNo?: string;   // 쇼핑계약번호
  shopngCntrctSno?: string;  // 쇼핑계약순번
  cntrctCorpNm?: string;     // 계약업체명
  bizrno?: string;           // 사업자등록번호 (일부 오퍼레이션에서만 제공)
  entrprsDivNm?: string;     // 기업구분 (중소기업/대기업 등)
  prdctClsfcNo?: string;     // 물품분류번호
  prdctClsfcNoNm?: string;   // 품명
  prdctNm?: string;          // 물품명 (품명과 별도)
  cntrctPrceAmt?: string;    // 계약단가 (원)
  prdctUnit?: string;        // 단위
  prdctStndrd?: string;      // 규격
  prdctSplyRgnNm?: string;   // 공급지역명
  hdoffceLocplc?: string;    // 본사소재지
  cntrctBgnDate?: string;    // 계약시작일 (YYYYMMDD)
  cntrctEndDate?: string;    // 계약종료일 (YYYYMMDD)
  qltyRltnCertInfo?: string; // 품질인증정보
  prefrpurchsObjCertNm?: string; // 우선구매대상인증명
  mnfctTrgtYn?: string;      // 제조대상여부 (Y/N)
  thptyContractYn?: string;  // 제3자단가계약여부
  rgstDt?: string;           // 등록일
  chgDt?: string;            // 변경일
  prdctUrl?: string;         // 나라장터 상품 URL
}

/** 납품요구정보 */
interface G2bDeliveryItem {
  dlvrReqNo?: string;        // 납품요구번호
  shopngCntrctNo?: string;   // 쇼핑계약번호
  rcvrOrgnNm?: string;       // 수요기관명 (구매기관)
  rcvrOrgnRgnNm?: string;    // 수요기관 지역
  dlvrReqDt?: string;        // 납품요구일 (YYYYMMDD)
  dlvrPrvntncDt?: string;    // 납품기한일
  totlAmt?: string;          // 납품요구총액
  prdctIdntNo?: string;      // 물품식별번호
  bizrno?: string;           // 공급업체 사업자등록번호
  cntrctCorpNm?: string;     // 공급업체명
  dlvrReqQty?: string;       // 납품요구수량
  untpc?: string;            // 단가
  dlvrYn?: string;           // 납품완료여부
}

// ---------------------------------------------------------------
// Options
// ---------------------------------------------------------------

export interface G2bFetchOptions {
  /** 조회 시작일 YYYYMMDD (default: 30 days ago) */
  fromDate?: string;
  /** 조회 종료일 YYYYMMDD (default: today) */
  toDate?: string;
  /** 품목분류번호명 키워드 필터 */
  categoryKeyword?: string;
  /** 페이지당 건수 */
  numOfRows?: number;
  /** dry-run: fetch and log only, no DB/ES writes */
  dryRun?: boolean;
}

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function parseDate(s: string | undefined): Date | null {
  if (!s || s.length < 8) return null;
  const y = parseInt(s.slice(0, 4));
  const m = parseInt(s.slice(4, 6)) - 1;
  const d = parseInt(s.slice(6, 8));
  const dt = new Date(y, m, d);
  return isNaN(dt.getTime()) ? null : dt;
}

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  retries = MAX_RETRIES
): Promise<T> {
  let last: unknown;
  for (let i = 1; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      const wait = 1000 * Math.pow(2, i - 1);
      console.warn(`[G2B-API] ${label} failed (attempt ${i}/${retries}), retry in ${wait}ms`);
      if (i < retries) await sleep(wait);
    }
  }
  throw last;
}

function buildUrl(
  operation: string,
  params: Record<string, string | number>
): string {
  const serviceKey = process.env.G2B_API_KEY;
  if (!serviceKey) throw new Error("G2B_API_KEY environment variable is not set");

  const qs = new URLSearchParams({
    ServiceKey: serviceKey,
    type: "json",
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
  });
  return `${BASE_URL}/${operation}?${qs.toString()}`;
}

/** Normalise API item list — handles single object vs array vs empty */
function toArray<T>(items: unknown): T[] {
  if (!items || items === "") return [];
  const obj = items as { item?: T | T[] };
  if (!obj.item) return [];
  return Array.isArray(obj.item) ? obj.item : [obj.item];
}

async function fetchPage<T>(
  operation: string,
  pageNo: number,
  params: Record<string, string | number>
): Promise<{ items: T[]; totalCount: number }> {
  const url = buildUrl(operation, { ...params, pageNo, numOfRows: params.numOfRows ?? DEFAULT_PAGE_SIZE });
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${operation}`);

  const json = (await res.json()) as ApiResponse;
  const body = json.response?.body;
  if (!body) throw new Error(`Unexpected API response shape from ${operation}`);

  const header = json.response?.header;
  if (header?.resultCode !== "00") {
    throw new Error(`API error ${header?.resultCode}: ${header?.resultMsg}`);
  }

  return {
    items: toArray<T>(body.items),
    totalCount: body.totalCount ?? 0,
  };
}

/** Fetch all pages of a given operation */
async function fetchAll<T>(
  operation: string,
  extraParams: Record<string, string | number> = {}
): Promise<T[]> {
  const numOfRows = extraParams.numOfRows ?? DEFAULT_PAGE_SIZE;
  const firstPage = await withRetry(
    () => fetchPage<T>(operation, 1, { ...extraParams, numOfRows }),
    `${operation} page 1`
  );

  const all: T[] = [...firstPage.items];
  const totalPages = Math.ceil(firstPage.totalCount / Number(numOfRows));
  console.log(`[G2B-API] ${operation}: totalCount=${firstPage.totalCount}, pages=${totalPages}`);

  for (let page = 2; page <= totalPages; page++) {
    await sleep(REQUEST_DELAY_MS);
    const { items } = await withRetry(
      () => fetchPage<T>(operation, page, { ...extraParams, numOfRows }),
      `${operation} page ${page}`
    );
    all.push(...items);
    if (page % 10 === 0) console.log(`[G2B-API] ${operation}: fetched page ${page}/${totalPages}`);
  }

  return all;
}

// ---------------------------------------------------------------
// DB / ES helpers — ETL log
// ---------------------------------------------------------------

async function startEtlLog(runType: string, source: string): Promise<string> {
  const row = await db.one(
    `INSERT INTO etl_run_log (run_type, source, status) VALUES ($1, $2, 'running') RETURNING id`,
    [runType, source]
  );
  return row.id as string;
}

async function finishEtlLog(
  logId: string,
  status: "success" | "failed" | "partial",
  stats: { total: number; ok: number; failed: number },
  errorMessage?: string
): Promise<void> {
  await db.none(
    `UPDATE etl_run_log
     SET status=$2, finished_at=NOW(),
         records_total=$3, records_ok=$4, records_failed=$5, error_message=$6
     WHERE id=$1`,
    [logId, status, stats.total, stats.ok, stats.failed, errorMessage ?? null]
  );
}

// ---------------------------------------------------------------
// Product ingest (다수공급자 / 일반단가 / 제3자단가)
// ---------------------------------------------------------------

function mapProductItem(item: G2bProductItem): {
  vendor: Record<string, unknown>;
  product: Record<string, unknown>;
  contract: Record<string, unknown>;
} {
  const rawName = item.prdctNm ?? item.prdctClsfcNoNm ?? "";
  const { normalizedName, parsedSpec } = normalizeProductName(rawName);

  // Build a synthetic biz_reg_no when API doesn't supply one
  const bizRegNo = (item.bizrno?.trim() || null) ??
    `SYN-${(item.cntrctCorpNm ?? "UNKNOWN").trim().replace(/\s+/g, "_").slice(0, 50)}`;

  const vendor = {
    biz_reg_no: bizRegNo,
    company_name: (item.cntrctCorpNm ?? "").trim(),
    company_type: (item.entrprsDivNm ?? "").trim() || null,
    is_sme: (item.entrprsDivNm ?? "").includes("중소"),
    region_name: (item.prdctSplyRgnNm ?? "").trim() || null,
    address: (item.hdoffceLocplc ?? "").trim() || null,
    certifications: buildCertifications(item),
  };

  const product = {
    g2b_product_id: (item.prdctIdntNo ?? "").trim(),
    product_name: rawName.trim(),
    normalized_name: normalizedName,
    category_code: (item.prdctClsfcNo ?? "").trim() || null,
    category_name: (item.prdctClsfcNoNm ?? "").trim() || null,
    unit_price: item.cntrctPrceAmt ? parseFloat(item.cntrctPrceAmt.replace(/,/g, "")) : null,
    unit: (item.prdctUnit ?? "").trim() || null,
    spec: (item.prdctStndrd ?? "").trim() || null,
    parsed_spec: parsedSpec,
    g2b_url: (item.prdctUrl ?? "").trim() || null,
  };

  const contract = {
    contract_no: item.shopngCntrctNo
      ? `${item.shopngCntrctNo}-${item.shopngCntrctSno ?? "0"}`
      : null,
    contract_start: parseDate(item.cntrctBgnDate),
    contract_end: parseDate(item.cntrctEndDate),
  };

  return { vendor, product, contract };
}

function buildCertifications(item: G2bProductItem): object[] {
  const certs: object[] = [];
  if (item.qltyRltnCertInfo?.trim()) {
    for (const name of item.qltyRltnCertInfo.split(/[,;/]/)) {
      const n = name.trim();
      if (n) certs.push({ type: "quality", name: n });
    }
  }
  if (item.prefrpurchsObjCertNm?.trim()) {
    for (const name of item.prefrpurchsObjCertNm.split(/[,;/]/)) {
      const n = name.trim();
      if (n) certs.push({ type: "preferred", name: n });
    }
  }
  return certs;
}

async function upsertProductItem(
  item: G2bProductItem,
  dryRun: boolean
): Promise<boolean> {
  const { vendor, product, contract } = mapProductItem(item);

  if (!product.g2b_product_id || !product.product_name || !vendor.biz_reg_no) {
    return false;
  }
  if (dryRun) return true;

  await db.tx(async (t) => {
    // Upsert vendor
    const vendorRow = await t.one(
      `INSERT INTO vendors (biz_reg_no, company_name, company_type, is_sme, region_name, address)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (biz_reg_no) DO UPDATE SET
         company_name = EXCLUDED.company_name,
         company_type = COALESCE(EXCLUDED.company_type, vendors.company_type),
         is_sme       = EXCLUDED.is_sme,
         region_name  = COALESCE(EXCLUDED.region_name, vendors.region_name),
         address      = COALESCE(EXCLUDED.address, vendors.address),
         updated_at   = NOW()
       RETURNING id`,
      [vendor.biz_reg_no, vendor.company_name, vendor.company_type,
       vendor.is_sme, vendor.region_name, vendor.address]
    );

    // Merge certifications (additive)
    if ((vendor.certifications as object[]).length > 0) {
      await t.none(
        `UPDATE vendors
         SET certifications = (
           SELECT jsonb_agg(DISTINCT elem)
           FROM (
             SELECT jsonb_array_elements(certifications) AS elem
             UNION
             SELECT jsonb_array_elements($2::jsonb) AS elem
           ) AS combined
         )
         WHERE id = $1`,
        [vendorRow.id, JSON.stringify(vendor.certifications)]
      );
    }

    // Upsert product
    await t.none(
      `INSERT INTO products (
         g2b_product_id, vendor_id, product_name, normalized_name,
         category_code, category_name, unit_price, unit, spec, parsed_spec,
         g2b_url, last_synced_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
       ON CONFLICT (g2b_product_id) DO UPDATE SET
         vendor_id       = EXCLUDED.vendor_id,
         product_name    = EXCLUDED.product_name,
         normalized_name = EXCLUDED.normalized_name,
         category_code   = COALESCE(EXCLUDED.category_code, products.category_code),
         category_name   = COALESCE(EXCLUDED.category_name, products.category_name),
         unit_price      = COALESCE(EXCLUDED.unit_price, products.unit_price),
         unit            = COALESCE(EXCLUDED.unit, products.unit),
         spec            = COALESCE(EXCLUDED.spec, products.spec),
         parsed_spec     = EXCLUDED.parsed_spec,
         g2b_url         = COALESCE(EXCLUDED.g2b_url, products.g2b_url),
         last_synced_at  = NOW(),
         updated_at      = NOW()`,
      [product.g2b_product_id, vendorRow.id, product.product_name,
       product.normalized_name, product.category_code, product.category_name,
       product.unit_price, product.unit, product.spec,
       JSON.stringify(product.parsed_spec), product.g2b_url]
    );

    // Upsert contract if we have one
    if (contract.contract_no) {
      const productRow = await t.oneOrNone(
        `SELECT id FROM products WHERE g2b_product_id = $1`,
        [product.g2b_product_id]
      );
      if (productRow) {
        await t.none(
          `INSERT INTO contracts (contract_no, vendor_id, product_id, contract_start, contract_end)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (contract_no) DO UPDATE SET
             contract_end = EXCLUDED.contract_end,
             updated_at   = NOW()`,
          [contract.contract_no, vendorRow.id, productRow.id,
           contract.contract_start, contract.contract_end]
        );
      }
    }
  });

  return true;
}

async function bulkIndexProducts(g2bIds: string[]): Promise<void> {
  if (g2bIds.length === 0) return;

  const products = await db.manyOrNone(
    `SELECT p.id, p.g2b_product_id, p.product_name, p.normalized_name,
            p.category_code, p.category_name, p.unit_price, p.unit,
            p.spec, p.is_active, p.updated_at,
            v.id as vendor_id, v.company_name as vendor_name,
            v.region_code, v.region_name, v.supply_regions, v.is_sme,
            va.total_score as activity_score
     FROM products p
     LEFT JOIN vendors v ON p.vendor_id = v.id
     LEFT JOIN vendor_activity va ON va.vendor_id = v.id
     WHERE p.g2b_product_id = ANY($1)`,
    [g2bIds]
  );

  if (products.length === 0) return;

  const operations = products.flatMap((p) => [
    { index: { _index: INDEX_PRODUCTS, _id: p.id } },
    {
      id: p.id,
      g2b_product_id: p.g2b_product_id,
      vendor_id: p.vendor_id,
      vendor_name: p.vendor_name,
      product_name: p.product_name,
      normalized_name: p.normalized_name,
      category_code: p.category_code,
      category_name: p.category_name,
      unit_price: p.unit_price,
      unit: p.unit,
      spec: p.spec,
      region_code: p.region_code,
      region_name: p.region_name,
      supply_regions: p.supply_regions ?? [],
      is_active: p.is_active,
      activity_score: p.activity_score ?? 0,
      has_reference_price: false,
      updated_at: p.updated_at,
    },
  ]);

  const { errors, items } = await esClient.bulk({ operations, refresh: false });
  if (errors) {
    const failed = items.filter((item) => item.index?.error);
    console.warn(`[G2B-API] ES bulk index: ${failed.length} errors`);
  }
}

// ---------------------------------------------------------------
// Delivery records ingest
// ---------------------------------------------------------------

async function upsertDeliveryItem(
  item: G2bDeliveryItem,
  dryRun: boolean
): Promise<boolean> {
  if (!item.dlvrReqNo || !item.cntrctCorpNm) return false;
  if (dryRun) return true;

  const bizRegNo = item.bizrno?.trim() ??
    `SYN-${(item.cntrctCorpNm ?? "UNKNOWN").trim().replace(/\s+/g, "_").slice(0, 50)}`;

  const vendorRow = await db.oneOrNone(
    `SELECT id FROM vendors WHERE biz_reg_no = $1`,
    [bizRegNo]
  );
  if (!vendorRow) return false; // vendor must exist from product ingest

  const productRow = item.prdctIdntNo
    ? await db.oneOrNone(`SELECT id FROM products WHERE g2b_product_id = $1`, [item.prdctIdntNo])
    : null;

  const contractRow = item.shopngCntrctNo
    ? await db.oneOrNone(`SELECT id FROM contracts WHERE contract_no LIKE $1`, [`${item.shopngCntrctNo}-%`])
    : null;

  const deliveryDate = parseDate(item.dlvrReqDt);
  if (!deliveryDate) return false;

  await db.none(
    `INSERT INTO delivery_records
       (vendor_id, product_id, contract_id, buyer_org, buyer_region,
        delivery_date, quantity, unit_price, total_amount)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT DO NOTHING`,
    [
      vendorRow.id,
      productRow?.id ?? null,
      contractRow?.id ?? null,
      (item.rcvrOrgnNm ?? "").trim() || null,
      (item.rcvrOrgnRgnNm ?? "").trim() || null,
      deliveryDate,
      item.dlvrReqQty ? parseInt(item.dlvrReqQty) : null,
      item.untpc ? parseFloat(item.untpc.replace(/,/g, "")) : null,
      item.totlAmt ? parseFloat(item.totlAmt.replace(/,/g, "")) : null,
    ]
  );
  return true;
}

// ---------------------------------------------------------------
// Public API
// ---------------------------------------------------------------

/**
 * Fetch and ingest all product listings from G2B OpenAPI.
 *
 * Covers three contract types:
 *  - 다수공급자계약 (getMASCntrctPrdctInfoList)
 *  - 일반단가계약   (getUcntrctPrdctInfoList)
 *  - 제3자단가계약  (getThptyUcntrctPrdctInfoList)
 */
export async function runApiProductIngest(
  options: G2bFetchOptions = {}
): Promise<void> {
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const fromDate = options.fromDate ?? formatDate(thirtyDaysAgo);
  const toDate = options.toDate ?? formatDate(today);
  const numOfRows = options.numOfRows ?? DEFAULT_PAGE_SIZE;
  const dryRun = options.dryRun ?? false;

  const baseParams: Record<string, string | number> = {
    numOfRows,
    rgstDtBgnDt: fromDate,
    rgstDtEndDt: toDate,
    ...(options.categoryKeyword ? { prdctClsfcNoNm: options.categoryKeyword } : {}),
  };

  const operations = [
    "getMASCntrctPrdctInfoList",
    "getUcntrctPrdctInfoList",
    "getThptyUcntrctPrdctInfoList",
  ] as const;

  for (const operation of operations) {
    const logId = await startEtlLog("api_product_ingest", operation);
    let totalOk = 0;
    let totalFailed = 0;

    try {
      console.log(`[G2B-API] Starting ${operation} (${fromDate}–${toDate})`);
      const items = await fetchAll<G2bProductItem>(operation, baseParams);
      console.log(`[G2B-API] ${operation}: fetched ${items.length} items`);

      const batchSize = 500;
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const g2bIds: string[] = [];

        for (const item of batch) {
          try {
            const ok = await upsertProductItem(item, dryRun);
            if (ok) {
              totalOk++;
              if (item.prdctIdntNo) g2bIds.push(item.prdctIdntNo.trim());
            } else {
              totalFailed++;
            }
          } catch (err) {
            console.error(`[G2B-API] upsert failed for ${item.prdctIdntNo}:`, err);
            totalFailed++;
          }
        }

        // Bulk index this batch into Elasticsearch
        if (!dryRun && g2bIds.length > 0) {
          await bulkIndexProducts(g2bIds).catch((err) =>
            console.warn("[G2B-API] ES index failed for batch:", err)
          );
        }

        console.log(`[G2B-API] ${operation}: processed ${Math.min(i + batchSize, items.length)}/${items.length}`);
      }

      const status = totalFailed === 0 ? "success" : "partial";
      await finishEtlLog(logId, status, { total: items.length, ok: totalOk, failed: totalFailed });
      console.log(`[G2B-API] ${operation} done — ok=${totalOk} failed=${totalFailed}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await finishEtlLog(logId, "failed", { total: 0, ok: totalOk, failed: totalFailed }, msg);
      console.error(`[G2B-API] ${operation} failed:`, err);
      // Continue with next operation instead of aborting entire run
    }
  }
}

/**
 * Fetch and ingest delivery records (납품요구정보).
 * Should be run after runApiProductIngest so vendor/product FKs exist.
 */
export async function runApiDeliveryIngest(
  options: G2bFetchOptions = {}
): Promise<void> {
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const fromDate = options.fromDate ?? formatDate(thirtyDaysAgo);
  const toDate = options.toDate ?? formatDate(today);
  const numOfRows = options.numOfRows ?? DEFAULT_PAGE_SIZE;
  const dryRun = options.dryRun ?? false;

  const logId = await startEtlLog("api_delivery_ingest", "getDlvrReqInfoList");
  let totalOk = 0;
  let totalFailed = 0;

  try {
    console.log(`[G2B-API] Starting getDlvrReqInfoList (${fromDate}–${toDate})`);
    const items = await fetchAll<G2bDeliveryItem>("getDlvrReqInfoList", {
      numOfRows,
      rgstDtBgnDt: fromDate,
      rgstDtEndDt: toDate,
    });
    console.log(`[G2B-API] getDlvrReqInfoList: fetched ${items.length} items`);

    for (const item of items) {
      try {
        const ok = await upsertDeliveryItem(item, dryRun);
        ok ? totalOk++ : totalFailed++;
      } catch (err) {
        console.error(`[G2B-API] delivery upsert failed for ${item.dlvrReqNo}:`, err);
        totalFailed++;
      }
    }

    const status = totalFailed === 0 ? "success" : "partial";
    await finishEtlLog(logId, status, { total: items.length, ok: totalOk, failed: totalFailed });
    console.log(`[G2B-API] getDlvrReqInfoList done — ok=${totalOk} failed=${totalFailed}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await finishEtlLog(logId, "failed", { total: 0, ok: totalOk, failed: totalFailed }, msg);
    console.error("[G2B-API] getDlvrReqInfoList failed:", err);
    throw err;
  }
}

/**
 * Full API-based ingest: products → delivery records → (caller should run scores:recalc after).
 */
export async function runFullApiIngest(options: G2bFetchOptions = {}): Promise<void> {
  await runApiProductIngest(options);
  await runApiDeliveryIngest(options);
}
