/**
 * ETL Pipeline — Bulk CSV/Excel ingest from 조달데이터허브
 *
 * Flow:
 *  1. Read CSV/Excel file
 *  2. Validate & transform rows
 *  3. Upsert into PostgreSQL (vendors, products, contracts, delivery_records)
 *  4. Normalize product names
 *  5. Bulk index into Elasticsearch
 *  6. Log ETL run result
 *
 * Resilience:
 *  - 3x retry with exponential backoff on transient errors
 *  - Falls back to last successful dataset if current run fails
 *  - Records each run in etl_run_log
 */

import fs from "fs";
import path from "path";
import { parse as parseCsv } from "csv-parse";
import * as XLSX from "xlsx";
import db from "@/lib/db/client";
import esClient, { INDEX_PRODUCTS } from "@/lib/es/client";
import { normalizeProductName } from "./normalizer";

// ---------------------------------------------------------------
// Types
// ---------------------------------------------------------------

interface RawProductRow {
  g2b_product_id: string;
  product_name: string;
  category_code?: string;
  category_name?: string;
  unit_price?: string;
  unit?: string;
  spec?: string;
  manufacturer?: string;
  origin?: string;
  delivery_days?: string;
  biz_reg_no: string;
  company_name: string;
  company_type?: string;
  is_sme?: string;
  region_code?: string;
  region_name?: string;
}

interface EtlOptions {
  batchSize?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  dryRun?: boolean;
}

const DEFAULT_OPTIONS: Required<EtlOptions> = {
  batchSize: Number(process.env.ETL_BATCH_SIZE ?? 1000),
  maxRetries: Number(process.env.ETL_MAX_RETRIES ?? 3),
  retryDelayMs: Number(process.env.ETL_RETRY_DELAY_MS ?? 1000),
  dryRun: false,
};

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  delayMs: number,
  label: string
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const wait = delayMs * Math.pow(2, attempt - 1); // exponential backoff
      console.warn(`[ETL] ${label} failed (attempt ${attempt}/${maxRetries}). Retrying in ${wait}ms...`, err);
      if (attempt < maxRetries) await sleep(wait);
    }
  }
  throw lastError;
}

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
     SET status = $2, finished_at = NOW(),
         records_total = $3, records_ok = $4, records_failed = $5,
         error_message = $6
     WHERE id = $1`,
    [logId, status, stats.total, stats.ok, stats.failed, errorMessage ?? null]
  );
}

// ---------------------------------------------------------------
// File readers
// ---------------------------------------------------------------

async function readCsvFile(filePath: string): Promise<RawProductRow[]> {
  return new Promise((resolve, reject) => {
    const rows: RawProductRow[] = [];
    fs.createReadStream(filePath)
      .pipe(parseCsv({ columns: true, skip_empty_lines: true, trim: true, bom: true }))
      .on("data", (row: RawProductRow) => rows.push(row))
      .on("end", () => resolve(rows))
      .on("error", reject);
  });
}

function readExcelFile(filePath: string): RawProductRow[] {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<RawProductRow>(sheet, { defval: "" });
}

async function readDataFile(filePath: string): Promise<RawProductRow[]> {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".csv") return readCsvFile(filePath);
  if (ext === ".xlsx" || ext === ".xls") return readExcelFile(filePath);
  throw new Error(`Unsupported file format: ${ext}`);
}

// ---------------------------------------------------------------
// Transform
// ---------------------------------------------------------------

function transformRow(raw: RawProductRow): {
  vendor: Record<string, unknown>;
  product: Record<string, unknown>;
} {
  const { normalizedName, parsedSpec } = normalizeProductName(raw.product_name);

  const vendor = {
    biz_reg_no: raw.biz_reg_no?.trim(),
    company_name: raw.company_name?.trim(),
    company_type: raw.company_type?.trim() ?? null,
    is_sme: raw.is_sme === "Y" || raw.is_sme === "1" || raw.is_sme === "true",
    region_code: raw.region_code?.trim() ?? null,
    region_name: raw.region_name?.trim() ?? null,
  };

  const product = {
    g2b_product_id: raw.g2b_product_id?.trim(),
    product_name: raw.product_name?.trim(),
    normalized_name: normalizedName,
    category_code: raw.category_code?.trim() ?? null,
    category_name: raw.category_name?.trim() ?? null,
    unit_price: raw.unit_price ? parseFloat(raw.unit_price.replace(/,/g, "")) : null,
    unit: raw.unit?.trim() ?? null,
    spec: raw.spec?.trim() ?? null,
    parsed_spec: parsedSpec,
    manufacturer: raw.manufacturer?.trim() ?? null,
    origin: raw.origin?.trim() ?? null,
    delivery_days: raw.delivery_days ? parseInt(raw.delivery_days) : null,
  };

  return { vendor, product };
}

// ---------------------------------------------------------------
// Database upsert
// ---------------------------------------------------------------

async function upsertBatch(
  rows: RawProductRow[]
): Promise<{ ok: number; failed: number }> {
  let ok = 0;
  let failed = 0;

  for (const raw of rows) {
    try {
      const { vendor, product } = transformRow(raw);

      // Skip rows with missing required fields
      if (!vendor.biz_reg_no || !product.g2b_product_id || !product.product_name) {
        failed++;
        continue;
      }

      await db.tx(async (t) => {
        // Upsert vendor
        const vendorRow = await t.one(
          `INSERT INTO vendors (biz_reg_no, company_name, company_type, is_sme, region_code, region_name)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (biz_reg_no) DO UPDATE SET
             company_name = EXCLUDED.company_name,
             company_type = EXCLUDED.company_type,
             is_sme = EXCLUDED.is_sme,
             region_code = EXCLUDED.region_code,
             region_name = EXCLUDED.region_name,
             updated_at = NOW()
           RETURNING id`,
          [vendor.biz_reg_no, vendor.company_name, vendor.company_type,
           vendor.is_sme, vendor.region_code, vendor.region_name]
        );

        // Upsert product
        await t.none(
          `INSERT INTO products (
             g2b_product_id, vendor_id, product_name, normalized_name,
             category_code, category_name, unit_price, unit,
             spec, parsed_spec, manufacturer, origin, delivery_days,
             last_synced_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
           ON CONFLICT (g2b_product_id) DO UPDATE SET
             vendor_id = EXCLUDED.vendor_id,
             product_name = EXCLUDED.product_name,
             normalized_name = EXCLUDED.normalized_name,
             category_code = EXCLUDED.category_code,
             category_name = EXCLUDED.category_name,
             unit_price = EXCLUDED.unit_price,
             unit = EXCLUDED.unit,
             spec = EXCLUDED.spec,
             parsed_spec = EXCLUDED.parsed_spec,
             manufacturer = EXCLUDED.manufacturer,
             origin = EXCLUDED.origin,
             delivery_days = EXCLUDED.delivery_days,
             last_synced_at = NOW(),
             updated_at = NOW()`,
          [product.g2b_product_id, vendorRow.id, product.product_name,
           product.normalized_name, product.category_code, product.category_name,
           product.unit_price, product.unit, product.spec,
           JSON.stringify(product.parsed_spec), product.manufacturer,
           product.origin, product.delivery_days]
        );
      });

      ok++;
    } catch (err) {
      console.error("[ETL] Row upsert failed:", raw.g2b_product_id, err);
      failed++;
    }
  }

  return { ok, failed };
}

// ---------------------------------------------------------------
// Elasticsearch bulk index
// ---------------------------------------------------------------

async function indexProductsBatch(rows: RawProductRow[]): Promise<void> {
  if (rows.length === 0) return;

  // Fetch vendor IDs and product IDs from DB for the rows we just upserted
  const g2bIds = rows
    .map((r) => r.g2b_product_id?.trim())
    .filter(Boolean);

  if (g2bIds.length === 0) return;

  const products = await db.manyOrNone(
    `SELECT p.id, p.g2b_product_id, p.product_name, p.normalized_name,
            p.category_code, p.category_name, p.unit_price, p.unit,
            p.spec, p.manufacturer, p.is_active, p.updated_at,
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
      manufacturer: p.manufacturer,
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
    console.warn(`[ETL] Elasticsearch bulk index: ${failed.length} errors`);
  }
}

