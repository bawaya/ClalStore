import type { SupabaseClient } from "@supabase/supabase-js";
import { logAudit } from "@/lib/admin/auth";
import { createManualOrder, type AdminActor, type ManualOrderPayload } from "@/lib/orders/admin";
import { registerSaleCommission } from "@/lib/commissions/register";

type PipelineStage = {
  id: number;
  name: string;
  name_he: string;
  name_ar?: string | null;
  color?: string | null;
  sort_order: number;
  is_won?: boolean | null;
  is_lost?: boolean | null;
};

type PipelineDealRow = {
  id: string;
  stage_id: number | null;
  customer_name: string;
  customer_phone?: string | null;
  customer_email?: string | null;
  product_name?: string | null;
  product_id?: string | null;
  estimated_value?: number | null;
  employee_id?: string | null;
  employee_name?: string | null;
  notes?: string | null;
  order_id?: string | null;
  converted_at?: string | null;
  lost_reason?: string | null;
  created_at: string;
  updated_at: string;
  stage?: string | null;
  value?: number | null;
};

type PipelineDealPayload = {
  stage_id: number;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  product_name?: string;
  product_id?: string;
  estimated_value?: number;
  notes?: string;
  lost_reason?: string;
};

/**
 * When a deal lands in a `is_won` stage for the first time, auto-create a
 * sales_doc + commission row. Idempotent: re-entering won stage won't produce
 * duplicates because both sales_docs.idempotency_key and
 * commission_sales.source_pipeline_deal_id have partial unique indexes.
 *
 * Returns the created sales_doc id (or null if already processed).
 */
async function autoRegisterWonDealCommission(
  db: SupabaseClient,
  deal: PipelineDealRow,
  actorInfo: { appUserId: string | null; name: string },
): Promise<{ salesDocId: number | null; commissionId: number | null }> {
  const employeeId = deal.employee_id || actorInfo.appUserId;
  if (!employeeId) {
    console.warn(`[pipeline] deal ${deal.id} has no employee_id — skipping commission`);
    return { salesDocId: null, commissionId: null };
  }

  const saleAmount = Number(deal.estimated_value ?? deal.value ?? 0);
  if (!(saleAmount > 0)) {
    console.warn(`[pipeline] deal ${deal.id} has non-positive value — skipping commission`);
    return { salesDocId: null, commissionId: null };
  }

  // Default to device; product name heuristic can flip it to line
  const name = (deal.product_name || "").toLowerCase();
  const saleType: "line" | "device" =
    /חבילה|باقة|package|line|خط|קו /i.test(name) ? "line" : "device";

  // Check if sales_doc already exists for this deal (via idempotency_key)
  const idempotencyKey = `pipeline_${deal.id}`;
  const { data: existingDoc } = await db
    .from("sales_docs")
    .select("id")
    .eq("idempotency_key", idempotencyKey)
    .is("deleted_at", null)
    .maybeSingle();

  if (existingDoc?.id) {
    return { salesDocId: existingDoc.id as number, commissionId: null };
  }

  const saleDate = new Date().toISOString().slice(0, 10);

  // Create sales_doc linked back to this deal
  const { data: newDoc, error: docErr } = await db
    .from("sales_docs")
    .insert({
      employee_user_id: employeeId,
      employee_key: employeeId,
      customer_id: deal.customer_id ?? null,
      order_id: deal.order_id ?? null,
      sale_type: saleType,
      status: "synced_to_commissions",
      sale_date: saleDate,
      total_amount: saleAmount,
      currency: "ILS",
      source: "pipeline",
      created_by: actorInfo.name,
      submitted_at: new Date().toISOString(),
      verified_at: new Date().toISOString(),
      synced_at: new Date().toISOString(),
      idempotency_key: idempotencyKey,
      notes: `Auto-created from pipeline deal: ${deal.customer_name || deal.id}`,
    })
    .select("id")
    .single();

  if (docErr || !newDoc) {
    // If unique violation (idempotency), treat as already processed
    if (docErr?.message?.includes("duplicate") || docErr?.code === "23505") {
      return { salesDocId: null, commissionId: null };
    }
    throw new Error(`autoRegisterWonDealCommission sales_doc: ${docErr?.message}`);
  }

  // Register the commission (idempotent via source_pipeline_deal_id unique index)
  try {
    const result = await registerSaleCommission(db, {
      saleType,
      amount: saleAmount,
      employeeId,
      saleDate,
      source: "pipeline",
      sourceSalesDocId: newDoc.id as number,
      sourcePipelineDealId: deal.id,
      orderId: deal.order_id ?? null,
      customerId: deal.customer_id ?? null,
      customerName: deal.customer_name ?? null,
      customerPhone: deal.customer_phone ?? null,
      packagePrice: saleType === "line" ? saleAmount : undefined,
      deviceName: saleType === "device" ? deal.product_name ?? null : null,
      notes: `Pipeline deal ${deal.id}`,
    });

    // Log the auto-registration event
    await db.from("sales_doc_events").insert({
      sales_doc_id: newDoc.id,
      event_type: "auto_created_from_pipeline",
      actor_user_id: actorInfo.appUserId ?? "system",
      payload: {
        deal_id: deal.id,
        commission_id: result.id,
        commission_amount: result.employeeCommission,
      },
    });

    return { salesDocId: newDoc.id as number, commissionId: result.id };
  } catch (err) {
    // If commission insert failed but doc was created, record the failure
    // so the admin can inspect. Doc stays as synced_to_commissions for idempotency.
    await db.from("sales_doc_events").insert({
      sales_doc_id: newDoc.id,
      event_type: "auto_register_commission_failed",
      actor_user_id: actorInfo.appUserId ?? "system",
      payload: { deal_id: deal.id, error: (err as Error).message },
    });
    throw err;
  }
}

