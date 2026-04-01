# تقرير تدقيق شامل — ClalMobile

**تاريخ الفحص:** 2026-03-31
**نوع الفحص:** قراءة فقط (Static Analysis)
**نطاق الفحص:** أمان، API، قاعدة بيانات، أداء، جودة كود، نشر، واجهة أمامية، سلامة بيانات، إعدادات

---

## ملخص سريع

| المستوى | العدد |
|---------|-------|
| حرج (Critical) | 12 |
| تحذير (Warning) | 19 |
| معلومات (Info) | 14 |

**أهم 3 نتائج:**
1. مسارات إدارية بدون حماية مصادقة (12 route)
2. عدم إرجاع المخزون عند إلغاء/رفض الطلبات
3. حالة سباق في استخدام الكوبونات (race condition)

---

## 1. الأمان 🔒

### [حرج] مسارات إدارية بدون requireAdmin()
- **الملفات:**
  - `app/api/admin/products/autofill/route.ts`
  - `app/api/admin/reviews/generate/route.ts`
  - `app/api/admin/integrations/test/route.ts`
- **المشكلة:** هذه المسارات لا تتحقق من صلاحية المستخدم قبل التنفيذ. أي شخص يستطيع الوصول إليها.
- **الحل:** إضافة `requireAdmin()` في بداية كل handler:
  ```typescript
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  ```

### [حرج] مسارات CRM Inbox بدون حماية صريحة
- **الملفات:**
  - `app/api/crm/inbox/[id]/assign/route.ts`
  - `app/api/crm/inbox/[id]/auto-label/route.ts`
  - `app/api/crm/inbox/[id]/notes/route.ts`
  - `app/api/crm/inbox/[id]/recommend/route.ts`
  - `app/api/crm/inbox/[id]/sentiment/route.ts`
  - `app/api/crm/inbox/[id]/status/route.ts`
  - `app/api/crm/inbox/[id]/suggest/route.ts`
  - `app/api/crm/inbox/[id]/summary/route.ts`
- **المشكلة:** 8 مسارات CRM تعتمد فقط على middleware بدون تحقق صريح في الكود. لو تم تجاوز middleware تصبح مكشوفة.
- **الحل:** إضافة `requireAdmin()` في كل handler كطبقة حماية إضافية (defense-in-depth).

### [حرج] OTP وتوكنات المصادقة مخزنة بدون تشفير
- **الملف:** `app/api/auth/customer/route.ts` (سطر 178-181، 268-300)
- **المشكلة:** أكواد OTP وتوكنات المصادقة مخزنة كنص عادي (plaintext) في قاعدة البيانات.
- **الخطر:** في حال اختراق قاعدة البيانات تنكشف كل الجلسات النشطة.
- **الحل:** تشفير (hash) قبل التخزين باستخدام bcrypt أو argon2.

### [حرج] نقطة /api/health تكشف معلومات حساسة
- **الملف:** `app/api/health/route.ts` (سطر 10-102)
- **المشكلة:** تكشف أسماء المتغيرات المفقودة، مزودي الخدمات المفعلين، وحالة التكاملات بدون مصادقة.
- **الحل:** إضافة requireAdmin() أو تقييد الوصول لعناوين IP داخلية.

### [تحذير] توكن الدفع مخزن بدون تشفير
- **الملف:** `app/api/payment/callback/route.ts` (سطر 131)
- **المشكلة:** توكنات iCredit محفوظة كنص عادي في `payment_details`.
- **الحل:** تخزين `sale_id` فقط بدون التوكن، أو تشفير التوكن قبل التخزين.

### [تحذير] لا يوجد حماية من إعادة التشغيل (Replay Attack) في Payment Callback
- **الملف:** `app/api/payment/callback/route.ts` (سطر 46-117)
- **المشكلة:** لا يوجد تتبع لـ nonce أو timestamp. يمكن إعادة إرسال callback ناجح.
- **الحل:** إنشاء جدول `payment_ipn_log` وتسجيل كل `sale_id` تم معالجته. رفض المكرر.

### [تحذير] إعفاء /api/orders من CSRF
- **الملف:** `middleware.ts` (سطر 89)
- **المشكلة:** مسار إنشاء الطلبات POST معفى من التحقق من CSRF.
- **الحل:** إزالة `/api/orders` من `CSRF_EXEMPT` والتأكد من إرسال توكن CSRF من الواجهة.

