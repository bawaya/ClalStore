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

// Identity matching for manual / CSV sales entries
// Priority: hot_mobile_id (via customer_hot_accounts) → customer_phone → unmatched
async function matchSaleIdentity(
  db: SupabaseClient,
  input: { hot_mobile_id?: string | null; customer_phone?: string | null },
): Promise<{
  customer_id: string | null;
  customer_hot_account_id: string | null;
  hot_mobile_id_snapshot: string | null;
  store_customer_code_snapshot: string | null;
  match_status: "matched" | "ambiguous" | "unmatched" | "manual";
  match_method: string | null;
  match_confidence: number | null;
}> {
  const empty = {
    customer_id: null,
    customer_hot_account_id: null,
    hot_mobile_id_snapshot: input.hot_mobile_id?.trim() || null,
    store_customer_code_snapshot: null,
    match_status: "unmatched" as const,
    match_method: null,
    match_confidence: null,
  };

  // 1. Try HOT mobile id
  const hotId = input.hot_mobile_id?.trim();
  if (hotId) {
    const { data: hotRows } = await db
      .from("customer_hot_accounts")
      .select("id, customer_id, hot_mobile_id")
      .eq("hot_mobile_id", hotId)
      .in("status", ["pending", "active", "inactive"])
      .limit(5);
    const rows = hotRows || [];
    if (rows.length === 1) {
      const hit = rows[0];
      const { data: cust } = await db
        .from("customers")
        .select("customer_code")
        .eq("id", hit.customer_id)
        .maybeSingle();
      return {
        customer_id: hit.customer_id,
        customer_hot_account_id: hit.id,
        hot_mobile_id_snapshot: hit.hot_mobile_id,
        store_customer_code_snapshot: cust?.customer_code || null,
        match_status: "matched",
        match_method: "hot_mobile_id",
        match_confidence: 1.0,
      };
    }
    if (rows.length > 1) {
      return { ...empty, match_status: "ambiguous", match_method: "hot_mobile_id" };
    }
  }

  // 2. Fall back to phone
  const phone = input.customer_phone?.trim();
  if (phone) {
    const cleanPhone = phone.replace(/[\s\-.]/g, "");
    const { data: customers } = await db
      .from("customers")
      .select("id, customer_code")
      .eq("phone", cleanPhone)
      .limit(5);
    const rows = customers || [];
    if (rows.length === 1) {
      return {
        ...empty,
        customer_id: rows[0].id,
        store_customer_code_snapshot: rows[0].customer_code || null,
        match_status: "matched",
        match_method: "phone",
        match_confidence: 0.9,
      };
    }
    if (rows.length > 1) {
      return { ...empty, match_status: "ambiguous", match_method: "phone" };
    }
  }

  return empty;
}

export const POST = withAdminAuth(async (req: NextRequest, db: SupabaseClient) => {
  const body = await req.json();
  const { sale_type, sale_date, customer_name, customer_phone, hot_mobile_id, package_price, has_valid_hk, device_name, device_sale_amount, notes, employee_id } = body;

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

  // Identity lookup (PR6)
  const identity = await matchSaleIdentity(db, { hot_mobile_id, customer_phone });

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
    // Identity linking (PR6)
    customer_id: identity.customer_id,
    customer_hot_account_id: identity.customer_hot_account_id,
    hot_mobile_id_snapshot: identity.hot_mobile_id_snapshot,
    store_customer_code_snapshot: identity.store_customer_code_snapshot,
    match_status: identity.match_status,
    match_method: identity.match_method,
    match_confidence: identity.match_confidence,
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
