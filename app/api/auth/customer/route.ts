export const runtime = 'edge';

// =====================================================
// ClalMobile — Customer Auth API (OTP via SMS + WhatsApp)
// POST /api/auth/customer
// Actions: send_otp, verify_otp
// SMS (Twilio) = primary channel, WhatsApp = fallback
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, action, otp } = body;

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
      // Rate limit: max 1 OTP per phone per minute
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

      // ===== Priority 1: Twilio Verify API (auto-generates + sends OTP) =====
      try {
        const { startTwilioVerification, isTwilioVerifyConfigured } = await import("@/lib/integrations/twilio-sms");
        const verifyReady = await isTwilioVerifyConfigured();
        console.log("[OTP] Twilio Verify configured:", verifyReady);
        if (verifyReady) {
          const verifyResult = await startTwilioVerification(cleanPhone, "sms");
          console.log("[OTP] Twilio Verify result:", verifyResult);
          if (verifyResult.success) {
            sentVia = "sms";
            usedVerify = true;
          } else {
            console.error("[OTP] Twilio Verify failed:", verifyResult.error);
          }
        }
      } catch (verifyErr) {
        console.error("[OTP] Twilio Verify exception:", verifyErr);
      }

      // ===== Priority 2: Raw SMS via Twilio Messages API =====
      if (sentVia === "none") {
        const otpCode = generateOTP();
        const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();

        const { error: insertErr } = await supabase.from("customer_otps").insert({
          phone: cleanPhone,
          otp: otpCode,
          expires_at: expiresAt,
        } as any);

        if (insertErr) {
          console.error("OTP insert failed:", insertErr);
          return NextResponse.json({
            success: false,
            error: `فشل حفظ رمز التحقق: ${insertErr.message || insertErr.code || "unknown"}`,
          }, { status: 500 });
        }

        try {
          const { sendSMSOtp, isTwilioConfigured } = await import("@/lib/integrations/twilio-sms");
          if (await isTwilioConfigured()) {
            const smsResult = await sendSMSOtp(cleanPhone, otpCode);
            if (smsResult.success) sentVia = "sms";
            else console.error("SMS OTP failed:", smsResult.error);
          }
        } catch (smsErr) {
          console.error("SMS OTP exception:", smsErr);
        }

        // ===== Priority 3: WhatsApp fallback =====
        if (sentVia === "none") {
          try {
            const { sendWhatsAppText } = await import("@/lib/bot/whatsapp");
            await sendWhatsAppText(
              cleanPhone.startsWith("972") ? cleanPhone : "972" + cleanPhone.slice(1),
              `🔐 رمز التحقق الخاص بك: *${otpCode}*\n\nصالح لمدة 5 دقائق.\nClalMobile`
            );
            sentVia = "whatsapp";
          } catch (waErr) {
            console.error("WhatsApp OTP send failed:", waErr);
          }
        }
      }

      // If Verify was used, store a marker so verify_otp knows to use Verify API
      if (usedVerify) {
        await supabase.from("customer_otps").insert({
          phone: cleanPhone,
          otp: "VERIFY",
          expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
        } as any);
      }

      const channelLabel = sentVia === "sms" ? "SMS" : sentVia === "whatsapp" ? "واتساب" : "";
      return NextResponse.json({
        success: true,
        channel: sentVia,
        message: sentVia !== "none"
          ? `تم إرسال رمز التحقق عبر ${channelLabel}`
          : "تم حفظ الرمز (تحقق من الإعدادات)",
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

      // Check if latest OTP was sent via Twilio Verify
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
        // Verify via Twilio Verify API
        try {
          const { checkTwilioVerification } = await import("@/lib/integrations/twilio-sms");
          const result = await checkTwilioVerification(cleanPhone, otp);
          if (result.success) {
            otpValid = true;
            await supabase.from("customer_otps").update({ verified: true }).eq("id", latestOtp.id);
          }
        } catch (err) {
          console.error("Twilio Verify check error:", err);
        }
      } else if (latestOtp && (latestOtp as any).otp === otp) {
        // Verify via DB match
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
