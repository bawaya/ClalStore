-- =====================================================
-- Add customer_id to commission_sales for identity linking
-- =====================================================

ALTER TABLE commission_sales
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_commission_sales_customer_id
  ON commission_sales(customer_id)
  WHERE customer_id IS NOT NULL;
