# خريطة الإشعارات — ClalMobile

> آخر تحديث: 2026-04-02
> الحالة: بعد الإصلاح الشامل — جميع التدفقات مُراجعة ومُصلحة

---

## ملخص سريع

| القناة | عدد التدفقات |
|--------|-------------|
| واتساب (نص) | 9 |
| واتساب (قالب) | 12 + 4 fallback |
| بريد إلكتروني | 6 |
| Push Notification | 1 |
| SMS (Twilio) | 1 |
| واتساب عبر Twilio Verify | 1 |

**المجموع: 29 تدفق إشعار**

---

## 1. إشعارات الطلبات الجديدة

### 1.1 واتساب للزبون — تأكيد الطلب
```
المُحفّز ← POST /api/orders (إنشاء طلب من المتجر)
القناة  ← واتساب نص → fallback قالب clal_order_confirmation
المستلم ← الزبون (رقم الهاتف من الطلب)
الدالة  ← notifyNewOrder() → sendToCustomer()
الملف   ← lib/bot/notifications.ts:31
الاستدعاء ← app/api/orders/route.ts:226
```

### 1.2 واتساب للأدمن — طلب جديد
```
المُحفّز ← POST /api/orders
القناة  ← واتساب قالب clal_new_order (4 بارامترات)
المستلم ← الأدمن (admin_phone من إعدادات التكامل)
الدالة  ← notifyAdminNewOrder()
الملف   ← lib/bot/admin-notify.ts:69
الاستدعاء ← app/api/orders/route.ts:234
```

### 1.3 واتساب للفريق — طلب جديد
```
المُحفّز ← POST /api/orders
القناة  ← واتساب قالب clal_admin_alert (1 بارامتر)
المستلم ← كل أعضاء الفريق (team_whatsapp_numbers)
الدالة  ← notifyNewOrder() → notifyTeam()
الملف   ← lib/bot/notifications.ts:41 → admin-notify.ts:48
الاستدعاء ← app/api/orders/route.ts:227
```

### 1.4 بريد إلكتروني للزبون — تأكيد الطلب
```
المُحفّز ← POST /api/orders (إذا الزبون أدخل بريد إلكتروني)
القناة  ← Email عبر Resend
المستلم ← الزبون (بريده الإلكتروني)
الدالة  ← orderConfirmationEmail() → emailProvider.send()
الملف   ← lib/email-templates.ts:68
الاستدعاء ← app/api/orders/route.ts:252-276
```

---

## 2. تحديث حالة الطلب

### 2.1 واتساب للزبون — تحديث الحالة
```
المُحفّز ← PUT /api/crm/orders (action: "status")
القناة  ← واتساب نص → fallback قالب clal_order_status
المستلم ← الزبون
الدالة  ← notifyStatusChange()
الملف   ← lib/bot/notifications.ts:55
الاستدعاء ← app/api/crm/orders/route.ts:43-48
الحالات المفعّلة ← approved, processing, shipped, delivered,
                    cancelled, returned, rejected
```

### 2.2 بريد إلكتروني للزبون — تحديث الحالة
```
المُحفّز ← PUT /api/crm/orders (action: "status" + customerEmail)
القناة  ← Email عبر Resend
المستلم ← الزبون (بريده الإلكتروني)
الدالة  ← orderStatusEmail() → emailProvider.send()
الملف   ← lib/email-templates.ts:146
الاستدعاء ← app/api/crm/orders/route.ts:50-63
الحالات المفعّلة ← approved, processing, shipped, delivered, cancelled
```

### 2.3 واتساب للزبون — تذكير عدم الرد
```
المُحفّز ← PUT /api/crm/orders (status: no_reply_1/2/3)
القناة  ← واتساب نص → fallback قالب clal_reminder
المستلم ← الزبون
الدالة  ← sendNoReplyReminder()
الملف   ← lib/bot/notifications.ts:75
الاستدعاء ← app/api/crm/orders/route.ts:66-72
ملاحظة  ← 3 مستويات تصاعدية من الإلحاح
```

