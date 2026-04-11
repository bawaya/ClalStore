import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin/auth";
import { apiSuccess, apiError, errMsg } from "@/lib/api-response";

const EDITABLE_FIELDS = [
  "name",
  "email",
  "city",
  "address",
  "id_number",
  "notes",
  "segment",
  "tags",
  "birthday",
] as const;

// GET: fetch customer + HOT accounts summary
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const supabase = createAdminSupabase();
    if (!supabase) return apiError("خطأ في إعدادات السيرفر", 500);

    const { data: customer, error: custErr } = await supabase
      .from("customers")
      .select("*")
      .eq("id", id)
      .single();
    if (custErr || !customer) return apiError("الزبون غير موجود", 404);

    const { data: hotAccounts } = await supabase
      .from("customer_hot_accounts")
      .select("*")
      .eq("customer_id", id)
      .in("status", ["pending", "active", "inactive"])
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true });

    return apiSuccess({ customer, hotAccounts: hotAccounts || [] });
  } catch (err) {
    return apiError(errMsg(err), 500);
  }
}

// PATCH: update customer profile (whitelist only)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const body = await req.json();
    const updates: Record<string, unknown> = {};
    for (const key of EDITABLE_FIELDS) {
      if (key in body) updates[key] = body[key];
    }
    // phone, customer_code, auth_token, total_* NEVER editable here

    if (Object.keys(updates).length === 0) return apiError("لا توجد تغييرات", 400);

    const supabase = createAdminSupabase();
    if (!supabase) return apiError("خطأ في إعدادات السيرفر", 500);

    const { data: before } = await supabase.from("customers").select("*").eq("id", id).single();

    const { data, error } = await supabase
      .from("customers")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();
    if (error) return apiError(errMsg(error), 500);

    // Audit log (reuses existing audit_log table)
    await supabase.from("audit_log").insert({
      user_id: (auth as { id: string }).id,
      user_name: (auth as { email?: string }).email || "admin",
      action: "customer.update",
      entity_type: "customer",
      entity_id: id,
      details: { before, after: data, updates },
    });

    return apiSuccess({ customer: data });
  } catch (err) {
    return apiError(errMsg(err), 500);
  }
}