async function resolveActor(db: SupabaseClient, actor: AdminActor) {
  if (actor.appUserId && actor.name) {
    return { appUserId: actor.appUserId, name: actor.name };
  }

  const { data } = await db
    .from("users")
    .select("id, name")
    .eq("auth_id", actor.id)
    .maybeSingle();

  return {
    appUserId: data?.id || actor.appUserId || null,
    name: data?.name || actor.name || actor.email?.split("@")[0] || "Admin",
  };
}

async function getStages(db: SupabaseClient) {
  const { data, error } = await db
    .from("pipeline_stages")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);
  return (data || []) as PipelineStage[];
}

async function getStageById(db: SupabaseClient, stageId: number) {
  const { data, error } = await db
    .from("pipeline_stages")
    .select("*")
    .eq("id", stageId)
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Pipeline stage not found");
  }

  return data as PipelineStage;
}

async function getStageByName(db: SupabaseClient, stageName: string) {
  const { data, error } = await db
    .from("pipeline_stages")
    .select("*")
    .eq("name", stageName)
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Pipeline stage not found");
  }

  return data as PipelineStage;
}

export async function getPipelineSnapshot(db: SupabaseClient) {
  const [stages, dealsRes] = await Promise.all([
    getStages(db),
    db
      .from("pipeline_deals")
      .select(`
        id,
        stage_id,
        customer_name,
        customer_phone,
        customer_email,
        product_name,
        product_id,
        estimated_value,
        employee_id,
        employee_name,
        notes,
        order_id,
        converted_at,
        lost_reason,
        created_at,
        updated_at,
        stage,
        value
      `)
      .order("created_at", { ascending: false }),
  ]);

  if (dealsRes.error) throw new Error(dealsRes.error.message);

  const deals = ((dealsRes.data || []) as PipelineDealRow[]).map((deal) => ({
    ...deal,
    estimated_value: Number(deal.estimated_value ?? deal.value ?? 0),
  }));

  const stageMap = new Map(stages.map((stage) => [stage.id, stage]));
  const totalDeals = deals.length;
  const totalValue = deals
    .filter((deal) => !stageMap.get(deal.stage_id || 0)?.is_lost)
    .reduce((sum, deal) => sum + Number(deal.estimated_value || 0), 0);
  const wonDeals = deals.filter((deal) => stageMap.get(deal.stage_id || 0)?.is_won);
  const conversionRate = totalDeals > 0 ? Math.round((wonDeals.length / totalDeals) * 100) : 0;
  const closedDurations = wonDeals
    .filter((deal) => deal.converted_at)
    .map((deal) => {
      const start = new Date(deal.created_at).getTime();
      const end = new Date(deal.converted_at as string).getTime();
      return Math.max(0, Math.round((end - start) / 86400000));
    });
  const avgDealTime = closedDurations.length > 0
    ? Math.round(closedDurations.reduce((sum, value) => sum + value, 0) / closedDurations.length)
    : 0;

  return {
    stages,
    deals,
    stats: {
      total_deals: totalDeals,
      total_value: totalValue,
      conversion_rate: conversionRate,
      avg_deal_time: avgDealTime,
    },
  };
}

