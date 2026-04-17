-- =====================================================
-- ClalMobile — Sales Documentation (PWA)
-- Adds a documentation layer that can sync into commissions.
-- =====================================================

-- Notes:
-- - Uses soft delete via deleted_at.
-- - doc_uuid is stable client identifier (offline-friendly).
-- - idempotency_key prevents duplicate sync under retries.

CREATE TABLE IF NOT EXISTS sales_docs (
  id BIGSERIAL PRIMARY KEY,
  doc_uuid UUID NOT NULL DEFAULT gen_random_uuid(),

  -- Identity / attribution
  employee_user_id TEXT NULL, -- internal users.id if linked
  employee_key TEXT NOT NULL, -- canonical scope key (usually users.id, or external key)

  -- Optional linkage
  customer_id TEXT NULL,
  order_id TEXT NULL,

  -- Classification
  sale_type TEXT NOT NULL CHECK (sale_type IN ('line', 'device', 'mixed')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'verified', 'rejected', 'synced_to_commissions')),

  -- Business fields
  sale_date DATE NULL,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'ILS',
  source TEXT NOT NULL DEFAULT 'pwa',

  -- Audit fields
  created_by TEXT NOT NULL,
  submitted_at TIMESTAMPTZ NULL,
  verified_at TIMESTAMPTZ NULL,
  rejected_at TIMESTAMPTZ NULL,
  synced_at TIMESTAMPTZ NULL,
  rejection_reason TEXT NULL,
  notes TEXT NULL,

  -- Offline / sync
  device_client_id TEXT NULL,
  idempotency_key TEXT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_sales_docs_doc_uuid ON sales_docs (doc_uuid);
CREATE INDEX IF NOT EXISTS idx_sales_docs_employee_key ON sales_docs (employee_key) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sales_docs_order_id ON sales_docs (order_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sales_docs_status_sale_date ON sales_docs (status, sale_date) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_sales_docs_idempotency
  ON sales_docs (employee_key, idempotency_key)
  WHERE deleted_at IS NULL AND idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS sales_doc_items (
  id BIGSERIAL PRIMARY KEY,
  sales_doc_id BIGINT NOT NULL REFERENCES sales_docs(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('line', 'device', 'accessory')),
  product_id TEXT NULL,
  product_name TEXT NULL,
  qty INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  line_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_sales_doc_items_doc ON sales_doc_items (sales_doc_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sales_doc_items_type ON sales_doc_items (item_type) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS sales_doc_attachments (
  id BIGSERIAL PRIMARY KEY,
  sales_doc_id BIGINT NOT NULL REFERENCES sales_docs(id) ON DELETE CASCADE,
  attachment_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  sha256 TEXT NULL,
  uploaded_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_sales_doc_attachments_doc ON sales_doc_attachments (sales_doc_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sales_doc_attachments_type ON sales_doc_attachments (attachment_type) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS sales_doc_events (
  id BIGSERIAL PRIMARY KEY,
  sales_doc_id BIGINT NOT NULL REFERENCES sales_docs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_user_id TEXT NULL,
  actor_role TEXT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_doc_events_doc_created ON sales_doc_events (sales_doc_id, created_at);

-- Optional: server-side queue for async syncing (can be used later)
CREATE TABLE IF NOT EXISTS sales_doc_sync_queue (
  id BIGSERIAL PRIMARY KEY,
  sales_doc_id BIGINT NOT NULL REFERENCES sales_docs(id) ON DELETE CASCADE,
  sync_target TEXT NOT NULL DEFAULT 'commissions',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT NULL,
  next_retry_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_doc_sync_queue_status ON sales_doc_sync_queue (status, next_retry_at);

