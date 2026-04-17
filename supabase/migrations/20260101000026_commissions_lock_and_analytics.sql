-- =====================================================
-- ClalMobile — Commission Lock & Analytics Migration
-- Adds is_locked to targets + indexes for analytics
-- =====================================================

-- Add is_locked flag to commission_targets
ALTER TABLE commission_targets ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;
ALTER TABLE commission_targets ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ DEFAULT NULL;

-- Add target_lines_count and target_devices_count for detailed tracking
ALTER TABLE commission_targets ADD COLUMN IF NOT EXISTS target_lines_count INTEGER DEFAULT 0;
ALTER TABLE commission_targets ADD COLUMN IF NOT EXISTS target_devices_count INTEGER DEFAULT 0;