---

## 3. الدفع

### 3.1 دفع iCredit (بطاقة ائتمان)
```
المُحفّز ← POST /api/payment/callback (IPN من iCredit)
القناة  ← لا إشعارات (تم حذف التكرار)
ملاحظة  ← الإشعارات تُرسل مرة واحدة فقط عند إنشاء الطلب (#1)
          payment/callback يُحدّث حالة الدفع فقط بدون إعادة إرسال
```

### 3.2 دفع UPay — واتساب للزبون
```
المُحفّز ← POST /api/payment/upay/callback (دفع ناجح)
القناة  ← واتساب نص → fallback clal_order_confirmation
المستلم ← الزبون
الدالة  ← notifyNewOrder()
الملف   ← lib/bot/notifications.ts:31
الاستدعاء ← app/api/payment/upay/callback/route.ts:183-197
```

### 3.3 دفع UPay — واتساب للأدمن
```
المُحفّز ← POST /api/payment/upay/callback (دفع ناجح)
القناة  ← واتساب قالب clal_new_order
المستلم ← الأدمن
الدالة  ← notifyAdminNewOrder()
الملف   ← lib/bot/admin-notify.ts:69
الاستدعاء ← app/api/payment/upay/callback/route.ts:199-207
```

---

## 4. نموذج التواصل

### 4.1 واتساب للأدمن — رسالة تواصل (عام)
```
المُحفّز ← POST /api/contact (نموذج التواصل العام)
القناة  ← واتساب قالب clal_contact_form (3 بارامترات)
المستلم ← الأدمن
الدالة  ← notifyAdminContactForm()
الملف   ← lib/bot/admin-notify.ts:92
الاستدعاء ← app/api/contact/route.ts:28
```

### 4.2 واتساب للأدمن — رسالة تواصل (إداري)
```
المُحفّز ← POST /api/admin/contact-notify (يتطلب صلاحيات أدمن)
القناة  ← واتساب قالب clal_contact_form
المستلم ← الأدمن
الدالة  ← notifyAdminContactForm()
الملف   ← lib/bot/admin-notify.ts:92
الاستدعاء ← app/api/admin/contact-notify/route.ts:19
```

### 4.3 بريد إلكتروني — رسالة تواصل (fire-and-forget)
```
المُحفّز ← صفحة /contact (إطلاق غير معطّل بالتوازي)
القناة  ← Email عبر POST /api/email
المستلم ← المتجر (info@clalmobile.com)
الاستدعاء ← app/contact/page.tsx:38-56
```

---

## 5. البوت والمحادثات

### 5.1 واتساب — رد البوت الآلي
```
المُحفّز ← POST /api/webhook/whatsapp (رسالة واردة من زبون)
القناة  ← واتساب نص/أزرار (ضمن نافذة 24 ساعة)
المستلم ← الزبون المُرسل
الدالة  ← handleWhatsAppMessage() → processMessage() → sendBotResponse()
الملف   ← lib/bot/engine.ts:182 → lib/bot/whatsapp.ts:331
الاستدعاء ← app/api/webhook/whatsapp/route.ts:188-203
```

### 5.2 واتساب للأدمن — رسالة جديدة
```
المُحفّز ← POST /api/webhook/whatsapp (رسالة واردة)
القناة  ← واتساب قالب clal_new_msg (3 بارامترات)
المستلم ← الأدمن
الدالة  ← notifyAdminNewMessage()
الملف   ← lib/bot/admin-notify.ts:154
الاستدعاء ← app/api/webhook/whatsapp/route.ts:223-229
حد السرعة ← إشعار واحد كل 10 دقائق لكل رقم هاتف
```

### 5.3 واتساب للأدمن — زبون غاضب
```
المُحفّز ← كشف مشاعر سلبية أثناء معالجة البوت
القناة  ← واتساب قالب clal_angry_cust (3 بارامترات)
المستلم ← الأدمن
الدالة  ← notifyAdminAngryCustomer()
الملف   ← lib/bot/admin-notify.ts:131
الاستدعاء ← lib/bot/engine.ts:245, 296
```

