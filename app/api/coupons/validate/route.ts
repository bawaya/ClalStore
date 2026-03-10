export const runtime = 'edge';

// =====================================================
// ClalMobile — POST /api/coupons/validate
// Validates a coupon code against the database
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";

const couponAttempts = new Map<string, number[]>();
const COUPON_RATE_LIMIT = 5;
const COUPON_RATE_WINDOW = 60_000;

function checkCouponRateLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = couponAttempts.get(ip) || [];
  const recent = timestamps.filter((t) => now - t < COUPON_RATE_WINDOW);
  couponAttempts.set(ip, recent);
  if (recent.length >= COUPON_RATE_LIMIT) return false;
  recent.push(now);
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("cf-connecting-ip") || "unknown";
    if (!checkCouponRateLimit(ip)) {
      return NextResponse.json({ valid: false, discount: 0, message: "كثرة محاولات — حاول بعد دقيقة" }, { status: 429 });
    }

    const { code, total } = await req.json();

    if (!code || typeof total !== "number") {
      return NextResponse.json({ valid: false, discount: 0, message: "بيانات ناقصة" });
    }

    if (typeof code !== "string" || code.length > 50) {
      return NextResponse.json({ valid: false, discount: 0, message: "كوبون غير صالح" });
    }

    const supabase = createServerSupabase();

    const { data: coupon } = await supabase
      .from("coupons")
      .select("*")
      .eq("code", code.toUpperCase())
      .eq("active", true)
      .single();

    if (!coupon) {
      return NextResponse.json({ valid: false, discount: 0, message: "كوبون غير صالح" });
    }

    // Check expiry
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      return NextResponse.json({ valid: false, discount: 0, message: "كوبون منتهي الصلاحية" });
    }

    // Check max uses
    if (coupon.max_uses > 0 && coupon.used_count >= coupon.max_uses) {
      return NextResponse.json({ valid: false, discount: 0, message: "الكوبون استُنفذ" });
    }

    // Check minimum order
    if (total < coupon.min_order) {
      return NextResponse.json({
        valid: false,
        discount: 0,
        message: `الحد الأدنى للطلب ₪${coupon.min_order}`,
      });
    }

    // Calculate discount
    const discount =
      coupon.type === "percent"
        ? Math.round(total * (coupon.value / 100))
        : Math.min(coupon.value, total);

    const message =
      coupon.type === "percent"
        ? `خصم ${coupon.value}%`
        : `خصم ₪${coupon.value}`;

    return NextResponse.json({ valid: true, discount, message });
  } catch (err) {
    console.error("Coupon validation error:", err);
    return NextResponse.json({ valid: false, discount: 0, message: "خطأ في التحقق" });
  }
}