export async function createPipelineDealRecord(
  db: SupabaseClient,
  actor: AdminActor,
  payload: PipelineDealPayload,
) {
  const stage = await getStageById(db, payload.stage_id);
  const actorInfo = await resolveActor(db, actor);
  const estimatedValue = Number(payload.estimated_value || 0);

  // Auto-link or create customer
  let customerId: string | null = null;
  if (payload.customer_phone) {
    const phone = payload.customer_phone.replace(/[-\s]/g, "");
    const { data: existing } = await db
      .from("customers")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();

    if (existing?.id) {
      customerId = existing.id;
    } else {
      const { data: newCust } = await db
        .from("customers")
        .insert({
          name: payload.customer_name,
          phone,
          email: payload.customer_email || null,
          segment: "new",
          source: "pipeline",
          created_by_id: actorInfo.appUserId,
          created_by_name: actorInfo.name,
          total_orders: 0,
          total_spent: 0,
          avg_order_value: 0,
          tags: [],
        })
        .select("id")
        .single();
      if (newCust?.id) customerId = newCust.id;
    }
  }

  const { data, error } = await db
    .from("pipeline_deals")
    .insert({
      stage_id: payload.stage_id,
      customer_id: customerId,
      customer_name: payload.customer_name,
      customer_phone: payload.customer_phone || null,
      customer_email: payload.customer_email || null,
      product_name: payload.product_name || null,
      product_summary: payload.product_name || null,
      product_id: payload.product_id || null,
      estimated_value: estimatedValue,
      value: estimatedValue,
      employee_id: actorInfo.appUserId,
      employee_name: actorInfo.name,
      assigned_to: actorInfo.appUserId,
      notes: payload.notes || null,
      lost_reason: payload.lost_reason || null,
      source: "manual",
      stage: stage.name,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to create deal");
  }

  await logAudit(db, {
    userId: actorInfo.appUserId || undefined,
    userName: actorInfo.name,
    userRole: actor.role,
    action: "create",
    module: "crm",
    entityType: "pipeline_deal",
    entityId: data.id,
    details: {
      stage_id: payload.stage_id,
      customer_name: payload.customer_name,
      product_name: payload.product_name || null,
      estimated_value: estimatedValue,
    },
  });

  return data;
}

export async function updatePipelineDealRecord(
  db: SupabaseClient,
  actor: AdminActor,
  payload: Partial<PipelineDealPayload> & { id: string },
) {
  const stage = payload.stage_id ? await getStageById(db, payload.stage_id) : null;
  if (stage?.is_lost && !payload.lost_reason?.trim()) {
    throw new Error("lost_reason is required for lost deals");
  }

  // Capture the pre-update state so we can detect a first-time transition
  // into a won stage (decision 11).
  const { data: before } = await db
    .from("pipeline_deals")
    .select("stage_id")
    .eq("id", payload.id)
    .maybeSingle();
  const previousStageId = before?.stage_id as number | null;

  const actorInfo = await resolveActor(db, actor);
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (payload.stage_id) {
    updates.stage_id = payload.stage_id;
    updates.stage = stage?.name || null;
  }
  if (payload.customer_name !== undefined) updates.customer_name = payload.customer_name;
  if (payload.customer_phone !== undefined) updates.customer_phone = payload.customer_phone || null;
  if (payload.customer_email !== undefined) updates.customer_email = payload.customer_email || null;
  if (payload.product_name !== undefined) {
    updates.product_name = payload.product_name || null;
    updates.product_summary = payload.product_name || null;
  }
  if (payload.product_id !== undefined) updates.product_id = payload.product_id || null;
  if (payload.estimated_value !== undefined) {
    updates.estimated_value = Number(payload.estimated_value || 0);
    updates.value = Number(payload.estimated_value || 0);
  }
  if (payload.notes !== undefined) updates.notes = payload.notes || null;
  if (payload.lost_reason !== undefined) updates.lost_reason = payload.lost_reason || null;

  const { data, error } = await db
    .from("pipeline_deals")
    .update(updates)
    .eq("id", payload.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to update deal");
  }

  await logAudit(db, {
    userId: actorInfo.appUserId || undefined,
    userName: actorInfo.name,
    userRole: actor.role,
    action: "update",
    module: "crm",
    entityType: "pipeline_deal",
    entityId: payload.id,
    details: updates,
  });

  // Decision 11: first-time transition into a won stage auto-creates
  // sales_doc + commission. Idempotency guards against re-runs.
  if (stage?.is_won && previousStageId !== stage.id) {
    try {
      await autoRegisterWonDealCommission(db, data as PipelineDealRow, actorInfo);
    } catch (autoErr) {
      console.error(`[pipeline] auto-commission failed for deal ${data.id}:`, autoErr);
      // Do not throw — the stage update itself already succeeded.
    }
  }

  return data;
}

export async function deletePipelineDealRecord(
  db: SupabaseClient,
  actor: AdminActor,
  dealId: string,
) {
  const actorInfo = await resolveActor(db, actor);

  const { error } = await db
    .from("pipeline_deals")
    .delete()
    .eq("id", dealId);

  if (error) throw new Error(error.message);

  await logAudit(db, {
    userId: actorInfo.appUserId || undefined,
    userName: actorInfo.name,
    userRole: actor.role,
    action: "delete",
    module: "crm",
    entityType: "pipeline_deal",
    entityId: dealId,
  });
}

export async function convertPipelineDealToOrder(
  db: SupabaseClient,
  actor: AdminActor,
  dealId: string,
  overrides?: Partial<ManualOrderPayload>,
) {
  const actorInfo = await resolveActor(db, actor);
  const { data: deal, error } = await db
    .from("pipeline_deals")
    .select("*")
    .eq("id", dealId)
    .single();

  if (error || !deal) {
    throw new Error(error?.message || "Deal not found");
  }

  const stage = await getStageById(db, deal.stage_id);
  if (!["closing", "won"].includes(stage.name)) {
    throw new Error("Deal must be in closing or won stage before conversion");
  }
  if (deal.order_id) {
    throw new Error("Deal already converted to an order");
  }

  const orderPayload: ManualOrderPayload = {
    customer_name: overrides?.customer_name || deal.customer_name,
    customer_phone: overrides?.customer_phone || deal.customer_phone || "",
    customer_email: overrides?.customer_email || deal.customer_email || "",
    items: overrides?.items || [{
      product_id: deal.product_id || undefined,
      name: deal.product_name || deal.product_summary || "Pipeline item",
      price: Number(overrides?.total || deal.estimated_value || deal.value || 0),
      quantity: 1,
    }],
    subtotal: Number(overrides?.subtotal ?? deal.estimated_value ?? deal.value ?? 0),
    discount: Number(overrides?.discount || 0),
    shipping: Number(overrides?.shipping || 0),
    total: Number(overrides?.total ?? deal.estimated_value ?? deal.value ?? 0),
    notes: overrides?.notes || deal.notes || "",
    source: "pipeline",
    deal_id: deal.id,
    payment_method: overrides?.payment_method || "cash",
    status: overrides?.status || "new",
  };

  const order = await createManualOrder(db, actor, orderPayload, {
    defaultItemType: "device",
    assignedToUserId: deal.employee_id || actorInfo.appUserId,
  });
  const wonStage = stage.is_won ? stage : await getStageByName(db, "won");

  const { data: updatedDeal, error: updateError } = await db
    .from("pipeline_deals")
    .update({
      stage_id: wonStage.id,
      stage: wonStage.name,
      order_id: order.id,
      converted_at: new Date().toISOString(),
      employee_id: deal.employee_id || actorInfo.appUserId,
      employee_name: deal.employee_name || actorInfo.name,
      assigned_to: deal.employee_id || actorInfo.appUserId,
    })
    .eq("id", dealId)
    .select("*")
    .single();

  if (updateError || !updatedDeal) {
    throw new Error(updateError?.message || "Failed to update converted deal");
  }

  await logAudit(db, {
    userId: actorInfo.appUserId || undefined,
    userName: actorInfo.name,
    userRole: actor.role,
    action: "convert_to_order",
    module: "crm",
    entityType: "pipeline_deal",
    entityId: dealId,
    details: {
      order_id: order.id,
      stage_id: wonStage.id,
    },
  });

  // Decision 11: converting a deal to an order lands it in won; register
  // commission automatically. Idempotent via source_pipeline_deal_id.
  try {
    await autoRegisterWonDealCommission(db, updatedDeal as PipelineDealRow, actorInfo);
  } catch (autoErr) {
    console.error(
      `[pipeline] auto-commission during convert failed for deal ${dealId}:`,
      autoErr,
    );
  }

  return { order, deal: updatedDeal };
}
