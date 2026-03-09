-- =====================================================
-- ClalMobile — WhatsApp Business Templates
-- Migration 016: Seed WhatsApp Business API templates
-- These must match templates approved in Meta Business Manager
-- Run in Supabase SQL Editor
-- =====================================================

-- ===== WhatsApp Business API Templates (bot_templates) =====
-- These template keys must be registered and approved in Meta/yCloud

INSERT INTO bot_templates (key, content_ar, content_he, channel, variables, active)
VALUES
  -- Order confirmation
  ('order_confirmed', 
   'مرحباً {{1}}! ✅\nتم تأكيد طلبك رقم #{{2}} بنجاح.\n💰 المبلغ: {{3}}₪\nسيتم التواصل معك لتنسيق التوصيل.\nشكراً لاختيارك ClalMobile! 🙏',
   'שלום {{1}}! ✅\nהזמנה #{{2}} אושרה בהצלחה.\n💰 סכום: {{3}}₪\nניצור קשר לתיאום משלוח.\nתודה שבחרת ClalMobile! 🙏',
   'whatsapp', ARRAY['customer_name', 'order_id', 'total'], true),

  -- Shipping update
  ('order_shipped',
   'مرحباً {{1}}! 🚚\nطلبك #{{2}} في الطريق إليك!\nرقم التتبع: {{3}}\nالتوصيل المتوقع: {{4}}\nاتصل فينا إذا عندك أي سؤال.',
   'שלום {{1}}! 🚚\nהזמנה #{{2}} בדרך אליך!\nמספר מעקב: {{3}}\nמשלוח צפוי: {{4}}',
   'whatsapp', ARRAY['customer_name', 'order_id', 'tracking', 'delivery_date'], true),

  -- Payment reminder
  ('payment_reminder',
   'مرحباً {{1}}! 💳\nهذا تذكير بخصوص طلبك #{{2}} بمبلغ {{3}}₪.\nلإتمام الدفع عبر حوالة بنكية:\n🏦 بنك لئومي — حساب 123456\nأو تواصل معنا لأي استفسار.',
   'שלום {{1}}! 💳\nתזכורת לגבי הזמנה #{{2}} בסך {{3}}₪.\nלהשלמת תשלום בהעברה בנקאית:\n🏦 בנק לאומי — חשבון 123456',
   'whatsapp', ARRAY['customer_name', 'order_id', 'total'], true),

  -- Follow-up after purchase
  ('post_purchase',
   'مرحباً {{1}}! 😊\nكيف حالك مع جهازك الجديد؟\nنتمنى إنك مبسوط! لو عندك أي سؤال أو تحتاج مساعدة، احنا هون.\n⭐ شاركنا رأيك: clalmobile.com/store\nشكراً! 🙏',
   'שלום {{1}}! 😊\nמה שלומך עם המכשיר החדש?\nאם יש שאלות, אנחנו כאן.\n⭐ שתפו את הדעה: clalmobile.com/store',
   'whatsapp', ARRAY['customer_name'], true),

  -- New offer / promotion
  ('promo_offer',
   'مرحباً {{1}}! 🎉\nعرض خاص لك من ClalMobile!\n{{2}}\n🔥 {{3}}\nالعرض ساري حتى {{4}}\n🛒 تسوق الآن: clalmobile.com/store',
   'שלום {{1}}! 🎉\nמבצע מיוחד מ-ClalMobile!\n{{2}}\n🔥 {{3}}\nבתוקף עד {{4}}\n🛒 לחנות: clalmobile.com/store',
   'whatsapp', ARRAY['customer_name', 'offer_title', 'offer_details', 'expiry_date'], true),

  -- Abandoned cart reminder
  ('abandoned_cart',
   'مرحباً {{1}}! 🛒\nلاحظنا إنك تركت منتجات في سلتك:\n📱 {{2}}\nلسا متوفرين! أكمل طلبك قبل ما يخلصوا:\n🔗 clalmobile.com/store/cart',
   'שלום {{1}}! 🛒\nשמנו לב שנשארו פריטים בעגלה:\n📱 {{2}}\nעדיין במלאי! השלם את ההזמנה:\n🔗 clalmobile.com/store/cart',
   'whatsapp', ARRAY['customer_name', 'product_names'], true),

  -- Welcome new customer
  ('welcome_customer',
   'أهلاً وسهلاً {{1}}! 👋\nشكراً لتسجيلك في ClalMobile — وكيل رسمي لـ HOT Mobile.\n📱 تصفح أجهزتنا: clalmobile.com/store\n📡 باقات HOT Mobile: clalmobile.com/store\n💬 عندك سؤال؟ رد على هذي الرسالة!',
   'ברוכים הבאים {{1}}! 👋\nתודה שנרשמת ל-ClalMobile — סוכן רשמי של HOT Mobile.\n📱 מכשירים: clalmobile.com/store\n📡 חבילות: clalmobile.com/store\n💬 שאלות? השב להודעה!',
   'whatsapp', ARRAY['customer_name'], true),

  -- Appointment/callback reminder
  ('callback_reminder',
   'مرحباً {{1}}! 📞\nهذا تذكير بموعد اتصالك مع فريق ClalMobile.\n📅 {{2}}\n⏰ {{3}}\nاذا تبي تغير الموعد، رد على هذي الرسالة.',
   'שלום {{1}}! 📞\nתזכורת לשיחה עם צוות ClalMobile.\n📅 {{2}}\n⏰ {{3}}\nלשינוי מועד, השב להודעה.',
   'whatsapp', ARRAY['customer_name', 'date', 'time'], true),

  -- CSAT survey
  ('csat_survey',
   'مرحباً {{1}}! 📝\nنود معرفة رأيك بخدمتنا.\nكيف تقيّم تجربتك مع ClalMobile؟\n⭐⭐⭐⭐⭐ ممتاز\n⭐⭐⭐⭐ جيد\n⭐⭐⭐ عادي\n⭐⭐ ضعيف\nرد برقم النجوم (1-5)',
   'שלום {{1}}! 📝\nנשמח לשמוע את דעתך.\nאיך הייתה החוויה עם ClalMobile?\n⭐⭐⭐⭐⭐ מצוין\n⭐⭐⭐⭐ טוב\n⭐⭐⭐ בסדר\n⭐⭐ חלש\nהשב עם ציון (1-5)',
   'whatsapp', ARRAY['customer_name'], true),

  -- Line plan activation
  ('line_activated',
   'مرحباً {{1}}! 📡\nتم تفعيل باقتك بنجاح!\n📱 الباقة: {{2}}\n📞 الرقم: {{3}}\nللمساعدة أو أي سؤال، نحنا هون دائماً 💚',
   'שלום {{1}}! 📡\nהחבילה הופעלה בהצלחה!\n📱 חבילה: {{2}}\n📞 מספר: {{3}}\nלעזרה, אנחנו כאן תמיד 💚',
   'whatsapp', ARRAY['customer_name', 'plan_name', 'phone_number'], true),

  -- Media received acknowledgment
  ('media_received',
   'شكراً على الملف! 📎\nوصلتنا الرسالة. كيف بقدر أساعدك؟\n\n📱 تصفح المنتجات\n📡 الباقات\n👤 كلم موظف',
   'תודה על הקובץ! 📎\nקיבלנו. איך אפשר לעזור?\n\n📱 מוצרים\n📡 חבילות\n👤 נציג',
   'all', ARRAY[]::TEXT[], true)