### [تحذير] عدم التحقق من انتهاء صلاحية التوكن في طلبات العميل
- **الملف:** `app/api/customer/profile/route.ts`
- **المشكلة:** التوكنات تصدر بصلاحية 7 أيام لكن لا يتم التحقق من الانتهاء عند كل طلب.
- **الحل:** إضافة فحص `auth_token_expires_at` في `authenticateCustomer()`.

### [معلومات] XSS عبر dangerouslySetInnerHTML
- **الملفات:** `app/layout.tsx` (سطر 52)، `app/store/product/[id]/page.tsx` (سطر 44)
- **الحالة:** آمن حالياً (يستخدم JSON.stringify). يجب مراقبة أي تغيير مستقبلي.

### [معلومات] CSRF مطبق بشكل صحيح
- **الملف:** `lib/csrf.ts`
- **الحالة:** ✅ مقارنة ثابتة الوقت (constant-time)، توليد عشوائي آمن، sameSite=strict.

### [معلومات] Headers أمنية مطبقة بشكل جيد
- **الملف:** `middleware.ts` (سطر 111-131)
- **الحالة:** ✅ X-Frame-Options: DENY، HSTS، CSP، Permissions-Policy كلها موجودة.

---

## 2. مسارات API 🔌

### [حرج] 12 مسار بدون حماية مصادقة
(مذكورة أعلاه في قسم الأمان — 3 admin + 8 CRM inbox + 1 integration test)

### [تحذير] مسارات بدون تحقق من المدخلات (Input Validation)
- **الملفات:**
  - `app/api/admin/products/autofill/route.ts` — POST بدون Zod schema
  - `app/api/crm/inbox/[id]/send/route.ts` — تحقق بسيط بدون schema
  - `app/api/reviews/route.ts` (PUT/DELETE) — بدون تحقق من القيم
  - `app/api/payment/route.ts` — تحقق inline بدون Zod
- **الحل:** إضافة Zod schemas واستخدام `validateBody()`.

### [تحذير] مسارات حساسة بدون Rate Limiting مخصص
| المسار | المشكلة | الحل |
|--------|---------|------|
| `/api/payment` | بدون حد مخصص | إضافة 10 req/min |
| `/api/reviews` (POST) | بدون حد | إضافة 5 req/hour |
| `/api/push/send` | بدون حد | إضافة 50 req/min |
| `/api/notifications` | بدون حد | إضافة 20 req/min |

### [تحذير] استخدام NextResponse.json() بدلاً من apiError()
- **الملف:** `lib/admin/auth.ts` (سطر 21، 37، 50، 55، 67)
- **المشكلة:** عدم اتساق في صيغة الاستجابة.
- **الحل:** استبدال بـ `apiError()`.

### [معلومات] تغطية Middleware 100%
- **الملف:** `middleware.ts` (سطر 222-234)
- **الحالة:** ✅ جميع المسارات مغطاة.
- **استثناء:** `/api/settings/public` غير مطابق صراحة — يجب إضافة `/api/settings/:path*` للمطابق.

### [معلومات] معالجة الأخطاء ممتازة
- ✅ جميع الـ 88 route فيها try/catch
- ✅ استخدام apiSuccess/apiError متسق

---

## 3. الإعدادات والتكوين ⚙️

### [حرج] 11 متغير بيئة مفقود من .env.example
- **الملف:** `.env.example`
- **المتغيرات المفقودة:**

| المتغير | مكان الاستخدام |
|---------|---------------|
| `ADMIN_PERSONAL_PHONE` | `lib/bot/admin-notify.ts` |
| `ADMIN_REPORT_PHONE` | `lib/bot/admin-notify.ts` |
| `ICREDIT_GROUP_PRIVATE_TOKEN` | `lib/integrations/rivhit.ts` |
| `ICREDIT_TEST_MODE` | `lib/integrations/rivhit.ts` |
| `OPENAI_API_KEY_PRICES` | `app/api/admin/prices/match/route.ts` |
| `PAYMENT_WEBHOOK_SECRET` | `app/api/payment/callback/route.ts` |
| `RESEND_FROM` | `lib/integrations/resend.ts` |
| `TWILIO_FROM_NUMBER` | `lib/integrations/twilio-sms.ts` |
| `UPAY_API_KEY` | `lib/integrations/upay.ts` |
| `UPAY_API_USERNAME` | `lib/integrations/upay.ts` |
| `WEBHOOK_SECRET` | `app/api/webhook/whatsapp/route.ts` |

