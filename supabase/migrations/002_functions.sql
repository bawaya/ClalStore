-- =====================================================
-- ClalMobile — Additional Database Functions
-- Run AFTER 001_initial_schema.sql
-- =====================================================

-- ===== Decrement product stock =====
CREATE OR REPLACE FUNCTION decrement_stock(product_id UUID, qty INT DEFAULT 1)
RETURNS void AS $$
BEGIN
  UPDATE products
  SET stock = GREATEST(0, stock - qty),
      sold = sold + qty,
      updated_at = NOW()
  WHERE id = product_id;
END;
$$ LANGUAGE plpgsql;

-- ===== Increment coupon usage =====
CREATE OR REPLACE FUNCTION increment_coupon_usage(coupon_code TEXT)
RETURNS void AS $$
BEGIN
  UPDATE coupons
  SET used_count = used_count + 1
  WHERE code = coupon_code;
END;
$$ LANGUAGE plpgsql;

-- ===== Calculate customer segment based on RFM =====
CREATE OR REPLACE FUNCTION update_customer_segment(cust_id UUID)
RETURNS void AS $$
DECLARE
  cust RECORD;
  days_since INT;
BEGIN
  SELECT * INTO cust FROM customers WHERE id = cust_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Days since last order
  days_since := COALESCE(
    EXTRACT(DAY FROM (NOW() - cust.last_order_at)),
    999
  );

  UPDATE customers SET segment = CASE
    WHEN cust.total_spent >= 5000 AND cust.total_orders >= 3 AND days_since < 60 THEN 'vip'
    WHEN cust.total_orders >= 3 AND days_since < 90 THEN 'loyal'
    WHEN days_since < 30 THEN 'active'
    WHEN cust.total_orders = 0 THEN 'new'
    WHEN days_since > 180 THEN 'lost'
    ELSE 'cold'
  END
  WHERE id = cust_id;
END;
$$ LANGUAGE plpgsql;

-- ===== Trigger: Auto-update segment when customer stats change =====
CREATE OR REPLACE FUNCTION trigger_update_segment()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM update_customer_segment(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_customer_segment
  AFTER UPDATE OF total_orders, total_spent, last_order_at ON customers
  FOR EACH ROW EXECUTE FUNCTION trigger_update_segment();
