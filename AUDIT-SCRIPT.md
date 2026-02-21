# 🔍 سكربت فحص شامل — ClalMobile

## ⚠️ قواعد صارمة:
```
🔴 لا تعدّل أي ملف
🔴 لا تمسح أي شي
🔴 لا تضيف أي شي
🔴 فقط اقرأ + افحص + أبلغ
```

---

## نفّذ الفحوصات التالية بالترتيب وأعطيني تقرير شامل:

### 1. فحص TypeScript (0 أخطاء مطلوب)
```bash
npx tsc --noEmit 2>&1
```
أبلغني: عدد الأخطاء + تفاصيل كل خطأ إن وُجد

### 2. فحص Build
```bash
npx next build 2>&1
```
أبلغني: عدد الصفحات + أي errors أو warnings

### 3. إحصائيات المشروع
```bash
# عدد الملفات
git ls-files | Measure-Object | Select-Object -ExpandProperty Count

# عدد أسطر الكود
git ls-files -- '*.ts' '*.tsx' '*.js' '*.css' '*.sql' | ForEach-Object { (Get-Content $_ | Measure-Object -Line).Lines } | Measure-Object -Sum | Select-Object -ExpandProperty Sum

# عدد الصفحات
Get-ChildItem -Recurse -Filter "page.tsx" app/ | Measure-Object | Select-Object -ExpandProperty Count

# عدد API Routes
Get-ChildItem -Recurse -Filter "route.ts" app/api/ | Measure-Object | Select-Object -ExpandProperty Count

# عدد المكونات
Get-ChildItem -Recurse -Filter "*.tsx" components/ | Measure-Object | Select-Object -ExpandProperty Count

# عدد ملفات المكتبات
Get-ChildItem -Recurse -Filter "*.ts" lib/ | Measure-Object | Select-Object -ExpandProperty Count
```

### 4. فحص الصفحات — قائمة كاملة
```bash
Get-ChildItem -Recurse -Filter "page.tsx" app/ | ForEach-Object { $_.FullName.Replace((Get-Location).Path + "\", "") }
```
أبلغني: القائمة الكاملة + أي صفحة ناقصة

### 5. فحص API Routes — قائمة كاملة
```bash
Get-ChildItem -Recurse -Filter "route.ts" app/api/ | ForEach-Object { $_.FullName.Replace((Get-Location).Path + "\", "") }
```

### 6. فحص المكونات — قائمة كاملة
```bash
Get-ChildItem -Recurse -Filter "*.tsx" components/ | ForEach-Object { $_.FullName.Replace((Get-Location).Path + "\", "") }
```

### 7. فحص أرقام وهمية / بيانات تجريبية
```bash
# أرقام هاتف وهمية
Select-String -Path "app/**/*.tsx","app/**/*.ts","components/**/*.tsx","lib/**/*.ts" -Pattern "054-XXX|972XXXXX|XXXXXXXXX|placeholder|example\.com" -Recurse

# بيانات mock
Select-String -Path "app/**/*.tsx","components/**/*.tsx" -Pattern "mock|dummy|fake|hardcoded|sample data" -Recurse
```
أبلغني: أي بيانات وهمية متبقية

### 8. فحص TODO / FIXME
```bash
Select-String -Path "app/**/*.tsx","app/**/*.ts","components/**/*.tsx","lib/**/*.ts" -Pattern "TODO|FIXME|HACK|XXX|STUB|not implemented|PLACEHOLDER" -Recurse
```
أبلغني: القائمة الكاملة + مستوى الخطورة لكل واحد

### 9. فحص الثيم والألوان
اقرأ هذه الملفات وتأكد من التناسق:
```
- styles/globals.css
- tailwind.config.ts
- app/layout.tsx
```
أبلغني: هل الثيم الغامق متناسق؟ أي ألوان شاذة؟

### 10. فحص Responsive
```bash
# ابحث عن useScreen hook
Select-String -Path "components/**/*.tsx","app/**/*.tsx" -Pattern "useScreen|isMobile|isDesktop" -Recurse | Measure-Object

# ابحث عن breakpoints
Select-String -Path "components/**/*.tsx","app/**/*.tsx" -Pattern "md:|lg:|sm:|xl:" -Recurse | Measure-Object
```
أبلغني: أي components لا تستخدم responsive patterns

### 11. فحص RTL + ثنائي اللغة
```bash
# ابحث عن dir="rtl"
Select-String -Path "app/**/*.tsx","components/**/*.tsx" -Pattern "dir=|rtl|ltr" -Recurse

# ابحث عن نصوص عربي + عبري
Select-String -Path "lib/constants.ts","lib/cities.ts" -Pattern "name_ar|name_he|ar:|he:" -Recurse | Measure-Object
```