### 5.4 واتساب للأدمن — طلب تحدث مع محمد
```
المُحفّز ← الزبون يُكمل تدفق "تحدث مع محمد" (اسم + هاتف + رسالة)
القناة  ← واتساب قالب clal_handoff (3 بارامترات)
المستلم ← الأدمن
الدالة  ← notifyAdminMuhammadHandoff()
الملف   ← lib/bot/admin-notify.ts:113
الاستدعاء ← lib/bot/engine.ts:992
```

### 5.5 واتساب للأدمن + الفريق — تصعيد
```
المُحفّز ← تصعيد البوت (شكوى / طلب بشري / حد الرسائل)
القناة  ← واتساب قالب clal_admin_alert
المستلم ← الأدمن + كل أفراد الفريق
الدالة  ← createHandoff() → notifyAdmin() + notifyTeam()
الملف   ← lib/bot/handoff.ts:68-81
```

### 5.6 CRM Inbox — الوكيل يُرسل رسالة
```
المُحفّز ← POST /api/crm/inbox/[id]/send (أدمن يرد من CRM)
القناة  ← واتساب نص / صورة / مستند / قالب
المستلم ← الزبون (حسب المحادثة)
الدالة  ← sendWhatsAppText() / sendWhatsAppImage() / sendWhatsAppDocument() / sendWhatsAppTemplate()
الملف   ← lib/bot/whatsapp.ts
الاستدعاء ← app/api/crm/inbox/[id]/send/route.ts:62-78
تحققات  ← فحص حظر الزبون + نافذة 24 ساعة للرسائل غير القالبية
```

---

## 6. المصادقة (OTP)

### 6.1 OTP عبر SMS — Twilio Verify
```
المُحفّز ← POST /api/auth/customer (action: "send_otp", channel: "sms")
القناة  ← SMS عبر Twilio Verify API
المستلم ← الزبون
الدالة  ← sendViaTwilioVerify()
الملف   ← app/api/auth/customer/route.ts:62
الاستدعاء ← route.ts:174
حد السرعة ← OTP واحد كل 60 ثانية لكل رقم
```

### 6.2 OTP عبر واتساب — Twilio Verify
```
المُحفّز ← POST /api/auth/customer (action: "send_otp", channel: "whatsapp")
القناة  ← واتساب عبر Twilio Verify (قناة whatsapp)
المستلم ← الزبون
الدالة  ← sendViaTwilioVerify() مع channel: "whatsapp"
الملف   ← app/api/auth/customer/route.ts:62
الاستدعاء ← route.ts:187
```

### 6.3 OTP عبر واتساب — yCloud (fallback)
```
المُحفّز ← فشل Twilio Verify → يستخدم yCloud مباشرة
القناة  ← واتساب نص → fallback قالب clal_otp_code
المستلم ← الزبون
الدالة  ← sendViaWhatsApp()
الملف   ← app/api/auth/customer/route.ts:116
الاستدعاء ← route.ts:183, 196
```

---

## 7. التقارير الدورية

### 7.1 تقرير يومي
```
المُحفّز ← POST /api/cron/reports (type: "daily")
القناة  ← واتساب قالب clal_daily_report (2 بارامتر)
المستلم ← الأدمن
الدالة  ← sendDailyReportLink()
الملف   ← lib/bot/admin-notify.ts:186
الاستدعاء ← app/api/cron/reports/route.ts:31, 52
```

### 7.2 تقرير أسبوعي
```
المُحفّز ← POST /api/cron/reports (type: "weekly")
القناة  ← واتساب قالب clal_weekly_report (2 بارامتر)
المستلم ← الأدمن
الدالة  ← sendWeeklyReportLink()
الملف   ← lib/bot/admin-notify.ts:196
الاستدعاء ← app/api/cron/reports/route.ts:27, 50
```

---

## 8. Push Notifications

