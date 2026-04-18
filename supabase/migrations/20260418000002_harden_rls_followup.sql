-- ============================================================================
-- Migration: RLS hardening follow-up — drop FORCE on tables with service-role
--            FK writes, then close the orders/customers/order_items loopholes.
--
-- Context:
-- * 20260418000001 applied FORCE ROW LEVEL SECURITY broadly. FORCE makes
--   even BYPASSRLS roles subject to policies, which breaks FK validation
--   when the policy doesn't explicitly allow the internal session role to
--   SELECT referenced rows. Dropping FORCE on tables that are FK targets
--   (products, customers, orders, order_items, order_notes,
--   customer_hot_accounts, inbox_*, commission_*) restores service_role's
--   normal bypass behaviour while keeping RLS enforced for anon/auth.
-- * The rls-contract tests caught that `orders_public_insert WITH CHECK
--   (true)` let anon POST an order directly. Every writer in the app goes
--   through createAdminSupabase() (service_role), so we drop the permissive
--   policies and add explicit service_role-only ones.
-- ============================================================================

-- ─── 1. Drop FORCE on tables with FK writes ──────────────────────────────────

ALTER TABLE products                    NO FORCE ROW LEVEL SECURITY;
ALTER TABLE customers                   NO FORCE ROW LEVEL SECURITY;
ALTER TABLE orders                      NO FORCE ROW LEVEL SECURITY;
ALTER TABLE order_items                 NO FORCE ROW LEVEL SECURITY;
ALTER TABLE order_notes                 NO FORCE ROW LEVEL SECURITY;
ALTER TABLE customer_hot_accounts       NO FORCE ROW LEVEL SECURITY;
ALTER TABLE inbox_conversations         NO FORCE ROW LEVEL SECURITY;
ALTER TABLE inbox_messages              NO FORCE ROW LEVEL SECURITY;
ALTER TABLE inbox_notes                 NO FORCE ROW LEVEL SECURITY;
ALTER TABLE commission_sales            NO FORCE ROW LEVEL SECURITY;
ALTER TABLE commission_targets          NO FORCE ROW LEVEL SECURITY;
ALTER TABLE commission_sanctions        NO FORCE ROW LEVEL SECURITY;
ALTER TABLE commission_sync_log         NO FORCE ROW LEVEL SECURITY;
ALTER TABLE commission_employees        NO FORCE ROW LEVEL SECURITY;
ALTER TABLE employee_commission_profiles NO FORCE ROW LEVEL SECURITY;
-- Keep FORCE on sub_pages and audit_log (no incoming FK writes)

-- ─── 2. Close orders / customers / order_items public-insert loopholes ──────

DROP POLICY IF EXISTS "orders_public_insert"      ON orders;
DROP POLICY IF EXISTS "order_items_public_insert" ON order_items;
DROP POLICY IF EXISTS "customers_public_upsert"   ON customers;

-- Replace broad "auth_all" (public with USING auth.uid() IS NOT NULL) with
-- explicit service_role-only policies that match auth.role() exactly.
DROP POLICY IF EXISTS "orders_auth_all"      ON orders;
DROP POLICY IF EXISTS "order_items_auth_all" ON order_items;
DROP POLICY IF EXISTS "customers_auth_all"   ON customers;

CREATE POLICY "orders_service_all" ON orders
  FOR ALL TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "order_items_service_all" ON order_items
  FOR ALL TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "customers_service_all" ON customers
  FOR ALL TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

REVOKE INSERT, UPDATE, DELETE ON orders, order_items, customers FROM anon, authenticated;

-- ─── Done ────────────────────────────────────────────────────────────────────
-- Next staging run should show all 17 RLS contract tests green.
