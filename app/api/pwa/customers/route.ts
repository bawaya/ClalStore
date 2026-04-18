/**
 * POST /api/pwa/customers
 *
 * Let a PWA employee create a new customer in the field.
 * Decision 5: PWA agents should be able to add customers they encounter.
 *
 * Dedup: if a customer with the same normalised phone (or same national_id)
 * already exists, return that instead of creating a duplicate.
 */

import { NextRequest } from "next/server";
import { apiError, apiSuccess, safeError } from "@/lib/api-response";
import { createAdminSupabase } from "@/lib/supabase";
import { requireEmployee } from "@/lib/pwa/auth";
import { validateBody } from "@/lib/admin/validators";
import { createCustomerFromPwaSchema } from "@/lib/pwa/validators";
import { buildCustomerPhoneCandidates } from "@/lib/pwa/customer-linking";

export async function POST(req: NextRequest) {
  try {
    const authed = await requireEmployee(req);
    if ("status" in authed) return authed;

    const db = createAdminSupabase();
    if (!db) return apiError("DB unavailable", 500);

    const body = await req.json();
    const validation = validateBody(body, createCustomerFromPwaSchema);
    if (validation.error || !validation.data) {
      return apiError(validation.error || "Invalid payload", 400);
    }
    const payload = validation.data;

    // Dedup by phone (normalised variants)
    const phoneCandidates = buildCustomerPhoneCandidates(payload.phone);
    if (phoneCandidates.length > 0) {
      const { data: existingByPhone } = await db
        .from("customers")
        .select("id, name, phone, id_number")
        .in("phone", phoneCandidates)
        .is("deleted_at", null)
        .limit(1)
        .maybeSingle();

      if (existingByPhone?.id) {
        return apiSuccess({ customer: existingByPhone, existed: true });
      }
    }

    // Dedup by national_id if provided
    if (payload.national_id) {
      const { data: existingById } = await db
        .from("customers")
        .select("id, name, phone, id_number")
        .eq("id_number", payload.national_id)
        .is("deleted_at", null)
        .limit(1)
        .maybeSingle();

      if (existingById?.id) {
        return apiSuccess({ customer: existingById, existed: true });
      }
    }

    // Normalised phone for insert: strip non-digits except leading +
    const normalisedPhone = payload.phone.replace(/[-\s]/g, "");

    const { data: newCust, error } = await db
      .from("customers")
      .insert({
        name: payload.name,
        phone: normalisedPhone,
        email: payload.email || null,
        id_number: payload.national_id || null,
        segment: "new",
        source: "pwa",
        created_by_id: authed.appUserId,
        created_by_name: authed.name,
        total_orders: 0,
        total_spent: 0,
        avg_order_value: 0,
        tags: [],
      })
      .select("id, name, phone, id_number")
      .single();

    if (error || !newCust) {
      console.error("[pwa/customers] insert failed:", error);
      return apiError("فشل في إنشاء الزبون", 500);
    }

    return apiSuccess({ customer: newCust, existed: false }, undefined, 201);
  } catch (err: unknown) {
    return safeError(err, "PWA Customers POST", "خطأ في السيرفر", 500);
  }
}
