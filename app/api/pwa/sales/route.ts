import { NextRequest } from "next/server";
import { apiError, apiSuccess, safeError } from "@/lib/api-response";
import { createAdminSupabase } from "@/lib/supabase";
import { requireEmployee } from "@/lib/pwa/auth";
import {
  attachCustomersToSalesDocs,
  buildCustomerPhoneCandidates,
  extractCustomerIdsFromSalesDocs,
} from "@/lib/pwa/customer-linking";
import { createSalesDocSchema } from "@/lib/pwa/validators";
import { validateBody } from "@/lib/admin/validators";
import type { SalesDoc } from "@/types/database";

export async function GET(req: NextRequest) {
  try {
    const authed = await requireEmployee(req);
    if ("status" in authed) return authed;

    const db = createAdminSupabase();
    if (!db) return apiError("DB unavailable", 500);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");
    const search = searchParams.get("search")?.trim();

    let query = db
      .from("sales_docs")
      .select("*")
      .is("deleted_at", null)
      .eq("employee_key", authed.appUserId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (status) query = query.eq("status", status);
    if (dateFrom) query = query.gte("sale_date", dateFrom);
    if (dateTo) query = query.lte("sale_date", dateTo);
    const { data, error } = await query;
    if (error) return apiError("فشل في جلب البيانات", 500);

    const docs = ((data || []) as SalesDoc[]);
    const customerIds = extractCustomerIdsFromSalesDocs(docs);

    let customers: Array<{ id: string; name: string; phone: string; customer_code?: string | null }> = [];
    if (customerIds.length > 0) {
      const { data: customerRows } = await db
        .from("customers")
        .select("id, name, phone, customer_code")
        .in("id", customerIds);
      customers = customerRows || [];
    }

    let enrichedDocs = attachCustomersToSalesDocs(docs, customers);

    if (search) {
      const q = search.toLowerCase();
      enrichedDocs = enrichedDocs.filter((doc) => {
        const customer = doc.customer;
        return [
          doc.notes,
          doc.order_id,
          customer?.name,
          customer?.phone,
          customer?.customer_code,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q));
      });
    }

    return apiSuccess({ docs: enrichedDocs });
  } catch (err: unknown) {
    return safeError(err, "PWA Sales GET", "خطأ في السيرفر", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const authed = await requireEmployee(req);
    if ("status" in authed) return authed;

    const db = createAdminSupabase();
    if (!db) return apiError("DB unavailable", 500);

    const body = await req.json();
    const validation = validateBody(body, createSalesDocSchema);
    if (validation.error) return apiError(validation.error, 400);
    if (!validation.data) return apiError("Invalid payload", 400);

    const payload = validation.data;
    const now = new Date().toISOString();

    // Auto-resolve customer_id from phone if not provided
    let resolvedCustomerId = payload.customer_id || null;
    if (!resolvedCustomerId && payload.customer_phone) {
      const phoneCandidates = buildCustomerPhoneCandidates(payload.customer_phone);
      const { data: cust } = await db
        .from("customers")
        .select("id")
        .in("phone", phoneCandidates)
        .maybeSingle();
      if (cust) resolvedCustomerId = cust.id;
    }
    // Auto-resolve customer_id from order if still not resolved
    if (!resolvedCustomerId && payload.order_id) {
      const { data: ord } = await db
        .from("orders")
        .select("customer_id")
        .eq("id", payload.order_id)
        .single();
      if (ord?.customer_id) resolvedCustomerId = ord.customer_id;
    }

    const { data: created, error } = await db
      .from("sales_docs")
      .insert({
        doc_uuid: payload.doc_uuid || undefined,
        employee_user_id: authed.appUserId,
        employee_key: authed.appUserId,
        customer_id: resolvedCustomerId,
        order_id: payload.order_id || null,
        sale_type: payload.sale_type,
        status: "draft",
        sale_date: payload.sale_date || null,
        total_amount: payload.total_amount ?? 0,
        currency: payload.currency || "ILS",
        source: "pwa",
        created_by: authed.appUserId,
        notes: payload.notes || null,
        device_client_id: payload.device_client_id || null,
        idempotency_key: payload.idempotency_key || null,
        updated_at: now,
      })
      .select("*")
      .single();

    if (error || !created) return apiError("فشل في إنشاء العملية", 500);

    if ((payload.items || []).length > 0) {
      const itemsRows = (payload.items || []).map((item) => ({
        sales_doc_id: created.id,
        item_type: item.item_type,
        product_id: item.product_id || null,
        product_name: item.product_name || null,
        qty: item.qty ?? 1,
        unit_price: item.unit_price ?? 0,
        line_total: item.line_total ?? 0,
        metadata: item.metadata || {},
        updated_at: now,
      }));
      await db.from("sales_doc_items").insert(itemsRows);
    }

    await db.from("sales_doc_events").insert({
      sales_doc_id: created.id,
      event_type: "created",
      actor_user_id: authed.appUserId,
      actor_role: authed.role,
      payload: { sale_type: created.sale_type, status: created.status },
    });

    return apiSuccess(created, undefined, 201);
  } catch (err: unknown) {
    return safeError(err, "PWA Sales POST", "خطأ في السيرفر", 500);
  }
}
