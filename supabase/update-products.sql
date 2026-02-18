-- =====================================================
-- ClalMobile — تحديث أسعار المنتجات
-- المصدر: محيرון HOT Mobile (17.02.2026)
-- عمود "1-18 תשלומים" + 18% מע"מ
-- الحساب: سعر_بدون_ضريبة × 1.18 = السعر النهائي
-- =====================================================

-- مسح المنتجات القديمة (الأجهزة فقط)
DELETE FROM products WHERE category = 'device';

-- ===== iPhone 17 =====
INSERT INTO products (name_ar, name_he, brand, category, price, storage, stock, active, featured, description_ar) VALUES
('iPhone 17', 'iPhone 17 256GB', 'Apple', 'device', 3798, '256GB', 10, true, true, 'آيفون 17 - أحدث إصدار'),
('iPhone 17', 'iPhone 17 512GB', 'Apple', 'device', 4698, '512GB', 8, true, false, 'آيفون 17 - 512 جيجا'),
('iPhone 17 Air', 'iPhone 17 Air 256GB', 'Apple', 'device', 3949, '256GB', 8, true, true, 'آيفون 17 اير'),
('iPhone 17 Air', 'iPhone 17 Air 512GB', 'Apple', 'device', 4949, '512GB', 5, true, false, 'آيفون 17 اير - 512 جيجا'),
('iPhone 17 Air', 'iPhone 17 Air 1TB', 'Apple', 'device', 5849, '1TB', 3, true, false, 'آيفون 17 اير - 1 تيرا'),
('iPhone 17 Pro', 'iPhone 17 Pro 256GB', 'Apple', 'device', 5148, '256GB', 10, true, true, 'آيفون 17 برو'),
('iPhone 17 Pro', 'iPhone 17 Pro 512GB', 'Apple', 'device', 6048, '512GB', 6, true, false, 'آيفون 17 برو - 512 جيجا'),
('iPhone 17 Pro', 'iPhone 17 Pro 1TB', 'Apple', 'device', 6998, '1TB', 3, true, false, 'آيفون 17 برو - 1 تيرا'),
('iPhone 17 Pro Max', 'iPhone 17 Pro Max 256GB', 'Apple', 'device', 5598, '256GB', 10, true, true, 'آيفون 17 برو ماكس'),
('iPhone 17 Pro Max', 'iPhone 17 Pro Max 512GB', 'Apple', 'device', 6498, '512GB', 6, true, false, 'آيفون 17 برو ماكس - 512 جيجا'),
('iPhone 17 Pro Max', 'iPhone 17 Pro Max 1TB', 'Apple', 'device', 7398, '1TB', 3, true, false, 'آيفون 17 برو ماكس - 1 تيرا'),
('iPhone 17 Pro Max', 'iPhone 17 Pro Max 2TB', 'Apple', 'device', 9198, '2TB', 2, true, false, 'آيفون 17 برو ماكس - 2 تيرا');

