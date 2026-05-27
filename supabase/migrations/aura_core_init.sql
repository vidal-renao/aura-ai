CREATE SCHEMA IF NOT EXISTS aura_core;

CREATE TABLE IF NOT EXISTS aura_core.tenants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    sector VARCHAR(100) NOT NULL,
    currency VARCHAR(3) DEFAULT 'CHF' NOT NULL,
    plan_tier VARCHAR(50) DEFAULT 'Growth' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS aura_core.products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES aura_core.tenants(id) ON DELETE CASCADE NOT NULL,
    sku VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    cost_price NUMERIC(12, 2) NOT NULL,
    base_price NUMERIC(12, 2) NOT NULL,
    current_price NUMERIC(12, 2) NOT NULL,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    min_stock_alert INTEGER DEFAULT 10 NOT NULL,
    seo_data JSONB DEFAULT '{}'::jsonb NOT NULL,
    ai_metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT unique_sku_per_tenant UNIQUE (tenant_id, sku)
);

CREATE TABLE IF NOT EXISTS aura_core.ai_insights (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES aura_core.tenants(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES aura_core.products(id) ON DELETE CASCADE NOT NULL,
    insight_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' NOT NULL,
    headline VARCHAR(255) NOT NULL,
    justification TEXT NOT NULL,
    proposed_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS aura_core.pricing_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID REFERENCES aura_core.products(id) ON DELETE CASCADE NOT NULL,
    old_price NUMERIC(12, 2) NOT NULL,
    new_price NUMERIC(12, 2) NOT NULL,
    reason VARCHAR(255) NOT NULL,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_products_tenant ON aura_core.products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_insights_tenant_status ON aura_core.ai_insights(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_insights_product ON aura_core.ai_insights(product_id);
CREATE INDEX IF NOT EXISTS idx_pricing_logs_product ON aura_core.pricing_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_products_seo_data ON aura_core.products USING gin (seo_data);

INSERT INTO aura_core.tenants (id, name, slug, sector, currency)
VALUES ('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'SwissGlow Tech', 'swissglow-tech', 'Premium Health & Ergonomics', 'CHF')
ON CONFLICT (id) DO NOTHING;

INSERT INTO aura_core.products (tenant_id, sku, title, description, cost_price, base_price, current_price, stock_quantity, min_stock_alert)
VALUES
('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'SG-LUM-01', 'Lámpara de Fototerapia SwissGlow', 'Lámpara para simular luz solar en entornos de oficina cerrados.', 45.00, 120.00, 120.00, 3, 10),
('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'SG-CHAIR-X', 'Silla Ergonómica ActivePro', 'Silla corporativa de alta gama optimizada para soporte lumbar continuo.', 180.00, 450.00, 450.00, 85, 15),
('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'SG-MASS-05', 'Masajeador Cervical de Impulsos', 'Masajeador portátil con batería de alta duración. Interfaz simplificada.', 15.00, 59.00, 59.00, 20, 5)
ON CONFLICT (tenant_id, sku) DO NOTHING;
