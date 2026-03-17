export const runtime = 'nodejs';

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const orderId = req.nextUrl.searchParams.get("orderId")?.trim()?.toUpperCase();
    if (!orderId || !/^CLM-\d{5}$/.test(orderId)) {
      return NextResponse.json({ success: false, error: "رقم طلب غير صالح" }, { status: 400 });
    }

    const supabase = createAdminSupabase();
    if (!supabase) {
      return NextResponse.json({ success: false, error: "خطأ في الاتصال" }, { status: 500 });
    }

    const { data: order, error } = await supabase
      .from("orders")
      .select("id, status, total, created_at, payment_status")
      .eq("id", orderId)
      .single();

    if (error || !order) {
      return NextResponse.json({ success: false, error: "لم يتم العثور على الطلب" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        status: order.status,
        total: order.total,
        created_at: order.created_at,
        payment_status: order.payment_status,
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: "حدث خطأ" }, { status: 500 });
  }
}
