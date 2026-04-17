import { NextRequest } from "next/server";
import { apiError, apiSuccess, safeError } from "@/lib/api-response";
import { createAdminSupabase } from "@/lib/supabase";
import { requireEmployee } from "@/lib/pwa/auth";
import { buildCustomerPhoneCandidates } from "@/lib/pwa/customer-linking";

export async function GET(req: NextRequest) {
  try {
    const authed = await requireEmployee(req);
    if ("status" in authed) return authed;

    const db = createAdminSupabase();
    if (!db) return apiError("DB unavailable", 500);

    const { searchParams } = new URL(req.url);
    const phone = searchParams.get("phone")?.trim();
    const code = searchParams.get("code")?.trim();

    if (!phone && !code) return apiError("phone or code required", 400);

    let query = db.from("customers").select("id, name, phone, customer_code").limit(1);

    if (phone) {
      const candidates = buildCustomerPhoneCandidates(phone);
      query = query.in("phone", candidates);
    } else if (code) {
      query = query.eq("customer_code", code);
    }

    const { data, error } = await query.maybeSingle();
    if (error || !data) return apiSuccess(null);

    return apiSuccess(data);
  } catch (err: unknown) {
    return safeError(err, "PWA Customer Lookup", "خطأ في السيرفر", 500);
  }
}
