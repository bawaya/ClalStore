import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminSupabase } from "@/lib/supabase";
import { apiSuccess, apiError } from "@/lib/api-response";
import { calcDualCommission, type EmployeeProfile } from "@/lib/commissions/calculator";
import {
  recalculateDeviceCommissionsForMonths,
  resolveCommissionEmployeeFilter,
  resolveLinkedAppUserId,
} from "@/lib/commissions/ledger";
import type { SupabaseClient } from "@supabase/supabase-js";

const ALLOWED_ORIGINS = (process.env.COMMISSION_ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);

function corsHeaders(origin?: string | null): Record<string, string> {
  if (ALLOWED_ORIGINS.length === 0) return {};
  const allowed = (origin && ALLOWED_ORIGINS.includes(origin)) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

/** Dual auth: bearer COMMISSION_API_TOKEN OR admin cookie session */
async function authenticate(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const validToken = process.env.COMMISSION_API_TOKEN;
  if (token && validToken && token === validToken) return true;

  const result = await requireAdmin(req);
  return !(result instanceof NextResponse);
}

async function getEmployeeProfile(db: SupabaseClient, employeeId: string): Promise<EmployeeProfile | null> {
  const { data } = await db
    .from("employee_commission_profiles")
    .select("line_multiplier, device_rate, device_milestone_bonus, min_package_price, loyalty_bonuses")
    .eq("user_id", employeeId)
    .eq("active", true)
    .maybeSingle();
  return data as EmployeeProfile | null;
}

async function recalculateDeviceMonth(db: SupabaseClient, saleDate?: string | null) {
  if (!saleDate) return;
  await recalculateDeviceCommissionsForMonths(db, [saleDate.slice(0, 7)]);
}

export async function GET(req: NextRequest) {
  const authed = await authenticate(req);
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders() });

  const db = createAdminSupabase();
  if (!db) return apiError("DB unavailable", 500);

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const source = searchParams.get("source");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const employeeId = searchParams.get("employee_id");
  const empName = searchParams.get("employee_name");
  const employeeKey = searchParams.get("employee_key");
  const employeeToken = searchParams.get("employee_token");
  const search = searchParams.get("search")?.trim();
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = (page - 1) * limit;

  let query = db.from("commission_sales").select("*", { count: "exact" }).is("deleted_at", null);
  const employeeScope = await resolveCommissionEmployeeFilter(db, {
    employeeId,
    employeeName: empName,
    employeeKey,
    employeeToken,
  });

  if (type) query = query.eq("sale_type", type);
  if (source) query = query.eq("source", source);
  if (from) query = query.gte("sale_date", from);
  if (to) query = query.lte("sale_date", to);
  if (employeeScope.notFound) query = query.eq("id", -1);
  else if (employeeScope.employeeId) query = query.eq("employee_id", employeeScope.employeeId);
  else if (employeeScope.employeeName) query = query.eq("employee_name", employeeScope.employeeName);
  if (search) {
    const normalizedSearch = search.replace(/,/g, " ");
    query = query.or(
      `customer_name.ilike.%${normalizedSearch}%,customer_phone.ilike.%${normalizedSearch}%,device_name.ilike.%${normalizedSearch}%,employee_name.ilike.%${normalizedSearch}%,order_id.ilike.%${normalizedSearch}%,store_customer_code_snapshot.ilike.%${normalizedSearch}%`,
    );
  }

  // Resolve employee_token → employee_name filter

  query = query.order("sale_date", { ascending: false }).range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) {
    console.error("Commission sales GET error:", error.message);
    return apiError("فشل في جلب سجلات المبيعات", 500);
  }

  return apiSuccess(
    data || [],
    { limit, offset, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
  );
}

