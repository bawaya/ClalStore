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

const TESTS: Record<string, (config: Record<string, any>, provider?: string) => Promise<TestResult>> = {
  payment: async (cfg) => {
    const apiKey = cfg.api_key;
    const businessId = cfg.business_id;
    if (!apiKey || !businessId) {
      return { ok: false, message: "مفتاح API أو معرف العمل مفقود" };
    }

    try {
      const res = await fetch("https://api.rivhit.co.il/online/api/PaymentPageRequest.svc/GetUrl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_token: apiKey,
          business_id: Number(businessId),
          type: 320,
          description: "Connection Test",
          sum: 0.01,
          currency: "ILS",
          client_name: "Test",
          client_phone: "0500000000",
        }),
        signal: AbortSignal.timeout(10000),
      });

      const data = await res.json();
      if (data.status === 1 || data.payment_url) {
        return { ok: true, message: "✅ Rivhit متصل بنجاح" };
      }

      return {
        ok: false,
        message: data.error_message || `Rivhit error: ${data.error_code || "unknown"}`,
      };
    } catch (error: unknown) {
      return { ok: false, message: `خطأ في الاتصال: ${errMsg(error, "Unknown error")}` };
    }
  },

  email: async (cfg) => {
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
      const apiKey = cfg.api_key;
      const model = cfg.model || "claude-sonnet-4-20250514";
      if (!apiKey) return { ok: false, message: "مفتاح Anthropic API مفقود" };

      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
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

    return { ok: false, message: `مزود غير مدعوم: ${provider}` };
  },
};

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const { type, config } = await req.json();

    if (!type || !config) {
      return apiError("نوع التكامل أو الإعدادات مفقودة", 400);
    }

    const testFn = TESTS[type];
    if (!testFn) {
      return apiError(`لا يوجد اختبار لنوع التكامل: ${type}`, 400);
    }

    const resolved = await resolveIntegrationConfigForRequest(type, config);
    const result = await testFn(resolved.config, resolved.provider);

    return apiSuccess(result);
  } catch (error: unknown) {
    console.error("Integration test error:", error);
    return apiError("فشل في اختبار التكامل", 500);
  }
}
