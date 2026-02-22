-- =====================================================
-- ClalMobile — Populate Product Variants & Colors
-- Migration 010: Add variant pricing + colors to existing products
-- Run in Supabase SQL Editor
-- =====================================================

-- ===== iPhone 17 Air =====
UPDATE products SET
  variants = '[
    {"storage":"128GB","price":3549,"old_price":3949,"cost":2800,"stock":8},
    {"storage":"256GB","price":3949,"old_price":4349,"cost":3100,"stock":5},
    {"storage":"512GB","price":4549,"old_price":4949,"cost":3600,"stock":3}
  ]'::jsonb,
  colors = '[
    {"hex":"#2d2d2d","name_ar":"أسود","name_he":"שחור"},
    {"hex":"#e8dfd0","name_ar":"تيتانيوم","name_he":"טיטניום"},
    {"hex":"#4a6fa5","name_ar":"أزرق","name_he":"כחול"},
    {"hex":"#96c291","name_ar":"أخضر","name_he":"ירוק"}
  ]'::jsonb,
  storage_options = ARRAY['128GB','256GB','512GB']
WHERE name_ar LIKE '%17%' AND name_ar LIKE '%اير%' AND brand = 'Apple';

-- ===== iPhone 17 =====
UPDATE products SET
  variants = '[
    {"storage":"128GB","price":3198,"old_price":3598,"cost":2500,"stock":8},
    {"storage":"256GB","price":3598,"old_price":3998,"cost":2800,"stock":6},
    {"storage":"512GB","price":4198,"old_price":4598,"cost":3300,"stock":3}
  ]'::jsonb,
  colors = '[
    {"hex":"#2d2d2d","name_ar":"أسود","name_he":"שחור"},
    {"hex":"#d8a0c8","name_ar":"وردي","name_he":"ורוד"},
    {"hex":"#5a6a7a","name_ar":"أزرق","name_he":"כחול"}
  ]'::jsonb,
  storage_options = ARRAY['128GB','256GB','512GB']
WHERE name_ar = 'iPhone 17' AND brand = 'Apple';

-- ===== iPhone 17 Pro =====
UPDATE products SET
  variants = '[
    {"storage":"256GB","price":4748,"old_price":5148,"cost":3800,"stock":6},
    {"storage":"512GB","price":5348,"old_price":5748,"cost":4300,"stock":4},
    {"storage":"1TB","price":6148,"old_price":6548,"cost":5000,"stock":2}
  ]'::jsonb,
  colors = '[
    {"hex":"#2d2d2d","name_ar":"تيتانيوم أسود","name_he":"טיטניום שחור"},
    {"hex":"#c49558","name_ar":"تيتانيوم ذهبي","name_he":"טיטניום זהב"},
    {"hex":"#f5f0e8","name_ar":"تيتانيوم طبيعي","name_he":"טיטניום טבעי"},
    {"hex":"#7a7a8a","name_ar":"تيتانيوم رمادي","name_he":"טיטניום אפור"}
  ]'::jsonb,
  storage_options = ARRAY['256GB','512GB','1TB']
WHERE name_ar LIKE '%17%' AND name_ar LIKE '%برو%' AND name_ar NOT LIKE '%ماكس%' AND name_ar NOT LIKE '%Max%' AND brand = 'Apple';

-- ===== iPhone 17 Pro Max =====
UPDATE products SET
  variants = '[
    {"storage":"256GB","price":5499,"old_price":5899,"cost":4400,"stock":5},
    {"storage":"512GB","price":6199,"old_price":6599,"cost":5000,"stock":3},
    {"storage":"1TB","price":7099,"old_price":7499,"cost":5800,"stock":2}
  ]'::jsonb,
  colors = '[
    {"hex":"#2d2d2d","name_ar":"تيتانيوم أسود","name_he":"טיטניום שחור"},
    {"hex":"#c49558","name_ar":"تيتانيوم ذهبي","name_he":"טיטניום זהב"},
    {"hex":"#f5f0e8","name_ar":"تيتانيوم طبيعي","name_he":"טיטניום טבעי"},
    {"hex":"#7a7a8a","name_ar":"تيتانيوم رمادي","name_he":"טיטניום אפור"}
  ]'::jsonb,
  storage_options = ARRAY['256GB','512GB','1TB']
