import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin/auth";
import { apiSuccess, apiError, errMsg } from "@/lib/api-response";

// POST: add HOT account for a customer
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const { id: customerId } = await params;
    const body = await req.json();
    const {
      hot_mobile_id,
      hot_customer_code,
      line_phone,
      label,
      is_primary,
      status,
      notes,
      source_order_id,
    } = body || {};

    if (!hot_mobile_id || typeof hot_mobile_id !== "string" || !hot_mobile_id.trim()) {
      return apiError("رقم HOT Mobile مطلوب", 400);
    }

    const supabase = createAdminSupabase();
    if (!supabase) return apiError("خطأ في إعدادات السيرفر", 500);

    // If setting primary, unset existing primary active for this customer
    if (is_primary) {
      await supabase
        .from("customer_hot_accounts")
        .update({ is_primary: false })
        .eq("customer_id", customerId)
        .eq("is_primary", true)
        .in("status", ["pending", "active"]);
    }

    const adminId = (auth as { id: string }).id;
    const adminName = (auth as { email?: string }).email || "admin";

    const { data, error } = await supabase
      .from("customer_hot_accounts")
      .insert({
        customer_id: customerId,
        hot_mobile_id: hot_mobile_id.trim(),
        hot_customer_code: hot_customer_code?.trim() || null,
        line_phone: line_phone?.trim() || null,
        label: label || null,
        is_primary: !!is_primary,
        status: status || "active",
        source: "admin_manual",
        source_order_id: source_order_id || null,
        notes: notes || null,
        created_by_id: adminId,
        created_by_name: adminName,
        verified_at: new Date().toISOString(),
        verified_by_id: adminId,
        verified_by_name: adminName,
      })
      .select("*")
      .single();

    if (error) {
      if ((error as { code?: string }).code === "23505") {
        return apiError("رقم HOT Mobile مستخدم لحساب نشط آخر", 409);
      }
      return apiError(errMsg(error), 500);
    }

    await supabase.from("audit_log").insert({
      user_id: adminId,
      user_name: adminName,
      action: "hot_account.create",
      entity_type: "customer_hot_account",
      entity_id: data.id,
      details: {
        customer_id: customerId,
        hot_mobile_id: data.hot_mobile_id,
        is_primary: data.is_primary,
      },
    });

    return apiSuccess({ hotAccount: data });
  } catch (err) {
    return apiError(errMsg(err), 500);
  }
}
