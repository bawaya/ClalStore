
import { NextRequest } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const orderId = req.nextUrl.searchParams.get("orderId")?.trim()?.toUpperCase();
    if (!orderId || !/^CLM-\d{5}$/.test(orderId)) {
      return apiError("رقم طلب غير صالح", 400);
    }

    const supabase = createAdminSupabase();
    if (!supabase) {
      return apiError("خطأ في الاتصال", 500);
    }

    const { data: order, error } = await supabase
      .from("orders")
      .select("id, status, total, created_at, payment_status")
      .eq("id", orderId)
      .single();

    if (error || !order) {
      return apiError("لم يتم العثور على الطلب", 404);
    }

    return apiSuccess({
      order: {
        id: order.id,
        status: order.status,
        total: order.total,
        created_at: order.created_at,
        payment_status: order.payment_status,
      },
    });
  } catch {
    return apiError("حدث خطأ", 500);
  }
}
