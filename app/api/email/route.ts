export const runtime = 'edge';

// =====================================================
// ClalMobile — Email API
// POST: Send transactional emails
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/integrations/hub";
import type { EmailProvider } from "@/lib/integrations/hub";
import { buildOrderConfirmEmail, buildStatusUpdateEmail } from "@/lib/integrations/resend";

export async function POST(req: NextRequest) {
  try {
    const email = await getProvider<EmailProvider>("email");
    if (!email) {
      return NextResponse.json({ error: "Email provider not configured", sent: false }, { status: 200 });
    }

    const body = await req.json();
    const { type } = body;

    let params;

    // Transactional emails require admin auth
    if (type === "order_confirm" || type === "status_update") {
      const { requireAdmin } = await import("@/lib/admin/auth");
      const auth = await requireAdmin(req);
      if (auth instanceof NextResponse) return auth;
    }

    if (type === "order_confirm") {
      const { orderId, customerName, customerEmail, total, items } = body;
      if (!customerEmail) return NextResponse.json({ sent: false, reason: "No email" });
      params = buildOrderConfirmEmail(orderId, customerName, total, items);
      params.to = customerEmail;
    } else if (type === "status_update") {
      const { orderId, customerName, customerEmail, status, statusLabel } = body;
      if (!customerEmail) return NextResponse.json({ sent: false, reason: "No email" });
      params = buildStatusUpdateEmail(orderId, customerName, status, statusLabel);
      params.to = customerEmail;
    } else if (body.to && body.subject && body.html) {
      // Contact form — only allow sending to the store's own email
      const allowedRecipients = [
        process.env.CONTACT_EMAIL || "info@clalmobile.com",
        process.env.SENDGRID_FROM,
        process.env.RESEND_FROM,
      ].filter(Boolean).map(e => e!.toLowerCase());
      const targetEmail = String(body.to).toLowerCase();
      if (!allowedRecipients.includes(targetEmail)) {
        return NextResponse.json({ error: "Unauthorized recipient", sent: false }, { status: 403 });
      }
      const result = await email.send({ to: body.to, subject: body.subject, html: body.html });
      return NextResponse.json({ sent: result.success, messageId: result.messageId });
    } else {
      return NextResponse.json({ error: "Unknown email type" }, { status: 400 });
    }

    const result = await email.send(params);
    return NextResponse.json({ sent: result.success, messageId: result.messageId });
  } catch (err: unknown) {
    return NextResponse.json({ error: "Email sending failed", sent: false }, { status: 200 });
  }
}
