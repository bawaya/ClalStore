
// =====================================================
// ClalMobile — Customer Auth API (OTP via SMS or WhatsApp)
// POST /api/auth/customer
// Actions: send_otp (with channel choice), verify_otp
// Customer chooses: SMS (Twilio Verify) or WhatsApp
// =====================================================

import { NextRequest } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { validatePhone } from "@/lib/validators";
import { apiSuccess, apiError } from "@/lib/api-response";
import { hashSHA256 } from "@/lib/crypto";

function generateOTP(): string {
  const bytes = new Uint8Array(2);
  crypto.getRandomValues(bytes);
  const num = 1000 + ((bytes[0] << 8 | bytes[1]) % 9000);
  return num.toString();
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
    // OTP send result checked
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
      return apiError("رقم هاتف غير صالح", 400);
    }

    const cleanPhone = phone.replace(/[-\s]/g, "");
    const supabase = createAdminSupabase();

    if (!supabase) {
      return apiError("خطأ في إعدادات السيرفر", 500);
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
        return apiError("انتظر دقيقة قبل طلب رمز جديد", 429);
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
          const { error: otpErr } = await supabase.from("customer_otps").insert({
            phone: cleanPhone, otp: await hashSHA256(otpCode),
            expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
          } as any);
          if (otpErr) console.error("OTP insert error:", otpErr.message);
          if (await sendViaWhatsApp(cleanPhone, otpCode)) sentVia = "whatsapp";
        }
      } else {
        // ===== WhatsApp: Try Twilio Verify with whatsapp channel first =====
        const sentVerify = await sendViaTwilioVerify(cleanPhone, "whatsapp");
        if (sentVerify) { sentVia = "whatsapp"; usedVerify = true; }
        else {
          // Fallback: direct WhatsApp text message with generated OTP
          const otpCode = generateOTP();
          const { error: otpErr } = await supabase.from("customer_otps").insert({
            phone: cleanPhone, otp: await hashSHA256(otpCode),
            expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
          } as any);
          if (otpErr) console.error("OTP insert error:", otpErr.message);
          if (await sendViaWhatsApp(cleanPhone, otpCode)) sentVia = "whatsapp";
        }
      }

      // Store VERIFY marker if Twilio Verify was used
      if (usedVerify) {
        const { error: verifyErr } = await supabase.from("customer_otps").insert({
          phone: cleanPhone, otp: "VERIFY",
          expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
        } as any);
        if (verifyErr) console.error("Verify marker insert error:", verifyErr.message);
      }

      if (sentVia === "none") {
        return apiError("فشل إرسال رمز التحقق — تحقق من الإعدادات", 500);
      }
      return apiSuccess({
        channel: sentVia,
        message: sentVia === "sms" ? "تم إرسال رمز التحقق عبر SMS"
          : "تم إرسال رمز التحقق عبر واتساب",
      });
    }

    // ===== VERIFY OTP =====
    if (action === "verify_otp") {
      if (!otp || otp.length !== 4) {
        return apiError("رمز التحقق غير صالح", 400);
      }

      // Brute-force protection: max 5 attempts per phone per 15 minutes
      const { data: attempts } = await supabase
        .from("customer_otps")
        .select("id")
        .eq("phone", cleanPhone)
        .eq("verified", false)
        .gte("created_at", new Date(Date.now() - 15 * 60_000).toISOString());

      if (attempts && attempts.length >= 5) {
        return apiError("محاولات كثيرة — حاول بعد 15 دقيقة", 429);
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
      } else if (latestOtp && (latestOtp as any).otp === await hashSHA256(otp)) {
        // Sent via direct WhatsApp → check DB match
        otpValid = true;
        await supabase.from("customer_otps").update({ verified: true }).eq("id", latestOtp.id);
      }

      if (!otpValid) {
        return apiError("رمز التحقق خاطئ أو منتهي الصلاحية", 400);
      }

      // Generate auth token with expiration
      const token = generateToken();
      const hashedToken = await hashSHA256(token);
      const tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString();

      // Upsert customer
      const { data: existingCustomer } = await supabase
        .from("customers")
        .select("*")
        .eq("phone", cleanPhone)
        .maybeSingle();

      let customer;

      if (existingCustomer) {
        const { data: updated } = await supabase
          .from("customers")
          .update({
            auth_token: hashedToken,
            auth_token_expires_at: tokenExpiresAt,
            last_login: new Date().toISOString(),
          })
          .eq("id", existingCustomer.id)
          .select("id, name, phone, email, city, address, customer_code")
          .single();
        customer = updated || existingCustomer;
      } else {
        const { data: newCust } = await supabase
          .from("customers")
          .insert({
            phone: cleanPhone,
            name: "",
            segment: "new",
            auth_token: hashedToken,
            auth_token_expires_at: tokenExpiresAt,
            last_login: new Date().toISOString(),
          } as any)
          .select("id, name, phone, email, city, address, customer_code")
          .single();
        customer = newCust;
      }

      return apiSuccess({
        token,
        customer: {
          id: customer?.id,
          name: customer?.name || "",
          phone: customer?.phone || cleanPhone,
          email: (customer as any)?.email || "",
          city: (customer as any)?.city || "",
          address: (customer as any)?.address || "",
          customer_code: (customer as any)?.customer_code || "",
        },
      });
    }

    return apiError("action غير معروف", 400);
  } catch (err: unknown) {
    console.error("Customer auth error:", err);
    return apiError("خطأ في السيرفر", 500);
  }
}
