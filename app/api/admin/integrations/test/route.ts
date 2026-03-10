export const runtime = 'edge';

import { NextRequest, NextResponse } from "next/server";
import { getIntegrations } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/admin/auth";

const MASK = "••••••••";

async function resolveConfig(type: string, config: Record<string, any>): Promise<Record<string, any>> {
  const needsResolve = Object.values(config).some(
    (v) => typeof v === "string" && v.includes(MASK)
  );
  if (!needsResolve) return config;

  const integrations = await getIntegrations();
  const existing = integrations.find((i: any) => i.type === type);
  const oldConfig = existing?.config || {};
  const resolved = { ...config };

  for (const [key, val] of Object.entries(resolved)) {
    if (typeof val === "string" && val.includes(MASK)) {
      resolved[key] = oldConfig[key] || "";
    }
  }
  return resolved;
}

type TestFn = (cfg: Record<string, any>) => Promise<{ ok: boolean; message: string }>;

// ── Payment Tests (provider-aware) ──

const testRivhit: TestFn = async (cfg) => {
  if (!cfg.api_key || !cfg.business_id) return { ok: false, message: "مفتاح API أو معرف العمل مفقود" };
  try {
    const res = await fetch("https://api.rivhit.co.il/online/api/PaymentPageRequest.svc/GetUrl", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_token: cfg.api_key, business_id: Number(cfg.business_id),
        type: 320, description: "Connection Test", sum: 0.01,
        currency: "ILS", client_name: "Test", client_phone: "0500000000",
      }),
    });
    const data = await res.json();
    if (data.status === 1 || data.payment_url) return { ok: true, message: "✅ Rivhit متصل بنجاح" };
    return { ok: false, message: data.error_message || `Rivhit error: ${data.error_code || "unknown"}` };
  } catch (err: any) { return { ok: false, message: `خطأ في الاتصال: ${err.message}` }; }
};

const testStripe: TestFn = async (cfg) => {
  if (!cfg.api_key) return { ok: false, message: "Secret Key مفقود" };
  try {
    const res = await fetch("https://api.stripe.com/v1/balance", {
      headers: { Authorization: `Bearer ${cfg.api_key}` },
    });
    if (res.ok) return { ok: true, message: "✅ Stripe متصل بنجاح" };
    if (res.status === 401) return { ok: false, message: "مفتاح API غير صالح" };
    return { ok: false, message: `Stripe responded with ${res.status}` };
  } catch (err: any) { return { ok: false, message: `خطأ في الاتصال: ${err.message}` }; }
};

const testTranzila: TestFn = async (cfg) => {
  if (!cfg.terminal) return { ok: false, message: "Terminal Name مفقود" };
  return { ok: true, message: "✅ بيانات Tranzila محفوظة — يتم التحقق عند أول عملية دفع" };
};

const testPayPlus: TestFn = async (cfg) => {
  if (!cfg.api_key || !cfg.secret_key) return { ok: false, message: "API Key و Secret Key مطلوبان" };
  return { ok: true, message: "✅ بيانات PayPlus محفوظة — يتم التحقق عند أول عملية دفع" };
};

const testUPay: TestFn = async (cfg) => {
  if (!cfg.api_username || !cfg.api_key) return { ok: false, message: "API Username و API Key مطلوبان" };
  try {
    const testMode = cfg.test_mode === "true" || cfg.test_mode === true;
    const language = cfg.language || "HE";

    const sessionRes = await fetch("https://app.upay.co.il/API6/client/json.php", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        msg: JSON.stringify({
          header: { refername: "UPAY", livesystem: testMode ? 0 : 1, language },
          request: { mainaction: "SESSION", minoraction: "GETSESSION", encoding: "json" },
        }),
      }).toString(),
    });
    const sessionData = await sessionRes.json();
    if (!sessionData?.success || !sessionData?.result?.sessionid) {
      return { ok: false, message: "فشل الحصول على جلسة UPay — تأكد من الاتصال بالإنترنت" };
    }

    const loginRes = await fetch("https://app.upay.co.il/API6/clientsecure/json.php", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        msg: JSON.stringify({
          header: { sessionid: sessionData.result.sessionid },
          request: {
            mainaction: "CONNECTION",
            minoraction: "LOGIN",
            encoding: "json",
            parameters: { email: cfg.api_username, key: cfg.api_key },
          },
        }),
      }).toString(),
    });
    const loginData = await loginRes.json();
    if (loginData?.success) {
      return { ok: true, message: `✅ UPay متصل بنجاح — ${testMode ? "وضع اختبار" : "وضع حقيقي"}` };
    }
    return { ok: false, message: loginData?.result?.errormessage || "فشل تسجيل الدخول — تأكد من البيانات" };
  } catch (err: any) {
    return { ok: false, message: `خطأ في الاتصال: ${err.message}` };
  }
};