ON CONFLICT (key) DO UPDATE SET
  content_ar = EXCLUDED.content_ar,
  content_he = EXCLUDED.content_he,
  channel = EXCLUDED.channel,
  variables = EXCLUDED.variables,
  active = EXCLUDED.active;


-- ===== Inbox Templates (for CRM agents) =====
-- Using {{var}} format for consistency with TemplateSelector

INSERT INTO inbox_templates (name, category, content, variables, is_active, sort_order)
VALUES
  ('ترحيب عميل جديد', 'welcome',
   'أهلاً وسهلاً {{customer_name}}! 👋\nشكراً لتواصلك مع ClalMobile.\nكيف بقدر أساعدك اليوم؟',
   ARRAY['customer_name'], true, 1),

  ('تأكيد طلب', 'orders',
   'مرحباً {{customer_name}}! ✅\nتم تأكيد طلبك رقم #{{order_id}} بنجاح.\nالمبلغ: {{total}}₪\nسنتواصل معك لتنسيق التوصيل.',
   ARRAY['customer_name', 'order_id', 'total'], true, 2),

  ('تحديث شحن', 'shipping',
   'مرحباً {{customer_name}}! 🚚\nطلبك #{{order_id}} في الطريق!\nالتوصيل المتوقع: {{delivery_date}}\nاتصل فينا لأي استفسار.',
   ARRAY['customer_name', 'order_id', 'delivery_date'], true, 3),

  ('تذكير دفع', 'payment',
   'مرحباً {{customer_name}}! 💳\nتذكير بخصوص طلبك #{{order_id}} بمبلغ {{total}}₪.\nلإتمام الدفع:\n🏦 حوالة بنكية — بنك لئومي 123456\nأو تواصل معنا.',
   ARRAY['customer_name', 'order_id', 'total'], true, 4),

  ('عرض خاص', 'offers',
   'مرحباً {{customer_name}}! 🎉\nعندنا عرض خاص إلك:\n{{offer_details}}\nالعرض ساري لفترة محدودة!\n🛒 clalmobile.com/store',
   ARRAY['customer_name', 'offer_details'], true, 5),

  ('متابعة بعد الشراء', 'followup',
   'مرحباً {{customer_name}}! 😊\nكيف حالك مع جهازك الجديد {{product_name}}؟\nنتمنى إنك مبسوط! لو عندك أي سؤال، احنا هون.\n⭐ شاركنا رأيك!',
   ARRAY['customer_name', 'product_name'], true, 6),

  ('سلة متروكة', 'followup',
   'مرحباً {{customer_name}}! 🛒\nلاحظنا إنك تركت {{product_name}} في سلتك.\nلسا متوفر! أكمل طلبك قبل ما يخلص:\n🔗 clalmobile.com/store/cart',
   ARRAY['customer_name', 'product_name'], true, 7),

  ('تفعيل باقة', 'orders',
   'مرحباً {{customer_name}}! 📡\nتم تفعيل باقتك {{plan_name}} بنجاح!\n📞 الرقم: {{phone_number}}\nللمساعدة تواصل معنا في أي وقت 💚',
   ARRAY['customer_name', 'plan_name', 'phone_number'], true, 8),

  ('استبيان رضا', 'followup',
   'مرحباً {{customer_name}}! 📝\nكيف تقيّم تجربتك معنا؟\n⭐⭐⭐⭐⭐ ممتاز\n⭐⭐⭐⭐ جيد\n⭐⭐⭐ عادي\nرد برقم النجوم (1-5) 🙏',
   ARRAY['customer_name'], true, 9),

  ('لم يرد - متابعة', 'followup',
   'مرحباً {{customer_name}}! 📞\nحاولنا نتواصل معك بخصوص طلبك.\nلو عندك وقت، رد على هذي الرسالة أو اتصل فينا.\nنحنا هون لمساعدتك! 🙏',
   ARRAY['customer_name'], true, 10),

  ('ضمان ورجوع', 'general',
   'مرحباً {{customer_name}}! 🛡️\nبخصوص استفسارك عن الضمان:\n- ضمان المصنع: سنة كاملة\n- سياسة الإرجاع: 14 يوم\n- الشرط: الجهاز بحالته الأصلية\nلمزيد من التفاصيل: clalmobile.com/legal',
   ARRAY['customer_name'], true, 11)

