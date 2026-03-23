/**
 * GET /api/vendors/[id]
 * Returns vendor profile with activity score, delivery history, and product catalog
 */

import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/client";
import { withCache, cacheKey, TTL } from "@/lib/redis/client";

export async function GET(
  req: NextRequest,
  ctx: RouteContext<"/api/vendors/[id]">
) {
  const { id } = await ctx.params;
  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(50, parseInt(searchParams.get("pageSize") ?? "20") || 20);

  if (!id) {
    return NextResponse.json(
      { error: "INVALID_ID", message: "잘못된 업체 ID입니다.", statusCode: 400 },
      { status: 400 }
    );
  }

  const key = cacheKey("vendor", id, page, pageSize);

  try {
    const result = await withCache(key, TTL.VENDOR, async () => {
      const [vendor, activity, products, recentDeliveries] = await Promise.all([
        // Vendor base info
        db.oneOrNone(
          `SELECT id, biz_reg_no, company_name, ceo_name, company_type, is_sme,
                  address, region_code, region_name, supply_regions,
                  phone, email, website, certifications, registration_date,
                  is_active, created_at, updated_at
           FROM vendors WHERE id = $1`,
          [id]
        ),

        // Activity score
        db.oneOrNone(
          `SELECT total_score, delivery_count_score, amount_score,
                  certification_score, contract_duration_score, sme_bonus,
                  delivery_count_3yr, total_amount_3yr, active_contract_months,
                  certification_count, calculated_at
           FROM vendor_activity WHERE vendor_id = $1`,
          [id]
        ),

        // Product catalog (paginated)
        db.manyOrNone(
          `SELECT id, g2b_product_id, product_name, unit_price, unit,
                  category_name, delivery_days, is_active, updated_at
           FROM products WHERE vendor_id = $1 AND is_active = TRUE
           ORDER BY updated_at DESC
           LIMIT $2 OFFSET $3`,
          [id, pageSize, (page - 1) * pageSize]
        ),

        // Recent deliveries (last 10)
        db.manyOrNone(
          `SELECT buyer_org, buyer_region, delivery_date, quantity,
                  total_amount, year
           FROM delivery_records
           WHERE vendor_id = $1
           ORDER BY delivery_date DESC
           LIMIT 10`,
          [id]
        ),
      ]);

      if (!vendor) return null;

      const totalProducts = await db.one<{ count: string }>(
        `SELECT COUNT(*) as count FROM products WHERE vendor_id = $1 AND is_active = TRUE`,
        [id]
      );

      return {
        vendor,
        activity,
        products,
        productTotal: parseInt(totalProducts.count),
        recentDeliveries,
      };
    });

    if (!result) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "업체를 찾을 수 없습니다.", statusCode: 404 },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: {
        id: result.vendor.id,
        bizRegNo: result.vendor.biz_reg_no,
        companyName: result.vendor.company_name,
        ceoName: result.vendor.ceo_name,
        companyType: result.vendor.company_type,
        isSme: result.vendor.is_sme,
        address: result.vendor.address,
        regionCode: result.vendor.region_code,
        regionName: result.vendor.region_name,
        supplyRegions: result.vendor.supply_regions,
        phone: result.vendor.phone,
        email: result.vendor.email,
        website: result.vendor.website,
        certifications: result.vendor.certifications,
        registrationDate: result.vendor.registration_date,
        isActive: result.vendor.is_active,
        updatedAt: result.vendor.updated_at,
        activityScore: result.activity
          ? {
              total: result.activity.total_score,
              deliveryCount: result.activity.delivery_count_score,
              amount: result.activity.amount_score,
              certification: result.activity.certification_score,
              contractDuration: result.activity.contract_duration_score,
              smeBonus: result.activity.sme_bonus,
              deliveryCount3yr: result.activity.delivery_count_3yr,
              totalAmount3yr: result.activity.total_amount_3yr,
              activeContractMonths: result.activity.active_contract_months,
              certificationCount: result.activity.certification_count,
              calculatedAt: result.activity.calculated_at,
              label: "납품활동 지표",
              disclaimer: "이 점수는 참고 지표이며, 공식 평가가 아닙니다.",
            }
          : null,
        products: result.products,
        productTotal: result.productTotal,
        productPage: page,
        productPageSize: pageSize,
        recentDeliveries: result.recentDeliveries,
      },
      meta: {
        lastUpdatedAt: result.vendor.updated_at,
      },
    });
  } catch (err) {
    console.error("[API] Vendor detail error:", err);
    return NextResponse.json(
      { error: "SERVER_ERROR", message: "서버 오류가 발생했습니다.", statusCode: 500 },
      { status: 500 }
    );
  }
}
