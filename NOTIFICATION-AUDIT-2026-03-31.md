# تقرير تدقيق الإشعارات — ClalMobile

التاريخ: 2026-03-31

## الملخص التنفيذي

منظومة الإشعارات في المشروع كبيرة ومقسومة إلى واتساب، SMS، بريد إلكتروني، Push، وإشعارات داخلية داخل النظام. البنية العامة موجودة، لكن هناك عدة أعطال جذرية تمنع بعض المسارات من العمل end-to-end رغم وجود الكود.

أهم نتيجة من التدقيق:

- لا توجد قناة أقدر أوصفها بأنها تعمل runtime بشكل مؤكّد ضمن هذا الفحص، لأن التدقيق اعتمد على قراءة الكود والفحص الساكن فقط، بدون مفاتيح تشغيل حيّة أو إرسال خارجي فعلي.
- يوجد عدد من المسارات المصنفة على أنها implemented but unverified.
- يوجد عدد من المسارات broken أو partially wired بسبب عدم تطابق بين الواجهة والـ routes أو بين أسماء القوالب أو بين الحالات business logic والـ notification logic.

## النتائج السريعة

| المجال | الحالة | الملاحظة |
|-------|---------|---------|
| WhatsApp inbound + bot | implemented but unverified | منطق webhook + bot + inbox موجود ومتكامل نسبيًا |
| WhatsApp admin alerts | partially wired | mismatch بين قوالب الإدارة والقوالب المطلوبة وقت الإرسال |
| WhatsApp customer notifications | partially wired | حالات الطلب لا تتطابق مع الحالات التي يرسل لها helper واتساب |
| OTP عبر SMS/WhatsApp | implemented but unverified | Twilio Verify + fallback واتساب موجودان، لكن callback التوقيع الخاص بـ Twilio غير موثوق |
| Email | implemented but unverified | hub + templates موجودان، لكن بعض التدفقات العامة مكسورة من الواجهة |
| Push | partially wired / likely broken | subscription frontend + send backend موجودان لكن التنفيذ فيه مشاكل واضحة |
| Internal notifications | dead or unused | الجرس والـ store والـ API موجودة، لكن لا يوجد wiring فعلي واضح |

## جدول القنوات

| القناة | المرسل أو الخدمة | لمن ترسل | متى ترسل | الحالة | الدليل |
|---|---|---|---|---|---|
| واتساب وارد + بوت + CRM Inbox | yCloud + bot engine | العميل، CRM Inbox، الأدمن | عند وصول رسالة واتساب واردة | implemented but unverified | app/api/webhook/whatsapp/route.ts, lib/bot/whatsapp.ts |
| واتساب إداري | admin-notify + templates | الأدمن، الفريق | طلب جديد، تواصل، handoff، angry customer، تقارير | partially wired | lib/bot/admin-notify.ts, app/api/contact/route.ts, app/api/cron/reports/route.ts |
| واتساب للعميل | notifications + CRM inbox send | الزبون | طلب جديد، تغيّر حالة، no reply، رد موظف من الـ Inbox | partially wired | lib/bot/notifications.ts, app/api/crm/orders/route.ts, app/api/crm/inbox/[id]/send/route.ts |
| OTP عبر SMS وواتساب | Twilio Verify + WhatsApp fallback | عميل المتجر | send_otp و verify_otp | implemented but unverified | app/api/auth/customer/route.ts, lib/integrations/twilio-sms.ts |
| البريد الإلكتروني | Resend أو SendGrid عبر hub | العميل أو بريد المتجر | تأكيد طلب، تحديث حالة، مراسلة عامة | implemented but unverified | app/api/orders/route.ts, app/api/crm/orders/route.ts, app/api/email/route.ts |
| Push للمتصفح | VAPID + Service Worker | مشتركو المتصفح | بعد الاشتراك، ثم إرسال إداري | partially wired / likely broken | components/shared/PWAInstallPrompt.tsx, app/api/push/send/route.ts, public/sw.js |
| إشعارات داخلية داخل النظام | notifications table + Zustand + Bell | طاقم الإدارة وCRM | polling وقراءة من API | dead or unused | lib/notify.ts, app/api/notifications/route.ts, components/shared/NotificationBell.tsx |

## تفصيل كل تدفق

### 1. واتساب الوارد + البوت + CRM Inbox

المسار يبدأ من webhook في app/api/webhook/whatsapp/route.ts، ثم parsing في lib/bot/whatsapp.ts، ثم bot response، ثم حفظ inbound وoutbound في inbox tables، ثم إرسال تنبيه إداري عند الرسائل الجديدة.

النقاط المهمة:

