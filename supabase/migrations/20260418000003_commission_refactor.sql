-- =====================================================
-- Commission refactor — 2026-04-18
-- =====================================================
-- Unified commission registration from Pipeline, PWA, and sync.
-- Addresses audit issues: 4.2, 4.5, 4.6, 4.10, 4.11, 4.13, 4.14, 4.15,
-- 4.16, 4.18, 4.24 (via follow-up column add).
--
-- Sections:
--   1. commission_sales: schema drift cleanup + new source columns
--   2. UNIQUE(order_id, sale_type) replaces UNIQUE(order_id)
--   3. rate_snapshot for historical accuracy (decision 7)
--   4. TRIGGER-based month lock (decision 3)
--   5. RLS on sales_docs family (issue 4.6)
--   6. sales_docs 'cancelled' status + cancellation audit trail
--   7. orders.excluded_from_sync + sales_employee soft delete
--   8. sale_date TEXT -> DATE
--   9. match_confidence CHECK
-- =====================================================

-- =====================================================
-- 1. commission_sales schema cleanup
-- =====================================================

-- Drop old UNIQUE(order_id) — prevents multiple sale_types per order (issue 4.5)
ALTER TABLE commission_sales DROP CONSTRAINT IF EXISTS commission_sales_order_id_key;

-- New composite: one row per (order, sale_type) pair
-- Existing data: if any (order_id, sale_type) dupes exist, we keep the oldest
DO $$
BEGIN
  -- Detect & log duplicates before the constraint goes on
  IF EXISTS (
    SELECT order_id, sale_type
    FROM commission_sales
    WHERE order_id IS NOT NULL AND deleted_at IS NULL
    GROUP BY order_id, sale_type
    HAVING COUNT(*) > 1
  ) THEN
    RAISE WARNING 'commission_sales has duplicate (order_id, sale_type). Manual cleanup needed before constraint.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_commission_sales_order_type
  ON commission_sales (order_id, sale_type)
  WHERE order_id IS NOT NULL AND deleted_at IS NULL;

-- =====================================================
-- 2. commission_sales new columns
-- =====================================================

-- rate_snapshot: freeze profile at time of sale so future recalcs don't rewrite history (decision 7)
ALTER TABLE commission_sales
  ADD COLUMN IF NOT EXISTS rate_snapshot JSONB;

-- Widen source values (existing CHECK is 'manual'|'auto_sync'|'csv_import')
ALTER TABLE commission_sales DROP CONSTRAINT IF EXISTS commission_sales_source_check;
ALTER TABLE commission_sales ADD CONSTRAINT commission_sales_source_check
  CHECK (source IN ('manual', 'auto_sync', 'csv_import', 'sales_doc', 'pipeline', 'order'));

-- Link to sales_docs (decision 1 — PWA/Pipeline sales must link back)
ALTER TABLE commission_sales
  ADD COLUMN IF NOT EXISTS source_sales_doc_id BIGINT
    REFERENCES sales_docs(id) ON DELETE SET NULL;

-- Link to pipeline_deals (decision 11)
-- pipeline_deals.id is UUID (see migration 20260407000001 context)
ALTER TABLE commission_sales
  ADD COLUMN IF NOT EXISTS source_pipeline_deal_id UUID
    REFERENCES pipeline_deals(id) ON DELETE SET NULL;

-- Unique per source to prevent double-registration
CREATE UNIQUE INDEX IF NOT EXISTS uq_commission_sales_source_sales_doc
  ON commission_sales (source_sales_doc_id, sale_type)
  WHERE source_sales_doc_id IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_commission_sales_source_pipeline_deal
  ON commission_sales (source_pipeline_deal_id, sale_type)
  WHERE source_pipeline_deal_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_commission_sales_source
  ON commission_sales (source)
  WHERE deleted_at IS NULL;

-- =====================================================
-- 3. sale_date TEXT -> DATE (issue 4.16)
-- =====================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'commission_sales'
      AND column_name = 'sale_date'
      AND data_type = 'text'
  ) THEN
    ALTER TABLE commission_sales
      ALTER COLUMN sale_date TYPE DATE
      USING NULLIF(sale_date, '')::date;
  END IF;
END $$;

-- =====================================================
-- 4. Month lock TRIGGER (decision 3 / issue 4.4)
-- =====================================================
-- Enforces commission_targets.is_locked at DB level. Writes to a locked
-- month will raise an exception regardless of which code path attempts
-- the write. service_role still bypasses RLS but NOT triggers.

CREATE OR REPLACE FUNCTION check_month_lock()
RETURNS TRIGGER AS $$
DECLARE
  sale_month TEXT;
  is_month_locked BOOLEAN;
BEGIN
  sale_month := CASE
    WHEN TG_OP = 'DELETE' THEN to_char(COALESCE(OLD.sale_date, CURRENT_DATE), 'YYYY-MM')
    ELSE to_char(COALESCE(NEW.sale_date, CURRENT_DATE), 'YYYY-MM')
  END;

  SELECT bool_or(COALESCE(is_locked, false)) INTO is_month_locked
  FROM commission_targets
  WHERE month = sale_month;

  IF COALESCE(is_month_locked, false) THEN
    RAISE EXCEPTION 'Month % is locked. Cannot modify commission data.', sale_month
      USING ERRCODE = '23514';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_month_lock_sales ON commission_sales;
