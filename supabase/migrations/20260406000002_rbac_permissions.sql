-- =============================================
-- RBAC: Roles, Permissions & Audit Trail
-- =============================================

-- Permissions table
CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(module, action)
);

-- Role-Permission mapping
CREATE TABLE IF NOT EXISTS role_permissions (
  id SERIAL PRIMARY KEY,
  role TEXT NOT NULL,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role, permission_id)
);

-- Audit Trail
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID,
  user_name TEXT,
  user_role TEXT,
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_module ON audit_log(module);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);

-- Seed default permissions
INSERT INTO permissions (module, action, description) VALUES
  ('admin', 'view', 'View admin dashboard'),
  ('admin', 'manage', 'Manage admin settings and users'),
  ('products', 'view', 'View products'),
  ('products', 'create', 'Create products'),
  ('products', 'edit', 'Edit products'),
  ('products', 'delete', 'Delete products'),
  ('orders', 'view', 'View orders'),
  ('orders', 'edit', 'Edit order status'),
  ('orders', 'export', 'Export orders'),
  ('crm', 'view', 'View CRM'),
  ('crm', 'create', 'Create CRM records'),
  ('crm', 'edit', 'Edit CRM records'),
  ('crm', 'delete', 'Delete CRM records'),
  ('commissions', 'view', 'View commissions'),
  ('commissions', 'create', 'Add commission sales'),
  ('commissions', 'edit', 'Edit commission records'),
  ('commissions', 'delete', 'Delete commission records'),
  ('commissions', 'manage', 'Manage targets, sanctions, employees'),
  ('commissions', 'export', 'Export commission data'),
  ('settings', 'view', 'View settings'),
  ('settings', 'edit', 'Edit settings'),
  ('users', 'view', 'View users'),
  ('users', 'create', 'Create users'),
  ('users', 'edit', 'Edit users'),
  ('users', 'delete', 'Delete users'),
  ('users', 'manage_roles', 'Manage user roles and permissions'),
  ('store', 'view', 'View store config'),
  ('store', 'edit', 'Edit store content'),
  ('reports', 'view', 'View reports'),
  ('reports', 'export', 'Export reports')
ON CONFLICT (module, action) DO NOTHING;

-- super_admin gets ALL permissions
INSERT INTO role_permissions (role, permission_id)
  SELECT 'super_admin', id FROM permissions
ON CONFLICT (role, permission_id) DO NOTHING;

-- admin gets everything EXCEPT users.manage_roles
INSERT INTO role_permissions (role, permission_id)
  SELECT 'admin', id FROM permissions
  WHERE NOT (module = 'users' AND action = 'manage_roles')
ON CONFLICT (role, permission_id) DO NOTHING;

-- sales: commissions (view, create), crm (view, create, edit), orders (view), products (view), store (view), admin (view)
INSERT INTO role_permissions (role, permission_id)
  SELECT 'sales', id FROM permissions WHERE
    (module = 'commissions' AND action IN ('view', 'create')) OR
    (module = 'crm' AND action IN ('view', 'create', 'edit')) OR
    (module = 'orders' AND action = 'view') OR
    (module = 'products' AND action = 'view') OR
    (module = 'store' AND action = 'view') OR
    (module = 'admin' AND action = 'view')
ON CONFLICT (role, permission_id) DO NOTHING;

-- viewer gets only view permissions
INSERT INTO role_permissions (role, permission_id)
  SELECT 'viewer', id FROM permissions WHERE action = 'view'
ON CONFLICT (role, permission_id) DO NOTHING;
