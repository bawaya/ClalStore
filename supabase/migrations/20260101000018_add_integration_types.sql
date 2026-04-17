-- Migration 018: Add missing integration types for admin settings panel

INSERT INTO integrations (type, provider, status) VALUES
  ('ai_chat', '', 'inactive'),
  ('ai_admin', '', 'inactive'),
  ('storage', '', 'inactive'),
  ('image_processing', '', 'inactive'),
  ('device_specs', '', 'inactive'),
  ('image_search', '', 'inactive'),
  ('push_notifications', '', 'inactive')
ON CONFLICT DO NOTHING;
