-- =====================================================
-- ClalMobile — User Management Enhancement
-- Adds password management fields to users table
-- =====================================================

-- Add must_change_password flag for first-login flow
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

-- Add temp password expiry (24 hours from creation)
ALTER TABLE users ADD COLUMN IF NOT EXISTS temp_password_expires_at TIMESTAMPTZ;

-- Add invited_by to track who invited the user
ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES users(id);

-- Add invited_at timestamp
ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ;

-- Index for active users lookup
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
