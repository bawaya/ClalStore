-- ============================================================================
-- Migration: Global RLS hardening — close leaks found by the RLS contract tests
--
-- Context:
-- The tests in tests/staging/rls-contract.test.ts flagged the following real
-- leaks in production on 2026-04-18:
--   * sub_pages:           anon could INSERT / UPDATE / DELETE / read hidden
--   * commission_sales:    anon could SELECT all rows (no RLS enabled at all)
--
-- This migration:
--   1. Makes sure RLS is ENABLED on every sensitive table.
--   2. Tightens sub_pages policies (supersedes migration 20260417000001).
--   3. Adds explicit role-scoped policies to commission_sales and friends.
-- ============================================================================

-- Preserve writes from the admin API by always granting service_role full
-- access. Every other role is whitelist-only.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. sub_pages — CMS content
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE sub_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_pages FORCE ROW LEVEL SECURITY; -- applies to table owner too

DROP POLICY IF EXISTS "sub_pages_public_read"        ON sub_pages;
DROP POLICY IF EXISTS "sub_pages_authenticated_all"  ON sub_pages;
DROP POLICY IF EXISTS "sub_pages_authenticated_read" ON sub_pages;
DROP POLICY IF EXISTS "sub_pages_anon_read"          ON sub_pages;
DROP POLICY IF EXISTS "sub_pages_service_all"        ON sub_pages;

CREATE POLICY "sub_pages_anon_read" ON sub_pages
  FOR SELECT TO anon
  USING (is_visible = true);

CREATE POLICY "sub_pages_authenticated_read" ON sub_pages
  FOR SELECT TO authenticated
  USING (is_visible = true);

CREATE POLICY "sub_pages_service_all" ON sub_pages
  FOR ALL TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

REVOKE INSERT, UPDATE, DELETE ON sub_pages FROM anon;
REVOKE INSERT, UPDATE, DELETE ON sub_pages FROM authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. commission_sales — financial data
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE commission_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_sales FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "commission_sales_all"             ON commission_sales;
DROP POLICY IF EXISTS "commission_sales_auth_all"        ON commission_sales;
DROP POLICY IF EXISTS "commission_sales_service_all"     ON commission_sales;
DROP POLICY IF EXISTS "svc_commission_sales"             ON commission_sales;

CREATE POLICY "commission_sales_service_all" ON commission_sales
  FOR ALL TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

REVOKE SELECT, INSERT, UPDATE, DELETE ON commission_sales FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON commission_sales FROM authenticated;

-- Likewise for the peer financial tables
ALTER TABLE commission_targets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_targets        FORCE ROW LEVEL SECURITY;
ALTER TABLE commission_sanctions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_sanctions      FORCE ROW LEVEL SECURITY;
ALTER TABLE commission_sync_log       ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_sync_log       FORCE ROW LEVEL SECURITY;
ALTER TABLE commission_employees      ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_employees      FORCE ROW LEVEL SECURITY;
ALTER TABLE employee_commission_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_commission_profiles FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "svc_commission_targets"        ON commission_targets;
DROP POLICY IF EXISTS "svc_commission_sanctions"      ON commission_sanctions;
DROP POLICY IF EXISTS "svc_commission_sync_log"       ON commission_sync_log;
DROP POLICY IF EXISTS "svc_commission_employees"      ON commission_employees;
DROP POLICY IF EXISTS "svc_employee_profiles"         ON employee_commission_profiles;

CREATE POLICY "svc_commission_targets"   ON commission_targets
  FOR ALL TO service_role USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "svc_commission_sanctions" ON commission_sanctions
  FOR ALL TO service_role USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "svc_commission_sync_log"  ON commission_sync_log
  FOR ALL TO service_role USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "svc_commission_employees" ON commission_employees
  FOR ALL TO service_role USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "svc_employee_profiles"    ON employee_commission_profiles
  FOR ALL TO service_role USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

REVOKE SELECT, INSERT, UPDATE, DELETE ON commission_targets        FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON commission_sanctions      FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON commission_sync_log       FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON commission_employees      FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON employee_commission_profiles FROM anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. audit_log — append-only sensitive log
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_auth_read"   ON audit_log;
DROP POLICY IF EXISTS "audit_auth_insert" ON audit_log;
DROP POLICY IF EXISTS "audit_service_all" ON audit_log;

CREATE POLICY "audit_service_all" ON audit_log
  FOR ALL TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

REVOKE SELECT, INSERT, UPDATE, DELETE ON audit_log FROM anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. customer PII + orders — verify inbox + orders have no leak
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE customers                ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers                FORCE ROW LEVEL SECURITY;
ALTER TABLE orders                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders                   FORCE ROW LEVEL SECURITY;
ALTER TABLE order_items              ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items              FORCE ROW LEVEL SECURITY;
ALTER TABLE order_notes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_notes              FORCE ROW LEVEL SECURITY;
ALTER TABLE customer_hot_accounts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_hot_accounts    FORCE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. inbox — sensitive message content
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE inbox_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_conversations FORCE ROW LEVEL SECURITY;
ALTER TABLE inbox_messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_messages      FORCE ROW LEVEL SECURITY;
ALTER TABLE inbox_notes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_notes         FORCE ROW LEVEL SECURITY;

-- Keep whatever service_role policies already exist; just guarantee the
-- table is RLS-enforced against anon/authenticated without an explicit grant.

-- ═══════════════════════════════════════════════════════════════════════════
-- Done. Verify after apply by re-running:
--    npx vitest run --config vitest.staging.config.ts tests/staging/rls-contract.test.ts
-- ═══════════════════════════════════════════════════════════════════════════
