-- =====================================================
-- ClalMobile — Employee Commission Profiles
-- Per-employee custom commission rates + new columns
-- =====================================================

-- Employee commission profiles table
CREATE TABLE IF NOT EXISTS employee_commission_profiles (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  line_multiplier REAL NOT NULL DEFAULT 4,
  device_rate REAL NOT NULL DEFAULT 0.05,
  device_milestone_bonus REAL NOT NULL DEFAULT 0,
  min_package_price REAL NOT NULL DEFAULT 19.90,
  loyalty_bonuses JSONB DEFAULT '{"5":80,"9":30,"12":20,"15":50}',
  notes TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emp_comm_profiles_user ON employee_commission_profiles(user_id);

-- Add employee_id and contract_commission to commission_sales
ALTER TABLE commission_sales ADD COLUMN IF NOT EXISTS employee_id UUID DEFAULT NULL;
ALTER TABLE commission_sales ADD COLUMN IF NOT EXISTS contract_commission REAL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_commission_sales_employee ON commission_sales(employee_id);

-- Add employee_id to commission_sanctions
ALTER TABLE commission_sanctions ADD COLUMN IF NOT EXISTS employee_id UUID DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_commission_sanctions_employee ON commission_sanctions(employee_id);
