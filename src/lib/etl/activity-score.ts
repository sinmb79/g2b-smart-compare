/**
 * Vendor Activity Score Calculator
 *
 * 100-point scoring system (참고 지표 only — never "trust" or "reliability"):
 *   delivery_count_score    35pts  최근 3년 납품 건수
 *   amount_score            25pts  최근 3년 납품 금액
 *   certification_score     20pts  인증 보유 현황
 *   contract_duration_score 15pts  계약 유지 기간 (월)
 *   sme_bonus               5pts   중소기업 가산
 *
 * Scoring thresholds are based on percentile distribution across all vendors.
 * These are reference indicators — always display with "(참고 지표)" label.
 */

import db from "@/lib/db/client";
import esClient, { INDEX_VENDORS } from "@/lib/es/client";

// Thresholds for percentile-based scoring
const THRESHOLDS = {
  deliveryCount: {
    p90: 500,  // top 10%: 35pts
    p70: 200,  // top 30%: 28pts
    p50: 100,  // top 50%: 21pts
    p30: 50,   // top 70%: 14pts
    p10: 20,   // top 90%: 7pts
    // < p10: 0pts
  },
  amount: {
    // unit: 억원
    p90: 50_000_0000,  // 5억+: 25pts
    p70: 10_000_0000,  // 1억+: 20pts
    p50: 5_000_0000,   // 5천만+: 15pts
    p30: 1_000_0000,   // 1천만+: 10pts
    p10: 100_0000,     // 100만+: 5pts
  },
  contractMonths: {
    p90: 48,  // 4년+: 15pts
    p70: 36,  // 3년+: 12pts
    p50: 24,  // 2년+: 9pts
    p30: 12,  // 1년+: 6pts
    p10: 6,   // 6개월+: 3pts
  },
} as const;

// Certification scoring (cumulative, max 20pts)
const CERTIFICATION_SCORES: Record<string, number> = {
  ISO9001: 4,
  ISO14001: 3,
  ISO45001: 3,
  녹색인증: 3,
  여성기업: 2,
  사회적기업: 2,
  장애인기업: 2,
  벤처기업: 2,
  이노비즈: 2,
  메인비즈: 1,
};

function scoreDeliveryCount(count: number): number {
  const t = THRESHOLDS.deliveryCount;
  if (count >= t.p90) return 35;
  if (count >= t.p70) return 28;
  if (count >= t.p50) return 21;
  if (count >= t.p30) return 14;
  if (count >= t.p10) return 7;
  return 0;
}

function scoreAmount(amount: number): number {
  const t = THRESHOLDS.amount;
  if (amount >= t.p90) return 25;
  if (amount >= t.p70) return 20;
  if (amount >= t.p50) return 15;
  if (amount >= t.p30) return 10;
  if (amount >= t.p10) return 5;
  return 0;
}

function scoreCertifications(certifications: Array<{ type: string }>): number {
  let total = 0;
  for (const cert of certifications) {
    total += CERTIFICATION_SCORES[cert.type] ?? 0;
  }
  return Math.min(total, 20); // cap at 20
}

function scoreContractDuration(months: number): number {
  const t = THRESHOLDS.contractMonths;
  if (months >= t.p90) return 15;
  if (months >= t.p70) return 12;
  if (months >= t.p50) return 9;
  if (months >= t.p30) return 6;
  if (months >= t.p10) return 3;
  return 0;
}

function smeBonusScore(isSme: boolean): number {
  return isSme ? 5 : 0;
}

// ---------------------------------------------------------------
// Database operations
// ---------------------------------------------------------------

interface VendorScoreData {
  vendorId: string;
  isSme: boolean;
  deliveryCount3yr: number;
  totalAmount3yr: number;
  activeContractMonths: number;
  certifications: Array<{ type: string }>;
}

