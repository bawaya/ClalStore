-- =====================================================
-- 012: Add name_en column to products table
-- Stores the English product name for editing reference
-- =====================================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS name_en TEXT DEFAULT '';
