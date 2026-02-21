-- =====================================================
-- ClalMobile — WhatsApp Inbox Tables
-- Migration 007: Full inbox system for CRM
-- =====================================================

-- جدول المحادثات الرئيسي
CREATE TABLE IF NOT EXISTS inbox_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_phone TEXT NOT NULL,
  customer_name TEXT,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  status TEXT NOT NULL DEFAULT 'active',
  assigned_to UUID,
  assigned_at TIMESTAMPTZ,
  priority TEXT DEFAULT 'normal',
  pinned BOOLEAN DEFAULT false,
  is_blocked BOOLEAN DEFAULT false,
  unread_count INTEGER DEFAULT 0,
  last_message_text TEXT,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_direction TEXT DEFAULT 'inbound',
  first_response_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  source TEXT DEFAULT 'organic',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inbox_conv_phone ON inbox_conversations(customer_phone);
CREATE INDEX IF NOT EXISTS idx_inbox_conv_status ON inbox_conversations(status);
CREATE INDEX IF NOT EXISTS idx_inbox_conv_assigned ON inbox_conversations(assigned_to);
CREATE INDEX IF NOT EXISTS idx_inbox_conv_last_msg ON inbox_conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbox_conv_unread ON inbox_conversations(unread_count) WHERE unread_count > 0;

-- جدول الرسائل
CREATE TABLE IF NOT EXISTS inbox_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES inbox_conversations(id) ON DELETE CASCADE,
  direction TEXT NOT NULL,
  sender_type TEXT NOT NULL,
  sender_id UUID,
  sender_name TEXT,
  message_type TEXT NOT NULL DEFAULT 'text',
  content TEXT,
  media_url TEXT,
  media_mime_type TEXT,
  media_filename TEXT,
  template_name TEXT,
  template_params JSONB,
  reply_to_id UUID,
  whatsapp_message_id TEXT,
  status TEXT DEFAULT 'sent',
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inbox_msg_conv ON inbox_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_inbox_msg_wa_id ON inbox_messages(whatsapp_message_id);

-- جدول التصنيفات
CREATE TABLE IF NOT EXISTS inbox_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#666666',
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ربط التصنيفات بالمحادثات
CREATE TABLE IF NOT EXISTS inbox_conversation_labels (
  conversation_id UUID REFERENCES inbox_conversations(id) ON DELETE CASCADE,
  label_id UUID REFERENCES inbox_labels(id) ON DELETE CASCADE,
  PRIMARY KEY (conversation_id, label_id)
);

-- جدول الملاحظات الداخلية
CREATE TABLE IF NOT EXISTS inbox_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES inbox_conversations(id) ON DELETE CASCADE,
  author_id UUID,
  author_name TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inbox_notes_conv ON inbox_notes(conversation_id, created_at);

-- جدول القوالب
CREATE TABLE IF NOT EXISTS inbox_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  content TEXT NOT NULL,
  variables TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- جدول الردود السريعة
CREATE TABLE IF NOT EXISTS inbox_quick_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shortcut TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  usage_count INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- جدول سجل الأحداث
CREATE TABLE IF NOT EXISTS inbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES inbox_conversations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_id UUID,
  actor_name TEXT,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inbox_events_conv ON inbox_events(conversation_id, created_at);

-- =====================================================
-- RLS Policies
-- =====================================================

ALTER TABLE inbox_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_conversation_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_quick_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_full_inbox_conv" ON inbox_conversations FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_full_inbox_msg" ON inbox_messages FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_full_inbox_labels" ON inbox_labels FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_full_inbox_conv_labels" ON inbox_conversation_labels FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_full_inbox_notes" ON inbox_notes FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_full_inbox_templates" ON inbox_templates FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_full_inbox_qr" ON inbox_quick_replies FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_full_inbox_events" ON inbox_events FOR ALL USING (auth.role() = 'service_role');

-- =====================================================
-- Seed Data
-- =====================================================

