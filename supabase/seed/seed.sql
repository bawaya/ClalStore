-- =====================================================
-- ClalMobile — Seed Data
-- Sample products, heroes, line plans, coupons
-- Run after migrations
-- =====================================================

-- ===== Products: Devices =====
INSERT INTO products (type, brand, name_ar, name_he, price, old_price, cost, stock, sold, colors, storage_options, specs, featured) VALUES
('device', 'Samsung', 'Galaxy S25 Ultra', 'Galaxy S25 Ultra', 4298, NULL, 3200, 10, 45,
  '[{"hex":"#1a1a2e","name_ar":"أسود","name_he":"שחור"},{"hex":"#c0c0c0","name_ar":"فضي","name_he":"כסף"},{"hex":"#e8dfd0","name_ar":"تيتانيوم","name_he":"טיטניום"}]',
  '{"512GB","256GB"}',
  '{"screen":"6.9\"","camera":"200MP","battery":"5000mAh","cpu":"SD 8 Elite","ram":"12GB"}',
  true),

('device', 'Apple', 'iPhone 17', 'iPhone 17', 3598, NULL, 2800, 8, 32,
  '[{"hex":"#5a6a7a","name_ar":"أزرق","name_he":"כחול"},{"hex":"#d8a0c8","name_ar":"وردي","name_he":"ורוד"}]',
  '{"512GB","256GB","128GB"}',
  '{"screen":"6.3\"","camera":"48MP","battery":"4500mAh","cpu":"A19","ram":"8GB"}',
  true),

('device', 'Samsung', 'Z Flip 6', 'Z Flip 6', 1890, 3449, 1500, 3, 18,
  '[{"hex":"#3a3a4a","name_ar":"أسود","name_he":"שחור"},{"hex":"#e0e0ff","name_ar":"لافندر","name_he":"לבנדר"}]',
  '{"256GB"}',
  '{"screen":"6.7\"","camera":"50MP","battery":"4000mAh","cpu":"SD 8 Gen 3","ram":"12GB"}',
  false),

('device', 'Xiaomi', '14T Pro', '14T Pro', 2499, 2899, 1800, 6, 12,
  '[{"hex":"#1a1a2e","name_ar":"أسود","name_he":"שחור"},{"hex":"#1a3a5a","name_ar":"أزرق","name_he":"כחול"}]',
  '{"512GB","256GB"}',
  '{"screen":"6.67\"","camera":"50MP","battery":"5000mAh","cpu":"Dimensity 9300+","ram":"12GB"}',
  false),

('device', 'Samsung', 'Galaxy A55', 'Galaxy A55', 1299, 1499, 900, 15, 55,
  '[{"hex":"#1a1a2e","name_ar":"أسود","name_he":"שחור"},{"hex":"#e8dfe0","name_ar":"بنفسجي فاتح","name_he":"סגול בהיר"}]',
  '{"256GB","128GB"}',
  '{"screen":"6.6\"","camera":"50MP","battery":"5000mAh","cpu":"Exynos 1480","ram":"8GB"}',
  false),

('device', 'Apple', 'iPhone 16 Pro Max', 'iPhone 16 Pro Max', 5499, NULL, 4200, 5, 22,
  '[{"hex":"#2a2a3a","name_ar":"تيتانيوم أسود","name_he":"טיטניום שחור"},{"hex":"#f5f0e8","name_ar":"تيتانيوم طبيعي","name_he":"טיטניום טבעי"}]',
  '{"1TB","512GB","256GB"}',
  '{"screen":"6.9\"","camera":"48MP","battery":"4685mAh","cpu":"A18 Pro","ram":"8GB"}',
  true);

