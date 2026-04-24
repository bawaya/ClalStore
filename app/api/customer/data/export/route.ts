// =====================================================
// GET /api/customer/data/export
// Right to data portability (זכות עיון + ניידות) — Amendment 13
// Returns the customer's full personal data in a portable JSON format.
//
// Audited: each request is recorded in data_export_requests.
// =====================================================

import { NextRequest } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { authenticateCustomer } from "@/lib/customer-auth";
import { apiError } from "@/lib/api-response";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function GET(req: NextRequest) {
  const customer = await authenticateCustomer(req);
  if (!customer) return apiError("غير مصرح", 401);

  // Hard-cap: one export per hour to deter abuse
  const rl = checkRateLimit(getRateLimitKey(`data-export:${customer.id}`, clientIp(req)), {
    maxRequests: 4,
    windowMs: 60 * 60 * 1000,
  });
  if (!rl.allowed) return apiError("طلبات كثيرة — حاول بعد ساعة", 429);

  const supabase = createAdminSupabase();
  if (!supabase) return apiError("Service unavailable", 503);

  // 1. Full customer record
  const { data: profile } = await supabase
    .from("customers")
    .select("*")
    .eq("id", customer.id)
    .maybeSingle();

  // Strip auth-internal fields from the export
  if (profile) {
    delete (profile as Record<string, unknown>).auth_token;
    delete (profile as Record<string, unknown>).auth_token_expires_at;
  }

  // 2. Orders (with items)
  const { data: orders } = await supabase
    .from("orders")
    .select("*")
    .eq("customer_id", customer.id)
    .order("created_at", { ascending: false });

  const orderIds = (orders || []).map((o: { id: string }) => o.id);
  let items: unknown[] = [];
  if (orderIds.length > 0) {
    const { data } = await supabase
      .from("order_items")
      .select("*")
      .in("order_id", orderIds);
    items = data || [];
  }

  // 3. Consent log entries
  const { data: consents } = await supabase
    .from("consent_log")
    .select("*")
    .eq("customer_id", customer.id)
    .order("created_at", { ascending: false });

  // 4. HOT linked accounts
  const { data: hotAccounts } = await supabase
    .from("customer_hot_accounts")
    .select("*")
    .eq("customer_id", customer.id);

  // 5. Audit the export request itself
  await supabase.from("data_export_requests").insert({
    customer_id: customer.id,
    delivered_at: new Date().toISOString(),
  });

  const payload = {
    exported_at: new Date().toISOString(),
    privacy_version: "2026-04-24",
    note_ar: "ملف بياناتك الشخصية كاملةً — احتفظ به في مكان آمن.",
    note_he: "קובץ הנתונים האישיים שלך במלואם — שמור אותו במקום מאובטח.",
    profile,
    orders: orders || [],
    order_items: items,
    consent_log: consents || [],
    hot_accounts: hotAccounts || [],
  };

  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="clalmobile-data-${customer.id}-${Date.now()}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
