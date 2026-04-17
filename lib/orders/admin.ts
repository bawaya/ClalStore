import type { SupabaseClient } from "@supabase/supabase-js";
import { logAudit } from "@/lib/admin/auth";
import { syncCommissionForOrder } from "@/lib/commissions/sync-orders";
import { generateOrderId, validatePhone } from "@/lib/validators";

const ORDER_STATUS_VALUES = new Set([
  "new",
  "approved",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "rejected",
  "returned",
  "no_reply_1",
  "no_reply_2",
  "no_reply_3",
  "pending",
]);

const VALID_TRANSITIONS: Record<string, Set<string>> = {
  new: new Set(["approved", "cancelled", "rejected", "no_reply_1", "processing"]),
  approved: new Set(["processing", "cancelled", "shipped"]),
  processing: new Set(["shipped", "cancelled"]),
  shipped: new Set(["delivered", "returned"]),
  delivered: new Set(["returned"]),
  cancelled: new Set([]),
  rejected: new Set([]),
  returned: new Set([]),
  no_reply_1: new Set(["no_reply_2", "approved", "cancelled"]),
  no_reply_2: new Set(["no_reply_3", "approved", "cancelled"]),
  no_reply_3: new Set(["approved", "cancelled"]),
};

const ORDER_SELECT = `
  *,
  order_items(*),
  order_notes(*),
  customers(name, phone, email, segment, id_number)
`;

export type AdminActor = {
  id: string;
  email?: string;
  role: string;
  appUserId?: string;
  name?: string;
};

export type ManualOrderItemInput = {
  product_id?: string;
  name: string;
  price: number;
  quantity: number;
};

export type ManualOrderPayload = {
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  items: ManualOrderItemInput[];
  subtotal: number;
  discount?: number;
  shipping?: number;
  total: number;
  notes?: string;
  source: "manual" | "phone" | "pipeline";
  deal_id?: string;
  payment_method?: string;
  status?: string;
};

type ManualOrderOptions = {
  defaultItemType?: "device" | "accessory";
  assignedToUserId?: string | null;
};

type ProductLookup = {
  id: string;
  name_ar: string;
  brand: string;
  type: "device" | "accessory";
};

type OrderRpcItem = {
  product_id: string | null;
  product_name: string;
  product_brand: string;
  product_type: string;
  price: number;
  quantity: number;
  color: string | null;
  storage: string | null;
};

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

function normalizePhone(phone: string) {
  return phone.replace(/[-\s]/g, "");
}

function normalizeOrderStatus(status?: string) {
  const next = (status || "new").trim();
  if (!ORDER_STATUS_VALUES.has(next)) {
    throw new Error("Invalid order status");
  }
  return next === "pending" ? "new" : next;
}

function computeTotals(payload: ManualOrderPayload) {
  const subtotal = payload.items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
  const discount = Number(payload.discount || 0);
  const shipping = Number(payload.shipping || 0);
  const total = Math.max(0, subtotal - discount + shipping);
  return { subtotal, discount, shipping, total };
}

async function upsertCustomer(
  db: SupabaseClient,
  payload: ManualOrderPayload,
) {
  const phone = normalizePhone(payload.customer_phone);
  const email = payload.customer_email?.trim() || null;

  const { data: existing } = await db
    .from("customers")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await db
      .from("customers")
      .update({
        name: payload.customer_name,
        phone,
        email,
      })
      .eq("id", existing.id);

    if (error) throw new Error(error.message);
    return existing.id;
  }

  const { data, error } = await db
    .from("customers")
    .insert({
      name: payload.customer_name,
      phone,
      email,
      segment: "new",
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to create customer");
  }

  return data.id;
}

async function buildOrderItems(
  db: SupabaseClient,
  payload: ManualOrderPayload,
  options?: ManualOrderOptions,
) {
  const productIds = payload.items.map((item) => item.product_id).filter(Boolean) as string[];
  const productMap = new Map<string, ProductLookup>();

  if (productIds.length > 0) {
    const { data, error } = await db
      .from("products")
      .select("id, name_ar, brand, type")
      .in("id", productIds);

    if (error) throw new Error(error.message);

    for (const product of data || []) {
      productMap.set(product.id, product as ProductLookup);
    }
  }

  return payload.items.map((item) => {
    const product = item.product_id ? productMap.get(item.product_id) : null;
    return {
      product_id: item.product_id || null,
      product_name: item.name || product?.name_ar || "Manual Item",
      product_brand: product?.brand || "Manual",
      product_type: product?.type || options?.defaultItemType || "accessory",
      price: Number(item.price || 0),
      quantity: Number(item.quantity || 1),
      color: null,
      storage: null,
    } satisfies OrderRpcItem;
  });
}

export async function getOrderById(db: SupabaseClient, orderId: string) {
  const { data, error } = await db
    .from("orders")
    .select(ORDER_SELECT)
    .eq("id", orderId)
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Order not found");
  }

  return data;
}