- **الحل:** إضافة كل متغير مع وصف وقيمة مثال.

### [تحذير] متغيرات بيئة تُقرأ على مستوى الوحدة (Module Scope)
- **الملفات:**
  - `app/api/admin/ai-enhance/route.ts` (سطر 11) — `OPENAI_API_KEY`
  - `app/api/admin/products/pexels/route.ts` (سطر 12) — `PEXELS_KEY`
- **المشكلة:** في Cloudflare Workers، القراءة على مستوى الوحدة تلتقط القيمة وقت البناء فقط.
- **الحل:** نقل القراءة داخل الدوال (lazy evaluation).

### [تحذير] حزمة postgres في devDependencies بدلاً من dependencies
- **الملف:** `package.json` (سطر 54)
- **المشكلة:** تُستخدم في سكربتات runtime مثل `db:seed`.
- **الحل:** نقلها إلى dependencies.

### [معلومات] ملفات التكوين الأساسية سليمة
- ✅ `wrangler.json` — صحيح (R2, nodejs_compat, compatibility_date)
- ✅ `open-next.config.ts` — صحيح (r2IncrementalCache)
- ✅ `next.config.js` — صحيح (images.unoptimized: true)
- ✅ `tsconfig.json` — صحيح (strict mode, path aliases)
- ✅ `.gitignore` — تغطية شاملة

---

## 4. قاعدة البيانات والاستعلامات 🗄️

### [حرج] لا يوجد فحص مخزون قبل إنشاء الطلب
- **الملف:** `app/api/orders/route.ts`
- **المشكلة:** RPC `create_order_atomic` لا يتحقق من توفر المخزون قبل إنشاء الطلب.
- **الخطر:** يمكن بيع منتجات غير متوفرة (overselling).
- **الحل:** إضافة فحص `stock >= quantity` داخل RPC قبل إنشاء order_items.

### [حرج] Payment Callback ليس ضمن معاملة واحدة (Transaction)
- **الملف:** `app/api/payment/callback/route.ts` (سطر 64-150)
- **المشكلة:** عمليات متعددة منفصلة (فحص → تحقق → تحديث) بدون transaction.
- **الخطر:** حالة سباق — الطلب قد يتغير بين الفحص والتحديث.
- **الحل:** نقل كل المنطق إلى دالة RPC واحدة.

### [تحذير] استعلامات بدون حدود (Unbounded Queries)
| الملف | السطر | الجدول | الحد الحالي | الحل |
|-------|-------|--------|------------|------|
| `lib/admin/queries.ts` | 14-19 | orders, products, customers | بدون حد | إضافة `.limit()` أو استخدام COUNT |
| `lib/crm/queries.ts` | 42-45 | orders, customers | 1000 | تقليل إلى 100-200 |
| `lib/admin/queries.ts` | 110 | heroes | بدون حد | إضافة `.limit(100)` |
| `lib/admin/queries.ts` | 134 | line_plans | بدون حد | إضافة `.limit(100)` |

### [تحذير] أنماط N+1 Query
- **الملف:** `lib/bot/playbook.ts` (سطر 162-185)
  - **المشكلة:** حلقة تنفذ 3 استعلامات متتالية (name_ar, name_he, name_en).
  - **الحل:** استعلام واحد مع `.or()`.

- **الملف:** `app/api/admin/products/distribute-stock/route.ts` (سطر 53-66)
  - **المشكلة:** UPDATE منفصل لكل منتج في حلقة.
  - **الحل:** استخدام RPC أو batch update.

### [تحذير] فهارس (Indexes) مفقودة
- **الملف:** `supabase/migrations/001_initial_schema.sql`
- **الفهارس المقترحة:**