### 12. فحص Supabase + Database
```bash
# تأكد من null guards
Select-String -Path "lib/supabase.ts" -Pattern "null|placeholder|fallback|try|catch" -Recurse

# تأكد من force-dynamic
Select-String -Path "app/**/page.tsx" -Pattern "force-dynamic" -Recurse
```
اقرأ `types/database.ts` وتأكد:
- كل الجداول الـ 22 موجودة
- الأعمدة مطابقة لـ migrations (001 + 003 + 004)
- لا يوجد `any` types غير ضرورية

### 13. فحص الأمان
```bash
# Security headers
Select-String -Path "next.config.js" -Pattern "X-Frame|X-Content|Referrer|XSS"

# RLS
Select-String -Path "supabase/migrations/*.sql" -Pattern "ENABLE ROW LEVEL SECURITY" -Recurse | Measure-Object

# Middleware auth
Select-String -Path "middleware.ts" -Pattern "admin|crm|auth|redirect"
```

### 14. فحص التكاملات
اقرأ هذه الملفات وتأكد من سلامتها:
```
- lib/integrations/hub.ts
- lib/integrations/rivhit.ts
- lib/integrations/sendgrid.ts
- lib/integrations/ycloud-wa.ts
```
أبلغني: هل كل integration يقرأ من DB أولاً ثم env fallback؟

### 15. فحص البوت
اقرأ هذه الملفات:
```
- lib/bot/engine.ts
- lib/bot/notifications.ts
- lib/bot/whatsapp.ts
- lib/bot/handoff.ts
```
أبلغني:
- هل الجلسات محفوظة بالـ DB (مش Map فقط)؟
- هل يوجد أرقام وهمية؟
- هل handoff يعمل؟

### 16. فحص اللوجو
اقرأ هذه الملفات:
```
- components/shared/Logo.tsx
- app/api/admin/upload-logo/route.ts
- lib/storage.ts
```
أبلغني: هل اللوجو يُجلب من settings ويظهر بكل الأماكن؟

### 17. فحص Deploy Config
اقرأ:
```
- wrangler.json
- package.json
- next.config.js
- .env.example
```
أبلغني:
- هل wrangler.json صحيح لـ Pages؟
- هل package.json نظيف (لا scripts زائدة)؟
- هل next.config.js مناسب لـ Cloudflare؟

### 18. فحص الملفات المحمية
اقرأ هذه الملفات وتأكد ما تم العبث بها:
```
🔒 styles/globals.css — الثيم
🔒 tailwind.config.ts — الألوان
🔒 app/layout.tsx — الـ root layout
🔒 types/database.ts — أنواع البيانات
🔒 lib/supabase.ts — اتصال قاعدة البيانات
🔒 middleware.ts — حماية الصفحات
```

---

## 📋 شكل التقرير المطلوب:

```
# تقرير الفحص الشامل — ClalMobile
التاريخ: [التاريخ]

## النتائج السريعة
| الفحص | النتيجة | ملاحظات |
|-------|---------|---------|
| TypeScript | ✅/❌ عدد الأخطاء | |
| Build | ✅/❌ عدد الصفحات | |
| أرقام وهمية | ✅/❌ | |
| TODO/FIXME | عدد | حرج/متوسط/منخفض |
| الثيم | ✅/❌ | |
| Responsive | ✅/❌ | |
| RTL | ✅/❌ | |
| Database | ✅/❌ | |
| الأمان | ✅/❌ | |
| التكاملات | ✅/❌ | |
| البوت | ✅/❌ | |
| اللوجو | ✅/❌ | |
| Deploy | ✅/❌ | |

## الإحصائيات
- ملفات: X
- أسطر كود: X
- صفحات: X
- API Routes: X
- مكونات: X
- جداول DB: X

## 🔴 مشاكل حرجة (يجب إصلاحها)
1. ...

## 🟡 مشاكل متوسطة (يُفضل إصلاحها)
1. ...

## 🟢 ملاحظات (اختياري)
1. ...

## 📝 قائمة كل الملفات
[قائمة كاملة بكل ملفات المشروع]
```

---

## ⚠️ تذكير أخير:
```
هذا فحص فقط — لا تعدّل ولا تمسح ولا تضيف أي شي!
اقرأ كل الملفات المطلوبة وأعطيني التقرير.
```
