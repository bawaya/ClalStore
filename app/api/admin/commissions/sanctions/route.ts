import { NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/admin/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveLinkedAppUserId } from "@/lib/commissions/ledger";
import { logEmployeeActivity } from "@/lib/employee/activity-log";

export const GET = withAdminAuth(async (req: NextRequest, db: SupabaseClient) => {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const employeeId = searchParams.get("employee_id");

  let query = db.from("commission_sanctions").select("*").is("deleted_at", null).order("sanction_date", { ascending: false });

  if (from) query = query.gte("sanction_date", from);
  if (to) query = query.lte("sanction_date", to);
  if (employeeId) query = query.eq("employee_id", employeeId);

  const { data, error } = await query;
  if (error) {
    console.error("Sanctions GET error:", error);
    return apiError("فشل في جلب العقوبات", 500);
  }
  return apiSuccess(data || []);
});

export const POST = withAdminAuth(async (req: NextRequest, db: SupabaseClient, user) => {
  const body = await req.json();
  const { sanction_type, sanction_date, amount, has_sale_offset, description, employee_id } = body;

  if (!sanction_type || !sanction_date) return apiError("sanction_type and sanction_date required", 400);

  const resolvedEmployeeId = (await resolveLinkedAppUserId(db, employee_id)) || employee_id || null;

  const { data, error } = await db.from("commission_sanctions").insert({
    user_id: user.appUserId || user.id,
    employee_id: resolvedEmployeeId,
    sanction_type,
    sanction_date,
    amount: amount || 2500,
    has_sale_offset: has_sale_offset || false,
    description: description || null,
  }).select().single();

  if (error) {
    console.error("Sanctions POST error:", error);
    return apiError("فشل في إضافة العقوبة", 500);
  }

  // Activity log (skip contract-level sanctions where no employee is tied)
  if (resolvedEmployeeId) {
    const sanctionAmount = Number(amount || 2500);
    void logEmployeeActivity(db, {
      employeeId: resolvedEmployeeId,
      eventType: "sanction_added",
      title: `عقوبة: ${sanction_type}`,
      description: `${sanctionAmount.toLocaleString("he-IL")}₪${description ? ` — ${description}` : ""}`,
      metadata: {
        sanction_id: (data as { id?: number | string } | null)?.id ?? null,
        sanction_type,
        sanction_date,
        amount: sanctionAmount,
        has_sale_offset: has_sale_offset || false,
      },
    });
  }

  return apiSuccess(data, undefined, 201);
});

export const DELETE = withAdminAuth(async (req: NextRequest, db: SupabaseClient) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return apiError("id required", 400);

  // Snapshot row pre-delete so we can log on the right employee's timeline.
  const { data: existing } = await db
    .from("commission_sanctions")
    .select("id, employee_id, sanction_type, amount, sanction_date")
    .eq("id", id)
    .maybeSingle();

  // Soft delete: set deleted_at instead of hard delete
  const { error } = await db.from("commission_sanctions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error("Sanctions DELETE error:", error);
    return apiError("فشل في حذف العقوبة", 500);
  }

  const employeeId = (existing as { employee_id?: string | null } | null)?.employee_id;
  if (existing && employeeId) {
    const sanctionAmount = Number((existing as { amount?: number | null }).amount || 0);
    const sanctionType = (existing as { sanction_type?: string }).sanction_type;
    void logEmployeeActivity(db, {
      employeeId,
      eventType: "sanction_removed",
      title: "إلغاء عقوبة",
      description: `${sanctionType || ""} — ${sanctionAmount.toLocaleString("he-IL")}₪`,
      metadata: {
        sanction_id: (existing as { id?: number | string }).id ?? null,
        sanction_type: sanctionType ?? null,
        amount: sanctionAmount,
      },
    });
  }

  return apiSuccess({ deleted: true });
});