| الجدول | العمود | السبب |
|--------|--------|-------|
| `audit_log` | `created_at` | ترتيب في getAuditLog |
| `bot_messages` | `conversation_id, created_at DESC` | استعلام آخر رسالة |
| `inbox_conversations` | `last_message_at DESC` | ترتيب المحادثات |
| `orders` | `payment_status` | فحص في payment callback |
| `customers` | `last_order_at` | حساب الشريحة |

### [معلومات] استخدام select("*") غير ضروري
- **الملفات:** `app/api/push/send/route.ts` (سطر 236)، `lib/crm/queries.ts` (سطر 288)
- **الحل:** تحديد الأعمدة المطلوبة فقط.

---

## 5. سلامة البيانات 🔗

### [حرج] عدم تطابق حالات الطلب (Order Status Enum Mismatch)
- **الملفات:**
  - قاعدة البيانات (`001_initial_schema.sql:178`): `new, approved, shipped, delivered, rejected, no_reply_1/2/3`
  - API (`app/api/crm/orders/route.ts:7-10`): `pending, confirmed, processing, shipped, delivered, cancelled, returned, no_reply_1/2/3`
  - الثوابت (`lib/constants.ts:23-34`): `new, approved, processing, shipped, delivered, cancelled, rejected, no_reply_1/2/3`
- **المشكلة:** الـ API يحاول تعيين حالات (`pending, confirmed, cancelled, returned`) غير موجودة في CHECK constraint بقاعدة البيانات → فشل صامت.
- **الحل:** توحيد القيم في الثلاثة مصادر. تحديث الـ CHECK constraint ليشمل كل الحالات المستخدمة.

### [حرج] حالة سباق في استخدام الكوبونات (Race Condition)
- **الملفات:** `app/api/orders/route.ts` (سطر 152-180)، `021_atomic_order_and_rls_fix.sql` (سطر 76-81)
- **المشكلة:** التحقق من `used_count < max_uses` يتم في الكود، والزيادة في RPC — بينهما نافذة سباق.
- **سيناريو:** كوبون max_uses=1 → طلبان متزامنان → كلاهما يمر التحقق → يُستخدم مرتين.
- **الحل:** نقل التحقق والزيادة داخل RPC مع `SELECT FOR UPDATE`:
  ```sql
  UPDATE coupons SET used_count = used_count + 1
  WHERE code = UPPER(p_coupon_code)
    AND (max_uses = 0 OR used_count < max_uses)
  RETURNING used_count;
  ```

### [حرج] عدم إرجاع المخزون عند إلغاء/رفض الطلبات
- **المشكلة:** المخزون ينقص عند إنشاء الطلب (`021_atomic_order_and_rls_fix.sql`) لكن لا يرجع عند الإلغاء أو الرفض.
- **الخطر:** فقدان مخزون دائم — منتجات تظهر "نفدت" وهي متوفرة.
- **الحل:** إنشاء trigger على تغيير حالة الطلب:
  ```sql
  CREATE TRIGGER tr_order_stock_reversal
    AFTER UPDATE OF status ON orders
    FOR EACH ROW
    WHEN (NEW.status IN ('cancelled','rejected','returned') AND OLD.status != NEW.status)
    EXECUTE FUNCTION restore_order_stock();
  ```

### [تحذير] خطر تلاعب بالأسعار للعناصر بدون product_id
- **الملف:** `app/api/orders/route.ts` (سطر 145-149)
- **المشكلة:** العناصر بدون `productId` يُؤخذ سعرها من العميل مباشرة.
- **الحل:** رفض العناصر بدون product_id أو فرض حد أدنى للسعر.

### [تحذير] مشكلة حساب الصفحات (Pagination)
- **الملفات:** `app/api/admin/products/route.ts` (سطر 82)، `lib/admin/hooks.ts` (سطر 57)
- **المشكلة:** Backend يحسب `totalPages = ceil(total/limit)` والـ Frontend يحسب الصفحة بشكل مختلف → يظهر "صفحة 2 من 1".
- **الحل:** توحيد المنطق.

### [تحذير] عدم تزامن إحصائيات العملاء
- **المشكلة:** `total_orders, total_spent` تُحدَّث عبر trigger. لو فشل trigger تصبح البيانات قديمة بدون تنبيه.
- **الحل:** إنشاء endpoint مصالحة (reconciliation) دوري.

---

## 6. الأداء ⚡

