// =====================================================
// ClalMobile - Integration Test API
// POST: Test integration connection by type
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { normalizeGeminiModel } from "@/lib/ai/gemini";
import { apiSuccess, apiError, errMsg } from "@/lib/api-response";
import { resolveIntegrationConfigForRequest } from "@/lib/integrations/secrets";

type TestResult = { ok: boolean; message: string };

function toBool(value: unknown): boolean {
  return value === true || value === "true" || value === "1";
}

function toInt(value: unknown, fallback: number): number {
  const parsed = parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function testRivhit(cfg: Record<string, any>): Promise<TestResult> {
  const groupPrivateToken = cfg.group_private_token;
  if (!groupPrivateToken) {
    return { ok: false, message: "GroupPrivateToken مفقود" };
  }

  const url = toBool(cfg.test_mode)
    ? "https://testicredit.rivhit.co.il/API/PaymentPageRequest.svc/GetUrl"
    : "https://icredit.rivhit.co.il/API/PaymentPageRequest.svc/GetUrl";

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        GroupPrivateToken: groupPrivateToken,
        Items: [{ Description: "Connection Test", UnitPrice: 1, Quantity: 1 }],
        RedirectURL: "https://clalmobile.com/store/checkout/success?test=1",
        FailRedirectURL: "https://clalmobile.com/store/checkout/failed?test=1",
        IPNURL: "https://clalmobile.com/api/payment/callback",
        IPNMethod: 2,
        MaxPayments: toInt(cfg.max_payments, 1),
        MinPayments: toInt(cfg.min_payments, 1),
        Currency: 1,
        PriceIncludeVAT: true,
        CustomerFirstName: "Test",
        CustomerLastName: "Admin",
        PhoneNumber: "0500000000",
        EmailAddress: "test@clalmobile.com",
        Order: "integration-test",
        Comments: "ClalMobile integration test",
        DocumentLanguage: cfg.document_language || "he",
        HideItemList: true,
        DisplayBackButton: false,
        SaleType: toInt(cfg.sale_type, 1),
      }),
      signal: AbortSignal.timeout(10000),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && (data?.Status === 0 || data?.URL)) {
      return { ok: true, message: "✅ بوابة iCredit متصلة بنجاح" };
    }

    return {
      ok: false,
      message: data?.DebugMessage || data?.Message || `iCredit responded with ${res.status}`,
    };
  } catch (error: unknown) {
    return { ok: false, message: `خطأ في الاتصال: ${errMsg(error, "Unknown error")}` };
  }
}

async function testUpay(cfg: Record<string, any>): Promise<TestResult> {
  const apiUsername = cfg.api_username;
  const apiKey = cfg.api_key;

  if (!apiUsername || !apiKey) {
    return { ok: false, message: "اسم المستخدم ومفتاح UPay مطلوبان" };
  }

  try {
    const { upayLogin } = await import("@/lib/integrations/upay");
    const ok = await upayLogin({
      apiUsername,
      apiKey,
      testMode: toBool(cfg.test_mode),
      language: cfg.language || "HE",
      maxPayments: toInt(cfg.max_payments, 1),
    });

    return ok
      ? { ok: true, message: "✅ بوابة UPay متصلة بنجاح" }
      : { ok: false, message: "فشل تسجيل الدخول إلى UPay — تحقق من اسم المستخدم والمفتاح" };
  } catch (error: unknown) {
    return { ok: false, message: `خطأ في الاتصال: ${errMsg(error, "Unknown error")}` };
  }
}

async function testSendGrid(cfg: Record<string, any>): Promise<TestResult> {
  const apiKey = cfg.api_key;
  if (!apiKey) return { ok: false, message: "مفتاح SendGrid API مفقود" };

  try {
    const res = await fetch("https://api.sendgrid.com/v3/user/profile", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) return { ok: true, message: "✅ SendGrid متصل بنجاح" };
    if (res.status === 401) return { ok: false, message: "مفتاح API غير صالح" };
    return { ok: false, message: `SendGrid responded with ${res.status}` };
  } catch (error: unknown) {
    return { ok: false, message: `خطأ في الاتصال: ${errMsg(error, "Unknown error")}` };
  }
}

async function testResend(cfg: Record<string, any>): Promise<TestResult> {
  const apiKey = cfg.api_key;
  if (!apiKey) return { ok: false, message: "مفتاح Resend API مفقود" };

  try {
    const res = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) return { ok: true, message: "✅ Resend متصل بنجاح" };
    if ([401, 403].includes(res.status)) return { ok: false, message: "مفتاح API غير صالح" };
    return { ok: false, message: `Resend responded with ${res.status}` };
  } catch (error: unknown) {
    return { ok: false, message: `خطأ في الاتصال: ${errMsg(error, "Unknown error")}` };
  }
}

