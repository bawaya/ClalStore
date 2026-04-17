-- =====================================================
-- ClalMobile — Database Schema
-- All 16 tables + relations + indexes + RLS
-- Run this in Supabase SQL Editor
-- =====================================================

-- ===== EXTENSIONS =====
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. USERS (فريق العمل)
-- =====================================================
CREATE TABLE users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'viewer'
    CHECK (role IN ('super_admin','admin','sales','support','content','viewer')),
  avatar_url TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','suspended')),
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_auth ON users(auth_id);
CREATE INDEX idx_users_role ON users(role);

-- =====================================================
-- 2. SETTINGS (إعدادات المتجر)
-- =====================================================
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'string'
    CHECK (type IN ('string','number','boolean','json'))
);

-- Default settings
INSERT INTO settings (key, value, type) VALUES
  ('store_name', 'ClalMobile', 'string'),
  ('store_tagline_ar', 'وكيل رسمي لـ HOT Mobile', 'string'),
  ('store_tagline_he', 'סוכן רשמי של HOT Mobile', 'string'),
  ('logo_url', '', 'string'),
  ('accent_color', '#c41040', 'string'),
  ('whatsapp_number', '972541234567', 'string'),
  ('phone', '054-1234567', 'string'),
  ('email', 'info@clalmobile.co.il', 'string'),
  ('delivery_days', '["sunday","monday","tuesday","wednesday","thursday"]', 'json'),
  ('delivery_note_ar', 'التوصيل خلال 1-2 يوم عمل', 'string'),
  ('delivery_note_he', 'משלוח תוך 1-2 ימי עסקים', 'string');

-- =====================================================
-- 3. INTEGRATIONS (التكاملات)
-- =====================================================
CREATE TABLE integrations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  type TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT '',
  config JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'inactive'
    CHECK (status IN ('active','inactive','error')),
  last_synced_at TIMESTAMPTZ
);

-- Default integrations
INSERT INTO integrations (type, provider, status) VALUES
  ('whatsapp', '', 'inactive'),
  ('email', '', 'inactive'),
  ('payment', '', 'inactive'),
  ('sms', '', 'inactive'),
  ('crm_external', '', 'inactive'),
  ('analytics', '', 'inactive');

-- =====================================================
-- 4. CATEGORIES / COLLECTIONS (المجموعات)
-- =====================================================
CREATE TABLE categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name_ar TEXT NOT NULL,
  name_he TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'manual'
    CHECK (type IN ('auto','manual')),
  rule TEXT,
  product_ids TEXT[] DEFAULT '{}',
  sort_order INT DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 5. PRODUCTS (المنتجات)
-- =====================================================
CREATE TABLE products (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('device','accessory')),
  brand TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  name_he TEXT NOT NULL DEFAULT '',
  description_ar TEXT,
  description_he TEXT,
  price NUMERIC(10,2) NOT NULL,
  old_price NUMERIC(10,2),
  cost NUMERIC(10,2) DEFAULT 0,
  stock INT DEFAULT 0,
  sold INT DEFAULT 0,
  image_url TEXT,
  gallery TEXT[] DEFAULT '{}',
  colors JSONB DEFAULT '[]',       -- [{hex, name_ar, name_he}]
  storage_options TEXT[] DEFAULT '{}',
  specs JSONB DEFAULT '{}',        -- {screen, camera, battery, cpu, ram}
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  active BOOLEAN DEFAULT true,
  featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_type ON products(type);
CREATE INDEX idx_products_brand ON products(brand);
CREATE INDEX idx_products_active ON products(active);
CREATE INDEX idx_products_category ON products(category_id);

-- =====================================================
-- 6. CUSTOMERS (الزبائن)
-- =====================================================
CREATE TABLE customers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  email TEXT,
  city TEXT,
  address TEXT,
  id_number TEXT,              -- Israeli ID (stored for review)
  total_orders INT DEFAULT 0,
  total_spent NUMERIC(10,2) DEFAULT 0,
  avg_order_value NUMERIC(10,2) DEFAULT 0,
  last_order_at TIMESTAMPTZ,
  segment TEXT DEFAULT 'new'
    CHECK (segment IN ('vip','loyal','active','new','cold','lost')),
  birthday DATE,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_segment ON customers(segment);
