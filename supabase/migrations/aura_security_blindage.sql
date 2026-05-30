-- ====================================================================
-- AURA AI ADVANCED SECURITY MIGRATION (SWISS DSG / nFADP MULTI-TENANT STANDARD)
-- ====================================================================

-- 1. Habilitar de forma explícita RLS en todo el núcleo de datos operativo
ALTER TABLE aura_core.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE aura_core.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE aura_core.ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE aura_core.pricing_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE aura_core.sales_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE aura_core.agent_jobs ENABLE ROW LEVEL SECURITY;

-- 2. Limpieza preventiva de políticas previas para evitar colisiones relacionales
DROP POLICY IF EXISTS tenant_isolation_policy  ON aura_core.tenants;
DROP POLICY IF EXISTS product_isolation_policy ON aura_core.products;
DROP POLICY IF EXISTS insights_isolation_policy ON aura_core.ai_insights;
DROP POLICY IF EXISTS logs_isolation_policy    ON aura_core.pricing_logs;
DROP POLICY IF EXISTS sales_isolation_policy   ON aura_core.sales_history;
DROP POLICY IF EXISTS jobs_isolation_policy    ON aura_core.agent_jobs;
DROP POLICY IF EXISTS jobs_select_policy       ON aura_core.agent_jobs;
DROP POLICY IF EXISTS sales_select_policy      ON aura_core.sales_history;

-- ====================================================================
-- POLÍTICAS DE AISLAMIENTO JWT (MULTI-TENANT REAL)
-- Extrae tenant_id del claim seguro del token Supabase Auth:
--   auth.jwt() ->> 'tenant_id'
-- Cada usuario sólo ve y opera sobre los datos de su propio tenant.
-- ====================================================================

-- Tabla: tenants — cada usuario sólo puede leer su propio registro de tenant
CREATE POLICY tenant_isolation_policy ON aura_core.tenants
    FOR SELECT
    TO authenticated
    USING (id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- Tabla: products — lectura y escritura acotada al tenant del JWT
CREATE POLICY product_isolation_policy ON aura_core.products
    FOR ALL
    TO authenticated
    USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid)
    WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- Tabla: ai_insights — bandeja de sugerencias del agente, scoped al tenant del JWT
CREATE POLICY insights_isolation_policy ON aura_core.ai_insights
    FOR ALL
    TO authenticated
    USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid)
    WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- Tabla: pricing_logs — el frontend autenticado puede insertar y leer logs
-- La clave es que el product_id pertenezca a un producto del tenant del JWT
CREATE POLICY logs_isolation_policy ON aura_core.pricing_logs
    FOR ALL
    TO authenticated
    USING (
        product_id IN (
            SELECT id FROM aura_core.products
            WHERE tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
        )
    )
    WITH CHECK (
        product_id IN (
            SELECT id FROM aura_core.products
            WHERE tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
        )
    );

-- Tabla: sales_history — READ ONLY para authenticated, acotado por tenant vía productos
CREATE POLICY sales_select_policy ON aura_core.sales_history
    FOR SELECT
    TO authenticated
    USING (
        product_id IN (
            SELECT id FROM aura_core.products
            WHERE tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
        )
    );

-- Tabla: agent_jobs — READ ONLY para authenticated, JWT tenant match estricto
-- INSERT / UPDATE / DELETE bloqueados: sólo service_role (createAuraServerClient) escribe
CREATE POLICY jobs_select_policy ON aura_core.agent_jobs
    FOR SELECT
    TO authenticated
    USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- ====================================================================
-- GOBERNANZA DE PRIVILEGIOS — REVOCAR ACCESO DE ESCRITURA A ROLES PÚBLICOS
-- anon y authenticated NO deben mover el progreso de jobs asíncronos
-- ====================================================================
REVOKE INSERT, UPDATE, DELETE ON aura_core.agent_jobs   FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON aura_core.sales_history FROM anon, authenticated;
REVOKE SELECT ON aura_core.agent_jobs FROM anon;

-- ====================================================================
-- PRIVILEGIOS DE ROL DEL SISTEMA (POSTGRESQL LEVEL)
-- service_role retiene acceso total con BYPASSRLS
-- ====================================================================
GRANT USAGE ON SCHEMA aura_core TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA aura_core TO service_role;

NOTIFY pgrst, 'reload schema';
