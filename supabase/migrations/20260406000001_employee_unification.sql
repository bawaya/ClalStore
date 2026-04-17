-- =====================================================
-- Migration 029: Employee Unification
-- Links commission_employees to users table (optional FK)
-- Enables bi-directional CRM ↔ Commission integration
-- =====================================================

-- 1. Add user_id column to commission_employees (nullable FK)
ALTER TABLE commission_employees
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Create index for fast lookup
CREATE INDEX IF NOT EXISTS idx_commission_employees_user_id
  ON commission_employees(user_id) WHERE user_id IS NOT NULL;

-- 3. Add commission_synced flag to orders (track which orders have been synced)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS commission_synced BOOLEAN DEFAULT false;

-- 4. Mark already-synced orders
UPDATE orders SET commission_synced = true
WHERE id IN (SELECT order_id FROM commission_sales WHERE order_id IS NOT NULL);

-- 5. Create index for unsynced orders lookup
CREATE INDEX IF NOT EXISTS idx_orders_commission_unsynced
  ON orders(commission_synced) WHERE commission_synced = false;
