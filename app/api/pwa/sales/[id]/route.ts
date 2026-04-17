import { NextRequest } from "next/server";
import { apiError, apiSuccess, safeError } from "@/lib/api-response";
import { createAdminSupabase } from "@/lib/supabase";
import { requireEmployee } from "@/lib/pwa/auth";
import { attachCustomersToSalesDocs, buildCustomerPhoneCandidates } from "@/lib/pwa/customer-linking";
import { updateSalesDocSchema } from "@/lib/pwa/validators";
import { validateBody } from "@/lib/admin/validators";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const authed = await requireEmployee(req);
    if ("status" in authed) return authed;

    const db = createAdminSupabase();
    if (!db) return apiError("DB unavailable", 500);

    const { id } = await ctx.params;
    const docId = Number(id);
    if (!docId || Number.isNaN(docId)) return apiError("Invalid id", 400);

    const [docRes, itemsRes, attachmentsRes, eventsRes] = await Promise.all([
      db.from("sales_docs").select("*").eq("id", docId).is("deleted_at", null).single(),
      db.from("sales_doc_items").select("*").eq("sales_doc_id", docId).is("deleted_at", null).order("id", { ascending: true }),
      db.from("sales_doc_attachments").select("*").eq("sales_doc_id", docId).is("deleted_at", null).order("id", { ascending: true }),
      db.from("sales_doc_events").select("*").eq("sales_doc_id", docId).order("created_at", { ascending: true }),
    ]);

    if (docRes.error || !docRes.data) return apiError("Not found", 404);
    if (docRes.data.employee_key !== authed.appUserId) return apiError("Forbidden", 403);

    let customerRows: Array<{ id: string; name: string; phone: string; customer_code?: string | null }> = [];
    if (docRes.data.customer_id) {
      const { data: customer } = await db
        .from("customers")
        .select("id, name, phone, customer_code")
        .eq("id", docRes.data.customer_id)
        .maybeSingle();
      if (customer) customerRows = [customer];
    }

    const enrichedDoc = attachCustomersToSalesDocs([docRes.data], customerRows)[0];

    return apiSuccess({
      doc: enrichedDoc,
      items: itemsRes.data || [],
      attachments: attachmentsRes.data || [],
      events: eventsRes.data || [],
    });
  } catch (err: unknown) {
    return safeError(err, "PWA Sales GET by id", "خطأ في السيرفر", 500);
  }
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const authed = await requireEmployee(req);
    if ("status" in authed) return authed;

    const db = createAdminSupabase();
    if (!db) return apiError("DB unavailable", 500);

    const { id } = await ctx.params;
    const docId = Number(id);
    if (!docId || Number.isNaN(docId)) return apiError("Invalid id", 400);

    const body = await req.json();
    const validation = validateBody({ ...body, id: docId }, updateSalesDocSchema);
    if (validation.error) return apiError(validation.error, 400);
    if (!validation.data) return apiError("Invalid payload", 400);

    const now = new Date().toISOString();

    const { data: existing } = await db
      .from("sales_docs")
      .select("id, employee_key, status")
      .eq("id", docId)
      .is("deleted_at", null)
      .single();

    if (!existing) return apiError("Not found", 404);
    if (existing.employee_key !== authed.appUserId) return apiError("Forbidden", 403);
    if (!["draft", "rejected"].includes(existing.status)) return apiError("لا يمكن تعديل هذه الحالة", 400);

    const payload = validation.data;

    // Auto-resolve customer_id from phone if provided
    let resolvedCustomerId = payload.customer_id ?? undefined;
    if (payload.customer_phone && !resolvedCustomerId) {
      const phoneCandidates = buildCustomerPhoneCandidates(payload.customer_phone);
      const { data: cust } = await db
        .from("customers")
        .select("id")
        .in("phone", phoneCandidates)
        .maybeSingle();
      if (cust) resolvedCustomerId = cust.id;
    }

    const { data: updated, error } = await db
      .from("sales_docs")
      .update({
        sale_type: payload.sale_type ?? undefined,
        sale_date: payload.sale_date ?? undefined,
        customer_id: resolvedCustomerId,
        order_id: payload.order_id ?? undefined,
        total_amount: payload.total_amount ?? undefined,
        currency: payload.currency ?? undefined,
        notes: payload.notes ?? undefined,
        device_client_id: payload.device_client_id ?? undefined,
        updated_at: now,
      })
      .eq("id", docId)
      .select("*")
      .single();

    if (error || !updated) return apiError("فشل في تحديث العملية", 500);

    await db.from("sales_doc_events").insert({
      sales_doc_id: updated.id,
      event_type: "updated",
      actor_user_id: authed.appUserId,
      actor_role: authed.role,
      payload: { status: updated.status },
    });

    return apiSuccess(updated);
  } catch (err: unknown) {
    return safeError(err, "PWA Sales PUT", "خطأ في السيرفر", 500);
  }
}
