-- Migration 005: Features Tables

-- Feature Flags
INSERT INTO settings (key, value, type) VALUES
  ('feature_abandoned_cart', 'true', 'boolean'),
  ('feature_reviews', 'true', 'boolean'),
  ('feature_push_notifications', 'true', 'boolean'),
  ('feature_analytics', 'true', 'boolean'),
  ('feature_deals', 'true', 'boolean'),
  ('feature_pdf_export', 'true', 'boolean'),
  ('ga_measurement_id', '', 'string'),
  ('meta_pixel_id', '', 'string'),
  ('abandoned_cart_delay_minutes', '60', 'number'),
  ('abandoned_cart_message', 'forgot your cart?', 'string')
ON CONFLICT (key) DO NOTHING;

-- Abandoned Carts
CREATE TABLE IF NOT EXISTS abandoned_carts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  customer_phone TEXT,
  customer_name TEXT,
  items JSONB NOT NULL DEFAULT '[]',
  total NUMERIC(10,2) DEFAULT 0,
  reminder_sent BOOLEAN DEFAULT false,
  reminder_count INT DEFAULT 0,
  recovered BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_abandoned_carts_phone ON abandoned_carts(customer_phone);
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_created ON abandoned_carts(created_at);
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_reminder ON abandoned_carts(reminder_sent, created_at);

-- Product Reviews
CREATE TABLE IF NOT EXISTS product_reviews (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  body TEXT,
  verified_purchase BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_reply TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_product ON product_reviews(product_id, status);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON product_reviews(status);

-- Deals
CREATE TABLE IF NOT EXISTS deals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title_ar TEXT NOT NULL,
  title_he TEXT DEFAULT '',
  description_ar TEXT,
  description_he TEXT,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  deal_type TEXT NOT NULL DEFAULT 'discount' CHECK (deal_type IN ('discount','flash_sale','bundle','clearance')),
  discount_percent INT DEFAULT 0,
  discount_amount NUMERIC(10,2) DEFAULT 0,
  original_price NUMERIC(10,2),
  deal_price NUMERIC(10,2),
  image_url TEXT,
  badge_text_ar TEXT DEFAULT 'special offer',
  badge_text_he TEXT DEFAULT 'sale',
  starts_at TIMESTAMPTZ DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  max_quantity INT DEFAULT 0,
  sold_count INT DEFAULT 0,
  active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deals_active ON deals(active, starts_at, ends_at);

-- Push Subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  endpoint TEXT NOT NULL UNIQUE,
  keys JSONB NOT NULL DEFAULT '{}',
  visitor_id TEXT,
  customer_phone TEXT,
  user_agent TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subs_active ON push_subscriptions(active);

-- Push Notifications
CREATE TABLE IF NOT EXISTS push_notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  url TEXT,
  icon TEXT,
  sent_count INT DEFAULT 0,
  target TEXT DEFAULT 'all' CHECK (target IN ('all','segment','individual')),
  target_filter JSONB DEFAULT '{}',
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE abandoned_carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_deals" ON deals FOR SELECT USING (active = true);
CREATE POLICY "read_reviews" ON product_reviews FOR SELECT USING (status = 'approved');
CREATE POLICY "insert_reviews" ON product_reviews FOR INSERT WITH CHECK (true);
CREATE POLICY "insert_push_subs" ON push_subscriptions FOR INSERT WITH CHECK (true);
CREATE POLICY "insert_abandoned" ON abandoned_carts FOR INSERT WITH CHECK (true);
CREATE POLICY "update_abandoned" ON abandoned_carts FOR UPDATE USING (true);
CREATE POLICY "svc_abandoned" ON abandoned_carts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "svc_reviews" ON product_reviews FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "svc_deals" ON deals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "svc_push_subs" ON push_subscriptions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "svc_push_notifs" ON push_notifications FOR ALL USING (true) WITH CHECK (true);