async function fetchVendorData(vendorId: string): Promise<VendorScoreData | null> {
  const threeYearsAgo = new Date();
  threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);

  const row = await db.oneOrNone(
    `SELECT
       v.id as vendor_id,
       v.is_sme,
       v.certifications,
       COUNT(dr.id) FILTER (WHERE dr.delivery_date >= $2) as delivery_count_3yr,
       COALESCE(SUM(dr.total_amount) FILTER (WHERE dr.delivery_date >= $2), 0) as total_amount_3yr,
       COALESCE(
         SUM(
           EXTRACT(MONTH FROM AGE(
             LEAST(c.contract_end, NOW()),
             c.contract_start
           ))
         ) FILTER (WHERE c.status = 'active'), 0
       ) as active_contract_months
     FROM vendors v
     LEFT JOIN delivery_records dr ON dr.vendor_id = v.id
     LEFT JOIN contracts c ON c.vendor_id = v.id
     WHERE v.id = $1
     GROUP BY v.id, v.is_sme, v.certifications`,
    [vendorId, threeYearsAgo.toISOString()]
  );

  if (!row) return null;

  return {
    vendorId: row.vendor_id,
    isSme: row.is_sme,
    deliveryCount3yr: parseInt(row.delivery_count_3yr) || 0,
    totalAmount3yr: parseFloat(row.total_amount_3yr) || 0,
    activeContractMonths: parseFloat(row.active_contract_months) || 0,
    certifications: (row.certifications as Array<{ type: string }>) ?? [],
  };
}

/**
 * Calculate and store activity score for a single vendor.
 */
export async function calculateVendorScore(vendorId: string): Promise<void> {
  const data = await fetchVendorData(vendorId);
  if (!data) {
    console.warn(`[Score] Vendor not found: ${vendorId}`);
    return;
  }

  const deliveryCountScore = scoreDeliveryCount(data.deliveryCount3yr);
  const amountScore = scoreAmount(data.totalAmount3yr);
  const certificationScore = scoreCertifications(data.certifications);
  const contractDurationScore = scoreContractDuration(data.activeContractMonths);
  const smeBonus = smeBonusScore(data.isSme);

  const totalScore =
    deliveryCountScore + amountScore + certificationScore + contractDurationScore + smeBonus;

  await db.none(
    `INSERT INTO vendor_activity (
       vendor_id, total_score, delivery_count_score, amount_score,
       certification_score, contract_duration_score, sme_bonus,
       delivery_count_3yr, total_amount_3yr, active_contract_months,
       certification_count, calculated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
     ON CONFLICT (vendor_id) DO UPDATE SET
       total_score = EXCLUDED.total_score,
       delivery_count_score = EXCLUDED.delivery_count_score,
       amount_score = EXCLUDED.amount_score,
       certification_score = EXCLUDED.certification_score,
       contract_duration_score = EXCLUDED.contract_duration_score,
       sme_bonus = EXCLUDED.sme_bonus,
       delivery_count_3yr = EXCLUDED.delivery_count_3yr,
       total_amount_3yr = EXCLUDED.total_amount_3yr,
       active_contract_months = EXCLUDED.active_contract_months,
       certification_count = EXCLUDED.certification_count,
       calculated_at = NOW(),
       updated_at = NOW()`,
    [
      vendorId, totalScore, deliveryCountScore, amountScore,
      certificationScore, contractDurationScore, smeBonus,
      data.deliveryCount3yr, data.totalAmount3yr, data.activeContractMonths,
      data.certifications.length,
    ]
  );

  // Update Elasticsearch vendor document with new score
  await esClient.update({
    index: INDEX_VENDORS,
    id: vendorId,
    doc: { total_score: totalScore },
    doc_as_upsert: true,
  }).catch((err) => {
    console.warn(`[Score] ES update failed for vendor ${vendorId}:`, err);
  });
}

/**
 * Recalculate activity scores for all vendors (run after bulk ingest).
 */
export async function recalculateAllScores(batchSize = 100): Promise<void> {
  console.log("[Score] Starting batch score recalculation...");

  const vendors = await db.manyOrNone<{ id: string }>(
    `SELECT id FROM vendors WHERE is_active = TRUE ORDER BY id`
  );

  let processed = 0;
  for (let i = 0; i < vendors.length; i += batchSize) {
    const batch = vendors.slice(i, i + batchSize);
    await Promise.allSettled(batch.map((v) => calculateVendorScore(v.id)));
    processed += batch.length;
    console.log(`[Score] Processed ${processed}/${vendors.length} vendors`);
  }

  console.log("[Score] All scores recalculated.");
}
