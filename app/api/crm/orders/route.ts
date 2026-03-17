export const runtime = 'edge';

import { NextRequest, NextResponse } from "next/server";
import { getCRMOrders, updateOrderStatus, addOrderNote, assignOrder } from "@/lib/crm/queries";
import { requireAdmin } from "@/lib/admin/auth";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const { searchParams } = new URL(req.url);
    const filters = {
      status: searchParams.get("status") || undefined,
      source: searchParams.get("source") || undefined,
      search: searchParams.get("search") || undefined,
      dateFrom: searchParams.get("dateFrom") || undefined,
      dateTo: searchParams.get("dateTo") || undefined,
      amountMin: searchParams.get("amountMin") ? Number(searchParams.get("amountMin")) : undefined,
      amountMax: searchParams.get("amountMax") ? Number(searchParams.get("amountMax")) : undefined,
    };
    const data = await getCRMOrders(filters);
    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const body = await req.json();
    const userName = auth.email?.split("@")[0] || "مدير";

    if (body.action === "bulk_status" && Array.isArray(body.ids) && body.status) {
      for (const oid of body.ids) {
        await updateOrderStatus(oid, body.status, userName);
      }
      return NextResponse.json({ success: true, updated: body.ids.length });
    } else if (body.action === "status") {
      await updateOrderStatus(body.orderId, body.status, userName);
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
      await addOrderNote(body.orderId, auth.id, userName, body.text);
    } else if (body.action === "assign") {
      await assignOrder(body.orderId, body.userId, userName);
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
