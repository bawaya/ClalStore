// =====================================================
// ClalMobile — CRM Queries
// Server-side data access for CRM
// =====================================================

import { createAdminSupabase } from "@/lib/supabase";
import type { Order, Customer, Task, PipelineDeal, AppUser, AuditEntry, BotConversation, BotMessage } from "@/types/database";

// ----- Row subsets returned by dashboard queries -----
type DashboardOrder = Pick<Order, "id" | "status" | "source" | "total" | "created_at" | "customer_id" | "assigned_to">;
type DashboardCustomer = Pick<Customer, "id" | "name" | "phone" | "segment" | "total_orders" | "total_spent" | "last_order_at">;
type DashboardTask = Pick<Task, "id" | "status" | "priority" | "due_date" | "assigned_to">;
type DashboardPipelineDeal = Pick<PipelineDeal, "id" | "stage" | "value">;

// Row subset for order-deletion recalculation
type OrderTotalRow = Pick<Order, "total" | "status" | "created_at">;

// Supabase result for assigned_to counting
type AssignedToRow = Pick<Order, "assigned_to">;

// Audit entry subset
type AuditActivityRow = Pick<AuditEntry, "user_name" | "action" | "created_at">;

// Bot message subset used in chat enrichment
type LastMessageRow = Pick<BotMessage, "conversation_id" | "content" | "role" | "created_at">;

// Customer subset used in chat enrichment
type ChatCustomerRow = Pick<Customer, "id" | "name" | "phone" | "email">;

// Bot conversation subset for stats
type ConvoStatsRow = Pick<BotConversation, "id" | "channel" | "status" | "intent" | "created_at">;

// Allow null in addition to undefined for optional fields (Zod schemas produce `| null`)
type Nullable<T> = { [K in keyof T]: T[K] | null };

const db = () => createAdminSupabase();

