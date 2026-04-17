-- =====================================================
-- ClalMobile — Bot Tables Fixes
-- Add missing columns + RLS policies
-- =====================================================

-- ===== Missing columns =====
ALTER TABLE bot_conversations ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE bot_conversations ADD COLUMN IF NOT EXISTS customer_phone TEXT;

ALTER TABLE bot_handoffs ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE bot_handoffs ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE bot_handoffs ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

ALTER TABLE bot_policies ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE bot_templates ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- ===== Enable RLS =====
ALTER TABLE bot_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_handoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_analytics ENABLE ROW LEVEL SECURITY;

-- ===== Policies: service_role gets full access =====
CREATE POLICY "service_full_bot_conversations" ON bot_conversations
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_full_bot_messages" ON bot_messages
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_full_bot_handoffs" ON bot_handoffs
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_full_bot_analytics" ON bot_analytics
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_full_bot_policies" ON bot_policies
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_full_bot_templates" ON bot_templates
  FOR ALL USING (auth.role() = 'service_role');

-- ===== Public read for policies + templates (used by webchat) =====
CREATE POLICY "public_read_bot_policies" ON bot_policies
  FOR SELECT USING (true);

CREATE POLICY "public_read_bot_templates" ON bot_templates
  FOR SELECT USING (true);

-- ===== Authenticated users can read conversations/messages (CRM) =====
CREATE POLICY "auth_read_bot_conversations" ON bot_conversations
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "auth_read_bot_messages" ON bot_messages
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "auth_read_bot_handoffs" ON bot_handoffs
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "auth_read_bot_analytics" ON bot_analytics
  FOR SELECT USING (auth.uid() IS NOT NULL);
