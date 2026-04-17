-- =====================================================
-- Migration 027: Team Commissions
-- Per-employee commission profiles + dual tracking
-- =====================================================

-- 1) Employee commission profiles — custom rates per employee
CREATE TABLE IF NOT EXISTS employee_commission_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  line_multiplier REAL NOT NULL DEFAULT 4,
  device_rate REAL NOT NULL DEFAULT 0.05,
  device_milestone_bonus REAL NOT NULL DEFAULT 0,
  min_package_price REAL NOT NULL DEFAULT 19.90,
  loyalty_bonuses JSONB NOT NULL DEFAULT '{}',
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2) Add employee_id to commission_sales (proper UUID FK)
ALTER TABLE commission_sales
  ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- 3) Add contract-level commission (what the owner earns from HOT)
ALTER TABLE commission_sales
  ADD COLUMN IF NOT EXISTS contract_commission REAL DEFAULT 0;

-- 4) Add employee_id to commission_sanctions
ALTER TABLE commission_sanctions
  ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- 5) Indexes
CREATE INDEX IF NOT EXISTS idx_commission_sales_employee
  ON commission_sales (employee_id, sale_date);

CREATE INDEX IF NOT EXISTS idx_commission_sanctions_employee
  ON commission_sanctions (employee_id);

-- 6) Backfill: set contract_commission = commission_amount for existing rows
UPDATE commission_sales
  SET contract_commission = commission_amount
  WHERE contract_commission = 0 AND commission_amount > 0;
