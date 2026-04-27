-- =====================================================
-- Installment display mode per product
-- 'auto' (default) -> show ₪{monthly_price} × {months}
-- 'text'           -> show static text "حتى 18 قسط بدون فوائد"
--
-- Used for products imported via the 2-column price-update flow
-- (accessories, appliances, etc. without an explicit monthly price).
-- All existing rows keep the current behaviour via the default value.
-- =====================================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS installment_display TEXT NOT NULL DEFAULT 'auto'
    CHECK (installment_display IN ('auto', 'text'));

CREATE INDEX IF NOT EXISTS idx_products_installment_display
  ON products(installment_display);
