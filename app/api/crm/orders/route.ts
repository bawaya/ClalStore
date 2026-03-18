export const runtime = 'edge';

import { NextRequest, NextResponse } from "next/server";
import { getCRMOrders, updateOrderStatus, addOrderNote, assignOrder, deleteOrderCompletely } from "@/lib/crm/queries";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminSupabase } from "@/lib/supabase";

async function notifyOrderCompleted(orderId: string, status: string, body: any) {
  try {
    const db = createAdminSupabase();
    const { data: order } = await db
      .from("orders")
      .select("id, total, source, customer_id, customers(name, phone, email)")
      .eq("id", orderId)
      .single();

    const customer = (order?.customers as any) || {};
    const customerName = body.customerName || customer.name || "زبون";
    const customerPhone = body.customerPhone || customer.phone || "";
    const customerEmail = customer.email || body.customerEmail || "";
    const total = Number(body.total ?? order?.total ?? 0);

    // 1) WhatsApp alert to admin from reports number
    try {
      const { notifyAdminOrderCompleted } = await import("@/lib/bot/admin-notify");
      await notifyAdminOrderCompleted({
        orderId,
        customerName,
        customerPhone,
        total,
        status,
      });
    } catch (waErr) {
      console.error("Admin WhatsApp completed-order notification failed:", waErr);
    }

    // 2) Email alert for completed orders (configurable from WhatsApp integration)
    try {
      const { getIntegrationConfig, getProvider } = await import("@/lib/integrations/hub");
      const waCfg = await getIntegrationConfig("whatsapp");
      const toEmail = waCfg.completed_orders_email || "bawaya@icloud.com";
      const emailProvider = await getProvider<any>("email");
      if (emailProvider && toEmail) {
        const subject = `✅ اكتمل طلب ${orderId}`;
        const html = `
          <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;max-width:640px;margin:0 auto;background:#fff;border:1px solid #eee;border-radius:12px;padding:18px">
            <h2 style="margin:0 0 12px;color:#111">✅ اكتمل طلب جديد</h2>
            <p style="margin:6px 0"><strong>رقم الطلب:</strong> ${orderId}</p>
            <p style="margin:6px 0"><strong>اسم الزبون:</strong> ${customerName}</p>
            ${customerPhone ? `<p style="margin:6px 0"><strong>هاتف الزبون:</strong> ${customerPhone}</p>` : ""}
            <p style="margin:6px 0"><strong>المجموع:</strong> ₪${total.toLocaleString()}</p>
            <p style="margin:6px 0"><strong>الحالة:</strong> ${status}</p>
            ${customerEmail ? `<p style="margin:6px 0"><strong>إيميل الزبون:</strong> ${customerEmail}</p>` : ""}
            <p style="margin:14px 0 0">
              <a href="https://clalmobile.com/crm/orders?search=${orderId}" style="color:#c41040;text-decoration:none">فتح الطلب في CRM</a>
            </p>
          </div>`;
        await emailProvider.send({ to: toEmail, subject, html });
      }
    } catch (emailErr) {
      console.error("Admin completed-order email notification failed:", emailErr);
    }
  } catch (err) {
    console.error("notifyOrderCompleted failed:", err);
  }
}

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
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
      offset: searchParams.get("offset") ? Number(searchParams.get("offset")) : undefined,
    };
    const result = await getCRMOrders(filters);
    return NextResponse.json({ data: result.data, total: result.total });
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
      const db = createAdminSupabase();
      const { data: beforeOrder } = await db
        .from("orders")
        .select("status")
        .eq("id", body.orderId)
        .single();
      const previousStatus = beforeOrder?.status;

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

      // Completed order notifications to admin (WA + email)
      if (["delivered", "completed"].includes(body.status) && previousStatus !== body.status) {
        await notifyOrderCompleted(body.orderId, body.status, body);
      }
    } else if (body.action === "note") {
      await addOrderNote(body.orderId, auth.id, userName, body.text);
    } else if (body.action === "assign") {
      await assignOrder(body.orderId, body.userId, userName);
    } else if (body.action === "delete") {
      await deleteOrderCompletely(body.orderId, userName);
      return NextResponse.json({ success: true, deleted: body.orderId });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