-- ===== iPhone 16 =====
INSERT INTO products (name_ar, name_he, brand, category, price, storage, stock, active, featured, description_ar) VALUES
('iPhone 16', 'iPhone 16 128GB', 'Apple', 'device', 3670, '128GB', 10, true, false, 'آيفون 16'),
('iPhone 16', 'iPhone 16 256GB', 'Apple', 'device', 4179, '256GB', 8, true, false, 'آيفون 16 - 256 جيجا'),
('iPhone 16 Plus', 'iPhone 16 Plus 128GB', 'Apple', 'device', 4099, '128GB', 6, true, false, 'آيفون 16 بلس'),
('iPhone 16 Plus', 'iPhone 16 Plus 256GB', 'Apple', 'device', 4599, '256GB', 5, true, false, 'آيفون 16 بلس - 256 جيجا'),
('iPhone 16 Pro', 'iPhone 16 Pro 128GB', 'Apple', 'device', 4599, '128GB', 8, true, true, 'آيفون 16 برو'),
('iPhone 16 Pro', 'iPhone 16 Pro 256GB', 'Apple', 'device', 5179, '256GB', 6, true, false, 'آيفون 16 برو - 256 جيجا'),
('iPhone 16 Pro', 'iPhone 16 Pro 512GB', 'Apple', 'device', 6099, '512GB', 4, true, false, 'آيفون 16 برو - 512 جيجا'),
('iPhone 16 Pro', 'iPhone 16 Pro 1TB', 'Apple', 'device', 7099, '1TB', 2, true, false, 'آيفون 16 برو - 1 تيرا'),
('iPhone 16 Pro Max', 'iPhone 16 Pro Max 256GB', 'Apple', 'device', 5599, '256GB', 8, true, true, 'آيفون 16 برو ماكس'),
('iPhone 16 Pro Max', 'iPhone 16 Pro Max 512GB', 'Apple', 'device', 6599, '512GB', 4, true, false, 'آيفون 16 برو ماكس - 512 جيجا'),
('iPhone 16 Pro Max', 'iPhone 16 Pro Max 1TB', 'Apple', 'device', 7449, '1TB', 2, true, false, 'آيفون 16 برو ماكس - 1 تيرا'),
('iPhone 16e', 'iPhone 16e 128GB', 'Apple', 'device', 2050, '128GB', 10, true, false, 'آيفون 16e'),
('iPhone 16e', 'iPhone 16e 256GB', 'Apple', 'device', 2250, '256GB', 8, true, false, 'آيفون 16e - 256 جيجا');

-- ===== iPhone 15 =====
INSERT INTO products (name_ar, name_he, brand, category, price, storage, stock, active, featured, description_ar) VALUES
('iPhone 15', 'iPhone 15 128GB', 'Apple', 'device', 2999, '128GB', 10, true, false, 'آيفون 15'),
('iPhone 15', 'iPhone 15 256GB', 'Apple', 'device', 3599, '256GB', 6, true, false, 'آيفون 15 - 256 جيجا'),
('iPhone 15 Pro Max', 'iPhone 15 Pro Max 256GB', 'Apple', 'device', 5949, '256GB', 4, true, false, 'آيفون 15 برو ماكس'),
('iPhone 15 Pro', 'iPhone 15 Pro 256GB', 'Apple', 'device', 5399, '256GB', 4, true, false, 'آيفون 15 برو'),
('iPhone 15 Pro', 'iPhone 15 Pro 1TB', 'Apple', 'device', 7459, '1TB', 2, true, false, 'آيفون 15 برو - 1 تيرا');

-- ===== iPhone 14 =====
INSERT INTO products (name_ar, name_he, brand, category, price, storage, stock, active, featured, description_ar) VALUES
('iPhone 14 Pro Max', 'iPhone 14 Pro Max 256GB', 'Apple', 'device', 5999, '256GB', 3, true, false, 'آيفون 14 برو ماكس'),
('iPhone 14 Pro', 'iPhone 14 Pro 256GB', 'Apple', 'device', 5449, '256GB', 3, true, false, 'آيفون 14 برو'),
('iPhone 14 Plus', 'iPhone 14 Plus 512GB', 'Apple', 'device', 5739, '512GB', 2, true, false, 'آيفون 14 بلس'),
('iPhone 14', 'iPhone 14 256GB', 'Apple', 'device', 4335, '256GB', 4, true, false, 'آيفون 14 - 256 جيجا'),
('iPhone 14', 'iPhone 14 128GB', 'Apple', 'device', 2599, '128GB', 6, true, false, 'آيفون 14');

-- ===== iPhone 13 =====
INSERT INTO products (name_ar, name_he, brand, category, price, storage, stock, active, featured, description_ar) VALUES
('iPhone 13 Pro Max', 'iPhone 13 Pro Max 256GB', 'Apple', 'device', 5229, '256GB', 3, true, false, 'آيفون 13 برو ماكس'),
('iPhone 13 Pro Max', 'iPhone 13 Pro Max 128GB', 'Apple', 'device', 4589, '128GB', 3, true, false, 'آيفون 13 برو ماكس'),
('iPhone 13', 'iPhone 13 512GB', 'Apple', 'device', 5089, '512GB', 2, true, false, 'آيفون 13 - 512 جيجا'),
('iPhone 13', 'iPhone 13 256GB', 'Apple', 'device', 3679, '256GB', 4, true, false, 'آيفون 13 - 256 جيجا'),
('iPhone 13', 'iPhone 13 128GB', 'Apple', 'device', 2099, '128GB', 6, true, false, 'آيفون 13');