export async function createManualOrder(
  db: SupabaseClient,
  actor: AdminActor,
  payload: ManualOrderPayload,
  options?: ManualOrderOptions,
) {
  if (!payload.customer_name.trim()) throw new Error("customer_name is required");
  if (!payload.customer_phone.trim()) throw new Error("customer_phone is required");
  if (!validatePhone(payload.customer_phone)) throw new Error("Invalid customer phone");
  if (!payload.items.length) throw new Error("At least one item is required");

  const { subtotal, discount, shipping, total } = computeTotals(payload);
  const roundedSubtotal = Math.round(subtotal * 100) / 100;
  const roundedTotal = Math.round(total * 100) / 100;

  if (Math.abs(Number(payload.subtotal) - roundedSubtotal) > 0.01) {
    throw new Error("Subtotal does not match order items");
  }
  if (Math.abs(Number(payload.total) - roundedTotal) > 0.01) {
    throw new Error("Total does not match subtotal/discount/shipping");
  }

  const normalizedStatus = normalizeOrderStatus(payload.status);
  const actorInfo = await resolveActor(db, actor);
  const customerId = await upsertCustomer(db, payload);
  const orderItems = await buildOrderItems(db, payload, options);
  const orderId = generateOrderId();

  const { error: rpcError } = await db.rpc("create_order_atomic", {
    p_order_id: orderId,
    p_customer_id: customerId,
    p_source: payload.source,
    p_items_total: roundedSubtotal,
    p_discount_amount: discount,
    p_total: roundedTotal,
    p_coupon_code: "",
    p_payment_method: payload.payment_method || "cash",
    p_payment_details: {
      source: payload.source,
      shipping,
      created_via: "admin_manual",
    },
    p_shipping_city: "",
    p_shipping_address: "",
    p_customer_notes: payload.notes || "",
    p_items: orderItems,
  });

  if (rpcError) {
    throw new Error(rpcError.message || "Failed to create order");
  }

  const { error: updateError } = await db
    .from("orders")
    .update({
      status: normalizedStatus,
      source: payload.source,
      payment_method: payload.payment_method || "cash",
      internal_notes: payload.notes || null,
      assigned_to: options?.assignedToUserId ?? actorInfo.appUserId,
      created_by_id: actorInfo.appUserId,
      created_by_name: actorInfo.name,
      deal_id: payload.deal_id || null,
    })
    .eq("id", orderId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  if (normalizedStatus !== "new") {
    const { error: historyError } = await db.from("order_status_history").insert({
      order_id: orderId,
      old_status: "new",
      new_status: normalizedStatus,
      changed_by_id: actorInfo.appUserId,
      changed_by_name: actorInfo.name,
      notes: payload.notes || null,
    });

    if (historyError) {
      throw new Error(historyError.message);
    }
  }

  if (payload.deal_id) {
    const { error: dealError } = await db
      .from("pipeline_deals")
      .update({
        order_id: orderId,
        converted_at: new Date().toISOString(),
      })
      .eq("id", payload.deal_id);

    if (dealError) {
      throw new Error(dealError.message);
    }
  }

  await syncCommissionForOrder(orderId, db);

  await logAudit(db, {
    userId: actorInfo.appUserId || undefined,
    userName: actorInfo.name,
    userRole: actor.role,
    action: "create",
    module: "orders",
    entityType: "order",
    entityId: orderId,
    details: {
      source: payload.source,
      itemCount: payload.items.length,
      subtotal: roundedSubtotal,
      discount,
      shipping,
      total: roundedTotal,
      deal_id: payload.deal_id || null,
    },
  });

  return getOrderById(db, orderId);
}

export async function updateOrderStatusWithHistory(
  db: SupabaseClient,
  params: {
    orderId: string;
    newStatus: string;
    actor: AdminActor;
    notes?: string;
  },
) {
  const normalizedStatus = normalizeOrderStatus(params.newStatus);
  const actorInfo = await resolveActor(db, params.actor);

  const { data: existing, error: existingError } = await db
    .from("orders")
    .select("id, status")
    .eq("id", params.orderId)
    .single();

  if (existingError || !existing) {
    throw new Error(existingError?.message || "Order not found");
  }

  if (existing.status === normalizedStatus) {
    return existing;
  }

  const allowed = VALID_TRANSITIONS[existing.status];
  if (allowed && !allowed.has(normalizedStatus)) {
    throw new Error(`Cannot transition from ${existing.status} to ${normalizedStatus}`);
  }

  const { error: updateError } = await db
    .from("orders")
    .update({ status: normalizedStatus })
    .eq("id", params.orderId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  const { error: historyError } = await db
    .from("order_status_history")
    .insert({
      order_id: params.orderId,
      old_status: existing.status,
      new_status: normalizedStatus,
      changed_by_id: actorInfo.appUserId,
      changed_by_name: actorInfo.name,
      notes: params.notes || null,
    });

  if (historyError) {
    throw new Error(historyError.message);
  }

  await logAudit(db, {
    userId: actorInfo.appUserId || undefined,
    userName: actorInfo.name,
    userRole: params.actor.role,
    action: "status_change",
    module: "orders",
    entityType: "order",
    entityId: params.orderId,
    details: {
      old_status: existing.status,
      new_status: normalizedStatus,
      notes: params.notes || null,
    },
  });

  return existing;
}

export async function getOrderStatusHistory(db: SupabaseClient, orderId: string) {
  const { data, error } = await db
    .from("order_status_history")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