### 8.1 إشعار Push — بث عام
```
المُحفّز ← POST /api/push/send (أدمن يرسل إشعار من لوحة التحكم)
القناة  ← Web Push (VAPID + RFC 8291 تشفير)
المستلم ← كل المشتركين (جدول push_subscriptions)
الدالة  ← sendPushNotification()
الملف   ← app/api/push/send/route.ts:95
الاستدعاء ← route.ts:257-277
يتطلب  ← صلاحيات أدمن + CSRF
```

---

## 9. إشعارات إدارية أخرى

### 9.1 بريد إلكتروني — تأكيد طلب (يدوي)
```
المُحفّز ← POST /api/email (type: "order_confirm")
القناة  ← Email عبر Resend
المستلم ← الزبون
الاستدعاء ← app/api/email/route.ts:32-36
يتطلب  ← صلاحيات أدمن
```

### 9.2 بريد إلكتروني — تحديث حالة (يدوي)
```
المُحفّز ← POST /api/email (type: "status_update")
القناة  ← Email عبر Resend
المستلم ← الزبون
الاستدعاء ← app/api/email/route.ts:37-40
يتطلب  ← صلاحيات أدمن
```

### 9.3 بريد + واتساب — بيانات مستخدم أدمن جديد
```
المُحفّز ← POST /api/crm/users (إنشاء مستخدم أدمن جديد)
القناة  ← Email + واتساب نص
المستلم ← المستخدم الجديد
الدالة  ← emailProvider.send() + sendWhatsAppText()
الاستدعاء ← app/api/crm/users/route.ts:139-178
```

### 9.4 واتساب — اختبار التكامل (تشخيص)
```
المُحفّز ← POST /api/admin/whatsapp-test
القناة  ← واتساب نص أو قالب
المستلم ← أي رقم (اختبار)
الاستدعاء ← app/api/admin/whatsapp-test/route.ts:35-40
يتطلب  ← صلاحيات أدمن
```

---

## قوالب واتساب المطلوبة في yCloud

| # | اسم القالب | عدد البارامترات | الاستخدام |
|---|------------|----------------|-----------|
| 1 | `clal_admin_alert` | 1 | تنبيه عام للأدمن/الفريق |
| 2 | `clal_new_order` | 4 | طلب جديد → أدمن |
| 3 | `clal_contact_form` | 3 | رسالة تواصل → أدمن |
| 4 | `clal_handoff` | 3 | طلب تحدث مع محمد → أدمن |
| 5 | `clal_angry_cust` | 3 | زبون غاضب → أدمن |
| 6 | `clal_new_msg` | 3 | رسالة واردة → أدمن |
| 7 | `clal_daily_report` | 2 | تقرير يومي → أدمن |
| 8 | `clal_weekly_report` | 2 | تقرير أسبوعي → أدمن |
| 9 | `clal_order_confirmation` | 2 | تأكيد طلب → زبون (fallback) |
| 10 | `clal_order_status` | 2 | تحديث حالة → زبون (fallback) |
| 11 | `clal_reminder` | 1 | تذكير عدم رد → زبون (fallback) |
| 12 | `clal_otp_code` | 1 | رمز OTP → زبون (fallback) |
| 13 | `clal_order_done` | 3 | ~~طلب مكتمل~~ — **محجوز غير مُستخدم** |

---

## خريطة الملفات الرئيسية

