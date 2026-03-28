# 🚀 ClalMobile — دليل الإطلاق

## الخطوة 1: إعداد Supabase
```bash
# 1. أنشئ مشروع على supabase.com
# 2. شغّل السكيما:
psql -h YOUR_HOST -U postgres -d postgres < clalmobile-full-database.sql
# 3. انسخ المفاتيح من Settings > API
```

## الخطوة 2: إعداد البيئة
```bash
cp .env.example .env.local
# عبّي كل المفاتيح في .env.local
```

### المتغيرات المطلوبة (Critical):
- `NEXT_PUBLIC_SUPABASE_URL` ← من Supabase Dashboard
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` ← من Supabase Dashboard
- `SUPABASE_SERVICE_ROLE_KEY` ← من Supabase Dashboard

### المتغيرات الاختيارية (تعمل بدونها):
- `RIVHIT_API_KEY` + `RIVHIT_BUSINESS_ID` ← بوابة الدفع
- `SENDGRID_API_KEY` ← إيميلات تلقائية
- `YCLOUD_API_KEY` + `WHATSAPP_PHONE_ID` ← بوت واتساب
- `TEAM_WHATSAPP_NUMBERS` ← تنبيهات الفريق
- `WEBHOOK_VERIFY_TOKEN` ← تحقق webhook واتساب

## الخطوة 3: تشغيل محلي
```bash
npm install
npm run dev
# افتح http://localhost:3000
```

### تحقق:
- [ ] الصفحة الرئيسية تظهر
- [ ] `/store` يعرض المنتجات
- [ ] `/admin` يفتح لوحة الإدارة
- [ ] `/crm` يفتح CRM
- [ ] `/api/health` يرجع status: "healthy" أو "degraded"
- [ ] WebChat widget يظهر أسفل يسار الصفحة

## الخطوة 4: إعداد Cloudflare Pages
```bash
# 1. اربط الريبو بـ Cloudflare Workers
# 2. Build command: npx opennextjs-cloudflare build
# 3. Output: .open-next/ (auto-detected by wrangler)
# 4. أضف Environment Variables في Cloudflare Dashboard
# 5. ربط الدومين: clalmobile.com
```

## الخطوة 5: إعداد yCloud (واتساب)
```
1. سجّل في ycloud.com
2. أنشئ WhatsApp Business Account
3. احصل على API Key + Phone ID
4. عبّي YCLOUD_API_KEY و WHATSAPP_PHONE_ID في .env
5. اعدّ Webhook URL:
   https://clalmobile.com/api/webhook/whatsapp
   Verify Token: نفس WEBHOOK_VERIFY_TOKEN في .env
```

## الخطوة 6: إعداد Rivhit (دفع)
```
1. سجّل في rivhit.co.il
2. احصل على API Token + Business ID
3. عبّي RIVHIT_API_KEY و RIVHIT_BUSINESS_ID
4. اعدّ Callback URL:
   https://clalmobile.com/api/payment/callback
5. Success URL: https://clalmobile.com/store/checkout/success
6. Failure URL: https://clalmobile.com/store/checkout/failed
```

## الخطوة 7: إعداد SendGrid (إيميل)
```
1. سجّل في sendgrid.com
2. أنشئ API Key
3. Verify sender: noreply@clalmobile.com
4. عبّي SENDGRID_API_KEY و SENDGRID_FROM
```

## الخطوة 8: التحقق النهائي
- [ ] `/api/health` → كل الشيكات خضراء
- [ ] اطلب منتج تجريبي → يظهر بالـ CRM
- [ ] واتساب: أرسل "مرحبا" → البوت يرد
- [ ] واتساب: أرسل "CLM-00001" → حالة الطلب
- [ ] الإيميل يوصل بعد الطلب
- [ ] الدفع يعمل (test mode أولاً)

## الخطوة 9: SEO
- [ ] تحقق https://clalmobile.com/sitemap.xml
- [ ] تحقق https://clalmobile.com/robots.txt
- [ ] أضف الموقع لـ Google Search Console
- [ ] أضف الموقع لـ Bing Webmaster Tools

---

## 📁 هيكل المشروع النهائي

```
clalmobile/
├── app/
│   ├── page.tsx              ← Homepage (Landing)
│   ├── layout.tsx            ← Root layout + SEO
│   ├── loading.tsx           ← Global loading
│   ├── not-found.tsx         ← 404 page
│   ├── global-error.tsx      ← Error boundary
│   ├── sitemap.ts            ← Dynamic sitemap
│   ├── robots.ts             ← Robots.txt
│   ├── about/                ← من نحن
│   ├── faq/                  ← أسئلة شائعة
│   ├── legal/                ← الشروط (Israeli compliant)
│   ├── contact/              ← تواصل معنا + فورم
│   ├── store/                ← المتجر (S1)
│   ├── admin/                ← لوحة الإدارة (S2)
│   ├── crm/                  ← CRM (S3)
│   │   ├── orders/
│   │   ├── customers/
│   │   ├── pipeline/
│   │   ├── tasks/
│   │   ├── chats/           ← مراقبة البوتات
│   │   └── users/
│   └── api/
│       ├── orders/           ← Order creation
│       ├── coupons/          ← Coupon validation
│       ├── admin/            ← Admin CRUD (S2)
│       ├── crm/              ← CRM data (S3)
│       ├── webhook/whatsapp/ ← WhatsApp webhook (S4)
│       ├── chat/             ← WebChat API (S4)
│       ├── payment/          ← Rivhit payment (S6)
│       ├── email/            ← SendGrid email (S6)
│       └── health/           ← System health check
├── components/
│   ├── store/                ← Store components (S1)
│   ├── admin/                ← Admin components (S2)
│   ├── crm/                  ← CRM shell (S3)
│   ├── chat/                 ← WebChat widget (S4)
│   └── website/              ← Landing page sections (S5)
├── lib/
│   ├── supabase.ts           ← DB client (S0)
│   ├── constants.ts          ← Business constants (S0)
│   ├── validators.ts         ← Israeli validators (S0)
│   ├── hooks.ts              ← Shared hooks (S0)
│   ├── utils.ts              ← Shared utilities (S0)
│   ├── store/                ← Store queries (S1)
│   ├── admin/                ← Admin queries (S2)
│   ├── crm/                  ← CRM queries (S3)
│   ├── bot/                  ← Bot engine + WA + notifications (S4)
│   └── integrations/         ← Provider hub + Rivhit + SendGrid (S6)
├── styles/globals.css        ← Design system
├── middleware.ts              ← Auth + security + CORS
├── next.config.js             ← Production config
├── wrangler.json              ← Cloudflare Pages
├── .env.example               ← Environment template
└── supabase/                  ← DB schema + seed
```
