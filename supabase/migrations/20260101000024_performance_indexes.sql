-- =====================================================
-- Migration 024: Performance Indexes
-- Add missing indexes for frequently queried columns
-- =====================================================

-- audit_log: queries filter/sort by created_at
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at
  ON audit_log (created_at DESC);

-- audit_log: payment IPN idempotency lookup
CREATE INDEX IF NOT EXISTS idx_audit_log_entity
  ON audit_log (entity_type, entity_id);

-- bot_messages: conversation message history queries
CREATE INDEX IF NOT EXISTS idx_bot_messages_conv_created
  ON bot_messages (conversation_id, created_at DESC);

-- inbox_conversations: inbox list sorted by last message
CREATE INDEX IF NOT EXISTS idx_inbox_conversations_last_msg
  ON inbox_conversations (last_message_at DESC);

-- orders: payment status filtering (admin/reports)
CREATE INDEX IF NOT EXISTS idx_orders_payment_status
  ON orders (payment_status);

-- orders: status filtering (CRM dashboard)
CREATE INDEX IF NOT EXISTS idx_orders_status
  ON orders (status);

-- customers: last_order_at for segment/sort queries
CREATE INDEX IF NOT EXISTS idx_customers_last_order
  ON customers (last_order_at DESC NULLS LAST);

-- customer_otps: phone + verified lookup for OTP verification
CREATE INDEX IF NOT EXISTS idx_customer_otps_phone_verified
  ON customer_otps (phone, verified, expires_at DESC);