-- ===== iPhone 12 =====
INSERT INTO products (name_ar, name_he, brand, category, price, storage, stock, active, featured, description_ar) VALUES
('iPhone 12 Pro Max', 'iPhone 12 Pro Max 256GB', 'Apple', 'device', 5339, '256GB', 2, true, false, 'آيفون 12 برو ماكس'),
('iPhone 12', 'iPhone 12 128GB', 'Apple', 'device', 3229, '128GB', 4, true, false, 'آيفون 12');

-- ===== Samsung S25 =====
INSERT INTO products (name_ar, name_he, brand, category, price, storage, stock, active, featured, description_ar) VALUES
('Galaxy S25', 'Samsung Galaxy S25 128GB', 'Samsung', 'device', 2934, '128GB', 10, true, false, 'جالكسي S25'),
('Galaxy S25', 'Samsung Galaxy S25 256GB', 'Samsung', 'device', 3098, '256GB', 8, true, false, 'جالكسي S25 - 256'),
('Galaxy S25+', 'Samsung Galaxy S25 Plus 256GB', 'Samsung', 'device', 3498, '256GB', 6, true, true, 'جالكسي S25 بلس'),
('Galaxy S25+', 'Samsung Galaxy S25 Plus 512GB', 'Samsung', 'device', 3998, '512GB', 4, true, false, 'جالكسي S25 بلس - 512'),
('Galaxy S25 Ultra', 'Samsung Galaxy S25 Ultra 256GB', 'Samsung', 'device', 4498, '256GB', 8, true, true, 'جالكسي S25 الترا'),
('Galaxy S25 Ultra', 'Samsung Galaxy S25 Ultra 512GB', 'Samsung', 'device', 4994, '512GB', 5, true, false, 'جالكسي S25 الترا - 512'),
('Galaxy S25 Ultra', 'Samsung Galaxy S25 Ultra 1TB', 'Samsung', 'device', 6149, '1TB', 2, true, false, 'جالكسي S25 الترا - 1 تيرا'),
('Galaxy S25 Edge', 'Samsung Galaxy S25 Edge 256GB', 'Samsung', 'device', 2399, '256GB', 6, true, true, 'جالكسي S25 ايدج'),
('Galaxy S25 Edge', 'Samsung Galaxy S25 Edge 512GB', 'Samsung', 'device', 2999, '512GB', 4, true, false, 'جالكسي S25 ايدج - 512'),
('Galaxy S25 FE', 'Samsung Galaxy S25 FE 128GB', 'Samsung', 'device', 2248, '128GB', 8, true, false, 'جالكسي S25 FE'),
('Galaxy S25 FE', 'Samsung Galaxy S25 FE 256GB', 'Samsung', 'device', 2598, '256GB', 5, true, false, 'جالكسي S25 FE - 256');

