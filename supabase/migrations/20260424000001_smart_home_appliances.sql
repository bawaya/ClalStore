-- =====================================================
-- Smart Home Appliances (ClalHome sub-brand) — 2026-04-24
-- =====================================================
-- Extends the existing catalog to support smart appliances
-- (robot vacuums, air fryers, espresso machines, etc.) without
-- breaking the mobile/accessory pipeline.
--
-- Sections:
--   1. products.type: add 'appliance' + appliance-specific columns
--   2. products.variant_kind: flexible variants (storage / model / color_only)
--   3. categories.kind: separate taxonomy for mobile vs appliance
--   4. commission_sales.sale_type: allow 'appliance'
--   5. employee_commission_profiles: appliance_rate + milestone bonus
--      (isolated counters — appliance milestones never mix with device)
-- =====================================================

-- =====================================================
-- 1. products.type — add 'appliance'
-- =====================================================

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_type_check;
ALTER TABLE products ADD CONSTRAINT products_type_check
  CHECK (type IN ('device', 'accessory', 'appliance'));

-- =====================================================
-- 2. products — appliance-specific columns
-- =====================================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS warranty_months INT,
  ADD COLUMN IF NOT EXISTS model_number TEXT,
  ADD COLUMN IF NOT EXISTS variant_kind TEXT NOT NULL DEFAULT 'storage',
  ADD COLUMN IF NOT EXISTS appliance_kind TEXT;

-- Drop constraints if re-running
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_variant_kind_check;
ALTER TABLE products ADD CONSTRAINT products_variant_kind_check
  CHECK (variant_kind IN ('storage', 'model', 'color_only'));

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_appliance_kind_check;
ALTER TABLE products ADD CONSTRAINT products_appliance_kind_check
  CHECK (
    appliance_kind IS NULL
    OR appliance_kind IN (
      'robot_vacuum',
      'air_fryer',
      'espresso',
      'kettle',
      'blender',
      'ninja_pot',
      'coffee_maker',
      'iron',
      'hair_dryer',
      'smart_speaker',
      'other'
    )
  );

-- Enforce: appliance_kind required iff type='appliance'
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_appliance_kind_required;
ALTER TABLE products ADD CONSTRAINT products_appliance_kind_required
  CHECK (
    (type <> 'appliance' AND appliance_kind IS NULL)
    OR (type = 'appliance' AND appliance_kind IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_products_appliance_kind
  ON products(appliance_kind) WHERE type = 'appliance';

-- =====================================================
-- 3. categories — kind (mobile vs appliance)
-- =====================================================

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'mobile';

ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_kind_check;
ALTER TABLE categories ADD CONSTRAINT categories_kind_check
  CHECK (kind IN ('mobile', 'appliance'));

CREATE INDEX IF NOT EXISTS idx_categories_kind ON categories(kind);

-- =====================================================
-- 4. commission_sales.sale_type — allow 'appliance'
-- =====================================================

ALTER TABLE commission_sales DROP CONSTRAINT IF EXISTS commission_sales_sale_type_check;
ALTER TABLE commission_sales ADD CONSTRAINT commission_sales_sale_type_check
  CHECK (sale_type IN ('line', 'device', 'appliance'));

-- =====================================================
-- 5. employee_commission_profiles — appliance rates
-- =====================================================
-- Mirrors device_rate / device_milestone_bonus but tracks a
-- SEPARATE milestone counter so appliance sales never affect
-- device milestone progression and vice versa.

-- Matches device_rate + device_milestone_bonus pattern exactly.
-- Uses the same 50,000₪ milestone threshold as devices (see COMMISSION.APPLIANCE_MILESTONE),
-- but tracks a SEPARATE contract-wide running total so appliance sales never
-- affect device milestone progression and vice versa.
ALTER TABLE employee_commission_profiles
  ADD COLUMN IF NOT EXISTS appliance_rate REAL NOT NULL DEFAULT 0.05,
  ADD COLUMN IF NOT EXISTS appliance_milestone_bonus REAL NOT NULL DEFAULT 0;

-- =====================================================
-- 6. Category seed rows (optional starter categories)
-- =====================================================
-- Appliance categories visible in /store/smart-home
INSERT INTO categories (name_ar, name_he, type, kind, sort_order, active)
VALUES
  ('روبوتات فاكوم', 'שואב רובוטי', 'manual', 'appliance', 10, true),
  ('قلايات هوائية', 'מטגנים אוויר', 'manual', 'appliance', 20, true),
  ('آلات إسبرسو', 'מכונות אספרסו', 'manual', 'appliance', 30, true),
  ('خلاطات ذكية', 'בלנדרים חכמים', 'manual', 'appliance', 40, true),
  ('غلايات كهربائية', 'קומקומים חשמליים', 'manual', 'appliance', 50, true)
ON CONFLICT DO NOTHING;

-- =====================================================
-- Done
-- =====================================================
-- After this migration:
--   * products can be typed 'appliance' with warranty_months, model_number,
--     variant_kind, appliance_kind.
--   * categories are split by kind: mobile (default) vs appliance.
--   * commission_sales accepts sale_type='appliance'.
--   * employee_commission_profiles exposes appliance_rate and
--     appliance_milestone_bonus (independent of device_rate /
--     device_milestone_bonus — same 50K threshold, separate counter).
--   * RLS policies on products, categories, commission_sales, and
--     employee_commission_profiles remain unchanged and cover the new
--     columns automatically.
--   * The check_month_lock trigger continues to protect appliance sales
--     without modification.
-- =====================================================
