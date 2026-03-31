
import { NextRequest, NextResponse } from "next/server";
import { getCRMOrders, updateOrderStatus, addOrderNote, assignOrder } from "@/lib/crm/queries";
import { requireAdmin } from "@/lib/admin/auth";
import { apiSuccess, apiError, errMsg } from "@/lib/api-response";

const VALID_STATUSES = [
  "pending", "confirmed", "processing", "shipped", "delivered",
  "cancelled", "returned", "no_reply_1", "no_reply_2", "no_reply_3",
];

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const filters = {
      status: searchParams.get("status") || undefined,
      source: searchParams.get("source") || undefined,
      search: searchParams.get("search") || undefined,
    };
    const data = await getCRMOrders(filters);
    return apiSuccess(data);
  } catch (err: unknown) {
    return apiError(errMsg(err), 500);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json();
    if (body.action === "status") {
      if (!body.orderId || !body.status || !VALID_STATUSES.includes(body.status)) {
        return apiError("orderId and valid status required", 400);
      }
      await updateOrderStatus(body.orderId, body.status, body.userName || "مدير");
      // WhatsApp notification for status change
      if (body.customerPhone) {
        try {
          const { notifyStatusChange } = await import("@/lib/bot/notifications");
          await notifyStatusChange(body.orderId, body.customerPhone, body.status);
        } catch { /* silent */ }
      }
      // Email notification for status change
      if (body.customerEmail && ["confirmed", "processing", "shipped", "delivered", "cancelled"].includes(body.status)) {
        try {
          const { orderStatusEmail } = await import("@/lib/email-templates");
          const { getProvider } = await import("@/lib/integrations/hub");
          const emailProvider = await getProvider<any>("email");
          if (emailProvider) {
            const tmpl = orderStatusEmail(body.orderId, body.customerName || "زبون", body.status);
            await emailProvider.send({
              to: body.customerEmail,
              subject: tmpl.subject,
              html: tmpl.html,
            });
          }
        } catch { /* silent — email failure shouldn't block status update */ }
      }
      // No-reply reminder
      if (body.status?.startsWith("no_reply") && body.customerPhone) {
        try {
          const attempt = parseInt(body.status.split("_")[2]) || 1;
          const { sendNoReplyReminder } = await import("@/lib/bot/notifications");
          await sendNoReplyReminder(body.orderId, body.customerPhone, attempt);
        } catch { /* silent */ }
      }
    } else if (body.action === "note") {
      await addOrderNote(body.orderId, body.userId, body.userName, body.text);
    } else if (body.action === "assign") {
      await assignOrder(body.orderId, body.userId, body.userName);
    }
    return apiSuccess({ ok: true });
  } catch (err: unknown) {
    return apiError(errMsg(err), 500);
  }
}