WHERE (name_ar LIKE '%17%Pro%Max%' OR name_ar LIKE '%17 Pro Max%') AND brand = 'Apple';

-- ===== iPhone 16 Pro Max =====
UPDATE products SET
  variants = '[
    {"storage":"256GB","price":4999,"old_price":5499,"cost":4000,"stock":4},
    {"storage":"512GB","price":5699,"old_price":6199,"cost":4600,"stock":3},
    {"storage":"1TB","price":6499,"old_price":6999,"cost":5300,"stock":2}
  ]'::jsonb,
  colors = '[
    {"hex":"#2a2a3a","name_ar":"تيتانيوم أسود","name_he":"טיטניום שחור"},
    {"hex":"#f5f0e8","name_ar":"تيتانيوم طبيعي","name_he":"טיטניום טבעי"},
    {"hex":"#d4c5a0","name_ar":"تيتانيوم صحراوي","name_he":"טיטניום מדברי"},
    {"hex":"#e0e0e8","name_ar":"تيتانيوم أبيض","name_he":"טיטניום לבן"}
  ]'::jsonb,
  storage_options = ARRAY['256GB','512GB','1TB']
WHERE name_ar LIKE '%16%Pro%Max%' AND brand = 'Apple';

-- ===== Galaxy S25 Ultra =====
UPDATE products SET
  variants = '[
    {"storage":"256GB","price":3898,"old_price":4298,"cost":3000,"stock":6},
    {"storage":"512GB","price":4498,"old_price":4898,"cost":3500,"stock":4},
    {"storage":"1TB","price":5298,"old_price":5698,"cost":4200,"stock":2}
  ]'::jsonb,
  colors = '[
    {"hex":"#1a1a2e","name_ar":"أسود","name_he":"שחור"},
    {"hex":"#c0c0c0","name_ar":"فضي","name_he":"כסף"},
    {"hex":"#e8dfd0","name_ar":"تيتانيوم","name_he":"טיטניום"},
    {"hex":"#4a6fa5","name_ar":"أزرق","name_he":"כחול"}
  ]'::jsonb,
  storage_options = ARRAY['256GB','512GB','1TB']
WHERE name_ar LIKE '%S25%Ultra%' AND brand = 'Samsung';

-- ===== Galaxy S25 Plus =====
UPDATE products SET
  variants = '[
    {"storage":"256GB","price":3098,"old_price":3498,"cost":2500,"stock":8},
    {"storage":"512GB","price":3598,"old_price":3998,"cost":2900,"stock":4}
  ]'::jsonb,
  colors = '[
    {"hex":"#1a1a2e","name_ar":"أسود","name_he":"שחור"},
    {"hex":"#dfe5ed","name_ar":"فضي","name_he":"כסף"},
    {"hex":"#4a6fa5","name_ar":"أزرق بحري","name_he":"כחול נייבי"}
  ]'::jsonb,
  storage_options = ARRAY['256GB','512GB']
WHERE name_ar LIKE '%S25%' AND (name_ar LIKE '%بلس%' OR name_ar LIKE '%Plus%') AND brand = 'Samsung';

-- ===== Galaxy A55 =====
UPDATE products SET
  variants = '[
    {"storage":"128GB","price":1099,"old_price":1299,"cost":800,"stock":12},
    {"storage":"256GB","price":1299,"old_price":1499,"cost":950,"stock":8}
  ]'::jsonb,
  colors = '[
    {"hex":"#1a1a2e","name_ar":"أسود","name_he":"שחור"},
    {"hex":"#e8dfe0","name_ar":"بنفسجي فاتح","name_he":"סגול בהיר"},
    {"hex":"#5a9a7a","name_ar":"أخضر","name_he":"ירוק"}
  ]'::jsonb,
  storage_options = ARRAY['128GB','256GB']
WHERE name_ar LIKE '%A55%' AND brand = 'Samsung';

-- ===== Galaxy A36 5G =====
UPDATE products SET
  variants = '[
    {"storage":"128GB","price":999,"old_price":1199,"cost":700,"stock":15},
    {"storage":"256GB","price":1199,"old_price":1399,"cost":850,"stock":10}
  ]'::jsonb,
  colors = '[
    {"hex":"#1a1a2e","name_ar":"أسود","name_he":"שחור"},
    {"hex":"#d0e8f0","name_ar":"أزرق فاتح","name_he":"כחול בהיר"},
    {"hex":"#e8dfe0","name_ar":"لافندر","name_he":"לבנדר"}
  ]'::jsonb,
  storage_options = ARRAY['128GB','256GB']