ON CONFLICT DO NOTHING;


-- ===== Quick Replies for Inbox =====

INSERT INTO inbox_quick_replies (shortcut, title, content, category, is_active, sort_order)
VALUES
  ('/hi', 'ترحيب', 'أهلاً! كيف بقدر أساعدك؟ 😊', 'general', true, 1),
  ('/thanks', 'شكراً', 'شكراً لتواصلك! إذا تحتاج أي شي ثاني، احنا هون 🙏', 'general', true, 2),
  ('/wait', 'انتظر', 'لحظة من فضلك، جاري التحقق... ⏳', 'general', true, 3),
  ('/price', 'استفسار سعر', 'بالنسبة للأسعار، تقدر تشوف كل المنتجات والأسعار هون:\n🔗 clalmobile.com/store', 'general', true, 4),
  ('/ship', 'معلومات شحن', 'التوصيل لكل إسرائيل! 🚚\nعادي: 3-5 أيام عمل\nسريع: 1-2 يوم عمل\nالأسعار تظهر عند الطلب.', 'shipping', true, 5),
  ('/pay', 'طرق الدفع', 'طرق الدفع المتاحة:\n💳 بطاقة ائتمان\n🏦 حوالة بنكية\n💰 تقسيط (حسب المنتج)', 'payment', true, 6),
  ('/warranty', 'ضمان', 'ضمان المصنع سنة كاملة ✅\nسياسة إرجاع 14 يوم.\nالتفاصيل: clalmobile.com/legal', 'general', true, 7),
  ('/hours', 'ساعات العمل', 'ساعات العمل:\n🕐 أحد-خميس: 9:00-18:00\n🕐 جمعة: مغلق\n🕐 سبت: مغلق', 'general', true, 8),
  ('/plans', 'باقات', 'باقات HOT Mobile المتاحة:\n📡 شوف كل الباقات: clalmobile.com/store\nأو احكيلي شو تحتاج وبساعدك!', 'general', true, 9),
  ('/transfer', 'تحويل', 'بحولك لموظف متخصص. لحظة من فضلك... 🔄', 'general', true, 10)

ON CONFLICT (shortcut) DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active;


-- ===== Seed default labels =====

INSERT INTO inbox_labels (name, color, description, sort_order)
VALUES
  ('VIP', '#f59e0b', 'عملاء مميزين', 1),
  ('عاجل', '#ef4444', 'يحتاج اهتمام فوري', 2),
  ('طلب جديد', '#3b82f6', 'طلب جديد بحاجة معالجة', 3),
  ('شكوى', '#dc2626', 'شكوى عميل', 4),
  ('متابعة', '#8b5cf6', 'يحتاج متابعة', 5),
  ('باقة', '#06b6d4', 'استفسار عن باقات', 6),
  ('إكسسوارات', '#10b981', 'استفسار عن إكسسوارات', 7),
  ('ضمان', '#f97316', 'طلب ضمان أو إرجاع', 8)

ON CONFLICT DO NOTHING;


-- ===== Done! =====
-- WhatsApp Business templates (10 templates)
-- Inbox templates (11 templates)
-- Quick replies (10 shortcuts)
-- Default labels (8 labels)
