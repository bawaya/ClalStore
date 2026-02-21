export const runtime = 'edge';

// =====================================================
// ClalMobile — Customer Auth API (OTP via WhatsApp)
// POST /api/auth/customer
// Actions: send_otp, verify_otp
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

      const otpCode = generateOTP();
      const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString(); // 5 minutes

      // Store OTP
      await supabase.from("customer_otps").insert({
        phone: cleanPhone,
        otp: otpCode,
        expires_at: expiresAt,
      } as any);

      // Send via WhatsApp (using bot phone)
      try {
        const { sendWhatsAppText } = await import("@/lib/bot/whatsapp");
        await sendWhatsAppText(
          cleanPhone.startsWith("972") ? cleanPhone : "972" + cleanPhone.slice(1),
          `🔐 رمز التحقق الخاص بك: *${otpCode}*\n\nصالح لمدة 5 دقائق.\nClalMobile`
        );
      } catch (waErr) {
        console.error("WhatsApp OTP send failed:", waErr);
        // Fallback: still return success so user can see OTP in DB (dev mode)
      }

      return NextResponse.json({ success: true, message: "تم إرسال رمز التحقق عبر واتساب" });
    }

    // ===== VERIFY OTP =====
    if (action === "verify_otp") {
      if (!otp || otp.length !== 4) {
        return NextResponse.json({ success: false, error: "رمز التحقق غير صالح" }, { status: 400 });
      }

      // Cleanup expired
      await supabase.from("customer_otps").delete().lt("expires_at", new Date().toISOString());

      // Find matching OTP
      const { data: otpRecord } = await supabase
        .from("customer_otps")
        .select("*")
        .eq("phone", cleanPhone)
        .eq("otp", otp)
        .eq("verified", false)
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!otpRecord) {
        return NextResponse.json({ success: false, error: "رمز التحقق خاطئ أو منتهي الصلاحية" }, { status: 400 });
      }

      // Mark OTP as verified
      await supabase.from("customer_otps").update({ verified: true }).eq("id", otpRecord.id);

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
