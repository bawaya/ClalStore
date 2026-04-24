-- =====================================================
-- Israeli Privacy Protection Law — Amendment 13 (Aug 2025) compliance
-- Adds: cookie consent audit trail, customer consent flags,
-- privacy version tracking, order cancellation columns
-- =====================================================

-- ───────────────────────────────────────────────────────
-- 1. consent_log — append-only audit trail of all consent events
-- (cookie banner choices, marketing toggles, privacy acceptance)
-- ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS consent_log (
  id              BIGSERIAL PRIMARY KEY,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Browser-level visitor ID (cookie/localStorage), present even for guests
  visitor_id      TEXT NOT NULL,
  -- If the visitor was logged in at the time, the customer FK
  customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL,
  -- Channel that produced the consent: 'cookie_banner', 'account_settings', 'checkout', 'withdraw'
  source          TEXT NOT NULL,
  -- The four categories. NULL = unchanged in this event.
  essential       BOOLEAN,
  functional      BOOLEAN,
  analytics       BOOLEAN,
  advertising     BOOLEAN,
  -- Privacy policy version the user accepted (semantic version, eg "2026-04-24")
  privacy_version TEXT,
  -- Raw context for debugging/audit
  user_agent      TEXT,
  ip_hash         TEXT,
  CONSTRAINT consent_log_source_check
    CHECK (source IN ('cookie_banner', 'account_settings', 'checkout', 'withdraw', 'system'))
);

CREATE INDEX IF NOT EXISTS idx_consent_log_visitor
  ON consent_log(visitor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consent_log_customer
  ON consent_log(customer_id, created_at DESC) WHERE customer_id IS NOT NULL;

-- RLS: nobody can read except service role (audit data)
ALTER TABLE consent_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS consent_log_service_only ON consent_log;
CREATE POLICY consent_log_service_only ON consent_log
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ───────────────────────────────────────────────────────
-- 2. customers — granular consent flags + privacy version
-- ───────────────────────────────────────────────────────

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS consent_essential        BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS consent_functional       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS consent_analytics        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS consent_advertising      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS consent_marketing_email  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS consent_marketing_sms    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS consent_marketing_whatsapp BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS privacy_version_accepted TEXT,
  ADD COLUMN IF NOT EXISTS privacy_accepted_at      TIMESTAMPTZ,
  -- Soft-delete request tracking (right to erasure)
  ADD COLUMN IF NOT EXISTS deletion_requested_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deletion_processed_at    TIMESTAMPTZ;

-- ───────────────────────────────────────────────────────
-- 3. orders — customer-initiated cancellation columns
-- (under Israeli Consumer Protection — distance sales — 14 days)
-- ───────────────────────────────────────────────────────

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS cancelled_at_customer    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by             TEXT,            -- 'customer' | 'admin' | 'system'
  ADD COLUMN IF NOT EXISTS cancellation_reason      TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_fee         NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS cancellation_refund      NUMERIC(10, 2),
  -- Special-status flag for the 4-month window (elderly/disability/new immigrant)
  ADD COLUMN IF NOT EXISTS extended_cancel_window   BOOLEAN DEFAULT FALSE;

-- ───────────────────────────────────────────────────────
-- 4. data_export_requests — track right-to-portability requests
-- ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS data_export_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at  TIMESTAMPTZ,
  download_url  TEXT,
  expires_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_data_export_customer
  ON data_export_requests(customer_id, requested_at DESC);

ALTER TABLE data_export_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS data_export_service_only ON data_export_requests;
CREATE POLICY data_export_service_only ON data_export_requests
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ───────────────────────────────────────────────────────
-- Done
-- ───────────────────────────────────────────────────────
