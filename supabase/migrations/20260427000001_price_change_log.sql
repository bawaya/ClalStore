-- =====================================================
-- Price update audit log
-- Records every price/monthly change applied via the
-- /admin/import-excel "تحديث الأسعار" tool, plus inserts
-- for newly created products. Supports per-batch revert.
-- =====================================================

CREATE TABLE IF NOT EXISTS price_change_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id    UUID NOT NULL,
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  action      TEXT NOT NULL CHECK (action IN ('update','insert','revert')),
  old_price   NUMERIC(10,2),
  new_price   NUMERIC(10,2),
  old_monthly NUMERIC(10,2),
  new_monthly NUMERIC(10,2),
  -- Snapshot of variants array before/after, used to revert correctly
  -- when a product has many variants with differing prices.
  old_variants JSONB,
  new_variants JSONB,
  admin_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  reverted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_change_log_batch       ON price_change_log(batch_id);
CREATE INDEX IF NOT EXISTS idx_price_change_log_product     ON price_change_log(product_id);
CREATE INDEX IF NOT EXISTS idx_price_change_log_created_at  ON price_change_log(created_at DESC);

ALTER TABLE price_change_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "price_change_log_auth_all" ON price_change_log
  FOR ALL USING (auth.uid() IS NOT NULL);
