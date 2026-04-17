-- =====================================================
-- Migration: Soft Delete for Orders + Commission tables
-- 5.5.1: Orders soft delete (preserve audit trail)
-- 5.5.2: Commission sales/sanctions soft delete
-- =====================================================

-- 1. Add deleted_at column to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Add deleted_at column to commission_sales
ALTER TABLE commission_sales ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 3. Add deleted_at column to commission_sanctions
ALTER TABLE commission_sanctions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 4. Create indexes for efficient filtering of non-deleted records
CREATE INDEX IF NOT EXISTS idx_orders_deleted_at ON orders (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_commission_sales_deleted_at ON commission_sales (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_commission_sanctions_deleted_at ON commission_sanctions (deleted_at) WHERE deleted_at IS NULL;
