-- =====================================================
-- Migration 023: Stock & Coupon Data Integrity
-- 1. Add stock check before order creation in RPC
-- 2. Fix coupon race condition with atomic check+increment
-- 3. Add trigger to restore stock on order cancellation/rejection
-- =====================================================

-- ═══════════════════════════════════════════════════════
-- 1. Replace create_order_atomic with stock validation + coupon fix
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
  v_product_stock INT;
  v_product_name TEXT;
  v_qty INT;
  v_coupon_updated INT;
BEGIN
  -- 1. Validate stock for each item BEFORE creating the order
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    IF v_item->>'product_id' IS NOT NULL AND v_item->>'product_id' != '' THEN
      SELECT stock, name_ar INTO v_product_stock, v_product_name
        FROM products
        WHERE id = (v_item->>'product_id')::UUID
        FOR UPDATE; -- Lock the row to prevent concurrent modifications

      v_qty := COALESCE((v_item->>'quantity')::INT, 1);

      IF v_product_stock IS NULL THEN
        RAISE EXCEPTION 'المنتج غير موجود: %', v_item->>'product_id';
      END IF;

      IF v_product_stock < v_qty THEN
        RAISE EXCEPTION 'المخزون غير كافٍ لـ %: متوفر % مطلوب %',
          COALESCE(v_product_name, v_item->>'product_name'), v_product_stock, v_qty;
      END IF;
    END IF;
  END LOOP;

  -- 2. Validate and increment coupon atomically (fixes race condition)
  IF p_coupon_code IS NOT NULL AND p_coupon_code != '' THEN
    UPDATE coupons
    SET used_count = used_count + 1
    WHERE code = UPPER(p_coupon_code)
      AND active = true
      AND (expires_at IS NULL OR expires_at > NOW())
      AND (max_uses = 0 OR used_count < max_uses);

    GET DIAGNOSTICS v_coupon_updated = ROW_COUNT;

    IF v_coupon_updated = 0 THEN
      RAISE EXCEPTION 'الكوبون غير صالح أو تم استنفاذه: %', p_coupon_code;
    END IF;
  END IF;

  -- 3. Create order
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

  -- 4. Create order items
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

  -- 5. Decrement stock for each item (rows already locked above)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    IF v_item->>'product_id' IS NOT NULL AND v_item->>'product_id' != '' THEN
      UPDATE products
      SET stock = stock - COALESCE((v_item->>'quantity')::INT, 1),
          sold  = sold  + COALESCE((v_item->>'quantity')::INT, 1)
      WHERE id = (v_item->>'product_id')::UUID;
    END IF;
  END LOOP;

  -- 6. Audit log
  INSERT INTO audit_log (user_name, action, entity_type, entity_id, details)
  VALUES (
    'النظام',
    format('طلب جديد %s — ₪%s', p_order_id, p_total),
    'order',
    p_order_id,
    jsonb_build_object('source', p_source, 'total', p_total, 'items_count', jsonb_array_length(p_items))
  );

  RETURN jsonb_build_object('success', true, 'order_id', v_order_id);

EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$;


-- ═══════════════════════════════════════════════════════
-- 2. Function to restore stock when order is cancelled/rejected/returned
-- ═══════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION restore_order_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item RECORD;
BEGIN
  -- Only run when status changes TO a cancellation-type status
  -- and the OLD status was NOT already a cancellation-type status
  IF NEW.status IN ('cancelled', 'rejected', 'returned')
     AND OLD.status NOT IN ('cancelled', 'rejected', 'returned')
  THEN
    -- Restore stock for each order item
    FOR v_item IN
      SELECT product_id, quantity
      FROM order_items
      WHERE order_id = NEW.id
        AND product_id IS NOT NULL
    LOOP
      UPDATE products
      SET stock = stock + v_item.quantity,
          sold  = GREATEST(0, sold - v_item.quantity)
      WHERE id = v_item.product_id;
    END LOOP;

    -- Audit log
    INSERT INTO audit_log (user_name, action, entity_type, entity_id, details)
    VALUES (
      'النظام',
      format('إرجاع مخزون — الطلب %s (%s → %s)', NEW.id, OLD.status, NEW.status),
      'order',
      NEW.id,
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status)
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS tr_order_stock_reversal ON orders;
CREATE TRIGGER tr_order_stock_reversal
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION restore_order_stock();
