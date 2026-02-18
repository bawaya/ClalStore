// =====================================================
// ClalMobile — CRM Queries
// Server-side data access for CRM
// =====================================================

import { createAdminSupabase } from "@/lib/supabase";

const db = () => createAdminSupabase();

// ===== Dashboard =====
export async function getCRMDashboard() {
  const s = db();
  const [orders, customers, tasks, pipeline] = await Promise.all([
    s.from("orders").select("id, status, source, total, created_at, customer_id, assigned_to").order("created_at", { ascending: false }),
    s.from("customers").select("id, name, phone, segment, total_orders, total_spent, last_order_at"),
    s.from("tasks").select("id, status, priority, due_date, assigned_to"),
    s.from("pipeline_deals").select("id, stage, value"),
  ]);

  const o = orders.data || [];
  const c = customers.data || [];
  const t = tasks.data || [];
  const p = pipeline.data || [];

  const revenue = o.filter((x: any) => !["rejected", "new"].includes(x.status)).reduce((s: number, x: any) => s + Number(x.total), 0);
  const byStatus: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  o.forEach((x: any) => { byStatus[x.status] = (byStatus[x.status] || 0) + 1; bySource[x.source] = (bySource[x.source] || 0) + 1; });

  const alerts: { type: string; msg: string; count: number; color: string }[] = [];
  const newCount = o.filter((x: any) => x.status === "new").length;
  const noReply = o.filter((x: any) => x.status?.startsWith("no_reply")).length;
  const noReply3 = o.filter((x: any) => x.status === "no_reply_3").length;
  const openTasks = t.filter((x: any) => x.status !== "done").length;
  const coldCustomers = c.filter((x: any) => x.segment === "cold" || x.segment === "lost").length;

  if (newCount > 0) alerts.push({ type: "new", msg: `${newCount} طلبات جديدة`, count: newCount, color: "#3b82f6" });
  if (noReply > 0) alerts.push({ type: "noReply", msg: `${noReply} بدون رد`, count: noReply, color: "#f97316" });
  if (noReply3 > 0) alerts.push({ type: "noReply3", msg: `${noReply3} لا يرد 3 — قرار مطلوب!`, count: noReply3, color: "#ef4444" });
  if (openTasks > 0) alerts.push({ type: "tasks", msg: `${openTasks} مهام مفتوحة`, count: openTasks, color: "#a855f7" });
  if (coldCustomers > 0) alerts.push({ type: "cold", msg: `${coldCustomers} زبائن باردين`, count: coldCustomers, color: "#eab308" });

  const pipelineValue = p.filter((x: any) => x.stage !== "lost").reduce((s: number, x: any) => s + Number(x.value), 0);

  return {
    totalOrders: o.length, revenue, newCount, noReply, noReply3,
    totalCustomers: c.length, vipCount: c.filter((x: any) => x.segment === "vip").length,
    openTasks, pipelineValue, pipelineDeals: p.length,
    byStatus, bySource, alerts,
    recentOrders: o.slice(0, 5),
  };
}

// ===== Orders =====
export async function getCRMOrders(filters?: { status?: string; source?: string; search?: string }) {
  const s = db();
  let query = s.from("orders").select(`*, order_items(*), order_notes(*), customers(name, phone, segment, id_number)`).order("created_at", { ascending: false });
  if (filters?.status) {
    if (filters.status === "no_reply_all") query = query.like("status", "no_reply%");
    else query = query.eq("status", filters.status);
  }
  if (filters?.source) query = query.eq("source", filters.source);
  const { data } = await query;
  let results = data || [];
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    results = results.filter((o: any) =>
      o.id?.toLowerCase().includes(q) || o.customers?.name?.toLowerCase().includes(q) || o.customers?.phone?.includes(q)
    );
  }
  return results;
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

// ===== Customers =====
export async function getCRMCustomers(filters?: { segment?: string; search?: string }) {
  const s = db();
  let query = s.from("customers").select("*").order("total_spent", { ascending: false });
  if (filters?.segment) query = query.eq("segment", filters.segment);
  const { data } = await query;
  let results = data || [];
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    results = results.filter((c: any) => c.name?.toLowerCase().includes(q) || c.phone?.includes(q) || c.email?.toLowerCase().includes(q));
  }
  return results;
}

export async function getCustomerOrders(customerId: string) {
  const s = db();
  const { data } = await s.from("orders").select("*, order_items(*)" as any).eq("customer_id", customerId).order("created_at", { ascending: false });
  return (data || []) as any[];
}

// ===== Tasks =====
export async function getCRMTasks(filters?: { status?: string; assignedTo?: string }) {
  const s = db();
  let query = s.from("tasks").select("*, customers(name), orders(id)" as any).order("created_at", { ascending: false });
  if (filters?.status) query = query.eq("status", filters.status as any);
  if (filters?.assignedTo) query = query.eq("assigned_to", filters.assignedTo);
  const { data } = await query;
  return data || [];
}

export async function createTask(task: any) {
  const s = db();
  const { data, error } = await s.from("tasks").insert(task).select().single();
  if (error) throw error;
  return data;
}