// ── WhatsApp Tests (provider-aware) ──

const testYCloud: TestFn = async (cfg) => {
  if (!cfg.api_key) return { ok: false, message: "مفتاح yCloud API مفقود" };
  try {
    const res = await fetch("https://api.ycloud.com/v2/whatsapp/phoneNumbers?limit=1", {
      headers: { "X-API-Key": cfg.api_key },
    });
    if (res.ok) return { ok: true, message: "✅ yCloud WhatsApp متصل بنجاح" };
    if (res.status === 401) return { ok: false, message: "مفتاح API غير صالح" };
    return { ok: false, message: `yCloud responded with ${res.status}` };
  } catch (err: any) { return { ok: false, message: `خطأ في الاتصال: ${err.message}` }; }
};

const testMetaAPI: TestFn = async (cfg) => {
  if (!cfg.access_token || !cfg.phone_id) return { ok: false, message: "Access Token و Phone Number ID مطلوبان" };
  try {
    const res = await fetch(`https://graph.facebook.com/v18.0/${cfg.phone_id}`, {
      headers: { Authorization: `Bearer ${cfg.access_token}` },
    });
    if (res.ok) return { ok: true, message: "✅ Meta WhatsApp API متصل بنجاح" };
    if (res.status === 401) return { ok: false, message: "Access Token غير صالح" };
    return { ok: false, message: `Meta API responded with ${res.status}` };
  } catch (err: any) { return { ok: false, message: `خطأ في الاتصال: ${err.message}` }; }
};

const testTwilioWA: TestFn = async (cfg) => {
  if (!cfg.account_sid || !cfg.auth_token) return { ok: false, message: "Account SID و Auth Token مطلوبان" };
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${cfg.account_sid}.json`, {
      headers: { Authorization: `Basic ${btoa(`${cfg.account_sid}:${cfg.auth_token}`)}` },
    });
    if (res.ok) return { ok: true, message: "✅ Twilio WhatsApp متصل بنجاح" };
    if (res.status === 401) return { ok: false, message: "بيانات Twilio غير صحيحة" };
    return { ok: false, message: `Twilio responded with ${res.status}` };
  } catch (err: any) { return { ok: false, message: `خطأ في الاتصال: ${err.message}` }; }
};

// ── SMS Test ──

const testTwilioSMS: TestFn = async (cfg) => {
  if (!cfg.account_sid || !cfg.auth_token) return { ok: false, message: "Account SID و Auth Token مطلوبان" };
  if (!cfg.phone_number && !cfg.messaging_service_sid && !cfg.verify_service_sid) {
    return { ok: false, message: "Verify Service SID أو From Number أو Messaging Service SID مطلوب" };
  }
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${cfg.account_sid}.json`, {
      headers: { Authorization: `Basic ${btoa(`${cfg.account_sid}:${cfg.auth_token}`)}` },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.status === "active") return { ok: true, message: `✅ Twilio SMS متصل — ${data.friendly_name || cfg.account_sid}` };
      return { ok: false, message: `حساب Twilio غير نشط (${data.status})` };
    }
    if (res.status === 401) return { ok: false, message: "❌ Account SID أو Auth Token غير صحيح" };
    return { ok: false, message: `Twilio responded with ${res.status}` };
  } catch (err: any) { return { ok: false, message: `خطأ في الاتصال: ${err.message}` }; }
};

