import { NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/admin/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveLinkedAppUserId } from "@/lib/commissions/ledger";

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
  return apiSuccess(data, undefined, 201);
});

export const DELETE = withAdminAuth(async (req: NextRequest, db: SupabaseClient) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return apiError("id required", 400);

  // Soft delete: set deleted_at instead of hard delete
  const { error } = await db.from("commission_sanctions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error("Sanctions DELETE error:", error);
    return apiError("فشل في حذف العقوبة", 500);
  }
  return apiSuccess({ deleted: true });
});
