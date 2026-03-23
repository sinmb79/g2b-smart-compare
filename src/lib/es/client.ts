/**
 * Elasticsearch 8.x client singleton
 * Configured for Korean nori analyzer
 */

import { Client } from "@elastic/elasticsearch";

const ES_URL = process.env.ELASTICSEARCH_URL ?? "http://localhost:9200";

declare global {
  // eslint-disable-next-line no-var
  var __esClient: Client | undefined;
}

const esClient =
  global.__esClient ??
  new Client({
    node: ES_URL,
    requestTimeout: 10000,
    sniffOnStart: false,
  });

if (process.env.NODE_ENV !== "production") {
  global.__esClient = esClient;
}

export const INDEX_PRODUCTS =
  process.env.ELASTICSEARCH_INDEX_PRODUCTS ?? "g2b_products";
export const INDEX_VENDORS =
  process.env.ELASTICSEARCH_INDEX_VENDORS ?? "g2b_vendors";

export default esClient;
