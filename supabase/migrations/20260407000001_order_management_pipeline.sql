-- =====================================================
-- Order Management + Pipeline overhaul
-- =====================================================

-- ===== Audit log compatibility for logAudit() =====
ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS user_role TEXT,
  ADD COLUMN IF NOT EXISTS module TEXT DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS ip_address TEXT;

UPDATE audit_log
SET module = COALESCE(module, 'system')
WHERE module IS NULL;

-- ===== RBAC permission seed =====
INSERT INTO permissions (module, action, description)
VALUES ('orders', 'create', 'Create manual orders')
ON CONFLICT (module, action) DO NOTHING;

INSERT INTO role_permissions (role, permission_id)
SELECT 'super_admin', id
FROM permissions
WHERE module = 'orders' AND action = 'create'
ON CONFLICT (role, permission_id) DO NOTHING;

INSERT INTO role_permissions (role, permission_id)
SELECT 'admin', id
FROM permissions
WHERE module = 'orders' AND action = 'create'
ON CONFLICT (role, permission_id) DO NOTHING;

INSERT INTO role_permissions (role, permission_id)
SELECT 'sales', id
FROM permissions
WHERE module = 'orders' AND action = 'create'
ON CONFLICT (role, permission_id) DO NOTHING;

-- ===== Order status history =====
CREATE TABLE IF NOT EXISTS order_status_history (
  id BIGSERIAL PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  changed_by_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order
  ON order_status_history(order_id, created_at DESC);

-- ===== Pipeline stages =====
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  name_he TEXT NOT NULL,
  name_ar TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  color TEXT DEFAULT '#4DA6FF',
  is_won BOOLEAN DEFAULT false,
  is_lost BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO pipeline_stages (name, name_he, name_ar, sort_order, color, is_won, is_lost)
VALUES
  ('new_lead', 'ליד חדש', 'ليد جديد', 1, '#4DA6FF', false, false),
  ('quote_sent', 'הצעת מחיר', 'عرض سعر', 2, '#A855F7', false, false),
  ('negotiation', 'משא ומתן', 'مفاوضة', 3, '#FFD93D', false, false),
  ('closing', 'סגירה', 'إغلاق', 4, '#FF0050', false, false),
  ('won', 'הזמנה', 'طلب', 5, '#00D68F', true, false),
  ('lost', 'אבד', 'خسارة', 6, '#FF4757', false, true)
ON CONFLICT (name) DO NOTHING;

-- ===== Expand pipeline_deals into stage-driven CRM deals =====
ALTER TABLE pipeline_deals
  ADD COLUMN IF NOT EXISTS stage_id BIGINT REFERENCES pipeline_stages(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS customer_phone TEXT,
  ADD COLUMN IF NOT EXISTS customer_email TEXT,
  ADD COLUMN IF NOT EXISTS product_name TEXT,
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS estimated_value NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS employee_name TEXT,
  ADD COLUMN IF NOT EXISTS order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lost_reason TEXT;

UPDATE pipeline_deals pd
SET customer_phone = COALESCE(pd.customer_phone, c.phone),
    customer_email = COALESCE(pd.customer_email, c.email)
FROM customers c
WHERE pd.customer_id = c.id
  AND (pd.customer_phone IS NULL OR pd.customer_email IS NULL);

UPDATE pipeline_deals pd
SET product_name = COALESCE(pd.product_name, pd.product_summary),
    estimated_value = CASE
      WHEN COALESCE(pd.estimated_value, 0) = 0 THEN COALESCE(pd.value, 0)
      ELSE pd.estimated_value
    END,
    employee_id = COALESCE(pd.employee_id, pd.assigned_to)
WHERE pd.product_name IS NULL
   OR COALESCE(pd.estimated_value, 0) = 0
   OR pd.employee_id IS NULL;

UPDATE pipeline_deals pd
SET employee_name = COALESCE(pd.employee_name, u.name)
FROM users u
WHERE pd.employee_id = u.id
  AND pd.employee_name IS NULL;

UPDATE pipeline_deals pd
SET stage_id = ps.id
FROM pipeline_stages ps
WHERE pd.stage_id IS NULL
  AND ps.name = CASE pd.stage
    WHEN 'lead' THEN 'new_lead'
    WHEN 'proposal' THEN 'quote_sent'
    WHEN 'negotiation' THEN 'negotiation'
    WHEN 'won' THEN 'won'
    WHEN 'lost' THEN 'lost'
    ELSE 'new_lead'
  END;

CREATE INDEX IF NOT EXISTS idx_pipeline_deals_stage_id
  ON pipeline_deals(stage_id);

CREATE INDEX IF NOT EXISTS idx_pipeline_deals_employee_id
  ON pipeline_deals(employee_id);

CREATE INDEX IF NOT EXISTS idx_pipeline_deals_order_id
  ON pipeline_deals(order_id);

CREATE OR REPLACE FUNCTION sync_pipeline_deals_legacy_fields()
RETURNS TRIGGER AS $$
DECLARE
  v_stage_name TEXT;
BEGIN
  IF NEW.stage_id IS NOT NULL THEN
    SELECT name INTO v_stage_name
    FROM pipeline_stages
    WHERE id = NEW.stage_id;

    IF v_stage_name IS NOT NULL THEN
      NEW.stage := v_stage_name;
    END IF;
  ELSIF NEW.stage IS NOT NULL THEN
    SELECT id INTO NEW.stage_id
    FROM pipeline_stages
    WHERE name = CASE NEW.stage
      WHEN 'lead' THEN 'new_lead'
      WHEN 'proposal' THEN 'quote_sent'
      WHEN 'negotiation' THEN 'negotiation'
      WHEN 'won' THEN 'won'
      WHEN 'lost' THEN 'lost'
      ELSE NEW.stage
    END
    LIMIT 1;
  END IF;

  IF NEW.estimated_value IS NOT NULL THEN
    NEW.value := NEW.estimated_value;
  ELSIF NEW.value IS NOT NULL THEN
    NEW.estimated_value := NEW.value;
  END IF;

  IF NEW.employee_id IS NOT NULL THEN
    NEW.assigned_to := NEW.employee_id;
  ELSIF NEW.assigned_to IS NOT NULL THEN
    NEW.employee_id := NEW.assigned_to;
  END IF;

  IF NEW.product_name IS NOT NULL THEN
    NEW.product_summary := NEW.product_name;
  ELSIF NEW.product_summary IS NOT NULL THEN
    NEW.product_name := NEW.product_summary;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_pipeline_sync_legacy ON pipeline_deals;
CREATE TRIGGER tr_pipeline_sync_legacy
  BEFORE INSERT OR UPDATE ON pipeline_deals
  FOR EACH ROW
  EXECUTE FUNCTION sync_pipeline_deals_legacy_fields();

-- ===== Extend orders for manual/admin lifecycle =====
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_status TEXT,
  ADD COLUMN IF NOT EXISTS created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by_name TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS deal_id UUID REFERENCES pipeline_deals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS commission_synced BOOLEAN DEFAULT false;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_source_check;
ALTER TABLE orders ADD CONSTRAINT orders_source_check
  CHECK (source IN (
    'store', 'facebook', 'external', 'whatsapp', 'webchat',
    'manual', 'pipeline', 'phone', 'online'
  ));

CREATE INDEX IF NOT EXISTS idx_orders_created_by
  ON orders(created_by_id);

CREATE INDEX IF NOT EXISTS idx_orders_deal_id
  ON orders(deal_id);

CREATE INDEX IF NOT EXISTS idx_orders_commission_unsynced
  ON orders(commission_synced) WHERE commission_synced = false;

-- ===== Real storefront sort position =====
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS sort_position INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_products_sort_position
  ON products(sort_position, created_at DESC);
