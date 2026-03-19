export const runtime = "edge";

import { NextResponse } from "next/server";

export async function GET() {
  const log: string[] = [];
  const push = (s: string) => { log.push(`[${new Date().toISOString()}] ${s}`); };

  push("=== START DEBUG NOTIFY ===");

  // 1. Check Supabase connection
  try {
    const { createAdminSupabase } = await import("@/lib/supabase");
    const db = createAdminSupabase();
    if (!db) {
      push("FAIL: createAdminSupabase returned null — missing env vars");
    } else {
      push("OK: Supabase admin client created");

      // 2. Check integrations table
      const { data: waConfig, error: waErr } = await db
        .from("integrations")
        .select("config, status")
        .eq("type", "whatsapp")
        .single();

      if (waErr) {
        push(`FAIL: whatsapp config query error: ${waErr.message}`);
      } else if (!waConfig) {
        push("FAIL: no whatsapp integration row found");
      } else {
        push(`OK: whatsapp integration status=${waConfig.status}`);
        const cfg = waConfig.config as Record<string, any> || {};
        push(`  api_key: ${cfg.api_key ? "SET (" + cfg.api_key.slice(0, 8) + "...)" : "MISSING"}`);
        push(`  phone_id: ${cfg.phone_id || "MISSING"}`);
        push(`  reports_phone_id: ${cfg.reports_phone_id || "MISSING"}`);
        push(`  admin_phone: ${cfg.admin_phone || "MISSING"}`);
        push(`  team_whatsapp_numbers: ${cfg.team_whatsapp_numbers || "MISSING"}`);
      }

      // 3. Check email integration
      const { data: emailConfig, error: emailErr } = await db
        .from("integrations")
        .select("config, status")
        .eq("type", "email")
        .single();

      if (emailErr) {
        push(`FAIL: email config query error: ${emailErr.message}`);
      } else if (!emailConfig) {
        push("FAIL: no email integration row found");
      } else {
        push(`OK: email integration status=${emailConfig.status}`);
        const ecfg = emailConfig.config as Record<string, any> || {};
        push(`  api_key: ${ecfg.api_key ? "SET (" + ecfg.api_key.slice(0, 8) + "...)" : "MISSING"}`);
        push(`  from_email: ${ecfg.from_email || "MISSING"}`);
      }
    }
  } catch (err: any) {
    push(`FAIL: Supabase init error: ${err.message}`);
  }

  // 4. Test getIntegrationConfig
  try {
    const { getIntegrationConfig } = await import("@/lib/integrations/hub");
    const waCfg = await getIntegrationConfig("whatsapp");
    push(`OK: getIntegrationConfig("whatsapp") keys: ${Object.keys(waCfg).join(", ") || "EMPTY"}`);
  } catch (err: any) {
    push(`FAIL: getIntegrationConfig error: ${err.message}`);
  }

  // 5. Test admin-notify import
  try {
    const mod = await import("@/lib/bot/admin-notify");
    push(`OK: admin-notify imported, exports: ${Object.keys(mod).join(", ")}`);
  } catch (err: any) {
    push(`FAIL: admin-notify import error: ${err.message}`);
    push(`  Stack: ${err.stack?.split("\n").slice(0, 3).join(" | ")}`);
  }

  // 6. Test getNotifyTargets by calling notifyAdmin with a test
  try {
    const { getIntegrationConfig } = await import("@/lib/integrations/hub");
    const waCfg = await getIntegrationConfig("whatsapp");
    const reportFromId = waCfg.reports_phone_id || "";
    const adminTo = waCfg.admin_phone || "+972502404412";
    push(`OK: notify targets => FROM=${reportFromId || "(default phone_id)"}, TO=${adminTo}`);
  } catch (err: any) {
    push(`FAIL: notify targets error: ${err.message}`);
  }

  // 7. Actually try sending a WhatsApp test message
  try {
    const { sendWhatsAppText } = await import("@/lib/bot/whatsapp");
    const { getIntegrationConfig } = await import("@/lib/integrations/hub");
    const waCfg = await getIntegrationConfig("whatsapp");
    const to = waCfg.admin_phone || "+972502404412";
    const from = waCfg.reports_phone_id || undefined;
    push(`Attempting WhatsApp text: to=${to}, from=${from || "(default)"}`);

    const res = await sendWhatsAppText(to, "🔧 DEBUG: اختبار إشعارات الأدمن — إذا وصلتك هذه الرسالة فالنظام يعمل!", from);
    push(`WhatsApp result: ${JSON.stringify(res).slice(0, 500)}`);
  } catch (err: any) {
    push(`FAIL: WhatsApp send error: ${err.message}`);
  }

  // 8. Try sending a test email
  try {
    const { getProvider } = await import("@/lib/integrations/hub");
    const email = await getProvider<any>("email");
    if (!email) {
      push("SKIP: no email provider initialized");
    } else {
      push(`OK: email provider = ${email.name}`);
      const { getIntegrationConfig } = await import("@/lib/integrations/hub");
      const waCfg = await getIntegrationConfig("whatsapp");
      const to = waCfg.reports_email || waCfg.completed_orders_email || "bawaya@icloud.com";
      push(`Attempting email to: ${to}`);
      const result = await email.send({
        to,
        subject: "🔧 DEBUG: اختبار إشعارات الأدمن",
        html: "<p dir='rtl'>إذا وصلك هذا الإيميل فنظام الإشعارات يعمل بشكل صحيح.</p>",
      });
      push(`Email result: ${JSON.stringify(result)}`);
    }
  } catch (err: any) {
    push(`FAIL: email send error: ${err.message}`);
  }

  // 9. Full notifyAdminNewOrder test
  try {
    const { notifyAdminNewOrder } = await import("@/lib/bot/admin-notify");
    push("Calling notifyAdminNewOrder with test data...");
    await notifyAdminNewOrder({
      orderId: "DEBUG-001",
      customerName: "اختبار نظام",
      customerPhone: "0501234567",
      total: 99,
      source: "debug_test",
      items: [{ name: "منتج اختبار", qty: 1, price: 99 }],
    });
    push("OK: notifyAdminNewOrder completed without error");
  } catch (err: any) {
    push(`FAIL: notifyAdminNewOrder error: ${err.message}`);
    push(`  Stack: ${err.stack?.split("\n").slice(0, 5).join(" | ")}`);
  }

  push("=== END DEBUG NOTIFY ===");

  return NextResponse.json({ log }, { headers: { "Cache-Control": "no-store" } });
}