### [تحذير] CRM Dashboard يحمّل 1000+ سجل
- **الملف:** `lib/crm/queries.ts` (سطر 42-45)
- **المشكلة:** تحميل 1000 طلب + 1000 عميل + 500 مهمة في طلب واحد.
- **الحل:** تقليل الحدود إلى 100-200 واستخدام استعلامات تجميع (aggregate queries).

### [تحذير] عدم وجود Cache Headers على بيانات شبه ثابتة
- **المسارات المتأثرة:** `/api/admin/heroes`، `/api/admin/settings`، `/api/admin/lines`
- **الحل:** إضافة `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`.

### [تحذير] استخدام `<img>` بدلاً من `<Image>` في صفحات المتجر
- **الملفات:**
  - `app/deals/page.tsx`
  - `app/store/account/page.tsx`
  - `app/store/compare/page.tsx`
- **الحل:** استبدال بـ `next/image` مع تحديد width/height.

### [تحذير] ترتيب بيانات على مستوى العميل بدلاً من قاعدة البيانات
- **الملف:** `lib/crm/queries.ts` (سطر 75-80)
- **المشكلة:** ترتيب 1000+ عميل بـ JavaScript بدلاً من `.order()` في Supabase.
- **الحل:** نقل الترتيب إلى الاستعلام.

### [معلومات] صفحات CRM بدون Pagination UI
- **الملفات:** `app/crm/customers/page.tsx`، `app/crm/tasks/page.tsx`
- **الحل:** إضافة واجهة تصفح مع limit/offset.

---

## 7. جودة الكود 📝

### [تحذير] 210 استخدام لنوع `any`
- **التوزيع:** 117 حالة `: any` + 93 حالة `as any` في 81 ملف
- **أسوأ الملفات:**

| الملف | عدد any | السبب |
|-------|---------|-------|
| `app/admin/products/page.tsx` | 23 | حالة النماذج، ألوان، استجابات API |
| `app/admin/prices/page.tsx` | 16 | خوارزمية مطابقة الأسعار |
| `app/api/auth/customer/route.ts` | 16 | إعدادات OTP، إدخالات DB |
| `components/admin/homepage/*` | 20 | 9 محررات أقسام |

- **الحل:** إنشاء types للتكاملات والأقسام → يقلل 50+ حالة.

### [تحذير] تكرار كود المصادقة في 55 مسار
- **المشكلة:** نفس نمط requireAdmin + try/catch مكرر في 55 route.
- **الملاحظة:** يوجد `withAdminAuth()` HOF في `lib/admin/auth.ts` لكنه مستخدم في 3 مسارات فقط.
- **الحل:** ترحيل الـ 52 مسار المتبقية لاستخدام HOF.

### [معلومات] 0 تعليقات TODO/FIXME/HACK ✅
### [معلومات] 0 كود ميت (dead code) ✅
### [معلومات] تنظيم معماري ممتاز ✅
### [معلومات] @ts-ignore = 0 حالات ✅

---

## 8. جاهزية النشر 🚀

### [تحذير] لا يوجد CI/CD Pipeline للنشر
- **الموجود:** `.github/workflows/scheduled-reports.yml` فقط (cron)
- **المفقود:** workflow للبناء والاختبار والنشر التلقائي.
- **الحل:** إنشاء `.github/workflows/deploy-to-cloudflare.yml`:
  ```yaml
  on: push (branches: [main])
  steps: checkout → install → lint → test → build:cf → deploy:cf
  ```

### [تحذير] حجم Bundle قد يتجاوز حد Workers (25MB)
- **المشكلة:** المكتبات الكبيرة (pdfjs-dist ~5.5MB, xlsx ~430KB, pdf-lib ~113KB, recharts ~350KB).
- **الحل:** التحقق من الحجم بعد `npm run build:cf`. لو تجاوز 25MB → نقل المكتبات الثقيلة لتحميل ديناميكي.

### [معلومات] لا يوجد `export const runtime = 'edge'` ✅
### [معلومات] لا يوجد استخدام Node.js APIs في كود Runtime ✅
### [معلومات] OpenNext + Wrangler مُعدّان بشكل صحيح ✅
### [معلومات] Service Worker + PWA Manifest موجودان ✅

---

## 9. الواجهة الأمامية 🎨