// ===== Dashboard =====
export async function getCRMDashboard(filters?: { dateFrom?: string; dateTo?: string }) {
  const s = db();

  let ordersQuery = s.from("orders").select("id, status, source, total, created_at, customer_id, assigned_to", { count: "exact" }).is("deleted_at", null).order("created_at", { ascending: false });
  if (filters?.dateFrom) ordersQuery = ordersQuery.gte("created_at", filters.dateFrom);
  if (filters?.dateTo) ordersQuery = ordersQuery.lte("created_at", filters.dateTo + "T23:59:59.999Z");
  ordersQuery = ordersQuery.limit(5000);

  const [orders, customers, tasks, pipeline] = await Promise.all([
    ordersQuery,
    s.from("customers").select("id, name, phone, segment, total_orders, total_spent, last_order_at", { count: "exact" }).limit(200),
    s.from("tasks").select("id, status, priority, due_date, assigned_to").limit(500),
    s.from("pipeline_deals").select("id, stage, value").limit(500),
  ]);

  const o = orders.data || [];
  const totalOrderCount = orders.count ?? o.length;
  const c = customers.data || [];
  const t = tasks.data || [];
  const p = pipeline.data || [];

  const revenueOrders = o.filter((x: DashboardOrder) => !["rejected", "new"].includes(x.status));
  const revenue = revenueOrders.reduce((s: number, x: DashboardOrder) => s + Number(x.total), 0);

  // Compute previous period revenue for truthful change %
  let prevRevenue: number | null = null;
  if (filters?.dateFrom && filters?.dateTo) {
    const from = new Date(filters.dateFrom);
    const to = new Date(filters.dateTo);
    const rangeDays = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000));
    const prevTo = new Date(from.getTime() - 1); // day before current range start
    const prevFrom = new Date(prevTo.getTime() - rangeDays * 86400000);
    const { data: prevOrders, count: prevCount } = await s.from("orders")
      .select("total, status", { count: "exact" })
      .is("deleted_at", null)
      .gte("created_at", prevFrom.toISOString())
      .lte("created_at", prevTo.toISOString() + "T23:59:59.999Z")
      .limit(5000);
    prevRevenue = (prevOrders || [])
      .filter((x: { total: number; status: string }) => !["rejected", "new"].includes(x.status))
      .reduce((s: number, x: { total: number }) => s + Number(x.total), 0);
  }
  const byStatus: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  o.forEach((x: DashboardOrder) => { byStatus[x.status] = (byStatus[x.status] || 0) + 1; bySource[x.source] = (bySource[x.source] || 0) + 1; });

  const alerts: { type: string; msg: string; count: number; color: string }[] = [];
  const newCount = o.filter((x: DashboardOrder) => x.status === "new").length;
  const noReply = o.filter((x: DashboardOrder) => x.status?.startsWith("no_reply")).length;
  const noReply3 = o.filter((x: DashboardOrder) => x.status === "no_reply_3").length;
  const openTasks = t.filter((x: DashboardTask) => x.status !== "done").length;
  const coldCustomers = c.filter((x: DashboardCustomer) => x.segment === "cold" || x.segment === "lost").length;

  if (newCount > 0) alerts.push({ type: "new", msg: `${newCount} طلبات جديدة`, count: newCount, color: "#3b82f6" });
  if (noReply > 0) alerts.push({ type: "noReply", msg: `${noReply} بدون رد`, count: noReply, color: "#f97316" });
  if (noReply3 > 0) alerts.push({ type: "noReply3", msg: `${noReply3} لا يرد 3 — قرار مطلوب!`, count: noReply3, color: "#ef4444" });
  if (openTasks > 0) alerts.push({ type: "tasks", msg: `${openTasks} مهام مفتوحة`, count: openTasks, color: "#a855f7" });
  if (coldCustomers > 0) alerts.push({ type: "cold", msg: `${coldCustomers} زبائن باردين`, count: coldCustomers, color: "#eab308" });

  const pipelineValue = p.filter((x: DashboardPipelineDeal) => x.stage !== "lost").reduce((s: number, x: DashboardPipelineDeal) => s + Number(x.value), 0);

  const suggestedFollowupsList = c
    .filter((x: DashboardCustomer) => ["cold", "lost", "inactive"].includes(x.segment) || (!x.last_order_at && (x.total_orders || 0) === 0))
    .sort((a: DashboardCustomer, b: DashboardCustomer) => {
      const aDate = a.last_order_at ? new Date(a.last_order_at).getTime() : 0;
      const bDate = b.last_order_at ? new Date(b.last_order_at).getTime() : 0;
      return aDate - bDate;
    })
    .slice(0, 10);

  return {
    totalOrders: totalOrderCount, revenue, prevRevenue, newCount, noReply, noReply3,
    totalCustomers: customers.count ?? c.length, vipCount: c.filter((x: DashboardCustomer) => x.segment === "vip").length,
    openTasks, pipelineValue, pipelineDeals: p.length,
    byStatus, bySource, alerts,
    recentOrders: o.slice(0, 5),
    suggestedFollowups: suggestedFollowupsList.map((x: DashboardCustomer) => ({ id: x.id, name: x.name, phone: x.phone, last_order_at: x.last_order_at, segment: x.segment })),
  };
}

// ===== Orders =====
export async function getCRMOrders(filters?: {
  status?: string;
  source?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  amountMin?: number;
  amountMax?: number;
  /** Filter to orders that contain at least one line of this product type (device / accessory / appliance). */
  productType?: "device" | "accessory" | "appliance";
  limit?: number;
  offset?: number;
}) {
  const s = db();
  const limit = filters?.limit || 100;
  const offset = filters?.offset || 0;

  let orderIdFilter: string[] | null = null;
  if (filters?.productType) {
    const { data: typeRows, error: typeErr } = await s
      .from("order_items")
      .select("order_id")
      .eq("product_type", filters.productType);
    if (typeErr) {
      console.error("getCRMOrders productType filter:", typeErr);
    } else {
      const rows = (typeRows ?? []) as { order_id: string | null }[];
      const ids: string[] = rows
        .map((r) => r.order_id)
        .filter((id: string | null | undefined): id is string => Boolean(id));
      const unique: string[] = [...new Set(ids)];
      orderIdFilter = unique;
      if (unique.length === 0) {
        return { data: [], total: 0 };
      }
    }
  }

  let query = s.from("orders").select(`*, order_items(*), order_notes(*), customers(name, phone, segment, id_number)`, { count: "exact" }).is("deleted_at", null).order("created_at", { ascending: false });
  if (orderIdFilter) {
    query = query.in("id", orderIdFilter);
  }
  if (filters?.status) {
    if (filters.status === "no_reply_all") query = query.like("status", "no_reply%");
    else query = query.eq("status", filters.status);
  }
  if (filters?.source) query = query.eq("source", filters.source);
  if (filters?.dateFrom) query = query.gte("created_at", filters.dateFrom);
  if (filters?.dateTo) query = query.lte("created_at", filters.dateTo + "T23:59:59.999Z");
  if (filters?.amountMin != null) query = query.gte("total", filters.amountMin);
  if (filters?.amountMax != null) query = query.lte("total", filters.amountMax);

  if (filters?.search) {
    const q = filters.search.trim();
    query = query.or(`id.ilike.%${q}%,customers.name.ilike.%${q}%,customers.phone.ilike.%${q}%`);
  }

  query = query.range(offset, offset + limit - 1);
  const { data, count } = await query;
  return { data: data || [], total: count || 0 };
}