async function testClaude(
  cfg: Record<string, any>,
  defaultModel = "claude-sonnet-4-20250514",
  extraBeta?: string,
): Promise<TestResult> {
  const apiKey = String(cfg.api_key || "").trim();
  const model = String(cfg.model || defaultModel).trim();
  if (!apiKey) return { ok: false, message: "مفتاح Anthropic API مفقود" };

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    };
    if (extraBeta) headers["anthropic-beta"] = extraBeta;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        max_tokens: 8,
        messages: [{ role: "user", content: "ping" }],
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) return { ok: true, message: "✅ Anthropic Claude متصل بنجاح" };

    if ([400, 401, 403].includes(res.status)) {
      const text = await res.text().catch(() => "");
      return { ok: false, message: text || "مفتاح Claude أو النموذج غير صحيح" };
    }

    return { ok: false, message: `Anthropic responded with ${res.status}` };
  } catch (error: unknown) {
    return { ok: false, message: `خطأ في الاتصال: ${errMsg(error, "Unknown error")}` };
  }
}

async function testOpenAI(cfg: Record<string, any>): Promise<TestResult> {
  const apiKey = String(cfg.api_key || "").trim();
  if (!apiKey) return { ok: false, message: "مفتاح OpenAI API مفقود" };

  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) return { ok: true, message: "✅ OpenAI متصل بنجاح" };
    if ([400, 401, 403].includes(res.status)) {
      const text = await res.text().catch(() => "");
      return { ok: false, message: text || "مفتاح OpenAI غير صالح" };
    }

    return { ok: false, message: `OpenAI responded with ${res.status}` };
  } catch (error: unknown) {
    return { ok: false, message: `خطأ في الاتصال: ${errMsg(error, "Unknown error")}` };
  }
}

