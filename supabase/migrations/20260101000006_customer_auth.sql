-- =====================================================
-- ClalMobile — Migration 006: Customer Auth (OTP)
-- Passwordless authentication for store customers
-- =====================================================

-- ===== 1. Customer OTP Table =====
CREATE TABLE IF NOT EXISTS customer_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  otp TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_otps_phone ON customer_otps(phone);
CREATE INDEX IF NOT EXISTS idx_customer_otps_expires ON customer_otps(expires_at);

ALTER TABLE customer_otps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_full_otps" ON customer_otps FOR ALL USING (auth.role() = 'service_role');

-- ===== 2. Add auth columns to customers =====
ALTER TABLE customers ADD COLUMN IF NOT EXISTS auth_token TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;

-- Index for token lookup
CREATE INDEX IF NOT EXISTS idx_customers_auth_token ON customers(auth_token) WHERE auth_token IS NOT NULL;

-- ===== 3. Cleanup old OTPs (auto-expire) =====
-- Can be called by cron or on each verify call
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM customer_otps WHERE expires_at < NOW();
END;
$$;
