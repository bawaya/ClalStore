# Customer Retention — Technical Handoff

## 1. الهدف

هذه الوثيقة تشرح التنفيذ الحالي لميزة **Customer Retention** في `ClalMobile` من منظور تقني، بحيث تكون مرجعًا سريعًا للمطورين عند الصيانة أو التوسعة أو التحقيق في الأعطال.

الهدف من الميزة:

- إنشاء هوية ثابتة للزبون داخل المتجر عبر `customer_code`
- تمييز الزبون العائد واسترجاع بياناته بسرعة
- دعم ربط أكثر من حساب `HOT` لنفس الزبون
- توثيق الهوية داخل CRM وSales Docs والعمولات
- الحفاظ على سجل زمني واضح للتغييرات والنشاط

---

## 2. السلوك التجاري الحالي

### عند أول شراء

- يتم إنشاء أو تحديث سجل الزبون في جدول `customers`
- يتم إصدار `customer_code` خاص بالمتجر
- يتم إنشاء الطلب عبر RPC اسمها `create_order_atomic`
- تظهر هوية الزبون لاحقًا في الحساب الشخصي وCRM

### عند عودة الزبون

- يمكنه إدخال رقم الهاتف وتأكيد OTP
- يتم استرجاع بياناته من `customers`
- يتم إظهار `customer_code`
- يتم عرض حسابات `HOT` المرتبطة به داخل الحساب الشخصي

### داخل CRM

- يمكن البحث بالاسم أو الهاتف أو الإيميل أو `customer_code`
- يمكن البحث المتقدم بحقول HOT عبر `hot_search`
- يمكن فتح ملف 360 للزبون
- يمكن إضافة/تعديل/أرشفة حسابات HOT
- يمكن مراجعة Timeline موحد للأحداث المهمة

### داخل العمولات وSales Docs

- يتم ربط الهوية بالزبون عند الإمكان
- يتم تخزين Snapshots مثل:
  - `store_customer_code_snapshot`
  - `hot_mobile_id_snapshot`
- يتم تحديد `match_status` لبيان قوة الربط

---

## 3. الجداول والحقول الأساسية

### `customers`

يمثل الشخص نفسه داخل النظام.

الحقول ذات الصلة:

- `id`
- `name`
- `phone`
- `email`
- `city`
- `address`
- `customer_code`
- `auth_token`
- `auth_token_expires_at`
- `last_login`

ملاحظات:

- `customer_code` هو الهوية الداخلية المستقرة للمتجر
- لا يجب التعامل معه كحقل يدوي قابل للتعديل في العمليات اليومية

### `customer_hot_accounts`

يمثل حسابات HOT التابعة لنفس الزبون.

الحقول المهمة:

- `id`
- `customer_id`
- `hot_mobile_id`
- `hot_customer_code`
- `line_phone`
- `label`
- `status`
- `is_primary`
- `source`
- `source_order_id`
- `verified_at`
- `verified_by_id`
- `verified_by_name`
- `notes`
- `ended_at`

ملاحظات:

- نفس الزبون يمكن أن يملك أكثر من سجل HOT
- يوجد مفهوم `is_primary` للاستخدامات التشغيلية وربط العمولات

### `sales_docs`

الجدول المستخدم لتوثيق عمليات البيع في الـ PWA.

الحقول ذات الصلة:

- `customer_id`
- `order_id`
- `sale_type`
- `status`
- `source`
- `notes`

### `commission_sales`

الجدول المستخدم في العمولات.

الحقول ذات الصلة بالهوية:

- `customer_id`
- `customer_hot_account_id`
- `hot_mobile_id_snapshot`
- `store_customer_code_snapshot`
- `match_status`

### `audit_log`

السجل العام للأحداث والتغييرات.

يُستخدم في هذه الميزة لتجميع:

- عمليات HOT CRUD
- أحداث الدفع
- نشاطات أخرى تظهر في Timeline

---

## 4. المايغريشنز المرتبطة

الملفات الأساسية:

- `supabase/migrations/20260411000001_customer_identity.sql`
- `supabase/migrations/20260411000002_commission_customer_link.sql`
- `supabase/migrations/20260411000003_sales_docs_customer_fk_and_commission_backfill.sql`
- `supabase/migrations/20260412000001_commission_identity_enrichment.sql`

ملفات سابقة لازمة لسير الطلبات:

- `supabase/migrations/20260101000021_atomic_order_and_rls_fix.sql`
- `supabase/migrations/20260101000023_stock_coupon_integrity.sql`

ملاحظة تشغيلية مهمة:

