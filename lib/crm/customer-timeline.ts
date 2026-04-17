type TimelineEntryType = "order" | "deal" | "conversation" | "note" | "hot" | "audit";

type TimelineOrder = {
  id: string;
  status?: string | null;
  total?: number | null;
  created_at: string;
};

type TimelineDeal = {
  id: string;
  stage?: string | null;
  product_name?: string | null;
  product_summary?: string | null;
  employee_name?: string | null;
  estimated_value?: number | null;
  value?: number | null;
  created_at: string;
};

type TimelineConversation = {
  id: string;
  channel?: string | null;
  status?: string | null;
  customer_name?: string | null;
  updated_at: string;
};

type TimelineNote = {
  id: string;
  text: string;
  user_name?: string | null;
  created_at: string;
};

type TimelineHotAccount = {
  id: string;
  label?: string | null;
  hot_mobile_id?: string | null;
  hot_customer_code?: string | null;
  line_phone?: string | null;
  status?: string | null;
  source?: string | null;
  created_at: string;
};

type TimelineAudit = {
  id: string;
  action: string;
  module?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  details?: Record<string, unknown> | null;
  user_name?: string | null;
  created_at: string;
};

export type CustomerTimelineEntry = {
  id: string;
  type: TimelineEntryType;
  title: string;
  description: string;
  actorName?: string | null;
  createdAt: string;
  entityType?: string | null;
  entityId?: string | null;
};

function formatMoney(value?: number | null) {
  const amount = Number(value || 0);
  return `₪${amount.toLocaleString()}`;
}

function truncate(value?: string | null, max = 140) {
  if (!value) return "";
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function summarizeAuditDetails(details?: Record<string, unknown> | null) {
  if (!details) return "";

  const hotMobileId = typeof details.hot_mobile_id === "string" ? details.hot_mobile_id : "";
  const hotCustomerCode =
    typeof details.hot_customer_code === "string" ? details.hot_customer_code : "";
  const customerId = typeof details.customer_id === "string" ? details.customer_id : "";
  const archived = details.archived === true ? "أرشفة" : "";

  return [hotMobileId, hotCustomerCode, customerId, archived].filter(Boolean).join(" • ");
}

export function buildCustomerTimeline(input: {
  orders?: TimelineOrder[];
  deals?: TimelineDeal[];
  conversations?: TimelineConversation[];
  notes?: TimelineNote[];
  hotAccounts?: TimelineHotAccount[];
  audits?: TimelineAudit[];
}): CustomerTimelineEntry[] {
  const entries: CustomerTimelineEntry[] = [];

  for (const order of input.orders || []) {
    entries.push({
      id: `order-${order.id}`,
      type: "order",
      title: `طلب ${order.id}`,
      description: [order.status || "بدون حالة", formatMoney(order.total)].filter(Boolean).join(" • "),
      createdAt: order.created_at,
      entityType: "order",
      entityId: order.id,
    });
  }

  for (const deal of input.deals || []) {
    const amount = deal.estimated_value ?? deal.value;
    entries.push({
      id: `deal-${deal.id}`,
      type: "deal",
      title: deal.product_name || deal.product_summary || "صفقة CRM",
      description: [deal.stage || "بدون مرحلة", amount ? formatMoney(amount) : "", deal.employee_name || ""]
        .filter(Boolean)
        .join(" • "),
      actorName: deal.employee_name || null,
      createdAt: deal.created_at,
      entityType: "pipeline_deal",
      entityId: deal.id,
    });
  }

  for (const conversation of input.conversations || []) {
    entries.push({
      id: `conversation-${conversation.id}`,
      type: "conversation",
      title: `محادثة ${conversation.channel || "webchat"}`,
      description: [conversation.status || "بدون حالة", conversation.customer_name || ""]
        .filter(Boolean)
        .join(" • "),
      createdAt: conversation.updated_at,
      entityType: "bot_conversation",
      entityId: conversation.id,
    });
  }

  for (const note of input.notes || []) {
    entries.push({
      id: `note-${note.id}`,
      type: "note",
      title: "ملاحظة عميل",
      description: truncate(note.text, 180),
      actorName: note.user_name || null,
      createdAt: note.created_at,
      entityType: "customer_note",
      entityId: note.id,
    });
  }

  for (const account of input.hotAccounts || []) {
    entries.push({
      id: `hot-${account.id}`,
      type: "hot",
      title: account.label || account.hot_customer_code || account.hot_mobile_id || "حساب HOT",
      description: [account.status || "بدون حالة", account.hot_mobile_id || "", account.line_phone || "", account.source || ""]
        .filter(Boolean)
        .join(" • "),
      createdAt: account.created_at,
      entityType: "customer_hot_account",
      entityId: account.id,
    });
  }

  for (const audit of input.audits || []) {
    entries.push({
      id: `audit-${audit.id}`,
      type: "audit",
      title: audit.action,
      description: [audit.module || "", summarizeAuditDetails(audit.details)].filter(Boolean).join(" • "),
      actorName: audit.user_name || null,
      createdAt: audit.created_at,
      entityType: audit.entity_type || null,
      entityId: audit.entity_id || null,
    });
  }

  return entries.sort((a, b) => {
    const aTime = new Date(a.createdAt).getTime();
    const bTime = new Date(b.createdAt).getTime();
    return bTime - aTime;
  });
}
