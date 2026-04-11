-- =====================================================
-- ClalMobile — Migration: Customer Retention Phase 1
-- 1. customer_code (DB-generated via sequence + trigger, immutable)
-- 2. customer_hot_accounts (1:N — multiple HOT IDs per customer)
-- 3. Phone normalization trigger
-- =====================================================

-- ===== Part A: customer_code =====
CREATE SEQUENCE IF NOT EXISTS customer_code_seq
  START WITH 100000 MINVALUE 100000 MAXVALUE 999999 NO CYCLE;

ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_code TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_customer_code
  ON customers(customer_code) WHERE customer_code IS NOT NULL;

-- Assign on INSERT
CREATE OR REPLACE FUNCTION assign_customer_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.customer_code IS NULL THEN
    NEW.customer_code := 'CLAL-' || LPAD(nextval('customer_code_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_customers_assign_code ON customers;
CREATE TRIGGER trg_customers_assign_code
  BEFORE INSERT ON customers FOR EACH ROW EXECUTE FUNCTION assign_customer_code();

-- Protect on UPDATE (allow NULL→code for backfill, block code→code change)
CREATE OR REPLACE FUNCTION protect_customer_code()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.customer_code IS NOT NULL AND NEW.customer_code IS DISTINCT FROM OLD.customer_code THEN
    RAISE EXCEPTION 'customer_code is immutable (old=%, new=%)', OLD.customer_code, NEW.customer_code;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_customers_protect_code ON customers;
CREATE TRIGGER trg_customers_protect_code
  BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION protect_customer_code();

-- RPC: trickle-in backfill for legacy customers
CREATE OR REPLACE FUNCTION assign_code_to_existing_customer(p_customer_id UUID)
RETURNS TEXT AS $$
DECLARE v_code TEXT;
BEGIN
  SELECT customer_code INTO v_code FROM customers WHERE id = p_customer_id;
  IF v_code IS NOT NULL THEN RETURN v_code; END IF;
  v_code := 'CLAL-' || LPAD(nextval('customer_code_seq')::text, 6, '0');
  UPDATE customers SET customer_code = v_code WHERE id = p_customer_id AND customer_code IS NULL;
  RETURN v_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON COLUMN customers.customer_code IS
  'Store-issued code (CLAL-XXXXXX), assigned by DB trigger on INSERT. Immutable.';

-- ===== Part B: Phone normalization =====
CREATE OR REPLACE FUNCTION normalize_customer_phone()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.phone IS NOT NULL THEN
    NEW.phone := regexp_replace(NEW.phone, '[\s\-\.]', '', 'g');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_customers_normalize_phone ON customers;
CREATE TRIGGER trg_customers_normalize_phone
  BEFORE INSERT OR UPDATE OF phone ON customers
  FOR EACH ROW EXECUTE FUNCTION normalize_customer_phone();

-- ===== Part C: customer_hot_accounts =====
CREATE TABLE IF NOT EXISTS customer_hot_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  hot_mobile_id TEXT NOT NULL,
  hot_customer_code TEXT,
  line_phone TEXT,
  label TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending','active','inactive','cancelled','transferred')),
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  source TEXT NOT NULL DEFAULT 'admin_manual'
    CHECK (source IN ('admin_manual','sales_doc','order_sync','import')),
  source_order_id TEXT,
  verified_at TIMESTAMPTZ,
  verified_by_id UUID,
  verified_by_name TEXT,
  ended_at TIMESTAMPTZ,
  notes TEXT,
  created_by_id UUID,
  created_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial uniqueness — allows transfer via close+recreate
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_hot_accounts_active_hot_id
  ON customer_hot_accounts(hot_mobile_id)
  WHERE status IN ('pending','active');

CREATE INDEX IF NOT EXISTS idx_customer_hot_accounts_customer
  ON customer_hot_accounts(customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_hot_accounts_status
  ON customer_hot_accounts(status) WHERE status IN ('pending','active');

-- One primary active account per customer
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_hot_accounts_one_primary
  ON customer_hot_accounts(customer_id)
  WHERE is_primary = TRUE AND status IN ('pending','active');

CREATE OR REPLACE FUNCTION update_customer_hot_accounts_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_customer_hot_accounts_updated_at ON customer_hot_accounts;
CREATE TRIGGER trg_customer_hot_accounts_updated_at
  BEFORE UPDATE ON customer_hot_accounts
  FOR EACH ROW EXECUTE FUNCTION update_customer_hot_accounts_updated_at();

ALTER TABLE customer_hot_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_hot_accounts_service_role_all"
  ON customer_hot_accounts FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE customer_hot_accounts IS
  'Multiple HOT Mobile accounts per customer. Transfers done via close+recreate (status=transferred + ended_at).';

-- ===== Part D: Safety net index on phone =====
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
