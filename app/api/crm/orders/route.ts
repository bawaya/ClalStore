import { NextRequest } from "next/server";
import { withPermission } from "@/lib/admin/auth";
import { apiError, apiSuccess } from "@/lib/api-response";
import {
  addOrderNote,
  assignOrder,
  deleteOrderCompletely,
  getCRMOrders,
} from "@/lib/crm/queries";
import { updateOrderStatusWithHistory } from "@/lib/orders/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

const VALID_STATUSES = new Set([
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
]);

async function runPostStatusSideEffects(
  db: SupabaseClient,
  orderId: string,
  status: string,
) {
  const { data: order } = await db
    .from("orders")
    .select("id, status, created_at, customers(name, phone, email)")
    .eq("id", orderId)
    .single();

  if (!order) return;

  try {
    const { syncCommissionForOrder } = await import("@/lib/commissions/sync-orders");
    await syncCommissionForOrder(orderId, db);
  } catch (err) {
    console.error("Commission sync failed for order:", orderId, err);
  }

  const customer = Array.isArray(order.customers) ? order.customers[0] : order.customers;
  const customerPhone = customer?.phone;
  const customerEmail = customer?.email;
  const customerName = customer?.name || "زَبون";

  if (customerPhone) {
    try {
      const { notifyStatusChange } = await import("@/lib/bot/notifications");
      await notifyStatusChange(orderId, customerPhone, status);
    } catch (err) {
      console.error("WhatsApp status notification failed:", orderId, err);
    }
  }

  // Admin notification for completed orders
  if (["delivered", "shipped"].includes(status)) {
    try {
      const { notifyAdminOrderCompleted } = await import("@/lib/bot/admin-notify");
      await notifyAdminOrderCompleted({
        orderId,
        customerName,
        customerPhone: customerPhone || undefined,
        total: Number((order as any).total || 0),
        status,
      });
    } catch (err) {
      console.error("Admin order-completed notification failed:", orderId, err);
    }
  }

  if (customerEmail && ["approved", "processing", "shipped", "delivered", "cancelled"].includes(status)) {
    try {
      const { orderStatusEmail } = await import("@/lib/email-templates");
      const { getProvider } = await import("@/lib/integrations/hub");
      const emailProvider = await getProvider<any>("email");
      if (emailProvider) {
        const tmpl = orderStatusEmail(orderId, customerName, status);
        await emailProvider.send({
          to: customerEmail,
          subject: tmpl.subject,
          html: tmpl.html,
        });
      }
    } catch (err) {
      console.error("Email status notification failed:", orderId, err);
    }
  }

  if (status.startsWith("no_reply") && customerPhone) {
    try {
      const attempt = parseInt(status.split("_")[2] || "1", 10) || 1;
      const { sendNoReplyReminder } = await import("@/lib/bot/notifications");
      await sendNoReplyReminder(orderId, customerPhone, attempt);
    } catch (err) {
      console.error("No-reply reminder failed:", orderId, err);
    }
  }
}

export const GET = withPermission(
  "orders",
  "view",
  async (req: NextRequest) => {
    const { searchParams } = new URL(req.url);
    const pt = searchParams.get("productType");
    const productType: "device" | "accessory" | "appliance" | undefined =
      pt === "device" || pt === "accessory" || pt === "appliance" ? pt : undefined;
    const filters = {
      status: searchParams.get("status") || undefined,
      source: searchParams.get("source") || undefined,
      search: searchParams.get("search") || undefined,
      dateFrom: searchParams.get("dateFrom") || undefined,
      dateTo: searchParams.get("dateTo") || undefined,
      amountMin: searchParams.get("amountMin") ? Number(searchParams.get("amountMin")) : undefined,
      amountMax: searchParams.get("amountMax") ? Number(searchParams.get("amountMax")) : undefined,
      productType,
    };
    const data = await getCRMOrders(filters);
    return apiSuccess(data);
  },
);

export const PUT = withPermission(
  "orders",
  "edit",
  async (req: NextRequest, db: SupabaseClient, user) => {
    const body = await req.json();
    const actorName = user.name || "Admin";
    const actorId = user.appUserId || user.id;

    if (body.action === "status") {
      if (!body.orderId || !body.status || !VALID_STATUSES.has(body.status)) {
        return apiError("orderId and valid status required", 400);
      }

      await updateOrderStatusWithHistory(db, {
        orderId: body.orderId,
        newStatus: body.status,
        actor: user,
        notes: body.notes,
      });
      await runPostStatusSideEffects(db, body.orderId, body.status);
      return apiSuccess({ ok: true });
    }

    if (body.action === "bulk_status") {
      const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean) : [];
      if (!ids.length || !body.status || !VALID_STATUSES.has(body.status)) {
        return apiError("ids and valid status required", 400);
      }

      for (const orderId of ids) {
        await updateOrderStatusWithHistory(db, {
          orderId,
          newStatus: body.status,
          actor: user,
          notes: body.notes,
        });
        await runPostStatusSideEffects(db, orderId, body.status);
      }

      return apiSuccess({ ok: true, updated: ids.length });
    }

    if (body.action === "note") {
      if (!body.orderId || !body.text?.trim()) {
        return apiError("orderId and text required", 400);
      }
      await addOrderNote(body.orderId, actorId, actorName, body.text.trim());
      return apiSuccess({ ok: true });
    }

    if (body.action === "assign") {
      if (!body.orderId || !body.userId || !body.userName) {
        return apiError("orderId, userId and userName required", 400);
      }
      await assignOrder(body.orderId, body.userId, body.userName);
      await runPostStatusSideEffects(db, body.orderId, "__assignment__");
      return apiSuccess({ ok: true });
    }

    if (body.action === "delete") {
      if (!body.orderId) {
        return apiError("orderId required", 400);
      }
      await deleteOrderCompletely(body.orderId, actorName);
      return apiSuccess({ ok: true });
    }

    return apiError("Unsupported action", 400);
  },
);
