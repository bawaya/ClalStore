export const runtime = 'edge';

// =====================================================
// ClalMobile — Integration Test API
// POST: Test integration connection by type
// Validates credentials and optionally pings the provider
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { getIntegrations } from "@/lib/admin/queries";

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

const TESTS: Record<string, (config: Record<string, any>) => Promise<{ ok: boolean; message: string }>> = {
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
      });
      const data = await res.json();
      // Rivhit returns status=1 for success, any response without network error means credentials work
      if (data.status === 1 || data.payment_url) {
        return { ok: true, message: "✅ Rivhit متصل بنجاح" };
      }
      return { ok: false, message: data.error_message || `Rivhit error: ${data.error_code || "unknown"}` };
    } catch (err: any) {
      return { ok: false, message: `خطأ في الاتصال: ${err.message}` };
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
      });
      if (res.ok) return { ok: true, message: "✅ SendGrid متصل بنجاح" };
      if (res.status === 401) return { ok: false, message: "مفتاح API غير صالح" };
      return { ok: false, message: `SendGrid responded with ${res.status}` };
    } catch (err: any) {
      return { ok: false, message: `خطأ في الاتصال: ${err.message}` };
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
      });
      if (res.ok) return { ok: true, message: "✅ yCloud WhatsApp متصل بنجاح" };
      if (res.status === 401) return { ok: false, message: "مفتاح API غير صالح" };
      return { ok: false, message: `yCloud responded with ${res.status}` };
    } catch (err: any) {
      return { ok: false, message: `خطأ في الاتصال: ${err.message}` };
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
    } catch (err: any) {
      return { ok: false, message: `خطأ في الاتصال: ${err.message}` };
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
};

export async function POST(req: NextRequest) {
  try {
    const { type, config } = await req.json();

    if (!type || !config) {
      return NextResponse.json({ ok: false, message: "نوع التكامل أو الإعدادات مفقودة" }, { status: 400 });
    }

    const testFn = TESTS[type];
    if (!testFn) {
      return NextResponse.json({ ok: false, message: `لا يوجد اختبار لنوع التكامل: ${type}` }, { status: 400 });
    }

    // Resolve any masked values from DB before testing
    const resolvedConfig = await resolveConfig(type, config);
    const result = await testFn(resolvedConfig);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
