export const runtime = 'edge';

// =====================================================
// ClalMobile — Customer Auth API (OTP via SMS or WhatsApp)
// POST /api/auth/customer
// Actions: send_otp (with channel choice), verify_otp
// Customer chooses: SMS (Twilio Verify) or WhatsApp
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { validatePhone } from "@/lib/validators";

function generateOTP(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

/** Format Israeli phone: 05X → +9725X */
function formatE164(phone: string): string {
  const c = phone.replace(/[-\s+]/g, "");
  if (c.startsWith("972")) return `+${c}`;
  if (c.startsWith("05")) return `+972${c.slice(1)}`;
  if (c.startsWith("5") && c.length === 9) return `+972${c}`;
  return `+${c}`;
}

/** Try to get Twilio config from env vars or direct DB query */
async function getTwilioConfig(): Promise<{
  accountSid: string; authToken: string; verifyServiceSid: string;
} | null> {
  // 1. Check env vars first (most reliable)
  const envSid = process.env.TWILIO_ACCOUNT_SID || "";
  const envToken = process.env.TWILIO_AUTH_TOKEN || "";
  const envVerify = process.env.TWILIO_VERIFY_SERVICE_SID || "";
  if (envSid && envToken && envVerify) {
    return { accountSid: envSid, authToken: envToken, verifyServiceSid: envVerify };
  }
  // 2. Fallback: read from integrations DB (regardless of status)
  try {
    const db = createAdminSupabase();
    if (!db) return null;
    const { data } = await db.from("integrations").select("config").eq("type", "sms").single();
    const cfg = data?.config as any;
    if (cfg?.account_sid && cfg?.auth_token && cfg?.verify_service_sid) {
      return { accountSid: cfg.account_sid, authToken: cfg.auth_token, verifyServiceSid: cfg.verify_service_sid };
    }
  } catch { /* ignore */ }
  return null;
}

/** Send OTP via Twilio Verify API */
async function sendViaTwilioVerify(phone: string, channel: "sms" | "whatsapp"): Promise<boolean> {
  const cfg = await getTwilioConfig();
  if (!cfg) return false;
  try {
    const body = new URLSearchParams({
      To: formatE164(phone),
      Channel: channel,
    });
    const res = await fetch(
      `https://verify.twilio.com/v2/Services/${cfg.verifyServiceSid}/Verifications`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${btoa(`${cfg.accountSid}:${cfg.authToken}`)}`,
        },
        body: body.toString(),
      }
    );
    const data = await res.json();
    console.log(`[OTP] Twilio Verify (${channel}):`, res.ok, data.status);
    return res.ok && data.status === "pending";
  } catch (err) {
    console.error("[OTP] Twilio Verify error:", err);
    return false;
  }
}

/** Check OTP via Twilio Verify API */
async function checkViaTwilioVerify(phone: string, code: string): Promise<boolean> {
  const cfg = await getTwilioConfig();
  if (!cfg) return false;
  try {
    const body = new URLSearchParams({ To: formatE164(phone), Code: code });
    const res = await fetch(
      `https://verify.twilio.com/v2/Services/${cfg.verifyServiceSid}/VerificationCheck`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${btoa(`${cfg.accountSid}:${cfg.authToken}`)}`,
        },
        body: body.toString(),
      }
    );
    const data = await res.json();
    return res.ok && data.status === "approved";
  } catch (err) {
    console.error("[OTP] Twilio Verify check error:", err);
    return false;
  }
}

