// =====================================================
// ClalMobile — Create WhatsApp Templates in yCloud
// Run once: node scripts/create-wa-templates.js
// =====================================================

const YCLOUD_API_KEY = process.env.YCLOUD_API_KEY;
if (!YCLOUD_API_KEY) {
  console.error("Error: YCLOUD_API_KEY environment variable is required");
  process.exit(1);
}
const WABA_ID = "806505221863803";
const YCLOUD_API = "https://api.ycloud.com/v2";

// Rules Meta enforces:
// 1. Variables cannot be at the start or end of the body
// 2. Fixed text must be >= variable text (ratio check)
// 3. Max 10 variables per template

const TEMPLATES = [
  // Already exists — skip
  // { name: "clal_admin_alert", ... }

  {
    name: "clal_new_order",
    // 4 params: orderId, customer+phone+amount+source, items, link
    body:
      "طلب جديد وصل من المتجر 🆕\n\n" +
      "رقم الطلب: {{1}}\n\n" +
      "معلومات الزبون والطلب:\n{{2}}\n\n" +
      "المنتجات المطلوبة:\n{{3}}\n\n" +
      "رابط الإدارة:\n{{4}}\n\n" +
      "يرجى مراجعة الطلب في أقرب وقت.",
    example: [
      "ORD-1234",
      "محمد أحمد | 0501234567\nالمبلغ: ₪3,599 | المصدر: المتجر",
      "• iPhone 17 × 1 — ₪3,599",
      "https://clalmobile.com/crm/orders?search=ORD-1234",
    ],
  },

  {
    name: "clal_order_done",
    // 3 params: order details, amount+status, link
    body:
      "تم إتمام الطلب بنجاح ✅\n\n" +
      "تفاصيل الطلب المكتمل:\n{{1}}\n\n" +
      "المبلغ والحالة: {{2}}\n\n" +
      "للمراجعة والمتابعة:\n{{3}}\n\n" +
      "شكراً لمتابعتك.",
    example: [
      "رقم الطلب: ORD-1234\nالزبون: محمد أحمد | 0501234567",
      "₪3,599 | تم التسليم",
      "https://clalmobile.com/crm/orders?search=ORD-1234",
    ],
  },

  {
    name: "clal_contact_form",
    // 3 params: sender info, subject+message, link
    body:
      "وصلت رسالة تواصل جديدة من الموقع 📩\n\n" +
      "معلومات المرسل:\n{{1}}\n\n" +
      "موضوع الرسالة ومحتواها:\n{{2}}\n\n" +
      "للرد والمتابعة من لوحة التحكم:\n{{3}}\n\n" +
      "يرجى الرد في أقرب وقت ممكن.",
    example: [
      "أحمد خالد | 0509876543 | ahmed@email.com",
      "الموضوع: استفسار عن سعر\nأريد معرفة سعر iPhone 17 Pro",
      "https://clalmobile.com/crm/customers",
    ],
  },

  {
    name: "clal_handoff",
    // 3 params: customer info, message, time
    body:
      "طلب تحدث مع محمد 👤\n\n" +
      "معلومات الزبون:\n{{1}}\n\n" +
      "محتوى الطلب:\n{{2}}\n\n" +
      "وقت الطلب: {{3}}\n" +
      "يرجى التواصل مع الزبون في أقرب وقت.",
    example: [
      "سارة محمود | 0521234567 | واتساب",
      "أريد التحدث مع شخص بخصوص طلبي",
      "22/3/2026, 14:30",
    ],
  },

  {
    name: "clal_angry_cust",
    // 3 params: customer info, message, time
    body:
      "تنبيه عاجل: زبون غير راضٍ ⚠️\n\n" +
      "معلومات الزبون:\n{{1}}\n\n" +
      "رسالة الزبون:\n{{2}}\n\n" +
      "وقت الإبلاغ: {{3}}\n" +
      "يُنصح بالتواصل الفوري مع الزبون.",
    example: [
      "خالد عمر | 0531234567 | شات الموقع",
      "الطلب لم يصل منذ أسبوع وهذا غير مقبول!",
      "22/3/2026, 16:00",
    ],
  },

  {
    name: "clal_new_msg",
    // 3 params: name+phone, preview, time+link
    body:
      "وصلت رسالة واتساب جديدة 💬\n\n" +
      "من الزبون:\n{{1}}\n\n" +
      "محتوى الرسالة:\n{{2}}\n\n" +
      "وقت الاستلام: {{3}}\n" +
      "افتح صندوق الوارد للرد على الرسالة.",
    example: [
      "نور الدين (+972501234567)",
      "السلام عليكم، هل يتوفر Galaxy S25؟",
      "22/3/2026, 10:15\nhttps://clalmobile.com/crm/inbox",
    ],
  },

  {
    name: "clal_daily_report",
    // 2 params: date, link
    body:
      "التقرير اليومي لـ ClalMobile 📊\n\n" +
      "تاريخ التقرير: {{1}}\n\n" +
      "لعرض التقرير المفصل اضغط على الرابط:\n{{2}}\n\n" +
      "صباح الخير وأسبوع موفق لفريق العمل! ☀️",
    example: [
      "2026-03-22",
      "https://clalmobile.com/api/reports/daily?date=2026-03-22",
    ],
  },

  {
    name: "clal_weekly_report",
    // 2 params: date, link
    body:
      "التقرير الأسبوعي لـ ClalMobile 📈\n\n" +
      "تاريخ التقرير: {{1}}\n\n" +
      "لعرض التقرير المفصل اضغط على الرابط:\n{{2}}\n\n" +
      "أسبوع موفق لفريق العمل كله! 🚀",
    example: [
      "2026-03-22",
      "https://clalmobile.com/api/reports/weekly?date=2026-03-22",
    ],
  },
];

async function createTemplate(tpl) {
  const payload = {
    wabaId: WABA_ID,
    name: tpl.name,
    language: "ar",
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text: tpl.body,
        example: {
          body_text: [tpl.example],
        },
      },
    ],
  };

  const res = await fetch(`${YCLOUD_API}/whatsapp/templates`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": YCLOUD_API_KEY,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (res.ok) {
    console.log(`✅ ${tpl.name} — submitted (status: ${data.status || "pending"})`);
  } else {
    if (res.status === 409 || JSON.stringify(data).toLowerCase().includes("already")) {
      console.log(`⏭️  ${tpl.name} — already exists, skipping`);
    } else {
      const errMsg = data?.error?.whatsappApiError?.error_user_msg || data?.error?.message || JSON.stringify(data);
      console.error(`❌ ${tpl.name} — ${errMsg}`);
    }
  }
}

async function main() {
  console.log("=".repeat(55));
  console.log("ClalMobile — Creating WhatsApp Templates");
  console.log(`WABA ID: ${WABA_ID}`);
  console.log("=".repeat(55));
  console.log();

  for (const tpl of TEMPLATES) {
    await createTemplate(tpl);
    await new Promise((r) => setTimeout(r, 600));
  }

  console.log();
  console.log("=".repeat(55));
  console.log("Done! Check approval status:");
  console.log("https://app.ycloud.com/whatsapp/templates");
  console.log("=".repeat(55));
}

main().catch(console.error);
