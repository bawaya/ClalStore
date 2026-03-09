-- =====================================================
-- ClalMobile — Template Usage RPC
-- Migration 015: RPC to increment inbox template usage counter
-- Run in Supabase SQL Editor
-- =====================================================

CREATE OR REPLACE FUNCTION increment_template_usage(tname TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE inbox_templates
  SET usage_count = usage_count + 1
  WHERE name = tname;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===== Done! =====
-- increment_template_usage RPC for tracking template usage
