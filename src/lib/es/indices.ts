/**
 * Elasticsearch index definitions with Korean nori analyzer
 * Run initIndices() once during setup to create index mappings
 */

import esClient, { INDEX_PRODUCTS, INDEX_VENDORS } from "./client";

// Products index mapping with nori Korean analyzer
const PRODUCTS_INDEX_CONFIG = {
  settings: {
    number_of_shards: 1,
    number_of_replicas: 0,
    analysis: {
      analyzer: {
        korean: {
          type: "nori",
          decompound_mode: "mixed",
          stoptags: ["E", "IC", "J", "MAG", "MAJ", "MM", "SP", "SSC", "SSO", "SC", "SE", "XPN", "XSA", "XSN", "XSV", "UNA", "NA", "VSV"],
        },
        korean_search: {
          type: "nori",
          decompound_mode: "mixed",
        },
        autocomplete: {
          type: "custom",
          tokenizer: "autocomplete_tokenizer",
          filter: ["lowercase"],
        },
        autocomplete_search: {
          type: "custom",
          tokenizer: "lowercase",
        },
      },
      tokenizer: {
        autocomplete_tokenizer: {
          type: "edge_ngram",
          min_gram: 1,
          max_gram: 20,
          token_chars: ["letter", "digit"],
        },
      },
      filter: {
        nori_readingform: {
          type: "nori_readingform",
        },
      },
    },
  },
  mappings: {
    properties: {
      id: { type: "keyword" },
      g2b_product_id: { type: "keyword" },
      vendor_id: { type: "keyword" },
      vendor_name: {
        type: "text",
        analyzer: "korean",
        search_analyzer: "korean_search",
        fields: {
          keyword: { type: "keyword", ignore_above: 256 },
          autocomplete: { type: "text", analyzer: "autocomplete", search_analyzer: "autocomplete_search" },
        },
      },
      product_name: {
        type: "text",
        analyzer: "korean",
        search_analyzer: "korean_search",
        fields: {
          keyword: { type: "keyword", ignore_above: 512 },
          autocomplete: { type: "text", analyzer: "autocomplete", search_analyzer: "autocomplete_search" },
        },
      },
      normalized_name: {
        type: "text",
        analyzer: "korean",
        search_analyzer: "korean_search",
      },
      category_code: { type: "keyword" },
      category_name: {
        type: "text",
        analyzer: "korean",
        fields: { keyword: { type: "keyword", ignore_above: 256 } },
      },
      unit_price: { type: "double" },
      unit: { type: "keyword" },
      spec: {
        type: "text",
        analyzer: "korean",
      },
      manufacturer: {
        type: "text",
        analyzer: "korean",
        fields: { keyword: { type: "keyword", ignore_above: 256 } },
      },
      region_code: { type: "keyword" },
      region_name: { type: "keyword" },
      supply_regions: { type: "keyword" },
      is_active: { type: "boolean" },
      activity_score: { type: "float" },
      has_reference_price: { type: "boolean" },
      updated_at: { type: "date" },
    },
  },
};

// Vendors index mapping
const VENDORS_INDEX_CONFIG = {
  settings: {
    number_of_shards: 1,
    number_of_replicas: 0,
    analysis: {
      analyzer: {
        korean: {
          type: "nori",
          decompound_mode: "mixed",
        },
      },
    },
  },
  mappings: {
    properties: {
      id: { type: "keyword" },
      biz_reg_no: { type: "keyword" },
      company_name: {
        type: "text",
        analyzer: "korean",
        fields: {
          keyword: { type: "keyword", ignore_above: 256 },
        },
      },
      company_type: { type: "keyword" },
      is_sme: { type: "boolean" },
      region_code: { type: "keyword" },
      region_name: { type: "keyword" },
      supply_regions: { type: "keyword" },
      certifications: { type: "keyword" },
      total_score: { type: "float" },
      is_active: { type: "boolean" },
      updated_at: { type: "date" },
    },
  },
};

/**
 * Create Elasticsearch indices if they don't exist.
 * Safe to call multiple times (idempotent).
 */
export async function initIndices(): Promise<void> {
  try {
    // Products index
    const productsExists = await esClient.indices.exists({ index: INDEX_PRODUCTS });
    if (!productsExists) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await esClient.indices.create({
        index: INDEX_PRODUCTS,
        ...(PRODUCTS_INDEX_CONFIG as any),
      } as any);
      console.log(`[ES] Created index: ${INDEX_PRODUCTS}`);
    } else {
      console.log(`[ES] Index already exists: ${INDEX_PRODUCTS}`);
    }

    // Vendors index
    const vendorsExists = await esClient.indices.exists({ index: INDEX_VENDORS });
    if (!vendorsExists) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await esClient.indices.create({
        index: INDEX_VENDORS,
        ...(VENDORS_INDEX_CONFIG as any),
      } as any);
      console.log(`[ES] Created index: ${INDEX_VENDORS}`);
    } else {
      console.log(`[ES] Index already exists: ${INDEX_VENDORS}`);
    }
  } catch (error) {
    console.error("[ES] Failed to initialize indices:", error);
    throw error;
  }
}

export { PRODUCTS_INDEX_CONFIG, VENDORS_INDEX_CONFIG };