CREATE INDEX idx_customers_city ON customers(city);

-- =====================================================
-- 7. COUPONS (الكوبونات)
-- =====================================================
CREATE TABLE coupons (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('percent','fixed')),
  value NUMERIC(10,2) NOT NULL,
  min_order NUMERIC(10,2) DEFAULT 0,
  max_uses INT DEFAULT 0,        -- 0 = unlimited
  used_count INT DEFAULT 0,
  expires_at TIMESTAMPTZ,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_coupons_code ON coupons(code);

-- =====================================================
-- 8. ORDERS (الطلبات)
-- =====================================================
CREATE TABLE orders (
  id TEXT PRIMARY KEY,              -- CLM-XXXXX
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','approved','shipped','delivered','rejected','no_reply_1','no_reply_2','no_reply_3')),
  source TEXT NOT NULL DEFAULT 'store'
    CHECK (source IN ('store','facebook','external','whatsapp','webchat','manual')),
  items_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  coupon_code TEXT,
  payment_method TEXT,
  payment_details JSONB DEFAULT '{}',
  shipping_city TEXT NOT NULL,
  shipping_address TEXT NOT NULL,
  customer_notes TEXT,
  internal_notes TEXT,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_source ON orders(source);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_orders_assigned ON orders(assigned_to);

-- =====================================================
-- 9. ORDER_ITEMS (تفاصيل الطلب)
-- =====================================================
CREATE TABLE order_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  product_brand TEXT NOT NULL,
  product_type TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  quantity INT DEFAULT 1,
  color TEXT,
  storage TEXT
);

CREATE INDEX idx_order_items_order ON order_items(order_id);

-- =====================================================
-- 10. ORDER_NOTES (ملاحظات حرة على الطلبات)
-- =====================================================
CREATE TABLE order_notes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_order_notes_order ON order_notes(order_id);

-- =====================================================
-- 11. HEROES / BANNERS (البنرات)
-- =====================================================
CREATE TABLE heroes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title_ar TEXT NOT NULL,
  title_he TEXT DEFAULT '',
  subtitle_ar TEXT,
  subtitle_he TEXT,
  image_url TEXT,
  link_url TEXT,
  cta_text_ar TEXT DEFAULT 'تسوّق الآن',
  cta_text_he TEXT DEFAULT 'קנה עכשיו',
  sort_order INT DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 12. LINE_PLANS (باقات HOT Mobile)
