-- =====================================================
-- ClalMobile — Sub Pages Table
-- Migration 011: Custom sub-pages managed from admin
-- Run in Supabase SQL Editor
-- =====================================================

CREATE TABLE IF NOT EXISTS sub_pages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title_ar TEXT NOT NULL DEFAULT '',
  title_he TEXT NOT NULL DEFAULT '',
  content_ar TEXT NOT NULL DEFAULT '',
  content_he TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  is_visible BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE sub_pages ENABLE ROW LEVEL SECURITY;

-- Public read policy (visible pages only)
CREATE POLICY "sub_pages_public_read" ON sub_pages
  FOR SELECT USING (is_visible = true);

-- Service role full access
CREATE POLICY "sub_pages_service_all" ON sub_pages
  FOR ALL USING (true) WITH CHECK (true);

-- ===== Done! =====
-- ✅ sub_pages table with bilingual content
-- ✅ RLS enabled with public read + service full access