- التحقق من signature موجود.
- يتم حفظ المحادثة والرسائل في inbox_conversations و inbox_messages.
- يتم تمرير الرسالة إلى bot engine وإرجاع الرد.
- يتم إرسال notifyAdminNewMessage بعد معالجة الرسالة.

الحكم: implemented but unverified.

### 2. OTP للعميل عبر SMS أو واتساب

المسار موجود في app/api/auth/customer/route.ts. عند send_otp:

- يفضّل Twilio Verify أولًا.
- إذا فشل SMS، ينتقل إلى fallback واتساب.
- إذا اختار المستخدم واتساب، يحاول Twilio Verify بقناة whatsapp أولًا.
- إذا فشل Verify، ينتقل إلى direct WhatsApp message أو template.
- يتم حفظ OTP أو marker بقيمة VERIFY في customer_otps.

عند verify_otp:

- يتم تطبيق rate limit على عدد المحاولات.
- يتم حذف OTPs المنتهية.
- إذا كان آخر OTP هو VERIFY يتم الرجوع إلى Twilio Verify API.
- وإلا يتم التحقق من الرمز المخزن مباشرة في قاعدة البيانات.

الحكم: implemented but unverified.

### 3. إشعارات الطلبات للعميل وللإدارة

هناك أكثر من نقطة ترسل new-order notifications:

- app/api/orders/route.ts عند إنشاء الطلب.
- app/api/payment/callback/route.ts عند callback الدفع.
- app/api/payment/upay/callback/route.ts عند callback UPay.

المسار الحالي يرسل:

- WhatsApp للعميل عبر lib/bot/notifications.ts.
- WhatsApp إداري عبر lib/bot/admin-notify.ts.
- بريد إلكتروني للعميل إذا وُجد email.

المشكلة الأساسية هنا أن التدفق يتكرر في أكثر من حدث، مما يخلق احتمالية duplicate notifications لنفس الطلب.

الحكم: working but logically wrong.

### 4. إشعارات تغيّر حالة الطلب

المسار موجود في app/api/crm/orders/route.ts:

- يرسل WhatsApp عبر notifyStatusChange.
- يرسل Email لبعض الحالات.
- يرسل no-reply reminder للحالات no_reply_1/no_reply_2/no_reply_3.

لكن helper واتساب في lib/bot/notifications.ts يرسل فقط للحالات:

- approved
- shipped
- delivered
- rejected

بينما الـ CRM يعتمد حالات مختلفة مثل confirmed و processing و cancelled. هذا يعني أن البريد قد يخرج لبعض الحالات بينما واتساب لا يخرج لنفس الحدث.

الحكم: partially wired.

### 5. التواصل العام

يوجد route عام صالح نسبيًا في app/api/contact/route.ts، لكن صفحات الواجهة العامة لا تستخدمه.

الصفحات التالية ترسل إلى route إداري محمي:

- app/contact/page.tsx
- app/store/contact/page.tsx

وكلاهما يستخدم /api/admin/contact-notify، بينما هذا route يتطلب requireAdmin. هذا يعني أن المستخدم العام غالبًا لن يستطيع إرسال الإشعار أصلًا.

إضافة إلى ذلك، app/contact/page.tsx يرسل أيضًا إلى /api/email بدون csrfHeaders، بينما middleware يفرض CSRF على هذه الطلبات.

الحكم: broken فعليًا من الواجهة الحالية.

### 6. Push Notifications

البنية الموجودة:

- frontend registration + subscribe في components/shared/PWAInstallPrompt.tsx
- VAPID public key route في app/api/push/vapid/route.ts
- subscribe/unsubscribe في app/api/push/subscribe/route.ts
- send route في app/api/push/send/route.ts
- service worker في public/sw.js
- admin UI في app/admin/push/page.tsx

المشاكل:

- admin UI يرسل POST إلى /api/push/send بدون CSRF.
- subscription frontend يمرر applicationServerKey مباشرة كسلسلة بدل تحويلها إلى Uint8Array.
- app/api/push/send/route.ts يستخدم تنفيذ تشفير Web Push يدوي وعالي الخطورة.
- ESLint أعطى خطأ React hooks في PWAInstallPrompt.

الحكم: partially wired / likely broken.

### 7. الإشعارات الداخلية داخل النظام

الموجود:

- helpers في lib/notify.ts
- Zustand store في lib/notifications.ts
- API في app/api/notifications/route.ts
- UI component في components/shared/NotificationBell.tsx

لكن لم يظهر wiring فعلي لهذه الميزة:

- NotificationBell لا يبدو مركبًا في shell واضح.
- helpers مثل notifyTaskAssigned و notifyAlert و notifyNewMessage لم تظهر لها استدعاءات حقيقية ذات أثر تشغيلي واضح.

الحكم: dead or unused.

## شو شغال وشو مش شغال

### implemented but unverified