export async function updateOrderStatus(orderId: string, status: string, userName: string) {
  const s = db();
  await s.from("orders").update({ status }).eq("id", orderId);
  await s.from("audit_log").insert({ user_name: userName, action: `${orderId} → ${status}`, entity_type: "order", entity_id: orderId, details: { new_status: status } });
}

export async function addOrderNote(orderId: string, userId: string, userName: string, text: string) {
  const s = db();
  await s.from("order_notes").insert({ order_id: orderId, user_id: userId, user_name: userName, text });
}

export async function assignOrder(orderId: string, userId: string, userName: string) {
  const s = db();
  await s.from("orders").update({ assigned_to: userId }).eq("id", orderId);
  await s.from("audit_log").insert({ user_name: userName, action: `تعيين ${orderId} لـ ${userName}`, entity_type: "order", entity_id: orderId });
}

export async function deleteOrderCompletely(orderId: string, userName: string) {
  const s = db();

  const { data: order, error: orderErr } = await s
    .from("orders")
    .select("id, customer_id")
    .eq("id", orderId)
    .single();
  if (orderErr || !order) throw new Error("الطلب غير موجود");

  // Soft delete: set deleted_at instead of hard delete
  const { error: delErr } = await s
    .from("orders")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", orderId);
  if (delErr) throw delErr;

  if (order.customer_id) {
    // Recalculate customer KPIs excluding soft-deleted orders
    const { data: remaining } = await s
      .from("orders")
      .select("total, status, created_at")
      .eq("customer_id", order.customer_id)
      .is("deleted_at", null);
    const rows: OrderTotalRow[] = remaining || [];
    const nonRejected = rows.filter((r) => r.status !== "rejected");
    const billable = rows.filter((r) => !["rejected", "new"].includes(r.status));
    const totalSpent = billable.reduce((sum: number, r) => sum + Number(r.total || 0), 0);
    const avg = billable.length > 0 ? totalSpent / billable.length : 0;
    const last = rows.length > 0
      ? rows.map((r) => r.created_at).sort().at(-1) || null
      : null;
    await s.from("customers").update({
      total_orders: nonRejected.length,
      total_spent: totalSpent,
      avg_order_value: avg,
      last_order_at: last,
    }).eq("id", order.customer_id);
  }

  await s.from("audit_log").insert({
    user_name: userName,
    action: `🗑️ حذف الطلب ${orderId}`,
    entity_type: "order_delete",
    entity_id: orderId,
    details: { soft_deleted: true },
  });
}