- إنشاء الطلبات يعتمد على RPC اسمها `create_order_atomic`
- إذا اختفت هذه الدالة من قاعدة البيانات أو من schema cache، سيفشل `POST /api/orders` مباشرة

---

## 5. ملفات التنفيذ الأساسية

### هوية الزبون والطلبات

- `app/api/orders/route.ts`
  - إنشاء الزبون أو تحديثه
  - إصدار `customer_code`
  - استدعاء `create_order_atomic`
- `lib/validators.ts`
  - يحتوي `generateCustomerCode()`
- `lib/customer-auth.ts`
  - منطق OTP والهوية المؤقتة للزبون

### الحساب الشخصي

- `app/api/customer/profile/route.ts`
  - `GET` يرجع `{ customer, hotAccounts }`
  - `PUT` يحدّث بيانات الزبون الأساسية ويرجع نفس البنية
- `app/store/account/page.tsx`
  - عرض `customer_code`
  - عرض HOT accounts للزبون
  - عرض الطلبات والمفضلة والملف الشخصي

### CRM

- `app/api/crm/customers/route.ts`
  - بحث العملاء العام
  - دعم `hot_search`
- `app/api/crm/customers/[id]/360/route.ts`
  - يعيد بيانات 360
  - يعيد `timeline`
  - يعيد `hotAccounts`
- `app/api/crm/customers/[id]/hot-accounts/route.ts`
  - CRUD لحسابات HOT
- `app/crm/customers/page.tsx`
  - واجهة البحث العامة + HOT search
- `app/crm/customers/[id]/page.tsx`
  - صفحة ملف الزبون
  - تبويب HOT
  - تبويب Timeline

### Timeline

- `lib/crm/customer-timeline.ts`
  - يبني timeline موحدًا من عدة مصادر
- `tests/unit/customer-timeline.test.ts`
  - اختبارات الدمج والترتيب والتلخيص

### الدفع

- `app/api/payment/upay/callback/route.ts`
  - يتحقق من الدفع
  - يمرر `customer_code` إلى صفحة النجاح
- `app/store/checkout/success/page.tsx`
  - يعرض `customer_code` بعد نجاح الدفع

### Sales Docs والعمولات

- `app/api/pwa/customer-lookup/route.ts`
  - lookup بالهاتف أو `customer_code`
- `app/api/pwa/sales/route.ts`
  - إنشاء وربط Sales Docs
- `app/api/pwa/sales/[id]/route.ts`
  - تعديل وربط المستندات
- `lib/commissions/sync-orders.ts`
  - مزامنة الطلبات إلى العمولات مع هوية الزبون وHOT

### الأنواع

- `types/database.ts`
  - أنواع الجداول الأساسية
  - منها `CustomerHotAccount` و`CommissionSale`

---

## 6. الـ API الأساسية

### Store

#### `POST /api/orders`

المسؤوليات:

- التحقق من بيانات الطلب
- إنشاء أو تحديث الزبون
- تعيين `customer_code`
- إنشاء الطلب وعناصره بشكل ذري

يعيد عادة:

- `orderId`
- `total`
- `status`
- `needsPayment`
- `customerCode`
- `isNewCustomer`

#### `POST /api/auth/customer`

المسؤوليات:

- OTP login / verify
- إعادة تعريف الزبون العائد

#### `GET /api/customer/profile`

يعيد:

- `customer`
- `hotAccounts`

#### `PUT /api/customer/profile`

يحدّث:

- الاسم
- الإيميل
- المدينة
- العنوان

### CRM

#### `GET /api/crm/customers`

يدعم:

- `search`
- `page`
- `limit`
- `hot_search`

#### `GET /api/crm/customers/:id/360`

يعيد:

- `customer`
- `orders`
- `deals`
- `conversations`
- `notes`
- `hotAccounts`
- `timeline`

#### `GET /api/crm/customers/:id/hot-accounts`

يعيد:

- `hotAccounts`

#### `POST /api/crm/customers/:id/hot-accounts`

ينشئ حساب HOT جديدًا

#### `PUT /api/crm/customers/:id/hot-accounts`

يحدّث حساب HOT قائمًا

#### `DELETE /api/crm/customers/:id/hot-accounts`

يؤرشف الحساب بدل الحذف الفيزيائي

### Sales PWA

#### `GET /api/pwa/customer-lookup`

المدخلات:

- `phone`
- `code`

#### `POST /api/pwa/sales`

المسؤوليات:

- إنشاء sales doc
- محاولة ربط `customer_id` تلقائيًا

#### `PUT /api/pwa/sales/:id`

المسؤوليات:

- تعديل المستند
- دعم إعادة الربط عبر `customer_phone`

---

## 7. سير البيانات

### مسار إنشاء طلب جديد

