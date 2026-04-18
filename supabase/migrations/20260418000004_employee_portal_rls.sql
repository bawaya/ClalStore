-- ============================================================================
-- Migration: Employee self-service portal — defense-in-depth RLS
--
-- Phase 8: the /employee/commissions portal lets an authenticated employee
-- read their own commission data. Our Next.js API route already authenticates
-- via requireEmployee() and queries with service_role (createAdminSupabase),
-- so RLS is NOT the primary gate. These policies are defense-in-depth so that
-- even if a client ever obtains an anon/authenticated JWT directly, they can
-- only SELECT rows that belong to them (matched by users.auth_id = auth.uid()).
-- ============================================================================

ALTER TABLE commission_sales     ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_sanctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_targets   ENABLE ROW LEVEL SECURITY;

-- ─── service_role full access (preserve existing admin-API writes) ──────────
DROP POLICY IF EXISTS commission_sales_service ON commission_sales;
CREATE POLICY commission_sales_service ON commission_sales
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS commission_sanctions_service ON commission_sanctions;
CREATE POLICY commission_sanctions_service ON commission_sanctions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS commission_targets_service ON commission_targets;
CREATE POLICY commission_targets_service ON commission_targets
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── Employee read-own (defense-in-depth) ───────────────────────────────────
-- commission_sales.employee_id is UUID (added in employee_unification migration),
-- so we match against users.id without casting. commission_sanctions.user_id and
-- commission_targets.user_id are TEXT (legacy schema) — those keep the ::text cast.

DROP POLICY IF EXISTS commission_sales_employee_read_own ON commission_sales;
CREATE POLICY commission_sales_employee_read_own ON commission_sales
  FOR SELECT TO authenticated
  USING (
    employee_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  );

DROP POLICY IF EXISTS commission_sanctions_employee_read_own ON commission_sanctions;
CREATE POLICY commission_sanctions_employee_read_own ON commission_sanctions
  FOR SELECT TO authenticated
  USING (
    user_id IN (SELECT id::text FROM users WHERE auth_id = auth.uid())
  );

DROP POLICY IF EXISTS commission_targets_employee_read_own ON commission_targets;
CREATE POLICY commission_targets_employee_read_own ON commission_targets
  FOR SELECT TO authenticated
  USING (
    user_id IN (SELECT id::text FROM users WHERE auth_id = auth.uid())
  );
