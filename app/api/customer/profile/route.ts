export const runtime = 'edge';

// =====================================================
// ClalMobile — Customer Profile API
// GET  /api/customer/profile — fetch profile
// PUT  /api/customer/profile — update profile
// =====================================================

import { NextRequest } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { apiSuccess, apiError } from "@/lib/api-response";

async function authenticateCustomer(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  if (!token || token.length < 32) return null;

  const supabase = createAdminSupabase();
  if (!supabase) return null;

  const { data: customer } = await supabase
    .from("customers")
    .select("id, name, phone, email, city, address")
    .eq("auth_token", token)
    .single();

  return customer;
}

export async function GET(req: NextRequest) {
  try {
    const customer = await authenticateCustomer(req);
    if (!customer) {
      return apiError("غير مصرح", 401);
    }

    return apiSuccess({ customer });
  } catch (err: unknown) {
    console.error("Customer profile GET error:", err);
    return apiError("خطأ في السيرفر", 500);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const customer = await authenticateCustomer(req);
    if (!customer) {
      return apiError("غير مصرح", 401);
    }

    const body = await req.json();
    const { name, email, city, address } = body;

    const supabase = createAdminSupabase();
    if (!supabase) {
      return apiError("خطأ في السيرفر", 500);
    }

    const updates: Record<string, any> = {};
    if (typeof name === "string") updates.name = name.trim().slice(0, 100);
    if (typeof email === "string") updates.email = email.trim().slice(0, 200);
    if (typeof city === "string") updates.city = city.trim().slice(0, 100);
    if (typeof address === "string") updates.address = address.trim().slice(0, 500);

    if (Object.keys(updates).length === 0) {
      return apiError("لا توجد بيانات للتحديث", 400);
    }

    const { data: updated, error } = await supabase
      .from("customers")
      .update(updates)
      .eq("id", (customer as any).id)
      .select("id, name, phone, email, city, address")
      .single();

    if (error) {
      console.error("Customer profile update error:", error);
      return apiError("فشل في تحديث البيانات", 500);
    }

    return apiSuccess({ customer: updated });
  } catch (err: unknown) {
    console.error("Customer profile PUT error:", err);
    return apiError("خطأ في السيرفر", 500);
  }
}
