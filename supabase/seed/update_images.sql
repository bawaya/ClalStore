-- =====================================================
-- ClalMobile — Update Product Images
-- Real product images from manufacturer CDNs
-- Run in Supabase SQL Editor
-- =====================================================

-- ===== Devices =====

-- Samsung Galaxy S25 Ultra
UPDATE products SET image_url = 'https://image-us.samsung.com/SamsungUS/home/mobile/galaxy-s25-ultra/01132025/TITANIUM_SILVERBLUE_LOCKUP_v1.png'
WHERE name_he = 'Galaxy S25 Ultra' AND brand = 'Samsung' AND type = 'device';

-- Apple iPhone 17 (use iPhone 16 image as placeholder — iPhone 17 not released)
UPDATE products SET image_url = 'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-16-finish-select-202409-6-1inch-ultramarine?wid=500&hei=500&fmt=p-jpg'
WHERE name_he = 'iPhone 17' AND brand = 'Apple' AND type = 'device';

-- Samsung Z Flip 6
UPDATE products SET image_url = 'https://image-us.samsung.com/SamsungUS/home/mobile/galaxy-z-flip6/07102024/Galaxy-Z-Flip6_Silver-Shadow_Front.png'
WHERE name_he = 'Z Flip 6' AND brand = 'Samsung' AND type = 'device';

-- Xiaomi 14T Pro
UPDATE products SET image_url = 'https://i02.appmifile.com/130_operator_sg/27/09/2024/abed2c6ca6b5c95c7e5e44d5db0e0c0e.png'
WHERE name_he = '14T Pro' AND brand = 'Xiaomi' AND type = 'device';

-- Samsung Galaxy A55
UPDATE products SET image_url = 'https://image-us.samsung.com/SamsungUS/home/mobile/galaxy-a/galaxy-a55-5g/03112024/Galaxy-A55-5G_Awesome-Iceblue_Front.png'
WHERE name_he = 'Galaxy A55' AND brand = 'Samsung' AND type = 'device';

-- Apple iPhone 16 Pro Max
UPDATE products SET image_url = 'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-16-pro-finish-select-202409-6-7inch-deserttitanium?wid=500&hei=500&fmt=p-jpg'
WHERE name_he = 'iPhone 16 Pro Max' AND brand = 'Apple' AND type = 'device';


-- ===== Accessories =====

-- Samsung Buds 3 Pro
UPDATE products SET image_url = 'https://image-us.samsung.com/SamsungUS/home/mobile/audio/galaxy-buds/07102024/Galaxy-Buds3-Pro_Silver.png'
WHERE name_he = 'Buds 3 Pro' AND brand = 'Samsung' AND type = 'accessory';

-- Apple AirPods Pro 2
UPDATE products SET image_url = 'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/airpods-pro-2-hero-select-202409?wid=500&hei=500&fmt=p-jpg'
WHERE name_he = 'AirPods Pro 2' AND brand = 'Apple' AND type = 'accessory';

-- Samsung Charger 45W
UPDATE products SET image_url = 'https://image-us.samsung.com/SamsungUS/home/mobile/mobile-accessories/all-mobile-accessories/02202024/EP-T4510XWEGUS_001_Front_White.png'
WHERE brand = 'Samsung' AND type = 'accessory' AND price = 149;

-- Apple MagSafe Case
UPDATE products SET image_url = 'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/MA7R4?wid=500&hei=500&fmt=p-jpg'
WHERE brand = 'Apple' AND type = 'accessory' AND price = 199;

-- Samsung Galaxy Watch 7
UPDATE products SET image_url = 'https://image-us.samsung.com/SamsungUS/home/mobile/galaxy-watch/galaxy-watch7/07102024/Galaxy-Watch7_Green_Front.png'
WHERE name_he = 'Galaxy Watch 7' AND brand = 'Samsung' AND type = 'accessory';

-- Apple Watch SE
UPDATE products SET image_url = 'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/watch-se-702702?wid=500&hei=500&fmt=p-jpg'
WHERE name_he = 'Apple Watch SE' AND brand = 'Apple' AND type = 'accessory';


-- ===== Verify =====
SELECT name_he, brand, type, image_url FROM products ORDER BY type, brand;
