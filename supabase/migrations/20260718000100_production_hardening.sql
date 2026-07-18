-- Aura AI production hardening. Safe to apply after the legacy baseline.
CREATE SCHEMA IF NOT EXISTS aura_core;

ALTER TABLE aura_core.pricing_logs
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS executed_by_email TEXT,
  ADD COLUMN IF NOT EXISTS executed_by_role TEXT;

UPDATE aura_core.pricing_logs
SET created_at = COALESCE(created_at, changed_at, NOW())
WHERE created_at IS NULL;

ALTER TABLE aura_core.pricing_logs
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN created_at SET NOT NULL;

CREATE TABLE IF NOT EXISTS aura_core.api_rate_limits (
  key TEXT PRIMARY KEY,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0)
);

ALTER TABLE aura_core.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE aura_core.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE aura_core.ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE aura_core.pricing_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE aura_core.sales_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE aura_core.agent_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE aura_core.api_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON aura_core.tenants;
DROP POLICY IF EXISTS product_isolation_policy ON aura_core.products;
DROP POLICY IF EXISTS insights_isolation_policy ON aura_core.ai_insights;
DROP POLICY IF EXISTS logs_isolation_policy ON aura_core.pricing_logs;
DROP POLICY IF EXISTS sales_select_policy ON aura_core.sales_history;
DROP POLICY IF EXISTS jobs_select_policy ON aura_core.agent_jobs;

CREATE POLICY tenant_select_policy ON aura_core.tenants FOR SELECT TO authenticated
  USING (id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);
CREATE POLICY product_select_policy ON aura_core.products FOR SELECT TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);
CREATE POLICY insight_select_policy ON aura_core.ai_insights FOR SELECT TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);
CREATE POLICY log_select_policy ON aura_core.pricing_logs FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM aura_core.products p
    WHERE p.id = product_id
      AND p.tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
  ));
CREATE POLICY sales_select_policy ON aura_core.sales_history FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM aura_core.products p
    WHERE p.id = product_id
      AND p.tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
  ));
CREATE POLICY jobs_select_policy ON aura_core.agent_jobs FOR SELECT TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

REVOKE ALL ON ALL TABLES IN SCHEMA aura_core FROM anon;
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA aura_core FROM authenticated;
GRANT USAGE ON SCHEMA aura_core TO authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA aura_core TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA aura_core TO service_role;

CREATE OR REPLACE FUNCTION aura_core.apply_ai_insight(
  p_insight_id UUID,
  p_tenant_id UUID,
  p_action TEXT,
  p_restock_quantity INTEGER,
  p_actor_email TEXT,
  p_actor_role TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = aura_core, pg_temp
AS $$
DECLARE
  v_insight aura_core.ai_insights%ROWTYPE;
  v_product aura_core.products%ROWTYPE;
  v_price NUMERIC(12,2);
BEGIN
  IF p_actor_role <> 'Admin' OR p_action NOT IN ('apply', 'dismiss') THEN
    RAISE EXCEPTION 'Decision not authorized';
  END IF;

  SELECT * INTO v_insight FROM aura_core.ai_insights
  WHERE id = p_insight_id AND tenant_id = p_tenant_id AND status = 'pending'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Insight not found or already processed'; END IF;

  IF p_action = 'dismiss' THEN
    UPDATE aura_core.ai_insights SET status = 'dismissed' WHERE id = p_insight_id;
    RETURN jsonb_build_object('status', 'dismissed');
  END IF;

  SELECT * INTO v_product FROM aura_core.products
  WHERE id = v_insight.product_id AND tenant_id = p_tenant_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product not found'; END IF;

  IF v_insight.insight_type = 'stock_risk' THEN
    IF p_restock_quantity IS NULL OR p_restock_quantity <= 0 THEN
      RAISE EXCEPTION 'Positive restock quantity required';
    END IF;
    UPDATE aura_core.products
      SET stock_quantity = stock_quantity + p_restock_quantity, updated_at = NOW()
      WHERE id = v_product.id;
  ELSIF v_insight.insight_type = 'dynamic_pricing' THEN
    v_price := (v_insight.proposed_data ->> 'suggested_price')::numeric;
    IF v_price IS NULL OR v_price < v_product.cost_price OR v_price > v_product.current_price * 2 THEN
      RAISE EXCEPTION 'Suggested price outside allowed bounds';
    END IF;
    UPDATE aura_core.products SET current_price = v_price, updated_at = NOW() WHERE id = v_product.id;
    INSERT INTO aura_core.pricing_logs
      (product_id, old_price, new_price, reason, executed_by_email, executed_by_role, created_at)
    VALUES
      (v_product.id, v_product.current_price, v_price, v_insight.headline, p_actor_email, p_actor_role, NOW());
  ELSIF v_insight.insight_type = 'seo_optimization' THEN
    UPDATE aura_core.products
      SET seo_data = COALESCE(seo_data, '{}'::jsonb) || jsonb_build_object(
        'title', v_insight.proposed_data -> 'seo_title',
        'description', v_insight.proposed_data -> 'seo_description'
      ), updated_at = NOW()
      WHERE id = v_product.id;
  ELSE
    RAISE EXCEPTION 'Unsupported insight type';
  END IF;

  UPDATE aura_core.ai_insights SET status = 'applied' WHERE id = p_insight_id;
  RETURN jsonb_build_object('status', 'applied', 'product_id', v_product.id);
END;
$$;

REVOKE ALL ON FUNCTION aura_core.apply_ai_insight(UUID, UUID, TEXT, INTEGER, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION aura_core.apply_ai_insight(UUID, UUID, TEXT, INTEGER, TEXT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION aura_core.consume_rate_limit(
  p_key TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = aura_core, pg_temp
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF p_key = '' OR p_limit < 1 OR p_limit > 1000 OR p_window_seconds < 1 OR p_window_seconds > 86400 THEN
    RAISE EXCEPTION 'Invalid rate-limit parameters';
  END IF;

  INSERT INTO aura_core.api_rate_limits AS limits (key, window_started_at, request_count)
  VALUES (p_key, NOW(), 1)
  ON CONFLICT (key) DO UPDATE SET
    window_started_at = CASE
      WHEN limits.window_started_at + make_interval(secs => p_window_seconds) <= NOW() THEN NOW()
      ELSE limits.window_started_at
    END,
    request_count = CASE
      WHEN limits.window_started_at + make_interval(secs => p_window_seconds) <= NOW() THEN 1
      ELSE limits.request_count + 1
    END
  RETURNING request_count INTO v_count;

  RETURN v_count <= p_limit;
END;
$$;

REVOKE ALL ON aura_core.api_rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON aura_core.api_rate_limits TO service_role;
REVOKE ALL ON FUNCTION aura_core.consume_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION aura_core.consume_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;
NOTIFY pgrst, 'reload schema';