### [معلومات] حالات التحميل ممتازة ✅
- `app/store/loading.tsx` — skeleton للمنتجات
- `app/admin/loading.tsx` — skeleton للجداول
- `app/crm/loading.tsx` — skeleton للـ dashboard
- `app/loading.tsx` — spinner عام

### [معلومات] معالجة الأخطاء ممتازة ✅
- `error.tsx` موجود في `/`, `/store`, `/admin`, `/crm`
- كل صفحة تعالج فشل API بشكل أنيق

### [تحذير] مشاكل Accessibility بسيطة
- **الملف:** `components/store/ProductCard.tsx` (سطر 158-172)
  - أزرار Wishlist و Compare تستخدم `title` بدلاً من `aria-label`
- **الملف:** `components/admin/shared.tsx` (سطر 25)
  - زر إغلاق (✕) بدون `aria-label`
- **الحل:** إضافة `aria-label` على كل الأزرار الرمزية.

### [تحذير] تباين ألوان ضعيف للنص الخافت
- **الملف:** `styles/globals.css`
- **المشكلة:** لون `#3f3f46` على خلفية `#09090b` = نسبة تباين ~2.5:1 (أقل من WCAG AA).
- **الحل:** تفتيح اللون إلى `#5a5a61` على الأقل.

### [معلومات] SEO ممتاز ✅
- metadata ديناميكي في المنتجات والمتجر
- Schema.org JSON-LD للمنتجات
- sitemap.ts + robots.ts مُعدّان بشكل صحيح

### [معلومات] RTL ممتاز ✅
- `dir="rtl"` على مستوى HTML
- CSS logical properties مستخدمة
- حقول الهاتف/البريد `dir="ltr"` بشكل صحيح

### [معلومات] Responsive Design ممتاز ✅
- كل الصفحات تستخدم `useScreen()` hook
- breakpoints: mobile < 768 < tablet < 1024 < desktop

---

## جدول المشاكل الشامل

| # | المشكلة | الخطورة | الموقع | الأثر |
|---|---------|---------|--------|-------|
| 1 | 12 مسار بدون حماية مصادقة | حرج | admin/crm routes | وصول غير مصرح |
| 2 | OTP/توكنات بنص عادي | حرج | auth/customer/route.ts | انكشاف جلسات |
| 3 | عدم تطابق حالات الطلب | حرج | schema + API + constants | فشل صامت في تحديث الطلبات |
| 4 | حالة سباق الكوبونات | حرج | orders/route.ts + RPC | خسارة مالية |
| 5 | عدم إرجاع المخزون | حرج | missing trigger | فقدان مخزون دائم |
| 6 | لا فحص مخزون قبل الطلب | حرج | orders/route.ts | بيع منتجات غير متوفرة |
| 7 | Payment Callback بدون transaction | حرج | payment/callback | حالة سباق |
| 8 | /api/health يكشف معلومات | حرج | health/route.ts | information disclosure |
| 9 | 11 متغير بيئة مفقود من .env.example | حرج | .env.example | فشل نشر |
| 10 | متغيرات بيئة module-scope | حرج | ai-enhance + pexels | قيم قديمة في Workers |
| 11 | إعفاء CSRF لـ /api/orders | حرج | middleware.ts | CSRF attack |
| 12 | Replay Attack في الدفع | حرج | payment/callback | دفع مزدوج |
| 13 | 4 مسارات بدون input validation | تحذير | autofill, send, reviews, payment | بيانات خاطئة |
| 14 | 4 مسارات بدون rate limit مخصص | تحذير | payment, reviews, push, notifications | DoS |
| 15 | استعلامات بدون حدود (1000+ سجل) | تحذير | admin + crm queries | بطء وذاكرة |
| 16 | N+1 queries | تحذير | playbook + distribute-stock | بطء |
| 17 | فهارس DB مفقودة | تحذير | migrations | أداء ضعيف |
| 18 | لا CI/CD للنشر | تحذير | .github/workflows | نشر يدوي |
| 19 | حجم Bundle كبير محتمل | تحذير | pdfjs-dist ~5.5MB | تجاوز حد Workers |
| 20 | 210 استخدام any | تحذير | 81 ملف | أمان أنواع ضعيف |
| 21 | تكرار كود auth في 55 route | تحذير | admin/crm routes | صيانة صعبة |
| 22 | تلاعب أسعار بدون product_id | تحذير | orders/route.ts | خسارة مالية |
| 23 | إحصائيات عملاء قد تتأخر | تحذير | trigger + queries | بيانات قديمة |
| 24 | مشكلة حساب الصفحات | تحذير | hooks + products route | واجهة مربكة |
| 25 | select("*") غير ضروري | تحذير | 8+ ملفات | نقل بيانات زائد |
| 26 | بدون Cache Headers | تحذير | heroes, settings, lines | طلبات مكررة |
| 27 | `<img>` بدلاً من `<Image>` | تحذير | deals, account, compare | أداء صور ضعيف |
| 28 | ترتيب client-side | تحذير | crm/queries.ts | حمل CPU |
| 29 | Accessibility بسيطة | تحذير | ProductCard, shared | وصولية ناقصة |
| 30 | تباين ألوان ضعيف | تحذير | globals.css | قراءة صعبة |
| 31 | postgres في devDeps | تحذير | package.json | فشل scripts |

