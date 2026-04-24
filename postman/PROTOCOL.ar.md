# بروتوكول فحص واجهات ClalMobile API (مستوى إنتاجي مبسّط)

هذا المستند يحدّد **طبقات الاختبار** بأسلوب يقترب من ممارسات الجودة في المؤسسات الكبيرة: تكرار واضح، تغطية شاملة، وتمييز بين **دخان سريع** و**سيناريوهات وظيفية** و**سلامة وترخيص**.

## الأصول (Artifacts)

| الملف | الغرض |
|--------|--------|
| `ClalMobile-API-Layers.postman_collection.json` | مجموعة Postman مُولَّدة ومرتّبة في مجلدات (طبقات + مجلد Z للجرد الكامل). |
| `ClalMobile.local.postman_environment.json` | متغيّرات بيئة محليّة (يُنصح بنسخة `Staging` / `Prod` بقيم عبر CI secrets وليس داخل المستودع). |
| `scripts/postman/scan-routes.mjs` | فحص `app/**/api/**/route.ts` واستخراج `export const GET` و`export async function GET`. |
| `scripts/postman/build-collection.mjs` | توليد المجموعة — **أعد التشغيل بعد إضافة أي `route` جديد**: `npm run postman:build`. |
| `scripts/postman/sync-env.mjs` | **مزامنة** `.env.local` → `postman/ClalMobile.local.postman_environment.json` (`baseUrl`، `HEALTH_CHECK_TOKEN`، `CRON_SECRET`، وعيّنات `{{…Id}}` بقيم وهمية لتجنب `//` في المسار): `npm run postman:sync-env` |

**عدد الطلبات المُولَّدة حالياً:** يطابق _كل_ دالة `GET/POST/PUT/DELETE/PATCH` المعلَنة في 152 ملف `route` (≈240 طلب فردي). المجلد `Z-Full-Inventory-All-Endpoints` يكرر نفس الطلبات في مكان واحد لمن يفضّل Runner على قائمة كاملة.

## طبقات التنفيذ (Run Order)

1. **L0 — `0-Smoke-Public`**  
   - يتحقق بسرعة أن الخادم حي، الإعدادات العامة، CSRF، مفاتيح VAPID للدفع، ومراجعات مميّزة.  
   - **معايير نجاح:** لا يوجد `5xx`؛ استجابات JSON صالحة عند `Content-Type: application/json`.  
   - `/api/health` يتطلب `Authorization: Bearer` يطابق `HEALTH_CHECK_TOKEN` في السيرفر — عيّن `healthCheckToken` في بيئة Postman.

2. **L1 — `1-Store-Read-Model`**  
   - بحث متجر: `autocomplete`، `smart-search`، `order-status` (يُمرَّر `order` UUID حقيقي للاختبار النهائي).  
   - **عقد (Contract):** شكل `apiSuccess` حيث يُستخدَم (حقل `success` عند الاستجابة المعيارية).

3. **L2 — `2-Commerce-Messaging-Orders`**  
   - طلبات، دفع، سلة، كوبونات، محادثة، واتساب/بوتات، إشعارات، موافقات، تقييمات.  
   - **ملاحظة:** أغلب `POST` تحتاج جسم JSON حقيقي من الكود (Zod) — البدن الافتراضي `{}` يكشف فقط **عدم 5xx**؛ الاختبار الوظيفي يتطلب بيانات صالحة.

4. **L3 — `3-Customer-Auth-GDPR`**  
   - حساب العميل، تسجيل، ملف، طلبات، وGDPR (تصدير/حذف/موافقة).  
   - **يحتاج جلسة/كوكي عميل** بعد تسجيل الدخول (استورد الكوكي من المتصفح إلى Postman أو استخدم pre-request يسجّل دخولك عبر flow خاص بكم).

5. **L4 — `4-CRM`**  
   - لوحة، طلبات، صندوق وارد، عملاء، مهام، تقارير داخلية CRM.  
   - **يحتمل 401** بدون صلاحية CRM.

6. **L5 — `5-Admin`**  
   - الإدارة الكاملة (منتجات، عمولات، مبيعات، رفع…).  
   - **يحتمل 401/403** بدون جلسة أدمن.