async function testMobileApi(cfg: Record<string, any>): Promise<TestResult> {
  const apiKey = String(cfg.api_key || "").trim();
  if (!apiKey) return { ok: false, message: "مفتاح MobileAPI.dev مفقود" };

  try {
    const params = new URLSearchParams({
      key: apiKey,
      name: "iPhone 16",
      manufacturer: "Apple",
    });
    const res = await fetch(`https://api.mobileapi.dev/devices/search/?${params.toString()}`, {
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) return { ok: true, message: "✅ MobileAPI.dev متصل بنجاح" };
    if ([400, 401, 403].includes(res.status)) {
      const text = await res.text().catch(() => "");
      return { ok: false, message: text || "مفتاح MobileAPI.dev غير صالح" };
    }

    return { ok: false, message: `MobileAPI.dev responded with ${res.status}` };
  } catch (error: unknown) {
    return { ok: false, message: `خطأ في الاتصال: ${errMsg(error, "Unknown error")}` };
  }
}

async function testPexels(cfg: Record<string, any>): Promise<TestResult> {
  const apiKey = String(cfg.api_key || "").trim();
  if (!apiKey) return { ok: false, message: "مفتاح Pexels API مفقود" };

  try {
    const res = await fetch("https://api.pexels.com/v1/search?query=phone&per_page=1", {
      headers: { Authorization: apiKey },
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) return { ok: true, message: "✅ Pexels متصل بنجاح" };
    if ([400, 401, 403].includes(res.status)) {
      const text = await res.text().catch(() => "");
      return { ok: false, message: text || "مفتاح Pexels غير صالح" };
    }

    return { ok: false, message: `Pexels responded with ${res.status}` };
  } catch (error: unknown) {
    return { ok: false, message: `خطأ في الاتصال: ${errMsg(error, "Unknown error")}` };
  }
}

const TESTS: Record<string, (config: Record<string, any>, provider?: string) => Promise<TestResult>> = {
  payment: async (cfg, provider) => {
    if (provider && provider !== "רווחית (Rivhit)") {
      return { ok: false, message: `مزود غير مدعوم لهذا النوع: ${provider}` };
    }
    return testRivhit(cfg);
  },

  payment_upay: async (cfg) => {
    return testUpay(cfg);
  },

  email: async (cfg, provider) => {
    if (provider === "SendGrid") return testSendGrid(cfg);
    if (provider === "Resend") return testResend(cfg);
    if (cfg.api_key && cfg.from_email) return testResend(cfg);
    return { ok: false, message: "اختر مزود البريد أولًا" };
  },

  ai_admin: async (cfg, provider) => {
    if (provider && provider !== "OpenAI") {
      return { ok: false, message: `مزود غير مدعوم: ${provider}` };
    }
    return testOpenAI(cfg);
  },

  whatsapp: async (cfg) => {
    const apiKey = cfg.api_key;
    if (!apiKey) return { ok: false, message: "مفتاح yCloud API مفقود" };

    try {
      const res = await fetch("https://api.ycloud.com/v2/whatsapp/phoneNumbers?limit=1", {
        headers: { "X-API-Key": apiKey },
        signal: AbortSignal.timeout(10000),
      });

      if (res.ok) return { ok: true, message: "✅ yCloud WhatsApp متصل بنجاح" };
      if (res.status === 401) return { ok: false, message: "مفتاح API غير صالح" };
      return { ok: false, message: `yCloud responded with ${res.status}` };
    } catch (error: unknown) {
      return { ok: false, message: `خطأ في الاتصال: ${errMsg(error, "Unknown error")}` };
    }
  },

  sms: async (cfg) => {
    const accountSid = cfg.account_sid;
    const authToken = cfg.auth_token;
    const verifySid = cfg.verify_service_sid;
    const fromNumber = cfg.phone_number;
    const msgSvcSid = cfg.messaging_service_sid;

    if (!accountSid || !authToken) {
      return { ok: false, message: "Account SID و Auth Token مطلوبان" };
    }

    if (!fromNumber && !msgSvcSid && !verifySid) {
      return {
        ok: false,
        message: "Verify Service SID أو From Number أو Messaging Service SID مطلوب",
      };
    }

    try {
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, {
        headers: {
          Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        },
        signal: AbortSignal.timeout(10000),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.status === "active") {
          return {
            ok: true,
            message: `✅ Twilio SMS متصل بنجاح - الحساب: ${data.friendly_name || accountSid}`,
          };
        }

        return { ok: false, message: `حساب Twilio غير نشط (${data.status})` };
      }

      if (res.status === 401) {
        return { ok: false, message: "❌ Account SID أو Auth Token غير صحيح" };
      }

      return { ok: false, message: `Twilio responded with ${res.status}` };
    } catch (error: unknown) {
      return { ok: false, message: `خطأ في الاتصال: ${errMsg(error, "Unknown error")}` };
    }
  },

  shipping: async (cfg) => {
    if (!cfg.api_key) return { ok: false, message: "مفتاح API مفقود" };
    return { ok: true, message: "✅ بيانات الشحن محفوظة (لم يتم اختبار الاتصال)" };
  },

  analytics: async (cfg) => {
    if (!cfg.tracking_id && !cfg.api_key) {
      return { ok: false, message: "معرف التتبع مفقود" };
    }
    return { ok: true, message: "✅ بيانات التحليلات محفوظة" };
  },

  storage: async (cfg) => {
    const required = ["account_id", "access_key_id", "secret_access_key", "public_url"];
    const missing = required.filter((key) => !cfg[key]);
    if (missing.length > 0) {
      return { ok: false, message: `حقول مفقودة: ${missing.join(", ")}` };
    }

    return { ok: true, message: "✅ إعدادات Cloudflare R2 مكتملة وجاهزة للاستخدام" };
  },

  push_notifications: async (cfg) => {
    if (!cfg.public_key || !cfg.private_key) {
      return { ok: false, message: "مفتاحا VAPID العام والخاص مطلوبان" };
    }

    return { ok: true, message: "✅ مفاتيح Web Push محفوظة وجاهزة للإرسال" };
  },

  ai_chat: async (cfg, provider) => {
    if (!provider) {
      return { ok: false, message: "اختر مزود الذكاء أولًا" };
    }

    if (provider === "Google Gemini") {
      const apiKey = cfg.api_key;
      const model = normalizeGeminiModel(cfg.model || "gemini-1.5-flash-latest");
      if (!apiKey) return { ok: false, message: "مفتاح Google Gemini API مفقود" };

      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: "ping" }] }],
              generationConfig: { temperature: 0, maxOutputTokens: 8 },
            }),
            signal: AbortSignal.timeout(10000),
          }
        );

        if (res.ok) return { ok: true, message: "✅ Google Gemini متصل بنجاح" };

        if ([400, 401, 403].includes(res.status)) {
          const text = await res.text().catch(() => "");
          return { ok: false, message: text || "مفتاح Gemini أو النموذج غير صحيح" };
        }

        return { ok: false, message: `Gemini responded with ${res.status}` };
      } catch (error: unknown) {
        return { ok: false, message: `خطأ في الاتصال: ${errMsg(error, "Unknown error")}` };
      }
    }

    if (provider === "Anthropic Claude") {
      return testClaude(cfg);
    }

    return { ok: false, message: `مزود غير مدعوم: ${provider}` };
  },
  ai_intelligence: async (cfg, provider) => {
    if (provider && provider !== "Anthropic Claude") {
      return { ok: false, message: `مزود غير مدعوم: ${provider}` };
    }
    return testClaude(cfg, "claude-opus-4-7", "context-1m-2025-08-07,prompt-caching-2024-07-31");
  },
  image_enhance: async (cfg) => {
    if (!cfg.api_key) {
      return { ok: false, message: "مفتاح Remove.bg API مفقود" };
    }

    return { ok: true, message: "✅ إعدادات Remove.bg محفوظة وجاهزة للتشغيل" };
  },
  device_data: async (cfg) => {
    return testMobileApi(cfg);
  },
  stock_images: async (cfg) => {
    return testPexels(cfg);
  },
  ai_vision: async (cfg) => {
    const apiKey = String(cfg.api_key || "").trim();
    if (!apiKey) return { ok: false, message: "مفتاح AI Gateway مفقود" };
    try {
      const res = await fetch("https://ai-gateway.vercel.sh/v1/ai/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: String(cfg.default_model || "google/gemini-2.5-flash"),
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 10,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) return { ok: true, message: "✅ Vercel AI Gateway متصل بنجاح" };
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        message: `AI Gateway ${res.status}: ${text.slice(0, 200) || "غير متاح"}`,
      };
    } catch (error: unknown) {
      return { ok: false, message: `خطأ في الاتصال: ${errMsg(error, "Unknown error")}` };
    }
  },
  image_search: async (cfg, provider) => {
    if (provider === "Bing") {
      const key = String(cfg.bing_key || cfg.api_key || "").trim();
      if (!key) return { ok: false, message: "مفتاح Bing مفقود" };
      try {
        const res = await fetch(
          "https://api.bing.microsoft.com/v7.0/images/search?q=phone&count=1",
          {
            headers: { "Ocp-Apim-Subscription-Key": key },
            signal: AbortSignal.timeout(10000),
          },
        );
        if (res.ok) return { ok: true, message: "✅ Bing Image Search متصل" };
        return { ok: false, message: `Bing ${res.status}` };
      } catch (error: unknown) {
        return { ok: false, message: `خطأ: ${errMsg(error, "Unknown error")}` };
      }
    }
    // Default: Google CSE
    const apiKey = String(cfg.api_key || "").trim();
    const cx = String(cfg.cx || "").trim();
    if (!apiKey || !cx)
      return { ok: false, message: "Google API Key أو CX مفقود" };
    try {
      const url = new URL("https://www.googleapis.com/customsearch/v1");
      url.searchParams.set("key", apiKey);
      url.searchParams.set("cx", cx);
      url.searchParams.set("q", "phone");
      url.searchParams.set("searchType", "image");
      url.searchParams.set("num", "1");
      const res = await fetch(url.toString(), {
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) return { ok: true, message: "✅ Google CSE متصل بنجاح" };
      const text = await res.text().catch(() => "");
      return { ok: false, message: `Google CSE ${res.status}: ${text.slice(0, 160)}` };
    } catch (error: unknown) {
      return { ok: false, message: `خطأ: ${errMsg(error, "Unknown error")}` };
    }
  },
  webhook_security: async (cfg) => {
    if (!cfg.verify_token) {
      return { ok: false, message: "Verify Token مطلوب على الأقل" };
    }

    return {
      ok: true,
      message: "✅ أسرار Webhook محفوظة. يمكن إضافة أسرار التوقيع حسب الحاجة.",
    };
  },
};

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const { type, config, provider } = await req.json();

    if (!type || !config) {
      return apiError("نوع التكامل أو الإعدادات مفقودة", 400);
    }

    const testFn = TESTS[type];
    if (!testFn) {
      return apiError(`لا يوجد اختبار لنوع التكامل: ${type}`, 400);
    }

    const resolved = await resolveIntegrationConfigForRequest(type, config);
    const result = await testFn(resolved.config, provider || resolved.provider);

    return apiSuccess(result);
  } catch (error: unknown) {
    console.error("Integration test error:", error);
    return apiError("فشل في اختبار التكامل", 500);
  }
}
