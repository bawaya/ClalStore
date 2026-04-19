-- =====================================================================
-- ClalMobile — Sales Requests workflow
-- 2026-04-19
--
-- Employee submits a sale-request via the PWA; super_admin reviews and
-- either approves (which spawns the actual commission_sales rows and
-- credits the employee), asks for more info, or rejects.
--
-- Tables:
--   sales_requests          — main request (customer + bank + totals + status)
--   sales_request_devices   — 1..N devices attached to a request
--   sales_request_packages  — 0..N packages (each with a line count)
--   sales_request_events    — audit trail (submit/info/approve/reject/…)
--
-- Status lifecycle:
--   draft       → employee is still filling it (private to them)
--   pending     → submitted; awaiting super_admin review
--   needs_info  → super_admin asked for more details; employee can reply
--   approved    → super_admin approved; commission_sales rows have been
--                 created and employee credited
--   rejected    → super_admin rejected with a reason
-- =====================================================================

CREATE TABLE IF NOT EXISTS sales_requests (
  id BIGSERIAL PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending', 'needs_info', 'approved', 'rejected')),

  -- Customer identification (filled by employee)
  customer_name TEXT NOT NULL,
  customer_id_number TEXT NOT NULL,          -- Israeli national ID, 9 digits (checksum validated app-side)
  contact_number TEXT NOT NULL,              -- 05X + 8 digits
  delivery_address TEXT NOT NULL,            -- free text; selected from locality autocomplete
  locality_name TEXT,                        -- canonical locality name (from the typeahead)

  -- Bank (for הוראת קבע / standing order)
  bank_name TEXT NOT NULL,
  bank_code TEXT,                            -- 2-digit bank code (e.g. "10", "12")
  bank_branch TEXT NOT NULL,                 -- exactly 3 digits
  bank_account TEXT NOT NULL,                -- 4..9 digits

  -- Totals (denormalised for fast listing; recomputed on each upsert)
  total_devices_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_packages_monthly NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_lines_count INTEGER NOT NULL DEFAULT 0,
  total_devices_count INTEGER NOT NULL DEFAULT 0,

  -- Review lifecycle
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id),
  review_note TEXT,                          -- admin's note on approval / rejection / info request

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS sales_request_devices (
  id BIGSERIAL PRIMARY KEY,
  request_id BIGINT NOT NULL REFERENCES sales_requests(id) ON DELETE CASCADE,
  device_name TEXT NOT NULL,
  total_price NUMERIC(12,2) NOT NULL CHECK (total_price > 0),
  installments_count INTEGER NOT NULL CHECK (installments_count BETWEEN 1 AND 60),
  -- monthly_installment is derived; kept for display convenience
  monthly_installment NUMERIC(12,2) GENERATED ALWAYS AS
    (ROUND(total_price / NULLIF(installments_count, 0), 2)) STORED,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales_request_packages (
  id BIGSERIAL PRIMARY KEY,
  request_id BIGINT NOT NULL REFERENCES sales_requests(id) ON DELETE CASCADE,
  package_name TEXT NOT NULL,
  monthly_price NUMERIC(12,2) NOT NULL CHECK (monthly_price > 0),
  lines_count INTEGER NOT NULL DEFAULT 1 CHECK (lines_count BETWEEN 1 AND 20),
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales_request_events (
  id BIGSERIAL PRIMARY KEY,
  request_id BIGINT NOT NULL REFERENCES sales_requests(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('created', 'submitted', 'info_requested', 'info_provided',
                          'approved', 'rejected', 'edited', 'deleted')),
  actor_id UUID REFERENCES users(id),
  actor_role TEXT,                           -- 'employee' | 'admin' | 'super_admin'
  message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- Indexes
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_sales_requests_employee_status
  ON sales_requests(employee_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sales_requests_status_submitted
  ON sales_requests(status, submitted_at DESC NULLS LAST) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sales_requests_customer_id
  ON sales_requests(customer_id_number) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sales_request_devices_request
  ON sales_request_devices(request_id);
CREATE INDEX IF NOT EXISTS idx_sales_request_packages_request
  ON sales_request_packages(request_id);
CREATE INDEX IF NOT EXISTS idx_sales_request_events_request
  ON sales_request_events(request_id, created_at DESC);

-- =====================================================================
-- updated_at trigger
-- =====================================================================
CREATE OR REPLACE FUNCTION set_sales_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sales_requests_updated_at ON sales_requests;
CREATE TRIGGER trg_sales_requests_updated_at
  BEFORE UPDATE ON sales_requests
  FOR EACH ROW EXECUTE FUNCTION set_sales_requests_updated_at();

-- =====================================================================
-- Row Level Security — all routes use the service role, but we still
-- enable RLS so that any accidental client-side direct-table query
-- without the service key returns nothing.
-- =====================================================================
ALTER TABLE sales_requests          ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_request_devices   ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_request_packages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_request_events    ENABLE ROW LEVEL SECURITY;

-- Deny-all for anon; service role bypasses RLS by default.
DROP POLICY IF EXISTS "sales_requests_service_only" ON sales_requests;
CREATE POLICY "sales_requests_service_only" ON sales_requests
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "sales_request_devices_service_only" ON sales_request_devices;
CREATE POLICY "sales_request_devices_service_only" ON sales_request_devices
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "sales_request_packages_service_only" ON sales_request_packages;
CREATE POLICY "sales_request_packages_service_only" ON sales_request_packages
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "sales_request_events_service_only" ON sales_request_events;
CREATE POLICY "sales_request_events_service_only" ON sales_request_events
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- =====================================================================
-- Comments
-- =====================================================================
COMMENT ON TABLE sales_requests IS
  'Sale-order requests submitted by employees via the PWA. On approval, spawns commission_sales rows credited to the employee.';
COMMENT ON TABLE sales_request_devices IS
  'Devices attached to a request. At least one device is required before a request can transition from draft to pending.';
COMMENT ON TABLE sales_request_packages IS
  'Line-packages (הבילות) attached to a request. Optional. Each package has monthly_price and a lines_count; on approval N commission_sales rows are created per package.';
COMMENT ON TABLE sales_request_events IS
  'Audit trail for each request — who did what when. Includes employee submissions and admin approvals / rejections / info requests.';
