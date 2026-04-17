// =====================================================
// ClalMobile — Customer Profile API
// GET  /api/customer/profile — fetch profile
// PUT  /api/customer/profile — update profile
// =====================================================

import { NextRequest } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { apiSuccess, apiError } from "@/lib/api-response";
import { authenticateCustomer } from "@/lib/customer-auth";

async function listCustomerHotAccounts(customerId: string) {
  const supabase = createAdminSupabase();
  if (!supabase) return null;

  const { data } = await supabase
    .from("customer_hot_accounts")
    .select("id, hot_mobile_id, hot_customer_code, line_phone, label, status, is_primary, source, created_at")
    .eq("customer_id", customerId)
    .is("ended_at", null)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: false });

  return data || [];
}

export async function GET(req: NextRequest) {
  try {
    const customer = await authenticateCustomer(req);
    if (!customer) {
      return apiError("ØºÙŠØ± Ù…ØµØ±Ø­", 401);
    }

    const hotAccounts = await listCustomerHotAccounts((customer as any).id);
    return apiSuccess({ customer, hotAccounts: hotAccounts || [] });
  } catch (err: unknown) {
    console.error("Customer profile GET error:", err);
    return apiError("Ø®Ø·Ø£ ÙÙŠ Ø§Ù„Ø³ÙŠØ±ÙØ±", 500);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const customer = await authenticateCustomer(req);
    if (!customer) {
      return apiError("ØºÙŠØ± Ù…ØµØ±Ø­", 401);
    }

    const body = await req.json();
    const { name, email, city, address } = body;

    const supabase = createAdminSupabase();
    if (!supabase) {
      return apiError("Ø®Ø·Ø£ ÙÙŠ Ø§Ù„Ø³ÙŠØ±ÙØ±", 500);
    }

    const updates: Record<string, string> = {};
    if (typeof name === "string") updates.name = name.trim().slice(0, 100);
    if (typeof email === "string") updates.email = email.trim().slice(0, 200);
    if (typeof city === "string") updates.city = city.trim().slice(0, 100);
    if (typeof address === "string") updates.address = address.trim().slice(0, 500);

    if (Object.keys(updates).length === 0) {
      return apiError("Ù„Ø§ ØªÙˆØ¬Ø¯ Ø¨ÙŠØ§Ù†Ø§Øª Ù„Ù„ØªØ­Ø¯ÙŠØ«", 400);
    }

    const { data: updated, error } = await supabase
      .from("customers")
      .update(updates)
      .eq("id", (customer as any).id)
      .select("id, name, phone, email, city, address, customer_code")
      .single();

    if (error) {
      console.error("Customer profile update error:", error);
      return apiError("ÙØ´Ù„ ÙÙŠ ØªØ­Ø¯ÙŠØ« Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª", 500);
    }

    const hotAccounts = await listCustomerHotAccounts((customer as any).id);
    return apiSuccess({ customer: updated, hotAccounts: hotAccounts || [] });
  } catch (err: unknown) {
    console.error("Customer profile PUT error:", err);
    return apiError("Ø®Ø·Ø£ ÙÙŠ Ø§Ù„Ø³ÙŠØ±ÙØ±", 500);
  }
}