-- ===== Samsung S24 =====
INSERT INTO products (name_ar, name_he, brand, category, price, storage, stock, active, featured, description_ar) VALUES
('Galaxy S24 Ultra', 'Samsung Galaxy S24 Ultra 512GB', 'Samsung', 'device', 4899, '512GB', 3, true, false, 'جالكسي S24 الترا - 512'),
('Galaxy S24 Ultra', 'Samsung Galaxy S24 Ultra 256GB', 'Samsung', 'device', 4519, '256GB', 4, true, false, 'جالكسي S24 الترا'),
('Galaxy S24+', 'Samsung Galaxy S24 Plus 512GB', 'Samsung', 'device', 3899, '512GB', 3, true, false, 'جالكسي S24 بلس - 512'),
('Galaxy S24+', 'Samsung Galaxy S24 Plus 256GB', 'Samsung', 'device', 3599, '256GB', 4, true, false, 'جالكسي S24 بلس'),
('Galaxy S24 FE', 'Samsung Galaxy S24 FE 256GB', 'Samsung', 'device', 2450, '256GB', 5, true, false, 'جالكسي S24 FE - 256'),
('Galaxy S24 FE', 'Samsung Galaxy S24 FE 128GB', 'Samsung', 'device', 2299, '128GB', 6, true, false, 'جالكسي S24 FE'),
('Galaxy S24', 'Samsung Galaxy S24 256GB', 'Samsung', 'device', 3099, '256GB', 4, true, false, 'جالكسي S24 - 256'),
('Galaxy S24', 'Samsung Galaxy S24 128GB', 'Samsung', 'device', 3049, '128GB', 5, true, false, 'جالكسي S24');

-- ===== Samsung S23 =====
INSERT INTO products (name_ar, name_he, brand, category, price, storage, stock, active, featured, description_ar) VALUES
('Galaxy S23+', 'Samsung Galaxy S23+ 256GB', 'Samsung', 'device', 3729, '256GB', 3, true, false, 'جالكسي S23 بلس'),
('Galaxy S23 Ultra', 'Samsung Galaxy S23 Ultra 512GB', 'Samsung', 'device', 5399, '512GB', 2, true, false, 'جالكسي S23 الترا - 512'),
('Galaxy S23 Ultra', 'Samsung Galaxy S23 Ultra 256GB', 'Samsung', 'device', 4539, '256GB', 3, true, false, 'جالكسي S23 الترا'),
('Galaxy S23 FE', 'Samsung Galaxy S23 FE 128GB', 'Samsung', 'device', 1669, '128GB', 5, true, false, 'جالكسي S23 FE'),
('Galaxy S23', 'Samsung Galaxy S23 128GB', 'Samsung', 'device', 2119, '128GB', 4, true, false, 'جالكسي S23');

-- ===== Samsung Z Flip =====
INSERT INTO products (name_ar, name_he, brand, category, price, storage, stock, active, featured, description_ar) VALUES
('Galaxy Z Flip7', 'Samsung Galaxy Z Flip7 256GB', 'Samsung', 'device', 4049, '256GB', 6, true, true, 'جالكسي Z فليب 7'),
('Galaxy Z Flip7', 'Samsung Galaxy Z Flip7 512GB', 'Samsung', 'device', 4549, '512GB', 4, true, false, 'جالكسي Z فليب 7 - 512'),
('Galaxy Z Flip6', 'Samsung Galaxy Z Flip6 512GB', 'Samsung', 'device', 4639, '512GB', 3, true, false, 'جالكسي Z فليب 6 - 512'),
('Galaxy Z Flip6', 'Samsung Galaxy Z Flip6 256GB', 'Samsung', 'device', 3929, '256GB', 4, true, false, 'جالكسي Z فليب 6'),
('Galaxy Z Flip5', 'Galaxy Z Flip5 256GB', 'Samsung', 'device', 3429, '256GB', 3, true, false, 'جالكسي Z فليب 5');

-- ===== Samsung Z Fold =====
INSERT INTO products (name_ar, name_he, brand, category, price, storage, stock, active, featured, description_ar) VALUES
('Galaxy Z Fold7', 'Samsung Galaxy Z Fold7 256GB', 'Samsung', 'device', 7335, '256GB', 4, true, true, 'جالكسي Z فولد 7'),
('Galaxy Z Fold7', 'Samsung Galaxy Z Fold7 512GB', 'Samsung', 'device', 7949, '512GB', 2, true, false, 'جالكسي Z فولد 7 - 512'),
('Galaxy Z Fold6', 'Samsung Galaxy Z Fold6 512GB', 'Samsung', 'device', 7359, '512GB', 2, true, false, 'جالكسي Z فولد 6 - 512'),
('Galaxy Z Fold6', 'Samsung Galaxy Z Fold6 256GB', 'Samsung', 'device', 6799, '256GB', 3, true, false, 'جالكسي Z فولد 6'),
('Galaxy Z Fold5', 'Samsung Galaxy Z Fold5 256GB', 'Samsung', 'device', 5949, '256GB', 2, true, false, 'جالكسي Z فولد 5'),
('Galaxy Z Fold4', 'Samsung Galaxy Z Fold4 256GB', 'Samsung', 'device', 4539, '256GB', 2, true, false, 'جالكسي Z فولد 4');

