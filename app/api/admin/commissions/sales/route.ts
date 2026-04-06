import { NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/admin/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { calcLineCommission, calcDeviceCommission, calcDualCommission, type EmployeeProfile } from "@/lib/commissions/calculator";
import type { SupabaseClient } from "@supabase/supabase-js";

async function getEmployeeProfile(db: SupabaseClient, employeeId: string): Promise<EmployeeProfile | null> {
  const { data } = await db
    .from("employee_commission_profiles")
    .select("line_multiplier, device_rate, device_milestone_bonus, min_package_price, loyalty_bonuses")
    .eq("user_id", employeeId)
    .eq("active", true)
    .maybeSingle();
  return data as EmployeeProfile | null;
}

export const GET = withAdminAuth(async (req: NextRequest, db: SupabaseClient) => {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const source = searchParams.get("source");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const employeeId = searchParams.get("employee_id");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = (page - 1) * limit;

  let query = db.from("commission_sales").select("*", { count: "exact" });

  if (type) query = query.eq("sale_type", type);
  if (source) query = query.eq("source", source);
  if (from) query = query.gte("sale_date", from);
  if (to) query = query.lte("sale_date", to);
  if (employeeId) query = query.eq("employee_id", employeeId);

  query = query.order("sale_date", { ascending: false }).range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) return apiError(error.message, 500);

  return apiSuccess({ sales: data || [], total: count || 0, page, limit });
});

export const POST = withAdminAuth(async (req: NextRequest, db: SupabaseClient) => {
  const body = await req.json();
  const { sale_type, sale_date, customer_name, customer_phone, package_price, has_valid_hk, device_name, device_sale_amount, notes, employee_id } = body;

  if (!sale_type || !sale_date) return apiError("sale_type and sale_date required", 400);

  const value = sale_type === "line" ? package_price : device_sale_amount;
  if (!value) return apiError(`${sale_type === "line" ? "package_price" : "device_sale_amount"} required`, 400);
  if (sale_type !== "line" && sale_type !== "device") return apiError("sale_type must be 'line' or 'device'", 400);

  // Get employee profile if employee_id provided
  const profile = employee_id ? await getEmployeeProfile(db, employee_id) : null;

  const { contractCommission, employeeCommission } = calcDualCommission(
    sale_type,
    value,
    has_valid_hk !== false,
    profile,
  );

  const { data, error } = await db.from("commission_sales").insert({
    sale_type,
    sale_date,
    source: "manual",
    employee_id: employee_id || null,
    customer_name: customer_name || null,
    customer_phone: customer_phone || null,
    package_price: sale_type === "line" ? package_price : 0,
    has_valid_hk: sale_type === "line" ? (has_valid_hk !== false) : true,
    device_name: sale_type === "device" ? (device_name || null) : null,
    device_sale_amount: sale_type === "device" ? device_sale_amount : 0,
    commission_amount: employee_id ? employeeCommission : contractCommission,
    contract_commission: contractCommission,
    notes: notes || null,
    loyalty_status: sale_type === "line" ? "pending" : "pending",
    loyalty_start_date: sale_type === "line" ? sale_date : null,
  }).select().single();

  if (error) return apiError(error.message, 500);
  return apiSuccess(data, undefined, 201);
});

export const PUT = withAdminAuth(async (req: NextRequest, db: SupabaseClient) => {
  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) return apiError("id required", 400);

  // Recalculate commissions if relevant fields changed
  if (updates.package_price !== undefined || updates.has_valid_hk !== undefined || updates.device_sale_amount !== undefined || updates.employee_id !== undefined) {
    const { data: existing } = await db.from("commission_sales")
      .select("sale_type, package_price, has_valid_hk, device_sale_amount, employee_id")
      .eq("id", id).single();

    if (existing) {
      const saleType = existing.sale_type as "line" | "device";
      const empId = updates.employee_id ?? existing.employee_id;
      const profile = empId ? await getEmployeeProfile(db, empId) : null;

      if (saleType === "line") {
        const price = updates.package_price ?? existing.package_price;
        const hk = updates.has_valid_hk ?? existing.has_valid_hk;
        const dual = calcDualCommission("line", price, hk, profile);
        updates.commission_amount = empId ? dual.employeeCommission : dual.contractCommission;
        updates.contract_commission = dual.contractCommission;
      } else {
        const amount = updates.device_sale_amount ?? existing.device_sale_amount;
        const dual = calcDualCommission("device", amount, true, profile);
        updates.commission_amount = empId ? dual.employeeCommission : dual.contractCommission;
        updates.contract_commission = dual.contractCommission;
      }
    }
  }

  updates.updated_at = new Date().toISOString();

  const { data, error } = await db.from("commission_sales").update(updates).eq("id", id).select().single();
  if (error) return apiError(error.message, 500);
  return apiSuccess(data);
});

export const DELETE = withAdminAuth(async (req: NextRequest, db: SupabaseClient) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return apiError("id required", 400);

  const { error } = await db.from("commission_sales").delete().eq("id", id);
  if (error) return apiError(error.message, 500);
  return apiSuccess({ deleted: true });
});