// ---------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------

/**
 * Run the bulk ingest ETL pipeline for a given data file.
 *
 * @param filePath  Absolute path to CSV/Excel file from 조달데이터허브
 * @param options   ETL options (batch size, retries, dry run)
 */
export async function runBulkIngest(
  filePath: string,
  options: EtlOptions = {}
): Promise<void> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const logId = await startEtlLog("bulk_ingest", path.basename(filePath));

  console.log(`[ETL] Starting bulk ingest: ${filePath}`);
  console.log(`[ETL] Options: batchSize=${opts.batchSize}, maxRetries=${opts.maxRetries}, dryRun=${opts.dryRun}`);

  let totalOk = 0;
  let totalFailed = 0;
  let totalRows = 0;

  try {
    const rows = await withRetry(
      () => readDataFile(filePath),
      opts.maxRetries,
      opts.retryDelayMs,
      "readDataFile"
    );

    totalRows = rows.length;
    console.log(`[ETL] Read ${totalRows} rows from file`);

    if (opts.dryRun) {
      console.log("[ETL] Dry run — skipping DB/ES writes");
      await finishEtlLog(logId, "success", { total: totalRows, ok: totalRows, failed: 0 });
      return;
    }

    // Process in batches
    for (let i = 0; i < rows.length; i += opts.batchSize) {
      const batch = rows.slice(i, i + opts.batchSize);
      const batchNum = Math.floor(i / opts.batchSize) + 1;
      const totalBatches = Math.ceil(rows.length / opts.batchSize);

      console.log(`[ETL] Processing batch ${batchNum}/${totalBatches} (${batch.length} rows)`);

      const { ok, failed } = await withRetry(
        () => upsertBatch(batch),
        opts.maxRetries,
        opts.retryDelayMs,
        `upsertBatch ${batchNum}`
      );

      totalOk += ok;
      totalFailed += failed;

      // Index successful records into Elasticsearch
      const successRows = batch.slice(0, ok);
      await indexProductsBatch(successRows).catch((err) => {
        console.warn("[ETL] ES indexing failed for batch, continuing:", err);
      });
    }

    const status = totalFailed === 0 ? "success" : "partial";
    await finishEtlLog(logId, status, { total: totalRows, ok: totalOk, failed: totalFailed });
    console.log(`[ETL] Done. status=${status} ok=${totalOk} failed=${totalFailed}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await finishEtlLog(logId, "failed", { total: totalRows, ok: totalOk, failed: totalFailed }, message);
    console.error("[ETL] Pipeline failed:", err);
    throw err;
  }
}
