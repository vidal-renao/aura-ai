-- ====================================================================
-- AURA AI ENTERPRISE UPGRADE MIGRATION
-- Swiss FinOps & Multi-Tenant Standard — Idempotent Safe
-- ====================================================================

CREATE SCHEMA IF NOT EXISTS aura_core;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------
-- STEP 1: Extend existing tenants table with new columns
-- ----------------------------------------------------------------
ALTER TABLE aura_core.tenants ADD COLUMN IF NOT EXISTS slug VARCHAR(100);
ALTER TABLE aura_core.tenants ADD COLUMN IF NOT EXISTS plan_tier VARCHAR(50) DEFAULT 'Growth' NOT NULL;
ALTER TABLE aura_core.tenants ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW());

-- Backfill slug for existing rows that don't have one
UPDATE aura_core.tenants SET slug = LOWER(REPLACE(name, ' ', '-')) WHERE slug IS NULL;

-- Add unique constraint only if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tenants_slug_key' AND conrelid = 'aura_core.tenants'::regclass
  ) THEN
    ALTER TABLE aura_core.tenants ADD CONSTRAINT tenants_slug_key UNIQUE (slug);
  END IF;
END $$;

-- ----------------------------------------------------------------
-- STEP 2: Extend existing products table with new columns
-- ----------------------------------------------------------------
ALTER TABLE aura_core.products ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE aura_core.products ADD COLUMN IF NOT EXISTS category VARCHAR(100);
ALTER TABLE aura_core.products ADD COLUMN IF NOT EXISTS seo_data JSONB DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE aura_core.products ADD COLUMN IF NOT EXISTS ai_metadata JSONB DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE aura_core.products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW());

-- ----------------------------------------------------------------
-- STEP 3: BLOQUE 2 — Sales History (Time Series for Elasticity)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS aura_core.sales_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID REFERENCES aura_core.products(id) ON DELETE CASCADE NOT NULL,
    sale_date DATE NOT NULL,
    units_sold INTEGER NOT NULL,
    price_at_sale NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ----------------------------------------------------------------
-- STEP 4: BLOQUE 3 — Async Agent Job Queue
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS aura_core.agent_jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES aura_core.tenants(id) ON DELETE CASCADE NOT NULL,
    status VARCHAR(50) DEFAULT 'queued' NOT NULL,
    progress INTEGER DEFAULT 0 NOT NULL,
    status_text VARCHAR(255) DEFAULT '' NOT NULL,
    processed_count INTEGER DEFAULT 0 NOT NULL,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ----------------------------------------------------------------
-- STEP 5: High-performance indexes
-- ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_sales_history_product_date ON aura_core.sales_history(product_id, sale_date);
CREATE INDEX IF NOT EXISTS idx_agent_jobs_tenant_status ON aura_core.agent_jobs(tenant_id, status);

-- ----------------------------------------------------------------
-- STEP 6: Disable RLS on new tables (service_role pattern)
-- ----------------------------------------------------------------
ALTER TABLE aura_core.sales_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE aura_core.agent_jobs DISABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------
-- STEP 7: Grants (cumulative — safe to re-run)
-- ----------------------------------------------------------------
GRANT USAGE ON SCHEMA aura_core TO service_role, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA aura_core TO service_role;
GRANT SELECT, INSERT, UPDATE ON aura_core.products TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON aura_core.ai_insights TO anon, authenticated;
GRANT SELECT ON aura_core.pricing_logs TO anon, authenticated;
GRANT INSERT ON aura_core.pricing_logs TO anon, authenticated;
GRANT SELECT ON aura_core.agent_jobs TO anon, authenticated;
GRANT SELECT ON aura_core.sales_history TO anon, authenticated;

-- ----------------------------------------------------------------
-- STEP 8: Seed data (idempotent)
-- ----------------------------------------------------------------

-- Tenant seed (already exists — update plan_tier if needed)
INSERT INTO aura_core.tenants (id, name, slug, sector, currency, plan_tier)
VALUES (
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    'SwissGlow Tech',
    'swissglow-tech',
    'Premium Health & Ergonomics',
    'CHF',
    'Growth'
)
ON CONFLICT (id) DO UPDATE SET
    slug = EXCLUDED.slug,
    plan_tier = EXCLUDED.plan_tier;

-- Products seed (idempotent via sku+tenant unique constraint)
INSERT INTO aura_core.products (id, tenant_id, sku, title, cost_price, base_price, current_price, stock_quantity, min_stock_alert)
VALUES
    ('f1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'SG-LUM-01',    'Lámpara de Fototerapia SwissGlow', 45.00,  120.00, 120.00, 3,  10),
    ('f2b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'SG-CHAIR-X',   'Silla Ergonómica ActivePro',       180.00, 450.00, 450.00, 85, 15),
    ('f3b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'SG-MASS-05',   'Masajeador Cervical de Impulsos',  15.00,  59.00,  59.00,  20, 5)
ON CONFLICT (tenant_id, sku) DO NOTHING;

-- Sales history seed (no unique constraint — use DO block to avoid duplicates)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM aura_core.sales_history LIMIT 1) THEN
        INSERT INTO aura_core.sales_history (product_id, sale_date, units_sold, price_at_sale)
        VALUES
            ('f1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', CURRENT_DATE - INTERVAL '14 days', 12, 120.00),
            ('f1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', CURRENT_DATE - INTERVAL '7 days',  10, 120.00),
            ('f2b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', CURRENT_DATE - INTERVAL '14 days', 45, 450.00),
            ('f2b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', CURRENT_DATE - INTERVAL '7 days',  38, 450.00),
            ('f3b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', CURRENT_DATE - INTERVAL '14 days', 22, 59.00),
            ('f3b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', CURRENT_DATE - INTERVAL '7 days',  25, 59.00);
    END IF;
END $$;