WHERE name_ar LIKE '%A36%' AND brand = 'Samsung';

-- ===== Z Flip 6 =====
UPDATE products SET
  variants = '[
    {"storage":"256GB","price":1690,"old_price":3449,"cost":1400,"stock":3},
    {"storage":"512GB","price":2090,"old_price":3849,"cost":1700,"stock":2}
  ]'::jsonb,
  colors = '[
    {"hex":"#3a3a4a","name_ar":"أسود","name_he":"שחור"},
    {"hex":"#e0e0ff","name_ar":"لافندر","name_he":"לבנדר"},
    {"hex":"#f0e68c","name_ar":"أصفر","name_he":"צהוב"}
  ]'::jsonb,
  storage_options = ARRAY['256GB','512GB']
WHERE name_ar LIKE '%Flip%6%' AND brand = 'Samsung';

-- ===== Xiaomi 14T Pro =====
UPDATE products SET
  variants = '[
    {"storage":"256GB","price":2299,"old_price":2699,"cost":1700,"stock":6},
    {"storage":"512GB","price":2699,"old_price":3099,"cost":2000,"stock":3}
  ]'::jsonb,
  colors = '[
    {"hex":"#1a1a2e","name_ar":"أسود","name_he":"שחור"},
    {"hex":"#1a3a5a","name_ar":"أزرق","name_he":"כחול"},
    {"hex":"#c0c0c0","name_ar":"فضي","name_he":"כסף"}
  ]'::jsonb,
  storage_options = ARRAY['256GB','512GB']
WHERE name_ar LIKE '%14T%Pro%' AND brand = 'Xiaomi';

-- ===== Xiaomi 15 =====
UPDATE products SET
  variants = '[
    {"storage":"256GB","price":2499,"old_price":2899,"cost":1900,"stock":5},
    {"storage":"512GB","price":2899,"old_price":3299,"cost":2200,"stock":3}
  ]'::jsonb,
  colors = '[
    {"hex":"#1a1a2e","name_ar":"أسود","name_he":"שחור"},
    {"hex":"#f5f0e8","name_ar":"أبيض","name_he":"לבן"},
    {"hex":"#5a9a7a","name_ar":"أخضر","name_he":"ירוק"}
  ]'::jsonb,
  storage_options = ARRAY['256GB','512GB']
WHERE name_ar LIKE '%15%' AND name_ar NOT LIKE '%14%' AND name_ar NOT LIKE '%T%' AND brand = 'Xiaomi';

-- ===== Catch-all: Any device still without variants → add generic 2-storage variants =====
UPDATE products SET
  variants = jsonb_build_array(
    jsonb_build_object('storage', '128GB', 'price', price - 200, 'old_price', old_price, 'cost', cost, 'stock', stock),
    jsonb_build_object('storage', '256GB', 'price', price, 'old_price', old_price, 'cost', cost + 100, 'stock', stock)
  ),
  storage_options = ARRAY['128GB','256GB']
WHERE type = 'device'
  AND (variants IS NULL OR variants = '[]'::jsonb)
  AND price > 500;

-- ===== Catch-all: Any device without colors → add generic colors =====
UPDATE products SET
  colors = '[
    {"hex":"#1a1a2e","name_ar":"أسود","name_he":"שחור"},
    {"hex":"#c0c0c0","name_ar":"فضي","name_he":"כסף"}
  ]'::jsonb
WHERE type = 'device'
  AND (colors IS NULL OR colors = '[]'::jsonb);

-- ===== Sync base price to lowest variant price =====
UPDATE products SET
  price = (
    SELECT MIN((v->>'price')::numeric)
    FROM jsonb_array_elements(variants) AS v
    WHERE (v->>'price')::numeric > 0
  )
WHERE variants IS NOT NULL
  AND variants != '[]'::jsonb
  AND jsonb_array_length(variants) > 0;

-- ===== Done! =====
-- All devices now have:
-- ✅ variants (storage-specific pricing)
-- ✅ colors (with hex + bilingual names)
-- ✅ storage_options (synced from variants)
-- ✅ base price = lowest variant price