export async function POST(req: NextRequest) {
  const authed = await authenticate(req);
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders() });

  const db = createAdminSupabase();
  if (!db) return apiError("DB unavailable", 500);
  const body = await req.json();
  let { sale_type, sale_date, customer_name, customer_phone, package_price, has_valid_hk, device_name, device_sale_amount, notes, employee_id, employee_name, employee_token } = body;

  if (!sale_type || !sale_date) return apiError("sale_type and sale_date required", 400);

  const value = sale_type === "line" ? package_price : device_sale_amount;
  if (!value) return apiError(`${sale_type === "line" ? "package_price" : "device_sale_amount"} required`, 400);
  if (sale_type !== "line" && sale_type !== "device") return apiError("sale_type must be 'line' or 'device'", 400);

  employee_id = (await resolveLinkedAppUserId(db, employee_id)) || employee_id || null;

  // Resolve employee_token → employee_name & employee_id (for external apps)
  if (employee_token && !employee_name) {
    const { data: emp } = await db.from("commission_employees").select("id, name, user_id").eq("token", employee_token).eq("active", true).maybeSingle();
    if (emp) {
      employee_name = emp.name;
      if (!employee_id && emp.user_id) {
        employee_id = await resolveLinkedAppUserId(db, emp.user_id);
      }
    }
  }

  // Get employee profile if employee_id provided
  const profile = employee_id ? await getEmployeeProfile(db, employee_id) : null;

  const { contractCommission, employeeCommission } = calcDualCommission(
    sale_type,
    value,
    has_valid_hk !== false,
    profile,
  );

  const isDeviceSale = sale_type === "device";
  const insertedCommissionAmount = isDeviceSale
    ? 0
    : (employee_id ? employeeCommission : contractCommission);
  const insertedContractCommission = isDeviceSale ? 0 : contractCommission;

  const { data, error } = await db.from("commission_sales").insert({
    sale_type,
    sale_date,
    source: "manual",
    employee_id: employee_id || null,
    employee_name: employee_name || null,
    customer_name: customer_name || null,
    customer_phone: customer_phone || null,
    package_price: sale_type === "line" ? package_price : 0,
    has_valid_hk: sale_type === "line" ? (has_valid_hk !== false) : true,
    device_name: sale_type === "device" ? (device_name || null) : null,
    device_sale_amount: sale_type === "device" ? device_sale_amount : 0,
    commission_amount: insertedCommissionAmount,
    contract_commission: insertedContractCommission,
    notes: notes || null,
    loyalty_status: sale_type === "line" ? "pending" : null,
    loyalty_start_date: sale_type === "line" ? sale_date : null,
  }).select().single();

  if (error) {
    console.error("Commission sales POST error:", error.message);
    return apiError("فشل في حفظ سجل المبيعة", 500);
  }

  if (isDeviceSale) {
    await recalculateDeviceMonth(db, sale_date);
    const { data: refreshed } = await db.from("commission_sales").select("*").eq("id", data.id).single();
    return apiSuccess(refreshed || data, undefined, 201);
  }

  return apiSuccess(data, undefined, 201);
}

export async function PUT(req: NextRequest) {
  const authed = await authenticate(req);
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders() });

  const db = createAdminSupabase();
  if (!db) return apiError("DB unavailable", 500);

  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) return apiError("id required", 400);

  if (updates.employee_id !== undefined) {
    updates.employee_id = (await resolveLinkedAppUserId(db, updates.employee_id)) || null;
  }

  // Recalculate commissions if relevant fields changed
  if (updates.package_price !== undefined || updates.has_valid_hk !== undefined || updates.device_sale_amount !== undefined || updates.employee_id !== undefined) {
    const { data: existing } = await db.from("commission_sales")
      .select("sale_type, package_price, has_valid_hk, device_sale_amount, employee_id, sale_date")
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
        updates.commission_amount = 0;
        updates.contract_commission = 0;
      }
    }
  }

  updates.updated_at = new Date().toISOString();

  const { data: beforeUpdate } = await db
    .from("commission_sales")
    .select("sale_type, sale_date")
    .eq("id", id)
    .single();

  const { data, error } = await db.from("commission_sales").update(updates).eq("id", id).select().single();
  if (error) {
    console.error("Commission sales PUT error:", error.message);
    return apiError("فشل في تحديث السجل", 500);
  }

  if ((beforeUpdate?.sale_type || data.sale_type) === "device") {
    const months = [beforeUpdate?.sale_date, data.sale_date]
      .filter((value): value is string => Boolean(value))
      .map((value) => value.slice(0, 7));
    await recalculateDeviceCommissionsForMonths(db, months);
    const { data: refreshed } = await db.from("commission_sales").select("*").eq("id", id).single();
    return apiSuccess(refreshed || data);
  }

  return apiSuccess(data);
}

export async function DELETE(req: NextRequest) {
  const authed = await authenticate(req);
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders() });

  const db = createAdminSupabase();
  if (!db) return apiError("DB unavailable", 500);

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return apiError("id required", 400);

  const { data: existing } = await db
    .from("commission_sales")
    .select("sale_type, sale_date, order_id")
    .eq("id", id)
    .single();

  // Soft delete: set deleted_at instead of hard delete
  const { error } = await db.from("commission_sales")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error("Commission sales DELETE error:", error.message);
    return apiError("فشل في حذف السجل", 500);
  }

  if (existing?.order_id) {
    await db.from("orders").update({ commission_synced: false }).eq("id", existing.order_id);
  }

  if (existing?.sale_type === "device") {
    await recalculateDeviceMonth(db, existing.sale_date);
  }

  return apiSuccess({ deleted: true });
}
