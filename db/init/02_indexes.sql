-- =============================================================
-- G2B Smart Compare — PostgreSQL Indexes (v1.0)
-- =============================================================

-- vendors indexes
CREATE INDEX IF NOT EXISTS idx_vendors_biz_reg_no    ON vendors(biz_reg_no);
CREATE INDEX IF NOT EXISTS idx_vendors_region_code   ON vendors(region_code);
CREATE INDEX IF NOT EXISTS idx_vendors_is_active     ON vendors(is_active);
CREATE INDEX IF NOT EXISTS idx_vendors_company_name  ON vendors USING GIN (company_name gin_trgm_ops);

-- products indexes
CREATE INDEX IF NOT EXISTS idx_products_g2b_id       ON products(g2b_product_id);
CREATE INDEX IF NOT EXISTS idx_products_vendor_id    ON products(vendor_id);
CREATE INDEX IF NOT EXISTS idx_products_category     ON products(category_code);
CREATE INDEX IF NOT EXISTS idx_products_is_active    ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_name_trgm    ON products USING GIN (product_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_norm_trgm    ON products USING GIN (normalized_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_unit_price   ON products(unit_price);

-- contracts indexes
CREATE INDEX IF NOT EXISTS idx_contracts_vendor_id   ON contracts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_contracts_product_id  ON contracts(product_id);
CREATE INDEX IF NOT EXISTS idx_contracts_dates       ON contracts(contract_start, contract_end);
CREATE INDEX IF NOT EXISTS idx_contracts_status      ON contracts(status);

-- delivery_records indexes
CREATE INDEX IF NOT EXISTS idx_deliveries_vendor_id  ON delivery_records(vendor_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_product_id ON delivery_records(product_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_date       ON delivery_records(delivery_date);
CREATE INDEX IF NOT EXISTS idx_deliveries_year       ON delivery_records(year);
CREATE INDEX IF NOT EXISTS idx_deliveries_region     ON delivery_records(buyer_region);

-- vendor_activity indexes
CREATE INDEX IF NOT EXISTS idx_activity_vendor_id    ON vendor_activity(vendor_id);
CREATE INDEX IF NOT EXISTS idx_activity_total_score  ON vendor_activity(total_score DESC);

-- product_mappings indexes
CREATE INDEX IF NOT EXISTS idx_mappings_product_id   ON product_mappings(product_id);
CREATE INDEX IF NOT EXISTS idx_mappings_score        ON product_mappings(match_score DESC);
CREATE INDEX IF NOT EXISTS idx_mappings_source       ON product_mappings(external_source);

-- price_references indexes
CREATE INDEX IF NOT EXISTS idx_prices_product_id     ON price_references(product_id);
CREATE INDEX IF NOT EXISTS idx_prices_is_latest      ON price_references(is_latest) WHERE is_latest = TRUE;
CREATE INDEX IF NOT EXISTS idx_prices_fetched_at     ON price_references(fetched_at DESC);

-- etl_run_log indexes
CREATE INDEX IF NOT EXISTS idx_etl_run_type          ON etl_run_log(run_type);
CREATE INDEX IF NOT EXISTS idx_etl_status            ON etl_run_log(status);
CREATE INDEX IF NOT EXISTS idx_etl_started_at        ON etl_run_log(started_at DESC);
