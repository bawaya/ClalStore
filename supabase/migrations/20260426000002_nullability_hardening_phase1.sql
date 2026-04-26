-- Phase 1 nullability hardening
-- Tightens columns that are already clean in live data and have safe write-path
-- defaults or explicit application writes. Does not touch columns that are
-- intentionally nullable by design (for example FK columns with ON DELETE SET NULL).

-- =====================================================
-- users
-- =====================================================
UPDATE users
SET
  auth_id = COALESCE(auth_id, gen_random_uuid()),
  created_at = COALESCE(created_at, NOW())
WHERE auth_id IS NULL OR created_at IS NULL;

ALTER TABLE users
  ALTER COLUMN auth_id SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL;

-- =====================================================
-- products
-- =====================================================
UPDATE products
SET
  cost = COALESCE(cost, 0),
  stock = COALESCE(stock, 0),
  sold = COALESCE(sold, 0),
  gallery = COALESCE(gallery, '{}'::text[]),
  colors = COALESCE(colors, '[]'::jsonb),
  storage_options = COALESCE(storage_options, '{}'::text[]),
  specs = COALESCE(specs, '{}'::jsonb),
  active = COALESCE(active, true),
  featured = COALESCE(featured, false),
  variants = COALESCE(variants, '[]'::jsonb),
  created_at = COALESCE(created_at, NOW()),
  updated_at = COALESCE(updated_at, NOW())
WHERE
  cost IS NULL OR
  stock IS NULL OR
  sold IS NULL OR
  gallery IS NULL OR
  colors IS NULL OR
  storage_options IS NULL OR
  specs IS NULL OR
  active IS NULL OR
  featured IS NULL OR
  variants IS NULL OR
  created_at IS NULL OR
  updated_at IS NULL;

ALTER TABLE products
  ALTER COLUMN cost SET DEFAULT 0,
  ALTER COLUMN stock SET DEFAULT 0,
  ALTER COLUMN sold SET DEFAULT 0,
  ALTER COLUMN gallery SET DEFAULT '{}'::text[],
  ALTER COLUMN colors SET DEFAULT '[]'::jsonb,
  ALTER COLUMN storage_options SET DEFAULT '{}'::text[],
  ALTER COLUMN specs SET DEFAULT '{}'::jsonb,
  ALTER COLUMN active SET DEFAULT true,
  ALTER COLUMN featured SET DEFAULT false,
  ALTER COLUMN variants SET DEFAULT '[]'::jsonb,
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET DEFAULT NOW(),
  ALTER COLUMN cost SET NOT NULL,
  ALTER COLUMN stock SET NOT NULL,
  ALTER COLUMN sold SET NOT NULL,
  ALTER COLUMN gallery SET NOT NULL,
  ALTER COLUMN colors SET NOT NULL,
  ALTER COLUMN storage_options SET NOT NULL,
  ALTER COLUMN specs SET NOT NULL,
  ALTER COLUMN active SET NOT NULL,
  ALTER COLUMN featured SET NOT NULL,
  ALTER COLUMN variants SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

-- =====================================================
-- customers
-- =====================================================
UPDATE customers
SET
  total_orders = COALESCE(total_orders, 0),
  total_spent = COALESCE(total_spent, 0),
  avg_order_value = COALESCE(avg_order_value, 0),
  segment = COALESCE(segment, 'new'),
  tags = COALESCE(tags, '{}'::text[]),
  created_at = COALESCE(created_at, NOW()),
  updated_at = COALESCE(updated_at, NOW())
WHERE
  total_orders IS NULL OR
  total_spent IS NULL OR
  avg_order_value IS NULL OR
  segment IS NULL OR
  tags IS NULL OR
  created_at IS NULL OR
  updated_at IS NULL;

ALTER TABLE customers
  ALTER COLUMN total_orders SET DEFAULT 0,
  ALTER COLUMN total_spent SET DEFAULT 0,
  ALTER COLUMN avg_order_value SET DEFAULT 0,
  ALTER COLUMN segment SET DEFAULT 'new',
  ALTER COLUMN tags SET DEFAULT '{}'::text[],
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET DEFAULT NOW(),
  ALTER COLUMN total_orders SET NOT NULL,
  ALTER COLUMN total_spent SET NOT NULL,
  ALTER COLUMN avg_order_value SET NOT NULL,
  ALTER COLUMN segment SET NOT NULL,
  ALTER COLUMN tags SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

-- =====================================================
-- orders
-- =====================================================
UPDATE orders
SET
  discount_amount = COALESCE(discount_amount, 0),
  payment_method = COALESCE(NULLIF(payment_method, ''), 'cash'),
  payment_details = COALESCE(payment_details, '{}'::jsonb),
  created_at = COALESCE(created_at, NOW()),
  updated_at = COALESCE(updated_at, NOW())
WHERE
  discount_amount IS NULL OR
  payment_method IS NULL OR
  payment_method = '' OR
  payment_details IS NULL OR
  created_at IS NULL OR
  updated_at IS NULL;

ALTER TABLE orders
  ALTER COLUMN discount_amount SET DEFAULT 0,
  ALTER COLUMN payment_method SET DEFAULT 'cash',
  ALTER COLUMN payment_details SET DEFAULT '{}'::jsonb,
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET DEFAULT NOW(),
  ALTER COLUMN discount_amount SET NOT NULL,
  ALTER COLUMN payment_method SET NOT NULL,
  ALTER COLUMN payment_details SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

-- =====================================================
-- commission_sales
-- =====================================================
UPDATE commission_sales
SET
  package_price = COALESCE(package_price, 0),
  has_valid_hk = COALESCE(has_valid_hk, true),
  device_sale_amount = COALESCE(device_sale_amount, 0),
  commission_amount = COALESCE(commission_amount, 0),
  created_at = COALESCE(created_at, NOW()),
  updated_at = COALESCE(updated_at, NOW())
WHERE
  package_price IS NULL OR
  has_valid_hk IS NULL OR
  device_sale_amount IS NULL OR
  commission_amount IS NULL OR
  created_at IS NULL OR
  updated_at IS NULL;

ALTER TABLE commission_sales
  ALTER COLUMN package_price SET DEFAULT 0,
  ALTER COLUMN has_valid_hk SET DEFAULT true,
  ALTER COLUMN device_sale_amount SET DEFAULT 0,
  ALTER COLUMN commission_amount SET DEFAULT 0,
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET DEFAULT NOW(),
  ALTER COLUMN package_price SET NOT NULL,
  ALTER COLUMN has_valid_hk SET NOT NULL,
  ALTER COLUMN device_sale_amount SET NOT NULL,
  ALTER COLUMN commission_amount SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;
