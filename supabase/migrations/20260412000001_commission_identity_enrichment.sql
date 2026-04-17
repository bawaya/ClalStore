-- =====================================================
-- ClalMobile — Commission identity enrichment
-- Add HOT account snapshots and matching metadata to commission_sales.
-- =====================================================

ALTER TABLE commission_sales
  ADD COLUMN IF NOT EXISTS customer_hot_account_id UUID REFERENCES customer_hot_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hot_mobile_id_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS store_customer_code_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS match_status TEXT DEFAULT 'pending'
    CHECK (match_status IN ('pending','matched','ambiguous','unmatched','conflict','manual')),
  ADD COLUMN IF NOT EXISTS match_method TEXT,
  ADD COLUMN IF NOT EXISTS match_confidence NUMERIC(3,2);

CREATE INDEX IF NOT EXISTS idx_commission_sales_hot_account_id
  ON commission_sales(customer_hot_account_id)
  WHERE customer_hot_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_commission_sales_match_status
  ON commission_sales(match_status);

COMMENT ON COLUMN commission_sales.customer_hot_account_id IS
  'Linked HOT account (nullable). Populated from the customer primary HOT account when available.';
COMMENT ON COLUMN commission_sales.hot_mobile_id_snapshot IS
  'Original HOT mobile id snapshot stored on the commission row for auditability.';
COMMENT ON COLUMN commission_sales.store_customer_code_snapshot IS
  'Customer code snapshot stored on the commission row at match time.';
COMMENT ON COLUMN commission_sales.match_status IS
  'pending|matched|ambiguous|unmatched|conflict|manual — identity-matching state.';
COMMENT ON COLUMN commission_sales.match_method IS
  'How the identity match was established, for example order_sync or manual_link.';
COMMENT ON COLUMN commission_sales.match_confidence IS
  'Confidence score for the identity match between 0 and 1.';

WITH primary_hot_accounts AS (
  SELECT customer_id, id, hot_mobile_id
  FROM customer_hot_accounts
  WHERE is_primary = TRUE
    AND ended_at IS NULL
)
UPDATE commission_sales AS cs
SET customer_hot_account_id = COALESCE(cs.customer_hot_account_id, pha.id),
    hot_mobile_id_snapshot = COALESCE(cs.hot_mobile_id_snapshot, pha.hot_mobile_id),
    store_customer_code_snapshot = COALESCE(cs.store_customer_code_snapshot, c.customer_code),
    match_status = CASE
      WHEN cs.customer_id IS NOT NULL AND COALESCE(cs.match_status, 'pending') = 'pending' THEN 'matched'
      ELSE cs.match_status
    END,
    match_method = CASE
      WHEN cs.customer_id IS NOT NULL AND cs.match_method IS NULL AND cs.order_id IS NOT NULL THEN 'order_backfill'
      WHEN cs.customer_id IS NOT NULL AND cs.match_method IS NULL THEN 'customer_backfill'
      ELSE cs.match_method
    END,
    match_confidence = CASE
      WHEN cs.customer_id IS NOT NULL AND cs.match_confidence IS NULL THEN 1.0
      ELSE cs.match_confidence
    END
FROM customers AS c
LEFT JOIN primary_hot_accounts AS pha ON pha.customer_id = c.id
WHERE cs.customer_id = c.id;