import { NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/admin/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  COMMISSION_CONTRACT_TARGET_KEY,
  getCommissionTarget,
  getCommissionTargetKey,
  resolveLinkedAppUserId,
} from "@/lib/commissions/ledger";
import { logEmployeeActivity } from "@/lib/employee/activity-log";

async function resolveTargetKey(
  db: SupabaseClient,
  params: {
    target_key?: string | null;
    employee_key?: string | null;
    employee_id?: string | null;
  },
) {
  const employeeId =
    (await resolveLinkedAppUserId(db, params.employee_id)) || params.employee_id || null;

  return getCommissionTargetKey({
    targetKey: params.target_key,
    employeeKey: params.employee_key,
    employeeId,
  });
}

export const GET = withAdminAuth(async (req: NextRequest, db: SupabaseClient, user) => {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  if (!month) return apiError("month param required (e.g. 2026-04)", 400);
  const hasScopedTarget =
    Boolean(searchParams.get("target_key")) ||
    Boolean(searchParams.get("employee_key")) ||
    Boolean(searchParams.get("employee_id"));

  const targetKey = await resolveTargetKey(db, {
    target_key: searchParams.get("target_key"),
    employee_key: searchParams.get("employee_key"),
    employee_id: searchParams.get("employee_id"),
  });

  try {
    const preferredKeys = hasScopedTarget
      ? [targetKey]
      : [targetKey, COMMISSION_CONTRACT_TARGET_KEY, user.appUserId || null, user.id];
    const data = await getCommissionTarget(db, month, preferredKeys);
    return apiSuccess(data);
  } catch (error) {
    console.error("Targets GET error:", error);
    return apiError("ÙØ´Ù„ ÙÙŠ Ø¬Ù„Ø¨ Ø§Ù„Ø£Ù‡Ø¯Ø§Ù", 500);
  }
});

export const POST = withAdminAuth(async (req: NextRequest, db: SupabaseClient) => {
  const body = await req.json();
  const {
    month,
    target_lines_amount,
    target_devices_amount,
    target_total,
    target_lines_count,
    target_devices_count,
    target_sales_amount,
    manual_sales_add_on,
  } = body;

  if (!month) return apiError("month required", 400);

  const targetKey = await resolveTargetKey(db, {
    target_key: body.target_key,
    employee_key: body.employee_key,
    employee_id: body.employee_id,
  });

  const { data: existing } = await db
    .from("commission_targets")
    .select("id, is_locked")
    .eq("user_id", targetKey)
    .eq("month", month)
    .maybeSingle();

  if (existing?.is_locked) {
    return apiError("×”×™×¢×“ ×œ×—×•×“×© ×–×” × ×¢×•×œ ×•×œ× × ×™×ª×Ÿ ×œ×¢×¨×™×›×”", 403);
  }

  // Sales-focused fields are optional — only include when caller provided
  // them, so partial updates don't wipe previously-set values.
  // target_sales_amount is nullable by design (empty = no sales target),
  // manual_sales_add_on clamps to 0 since the column is NOT NULL.
  const salesUpdate: Record<string, number | null> = {};
  if (target_sales_amount !== undefined) {
    const parsed = Number(target_sales_amount);
    salesUpdate.target_sales_amount =
      Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  if (manual_sales_add_on !== undefined) {
    const parsed = Number(manual_sales_add_on);
    salesUpdate.manual_sales_add_on =
      Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }

  const { data, error } = await db
    .from("commission_targets")
    .upsert(
      {
        user_id: targetKey,
        month,
        target_lines_amount: target_lines_amount || 0,
        target_devices_amount: target_devices_amount || 0,
        target_total: target_total || 0,
        target_lines_count: target_lines_count || 0,
        target_devices_count: target_devices_count || 0,
        ...salesUpdate,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,month" },
    )
    .select()
    .single();

  if (error) {
    console.error("Targets POST error:", error);
    return apiError("فشل في حفظ الهدف", 500);
  }

  // Activity log — only for employee-scoped targets, skip contract-level.
  if (targetKey && targetKey !== COMMISSION_CONTRACT_TARGET_KEY) {
    const amount = Number(target_total || 0);
    void logEmployeeActivity(db, {
      employeeId: targetKey,
      eventType: existing ? "target_updated" : "target_set",
      title: "هدف شهري",
      description: `${amount.toLocaleString("he-IL")}₪ لشهر ${month}`,
      metadata: {
        target_id: (data as { id?: number | string } | null)?.id ?? null,
        month,
        target_total: amount,
        target_lines_amount: Number(target_lines_amount || 0),
        target_devices_amount: Number(target_devices_amount || 0),
      },
    });
  }

  return apiSuccess(data);
});

export const PATCH = withAdminAuth(async (req: NextRequest, db: SupabaseClient) => {
  const body = await req.json();
  const { month, action } = body;

  if (!month) return apiError("month required", 400);
  if (!action || !["lock", "unlock"].includes(action)) {
    return apiError("action must be 'lock' or 'unlock'", 400);
  }

  const targetKey = await resolveTargetKey(db, {
    target_key: body.target_key,
    employee_key: body.employee_key,
    employee_id: body.employee_id,
  });

  const { data: existing } = await db
    .from("commission_targets")
    .select("id, is_locked")
    .eq("user_id", targetKey)
    .eq("month", month)
    .maybeSingle();

  if (!existing) return apiError("لا يوجد هدف لهذا الشهر", 404);

  const isLocking = action === "lock";

  const { data, error } = await db
    .from("commission_targets")
    .update({
      is_locked: isLocking,
      locked_at: isLocking ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id)
    .select()
    .single();

  if (error) {
    console.error("Targets PATCH error:", error);
    return apiError("فشل في تحديث حالة الهدف", 500);
  }

  // Activity log — only for employee-scoped targets, skip contract-level.
  if (targetKey && targetKey !== COMMISSION_CONTRACT_TARGET_KEY) {
    const amount = Number(
      (data as { target_total?: number | null } | null)?.target_total || 0,
    );
    void logEmployeeActivity(db, {
      employeeId: targetKey,
      eventType: "target_updated",
      title: "هدف شهري",
      description: `${amount.toLocaleString("he-IL")}₪ لشهر ${month} (${isLocking ? "قفل" : "فتح"})`,
      metadata: {
        target_id: existing.id,
        month,
        action,
        is_locked: isLocking,
      },
    });
  }

  return apiSuccess(data);
});
