-- =====================================================
-- ClalMobile — Bot Tables (Season 5)
-- محادثات + رسائل + تصعيد + سياسات + قوالب + إحصائيات
-- =====================================================

-- ===== محادثات البوت =====
CREATE TABLE IF NOT EXISTS bot_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('webchat', 'whatsapp', 'sms')),
  customer_id UUID REFERENCES customers(id),
  language TEXT DEFAULT 'ar',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed', 'escalated')),
  intent TEXT,
  qualification JSONB DEFAULT '{}',
  products_discussed UUID[] DEFAULT '{}',
  source TEXT,
  message_count INTEGER DEFAULT 0,
  csat_score INTEGER CHECK (csat_score IS NULL OR (csat_score >= 1 AND csat_score <= 5)),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== رسائل المحادثة =====
CREATE TABLE IF NOT EXISTS bot_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES bot_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'bot', 'system')),
  content TEXT NOT NULL,
  intent TEXT,
  confidence REAL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== طلبات التصعيد =====
CREATE TABLE IF NOT EXISTS bot_handoffs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES bot_conversations(id),
  customer_id UUID REFERENCES customers(id),
  reason TEXT NOT NULL,
  summary TEXT,
  products_interested UUID[] DEFAULT '{}',
  last_price_quoted NUMERIC,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'resolved')),
  assigned_to UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== سياسات وFAQ =====
CREATE TABLE IF NOT EXISTS bot_policies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('warranty', 'return', 'privacy', 'terms', 'shipping', 'installments', 'faq')),
  title_ar TEXT NOT NULL,
  title_he TEXT,
  content_ar TEXT NOT NULL,
  content_he TEXT,
  page_url TEXT,
  active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== قوالب رسائل البوت =====
CREATE TABLE IF NOT EXISTS bot_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  content_ar TEXT NOT NULL,
  content_he TEXT,
  channel TEXT DEFAULT 'all' CHECK (channel IN ('all', 'webchat', 'whatsapp')),
  variables TEXT[],
  active BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== إحصائيات البوت =====
CREATE TABLE IF NOT EXISTS bot_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  channel TEXT NOT NULL,
  total_conversations INTEGER DEFAULT 0,
  total_messages INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,
  leads_captured INTEGER DEFAULT 0,
  store_clicks INTEGER DEFAULT 0,
  handoffs INTEGER DEFAULT 0,
  avg_csat REAL,
  top_intents JSONB DEFAULT '{}',
  top_products JSONB DEFAULT '{}',
  UNIQUE(date, channel)
);

-- ===== Indexes =====
CREATE INDEX IF NOT EXISTS idx_bot_conversations_visitor ON bot_conversations(visitor_id);
CREATE INDEX IF NOT EXISTS idx_bot_conversations_customer ON bot_conversations(customer_id);
CREATE INDEX IF NOT EXISTS idx_bot_conversations_status ON bot_conversations(status);
CREATE INDEX IF NOT EXISTS idx_bot_conversations_channel ON bot_conversations(channel);
CREATE INDEX IF NOT EXISTS idx_bot_conversations_created ON bot_conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_messages_conversation ON bot_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_bot_messages_created ON bot_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_bot_handoffs_status ON bot_handoffs(status);
CREATE INDEX IF NOT EXISTS idx_bot_handoffs_created ON bot_handoffs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_policies_type ON bot_policies(type);

-- ===== بيانات أولية: السياسات =====
INSERT INTO bot_policies (type, title_ar, title_he, content_ar, page_url, sort_order) VALUES
('warranty', 'سياسة الضمان', 'מדיניות אחריות',
 'جميع الأجهزة تأتي مع ضمان المصنع الرسمي. مدة الضمان حسب الشركة المصنعة (عادة 12 شهر). الضمان لا يشمل: أضرار فيزيائية، ضرر مياه، فتح الجهاز من غير مركز معتمد. للمطالبة بالضمان تواصل معنا عبر الفورم.',
 '/legal', 1),
