-- =====================================================
-- ClalMobile — Customer Identity Foundation
-- Adds a stable internal customer code + HOT account linkage
-- =====================================================

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS customer_code TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_customer_code
  ON customers(customer_code)
  WHERE customer_code IS NOT NULL;

COMMENT ON COLUMN customers.customer_code IS
  'Stable internal customer code issued by ClalMobile on first order.';

CREATE TABLE IF NOT EXISTS customer_hot_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  hot_mobile_id TEXT,
  hot_customer_code TEXT,
  line_phone TEXT,
  label TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'verified', 'active', 'inactive', 'conflict', 'transferred')),
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  source TEXT NOT NULL DEFAULT 'admin_manual',
  source_order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  verified_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  verified_by_name TEXT,
  notes TEXT,
  created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by_name TEXT,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    COALESCE(NULLIF(BTRIM(hot_mobile_id), ''), NULLIF(BTRIM(hot_customer_code), '')) IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_customer_hot_accounts_customer_id
  ON customer_hot_accounts(customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_hot_accounts_line_phone_active
  ON customer_hot_accounts(line_phone)
  WHERE ended_at IS NULL AND line_phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customer_hot_accounts_source_order_id
  ON customer_hot_accounts(source_order_id)
  WHERE source_order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_hot_accounts_hot_mobile_id_active
  ON customer_hot_accounts(hot_mobile_id)
  WHERE ended_at IS NULL AND hot_mobile_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_hot_accounts_hot_customer_code_active
  ON customer_hot_accounts(hot_customer_code)
  WHERE ended_at IS NULL AND hot_customer_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_hot_accounts_primary_active
  ON customer_hot_accounts(customer_id)
  WHERE is_primary = TRUE AND ended_at IS NULL;

DROP TRIGGER IF EXISTS trg_customer_hot_accounts_updated_at ON customer_hot_accounts;
CREATE TRIGGER trg_customer_hot_accounts_updated_at
  BEFORE UPDATE ON customer_hot_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE customer_hot_accounts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'customer_hot_accounts'
      AND policyname = 'Service role full access on customer_hot_accounts'
  ) THEN
    CREATE POLICY "Service role full access on customer_hot_accounts"
      ON customer_hot_accounts
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE customer_hot_accounts IS
  'Multiple HOT Mobile identities/accounts linked to a single customer profile.';