-- =====================================================
CREATE TABLE line_plans (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name_ar TEXT NOT NULL,
  name_he TEXT DEFAULT '',
  data_amount TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  features_ar TEXT[] DEFAULT '{}',
  features_he TEXT[] DEFAULT '{}',
  popular BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 13. EMAIL_TEMPLATES (قوالب الإيميلات)
-- =====================================================
CREATE TABLE email_templates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  subject_ar TEXT NOT NULL,
  subject_he TEXT DEFAULT '',
  body_html_ar TEXT NOT NULL DEFAULT '',
  body_html_he TEXT DEFAULT '',
  variables TEXT[] DEFAULT '{}',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default templates
INSERT INTO email_templates (slug, name_ar, subject_ar, variables) VALUES
  ('order_confirmed', 'تأكيد الطلب', 'تم استلام طلبك #{order_id}', ARRAY['order_id','customer_name','total','items']),
  ('order_approved', 'تمت الموافقة', 'طلبك #{order_id} مقبول ✅', ARRAY['order_id','customer_name']),
  ('order_shipped', 'تم الشحن', 'طلبك #{order_id} بالطريق 🚚', ARRAY['order_id','customer_name','tracking']),
  ('order_delivered', 'تم التسليم', 'طلبك #{order_id} وصل 📦', ARRAY['order_id','customer_name']),
  ('cart_abandoned', 'سلة مهجورة', 'نسيت شي؟ 🛒', ARRAY['customer_name','cart_items']);

-- =====================================================
-- 14. TASKS (المهام)
-- =====================================================
CREATE TABLE tasks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  priority TEXT DEFAULT 'medium'
    CHECK (priority IN ('high','medium','low')),
  status TEXT DEFAULT 'open'
    CHECK (status IN ('open','in_progress','done')),
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_order ON tasks(order_id);

-- =====================================================
-- 15. PIPELINE_DEALS (صفقات المبيعات)
-- =====================================================
CREATE TABLE pipeline_deals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  product_summary TEXT,
  value NUMERIC(10,2) DEFAULT 0,
  stage TEXT DEFAULT 'lead'
    CHECK (stage IN ('lead','negotiation','proposal','won','lost')),
  source TEXT DEFAULT 'store'
    CHECK (source IN ('store','facebook','external','whatsapp','webchat','manual')),
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pipeline_stage ON pipeline_deals(stage);

-- =====================================================
-- 16. AUDIT_LOG (سجل العمليات)
-- =====================================================
CREATE TABLE audit_log (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_created ON audit_log(created_at DESC);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);

-- =====================================================
-- TRIGGERS — Auto-update updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_products_updated BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_orders_updated BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_customers_updated BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_tasks_updated BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_pipeline_updated BEFORE UPDATE ON pipeline_deals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- TRIGGER — Auto-update customer stats on order change
-- =====================================================
CREATE OR REPLACE FUNCTION update_customer_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE customers SET
    total_orders = (SELECT COUNT(*) FROM orders WHERE customer_id = NEW.customer_id AND status != 'rejected'),
    total_spent = COALESCE((SELECT SUM(total) FROM orders WHERE customer_id = NEW.customer_id AND status NOT IN ('rejected','new')), 0),
    avg_order_value = COALESCE((SELECT AVG(total) FROM orders WHERE customer_id = NEW.customer_id AND status NOT IN ('rejected','new')), 0),
    last_order_at = (SELECT MAX(created_at) FROM orders WHERE customer_id = NEW.customer_id),
    updated_at = NOW()
  WHERE id = NEW.customer_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_order_customer_stats
  AFTER INSERT OR UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_customer_stats();

-- =====================================================
-- TRIGGER — Auto audit log on order status change
-- =====================================================
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO audit_log (user_name, action, entity_type, entity_id, details)
    VALUES (
      'النظام',
      NEW.id || ' → ' || NEW.status,
      'order',
      NEW.id,
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_order_status_audit
  AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION log_order_status_change();

-- =====================================================
-- RLS (Row Level Security)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE heroes ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- PUBLIC READ (Store pages - no auth needed)
CREATE POLICY "products_public_read" ON products FOR SELECT USING (active = true);
CREATE POLICY "heroes_public_read" ON heroes FOR SELECT USING (active = true);
CREATE POLICY "line_plans_public_read" ON line_plans FOR SELECT USING (active = true);
CREATE POLICY "coupons_public_read" ON coupons FOR SELECT USING (active = true);
CREATE POLICY "categories_public_read" ON categories FOR SELECT USING (active = true);
CREATE POLICY "settings_public_read" ON settings FOR SELECT USING (true);

-- PUBLIC INSERT (Store checkout - creates orders & customers)
CREATE POLICY "orders_public_insert" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "order_items_public_insert" ON order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "customers_public_upsert" ON customers FOR INSERT WITH CHECK (true);

-- AUTHENTICATED (Admin/CRM - full access)
CREATE POLICY "users_auth_all" ON users FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "products_auth_all" ON products FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "orders_auth_all" ON orders FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "order_items_auth_all" ON order_items FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "order_notes_auth_all" ON order_notes FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "customers_auth_all" ON customers FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "coupons_auth_all" ON coupons FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "heroes_auth_all" ON heroes FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "line_plans_auth_all" ON line_plans FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "email_templates_auth_all" ON email_templates FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "settings_auth_all" ON settings FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "integrations_auth_all" ON integrations FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "tasks_auth_all" ON tasks FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "pipeline_auth_all" ON pipeline_deals FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "audit_auth_read" ON audit_log FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "audit_auth_insert" ON audit_log FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "categories_auth_all" ON categories FOR ALL USING (auth.uid() IS NOT NULL);

-- =====================================================
-- DONE! 🎉
-- 16 tables + indexes + triggers + RLS
-- =====================================================