-- ===== Samsung A Series =====
INSERT INTO products (name_ar, name_he, brand, category, price, storage, stock, active, featured, description_ar) VALUES
('Galaxy A73 5G', 'Samsung Galaxy A73 128GB', 'Samsung', 'device', 1969, '128GB', 5, true, false, 'جالكسي A73'),
('Galaxy A72', 'Samsung Galaxy A72 128GB', 'Samsung', 'device', 1809, '128GB', 4, true, false, 'جالكسي A72'),
('Galaxy A56 5G', 'Samsung Galaxy A56 128GB', 'Samsung', 'device', 1569, '128GB', 8, true, true, 'جالكسي A56'),
('Galaxy A56 5G', 'Samsung Galaxy A56 256GB', 'Samsung', 'device', 1799, '256GB', 5, true, false, 'جالكسي A56 - 256'),
('Galaxy A55', 'Samsung Galaxy A55 128GB', 'Samsung', 'device', 1869, '128GB', 6, true, false, 'جالكسي A55'),
('Galaxy A55 5G', 'Samsung Galaxy A55 256GB', 'Samsung', 'device', 1899, '256GB', 4, true, false, 'جالكسي A55 - 256'),
('Galaxy A54', 'Samsung Galaxy A54 128GB', 'Samsung', 'device', 1769, '128GB', 5, true, false, 'جالكسي A54'),
('Galaxy A53 5G', 'Samsung Galaxy A53 128GB', 'Samsung', 'device', 1669, '128GB', 4, true, false, 'جالكسي A53'),
('Galaxy A36 5G', 'Samsung Galaxy A36 128GB', 'Samsung', 'device', 1249, '128GB', 10, true, true, 'جالكسي A36'),
('Galaxy A34', 'Samsung Galaxy A34 128GB', 'Samsung', 'device', 1309, '128GB', 5, true, false, 'جالكسي A34'),
('Galaxy A26 5G', 'Samsung Galaxy A26 128GB', 'Samsung', 'device', 1099, '128GB', 8, true, false, 'جالكسي A26'),
('Galaxy A25', 'Samsung Galaxy A25 128GB', 'Samsung', 'device', 1109, '128GB', 6, true, false, 'جالكسي A25'),
('Galaxy A17', 'Samsung Galaxy A17 128GB', 'Samsung', 'device', 699, '128GB', 10, true, false, 'جالكسي A17'),
('Galaxy A16', 'Samsung Galaxy A16 128GB', 'Samsung', 'device', 849, '128GB', 8, true, false, 'جالكسي A16'),
('Galaxy A14', 'Samsung Galaxy A14 64GB', 'Samsung', 'device', 709, '64GB', 6, true, false, 'جالكسي A14'),
('Galaxy A06', 'Samsung Galaxy A06 64GB', 'Samsung', 'device', 599, '64GB', 10, true, false, 'جالكسي A06'),
('Galaxy A06', 'Samsung Galaxy A06 128GB', 'Samsung', 'device', 699, '128GB', 8, true, false, 'جالكسي A06 - 128'),
('Galaxy M54', 'Samsung Galaxy M54 256GB', 'Samsung', 'device', 1519, '256GB', 4, true, false, 'جالكسي M54');

