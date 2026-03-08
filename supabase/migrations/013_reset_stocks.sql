-- =====================================================
-- ClalMobile — إصلاح مخزون المنتجات (طارئ)
-- Migration 013: Reset all zero variant stocks to reasonable values
-- Run in Supabase SQL Editor IMMEDIATELY
-- =====================================================

-- ===== 1. Reset product-level stock if = 0 =====
UPDATE products
SET stock = 10,
    updated_at = NOW()
WHERE stock = 0 AND active = true;

-- ===== 2. Reset variant-level stock inside JSONB if = 0 or missing =====
-- This fixes variants that were saved with stock=0 (default value)
UPDATE products
SET
  variants = (
    SELECT jsonb_agg(
      CASE
        WHEN (v->>'stock') IS NULL THEN jsonb_set(v, '{stock}', '5')
        WHEN (v->>'stock')::int <= 0 THEN jsonb_set(v, '{stock}', '5')
        ELSE v
      END
    )
    FROM jsonb_array_elements(variants) v
  ),
  updated_at = NOW()
WHERE
  variants IS NOT NULL
  AND jsonb_array_length(variants) > 0
  AND active = true
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(variants) v
    WHERE (v->>'stock') IS NULL OR (v->>'stock')::int <= 0
  );

-- ===== 3. Update decrement_stock function to also handle variant JSONB stocks =====
CREATE OR REPLACE FUNCTION decrement_stock(product_id UUID, qty INT DEFAULT 1, variant_storage TEXT DEFAULT NULL)
RETURNS void AS $$
BEGIN
  -- Always decrement product-level stock
  UPDATE products
  SET stock = GREATEST(0, stock - qty),
      sold = sold + qty,
      updated_at = NOW()
  WHERE id = product_id;

  -- If variant_storage is provided, also decrement that variant's stock in JSONB
  IF variant_storage IS NOT NULL THEN
    UPDATE products
    SET variants = (
      SELECT jsonb_agg(
        CASE
          WHEN v->>'storage' = variant_storage
          THEN jsonb_set(v, '{stock}', to_jsonb(GREATEST(0, COALESCE((v->>'stock')::int, 0) - qty)))
          ELSE v
        END
      )
      FROM jsonb_array_elements(variants) v
    ),
    updated_at = NOW()
    WHERE id = product_id
      AND variants IS NOT NULL
      AND jsonb_array_length(variants) > 0;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ===== Verify after fix =====
-- SELECT id, name_ar, stock, 
--   (SELECT min((v->>'stock')::int) FROM jsonb_array_elements(variants) v) as min_variant_stock
-- FROM products WHERE active = true ORDER BY name_ar;