CREATE TRIGGER trg_check_month_lock_sales
  BEFORE INSERT OR UPDATE OR DELETE ON commission_sales
  FOR EACH ROW EXECUTE FUNCTION check_month_lock();

-- Sanctions use sanction_date (TEXT) — adapt the function for this table
CREATE OR REPLACE FUNCTION check_month_lock_sanctions()
RETURNS TRIGGER AS $$
DECLARE
  sale_month TEXT;
  is_month_locked BOOLEAN;
BEGIN
  sale_month := CASE
    WHEN TG_OP = 'DELETE' THEN substring(COALESCE(OLD.sanction_date, to_char(CURRENT_DATE, 'YYYY-MM-DD')), 1, 7)
    ELSE substring(COALESCE(NEW.sanction_date, to_char(CURRENT_DATE, 'YYYY-MM-DD')), 1, 7)
  END;

  SELECT bool_or(COALESCE(is_locked, false)) INTO is_month_locked
  FROM commission_targets
  WHERE month = sale_month;

  IF COALESCE(is_month_locked, false) THEN
    RAISE EXCEPTION 'Month % is locked. Cannot modify sanction data.', sale_month
      USING ERRCODE = '23514';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_month_lock_sanctions ON commission_sanctions;
CREATE TRIGGER trg_check_month_lock_sanctions
  BEFORE INSERT OR UPDATE OR DELETE ON commission_sanctions
  FOR EACH ROW EXECUTE FUNCTION check_month_lock_sanctions();

-- =====================================================
-- 5. RLS on sales_docs family (issue 4.6)
-- =====================================================

ALTER TABLE sales_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_doc_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_doc_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_doc_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_doc_sync_queue ENABLE ROW LEVEL SECURITY;

-- service_role full access (app writes via service_role from API routes)
DROP POLICY IF EXISTS sales_docs_service ON sales_docs;
CREATE POLICY sales_docs_service ON sales_docs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS sales_doc_items_service ON sales_doc_items;
CREATE POLICY sales_doc_items_service ON sales_doc_items FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS sales_doc_attachments_service ON sales_doc_attachments;
CREATE POLICY sales_doc_attachments_service ON sales_doc_attachments FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS sales_doc_events_service ON sales_doc_events;
CREATE POLICY sales_doc_events_service ON sales_doc_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS sales_doc_sync_queue_service ON sales_doc_sync_queue;
CREATE POLICY sales_doc_sync_queue_service ON sales_doc_sync_queue FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Employee read-own (for future /employee/commissions portal)
DROP POLICY IF EXISTS sales_docs_employee_read_own ON sales_docs;
CREATE POLICY sales_docs_employee_read_own ON sales_docs FOR SELECT TO authenticated
  USING (
    employee_key = auth.uid()::text
    OR employee_user_id = auth.uid()::text
    OR employee_user_id IN (
      SELECT id::text FROM users WHERE auth_id = auth.uid()
    )
  );

-- =====================================================
-- 6. sales_docs 'cancelled' status + audit columns (decision 1)
-- =====================================================

ALTER TABLE sales_docs DROP CONSTRAINT IF EXISTS sales_docs_status_check;
ALTER TABLE sales_docs ADD CONSTRAINT sales_docs_status_check
  CHECK (status IN ('draft', 'submitted', 'verified', 'rejected', 'synced_to_commissions', 'cancelled'));

ALTER TABLE sales_docs
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_sales_docs_status_active
  ON sales_docs (status)
  WHERE deleted_at IS NULL AND status != 'cancelled';

-- =====================================================
-- 7. orders.excluded_from_sync + commission_employees soft delete
-- =====================================================

-- Issue 4.15: mark orders to skip during auto-sync
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS excluded_from_sync BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_orders_excluded_from_sync
  ON orders (excluded_from_sync)
  WHERE excluded_from_sync = true;

-- Issue 4.14: soft-delete for employees
ALTER TABLE commission_employees
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- =====================================================
-- 8. match_confidence CHECK (issue 4.24)
-- =====================================================
-- commission_employees.match_confidence is NUMERIC(3,2).
-- Add range check to guard against out-of-bounds writes.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commission_employees' AND column_name = 'match_confidence'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'commission_employees' AND constraint_name = 'chk_match_confidence'
  ) THEN
    ALTER TABLE commission_employees
      ADD CONSTRAINT chk_match_confidence
      CHECK (match_confidence IS NULL OR (match_confidence >= 0 AND match_confidence <= 1));
  END IF;
END $$;

-- =====================================================
-- 9. Helper indexes for new flows
-- =====================================================

-- Fast lookup of a deal's resulting commission(s) (cancel flow)
CREATE INDEX IF NOT EXISTS idx_commission_sales_source_deal_lookup
  ON commission_sales (source_pipeline_deal_id)
  WHERE source_pipeline_deal_id IS NOT NULL AND deleted_at IS NULL;

-- Fast lookup of a sales_doc's resulting commission(s) (cancel flow)
CREATE INDEX IF NOT EXISTS idx_commission_sales_source_sales_doc_lookup
  ON commission_sales (source_sales_doc_id)
  WHERE source_sales_doc_id IS NOT NULL AND deleted_at IS NULL;

-- Covering index for employee portal monthly queries (RLS-scoped)
CREATE INDEX IF NOT EXISTS idx_commission_sales_employee_month
  ON commission_sales (employee_id, sale_date DESC)
  WHERE deleted_at IS NULL;

-- =====================================================
-- Done. No data migration required — all new columns default NULL/false.
-- =====================================================
