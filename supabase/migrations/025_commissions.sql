-- =====================================================
-- ClalMobile — Commission Calculator Module
-- HOT Mobile commission tracking & calculation
-- =====================================================

-- Commission sales tracking (both auto-synced and manual)
CREATE TABLE IF NOT EXISTS commission_sales (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT,
  sale_date TEXT NOT NULL,
  sale_type TEXT NOT NULL CHECK(sale_type IN ('line', 'device')),
  source TEXT NOT NULL DEFAULT 'manual' CHECK(source IN ('manual', 'auto_sync', 'csv_import')),
  order_id TEXT DEFAULT NULL,

  -- For lines
  customer_name TEXT,
  customer_phone TEXT,
  package_price REAL DEFAULT 0,
  multiplier INTEGER DEFAULT 4,
  has_valid_hk BOOLEAN DEFAULT true,
  loyalty_status TEXT DEFAULT 'pending' CHECK(loyalty_status IN ('pending', 'active', 'churned', 'cancelled')),
  loyalty_start_date TEXT,

  -- For devices
  device_name TEXT,
  device_sale_amount REAL DEFAULT 0,

  -- Calculated
  commission_amount REAL DEFAULT 0,

  -- Meta
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(order_id)
);

-- Monthly targets
CREATE TABLE IF NOT EXISTS commission_targets (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT,
  month TEXT NOT NULL,
  target_lines_amount REAL DEFAULT 0,
  target_devices_amount REAL DEFAULT 0,
  target_total REAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, month)
);

-- Sanctions/penalties
CREATE TABLE IF NOT EXISTS commission_sanctions (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT,
  sanction_date TEXT NOT NULL,
  sanction_type TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 2500,
  has_sale_offset BOOLEAN DEFAULT false,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Sync log
CREATE TABLE IF NOT EXISTS commission_sync_log (
  id BIGSERIAL PRIMARY KEY,
  sync_date TIMESTAMPTZ DEFAULT now(),
  orders_synced INTEGER DEFAULT 0,
  orders_skipped INTEGER DEFAULT 0,
  total_amount REAL DEFAULT 0,
  status TEXT DEFAULT 'success',
  error_message TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_commission_sales_date ON commission_sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_commission_sales_type ON commission_sales(sale_type);
CREATE INDEX IF NOT EXISTS idx_commission_sales_order ON commission_sales(order_id);
CREATE INDEX IF NOT EXISTS idx_commission_targets_month ON commission_targets(month);
CREATE INDEX IF NOT EXISTS idx_commission_sanctions_date ON commission_sanctions(sanction_date);