/** Send OTP via WhatsApp (yCloud) — direct text message */
async function sendViaWhatsApp(phone: string, otpCode: string): Promise<boolean> {
  try {
    const { sendWhatsAppText, sendWhatsAppTemplate } = await import("@/lib/bot/whatsapp");
    const waPhone = phone.startsWith("972") ? phone : "972" + phone.slice(1);
    try {
      await sendWhatsAppText(
        waPhone,
        `🔐 رمز التحقق الخاص بك: *${otpCode}*\n\nصالح لمدة 5 دقائق.\nClalMobile`
      );
      return true;
    } catch {
      // 24h window — try template
      try {
        await sendWhatsAppTemplate(waPhone, "clal_otp_code", [otpCode]);
        return true;
      } catch { return false; }
    }
  } catch { return false; }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, action, otp, channel } = body;

    if (!phone || !validatePhone(phone)) {
      return NextResponse.json({ success: false, error: "رقم هاتف غير صالح" }, { status: 400 });
    }

    const cleanPhone = phone.replace(/[-\s]/g, "");
    const supabase = createAdminSupabase();

    if (!supabase) {
      return NextResponse.json({ success: false, error: "خطأ في إعدادات السيرفر" }, { status: 500 });
    }

    // ===== SEND OTP =====
    if (action === "send_otp") {
      const preferredChannel: "sms" | "whatsapp" = channel === "whatsapp" ? "whatsapp" : "sms";

      // Rate limit: max 1 per phone per minute
      const { data: recent } = await supabase
        .from("customer_otps")
        .select("created_at")
        .eq("phone", cleanPhone)
        .eq("verified", false)
        .gte("created_at", new Date(Date.now() - 60_000).toISOString())
        .limit(1);

      if (recent && recent.length > 0) {
        return NextResponse.json({ success: false, error: "انتظر دقيقة قبل طلب رمز جديد" }, { status: 429 });
      }

      let sentVia: "sms" | "whatsapp" | "none" = "none";
      let usedVerify = false;

      if (preferredChannel === "sms") {
        // ===== SMS: Use Twilio Verify API =====
        const sent = await sendViaTwilioVerify(cleanPhone, "sms");
        if (sent) { sentVia = "sms"; usedVerify = true; }
        else {
          // SMS failed → fallback to WhatsApp
          const otpCode = generateOTP();
          await supabase.from("customer_otps").insert({
            phone: cleanPhone, otp: otpCode,
            expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
          } as any);
          if (await sendViaWhatsApp(cleanPhone, otpCode)) sentVia = "whatsapp";
        }
      } else {
        // ===== WhatsApp: Try Twilio Verify with whatsapp channel first =====
        const sentVerify = await sendViaTwilioVerify(cleanPhone, "whatsapp");
        if (sentVerify) { sentVia = "whatsapp"; usedVerify = true; }
        else {
          // Fallback: direct WhatsApp text message with generated OTP
          const otpCode = generateOTP();
          await supabase.from("customer_otps").insert({
            phone: cleanPhone, otp: otpCode,
            expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
          } as any);
          if (await sendViaWhatsApp(cleanPhone, otpCode)) sentVia = "whatsapp";
        }
      }

      // Store VERIFY marker if Twilio Verify was used
      if (usedVerify) {
        await supabase.from("customer_otps").insert({
          phone: cleanPhone, otp: "VERIFY",
          expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
        } as any);
      }

      return NextResponse.json({
        success: sentVia !== "none",
        channel: sentVia,
        message: sentVia === "sms" ? "تم إرسال رمز التحقق عبر SMS"
          : sentVia === "whatsapp" ? "تم إرسال رمز التحقق عبر واتساب"
          : "فشل إرسال رمز التحقق",
        ...(sentVia === "none" ? { error: "فشل إرسال رمز التحقق — تحقق من الإعدادات" } : {}),
      });
    }

    // ===== VERIFY OTP =====
    if (action === "verify_otp") {
      if (!otp || otp.length !== 4) {
        return NextResponse.json({ success: false, error: "رمز التحقق غير صالح" }, { status: 400 });
      }

      // Cleanup expired
      await supabase.from("customer_otps").delete().lt("expires_at", new Date().toISOString());

      let otpValid = false;

      // Get latest OTP record
      const { data: latestOtp } = await supabase
        .from("customer_otps")
        .select("*")
        .eq("phone", cleanPhone)
        .eq("verified", false)
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (latestOtp && (latestOtp as any).otp === "VERIFY") {
        // Sent via Twilio Verify → check via API
        otpValid = await checkViaTwilioVerify(cleanPhone, otp);
        if (otpValid) {
          await supabase.from("customer_otps").update({ verified: true }).eq("id", latestOtp.id);
        }
      } else if (latestOtp && (latestOtp as any).otp === otp) {
        // Sent via direct WhatsApp → check DB match
        otpValid = true;
        await supabase.from("customer_otps").update({ verified: true }).eq("id", latestOtp.id);
      }

      if (!otpValid) {
        return NextResponse.json({ success: false, error: "رمز التحقق خاطئ أو منتهي الصلاحية" }, { status: 400 });
      }

      // Generate auth token
      const token = generateToken();

      // Upsert customer
      const { data: existingCustomer } = await supabase
        .from("customers")
        .select("*")
        .eq("phone", cleanPhone)
        .single();

      let customer;

      if (existingCustomer) {
        const { data: updated } = await supabase
          .from("customers")
          .update({ auth_token: token, last_login: new Date().toISOString() })
          .eq("id", existingCustomer.id)
          .select("id, name, phone, email, city, address")
          .single();
        customer = updated || existingCustomer;
      } else {
        const { data: newCust } = await supabase
          .from("customers")
          .insert({
            phone: cleanPhone,
            name: "",
            segment: "new",
            auth_token: token,
            last_login: new Date().toISOString(),
          } as any)
          .select("id, name, phone, email, city, address")
          .single();
        customer = newCust;
      }

      return NextResponse.json({
        success: true,
        token,
        customer: {
          id: customer?.id,
          name: customer?.name || "",
          phone: customer?.phone || cleanPhone,
          email: (customer as any)?.email || "",
          city: (customer as any)?.city || "",
          address: (customer as any)?.address || "",
        },
      });
    }

    return NextResponse.json({ success: false, error: "action غير معروف" }, { status: 400 });
  } catch (err: any) {
    console.error("Customer auth error:", err);
    return NextResponse.json({ success: false, error: "خطأ في السيرفر" }, { status: 500 });
  }
}