// ── Email Tests (provider-aware) ──

const testResend: TestFn = async (cfg) => {
  if (!cfg.api_key) return { ok: false, message: "مفتاح Resend API مفقود" };
  try {
    const res = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${cfg.api_key}` },
    });
    if (res.ok) return { ok: true, message: "✅ Resend متصل بنجاح" };
    if (res.status === 401 || res.status === 403) return { ok: false, message: "مفتاح API غير صالح" };
    return { ok: false, message: `Resend responded with ${res.status}` };
  } catch (err: any) { return { ok: false, message: `خطأ في الاتصال: ${err.message}` }; }
};

const testSendGrid: TestFn = async (cfg) => {
  if (!cfg.api_key) return { ok: false, message: "مفتاح SendGrid API مفقود" };
  try {
    const res = await fetch("https://api.sendgrid.com/v3/user/profile", {
      headers: { Authorization: `Bearer ${cfg.api_key}` },
    });
    if (res.ok) return { ok: true, message: "✅ SendGrid متصل بنجاح" };
    if (res.status === 401) return { ok: false, message: "مفتاح API غير صالح" };
    return { ok: false, message: `SendGrid responded with ${res.status}` };
  } catch (err: any) { return { ok: false, message: `خطأ في الاتصال: ${err.message}` }; }
};

const testMailgun: TestFn = async (cfg) => {
  if (!cfg.api_key || !cfg.domain) return { ok: false, message: "API Key و Domain مطلوبان" };
  try {
    const res = await fetch(`https://api.mailgun.net/v3/${cfg.domain}/stats/total?event=accepted&duration=1h`, {
      headers: { Authorization: `Basic ${btoa(`api:${cfg.api_key}`)}` },
    });
    if (res.ok) return { ok: true, message: "✅ Mailgun متصل بنجاح" };
    if (res.status === 401) return { ok: false, message: "مفتاح API غير صالح" };
    return { ok: false, message: `Mailgun responded with ${res.status}` };
  } catch (err: any) { return { ok: false, message: `خطأ في الاتصال: ${err.message}` }; }
};

const testAmazonSES: TestFn = async (cfg) => {
  if (!cfg.access_key || !cfg.secret_key || !cfg.region) return { ok: false, message: "Access Key و Secret Key و Region مطلوبين" };
  return { ok: true, message: "✅ بيانات Amazon SES محفوظة — يتم التحقق عند أول إرسال" };
};

const testSMTP: TestFn = async (cfg) => {
  if (!cfg.host || !cfg.port) return { ok: false, message: "SMTP Host و Port مطلوبان" };
  return { ok: true, message: `✅ بيانات SMTP محفوظة (${cfg.host}:${cfg.port}) — يتم التحقق عند أول إرسال` };
};

// ── AI Tests ──

const testAnthropicClaude: TestFn = async (cfg) => {
  const key = cfg.api_key || cfg.api_key_bot || cfg.api_key_store;
  if (!key) return { ok: false, message: "مفتاح Anthropic API مفقود" };
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 5,
        messages: [{ role: "user", content: "ping" }],
      }),
    });
    if (res.ok) return { ok: true, message: "✅ Anthropic Claude متصل بنجاح" };
    if (res.status === 401) return { ok: false, message: "مفتاح API غير صالح" };
    if (res.status === 429) return { ok: true, message: "✅ المفتاح صحيح (rate limited حالياً)" };
    const data = await res.json().catch(() => ({}));
    return { ok: false, message: (data as any).error?.message || `Anthropic responded with ${res.status}` };
  } catch (err: any) { return { ok: false, message: `خطأ في الاتصال: ${err.message}` }; }
};

const testOpenAI: TestFn = async (cfg) => {
  const key = cfg.api_key || cfg.api_key_admin;
  if (!key) return { ok: false, message: "مفتاح OpenAI API مفقود" };
  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (res.ok) return { ok: true, message: "✅ OpenAI متصل بنجاح" };
    if (res.status === 401) return { ok: false, message: "مفتاح API غير صالح" };
    if (res.status === 429) return { ok: true, message: "✅ المفتاح صحيح (rate limited حالياً)" };
    return { ok: false, message: `OpenAI responded with ${res.status}` };
  } catch (err: any) { return { ok: false, message: `خطأ في الاتصال: ${err.message}` }; }
};

