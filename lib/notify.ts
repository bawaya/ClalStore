// =====================================================
// ClalMobile — Notification Helpers
// Server-side helpers to create notifications from events
// =====================================================

import { createAdminSupabase } from "@/lib/supabase";

async function insertNotification(data: {
  user_id?: string | null;
  type: string;
  title: string;
  body?: string;
  link?: string;
  icon?: string;
}) {
  const supabase = createAdminSupabase();
  if (!supabase) return null;

  const { data: row, error } = await supabase
    .from("notifications")
    .insert({
      user_id: data.user_id ?? null,
      type: data.type,
      title: data.title,
      body: data.body ?? null,
      link: data.link ?? null,
      icon: data.icon ?? "🔔",
      read: false,
    })
    .select()
    .single();

  if (error) {
    console.error("[notify] Failed to insert notification:", error.message);
    return null;
  }

  return row;
}

export async function notifyNewOrder(
  orderId: string,
  customerName: string,
  total: number
) {
  return insertNotification({
    type: "order",
    title: `طلب جديد #${orderId}`,
    body: `${customerName} — ₪${total.toLocaleString()}`,
    link: `/crm/orders?id=${orderId}`,
    icon: "🛒",
  });
}

export async function notifyNewMessage(
  customerName: string,
  channel: string
) {
  return insertNotification({
    type: "message",
    title: `رسالة جديدة من ${customerName}`,
    body: `عبر ${channel}`,
    link: "/crm/inbox",
    icon: "💬",
  });
}

export async function notifyTaskAssigned(
  userId: string,
  taskTitle: string
) {
  return insertNotification({
    user_id: userId,
    type: "task",
    title: "مهمة جديدة مُسندة إليك",
    body: taskTitle,
    link: "/crm/tasks",
    icon: "📋",
  });
}

export async function notifyAlert(title: string, body: string) {
  return insertNotification({
    type: "alert",
    title,
    body,
    icon: "⚠️",
  });
}
