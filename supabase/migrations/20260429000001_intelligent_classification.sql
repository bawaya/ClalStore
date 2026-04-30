-- =====================================================
-- Intelligent Classification — phones/accessories split
--   * Adds accessory subkind taxonomy (34 values)
--   * Adds classification metadata columns on products
--   * Marks 595 "غير معروف" rows as needing classification
--   * Creates classification_history audit log
-- =====================================================

-- ───────────────────────────────────────────────────────
-- 1. Expand subkind whitelist to cover accessory taxonomy
-- ───────────────────────────────────────────────────────

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_subkind_check;
ALTER TABLE products ADD CONSTRAINT products_subkind_check
  CHECK (
    subkind IS NULL
    OR (type = 'tv' AND subkind IN ('oled', 'qled', 'neo_qled', 'mini_led', 'uhd', 'nano', 'fhd', 'other'))
    OR (type = 'computer' AND subkind IN ('laptop_gaming', 'laptop_business', 'laptop_2in1', 'desktop', 'printer_inkjet', 'printer_laser', 'printer_aio', 'other'))
    OR (type = 'tablet' AND subkind IN ('apple_pro', 'apple_air', 'apple_basic', 'kids', 'android', 'other'))
    OR (type = 'network' AND subkind IN ('router_mesh', 'wifi_extender', 'switch', 'access_point', 'other'))
    OR (type = 'accessory' AND subkind IN (
      'case', 'case_tablet', 'case_laptop', 'screen_protector',
      'charger_wall', 'charger_car', 'charger_wireless', 'charger_watch',
      'cable', 'adapter', 'power_bank',
      'earbuds', 'headphones', 'earphones_wired', 'speaker_bluetooth',
      'holder_car', 'holder_desk', 'selfie_stick', 'tripod', 'stylus',
      'memory_card', 'usb_drive', 'watch_band', 'magsafe',
      'ring_holder', 'gaming_grip', 'lens_attachment', 'ring_light',
      'microphone', 'gimbal', 'cleaning_kit', 'battery_replacement',
      'sim_tool', 'vr_headset', 'other'
    ))
    OR (type = 'appliance')
    OR (type = 'device')
  );

-- ───────────────────────────────────────────────────────
-- 2. Classification metadata on products
-- ───────────────────────────────────────────────────────

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS needs_classification     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS classification_confidence REAL,
  ADD COLUMN IF NOT EXISTS last_classified_at        TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_products_needs_classification
  ON products(needs_classification) WHERE needs_classification = true;

-- ───────────────────────────────────────────────────────
-- 3. Mark broken-import rows as needing classification
--    (brand="غير معروف" OR brand is empty/NULL)
-- ───────────────────────────────────────────────────────

UPDATE products
SET needs_classification = true
WHERE brand IS NULL
   OR btrim(brand) = ''
   OR brand = 'غير معروف';

-- ───────────────────────────────────────────────────────
-- 4. classification_history — full audit log
-- ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS classification_history (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID        REFERENCES products(id) ON DELETE CASCADE,
  before_data     JSONB       NOT NULL,
  after_data      JSONB       NOT NULL,
  field_confidence JSONB,                 -- { brand: 0.98, type: 0.95, ... }
  source          TEXT        NOT NULL,
  reviewed_by     UUID        REFERENCES users(id) ON DELETE SET NULL,
  applied_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT classification_history_source_check
    CHECK (source IN ('opus_auto', 'opus_assisted', 'human', 'regex', 'import', 'rollback'))
);

CREATE INDEX IF NOT EXISTS idx_classification_history_product
  ON classification_history(product_id, applied_at DESC);

CREATE INDEX IF NOT EXISTS idx_classification_history_source
  ON classification_history(source, applied_at DESC);

-- RLS: admin-only
ALTER TABLE classification_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS classification_history_admin_all ON classification_history;
CREATE POLICY classification_history_admin_all
  ON classification_history
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
        AND users.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
        AND users.role IN ('admin', 'super_admin')
    )
  );

-- ───────────────────────────────────────────────────────
-- Done
-- ───────────────────────────────────────────────────────
