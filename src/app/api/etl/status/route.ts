/**
 * GET /api/etl/status
 * Returns the last ETL run status and data freshness info.
 * Used by the UI to show the "data stale" banner if >24h since last update.
 */

import { NextResponse } from "next/server";
import db from "@/lib/db/client";
import { withCache, cacheKey, TTL } from "@/lib/redis/client";

export async function GET() {
  const key = cacheKey("etl", "status");

  try {
    const status = await withCache(key, TTL.ETL_STATUS, async () => {
      const [lastRun, isStale] = await Promise.all([
        db.oneOrNone(
          `SELECT run_type, status, finished_at, records_ok,
                  ROUND(EXTRACT(EPOCH FROM (NOW() - finished_at)) / 3600, 1) as hours_ago
           FROM etl_run_log
           WHERE status = 'success' AND run_type = 'bulk_ingest'
           ORDER BY finished_at DESC
           LIMIT 1`
        ),
        db.one<{ stale: boolean }>(
          `SELECT is_data_stale(24) as stale`
        ),
      ]);

      return {
        isStale: isStale.stale,
        lastSuccessfulRun: lastRun?.finished_at ?? null,
        hoursAgo: lastRun?.hours_ago ?? null,
        lastRunType: lastRun?.run_type ?? null,
        recordsOk: lastRun?.records_ok ?? null,
      };
    });

    return NextResponse.json({ data: status });
  } catch (err) {
    console.error("[API] ETL status error:", err);
    // Return degraded status rather than 500 — UI can show a generic banner
    return NextResponse.json({
      data: {
        isStale: true,
        lastSuccessfulRun: null,
        hoursAgo: null,
      },
    });
  }
}