-- ===== Products: Accessories =====
INSERT INTO products (type, brand, name_ar, name_he, price, old_price, cost, stock, sold, specs, featured) VALUES
('accessory', 'Samsung', 'Buds 3 Pro', 'Buds 3 Pro', 899, 999, 500, 20, 28, '{}', false),
('accessory', 'Apple', 'AirPods Pro 2', 'AirPods Pro 2', 999, NULL, 650, 15, 35, '{}', true),
('accessory', 'Samsung', 'شاحن 45W', 'מטען 45W', 149, NULL, 60, 50, 80, '{}', false),
('accessory', 'Apple', 'كفر MagSafe', 'כיסוי MagSafe', 199, 249, 80, 30, 22, '{}', false),
('accessory', 'Samsung', 'Galaxy Watch 7', 'Galaxy Watch 7', 1199, 1399, 750, 8, 15, '{}', false),
('accessory', 'Apple', 'Apple Watch SE', 'Apple Watch SE', 1099, NULL, 700, 10, 20, '{}', false);

-- ===== Heroes / Banners =====
INSERT INTO heroes (title_ar, title_he, subtitle_ar, subtitle_he, cta_text_ar, cta_text_he, sort_order) VALUES
('عروض الصيف 🔥', 'מבצעי קיץ 🔥', 'خصومات حتى 40% على أجهزة Samsung', 'עד 40% הנחה על מכשירי Samsung', 'تسوّق الآن', 'קנה עכשיו', 1),
('iPhone 17 وصل!', '!iPhone 17 הגיע', 'اطلب الآن واحصل على كفر MagSafe مجاناً', 'הזמן עכשיו וקבל כיסוי MagSafe במתנה', 'اطلب الآن', 'הזמן עכשיו', 2),
('باقات HOT Mobile 📡', 'חבילות HOT Mobile 📡', 'أقوى الباقات بأفضل الأسعار', 'החבילות הכי חזקות במחירים הכי טובים', 'اكتشف الباقات', 'גלה חבילות', 3);

-- ===== Line Plans =====
INSERT INTO line_plans (name_ar, name_he, data_amount, price, features_ar, features_he, popular, sort_order) VALUES
('بيسك', 'בייסיק', '10GB', 29,
  '{"10GB داتا","دقائق غير محدودة","SMS غير محدود"}',
  '{"10GB גלישה","שיחות ללא הגבלה","SMS ללא הגבלה"}',
  false, 1),
('بريميوم', 'פרמיום', '50GB', 59,
  '{"50GB داتا","دقائق غير محدودة","SMS غير محدود","5GB تجوال"}',
  '{"50GB גלישה","שיחות ללא הגבלה","SMS ללא הגבלה","5GB רואמינג"}',
  true, 2),
('ألترا', 'אולטרה', '100GB', 89,
  '{"100GB داتا","دقائق غير محدودة","SMS غير محدود","15GB تجوال","HOT TV مجاناً"}',
  '{"100GB גלישה","שיחות ללא הגבלה","SMS ללא הגבלה","15GB רואמינג","HOT TV חינם"}',
  false, 3),
('VIP', 'VIP', '∞', 139,
  '{"داتا غير محدودة","دقائق غير محدودة","SMS غير محدود","30GB تجوال","HOT TV + Cinema","أولوية دعم"}',
  '{"גלישה ללא הגבלה","שיחות ללא הגבלה","SMS ללא הגבלה","30GB רואמינג","HOT TV + Cinema","תמיכה עדיפות"}',
  false, 4);

-- ===== Coupons =====
INSERT INTO coupons (code, type, value, min_order, max_uses, active) VALUES
('WELCOME10', 'percent', 10, 100, 0, true),
('VIP20', 'percent', 20, 500, 50, true),
('SUMMER50', 'fixed', 50, 200, 100, true),
('FREE100', 'fixed', 100, 1000, 20, true);

-- ===== Categories =====
INSERT INTO categories (name_ar, name_he, type, sort_order) VALUES
('أجهزة Samsung', 'מכשירי Samsung', 'auto', 1),
('أجهزة Apple', 'מכשירי Apple', 'auto', 2),
('إكسسوارات', 'אביזרים', 'auto', 3),
('عروض خاصة', 'מבצעים מיוחדים', 'auto', 4);

-- ===== Done! =====
-- Products: 12 (6 devices + 6 accessories)
-- Heroes: 3
-- Line Plans: 4
-- Coupons: 4
-- Categories: 4
