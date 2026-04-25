-- =====================================================
-- Integration Secrets Vault
-- Encrypted secret storage for integration credentials
-- =====================================================

CREATE TABLE IF NOT EXISTS integration_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  secret_key TEXT NOT NULL,
  encrypted_value TEXT NOT NULL,
  value_hint TEXT,
  key_version INT NOT NULL DEFAULT 1,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (integration_id, secret_key)
);

CREATE INDEX IF NOT EXISTS idx_integration_secrets_integration_id
  ON integration_secrets(integration_id);

ALTER TABLE integration_secrets ENABLE ROW LEVEL SECURITY;

-- No direct client policies on this table.
-- Secrets are accessed only through server-side service-role code.