('return', 'سياسة الإرجاع', 'מדיניות החזרה',
 'يمكن إرجاع الجهاز خلال 14 يوم من الاستلام بشرط: الجهاز بحالته الأصلية، جميع الملحقات موجودة، العلبة غير مفتوحة أو الجهاز غير مستخدم. رسوم إرجاع 5% أو 100₪ (الأقل). الإرجاع لا ينطبق على: سماعات مفتوحة، أجهزة مفعّلة بخط.',
 '/legal', 2),
('shipping', 'التوصيل', 'משלוח',
 'التوصيل خلال 1-3 أيام عمل داخل إسرائيل. التوصيل مجاني للطلبات فوق 500₪. أيام العمل: أحد - خميس. لا يوجد توصيل يوم الجمعة والسبت.',
 '/legal', 3),
('installments', 'التقسيط', 'תשלומים',
 'تقسيط بسعر الكاش حتى 18 دفعة عبر حوالة بنكية. بدون فوائد. البنوك المقبولة: هبوعليم، لئومي، ديسكونت، مزراحي طفحوت، البنك الدولي، يهاف، مركنتيل، أوتسار هحيال، الاتحاد، مساد، القدس، دكسيا، بوعلي أغودات، البنك العربي الإسرائيلي. لا نقبل بنك البريد (الدوائر).',
 '/legal', 4),
('privacy', 'الخصوصية', 'פרטיות',
 'نحن نحمي بياناتك الشخصية. لن نشارك معلوماتك مع أطراف ثالثة بدون موافقتك. البيانات المخزنة: اسم، هاتف، عنوان توصيل. يمكنك طلب حذف بياناتك في أي وقت.',
 '/legal', 5)
ON CONFLICT DO NOTHING;

-- ===== بيانات أولية: القوالب =====
INSERT INTO bot_templates (key, content_ar, content_he, channel, variables) VALUES
('welcome', 'أهلاً بك في ClalMobile — وكيل رسمي لـ HOT Mobile! 📱
احكيلي شو الجهاز اللي بدك إياه أو ميزانيتك، وبعطيك أفضل 3 خيارات مع روابط شراء مباشرة.', 'ברוכים הבאים ל-ClalMobile — סוכן רשמי של HOT Mobile! 📱', 'all', ARRAY['name']),
('welcome_returning', 'أهلاً {name}! رجعت لنا 😊
شو بقدر أساعدك اليوم؟', 'שלום {name}! חזרת אלינו 😊', 'all', ARRAY['name']),
('product_card', '{number}️⃣ {name} {storage} — {price}₪ {badge}
   💰 تقسيط: {monthly}₪ × 18 شهر
   🔗 {url}', NULL, 'all', ARRAY['number', 'name', 'storage', 'price', 'badge', 'monthly', 'url']),
('handoff', 'أكيد! عشان موظف يتابع معك بسرعة:
📝 عبّي الفورم: clalmobile.com/contact
سجّلت طلبك وبيتواصلوا معك بأقرب وقت 🙏', 'בטח! כדי שנציג ימשיך איתך:
📝 מלא את הטופס: clalmobile.com/contact', 'all', ARRAY[]),
('csat', 'هل ساعدتك اليوم؟
👍 نعم
👎 لا', 'האם עזרתי לך היום?
👍 כן
👎 לא', 'all', ARRAY[]),
('goodbye', 'شكراً لزيارتك ClalMobile! 🙏
إذا احتجت أي شي، أنا هون. يوم سعيد! ✨', 'תודה שביקרת ב-ClalMobile! 🙏', 'all', ARRAY[]),
('upsell', '👍 اختيار ممتاز! لا تنسى الإكسسوارات:
🛡️ جراب حماية — من 49₪
📱 حماية شاشة — من 29₪
🔌 شاحن أصلي — من 89₪
تقدر تضيفهم للسلة من المتجر!', NULL, 'all', ARRAY[]),
('not_available', 'للأسف هذا المنتج غير متوفر حالياً 😞
بس عندنا بدائل ممتازة! تبي أعرضلك؟', NULL, 'all', ARRAY[]),
('daily_offer', '🔥 عرض اليوم: {product} بسعر خاص {price}₪ بدل {old_price}₪!
اضغط هون: {url}', NULL, 'all', ARRAY['product', 'price', 'old_price', 'url'])
ON CONFLICT (key) DO NOTHING;
