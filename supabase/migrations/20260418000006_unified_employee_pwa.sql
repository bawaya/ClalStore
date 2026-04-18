-- =====================================================
-- Unified Employee PWA — schema additions
-- =====================================================
-- Adds four tables to support the merged /sales-pwa experience:
--   1. commission_correction_requests — employee disputes
--   2. admin_announcements + admin_announcement_reads — broadcast messages
--   3. employee_activity_log — audit trail visible to the employee
--   4. employee_favorite_products — future: quick-create from favorites
-- =====================================================

-- ─── Correction requests ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS commission_correction_requests (
  id BIGSERIAL PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  commission_sale_id BIGINT REFERENCES commission_sales(id) ON DELETE SET NULL,
  sales_doc_id BIGINT REFERENCES sales_docs(id) ON DELETE SET NULL,
  request_type TEXT NOT NULL CHECK (
    request_type IN ('amount_error', 'wrong_type', 'wrong_date', 'wrong_customer', 'missing_sale', 'other')
  ),
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'approved', 'rejected', 'resolved')
  ),
  admin_response TEXT,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_corrections_employee ON commission_correction_requests(employee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_corrections_pending ON commission_correction_requests(status) WHERE status = 'pending';

ALTER TABLE commission_correction_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS corrections_service_all ON commission_correction_requests;
CREATE POLICY corrections_service_all ON commission_correction_requests
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS corrections_employee_read_own ON commission_correction_requests;
CREATE POLICY corrections_employee_read_own ON commission_correction_requests
  FOR SELECT TO authenticated
  USING (employee_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS corrections_employee_insert_own ON commission_correction_requests;
CREATE POLICY corrections_employee_insert_own ON commission_correction_requests
  FOR INSERT TO authenticated
  WITH CHECK (employee_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

-- ─── Admin announcements ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_announcements (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  target TEXT NOT NULL DEFAULT 'all' CHECK (target IN ('all', 'employees', 'admins')),
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_announcements_created ON admin_announcements(created_at DESC);
-- expires_at index (simple; we filter runtime — can't use now() in a partial predicate
-- because Postgres requires immutable functions in index predicates)
CREATE INDEX IF NOT EXISTS idx_announcements_expires ON admin_announcements(expires_at)
  WHERE expires_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS admin_announcement_reads (
  announcement_id BIGINT NOT NULL REFERENCES admin_announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (announcement_id, user_id)
);

ALTER TABLE admin_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_announcement_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS announcements_service_all ON admin_announcements;
CREATE POLICY announcements_service_all ON admin_announcements
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS announcements_auth_read ON admin_announcements;
CREATE POLICY announcements_auth_read ON admin_announcements
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS announcement_reads_service_all ON admin_announcement_reads;
CREATE POLICY announcement_reads_service_all ON admin_announcement_reads
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS announcement_reads_user_own ON admin_announcement_reads;
CREATE POLICY announcement_reads_user_own ON admin_announcement_reads
  FOR ALL TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()))
  WITH CHECK (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

-- ─── Employee activity log ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employee_activity_log (
  id BIGSERIAL PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'sale_registered', 'sale_cancelled', 'sanction_added', 'sanction_removed',
    'target_set', 'target_updated', 'month_locked', 'correction_submitted',
    'correction_resolved', 'profile_updated', 'milestone_reached'
  )),
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_employee ON employee_activity_log(employee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_type ON employee_activity_log(event_type);

ALTER TABLE employee_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS activity_service_all ON employee_activity_log;
CREATE POLICY activity_service_all ON employee_activity_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS activity_employee_read_own ON employee_activity_log;
CREATE POLICY activity_employee_read_own ON employee_activity_log
  FOR SELECT TO authenticated
  USING (employee_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

-- ─── Employee favorite products ──────────────────────────────────────────────
-- Schema-only (no UI yet). Will drive quick-create from favorites in a future iteration.
CREATE TABLE IF NOT EXISTS employee_favorite_products (
  employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (employee_id, product_id)
);

ALTER TABLE employee_favorite_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS favorites_service_all ON employee_favorite_products;
CREATE POLICY favorites_service_all ON employee_favorite_products
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS favorites_employee_own ON employee_favorite_products;
CREATE POLICY favorites_employee_own ON employee_favorite_products
  FOR ALL TO authenticated
  USING (employee_id IN (SELECT id FROM users WHERE auth_id = auth.uid()))
  WITH CHECK (employee_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));
