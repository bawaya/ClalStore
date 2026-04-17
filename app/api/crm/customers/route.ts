
import { NextRequest } from "next/server";
import { withPermission, logAudit } from "@/lib/admin/auth";
import { apiSuccess, apiError, safeError } from "@/lib/api-response";
import { customerSchema, validateBody } from "@/lib/admin/validators";
import type { SupabaseClient } from "@supabase/supabase-js";

export const GET = withPermission(
  "crm",
  "view",
  async (req: NextRequest, db: SupabaseClient) => {
    const { searchParams } = new URL(req.url);

    // Single customer orders lookup
    const customerId = searchParams.get("customerId");
    if (customerId) {
      const { data: orders } = await db
        .from("orders")
        .select("*, order_items(*)")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });
      return apiSuccess({ orders: orders || [] });
    }

    // List customers with filters
    const segment = searchParams.get("segment") || undefined;
    const search = searchParams.get("search") || undefined;
    const source = searchParams.get("source") || undefined;
    const hotSearch = searchParams.get("hot_search") || undefined;
    const assignedTo = searchParams.get("assigned_to") || undefined;
    const limit = Number(searchParams.get("limit") || 100);
    const offset = Number(searchParams.get("offset") || 0);

    // If searching by HOT identity, first resolve matching customer IDs
    let hotCustomerIds: string[] | undefined;
    if (hotSearch) {
      const q = hotSearch.trim();
      const { data: hotMatches } = await db
        .from("customer_hot_accounts")
        .select("customer_id")
        .is("ended_at", null)
        .or(
          `hot_mobile_id.ilike.%${q}%,hot_customer_code.ilike.%${q}%,line_phone.ilike.%${q}%`,
        );
      hotCustomerIds = [...new Set((hotMatches || []).map((h: any) => h.customer_id))];
      if (hotCustomerIds.length === 0) {
        return apiSuccess({ customers: [], total: 0 });
      }
    }

    let query = db
      .from("customers")
      .select("*", { count: "exact" })
      .order("total_spent", { ascending: false });

    if (segment) query = query.eq("segment", segment);
    if (source) query = query.eq("source", source);
    if (assignedTo) query = query.eq("assigned_to", assignedTo);
    if (hotCustomerIds) query = query.in("id", hotCustomerIds);
    if (search) {
      const q = search.trim();
      query = query.or(
        `name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%,customer_code.ilike.%${q}%`,
      );
    }
    query = query.range(offset, offset + limit - 1);

    const { data, count } = await query;
    return apiSuccess({ customers: data || [], total: count || 0 });
  },
);

export const POST = withPermission(
  "crm",
  "create",
  async (req: NextRequest, db: SupabaseClient, user) => {
    const body = await req.json();
    const validation = validateBody(body, customerSchema);
    if (validation.error) {
      return apiError(validation.error, 400);
    }

    const d = validation.data!;
    const phone = d.phone.replace(/[-\s]/g, "");

    // Check for duplicate phone
    const { data: existing } = await db
      .from("customers")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();

    if (existing?.id) {
      return apiError("عميل بنفس رقم الهاتف موجود مسبقاً", 409);
    }

    const { data, error } = await db
      .from("customers")
      .insert({
        name: d.name,
        phone,
        email: d.email || null,
        city: d.city || null,
        address: d.address || null,
        id_number: d.id_number || null,
        segment: d.segment || "new",
        birthday: d.birthday || null,
        tags: d.tags || [],
        source: d.source || "manual",
        gender: d.gender || null,
        preferred_language: d.preferred_language || "ar",
        notes: d.notes || null,
        created_by_id: user.appUserId || null,
        created_by_name: user.name || null,
        total_orders: 0,
        total_spent: 0,
        avg_order_value: 0,
      })
      .select()
      .single();

    if (error || !data) {
      return safeError(error, "create customer");
    }

    await logAudit(db, {
      userId: user.appUserId,
      userName: user.name || "Admin",
      userRole: user.role,
      action: "create",
      module: "crm",
      entityType: "customer",
      entityId: data.id,
      details: { name: d.name, phone, source: d.source },
    });

    return apiSuccess(data, undefined, 201);
  },
);
