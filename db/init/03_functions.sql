-- =============================================================
-- G2B Smart Compare — PostgreSQL Functions & Triggers (v1.0)
-- =============================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all relevant tables
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['vendors', 'products', 'contracts', 'vendor_activity', 'product_mappings']
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS trg_updated_at_%1$s ON %1$s;
            CREATE TRIGGER trg_updated_at_%1$s
                BEFORE UPDATE ON %1$s
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        ', t);
    END LOOP;
END;
$$;

-- Mark older price_references as not latest when new one is inserted
CREATE OR REPLACE FUNCTION mark_old_prices_not_latest()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_latest = TRUE THEN
        UPDATE price_references
        SET is_latest = FALSE
        WHERE product_id = NEW.product_id
          AND id != NEW.id
          AND is_latest = TRUE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_price_latest
    AFTER INSERT ON price_references
    FOR EACH ROW EXECUTE FUNCTION mark_old_prices_not_latest();

-- Function: get latest ETL run for monitoring
CREATE OR REPLACE FUNCTION get_last_successful_etl(run_type_filter TEXT DEFAULT NULL)
RETURNS TABLE (
    run_type    TEXT,
    finished_at TIMESTAMPTZ,
    records_ok  INTEGER,
    hours_ago   NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.run_type::TEXT,
        e.finished_at,
        e.records_ok,
        ROUND(EXTRACT(EPOCH FROM (NOW() - e.finished_at)) / 3600, 1) AS hours_ago
    FROM etl_run_log e
    WHERE e.status = 'success'
      AND (run_type_filter IS NULL OR e.run_type = run_type_filter)
    ORDER BY e.finished_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function: check if data is stale (>24h since last successful ETL)
CREATE OR REPLACE FUNCTION is_data_stale(stale_hours INTEGER DEFAULT 24)
RETURNS BOOLEAN AS $$
DECLARE
    last_run TIMESTAMPTZ;
BEGIN
    SELECT finished_at INTO last_run
    FROM etl_run_log
    WHERE status = 'success' AND run_type = 'bulk_ingest'
    ORDER BY finished_at DESC
    LIMIT 1;

    IF last_run IS NULL THEN
        RETURN TRUE;
    END IF;

    RETURN (NOW() - last_run) > (stale_hours * INTERVAL '1 hour');
END;
$$ LANGUAGE plpgsql;