7. **L6 — `6-Employee-SalesPWA`**  
   - موظفين، PWA مبيعات، طلبات ميدانية.

8. **L7 — `7-Integrations-Ops`**  
   - Webhooks، cron، استدعاءات الدفع، تقارير يومية/أسبوعية، بريد، دفع.  
   - `cron` و`reports?secret=` يتطلبان `cronSecret` = `CRON_SECRET` (أو كما يحددها الـ route).  
   - Webhooks تتطلب ترويسات/توقيعات الإنتاج — لا تعمل على `localhost` إلا بمحاكاة.

9. **Z — `Z-Full-Inventory-All-Endpoints`**  
   - **جرد 100%** لكل (مسار + طريقة) المُستخرج من الكود. مكرر مع L0–L7؛ استخدمه لمرة واحدة كـ "تدقيق تغطية" أو مع Newman في CI.

## اختبارات الـ Test Script (المجموعة)

كل طلب يتضمّن سكربت اختبار افتراضي:

- رفض أي استجابة `5xx`.
- إن كان `Content-Type` يتضمّن `json` — التأكد أن الجذر كائن/مصفوفة قابلة لـ `JSON.parse`.

**ليس** فرض `success: true` على كل الاستجابات (مثال: تقارير HTML، مزودو دفع، إعادات إعادة توجيه).

## فحوصات أمنية (طبقة منطقية — لا تُشغَّل بلا إذن)

| الفئة | مثال | النتيجة المتوقعة عادة |
|--------|------|------------------------|
| بدون بيانات اعتماد | `GET /api/admin/settings` | `401/403` |
| تلاعب | `PUT /api/crm/orders` بجسم فاسد | `400/422` |
| معدل الطلب | تكرار سريع على `POST` حساس | `429` عند تفعيل rate limit |
| CORS/Origin | من Postman مباشرة | غير معني؛ اختبِر من المتصفح |

سجّل نتائجها في تذكرة جودة، لا تضرب الإنتاج بلا موافقة.

**429 أثناء Newman:** الميدلوير كانت تحصر `/api` بـ 60 طلب/دقيقة. في `NODE_ENV=development` تُتخطّى فقط حزمة `api` العامة حتى تكمل طبقات Postman. حدود أخرى (تسجيل دخول، contact، إلخ) تبقى.

## Newman (CI اختياري)

```bash
npx newman run postman/ClalMobile-API-Layers.postman_collection.json -e postman/ClalMobile.local.postman_environment.json --folder "0-Smoke-Public"
```

- ابدأ بـ `--folder` على L0 فقط في الـ PR؛ الجرد Z يبقى ليلي/أسبوعي بسبب الحجم.
- فشل 401 في مجلدات محمية **ليس** فشل بناء — صنّف الاختبارات: smoke بدون بيانات اعتماد، و regression مع كوكي زمني من خطوة تسجيل.

## DoD (تعريف «جاهز» لكل إصدار)

- **L0** ناجح 100% على بيئة الهدف (مع `healthCheckToken` الصحيح).  
- لا يوجد `5xx` جديد في L1–L2 على الـ body الصحيح في حركة المنتج الحرجة (طلب/بحث/كوبون).  
- L3–L6 ناجح مع جلسة اختبار مُدارة (حسابات test فقط).  
- L7 يُنفَّذ عند تغيير تكاملات — وليس في كل commit.

## مزامنة المجموعة مع الكود

```bash
npm run postman:build
```

ثم أضف التغييرات في `postman/ClalMobile-API-Layers.postman_collection.json` في نفس الـ PR الذي يضيف `route` جديداً.

---

**الخلاصة:** الطبقات 0–7 ترتّب **الأولوية والصلاحية**؛ المجلد Z يعطي **تغطية حرفية** لكل method في كل `route` حسب الاستخراج التلقائي. للجودة الاحترافية ادمج: Vitest (وحدات) + Postman/ Newman (عقد+دخان) + Playwright (E2E واجهة) — كل طبقة تغطي شقاً مختلفاً.