// ===== Customers =====
export async function getCRMCustomers(filters?: { segment?: string; search?: string; limit?: number; offset?: number }) {
  const s = db();
  const limit = filters?.limit || 100;
  const offset = filters?.offset || 0;

  let query = s.from("customers").select("*", { count: "exact" }).order("total_spent", { ascending: false });
  if (filters?.segment) query = query.eq("segment", filters.segment);
  if (filters?.search) {
    const q = filters.search.trim();
    query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`);
  }
  query = query.range(offset, offset + limit - 1);
  const { data, count } = await query;
  return { data: data || [], total: count || 0 };
}

export async function getCustomerOrders(customerId: string, opts?: { limit?: number }) {
  const s = db();
  const limit = Math.min(Math.max(opts?.limit ?? 100, 1), 500);
  const { data } = await s
    .from("orders")
    .select("*, order_items(*)")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data || [];
}

// ===== Tasks =====
export async function getCRMTasks(filters?: { status?: string; assignedTo?: string; limit?: number }) {
  const s = db();
  const limit = Math.min(Math.max(filters?.limit ?? 200, 1), 500);
  let query = s.from("tasks").select("*, customers(name), orders(id)").order("created_at", { ascending: false });
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.assignedTo) query = query.eq("assigned_to", filters.assignedTo);
  const { data } = await query.limit(limit);
  return data || [];
}

export async function createTask(task: Nullable<Omit<Task, "id" | "created_at" | "updated_at">>) {
  const s = db();
  const { data, error } = await s.from("tasks").insert(task).select().single();
  if (error) throw error;
  return data;
}

export async function updateTask(id: string, updates: Partial<Nullable<Omit<Task, "id">>>) {
  const s = db();
  const { error } = await s.from("tasks").update(updates).eq("id", id);
  if (error) throw error;
}

export async function deleteTask(id: string) {
  await db().from("tasks").delete().eq("id", id);
}

// ===== Pipeline =====
export async function getPipelineDeals() {
  const s = db();
  const { data } = await s.from("pipeline_deals").select("*, customers(name, phone)").order("created_at", { ascending: false });
  return data || [];
}

export async function createDeal(deal: Omit<PipelineDeal, "id" | "created_at" | "updated_at">) {
  const { data, error } = await db().from("pipeline_deals").insert(deal).select().single();
  if (error) throw error;
  return data;
}

export async function updateDeal(id: string, updates: Partial<Omit<PipelineDeal, "id">>) {
  const { error } = await db().from("pipeline_deals").update(updates).eq("id", id);
  if (error) throw error;
}

export async function deleteDeal(id: string) {
  await db().from("pipeline_deals").delete().eq("id", id);
}

// ===== Users =====
export async function getCRMUsers() {
  const s = db();
  const { data: users } = await s.from("users").select("id, auth_id, name, email, phone, role, status, avatar_url, created_at").order("created_at").limit(500);
  const list: AppUser[] = users || [];
  if (list.length === 0) return [];

  // Enrich with orders count per user (assigned_to)
  const { data: orderCounts } = await s.from("orders").select("assigned_to");
  const countMap: Record<string, number> = {};
  (orderCounts || []).forEach((o: AssignedToRow) => {
    if (o.assigned_to) countMap[o.assigned_to] = (countMap[o.assigned_to] || 0) + 1;
  });

  // Enrich with last activity from audit_log
  const { data: auditEntries } = await s.from("audit_log")
    .select("user_name, action, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  const lastActivityMap: Record<string, { action: string; created_at: string }> = {};
  (auditEntries || []).forEach((a: AuditActivityRow) => {
    if (!lastActivityMap[a.user_name]) lastActivityMap[a.user_name] = { action: a.action, created_at: a.created_at };
  });

  return list.map((u) => ({
    ...u,
    orders_count: countMap[u.id] || 0,
    last_activity: lastActivityMap[u.name] || null,
  }));
}

export async function updateUser(id: string, updates: { role?: string; status?: string }, userName = "النظام") {
  const s = db();
  const { error } = await s.from("users").update(updates).eq("id", id);
  if (error) throw error;
  // Record in audit_log
  const changes = Object.entries(updates).map(([k, v]) => `${k}=${v}`).join(", ");
  await s.from("audit_log").insert({
    user_name: userName,
    action: `تحديث مستخدم: ${changes}`,
    entity_type: "user",
    entity_id: id,
    details: updates as Record<string, unknown>,
  });
}

// ===== Audit Log =====
export async function getAuditLog(limit = 50) {
  const { data } = await db().from("audit_log").select("*").order("created_at", { ascending: false }).limit(limit);
  return data || [];
}

// ===== Bot Conversations (CRM Chats) =====
export async function getCRMChats(filters?: { channel?: string; status?: string; search?: string; limit?: number; offset?: number }) {
  const s = db();

  // Count total (before filters for pagination context)
  let countQuery = s.from("bot_conversations").select("id", { count: "exact", head: true });
  if (filters?.channel) countQuery = countQuery.eq("channel", filters.channel);
  if (filters?.status) countQuery = countQuery.eq("status", filters.status);
  const { count: totalCount } = await countQuery;

  // Main query
  let query = s.from("bot_conversations").select("*").order("updated_at", { ascending: false });
  if (filters?.channel) query = query.eq("channel", filters.channel);
  if (filters?.status) query = query.eq("status", filters.status);
  const pageSize = filters?.limit || 50;
  if (filters?.offset) {
    query = query.range(filters.offset, filters.offset + pageSize - 1);
  } else {
    query = query.limit(pageSize);
  }
  const { data } = await query;
  type ConvoResult = BotConversation & {
    last_message?: { content: string | null; role: string; created_at: string } | null;
    customer?: ChatCustomerRow | null;
  };
  let results: ConvoResult[] = (data || []) as ConvoResult[];

  // Client-side search filter (visitor_id, customer_name, customer_phone)
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    results = results.filter((c) =>
      c.visitor_id?.toLowerCase().includes(q) ||
      c.customer_name?.toLowerCase().includes(q) ||
      c.customer_phone?.includes(q)
    );
  }

  // Fetch last_message for each conversation
  if (results.length > 0) {
    const ids = results.map((c) => c.id);
    const { data: lastMsgs } = await s.from("bot_messages")
      .select("conversation_id, content, role, created_at")
      .in("conversation_id", ids)
      .order("created_at", { ascending: false });
    // Group by conversation_id — first per group is the latest
    const lastByConvo: Record<string, LastMessageRow> = {};
    (lastMsgs || []).forEach((m: LastMessageRow) => {
      if (!lastByConvo[m.conversation_id]) lastByConvo[m.conversation_id] = m;
    });
    results = results.map((c) => ({
      ...c,
      last_message: lastByConvo[c.id]
        ? { content: lastByConvo[c.id].content, role: lastByConvo[c.id].role, created_at: lastByConvo[c.id].created_at }
        : null,
    }));
  }

  // Join customer info if customer_id exists
  const customerIds = results.map((c) => c.customer_id).filter(Boolean);
  if (customerIds.length > 0) {
    const { data: customers } = await s.from("customers").select("id, name, phone, email").in("id", customerIds as string[]);
    const custMap: Record<string, ChatCustomerRow> = {};
    (customers || []).forEach((cu: ChatCustomerRow) => { custMap[cu.id] = cu; });
    results = results.map((c) => {
      if (c.customer_id && custMap[c.customer_id]) {
        return { ...c, customer: custMap[c.customer_id] };
      }
      return { ...c, customer: null };
    });
  }

  return { data: results, total: totalCount || results.length };
}

export async function getChatMessages(conversationId: string) {
  const s = db();
  const { data } = await s.from("bot_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  return data || [];
}

export async function closeConversation(conversationId: string) {
  const s = db();
  const { error } = await s.from("bot_conversations")
    .update({ status: "closed" })
    .eq("id", conversationId);
  if (error) throw error;
  await s.from("audit_log").insert({
    user_name: "النظام", action: `إغلاق محادثة ${conversationId}`,
    entity_type: "bot_conversation", entity_id: conversationId,
  });
}

export async function escalateConversation(conversationId: string) {
  const s = db();
  const { error } = await s.from("bot_conversations")
    .update({ status: "escalated" })
    .eq("id", conversationId);
  if (error) throw error;
  await s.from("audit_log").insert({
    user_name: "النظام", action: `تصعيد محادثة ${conversationId}`,
    entity_type: "bot_conversation", entity_id: conversationId,
  });
}

export async function getChatStats() {
  const s = db();
  const { data: convos } = await s.from("bot_conversations").select("id, channel, status, intent, created_at");
  const all: ConvoStatsRow[] = convos || [];
  const total = all.length;
  const whatsapp = all.filter((c) => c.channel === "whatsapp").length;
  const webchat = all.filter((c) => c.channel === "webchat").length;
  const sms = all.filter((c) => c.channel === "sms").length;
  const active = all.filter((c) => c.status === "active").length;
  const escalated = all.filter((c) => c.status === "escalated").length;
  const intentCounts: Record<string, number> = {};
  all.forEach((c) => {
    const intent = c.intent || "unknown";
    intentCounts[intent] = (intentCounts[intent] || 0) + 1;
  });
  return { total, whatsapp, webchat, sms, active, escalated, intentCounts };
}
