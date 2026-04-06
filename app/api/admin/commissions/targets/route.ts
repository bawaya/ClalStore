import { NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/admin/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import type { SupabaseClient } from "@supabase/supabase-js";

export const GET = withAdminAuth(async (req: NextRequest, db: SupabaseClient) => {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  if (!month) return apiError("month param required (e.g. 2026-04)", 400);

  const { data, error } = await db
    .from("commission_targets")
    .select("*")
    .eq("month", month)
    .maybeSingle();

  if (error) return apiError(error.message, 500);
  return apiSuccess(data);
});

export const POST = withAdminAuth(async (req: NextRequest, db: SupabaseClient, user) => {
  const body = await req.json();
  const { month, target_lines_amount, target_devices_amount, target_total, target_lines_count, target_devices_count } = body;

  if (!month) return apiError("month required", 400);

  // Check if target exists and is locked
  const { data: existing } = await db
    .from("commission_targets")
    .select("id, is_locked")
    .eq("user_id", user.id)
    .eq("month", month)
    .maybeSingle();

  if (existing?.is_locked) {
    return apiError("היעד לחודש זה נעול ולא ניתן לעריכה", 403);
  }

  const { data, error } = await db
    .from("commission_targets")
    .upsert(
      {
        user_id: user.id,
        month,
        target_lines_amount: target_lines_amount || 0,
        target_devices_amount: target_devices_amount || 0,
        target_total: target_total || 0,
        target_lines_count: target_lines_count || 0,
        target_devices_count: target_devices_count || 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,month" }
    )
    .select()
    .single();

  if (error) return apiError(error.message, 500);
  return apiSuccess(data);
});

// PATCH — Lock/Unlock target
export const PATCH = withAdminAuth(async (req: NextRequest, db: SupabaseClient, user) => {
  const body = await req.json();
  const { month, action } = body;

  if (!month) return apiError("month required", 400);
  if (!action || !["lock", "unlock"].includes(action)) return apiError("action must be 'lock' or 'unlock'", 400);

  const { data: existing } = await db
    .from("commission_targets")
    .select("id, is_locked")
    .eq("user_id", user.id)
    .eq("month", month)
    .maybeSingle();

  if (!existing) return apiError("לא קיים יעד לחודש זה", 404);

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

  if (error) return apiError(error.message, 500);
  return apiSuccess(data);
});
