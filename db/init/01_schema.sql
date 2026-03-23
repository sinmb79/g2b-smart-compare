-- =============================================================
-- G2B Smart Compare — PostgreSQL Schema (v1.0)
-- Run order: 01_schema.sql → 02_indexes.sql → 03_functions.sql
-- =============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- for trigram similarity search

-- =============================================================
-- 1. vendors
--    One row per procurement supplier registered in 나라장터
-- =============================================================
CREATE TABLE IF NOT EXISTS vendors (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    biz_reg_no      VARCHAR(20) UNIQUE NOT NULL,   -- 사업자등록번호
    company_name    VARCHAR(255) NOT NULL,
    ceo_name        VARCHAR(100),
    company_type    VARCHAR(50),                    -- 대기업/중소기업/소기업 etc.
    is_sme          BOOLEAN DEFAULT FALSE,          -- 중소기업 여부
    address         TEXT,
    region_code     VARCHAR(10),                    -- 시도 코드
    region_name     VARCHAR(50),                    -- 시도명
    supply_regions  TEXT[],                         -- 공급 가능 지역 코드 배열
    phone           VARCHAR(20),
    email           VARCHAR(255),
    website         VARCHAR(500),
    certifications  JSONB DEFAULT '[]',             -- [{type, name, issued_at, expires_at}]
    registration_date DATE,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- 2. products
--    One row per product listing in the procurement catalog
-- =============================================================
CREATE TABLE IF NOT EXISTS products (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    g2b_product_id  VARCHAR(50) UNIQUE NOT NULL,   -- 나라장터 품목코드
    vendor_id       UUID REFERENCES vendors(id) ON DELETE SET NULL,
    product_name    VARCHAR(500) NOT NULL,
    normalized_name VARCHAR(500),                   -- cleaned for matching
    category_code   VARCHAR(20),                    -- 품목분류코드
    category_name   VARCHAR(200),
    unit_price      NUMERIC(15, 2),                 -- 단가 (원)
    unit            VARCHAR(50),                    -- 단위 (개, 박스, m 등)
    spec            TEXT,                           -- 규격
    parsed_spec     JSONB DEFAULT '{}',             -- {brand, model, capacity, ...}
    manufacturer    VARCHAR(255),
    origin          VARCHAR(100),                   -- 원산지
    delivery_days   INTEGER,                        -- 납기일수
    min_order_qty   INTEGER DEFAULT 1,
    is_active       BOOLEAN DEFAULT TRUE,
    g2b_url         VARCHAR(1000),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    last_synced_at  TIMESTAMPTZ
);

-- =============================================================
-- 3. contracts
--    Procurement contracts linking vendors to products
-- =============================================================
CREATE TABLE IF NOT EXISTS contracts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_no     VARCHAR(100) UNIQUE NOT NULL,
    vendor_id       UUID REFERENCES vendors(id) ON DELETE SET NULL,
    product_id      UUID REFERENCES products(id) ON DELETE SET NULL,
    contract_date   DATE,
    contract_start  DATE,
    contract_end    DATE,
    total_amount    NUMERIC(18, 2),                 -- 계약금액 (원)
    unit_price      NUMERIC(15, 2),
    quantity        INTEGER,
    status          VARCHAR(50) DEFAULT 'active',   -- active/expired/terminated
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- 4. delivery_records
--    Actual delivery history per vendor
-- =============================================================
CREATE TABLE IF NOT EXISTS delivery_records (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id       UUID REFERENCES vendors(id) ON DELETE CASCADE,
    product_id      UUID REFERENCES products(id) ON DELETE SET NULL,
    contract_id     UUID REFERENCES contracts(id) ON DELETE SET NULL,
    buyer_org       VARCHAR(255),                   -- 수요기관명
    buyer_region    VARCHAR(50),                    -- 수요기관 지역
    delivery_date   DATE,
    quantity        INTEGER,
    unit_price      NUMERIC(15, 2),
    total_amount    NUMERIC(18, 2),
    year            INTEGER GENERATED ALWAYS AS (EXTRACT(YEAR FROM delivery_date)::INTEGER) STORED,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- 5. vendor_activity
--    Pre-computed 100-point activity score per vendor
--    Score breakdown:
--      delivery_count_score  35pts  (납품횟수)
--      amount_score          25pts  (납품금액)
--      certification_score   20pts  (인증점수)
--      contract_duration_score 15pts (계약기간)
--      sme_bonus             5pts   (중소기업 가산)
-- =============================================================
CREATE TABLE IF NOT EXISTS vendor_activity (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id               UUID UNIQUE REFERENCES vendors(id) ON DELETE CASCADE,
    total_score             NUMERIC(5, 2) DEFAULT 0,  -- 0–100
    delivery_count_score    NUMERIC(5, 2) DEFAULT 0,  -- 0–35
    amount_score            NUMERIC(5, 2) DEFAULT 0,  -- 0–25
    certification_score     NUMERIC(5, 2) DEFAULT 0,  -- 0–20
    contract_duration_score NUMERIC(5, 2) DEFAULT 0,  -- 0–15
    sme_bonus               NUMERIC(5, 2) DEFAULT 0,  -- 0–5
    delivery_count_3yr      INTEGER DEFAULT 0,         -- 최근 3년 납품 건수
    total_amount_3yr        NUMERIC(18, 2) DEFAULT 0,  -- 최근 3년 납품 금액
    active_contract_months  INTEGER DEFAULT 0,         -- 계약 유지 개월수
    certification_count     INTEGER DEFAULT 0,
    score_version           VARCHAR(20) DEFAULT '1.0',
    calculated_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- 6. product_mappings
--    Maps 나라장터 products to external products for price reference
-- =============================================================
CREATE TABLE IF NOT EXISTS product_mappings (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id      UUID REFERENCES products(id) ON DELETE CASCADE,
    external_id     VARCHAR(500),                   -- Naver product ID
    external_source VARCHAR(50) DEFAULT 'naver',    -- naver/danawa/coupang
    match_method    VARCHAR(50) DEFAULT 'tfidf',    -- tfidf/semantic/manual
    match_score     NUMERIC(5, 4),                  -- 0.0–1.0 (only show if >= 0.7)
    external_name   VARCHAR(500),
    external_url    VARCHAR(1000),
    is_confirmed    BOOLEAN DEFAULT FALSE,           -- manually verified
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(product_id, external_id, external_source)
);

-- =============================================================
-- 7. price_references
--    Weekly snapshot of external market prices
-- =============================================================
CREATE TABLE IF NOT EXISTS price_references (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mapping_id      UUID REFERENCES product_mappings(id) ON DELETE CASCADE,
    product_id      UUID REFERENCES products(id) ON DELETE CASCADE,
    price           NUMERIC(15, 2) NOT NULL,        -- 참고 가격
    price_min       NUMERIC(15, 2),
    price_max       NUMERIC(15, 2),
    seller_count    INTEGER,
    source          VARCHAR(50) DEFAULT 'naver',
    fetched_at      TIMESTAMPTZ DEFAULT NOW(),
    is_latest       BOOLEAN DEFAULT TRUE
);

-- =============================================================
-- 8. etl_run_log
--    Tracks ETL pipeline executions for monitoring and fallback
-- =============================================================
CREATE TABLE IF NOT EXISTS etl_run_log (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_type        VARCHAR(100) NOT NULL,           -- 'bulk_ingest'/'incremental'/'price_fetch'
    source          VARCHAR(255),                    -- file name or API endpoint
    status          VARCHAR(50) DEFAULT 'running',  -- running/success/failed/partial
    started_at      TIMESTAMPTZ DEFAULT NOW(),
    finished_at     TIMESTAMPTZ,
    records_total   INTEGER DEFAULT 0,
    records_ok      INTEGER DEFAULT 0,
    records_failed  INTEGER DEFAULT 0,
    error_message   TEXT,
    metadata        JSONB DEFAULT '{}'
);