export async function updateTask(id: string, updates: any) {
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

export async function createDeal(deal: any) {
  const { data, error } = await db().from("pipeline_deals").insert(deal).select().single();
  if (error) throw error;
  return data;
}

export async function updateDeal(id: string, updates: any) {
  const { error } = await db().from("pipeline_deals").update(updates).eq("id", id);
  if (error) throw error;
}

export async function deleteDeal(id: string) {
  await db().from("pipeline_deals").delete().eq("id", id);
}

// ===== Users =====
export async function getCRMUsers() {
  const s = db();
  const { data: users } = await s.from("users").select("*").order("created_at");
  const list = (users || []) as any[];
  if (list.length === 0) return [];

  // Enrich with orders count per user (assigned_to)
  const { data: orderCounts } = await s.from("orders").select("assigned_to");
  const countMap: Record<string, number> = {};
  (orderCounts || []).forEach((o: any) => {
    if (o.assigned_to) countMap[o.assigned_to] = (countMap[o.assigned_to] || 0) + 1;
  });

  // Enrich with last activity from audit_log
  const { data: auditEntries } = await s.from("audit_log")
    .select("user_name, action, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  const lastActivityMap: Record<string, { action: string; created_at: string }> = {};
  (auditEntries || []).forEach((a: any) => {
    if (!lastActivityMap[a.user_name]) lastActivityMap[a.user_name] = { action: a.action, created_at: a.created_at };
  });

  return list.map((u: any) => ({
    ...u,
    orders_count: countMap[u.id] || 0,
    last_activity: lastActivityMap[u.name] || null,
  }));
}

export async function updateUser(id: string, updates: { role?: string; status?: string }, userName = "النظام") {
  const s = db();
  const { error } = await s.from("users").update(updates as any).eq("id", id);
  if (error) throw error;
  // Record in audit_log
  const changes = Object.entries(updates).map(([k, v]) => `${k}=${v}`).join(", ");
  await s.from("audit_log").insert({
    user_name: userName,
    action: `تحديث مستخدم: ${changes}`,
    entity_type: "user",
    entity_id: id,
    details: updates,
  } as any);
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
  if (filters?.channel) countQuery = countQuery.eq("channel", filters.channel as any);
  if (filters?.status) countQuery = countQuery.eq("status", filters.status as any);
  const { count: totalCount } = await countQuery;

  // Main query
  let query = s.from("bot_conversations").select("*").order("updated_at", { ascending: false });
  if (filters?.channel) query = query.eq("channel", filters.channel as any);
  if (filters?.status) query = query.eq("status", filters.status as any);
  if (filters?.limit) query = query.limit(filters.limit);
  if (filters?.offset) query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
  const { data } = await query;
  let results = (data || []) as any[];

  // Client-side search filter (visitor_id, customer_name, customer_phone)
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    results = results.filter((c: any) =>
      c.visitor_id?.toLowerCase().includes(q) ||
      c.customer_name?.toLowerCase().includes(q) ||
      c.customer_phone?.includes(q)
    );
  }

  // Fetch last_message for each conversation
  if (results.length > 0) {
    const ids = results.map((c: any) => c.id);
    const { data: lastMsgs } = await s.from("bot_messages")
      .select("conversation_id, content, role, created_at")
      .in("conversation_id", ids)
      .order("created_at", { ascending: false });
    // Group by conversation_id — first per group is the latest
    const lastByConvo: Record<string, any> = {};
    (lastMsgs || []).forEach((m: any) => {
      if (!lastByConvo[m.conversation_id]) lastByConvo[m.conversation_id] = m;
    });
    results = results.map((c: any) => ({
      ...c,
      last_message: lastByConvo[c.id]
        ? { content: lastByConvo[c.id].content, role: lastByConvo[c.id].role, created_at: lastByConvo[c.id].created_at }
        : null,
    }));
  }

  // Join customer info if customer_id exists
  const customerIds = results.map((c: any) => c.customer_id).filter(Boolean);
  if (customerIds.length > 0) {
    const { data: customers } = await s.from("customers").select("id, name, phone, email").in("id", customerIds);
    const custMap: Record<string, any> = {};
    (customers || []).forEach((cu: any) => { custMap[cu.id] = cu; });
    results = results.map((c: any) => {
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
    .update({ status: "closed" } as any)
    .eq("id", conversationId);
  if (error) throw error;
  await s.from("audit_log").insert({
    user_name: "النظام", action: `إغلاق محادثة ${conversationId}`,
    entity_type: "bot_conversation", entity_id: conversationId,
  } as any);
}

export async function escalateConversation(conversationId: string) {
  const s = db();
  const { error } = await s.from("bot_conversations")
    .update({ status: "escalated" } as any)
    .eq("id", conversationId);
  if (error) throw error;
  await s.from("audit_log").insert({
    user_name: "النظام", action: `تصعيد محادثة ${conversationId}`,
    entity_type: "bot_conversation", entity_id: conversationId,
  } as any);
}

export async function getChatStats() {
  const s = db();
  const { data: convos } = await s.from("bot_conversations").select("id, channel, status, intent, created_at");
  const all = (convos || []) as any[];
  const total = all.length;
  const whatsapp = all.filter((c: any) => c.channel === "whatsapp").length;
  const webchat = all.filter((c: any) => c.channel === "webchat").length;
  const sms = all.filter((c: any) => c.channel === "sms").length;
  const active = all.filter((c: any) => c.status === "active").length;
  const escalated = all.filter((c: any) => c.status === "escalated").length;
  const intentCounts: Record<string, number> = {};
  all.forEach((c: any) => {
    const intent = c.intent || "unknown";
    intentCounts[intent] = (intentCounts[intent] || 0) + 1;
  });
  return { total, whatsapp, webchat, sms, active, escalated, intentCounts };
}
