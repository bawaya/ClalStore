import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin/auth";
import { apiSuccess, apiError, errMsg } from "@/lib/api-response";

const EDITABLE = [
  "label",
  "status",
  "is_primary",
  "notes",
  "line_phone",
  "hot_customer_code",
] as const;

// PATCH: update HOT account
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; accountId: string }> }
) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const { id: customerId, accountId } = await params;
    const body = await req.json();
    const updates: Record<string, unknown> = {};
    for (const key of EDITABLE) {
      if (key in body) updates[key] = body[key];
    }
    // hot_mobile_id is NOT editable — if wrong, close via status='cancelled' and re-add

    if (Object.keys(updates).length === 0) return apiError("لا توجد تغييرات", 400);

    const supabase = createAdminSupabase();
    if (!supabase) return apiError("خطأ في إعدادات السيرفر", 500);

    // If closing (cancelled/inactive/transferred), set ended_at
    if (
      typeof updates.status === "string" &&
      ["cancelled", "inactive", "transferred"].includes(updates.status)
    ) {
      updates.ended_at = new Date().toISOString();
    }

    // If setting primary, unset others
    if (updates.is_primary === true) {
      await supabase
        .from("customer_hot_accounts")
        .update({ is_primary: false })
        .eq("customer_id", customerId)
        .eq("is_primary", true)
        .in("status", ["pending", "active"])
        .neq("id", accountId);
    }

    const { data: before } = await supabase
      .from("customer_hot_accounts")
      .select("*")
      .eq("id", accountId)
      .single();

    const { data, error } = await supabase
      .from("customer_hot_accounts")
      .update(updates)
      .eq("id", accountId)
      .eq("customer_id", customerId)
      .select("*")
      .single();
    if (error) return apiError(errMsg(error), 500);

    const adminId = (auth as { id: string }).id;
    const adminName = (auth as { email?: string }).email || "admin";

    await supabase.from("audit_log").insert({
      user_id: adminId,
      user_name: adminName,
      action: "hot_account.update",
      entity_type: "customer_hot_account",
      entity_id: accountId,
      details: { customer_id: customerId, before, after: data, updates },
    });

    return apiSuccess({ hotAccount: data });
  } catch (err) {
    return apiError(errMsg(err), 500);
  }
}

// DELETE: soft-close (not physical delete)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; accountId: string }> }
) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const { id: customerId, accountId } = await params;
    const supabase = createAdminSupabase();
    if (!supabase) return apiError("خطأ في إعدادات السيرفر", 500);

    const { data: before } = await supabase
      .from("customer_hot_accounts")
      .select("*")
      .eq("id", accountId)
      .single();

    // Soft close — preserve historical record
    const { data, error } = await supabase
      .from("customer_hot_accounts")
      .update({
        status: "cancelled",
        is_primary: false,
        ended_at: new Date().toISOString(),
      })
      .eq("id", accountId)
      .eq("customer_id", customerId)
      .select("*")
      .single();
    if (error) return apiError(errMsg(error), 500);

    const adminId = (auth as { id: string }).id;
    const adminName = (auth as { email?: string }).email || "admin";

    await supabase.from("audit_log").insert({
      user_id: adminId,
      user_name: adminName,
      action: "hot_account.cancel",
      entity_type: "customer_hot_account",
      entity_id: accountId,
      details: { customer_id: customerId, before, after: data },
    });

    return apiSuccess({ hotAccount: data });
  } catch (err) {
    return apiError(errMsg(err), 500);
  }
}
