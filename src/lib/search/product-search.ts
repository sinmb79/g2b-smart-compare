/**
 * Product search engine using Elasticsearch
 *
 * Supports:
 *  - Keyword search (nori Korean analyzer)
 *  - Category filter
 *  - Region filter (vendor location + supply region)
 *  - SME filter
 *  - Price range filter
 *  - Sort: relevance / price_asc / price_desc / activity_score / newest
 *  - Autocomplete suggestions
 */

import esClient, { INDEX_PRODUCTS } from "@/lib/es/client";
import { withCache, cacheKey, TTL } from "@/lib/redis/client";
import type { SearchParams, SearchResult, ProductSearchHit } from "@/types";
import type { Sort, SortOrder } from "@elastic/elasticsearch/lib/api/types";

// ---------------------------------------------------------------
// Query builder
// ---------------------------------------------------------------

function buildSearchQuery(params: SearchParams) {
  const {
    query,
    categoryCode,
    regionCode,
    supplyRegion,
    isSme,
    minPrice,
    maxPrice,
  } = params;

  const filters: unknown[] = [{ term: { is_active: true } }];

  if (categoryCode) filters.push({ term: { category_code: categoryCode } });
  if (regionCode) filters.push({ term: { region_code: regionCode } });
  if (supplyRegion) filters.push({ term: { supply_regions: supplyRegion } });
  if (isSme !== undefined) filters.push({ term: { "vendor.is_sme": isSme } });
  if (minPrice !== undefined || maxPrice !== undefined) {
    const range: Record<string, number> = {};
    if (minPrice !== undefined) range.gte = minPrice;
    if (maxPrice !== undefined) range.lte = maxPrice;
    filters.push({ range: { unit_price: range } });
  }

  // Main search query — multi-field with boost weights
  const mustQuery =
    query.trim().length > 0
      ? {
          multi_match: {
            query: query.trim(),
            fields: [
              "product_name^3",       // highest boost: exact product name
              "normalized_name^2",    // second: normalized name
              "category_name^1.5",
              "spec^1",
              "vendor_name^1",
              "manufacturer^0.8",
            ],
            type: "best_fields",
            operator: "or",
            minimum_should_match: "60%",
            fuzziness: "AUTO",
          },
        }
      : { match_all: {} };

  return {
    query: {
      bool: {
        must: mustQuery,
        filter: filters,
      },
    },
  };
}

function buildSortClause(sortBy: SearchParams["sortBy"]): Sort {
  const asc: SortOrder = "asc";
  const desc: SortOrder = "desc";
  switch (sortBy) {
    case "price_asc":
      return [{ unit_price: { order: asc, missing: "_last" } }, "_score"];
    case "price_desc":
      return [{ unit_price: { order: desc, missing: "_last" } }, "_score"];
    case "activity_score":
      return [{ activity_score: { order: desc } }, "_score"];
    case "newest":
      return [{ updated_at: { order: desc } }, "_score"];
    case "relevance":
    default:
      return ["_score", { activity_score: { order: desc } }];
  }
}

// ---------------------------------------------------------------
// Search
// ---------------------------------------------------------------

/**
 * Search products with Elasticsearch.
 * Results are cached in Redis for TTL.SEARCH seconds.
 */
export async function searchProducts(params: SearchParams): Promise<SearchResult> {
  const { page, pageSize, sortBy } = params;
  const from = (page - 1) * pageSize;

  const key = cacheKey(
    "search",
    params.query,
    params.categoryCode ?? "",
    params.regionCode ?? "",
    params.supplyRegion ?? "",
    String(params.isSme ?? ""),
    String(params.minPrice ?? ""),
    String(params.maxPrice ?? ""),
    sortBy ?? "relevance",
    page,
    pageSize
  );

  return withCache(key, TTL.SEARCH, async () => {
    const startTime = Date.now();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (esClient.search as any)({
      index: INDEX_PRODUCTS,
      from,
      size: pageSize,
      sort: buildSortClause(sortBy),
      _source: [
        "id", "g2b_product_id", "product_name", "category_name",
        "unit_price", "unit", "vendor_id", "vendor_name",
        "region_name", "activity_score", "has_reference_price",
      ],
      ...buildSearchQuery(params),
    });

    const hits = response.hits.hits;
    const total =
      typeof response.hits.total === "number"
        ? response.hits.total
        : (response.hits.total?.value ?? 0);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const products: ProductSearchHit[] = hits.map((hit: any) => {
      const src = hit._source as Record<string, unknown>;
      return {
        id: src.id as string,
        g2bProductId: src.g2b_product_id as string,
        productName: src.product_name as string,
        categoryName: src.category_name as string | undefined,
        unitPrice: src.unit_price as number | undefined,
        unit: src.unit as string | undefined,
        vendorName: src.vendor_name as string | undefined,
        vendorId: src.vendor_id as string | undefined,
        regionName: src.region_name as string | undefined,
        activityScore: src.activity_score as number | undefined,
        hasReferencePrice: (src.has_reference_price as boolean) ?? false,
        score: hit._score ?? 0,
      };
    });

    return {
      products,
      total,
      page,
      pageSize,
      took: Date.now() - startTime,
      query: params.query,
    };
  });
}

// ---------------------------------------------------------------
// Autocomplete
// ---------------------------------------------------------------

export interface AutocompleteResult {
  suggestions: string[];
}

/**
 * Get autocomplete suggestions for the search input.
 * Uses edge-ngram analyzer for fast prefix matching.
 */
export async function getAutocompleteSuggestions(
  query: string,
  limit = 8
): Promise<AutocompleteResult> {
  if (!query || query.trim().length < 1) {
    return { suggestions: [] };
  }

  const key = cacheKey("autocomplete", query.trim().toLowerCase());

  return withCache(key, TTL.AUTOCOMPLETE, async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (esClient.search as any)({
      index: INDEX_PRODUCTS,
      size: limit,
      _source: ["product_name"],
      query: {
        bool: {
          must: {
            match: {
              "product_name.autocomplete": {
                query: query.trim(),
                operator: "and",
              },
            },
          },
          filter: [{ term: { is_active: true } }],
        },
      },
      sort: [{ activity_score: { order: "desc" } }],
    });

    const seen = new Set<string>();
    const suggestions: string[] = [];

    for (const hit of response.hits.hits) {
      const src = hit._source as { product_name: string };
      if (!seen.has(src.product_name)) {
        seen.add(src.product_name);
        suggestions.push(src.product_name);
      }
      if (suggestions.length >= limit) break;
    }

    return { suggestions };
  });
}