INSERT INTO inbox_templates (name, category, content, variables) VALUES
  ('ترحيب', 'welcome', 'مرحباً {customer_name}! 👋 أنا {agent_name} من ClalMobile. كيف يمكنني مساعدتك اليوم؟', '{customer_name,agent_name}'),
  ('تأكيد طلب', 'orders', 'مرحباً {customer_name}! ✅ تم تأكيد طلبك #{order_id} بمبلغ ₪{order_total}. سنتواصل معك قريباً بخصوص التوصيل.', '{customer_name,order_id,order_total}'),
  ('الطلب بالطريق', 'shipping', '🚚 طلبك #{order_id} بالطريق إليك! التوصيل المتوقع خلال 1-3 أيام عمل.', '{order_id}'),
  ('تم التوصيل', 'shipping', '📦 تم توصيل طلبك #{order_id} بنجاح! نتمنى أن ينال إعجابك. لا تتردد في التواصل معنا لأي استفسار.', '{order_id}'),
  ('عرض خاص', 'offers', '🎉 عرض حصري لك {customer_name}! خصم {discount}% على مشترياتك القادمة. استخدم كود: {coupon_code}', '{customer_name,discount,coupon_code}'),
  ('متابعة', 'followup', 'مرحباً {customer_name}! أردنا الاطمئنان عليك. هل تحتاج مساعدة بخصوص طلبك السابق؟', '{customer_name}'),
  ('طلب تقييم', 'followup', 'مرحباً {customer_name}! 🌟 نقدّر رأيك! كيف كانت تجربتك مع {product_name}؟ تقييمك يساعدنا على التحسّن.', '{customer_name,product_name}'),
  ('تذكير دفع', 'payment', 'مرحباً {customer_name}، نذكّرك بأن طلبك #{order_id} بانتظار الدفع. هل تحتاج مساعدة؟', '{customer_name,order_id}'),
  ('أوقات العمل', 'general', 'أوقات عملنا: الأحد - الخميس، 9 صباحاً - 6 مساءً. سنرد عليك في أقرب وقت! ⏰', '{}'),
  ('شكراً', 'general', 'شكراً لتواصلك معنا {customer_name}! 🙏 نتمنى لك يوماً سعيداً. لا تتردد في التواصل معنا في أي وقت.', '{customer_name}')
ON CONFLICT DO NOTHING;

INSERT INTO inbox_quick_replies (shortcut, title, content, category) VALUES
  ('/مرحبا', 'ترحيب', 'مرحباً! 👋 كيف يمكنني مساعدتك اليوم؟', 'general'),
  ('/سعر', 'استفسار سعر', 'سعر هذا المنتج هو ₪{price}. هل تريد طلبه؟', 'orders'),
  ('/شحن', 'معلومات التوصيل', '🚚 التوصيل خلال 1-3 أيام عمل لجميع أنحاء البلاد. مجاني للطلبات فوق ₪200.', 'shipping'),
  ('/دفع', 'طرق الدفع', '💳 طرق الدفع المتاحة:\n1. بطاقة ائتمان\n2. تحويل بنكي\n3. أقساط حتى 18 شهر', 'payment'),
  ('/ساعات', 'أوقات العمل', '⏰ أوقات العمل:\nالأحد - الخميس: 9:00 - 18:00\nالجمعة - السبت: مغلق', 'general'),
  ('/ضمان', 'سياسة الضمان', '🛡️ جميع الأجهزة مع ضمان رسمي سنة كاملة. الإكسسوارات 3 أشهر.', 'general'),
  ('/إرجاع', 'سياسة الإرجاع', '↩️ يمكنك إرجاع المنتج خلال 14 يوم من الاستلام حسب قانون حماية المستهلك.', 'general'),
  ('/شكرا', 'شكراً', 'شكراً لتواصلك معنا! 🙏 لا تتردد في التواصل في أي وقت.', 'general'),
  ('/انتظار', 'طلب انتظار', 'لحظة من فضلك، أتحقق لك من المعلومات... ⏳', 'general'),
  ('/محمد', 'تحويل لمحمد', 'سأحوّلك الآن لزميلي محمد المتخصص. لحظة من فضلك! 🔄', 'general')
ON CONFLICT DO NOTHING;

INSERT INTO inbox_labels (name, color, sort_order) VALUES
  ('VIP', '#FFD700', 1),
  ('استفسار سعر', '#3B82F6', 2),
  ('طلب جديد', '#10B981', 3),
  ('مشكلة', '#EF4444', 4),
  ('متابعة', '#F59E0B', 5),
  ('مهتم', '#8B5CF6', 6),
  ('بانتظار رد العميل', '#6B7280', 7),
  ('عاجل', '#DC2626', 8)
ON CONFLICT DO NOTHING;

-- =====================================================
-- Trigger: تحديث updated_at تلقائياً
-- =====================================================

CREATE OR REPLACE FUNCTION update_inbox_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_inbox_conv_updated ON inbox_conversations;

CREATE TRIGGER trigger_inbox_conv_updated
  BEFORE UPDATE ON inbox_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_inbox_conversation_timestamp();
