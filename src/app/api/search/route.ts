/**
 * GET /api/search
 *
 * Query params:
 *  q           string   search keyword (required)
 *  category    string   category code filter
 *  region      string   vendor region code filter
 *  supply      string   supply region filter
 *  sme         boolean  SME filter
 *  minPrice    number
 *  maxPrice    number
 *  sort        relevance | price_asc | price_desc | activity_score | newest
 *  page        number   default 1
 *  pageSize    number   default 20 (max 50)
 */

import { NextRequest, NextResponse } from "next/server";
import { searchProducts, getAutocompleteSuggestions } from "@/lib/search/product-search";
import type { SearchParams } from "@/types";

const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 20;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const q = searchParams.get("q") ?? "";
  const autocomplete = searchParams.get("autocomplete") === "true";

  // Autocomplete mode — fast path
  if (autocomplete) {
    try {
      const result = await getAutocompleteSuggestions(q);
      return NextResponse.json(result);
    } catch (err) {
      console.error("[API] Autocomplete error:", err);
      return NextResponse.json({ suggestions: [] });
    }
  }

  // Validate page/pageSize
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1") || 1);
  const rawPageSize = parseInt(searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE)) || DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(rawPageSize, MAX_PAGE_SIZE);

  // Validate sort option
  const sortRaw = searchParams.get("sort");
  const validSorts = ["relevance", "price_asc", "price_desc", "activity_score", "newest"];
  const sortBy = (validSorts.includes(sortRaw ?? "") ? sortRaw : "relevance") as SearchParams["sortBy"];

  // Parse SME filter
  const smeParam = searchParams.get("sme");
  const isSme = smeParam === "true" ? true : smeParam === "false" ? false : undefined;

  const params: SearchParams = {
    query: q,
    categoryCode: searchParams.get("category") ?? undefined,
    regionCode: searchParams.get("region") ?? undefined,
    supplyRegion: searchParams.get("supply") ?? undefined,
    isSme,
    minPrice: searchParams.get("minPrice") ? Number(searchParams.get("minPrice")) : undefined,
    maxPrice: searchParams.get("maxPrice") ? Number(searchParams.get("maxPrice")) : undefined,
    sortBy,
    page,
    pageSize,
  };

  try {
    const result = await searchProducts(params);
    return NextResponse.json({
      data: result,
      meta: {
        lastUpdatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("[API] Search error:", err);
    return NextResponse.json(
      { error: "SEARCH_FAILED", message: "검색 중 오류가 발생했습니다.", statusCode: 500 },
      { status: 500 }
    );
  }
}
