/**
 * GET /api/products/[id]
 * Returns full product detail including vendor info, activity score, and reference price (if available)
 */

import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/client";
import { withCache, cacheKey, TTL } from "@/lib/redis/client";

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/products/[id]">
) {
  const { id } = await ctx.params;

  if (!id || typeof id !== "string") {
    return NextResponse.json(
      { error: "INVALID_ID", message: "잘못된 상품 ID입니다.", statusCode: 400 },
      { status: 400 }
    );
  }

  const key = cacheKey("product", id);

  try {
    const product = await withCache(key, TTL.PRODUCT, async () => {
      return db.oneOrNone(
        `SELECT
           p.id,
           p.g2b_product_id,
           p.product_name,
           p.normalized_name,
           p.category_code,
           p.category_name,
           p.unit_price,
           p.unit,
           p.spec,
           p.parsed_spec,
           p.manufacturer,
           p.origin,
           p.delivery_days,
           p.min_order_qty,
           p.is_active,
           p.g2b_url,
           p.last_synced_at,
           p.updated_at,
           -- Vendor info
           v.id as vendor_id,
           v.company_name as vendor_name,
           v.company_type,
           v.is_sme,
           v.region_code,
           v.region_name,
           v.supply_regions,
           v.phone,
           v.website,
           v.certifications,
           -- Activity score (참고 지표)
           va.total_score as activity_score,
           va.delivery_count_score,
           va.amount_score,
           va.certification_score,
           va.contract_duration_score,
           va.sme_bonus,
           va.delivery_count_3yr,
           va.total_amount_3yr,
           -- Reference price (참고 가격, beta)
           pr.price as ref_price,
           pr.price_min as ref_price_min,
           pr.price_max as ref_price_max,
           pr.seller_count as ref_seller_count,
           pr.source as ref_source,
           pr.fetched_at as ref_fetched_at,
           pm.match_score as ref_match_score,
           pm.external_name as ref_external_name,
           pm.external_url as ref_external_url
         FROM products p
         LEFT JOIN vendors v ON p.vendor_id = v.id
         LEFT JOIN vendor_activity va ON va.vendor_id = v.id
         LEFT JOIN product_mappings pm
           ON pm.product_id = p.id
           AND pm.match_score >= 0.7
         LEFT JOIN price_references pr
           ON pr.mapping_id = pm.id
           AND pr.is_latest = TRUE
         WHERE p.id = $1
         LIMIT 1`,
        [id]
      );
    });

    if (!product) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "상품을 찾을 수 없습니다.", statusCode: 404 },
        { status: 404 }
      );
    }

    // Shape the response — hide reference price if match score < 0.7
    const hasRefPrice =
      product.ref_price !== null &&
      product.ref_match_score !== null &&
      product.ref_match_score >= 0.7;

    return NextResponse.json({
      data: {
        id: product.id,
        g2bProductId: product.g2b_product_id,
        productName: product.product_name,
        normalizedName: product.normalized_name,
        categoryCode: product.category_code,
        categoryName: product.category_name,
        unitPrice: product.unit_price,
        unit: product.unit,
        spec: product.spec,
        parsedSpec: product.parsed_spec,
        manufacturer: product.manufacturer,
        origin: product.origin,
        deliveryDays: product.delivery_days,
        minOrderQty: product.min_order_qty,
        isActive: product.is_active,
        g2bUrl: product.g2b_url,
        lastSyncedAt: product.last_synced_at,
        updatedAt: product.updated_at,
        vendor: {
          id: product.vendor_id,
          companyName: product.vendor_name,
          companyType: product.company_type,
          isSme: product.is_sme,
          regionCode: product.region_code,
          regionName: product.region_name,
          supplyRegions: product.supply_regions,
          phone: product.phone,
          website: product.website,
          certifications: product.certifications,
        },
        activityScore: product.activity_score
          ? {
              total: product.activity_score,
              deliveryCount: product.delivery_count_score,
              amount: product.amount_score,
              certification: product.certification_score,
              contractDuration: product.contract_duration_score,
              smeBonus: product.sme_bonus,
              deliveryCount3yr: product.delivery_count_3yr,
              totalAmount3yr: product.total_amount_3yr,
              label: "납품활동 지표", // Always include this label
              disclaimer: "이 점수는 참고 지표이며, 공식 평가가 아닙니다.",
            }
          : null,
        // Reference price — only if match score >= 0.7, always labeled as 참고 가격 (Beta)
        referencePrice: hasRefPrice
          ? {
              price: product.ref_price,
              priceMin: product.ref_price_min,
              priceMax: product.ref_price_max,
              sellerCount: product.ref_seller_count,
              source: product.ref_source,
              matchScore: product.ref_match_score,
              externalName: product.ref_external_name,
              externalUrl: product.ref_external_url,
              fetchedAt: product.ref_fetched_at,
              label: "참고 가격", // Must always use this label
              isBeta: true,
              disclaimer: "외부 쇼핑몰 가격은 참고용이며, 구성·조건이 다를 수 있습니다.",
            }
          : null,
      },
      meta: {
        lastUpdatedAt: product.updated_at,
      },
    });
  } catch (err) {
    console.error("[API] Product detail error:", err);
    return NextResponse.json(
      { error: "SERVER_ERROR", message: "서버 오류가 발생했습니다.", statusCode: 500 },
      { status: 500 }
    );
  }
}
