
import { NextRequest, NextResponse } from "next/server";
import { sendWhatsAppText, sendWhatsAppTemplate } from "@/lib/bot/whatsapp";
import { requireAdmin } from "@/lib/admin/auth";
import { apiSuccess, apiError, errMsg } from "@/lib/api-response";
import { getIntegrationConfig } from "@/lib/integrations/hub";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const legacyAuth = req.headers.get("x-admin-key");
    const [webhookCfg, whatsappCfg] = await Promise.all([
      getIntegrationConfig("webhook_security"),
      getIntegrationConfig("whatsapp"),
    ]);
    const verifyToken = String(webhookCfg.verify_token || process.env.WEBHOOK_VERIFY_TOKEN || "").trim();
    if (!verifyToken || legacyAuth !== verifyToken) {
      return apiError("Unauthorized", 401);
    }

    const { to, mode, templateName, templateParams, message } = await req.json();

    if (!to) {
      return apiError("missing 'to' phone number", 400);
    }

    const adminPhone =
      whatsappCfg.admin_phone ||
      process.env.ADMIN_PERSONAL_PHONE ||
      "(not set)";
    const whatsappPhoneId =
      whatsappCfg.phone_id ||
      process.env.WHATSAPP_PHONE_ID ||
      "(not set)";
    const yCloudKey = whatsappCfg.api_key || process.env.YCLOUD_API_KEY ? "set" : "NOT SET";

    const diagnostics = {
      ADMIN_PERSONAL_PHONE: adminPhone.slice(0, 6) + "***",
      WHATSAPP_PHONE_ID: whatsappPhoneId.slice(0, 6) + "***",
      YCLOUD_API_KEY: yCloudKey,
    };

    if (mode === "template") {
      const name = templateName || "clal_admin_alert";
      const params = templateParams || ["Test notification from ClalMobile"];
      const result = await sendWhatsAppTemplate(to, name, params);
      return apiSuccess({ ok: true, mode: "template", templateName: name, result, diagnostics });
    }

    const text = message || "Test message from ClalMobile WhatsApp diagnostic";
    const result = await sendWhatsAppText(to, text);
    return apiSuccess({ ok: true, mode: "text", result, diagnostics });
  } catch (err: unknown) {
    console.error("WhatsApp test error:", err);
    return apiError("فشل في اختبار WhatsApp", 500);
  }
}