```
lib/bot/
├── notifications.ts    → إشعارات الزبون (طلب جديد, تحديث حالة, تذكير)
├── admin-notify.ts     → إشعارات الأدمن/الفريق (9 دوال مُصدّرة)
├── whatsapp.ts         → واجهة yCloud (نص, أزرار, قالب, صورة, مستند)
├── engine.ts           → محرك البوت (زبون غاضب + handoff)
└── handoff.ts          → تصعيد + handoff → أدمن + فريق

lib/integrations/
├── hub.ts              → مُزوّد البريد (Resend أولوية, SendGrid بديل)
├── ycloud-templates.ts → تعريف القوالب (13 قالب للتوفير التلقائي)
└── resend.ts           → Resend API wrapper

lib/
├── email-templates.ts  → قوالب HTML للبريد (تأكيد طلب, تحديث حالة)
├── csrf-client.ts      → CSRF headers للـ fetch calls
└── webhook-verify.ts   → التحقق من التوقيعات (yCloud + Twilio)

app/api/
├── orders/route.ts           → إنشاء طلب → 4 إشعارات
├── crm/orders/route.ts       → تحديث حالة → 3 إشعارات
├── payment/callback/route.ts → IPN iCredit → 0 إشعارات (حُذف التكرار)
├── payment/upay/callback/    → UPay → 2 إشعارات
├── webhook/whatsapp/route.ts → واتساب وارد → بوت + أدمن
├── contact/route.ts          → نموذج تواصل → أدمن
├── auth/customer/route.ts    → OTP → SMS/واتساب
├── push/send/route.ts        → Push → كل المشتركين
├── email/route.ts            → بريد يدوي
├── cron/reports/route.ts     → تقارير → أدمن
├── crm/inbox/[id]/send/      → CRM → زبون
└── crm/users/route.ts        → مستخدم جديد → بريد + واتساب
```

---

## رسم التدفق

```
┌─────────────────────────────────────────────────────────┐
│                     الزبون يطلب                         │
│                   POST /api/orders                       │
└────────────────────────┬────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┬────────────────┐
         ▼               ▼               ▼                ▼
   📱 واتساب        📱 واتساب      📱 واتساب         📧 بريد
    للزبون          للأدمن          للفريق           للزبون
  (نص/قالب)     (clal_new_order) (clal_admin_alert)  (Resend)
         │               │               │                │
         └───────────────┴───────────────┴────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    ▼                           ▼
             دفع بطاقة؟                    جهاز (بنك)؟
           iCredit IPN                     لا دفع فوري
            يُحدّث DB                    الفريق يتواصل
           (بدون إشعار)
```

```
┌─────────────────────────────────────────────────────────┐
│               الأدمن يُحدّث الحالة                      │
│             PUT /api/crm/orders                          │
└────────────────────────┬────────────────────────────────┘
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
        📱 واتساب   📧 بريد    📱 واتساب
         للزبون     للزبون      تذكير
       (نص/قالب)   (Resend)   (no_reply)
```

```
┌─────────────────────────────────────────────────────────┐
│               رسالة واتساب واردة                         │
│          POST /api/webhook/whatsapp                      │
└────────────────────────┬────────────────────────────────┘
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
         🤖 بوت    📱 أدمن     ⚠️ أدمن
          يرد      (clal_new_msg)  (إذا غاضب)
        للزبون    (rate: 10 دقائق) (clal_angry_cust)
```

---

## الإصلاحات المُطبّقة (2026-04-02)

| # | المشكلة | الإصلاح |
|---|---------|---------|
| 1 | نموذج التواصل يرسل لـ admin-only endpoint | تحويل إلى `/api/contact` العام + CSRF |
| 2 | 9 أسماء قوالب لا تتطابق | توحيد الأسماء في ycloud-templates.ts |
| 3 | 4 فقط من 8 حالات تُرسل واتساب | إضافة processing, cancelled, returned |
| 4 | توقيع Twilio مكسور (HMAC خاطئ) | تنفيذ verifyTwilioSignature() الصحيح |
| 5 | HKDF مقلوب + salt غير متطابق في Push | إصلاح ترتيب HMAC + توحيد salt |
| 6 | إشعارات مكررة عند دفع iCredit | حذف الإشعارات من payment/callback |
| 7 | كل الدوال ترجع void (أخطاء صامتة) | إرجاع `{ sent: boolean }` |
| 8 | مزوّدو بريد وهميون + اختبار خاطئ | حذف Mailgun/SES/SMTP + اختبار Resend |
| 9 | كود ميت (notify.ts + NotificationBell) | حذف الملفات والدوال غير المُستخدمة |
| 10 | حالة "confirmed" غير موجودة في Email | تغيير إلى "approved" |
