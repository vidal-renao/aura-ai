-- ====================================================================
-- AURA AI — RLS HARDENING PATCH (LIVE DATABASE SECURITY FIX)
-- Swiss DSG / nFADP Multi-Tenant Standard — Idempotent Safe
-- Applies on top of existing migrations without destructive side effects
-- ====================================================================
-- ROOT CAUSE RESOLVED:
--   aura_enterprise_upgrade.sql STEP 6 explicitly ran:
--     ALTER TABLE aura_core.agent_jobs DISABLE ROW LEVEL SECURITY;
--   overriding the intent of aura_security_blindage.sql.
--   Additionally, the legacy jobs_isolation_policy used:
--     - A hardcoded tenant UUID (not JWT-scoped)
--     - FOR ALL TO anon (granted anonymous INSERT/UPDATE/DELETE)
-- ====================================================================

-- ----------------------------------------------------------------
-- STEP 1: Re-enable RLS — overrides the DISABLE from enterprise_upgrade
-- ----------------------------------------------------------------
ALTER TABLE aura_core.agent_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE aura_core.sales_history ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------
-- STEP 2: Drop legacy policies to prevent collisions
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS jobs_isolation_policy   ON aura_core.agent_jobs;
DROP POLICY IF EXISTS sales_isolation_policy  ON aura_core.sales_history;

-- ----------------------------------------------------------------
-- STEP 3: agent_jobs — strict multi-tenant READ isolation
--
-- Only authenticated users whose JWT claim `tenant_id` matches
-- the row's tenant_id may SELECT.
--
-- INSERT / UPDATE / DELETE are intentionally NOT granted here.
-- service_role bypasses RLS by design and is the only writer
-- (via createAuraServerClient on the server side).
-- ----------------------------------------------------------------
-- app_metadata is server-controlled (service_role only) and cannot be
-- modified by end users, unlike user_metadata which is user-editable.
CREATE POLICY jobs_select_policy ON aura_core.agent_jobs
    FOR SELECT
    TO authenticated
    USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- ----------------------------------------------------------------
-- STEP 4: sales_history — join-scoped multi-tenant READ isolation
--
-- No direct tenant_id column — isolation flows through products.
-- ----------------------------------------------------------------
CREATE POLICY sales_select_policy ON aura_core.sales_history
    FOR SELECT
    TO authenticated
    USING (
        product_id IN (
            SELECT id FROM aura_core.products
            WHERE tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
        )
    );

-- ----------------------------------------------------------------
-- STEP 5: Revoke excess grants from public roles
--
-- anon and authenticated must NOT write to the async job queue
-- or the sales time-series. Only service_role writes these tables.
-- ----------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE ON aura_core.agent_jobs   FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON aura_core.sales_history FROM anon, authenticated;

-- Least-privilege: anon has no business reading job queue records
REVOKE SELECT ON aura_core.agent_jobs FROM anon;

-- ----------------------------------------------------------------
-- STEP 6: Ensure service_role retains full bypass access
-- ----------------------------------------------------------------
GRANT USAGE ON SCHEMA aura_core TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA aura_core TO service_role;

-- ----------------------------------------------------------------
-- STEP 7: Reload PostgREST schema cache
-- ----------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
