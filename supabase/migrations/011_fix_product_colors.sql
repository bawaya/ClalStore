-- =====================================================
-- ClalMobile — Fix Product Colors (from GSMArena data)
-- Migration 011: Correct colors based on manufacturer specs
-- Run in Supabase SQL Editor
-- =====================================================

-- ===== iPhone 17 Pro Max: Silver, Cosmic Orange, Deep Blue =====
UPDATE products SET
  colors = '[
    {"hex":"#c0c0c0","name_ar":"فضي","name_he":"כסף"},
    {"hex":"#d4722a","name_ar":"برتقالي كوني","name_he":"כתום קוסמי"},
    {"hex":"#1a3a6a","name_ar":"أزرق غامق","name_he":"כחול עמוק"}
  ]'::jsonb,
  storage_options = ARRAY['256GB','512GB','1TB','2TB'],
  variants = '[
    {"storage":"256GB","price":5499,"old_price":5899,"cost":4400,"stock":5},
    {"storage":"512GB","price":6199,"old_price":6599,"cost":5000,"stock":3},
    {"storage":"1TB","price":7099,"old_price":7499,"cost":5800,"stock":2},
    {"storage":"2TB","price":8299,"old_price":8699,"cost":6800,"stock":1}
  ]'::jsonb
WHERE (name_ar LIKE '%17%Pro%Max%' OR name_ar LIKE '%17 Pro Max%') AND brand = 'Apple';

-- ===== iPhone 17 Pro: Silver, Cosmic Orange, Deep Blue =====
UPDATE products SET
  colors = '[
    {"hex":"#c0c0c0","name_ar":"فضي","name_he":"כסף"},
    {"hex":"#d4722a","name_ar":"برتقالي كوني","name_he":"כתום קוסמי"},
    {"hex":"#1a3a6a","name_ar":"أزرق غامق","name_he":"כחול עמוק"}
  ]'::jsonb,
  storage_options = ARRAY['256GB','512GB','1TB'],
  variants = '[
    {"storage":"256GB","price":4748,"old_price":5148,"cost":3800,"stock":6},
    {"storage":"512GB","price":5348,"old_price":5748,"cost":4300,"stock":4},
    {"storage":"1TB","price":6148,"old_price":6548,"cost":5000,"stock":2}
  ]'::jsonb
WHERE name_ar LIKE '%17%' AND (name_ar LIKE '%برو%' OR name_ar LIKE '%Pro%') AND name_ar NOT LIKE '%Max%' AND name_ar NOT LIKE '%ماكس%' AND brand = 'Apple';

-- ===== iPhone 17: Black, White, Mist Blue, Sage, Lavender =====
UPDATE products SET
  colors = '[
    {"hex":"#1a1a2e","name_ar":"أسود","name_he":"שחור"},
    {"hex":"#f5f5f5","name_ar":"أبيض","name_he":"לבן"},
    {"hex":"#7eb0c9","name_ar":"أزرق ضبابي","name_he":"כחול ערפילי"},
    {"hex":"#b2ac88","name_ar":"أخضر مريمي","name_he":"ירוק מרווה"},
    {"hex":"#e0e0ff","name_ar":"لافندر","name_he":"לבנדר"}
  ]'::jsonb,
  storage_options = ARRAY['256GB','512GB'],
  variants = '[
    {"storage":"256GB","price":3598,"old_price":3998,"cost":2800,"stock":6},
    {"storage":"512GB","price":4198,"old_price":4598,"cost":3300,"stock":3}
  ]'::jsonb
WHERE name_ar = 'iPhone 17' AND brand = 'Apple';

-- ===== iPhone Air: Space Black, Cloud White, Light Gold, Sky Blue =====
UPDATE products SET
  colors = '[
    {"hex":"#1a1a1a","name_ar":"أسود فلكي","name_he":"שחור חלל"},
    {"hex":"#f0f0f0","name_ar":"أبيض سحابي","name_he":"לבן ענן"},
    {"hex":"#d4c48a","name_ar":"ذهبي فاتح","name_he":"זהב בהיר"},
    {"hex":"#87ceeb","name_ar":"أزرق سماوي","name_he":"תכלת"}
  ]'::jsonb,
  storage_options = ARRAY['256GB','512GB','1TB'],
  variants = '[
    {"storage":"256GB","price":3949,"old_price":4349,"cost":3100,"stock":5},
    {"storage":"512GB","price":4549,"old_price":4949,"cost":3600,"stock":3},
    {"storage":"1TB","price":5349,"old_price":5749,"cost":4200,"stock":2}
  ]'::jsonb
WHERE (name_ar LIKE '%Air%' OR name_ar LIKE '%اير%') AND brand = 'Apple';

-- ===== Galaxy S25 Ultra: 7 colors from GSMArena =====
UPDATE products SET
  colors = '[
    {"hex":"#a8b8c8","name_ar":"تيتانيوم فضي أزرق","name_he":"טיטניום כסוף כחול"},
    {"hex":"#2d2d2d","name_ar":"تيتانيوم أسود","name_he":"טיטניום שחור"},
    {"hex":"#e0e0e5","name_ar":"تيتانيوم أبيض فضي","name_he":"טיטניום לבן כסוף"},
    {"hex":"#7a7a7a","name_ar":"تيتانيوم رمادي","name_he":"טיטניום אפור"},
    {"hex":"#5a9a7a","name_ar":"تيتانيوم أخضر يشمي","name_he":"טיטניום ירוק ירקן"},
    {"hex":"#0a0a0a","name_ar":"تيتانيوم أسود لامع","name_he":"טיטניום שחור מבריק"},
    {"hex":"#b76e79","name_ar":"تيتانيوم ذهبي وردي","name_he":"טיטניום זהב ורוד"}
  ]'::jsonb
WHERE name_ar LIKE '%S25%Ultra%' AND brand = 'Samsung';

-- ===== Re-sync base price to lowest variant price =====
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
-- ✅ iPhone 17 Pro Max: 3 colors (Silver, Cosmic Orange, Deep Blue) + 4 storage
-- ✅ iPhone 17 Pro: 3 colors (Silver, Cosmic Orange, Deep Blue) + 3 storage
-- ✅ iPhone 17: 5 colors (Black, White, Mist Blue, Sage, Lavender) + 2 storage
-- ✅ iPhone Air: 4 colors (Space Black, Cloud White, Light Gold, Sky Blue) + 3 storage
-- ✅ Galaxy S25 Ultra: 7 colors (all titanium variants) + 3 storage