- webhook واتساب + bot reply + الحفظ في CRM Inbox في app/api/webhook/whatsapp/route.ts.
- إرسال WhatsApp من CRM Inbox في app/api/crm/inbox/[id]/send/route.ts.
- OTP عبر Twilio Verify مع fallback واتساب في app/api/auth/customer/route.ts.
- بريد تأكيد الطلب وتحديث الحالة في app/api/orders/route.ts و app/api/crm/orders/route.ts.

### broken أو likely broken

- public contact notifications من الصفحات الحالية في app/contact/page.tsx و app/store/contact/page.tsx.
- Twilio webhook signature validation في app/api/webhook/twilio/route.ts مع lib/webhook-verify.ts.
- زر اختبار التكاملات في الإعدادات: الصفحة لا ترسل CSRF، والـ route نفسه لا يفرض requireAdmin.
- WhatsApp template provisioning بسبب mismatch بين lib/integrations/ycloud-templates.ts و lib/bot/admin-notify.ts.
- زر إرسال Push من لوحة الإدارة في app/admin/push/page.tsx.
- WhatsApp status notifications لبعض حالات الطلب.

### working but logically wrong

- new-order notifications مكررة بين إنشاء الطلب وpayment callbacks.
- reports_phone يقرأ من config لكن لا يستخدم فعليًا في مسار التقارير داخل lib/bot/admin-notify.ts.

### dead or unused

- النظام الداخلي للإشعارات في lib/notify.ts و components/shared/NotificationBell.tsx.
- notifyAdminOrderCompleted في lib/bot/admin-notify.ts.
- setting completed_orders_email في app/admin/settings/page.tsx.
- route التشخيص app/api/admin/whatsapp-test/route.ts يبدو غير موصول بواجهة.

## المشاكل الجذرية

### 1. عدم تطابق الواجهة مع الـ routes

- الواجهة العامة تستدعي routes إدارية.
- بعض واجهات admin ترسل POSTs بدون CSRF.
- middleware يفرض CSRF على هذه المسارات، وبالتالي السلوك الفعلي ينكسر رغم وجود route صحيح.

### 2. عدم تطابق configuration contract

قائمة المزوّدات المعروضة للمستخدم في lib/constants.ts أوسع من التنفيذ الفعلي في lib/integrations/hub.ts.

أمثلة:

- واجهة Email تعرض Resend و SendGrid و Mailgun و Amazon SES و SMTP، بينما الـ hub يفعل فقط Resend أو SendGrid.
- واجهة WhatsApp تعرض yCloud و Meta API و Twilio، بينما التنفيذ الفعلي في الـ hub يفعل فقط YCloudWhatsAppProvider.

### 3. عدم تطابق template contract

أداة إدارة قوالب WhatsApp تنشئ أسماء قوالب تختلف عن الأسماء المطلوبة وقت الإرسال الفعلي. هذا يخلق حالة يكون فيها النظام الإداري مقتنعًا أن القوالب provisioned، بينما runtime ما يزال يطلب أسماء أخرى.

### 4. انجراف بين business events وnotification events

- الطلب يخطر عند create ثم مرة ثانية عند callback الدفع.
- حالات الطلب في CRM لا تطابق الحالات التي يعتمدها helper واتساب.

### 5. silent failures

بعض helpers تسجل الخطأ وتكمل بدون إرجاع فشل واضح للـ caller، خصوصًا:

- lib/bot/admin-notify.ts
- lib/bot/notifications.ts

هذا يجعل route قد يرجع success رغم فشل الإرسال فعليًا.

### 6. ميزات نصف مشحونة

- internal notifications
- completed-orders email
- whatsapp-test
- بعض أجزاء Push

## الأدلة التقنية الأساسية

### مشكلة CSRF والـ contact flow

- middleware.ts: PUBLIC_API و CSRF_EXEMPT و validateCsrf
- app/contact/page.tsx: استدعاء /api/admin/contact-notify و /api/email
- app/store/contact/page.tsx: استدعاء /api/admin/contact-notify
- app/api/admin/contact-notify/route.ts: يستخدم requireAdmin

### مشكلة Twilio webhook verification

- app/api/webhook/twilio/route.ts
- lib/webhook-verify.ts

المقارنة الحالية تعتمد raw body + HMAC SHA1 كسلسلة hex. هذا لا يطابق آلية Twilio المعتمدة على URL + params وتوقيع base64.

### مشكلة WhatsApp template mismatch

- app/api/admin/whatsapp-templates/route.ts
- lib/integrations/ycloud-templates.ts
- lib/bot/admin-notify.ts

### مشكلة Push

- components/shared/PWAInstallPrompt.tsx
- app/admin/push/page.tsx
- app/api/push/send/route.ts
- public/sw.js

## خطوات الإصلاح المقترحة

