// =====================================================
// POST /api/customer/data/delete
// Right to erasure (זכות מחיקה) — Amendment 13
//
// Soft-delete model:
//   • Sets deletion_requested_at on customers
//   • Strips PII (email, address) from the row
//   • Anonymizes the name to "(נמחק)"
//   • Keeps id_number + orders for 7 years (mandatory tax retention)
//   • Invalidates auth tokens immediately
// =====================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { createAdminSupabase } from "@/lib/supabase";
import { authenticateCustomer } from "@/lib/customer-auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";

const bodySchema = z.object({
  /** User must type a confirmation phrase to prevent accidents. */
  confirm: z.string(),
  /** Optional reason for our internal records (NOT a legal requirement). */
  reason: z.string().max(500).optional(),
});

const CONFIRM_PHRASES = ["DELETE", "מחק", "احذف", "حذف"];

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(req: NextRequest) {
  const customer = await authenticateCustomer(req);
  if (!customer) return apiError("غير مصرح", 401);

  const rl = checkRateLimit(getRateLimitKey(`data-delete:${customer.id}`, clientIp(req)), {
    maxRequests: 3,
    windowMs: 24 * 60 * 60 * 1000,
  });
  if (!rl.allowed) return apiError("طلبات كثيرة — حاول لاحقاً", 429);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid body", 400);
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return apiError("Invalid payload", 400);

  if (!CONFIRM_PHRASES.includes(parsed.data.confirm.trim())) {
    return apiError("لتأكيد الحذف اكتب \"حذف\" أو \"DELETE\" أو \"מחק\"", 400);
  }

  const supabase = createAdminSupabase();
  if (!supabase) return apiError("Service unavailable", 503);

  // Soft-delete + PII redaction. Tax-relevant fields kept (Income Tax Ordinance, 7 years).
  const { error: updErr } = await supabase
    .from("customers")
    .update({
      name: "(נמחק / محذوف)",
      email: null,
      city: null,
      address: null,
      birthday: null,
      tags: [],
      notes: null,
      // Withdraw all consents
      consent_functional: false,
      consent_analytics: false,
      consent_advertising: false,
      consent_marketing_email: false,
      consent_marketing_sms: false,
      consent_marketing_whatsapp: false,
      // Soft-delete markers
      deletion_requested_at: new Date().toISOString(),
      deletion_processed_at: new Date().toISOString(),
      // Invalidate auth so the user is logged out everywhere
      auth_token: null,
      auth_token_expires_at: null,
    })
    .eq("id", customer.id);

  if (updErr) {
    console.error("Delete update error:", updErr);
    return apiError("فشل حذف الحساب", 500);
  }

  // Audit log
  try {
    await supabase.from("consent_log").insert({
      visitor_id: `customer:${customer.id}`,
      customer_id: customer.id,
      source: "withdraw",
      essential: true,
      functional: false,
      analytics: false,
      advertising: false,
      privacy_version: "2026-04-24",
      user_agent: req.headers.get("user-agent")?.slice(0, 500) || null,
    });
  } catch {
    /* non-blocking */
  }

  return apiSuccess({
    deleted: true,
    note_ar: "تم حذف بياناتك الشخصية. ستبقى الفواتير محفوظة لمدة 7 سنوات وفقاً لقانون ضريبة الدخل.",
    note_he: "המידע האישי שלך נמחק. החשבוניות יישמרו 7 שנים על פי פקודת מס הכנסה.",
  });
}