// ── Storage Test (Cloudflare R2) ──

const testCloudflareR2: TestFn = async (cfg) => {
  if (!cfg.account_id || !cfg.access_key || !cfg.secret_key || !cfg.bucket_name) {
    return { ok: false, message: "Account ID, Access Key, Secret Key, و Bucket Name مطلوبين" };
  }
  try {
    const url = `https://${cfg.account_id}.r2.cloudflarestorage.com/${cfg.bucket_name}?list-type=2&max-keys=1`;
    const now = new Date().toUTCString();
    const res = await fetch(url, {
      headers: { Date: now },
    }).catch(() => null);
    if (res && res.ok) return { ok: true, message: "✅ Cloudflare R2 متصل بنجاح" };
    if (cfg.public_url) {
      const pubRes = await fetch(`${cfg.public_url}/`).catch(() => null);
      if (pubRes && (pubRes.ok || pubRes.status === 403)) {
        return { ok: true, message: "✅ Cloudflare R2 — البيانات محفوظة، Public URL يستجيب" };
      }
    }
    return { ok: true, message: "✅ بيانات R2 محفوظة — يتم التحقق الكامل عند أول رفع صورة" };
  } catch (err: any) { return { ok: false, message: `خطأ في الاتصال: ${err.message}` }; }
};

// ── Image Processing Tests ──

const testRemoveBG: TestFn = async (cfg) => {
  if (!cfg.api_key) return { ok: false, message: "مفتاح RemoveBG API مفقود" };
  try {
    const res = await fetch("https://api.remove.bg/v1.0/account", {
      headers: { "X-Api-Key": cfg.api_key },
    });
    if (res.ok) {
      const data = await res.json();
      return { ok: true, message: `✅ RemoveBG متصل — رصيد: ${data.data?.attributes?.credits?.total ?? "N/A"}` };
    }
    if (res.status === 403) return { ok: false, message: "مفتاح API غير صالح" };
    return { ok: false, message: `RemoveBG responded with ${res.status}` };
  } catch (err: any) { return { ok: false, message: `خطأ في الاتصال: ${err.message}` }; }
};

const testPexels: TestFn = async (cfg) => {
  if (!cfg.api_key) return { ok: false, message: "مفتاح Pexels API مفقود" };
  try {
    const res = await fetch("https://api.pexels.com/v1/search?query=phone&per_page=1", {
      headers: { Authorization: cfg.api_key },
    });
    if (res.ok) return { ok: true, message: "✅ Pexels متصل بنجاح" };
    if (res.status === 401 || res.status === 403) return { ok: false, message: "مفتاح API غير صالح" };
    return { ok: false, message: `Pexels responded with ${res.status}` };
  } catch (err: any) { return { ok: false, message: `خطأ في الاتصال: ${err.message}` }; }
};

const testMobileAPI: TestFn = async (cfg) => {
  if (!cfg.api_key) return { ok: false, message: "مفتاح MobileAPI مفقود" };
  return { ok: true, message: "✅ بيانات MobileAPI محفوظة — يتم التحقق عند أول استعلام" };
};

// ── Push Notifications (VAPID) ──

const testVAPID: TestFn = async (cfg) => {
  if (!cfg.vapid_public || !cfg.vapid_private) return { ok: false, message: "VAPID Public و Private Key مطلوبان" };
  if (cfg.vapid_public.length < 60) return { ok: false, message: "VAPID Public Key قصير جداً — تأكد من المفتاح" };
  if (cfg.vapid_private.length < 30) return { ok: false, message: "VAPID Private Key قصير جداً — تأكد من المفتاح" };
  return { ok: true, message: "✅ مفاتيح VAPID محفوظة — الصيغة صحيحة" };
};

// ── Analytics Tests (provider-aware) ──

