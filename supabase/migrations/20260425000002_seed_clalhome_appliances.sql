-- Demo catalog rows for ClalHome (appliances). Safe to re-apply: skips if any appliance already exists.
-- Run after: 20260424000001_smart_home_appliances.sql

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM products WHERE type = 'appliance' LIMIT 1) THEN
    RAISE NOTICE 'Appliance products already present — skip seed';
    RETURN;
  END IF;

  INSERT INTO products (
    type, brand, name_ar, name_he, name_en, price, old_price, cost, stock, sold,
    image_url, gallery, colors, storage_options, variants, specs,
    active, featured, description_ar, description_he,
    warranty_months, model_number, variant_kind, appliance_kind, sort_position
  ) VALUES
  (
    'appliance', 'Xiaomi',
    'Xiaomi Robot Vacuum 2', 'רוב איסוף 2', 'Xiaomi Robot Vacuum 2',
    1290, 1490, 880, 6, 0,
    NULL, ARRAY[]::TEXT[], '[]'::jsonb, ARRAY['Pro']::TEXT[],
    '[{"storage":"Pro","price":1290,"old_price":1490,"cost":880,"stock":6}]'::jsonb,
    '{}'::jsonb,
    true, true,
    'روبوت فاكوم ذكي — تنظير قوي وتخطيط غرف.', 'רובוט שואב אבק — כיסוי חכם.',
    24, 'BHR7766', 'model', 'robot_vacuum', 1
  ),
  (
    'appliance', 'Ninja',
    'Ninja Foodi 11 in 1', 'נינ׳׳ה פודי 11', 'Ninja Foodi 11 in 1',
    999, 1199, 700, 4, 0,
    NULL, ARRAY[]::TEXT[], '[]'::jsonb, ARRAY['11-in-1']::TEXT[],
    '[{"storage":"11-in-1","price":999,"old_price":1199,"cost":700,"stock":4}]'::jsonb,
    '{}'::jsonb,
    true, true,
    'طنجرة ضغط وقلاية هواء بعدة وضعيات.', 'סיר לחץ + אוויר - רב-שימושי.',
    12, 'OP500', 'model', 'ninja_pot', 2
  ),
  (
    'appliance', 'Philips',
    'مقلاة هوائية XXL 7.2L', 'מטאגן 7.2L', 'Philips Airfryer XXL',
    850, 999, 520, 8, 0,
    NULL, ARRAY[]::TEXT[], '[]'::jsonb, ARRAY['7.2L']::TEXT[],
    '[{"storage":"7.2L","price":850,"old_price":999,"cost":520,"stock":8}]'::jsonb,
    '{}'::jsonb,
    true, false,
    'تقنية Rapid Air، مناسب للعائلة.', 'Rapid Air, קיבולת גדולה.',
    24, 'HD9650', 'model', 'air_fryer', 3
  ),
  (
    'appliance', 'DeLonghi',
    'مكينة إسبرسو أوتوماتيك', 'אספרסו אוטומטי', 'DeLonghi Magnifica S',
    1890, NULL, 1200, 3, 0,
    NULL, ARRAY[]::TEXT[], '[]'::jsonb, ARRAY['S']::TEXT[],
    '[{"storage":"S","price":1890,"cost":1200,"stock":3}]'::jsonb,
    '{}'::jsonb,
    true, true,
    'طاحونة مدمجة وتحضير بضغطة زر.', 'טחינה מובנית וקלות תפעול.',
    24, 'ECAM22', 'model', 'espresso', 4
  ),
  (
    'appliance', 'Philips',
    'غلاية كهرباء 1.7L', 'קומקום 1.7L', 'Philips Kettle 1.7L',
    199, 249, 90, 20, 0,
    NULL, ARRAY[]::TEXT[], '[]'::jsonb, ARRAY['1.7L']::TEXT[],
    '[{"storage":"1.7L","price":199,"old_price":249,"cost":90,"stock":20}]'::jsonb,
    '{}'::jsonb,
    true, false,
    'سخونة سريعة مع حماية من الغليان الجاف.', 'חימום מהיר, כיבוי אוטומטי.',
    12, 'HD9350', 'model', 'kettle', 5
  ),
  (
    'appliance', 'Ninja',
    'خلاط / كوب قياس 1200W', 'בלנדר 1200W', 'Ninja Blender 1200W',
    450, 499, 260, 7, 0,
    NULL, ARRAY[]::TEXT[], '[]'::jsonb, ARRAY['1200W']::TEXT[],
    '[{"storage":"1200W","price":450,"old_price":499,"cost":260,"stock":7}]'::jsonb,
    '{}'::jsonb,
    true, false,
    'للعصائر والمكسّر — قاعدة ثابتة.', 'הרבה עוצמה לשייקים.',
    12, 'BN750', 'model', 'blender', 6
  );
END $$;
