-- =====================================================
-- Migration 030: Add deleted_at for soft deletes
-- commission_sales + commission_sanctions
-- =====================================================

ALTER TABLE commission_sales
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE commission_sanctions
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_commission_sales_deleted
  ON commission_sales (deleted_at) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_commission_sanctions_deleted
  ON commission_sanctions (deleted_at) WHERE deleted_at IS NULL;
