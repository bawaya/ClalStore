-- =====================================================
-- Migration 021: Atomic order creation RPC + Fix sub_pages RLS
-- =====================================================

-- ═══════════════════════════════════════════════════════
-- 1. Fix sub_pages RLS — restrict authenticated policy
-- ═══════════════════════════════════════════════════════

-- Drop the overly permissive authenticated policy
DROP POLICY IF EXISTS "sub_pages_authenticated_all" ON sub_pages;

-- Re-create: only service_role gets full access (admin API uses service_role key)
-- Authenticated users can only read visible pages (covered by sub_pages_public_read)

-- ═══════════════════════════════════════════════════════
-- 2. Atomic Order Creation RPC
-- Creates order + order_items + increments coupon in one transaction
-- ═══════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION create_order_atomic(
  p_order_id TEXT,
  p_customer_id UUID,
  p_source TEXT,
  p_items_total NUMERIC,
  p_discount_amount NUMERIC,
  p_total NUMERIC,
  p_coupon_code TEXT,
  p_payment_method TEXT,
  p_payment_details JSONB,
  p_shipping_city TEXT,
  p_shipping_address TEXT,
  p_customer_notes TEXT,
  p_items JSONB -- array of {product_id, product_name, product_brand, product_type, price, quantity, color, storage}
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item JSONB;
  v_order_id TEXT;
BEGIN
  -- 1. Create order
  INSERT INTO orders (
    id, customer_id, status, source, items_total, discount_amount, total,
    coupon_code, payment_method, payment_details,
    shipping_city, shipping_address, customer_notes
  ) VALUES (
    p_order_id, p_customer_id, 'new', COALESCE(p_source, 'store'),
    p_items_total, p_discount_amount, p_total,
    NULLIF(p_coupon_code, ''), p_payment_method, COALESCE(p_payment_details, '{}'::jsonb),
    p_shipping_city, p_shipping_address, NULLIF(p_customer_notes, '')
  );

  v_order_id := p_order_id;

  -- 2. Create order items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO order_items (
      order_id, product_id, product_name, product_brand, product_type,
      price, quantity, color, storage
    ) VALUES (
      v_order_id,
      NULLIF(v_item->>'product_id', '')::UUID,
      v_item->>'product_name',
      v_item->>'product_brand',
      v_item->>'product_type',
      (v_item->>'price')::NUMERIC,
      COALESCE((v_item->>'quantity')::INT, 1),
      NULLIF(v_item->>'color', ''),
      NULLIF(v_item->>'storage', '')
    );
  END LOOP;

  -- 3. Increment coupon usage (if coupon was used)
  IF p_coupon_code IS NOT NULL AND p_coupon_code != '' THEN
    UPDATE coupons
    SET used_count = used_count + 1
    WHERE code = UPPER(p_coupon_code);
  END IF;

  -- 4. Decrement stock for each item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    IF v_item->>'product_id' IS NOT NULL AND v_item->>'product_id' != '' THEN
      -- Use existing decrement_stock if available, otherwise direct update
      BEGIN
        PERFORM decrement_stock(
          (v_item->>'product_id')::UUID,
          COALESCE((v_item->>'quantity')::INT, 1),
          NULLIF(v_item->>'storage', '')
        );
      EXCEPTION WHEN undefined_function THEN
        UPDATE products
        SET stock = GREATEST(0, stock - COALESCE((v_item->>'quantity')::INT, 1))
        WHERE id = (v_item->>'product_id')::UUID;
      END;
    END IF;
  END LOOP;

  -- 5. Audit log
  INSERT INTO audit_log (user_name, action, entity_type, entity_id, details)
  VALUES (
    'النظام',
    format('طلب جديد %s — ₪%s', p_order_id, p_total),
    'order',
    p_order_id,
    jsonb_build_object('source', p_source, 'total', p_total, 'items_count', jsonb_array_length(p_items))
  );

  -- All steps succeed or all rollback (single transaction)
  RETURN jsonb_build_object('success', true, 'order_id', v_order_id);

EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$;