1. إصلاح public contact flow أولًا

- تحويل الصفحتين العامتين لاستخدام app/api/contact/route.ts بدل route الإداري.
- إضافة csrfHeaders أو ضبط exemption مدروس لهذا التدفق إذا كان مقصودًا أن يكون عامًا.

2. إصلاح route اختبار التكاملات

- إضافة requireAdmin إلى app/api/admin/integrations/test/route.ts.
- إرسال csrfHeaders من app/admin/settings/page.tsx.
- جعل الاختبار يتبع provider المختار فعلًا بدل اختبار مزوّد ثابت داخل الكود.

3. توحيد أسماء قوالب WhatsApp

- إما تعديل lib/integrations/ycloud-templates.ts ليبني نفس الأسماء التي يستخدمها lib/bot/admin-notify.ts.
- أو تعديل runtime ليستخدم نفس أسماء أداة الإدارة.

4. إزالة duplicate order notifications

- اعتماد نقطة إرسال واحدة لكل حدث.
- التمييز بين order created و payment confirmed بدل إعادة إرسال نفس إشعار الطلب الجديد.

5. توحيد حالات الطلب بين CRM وواتساب

- تحديث helper notifyStatusChange ليتماشى مع حالات app/api/crm/orders/route.ts.

6. إصلاح Push قبل اعتباره جاهزًا

- إضافة csrfHeaders إلى app/admin/push/page.tsx.
- تحويل VAPID public key إلى Uint8Array في frontend.
- مراجعة crypto implementation في app/api/push/send/route.ts أو استبداله بحل موثوق.

7. حسم مصير internal notifications

- إما wiring فعلي للأحداث مع NotificationBell.
- أو حذف الميزة إذا لم تعد مستخدمة.

8. إيقاف silent success

- إرجاع نتيجة نجاح أو فشل واضحة من helpers الإرسال، بدل logging فقط.

## الفجوات في التحقق

- لم يتم استخدام مفاتيح env حقيقية أو بيانات integration حقيقية من البيئة الحالية.
- لم يتم إرسال رسائل حيّة عبر yCloud أو Twilio أو Resend أو SendGrid.
- لم توجد اختبارات آلية متخصصة للإشعارات داخل tests/.
- تم تشغيل ESLint فقط على ملفات الإشعارات الأساسية، وكانت النتيجة:
  - خطأ واحد في components/shared/PWAInstallPrompt.tsx متعلق بـ React hooks.
  - أربع warnings بسيطة.
- لا يمكن تأكيد نجاح custom web push crypto من قراءة الكود فقط.

## مراجع الملفات الرئيسية

- middleware.ts
- app/contact/page.tsx
- app/store/contact/page.tsx
- app/api/contact/route.ts
- app/api/admin/contact-notify/route.ts
- app/api/email/route.ts
- app/api/auth/customer/route.ts
- app/api/webhook/whatsapp/route.ts
- app/api/webhook/twilio/route.ts
- app/api/orders/route.ts
- app/api/payment/callback/route.ts
- app/api/payment/upay/callback/route.ts
- app/api/crm/orders/route.ts
- app/api/crm/inbox/[id]/send/route.ts
- app/api/push/vapid/route.ts
- app/api/push/subscribe/route.ts
- app/api/push/send/route.ts
- app/api/admin/integrations/test/route.ts
- app/api/admin/whatsapp-templates/route.ts
- components/shared/PWAInstallPrompt.tsx
- components/shared/NotificationBell.tsx
- public/sw.js
- lib/notify.ts
- lib/notifications.ts
- lib/bot/admin-notify.ts
- lib/bot/notifications.ts
- lib/bot/whatsapp.ts
- lib/integrations/hub.ts
- lib/integrations/twilio-sms.ts
- lib/integrations/ycloud-templates.ts
- lib/webhook-verify.ts

## الخلاصة

المشكلة في المشروع ليست غياب منظومة إشعارات، بل عدم اتساقها. توجد عدة طبقات جيدة: routes، helpers، تكاملات، جداول، وصفحات إدارة. لكن جزءًا مهمًا من الأعطال ناتج عن mismatch بين الطبقات نفسها:

- الواجهة لا تستدعي الـ route الصحيح.
- route موجود لكن يحتاج CSRF والواجهة لا ترسله.
- أداة الإدارة تنشئ أسماء قوالب غير التي يطلبها runtime.
- business statuses لا تطابق notification statuses.
- بعض الميزات موجودة كواجهة أو helper بدون wiring حقيقي.

إذا طُلب تنفيذ إصلاحات، فالأولوية العملية يجب أن تكون:

1. contact flow
2. integration test route
3. WhatsApp template naming
4. order notification duplication + status mapping
5. push flow
6. internal notifications cleanup