---

## خطة الإصلاح المقترحة

### فوري (هذا الأسبوع) — حرج
1. **إضافة requireAdmin()** لـ 12 مسار مكشوف *(ساعة واحدة)*
2. **توحيد حالات الطلب** في DB + API + constants *(ساعة واحدة)*
3. **إنشاء trigger لإرجاع المخزون** عند إلغاء/رفض الطلبات *(1-2 ساعة)*
4. **إصلاح حالة سباق الكوبونات** بنقل التحقق داخل RPC مع FOR UPDATE *(1-2 ساعة)*
5. **إضافة فحص مخزون** في create_order_atomic *(ساعة واحدة)*
6. **إصلاح Payment Callback** — نقل لـ RPC + إضافة idempotency *(2 ساعة)*
7. **إضافة auth لـ /api/health** *(15 دقيقة)*
8. **إزالة /api/orders من CSRF exempt** *(15 دقيقة)*
9. **إصلاح module-scope env vars** في 2 ملف *(15 دقيقة)*

### قريب (الأسبوع القادم) — تحذير
10. **تشفير OTP والتوكنات** قبل التخزين *(3-4 ساعات)*
11. **إضافة 11 متغير بيئة لـ .env.example** *(30 دقيقة)*
12. **إضافة Rate Limiting** لـ payment, reviews, push *(30 دقيقة)*
13. **إضافة Zod validation** لـ 4 مسارات *(ساعة واحدة)*
14. **تقليل حدود الاستعلامات** من 1000 إلى 100-200 *(30 دقيقة)*
15. **إضافة فهارس DB المفقودة** *(30 دقيقة)*
16. **إنشاء CI/CD workflow** *(ساعة واحدة)*

### مخطط (الشهر القادم) — تحسينات
17. **تقليل استخدام any** (إنشاء types للتكاملات والأقسام)
18. **ترحيل 52 route لـ withAdminAuth() HOF**
19. **إضافة Cache Headers** للبيانات شبه الثابتة
20. **استبدال `<img>` بـ `<Image>`** في صفحات المتجر
21. **إضافة aria-label** للأزرار الرمزية
22. **إصلاح تباين الألوان** للنص الخافت

---

## النقاط الإيجابية ✅

| المجال | الحالة |
|--------|--------|
| بنية المشروع والتنظيم | ممتاز |
| معالجة أخطاء API (try/catch + apiError) | ممتاز |
| Loading states و Error boundaries | ممتاز |
| SEO (metadata + sitemap + JSON-LD) | ممتاز |
| RTL ودعم العربية والعبرية | ممتاز |
| Responsive Design | ممتاز |
| CSRF Protection (constant-time) | ممتاز |
| Security Headers | ممتاز |
| Webhook HMAC Verification | ممتاز |
| Atomic Order Creation (RPC) | جيد |
| Rate Limiting | جيد |
| 0 TODO/FIXME/HACK | ممتاز |
| 0 dead code | ممتاز |
| 0 @ts-ignore | ممتاز |

---

*تم إنشاء هذا التقرير بالفحص الساكن فقط (قراءة كود). يُنصح بإجراء اختبارات حية (runtime testing) للتحقق من النتائج.*
