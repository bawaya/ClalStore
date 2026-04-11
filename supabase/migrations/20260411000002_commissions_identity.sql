-- =====================================================
-- ClalMobile — Commissions Identity Linking (Phase 1)
-- Link commission_sales to customers via customer_id and customer_hot_account_id
-- Adds match_status / match_method columns for tracking CSV imports and auto-sync confidence
-- =====================================================

ALTER TABLE commission_sales
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_hot_account_id UUID REFERENCES customer_hot_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hot_mobile_id_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS store_customer_code_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS match_status TEXT DEFAULT 'pending'
    CHECK (match_status IN ('pending','matched','ambiguous','unmatched','conflict','manual')),
  ADD COLUMN IF NOT EXISTS match_method TEXT,
  ADD COLUMN IF NOT EXISTS match_confidence NUMERIC(3,2);

CREATE INDEX IF NOT EXISTS idx_commission_sales_customer
  ON commission_sales(customer_id) WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_commission_sales_hot_account
  ON commission_sales(customer_hot_account_id) WHERE customer_hot_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_commission_sales_match_status
  ON commission_sales(match_status);

COMMENT ON COLUMN commission_sales.customer_id IS
  'Linked customer (nullable). Populated by auto-sync (order.customer_id) or manual CSV matching.';
COMMENT ON COLUMN commission_sales.customer_hot_account_id IS
  'Linked HOT account (nullable). Populated when the sale maps to a specific HOT line.';
COMMENT ON COLUMN commission_sales.hot_mobile_id_snapshot IS
  'Original hot_mobile_id from the import/source (preserved even after HOT account is closed).';
COMMENT ON COLUMN commission_sales.match_status IS
  'pending|matched|ambiguous|unmatched|conflict|manual — tracks identity-matching state.';