const testGoogleAnalytics: TestFn = async (cfg) => {
  if (!cfg.measurement_id) return { ok: false, message: "Measurement ID مفقود (G-XXXXXXXX)" };
  if (!/^G-[A-Z0-9]+$/.test(cfg.measurement_id)) return { ok: false, message: "صيغة Measurement ID غير صحيحة — يجب أن تكون G-XXXXXXXX" };
  return { ok: true, message: `✅ Google Analytics محفوظ — ${cfg.measurement_id}` };
};

const testMixpanel: TestFn = async (cfg) => {
  if (!cfg.project_token) return { ok: false, message: "Project Token مفقود" };
  return { ok: true, message: "✅ Mixpanel Project Token محفوظ" };
};

// ── CRM Tests ──

const testHubSpot: TestFn = async (cfg) => {
  if (!cfg.api_key) return { ok: false, message: "HubSpot API Key مفقود" };
  try {
    const res = await fetch("https://api.hubapi.com/crm/v3/objects/contacts?limit=1", {
      headers: { Authorization: `Bearer ${cfg.api_key}` },
    });
    if (res.ok) return { ok: true, message: "✅ HubSpot متصل بنجاح" };
    if (res.status === 401) return { ok: false, message: "مفتاح API غير صالح" };
    return { ok: false, message: `HubSpot responded with ${res.status}` };
  } catch (err: any) { return { ok: false, message: `خطأ في الاتصال: ${err.message}` }; }
};

const testSalesforce: TestFn = async (cfg) => {
  if (!cfg.client_id || !cfg.client_secret || !cfg.instance_url) {
    return { ok: false, message: "Client ID, Client Secret, و Instance URL مطلوبين" };
  }
  try {
    const res = await fetch(`${cfg.instance_url}/services/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: cfg.client_id,
        client_secret: cfg.client_secret,
      }),
    });
    if (res.ok) return { ok: true, message: "✅ Salesforce متصل بنجاح" };
    if (res.status === 401 || res.status === 400) return { ok: false, message: "بيانات Salesforce غير صحيحة" };
    return { ok: false, message: `Salesforce responded with ${res.status}` };
  } catch (err: any) { return { ok: false, message: `خطأ في الاتصال: ${err.message}` }; }
};

// ── Provider Routing Map ──
// Key format: "type" or "type:provider" for provider-specific tests

const TESTS: Record<string, TestFn> = {
  "payment:רווחית (Rivhit)": testRivhit,
  "payment:Stripe": testStripe,
  "payment:Tranzila": testTranzila,
  "payment:PayPlus": testPayPlus,
  "payment_upay:UPay": testUPay,

  "whatsapp:yCloud": testYCloud,
  "whatsapp:Meta API": testMetaAPI,
  "whatsapp:Twilio": testTwilioWA,

  "sms:Twilio SMS": testTwilioSMS,

  "email:Resend": testResend,
  "email:SendGrid": testSendGrid,
  "email:Mailgun": testMailgun,
  "email:Amazon SES": testAmazonSES,
  "email:SMTP": testSMTP,

  "ai_chat:Anthropic Claude": testAnthropicClaude,
  "ai_admin:OpenAI": testOpenAI,

  "storage:Cloudflare R2": testCloudflareR2,

  "image_processing:RemoveBG": testRemoveBG,
  "image_search:Pexels": testPexels,
  "device_specs:MobileAPI": testMobileAPI,

  "push_notifications:Web Push (VAPID)": testVAPID,

  "analytics:Google Analytics": testGoogleAnalytics,
  "analytics:Mixpanel": testMixpanel,

  "crm_external:HubSpot": testHubSpot,
  "crm_external:Salesforce": testSalesforce,
};

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const { type, provider, config } = await req.json();

    if (!type || !config) {
      return NextResponse.json({ ok: false, message: "نوع التكامل أو الإعدادات مفقودة" }, { status: 400 });
    }

    const testKey = provider ? `${type}:${provider}` : type;
    const testFn = TESTS[testKey];
    if (!testFn) {
      return NextResponse.json({ ok: false, message: `لا يوجد اختبار لـ ${provider || type}` }, { status: 400 });
    }

    const resolvedConfig = await resolveConfig(type, config);
    const result = await testFn(resolvedConfig);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