-- ===== Oppo =====
INSERT INTO products (name_ar, name_he, brand, category, price, storage, stock, active, featured, description_ar) VALUES
('Oppo A76', 'Oppo A76 128GB', 'Oppo', 'device', 1109, '128GB', 5, true, false, 'أوبو A76'),
('Oppo A94 5G', 'Oppo A94 128GB', 'Oppo', 'device', 1619, '128GB', 4, true, false, 'أوبو A94'),
('Oppo Reno 6 5G', 'Oppo Reno 6 128GB', 'Oppo', 'device', 2069, '128GB', 3, true, false, 'أوبو رينو 6'),
('Oppo Reno 7 5G', 'Oppo Reno 7 256GB', 'Oppo', 'device', 2219, '256GB', 3, true, false, 'أوبو رينو 7'),
('Oppo Reno 7z 5G', 'Oppo Reno 7z 128GB', 'Oppo', 'device', 1819, '128GB', 3, true, false, 'أوبو رينو 7z');

-- ===== Google =====
INSERT INTO products (name_ar, name_he, brand, category, price, storage, stock, active, featured, description_ar) VALUES
('Pixel 9', 'Google Pixel 9 128GB', 'Google', 'device', 2649, '128GB', 5, true, true, 'جوجل بيكسل 9'),
('Pixel 9 Pro XL', 'Google Pixel 9 Pro XL 256GB', 'Google', 'device', 3899, '256GB', 3, true, false, 'جوجل بيكسل 9 برو XL');

-- ===== Xiaomi =====
INSERT INTO products (name_ar, name_he, brand, category, price, storage, stock, active, featured, description_ar) VALUES
('Xiaomi 15T 5G', 'Xiaomi 15T 256GB', 'Xiaomi', 'device', 1999, '256GB', 8, true, true, 'شاومي 15T'),
('Xiaomi 15T 5G', 'Xiaomi 15T 512GB', 'Xiaomi', 'device', 2349, '512GB', 5, true, false, 'شاومي 15T - 512'),
('Xiaomi 15T Pro', 'Xiaomi 15T Pro 512GB', 'Xiaomi', 'device', 2999, '512GB', 4, true, true, 'شاومي 15T برو'),
('Poco X6 Pro 5G', 'Poco X6 Pro 512GB', 'Xiaomi', 'device', 1499, '512GB', 6, true, false, 'بوكو X6 برو'),
('Redmi 15C NFC', 'Redmi 15C NFC 128GB', 'Xiaomi', 'device', 539, '128GB', 10, true, false, 'ردمي 15C'),
('Redmi 15C NFC', 'Redmi 15C NFC 256GB', 'Xiaomi', 'device', 649, '256GB', 8, true, false, 'ردمي 15C - 256'),
('Redmi Note 14 Pro+ 5G', 'Redmi Note 14 Pro Plus 512GB', 'Xiaomi', 'device', 2179, '512GB', 6, true, true, 'ردمي نوت 14 برو بلس'),
('Redmi Note 13 4G', 'Redmi Note 13 256GB', 'Xiaomi', 'device', 849, '256GB', 8, true, false, 'ردمي نوت 13'),
('Redmi Note 13 Pro 5G', 'Redmi Note 13 Pro 512GB', 'Xiaomi', 'device', 1499, '512GB', 5, true, false, 'ردمي نوت 13 برو'),
('Mi 11 Lite NE 5G', 'Mi 11 Lite NE 256GB', 'Xiaomi', 'device', 1809, '256GB', 3, true, false, 'مي 11 لايت'),
('POCO F2 Pro 5G', 'POCO F2 Pro 256GB', 'Xiaomi', 'device', 2529, '256GB', 3, true, false, 'بوكو F2 برو'),
('Poco X7 Pro 5G', 'Poco X7 Pro 512GB', 'Xiaomi', 'device', 1949, '512GB', 5, true, false, 'بوكو X7 برو'),
('Redmi Note 14 Pro 5G', 'Redmi Note 14 Pro 512GB', 'Xiaomi', 'device', 1722, '512GB', 6, true, false, 'ردمي نوت 14 برو');

-- ===== ZTE =====
INSERT INTO products (name_ar, name_he, brand, category, price, storage, stock, active, featured, description_ar) VALUES
('ZTE F100', 'ZTE F100 Kosher', 'ZTE', 'device', 299, 'N/A', 15, true, false, 'هاتف كوشر');
