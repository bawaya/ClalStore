import { NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/admin/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import type { SupabaseClient } from "@supabase/supabase-js";

export const GET = withAdminAuth(async (req: NextRequest, db: SupabaseClient) => {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const employeeId = searchParams.get("employee_id");

  let query = db.from("commission_sanctions").select("*").order("sanction_date", { ascending: false });

  if (from) query = query.gte("sanction_date", from);
  if (to) query = query.lte("sanction_date", to);
  if (employeeId) query = query.eq("employee_id", employeeId);

  const { data, error } = await query;
  if (error) return apiError(error.message, 500);
  return apiSuccess(data || []);
});

export const POST = withAdminAuth(async (req: NextRequest, db: SupabaseClient, user) => {
  const body = await req.json();
  const { sanction_type, sanction_date, amount, has_sale_offset, description, employee_id } = body;

  if (!sanction_type || !sanction_date) return apiError("sanction_type and sanction_date required", 400);

  const { data, error } = await db.from("commission_sanctions").insert({
    user_id: user.id,
    employee_id: employee_id || null,
    sanction_type,
    sanction_date,
    amount: amount || 2500,
    has_sale_offset: has_sale_offset || false,
    description: description || null,
  }).select().single();

  if (error) return apiError(error.message, 500);
  return apiSuccess(data, undefined, 201);
});

export const DELETE = withAdminAuth(async (req: NextRequest, db: SupabaseClient) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return apiError("id required", 400);

  const { error } = await db.from("commission_sanctions").delete().eq("id", id);
  if (error) return apiError(error.message, 500);
  return apiSuccess({ deleted: true });
});