1. المتجر يرسل الطلب إلى `POST /api/orders`
2. API تبحث عن الزبون حسب الهاتف
3. إذا كان الزبون موجودًا:
   - يتم تحديث بياناته الأساسية
   - يتم تعيين `customer_code` إذا كان ناقصًا
4. إذا لم يكن موجودًا:
   - يتم إنشاء سجل جديد
   - يتم تعيين `customer_code`
5. يتم استدعاء `create_order_atomic`
6. يتم إنشاء:
   - `orders`
   - `order_items`
   - تحديث الكوبون
   - تحديث المخزون
   - `audit_log`
7. إذا احتاج الطلب دفعة خارجية، يتم متابعة مسار الدفع

### مسار الزبون العائد

1. الزبون يدخل الهاتف
2. OTP يؤكد الهوية
3. النظام يجلب البيانات من `customers`
4. النظام يعيد `customer_code`
5. النظام يعيد `hotAccounts`

### مسار CRM 360

1. فتح ملف الزبون
2. API تجمع:
   - الطلبات
   - الملاحظات
   - المحادثات
   - الصفقات
   - حسابات HOT
   - سجلات audit
3. `buildCustomerTimeline()` يدمج الكل في timeline واحد

### مسار مزامنة العمولات

1. الطلبات المقترنة بزبون تمر على `lib/commissions/sync-orders.ts`
2. النظام يحاول:
   - جلب `customer_code`
   - جلب HOT primary account
3. تخزين snapshots داخل `commission_sales`
4. تخزين `match_status`

---

## 8. قواعد تشغيل يجب الحفاظ عليها

- لا يتم حذف HOT account فعليًا، بل يؤرشف
- `customer_code` يجب أن يبقى هوية داخلية مستقرة
- نفس الزبون يمكن أن يملك عدة HOT accounts
- يجب أن يبقى مفهوم `primary HOT account` واضحًا
- لا يجب إزالة snapshots من العمولات أو Sales Docs
- أي تطوير جديد للهوية يجب أن يحافظ على:
  - البحث بالهاتف
  - البحث بـ `customer_code`
  - البحث بحقول HOT
  - الـ timeline
  - الربط مع العمولات

---

## 9. نقاط الأعطال المعروفة

### غياب `create_order_atomic`

الأثر:

- فشل `POST /api/orders`
- عدم إنشاء الطلب أصلًا

الأعراض:

- خطأ `PGRST202`
- رسالة: `Could not find the function public.create_order_atomic ... in the schema cache`

الإجراء:

- إعادة تطبيق تعريف الدالة من:
  - `supabase/migrations/20260101000023_stock_coupon_integrity.sql`
- ثم عمل:
  - `NOTIFY pgrst, 'reload schema';`

### mismatch بين الكود والـ schema

الأثر:

- endpoint يرجع حقولًا لا تعكس النوع الفعلي
- أو RPC تستدعي بارامترات لم تعد موجودة

الإجراء:

- تحديث `types/database.ts`
- التحقق من تعريفات المايغريشن والـ route handlers معًا

### ربط HOT غير مكتمل

الأثر:

- قد تبقى بعض السجلات في العمولات أو Sales Docs بدون ربط كامل

الإجراء:

- مراجعة `match_status`
- مراجعة HOT primary account
- المراجعة اليدوية عبر CRM

---

## 10. التحقق بعد أي تعديل

الحد الأدنى المطلوب:

- `npm run build`
- اختبار مسار إنشاء الطلب
- اختبار OTP للزبون العائد
- اختبار CRM customer search
- اختبار `hot_search`
- اختبار فتح 360 + Timeline
- اختبار إضافة/تعديل/أرشفة HOT account
- اختبار customer lookup في Sales PWA
- اختبار مزامنة العمولات للحقول:
  - `customer_id`
  - `customer_hot_account_id`
  - `store_customer_code_snapshot`
  - `match_status`

اختبارات مفيدة:

- `tests/unit/customer-retention.test.ts`
- `tests/unit/customer-timeline.test.ts`

---

## 11. تحسينات مستقبلية مقترحة

- نقل توليد `customer_code` إلى DB sequence/trigger
- إضافة phone correction flow إداري موثق بدل التعديل المباشر
- إضافة verification أعمق لحسابات HOT
- إضافة dashboard تشغيلية لحالات:
  - unmatched
  - ambiguous
  - conflict

---

## 12. الملفات المرجعية

- حالة التنفيذ العامة: `CUSTOMER-RETENTION-IMPLEMENTATION.md`
- دليل الاستخدام التشغيلي: `CUSTOMER-RETENTION-STAFF-ADMIN-GUIDE.md`

