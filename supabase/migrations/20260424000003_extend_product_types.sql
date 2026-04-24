-- =====================================================
-- Self-contained migration: extend product taxonomy
--   * Adds appliance + new product families: tv, computer, tablet, network
--   * Adds appliance-related columns if missing (idempotent — safe to run on
--     databases where 20260424000001_smart_home_appliances.sql was skipped)
--   * Adds subkind column for non-appliance categories
--   * Updates commission_sales.sale_type whitelist
-- =====================================================

-- ───────────────────────────────────────────────────────
-- 1. Ensure all needed columns exist
-- ───────────────────────────────────────────────────────

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS warranty_months INT,
  ADD COLUMN IF NOT EXISTS model_number    TEXT,
  ADD COLUMN IF NOT EXISTS variant_kind    TEXT NOT NULL DEFAULT 'storage',
  ADD COLUMN IF NOT EXISTS appliance_kind  TEXT,
  ADD COLUMN IF NOT EXISTS subkind         TEXT;

CREATE INDEX IF NOT EXISTS idx_products_appliance_kind
  ON products(appliance_kind) WHERE type = 'appliance';

CREATE INDEX IF NOT EXISTS idx_products_subkind
  ON products(subkind) WHERE subkind IS NOT NULL;

-- ───────────────────────────────────────────────────────
-- 2. categories.kind (mobile vs appliance) — needed by getCategories({kind})
-- ───────────────────────────────────────────────────────

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'mobile';

ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_kind_check;
ALTER TABLE categories ADD CONSTRAINT categories_kind_check
  CHECK (kind IN ('mobile', 'appliance'));

CREATE INDEX IF NOT EXISTS idx_categories_kind ON categories(kind);

-- ───────────────────────────────────────────────────────
-- 3. products.type — accept the full set of product families
-- ───────────────────────────────────────────────────────

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_type_check;
ALTER TABLE products ADD CONSTRAINT products_type_check
  CHECK (type IN ('device', 'accessory', 'appliance', 'tv', 'computer', 'tablet', 'network'));

-- ───────────────────────────────────────────────────────
-- 4. variant_kind whitelist
-- ───────────────────────────────────────────────────────

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_variant_kind_check;
ALTER TABLE products ADD CONSTRAINT products_variant_kind_check
  CHECK (variant_kind IN ('storage', 'model', 'color_only'));

-- ───────────────────────────────────────────────────────
-- 5. appliance_kind whitelist (with extended categories)
-- ───────────────────────────────────────────────────────

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
      'food_processor',
      'stand_mixer',
      'stick_vacuum',
      'hair_styler',
      'shaver_trimmer',
      'juicer',
      'toaster',
      'steam_grill',
      'popcorn',
      'ice_maker',
      'ipl_hair_removal',
      'cookware_set',
      'fan',
      'microwave',
      'other'
    )
  );

-- ───────────────────────────────────────────────────────
-- 6. appliance_kind required iff type='appliance' (only for appliance type)
-- ───────────────────────────────────────────────────────

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_appliance_kind_required;
ALTER TABLE products ADD CONSTRAINT products_appliance_kind_required
  CHECK (
    (type <> 'appliance' AND appliance_kind IS NULL)
    OR (type = 'appliance' AND appliance_kind IS NOT NULL)
  );

-- ───────────────────────────────────────────────────────
-- 7. subkind whitelist per product type
-- ───────────────────────────────────────────────────────

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_subkind_check;
ALTER TABLE products ADD CONSTRAINT products_subkind_check
  CHECK (
    subkind IS NULL
    OR (type = 'tv' AND subkind IN ('oled', 'qled', 'neo_qled', 'mini_led', 'uhd', 'nano', 'fhd', 'other'))
    OR (type = 'computer' AND subkind IN ('laptop_gaming', 'laptop_business', 'laptop_2in1', 'desktop', 'printer_inkjet', 'printer_laser', 'printer_aio', 'other'))
    OR (type = 'tablet' AND subkind IN ('apple_pro', 'apple_air', 'apple_basic', 'kids', 'android', 'other'))
    OR (type = 'network' AND subkind IN ('router_mesh', 'wifi_extender', 'switch', 'access_point', 'other'))
    OR (type = 'appliance')
    OR (type IN ('device', 'accessory'))
  );

-- ───────────────────────────────────────────────────────
-- 8. commission_sales.sale_type — accept new product families
-- ───────────────────────────────────────────────────────

ALTER TABLE commission_sales DROP CONSTRAINT IF EXISTS commission_sales_sale_type_check;
ALTER TABLE commission_sales ADD CONSTRAINT commission_sales_sale_type_check
  CHECK (sale_type IN ('line', 'device', 'appliance', 'tv', 'computer', 'tablet', 'network'));

-- ───────────────────────────────────────────────────────
-- 9. employee_commission_profiles — appliance rate (idempotent)
-- ───────────────────────────────────────────────────────

ALTER TABLE employee_commission_profiles
  ADD COLUMN IF NOT EXISTS appliance_rate            REAL NOT NULL DEFAULT 0.05,
  ADD COLUMN IF NOT EXISTS appliance_milestone_bonus REAL NOT NULL DEFAULT 0;

-- ───────────────────────────────────────────────────────
-- Done
-- ───────────────────────────────────────────────────────
