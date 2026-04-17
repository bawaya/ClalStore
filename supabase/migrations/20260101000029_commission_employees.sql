-- =====================================================
-- ClalMobile — Commission Employees (Standalone)
-- Lightweight employee registry with unique access tokens
-- Not tied to users table — for HOT Mobile sales team
-- =====================================================

CREATE TABLE IF NOT EXISTS commission_employees (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  token TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  role TEXT DEFAULT 'sales',
  active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_commission_employees_token ON commission_employees(token);
CREATE INDEX IF NOT EXISTS idx_commission_employees_active ON commission_employees(active);

-- Add employee_name to commission_sales for display
ALTER TABLE commission_sales ADD COLUMN IF NOT EXISTS employee_name TEXT DEFAULT NULL;
