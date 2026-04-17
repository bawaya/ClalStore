-- =====================================================
-- ClalMobile — Product Variants + CMS Content
-- Migration 009: Variant pricing + website content control
-- =====================================================

-- ===== 1. Add variants JSONB to products =====
-- Format: [{"storage":"256GB","price":4298,"old_price":4798,"cost":3500,"stock":5}, ...]
-- If empty/null → fallback to product.price (backward compatible)
ALTER TABLE products ADD COLUMN IF NOT EXISTS variants JSONB DEFAULT '[]';

-- ===== 2. Website Content Sections (CMS) =====
CREATE TABLE IF NOT EXISTS website_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section TEXT NOT NULL UNIQUE,          -- 'hero', 'stats', 'features', 'faq', 'cta', 'footer'
  title_ar TEXT,
  title_he TEXT,
  subtitle_ar TEXT,
  subtitle_he TEXT,
  content JSONB DEFAULT '{}',            -- section-specific structured data
  is_visible BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE website_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_full_website_content" ON website_content FOR ALL USING (auth.role() = 'service_role');

-- ===== 3. Seed default website content =====
INSERT INTO website_content (section, title_ar, title_he, content, sort_order) VALUES
  ('hero', 'ClalMobile', 'ClalMobile', '{"badge_ar":"🔥 عروض حصرية","badge_he":"🔥 מבצעים בלעדיים","description_ar":"أفضل الأسعار على الأجهزة الذكية والإكسسوارات","description_he":"המחירים הטובים ביותר על מכשירים חכמים ואביזרים","cta_store_ar":"تسوّق الآن","cta_store_he":"קנה עכשיו","cta_plans_ar":"باقات الخطوط","cta_plans_he":"חבילות קווים","bg_image":""}', 1),
  ('stats', NULL, NULL, '{"items":[{"value":"500+","label_ar":"عميل سعيد","label_he":"לקוחות מרוצים","icon":"👥"},{"value":"50+","label_ar":"منتج متوفر","label_he":"מוצרים זמינים","icon":"📱"},{"value":"24h","label_ar":"دعم متواصل","label_he":"תמיכה רציפה","icon":"⏰"},{"value":"100%","label_ar":"ضمان رسمي","label_he":"אחריות רשמית","icon":"✅"}]}', 2),
  ('features', NULL, NULL, '{"items":[{"icon":"🚚","title_ar":"توصيل مجاني","title_he":"משלוח חינם","desc_ar":"لجميع الطلبات فوق ₪200","desc_he":"לכל הזמנה מעל ₪200"},{"icon":"🛡️","title_ar":"ضمان رسمي","title_he":"אחריות רשמית","desc_ar":"ضمان سنتين على الأجهزة","desc_he":"שנתיים אחריות על מכשירים"},{"icon":"💳","title_ar":"أقساط بدون فوائد","title_he":"תשלומים ללא ריבית","desc_ar":"حتى 36 دفعة","desc_he":"עד 36 תשלומים"},{"icon":"🔄","title_ar":"إرجاع مجاني","title_he":"החזרה חינם","desc_ar":"خلال 14 يوم","desc_he":"תוך 14 ימים"},{"icon":"📞","title_ar":"دعم فني","title_he":"תמיכה טכנית","desc_ar":"24/7 عبر الواتساب","desc_he":"24/7 בוואטסאפ"},{"icon":"⭐","title_ar":"منتجات أصلية","title_he":"מוצרים מקוריים","desc_ar":"100% أصلي ومضمون","desc_he":"100% מקורי ומובטח"}]}', 4),
  ('faq', NULL, NULL, '{"items":[{"q_ar":"كيف أطلب من المتجر؟","q_he":"איך מזמינים מהחנות?","a_ar":"اختر المنتج، أضفه للسلة، وأتمم الطلب بخطوات بسيطة","a_he":"בחר מוצר, הוסף לעגלה, והשלם את ההזמנה בצעדים פשוטים"},{"q_ar":"ما هي طرق الدفع؟","q_he":"מהן דרכי התשלום?","a_ar":"بطاقة ائتمان، تحويل بنكي، أو أقساط حتى 36 دفعة","a_he":"כרטיס אשראי, העברה בנקאית, או תשלומים עד 36"},{"q_ar":"كم يستغرق التوصيل؟","q_he":"כמה זמן לוקח המשלוח?","a_ar":"1-3 أيام عمل لجميع أنحاء البلاد","a_he":"1-3 ימי עסקים לכל רחבי הארץ"},{"q_ar":"هل يوجد ضمان؟","q_he":"יש אחריות?","a_ar":"نعم، ضمان رسمي سنتين للأجهزة وسنة للإكسسوارات","a_he":"כן, אחריות רשמית שנתיים למכשירים ושנה לאביזרים"},{"q_ar":"كيف أتواصل مع الدعم؟","q_he":"איך יוצרים קשר עם התמיכה?","a_ar":"عبر الواتساب أو البوت الذكي في الموقع","a_he":"דרך הוואטסאפ או הבוט החכם באתר"},{"q_ar":"هل يمكن إرجاع المنتج؟","q_he":"אפשר להחזיר מוצר?","a_ar":"نعم، خلال 14 يوم حسب قانون حماية المستهلك","a_he":"כן, תוך 14 ימים לפי חוק הגנת הצרכן"}]}', 5),
  ('cta', NULL, NULL, '{"title_ar":"جاهز تبدأ؟","title_he":"מוכן להתחיל?","desc_ar":"اكتشف أفضل العروض على الأجهزة الذكية","desc_he":"גלה את המבצעים הטובים ביותר על מכשירים חכמים","btn1_ar":"تسوّق الآن","btn1_he":"קנה עכשיו","btn1_link":"/store","btn2_ar":"تواصل معنا","btn2_he":"צור קשר","btn2_link":"/contact"}', 6),
  ('footer', NULL, NULL, '{"phone":"053-3337653","whatsapp":"972533337653","email":"support@clalmobile.com","address_ar":"إسرائيل","address_he":"ישראל","social":{"facebook":"","instagram":"","tiktok":"","twitter":""},"copyright_ar":"جميع الحقوق محفوظة","copyright_he":"כל הזכויות שמורות"}', 7)
ON CONFLICT (section) DO NOTHING;
