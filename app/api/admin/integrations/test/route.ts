export const runtime = 'edge';

// =====================================================
// ClalMobile — Integration Test API
// POST: Test integration connection by type
// Validates credentials and optionally pings the provider
// =====================================================

import { NextRequest, NextResponse } from "next/server";

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

  // ===== SMS =====
  sms: async (cfg) => {
    if (!cfg.api_key) return { ok: false, message: "مفتاح API مفقود" };
    return { ok: true, message: "✅ بيانات SMS محفوظة (لم يتم اختبار الاتصال)" };
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

    const result = await testFn(config);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
