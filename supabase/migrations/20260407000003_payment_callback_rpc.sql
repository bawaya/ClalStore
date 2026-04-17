-- =====================================================
-- Migration: Atomic Payment Callback RPC
-- 5.3.1: Consolidate payment callback operations into single transaction
-- =====================================================

-- RPC to process payment callback atomically (order update + audit log)
CREATE OR REPLACE FUNCTION process_payment_callback(
  p_order_id TEXT,
  p_payment_status TEXT,       -- 'paid', 'pending', 'pending_capture', 'failed'
  p_order_status TEXT,         -- new order status (e.g. 'approved') or NULL to keep current
  p_transaction_id TEXT,       -- payment_transaction_id
  p_payment_details JSONB,     -- full payment details object
  p_audit_action TEXT,         -- audit log action text
  p_audit_details JSONB        -- audit log details
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Update order payment status + details
  UPDATE orders SET
    payment_status = p_payment_status,
    payment_transaction_id = COALESCE(NULLIF(p_transaction_id, ''), payment_transaction_id),
    status = COALESCE(NULLIF(p_order_status, ''), status),
    payment_details = p_payment_details,
    updated_at = NOW()
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الطلب غير موجود: %', p_order_id;
  END IF;

  -- 2. Audit log
  INSERT INTO audit_log (user_name, action, entity_type, entity_id, details)
  VALUES ('iCredit', p_audit_action, 'payment', p_order_id, p_audit_details);

  RETURN jsonb_build_object('success', true);
END;
$$;
