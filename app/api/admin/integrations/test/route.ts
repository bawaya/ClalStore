// =====================================================
// ClalMobile — Integration Test API
// POST: Test integration connection by type
// Validates credentials and optionally pings the provider
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { getIntegrations } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/admin/auth";
import { apiSuccess, apiError, errMsg } from "@/lib/api-response";

const MASK = "••••••••";

/** Resolve masked config values by merging with DB-stored values */
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

async function getExistingIntegration(type: string) {
  const integrations = await getIntegrations();
  return integrations.find((i: any) => i.type === type) || null;
}

const TESTS: Record<
  string,
  (config: Record<string, any>, provider?: string) => Promise<{ ok: boolean; message: string }>
> = {
  // ===== Payment — Rivhit =====
  payment: async (cfg) => {
    const apiKey = cfg.api_key;
    const businessId = cfg.business_id;
    if (!apiKey || !businessId) return { ok: false, message: "مفتاح API أو معرف العمل مفقود" };

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
      // Rivhit returns status=1 for success, any response without network error means credentials work
      if (data.status === 1 || data.payment_url) {
        return { ok: true, message: "✅ Rivhit متصل بنجاح" };
      }
      return { ok: false, message: data.error_message || `Rivhit error: ${data.error_code || "unknown"}` };
    } catch (err: unknown) {
      return { ok: false, message: `خطأ في الاتصال: ${errMsg(err, "Unknown error")}` };
    }
  },

  // ===== Email — SendGrid =====
  email: async (cfg) => {
    const apiKey = cfg.api_key;
    if (!apiKey) return { ok: false, message: "مفتاح SendGrid API مفقود" };

    try {
      // Light validate: check API key by fetching user profile
      const res = await fetch("https://api.sendgrid.com/v3/user/profile", {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) return { ok: true, message: "✅ SendGrid متصل بنجاح" };
      if (res.status === 401) return { ok: false, message: "مفتاح API غير صالح" };
      return { ok: false, message: `SendGrid responded with ${res.status}` };
    } catch (err: unknown) {
      return { ok: false, message: `خطأ في الاتصال: ${errMsg(err, "Unknown error")}` };
    }
  },

  // ===== WhatsApp — yCloud =====
  whatsapp: async (cfg) => {
    const apiKey = cfg.api_key;
    if (!apiKey) return { ok: false, message: "مفتاح yCloud API مفقود" };

    try {
      // Light validate: list WhatsApp phone numbers
      const res = await fetch("https://api.ycloud.com/v2/whatsapp/phoneNumbers?limit=1", {
        headers: { "X-API-Key": apiKey },
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) return { ok: true, message: "✅ yCloud WhatsApp متصل بنجاح" };
      if (res.status === 401) return { ok: false, message: "مفتاح API غير صالح" };
      return { ok: false, message: `yCloud responded with ${res.status}` };
    } catch (err: unknown) {
      return { ok: false, message: `خطأ في الاتصال: ${errMsg(err, "Unknown error")}` };
    }
  },

  // ===== SMS — Twilio =====
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
      return { ok: false, message: "Verify Service SID أو From Number أو Messaging Service SID مطلوب" };
    }

    try {
      // Validate credentials by fetching account info
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, {
        headers: {
          Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        },
        signal: AbortSignal.timeout(10000),
      });

      if (res.ok) {
        const data = await res.json();
        const status = data.status; // active, suspended, closed
        if (status === "active") {
          return { ok: true, message: `✅ Twilio SMS متصل بنجاح — الحساب: ${data.friendly_name || accountSid}` };
        }
        return { ok: false, message: `حساب Twilio غير نشط (${status})` };
      }
      if (res.status === 401) {
        return { ok: false, message: "❌ Account SID أو Auth Token غير صحيح" };
      }
      return { ok: false, message: `Twilio responded with ${res.status}` };
    } catch (err: unknown) {
      return { ok: false, message: `خطأ في الاتصال: ${errMsg(err, "Unknown error")}` };
    }
  },

  // ===== Shipping =====
  shipping: async (cfg) => {
    if (!cfg.api_key) return { ok: false, message: "مفتاح API مفقود" };
    return { ok: true, message: "✅ بيانات الشحن محفوظة (لم يتم اختبار الاتصال)" };
  },

  // ===== Analytics =====
  analytics: async (cfg) => {
    if (!cfg.tracking_id && !cfg.api_key) return { ok: false, message: "معرف التتبع مفقود" };
    return { ok: true, message: "✅ بيانات التحليلات محفوظة" };
  },
  // ===== AI =====
  ai_chat: async (cfg, provider) => {
    if (!provider) {
      return { ok: false, message: "Ø§Ø®ØªØ± Ù…Ø²ÙˆØ¯ Ø§Ù„Ø°ÙƒØ§Ø¡ Ø£ÙˆÙ„Ø§Ù‹" };
    }

    if (provider === "Google Gemini") {
      const apiKey = cfg.api_key;
      const model = cfg.model || "gemini-1.5-flash-latest";
      if (!apiKey) return { ok: false, message: "Ù…ÙØªØ§Ø­ Google Gemini API Ù…ÙÙ‚ÙˆØ¯" };

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

        if (res.ok) return { ok: true, message: "âœ… Google Gemini Ù…ØªØµÙ„ Ø¨Ù†Ø¬Ø§Ø­" };
        if (res.status === 400 || res.status === 401 || res.status === 403) {
          const text = await res.text().catch(() => "");
          return { ok: false, message: text || "Ù…ÙØªØ§Ø­ Gemini Ø£Ùˆ Ø§Ù„Ù†Ù…ÙˆØ°Ø¬ ØºÙŠØ± ØµØ­ÙŠØ­" };
        }
        return { ok: false, message: `Gemini responded with ${res.status}` };
      } catch (err: unknown) {
        return { ok: false, message: `Ø®Ø·Ø£ ÙÙŠ Ø§Ù„Ø§ØªØµØ§Ù„: ${errMsg(err, "Unknown error")}` };
      }
    }

    if (provider === "Anthropic Claude") {
      const apiKey = cfg.api_key;
      const model = cfg.model || "claude-sonnet-4-20250514";
      if (!apiKey) return { ok: false, message: "Ù…ÙØªØ§Ø­ Anthropic API Ù…ÙÙ‚ÙˆØ¯" };

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

        if (res.ok) return { ok: true, message: "âœ… Anthropic Claude Ù…ØªØµÙ„ Ø¨Ù†Ø¬Ø§Ø­" };
        if (res.status === 400 || res.status === 401 || res.status === 403) {
          const text = await res.text().catch(() => "");
          return { ok: false, message: text || "Ù…ÙØªØ§Ø­ Claude Ø£Ùˆ Ø§Ù„Ù†Ù…ÙˆØ°Ø¬ ØºÙŠØ± ØµØ­ÙŠØ­" };
        }
        return { ok: false, message: `Anthropic responded with ${res.status}` };
      } catch (err: unknown) {
        return { ok: false, message: `Ø®Ø·Ø£ ÙÙŠ Ø§Ù„Ø§ØªØµØ§Ù„: ${errMsg(err, "Unknown error")}` };
      }
    }

    return { ok: false, message: `Ù…Ø²ÙˆØ¯ ØºÙŠØ± Ù…Ø¯Ø¹ÙˆÙ…: ${provider}` };
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

    const existing = await getExistingIntegration(type);
    const provider = existing?.provider || "";
    const resolvedConfig = await resolveConfig(type, config);
    const result = await testFn(resolvedConfig, provider);
    return apiSuccess(result);
  } catch (err: unknown) {
    console.error("Integration test error:", err);
    return apiError("فشل في اختبار التكامل", 500);
  }
}
