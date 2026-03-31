
// =====================================================
// ClalMobile — Admin Website Content API
// GET: list all | PUT: update section
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin/auth";
import { apiSuccess, apiError, errMsg } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const supabase = createAdminSupabase();
    const { data, error } = await supabase
      .from("website_content")
      .select("*")
      .order("sort_order");

    if (error) throw error;
    return apiSuccess(data || []);
  } catch (err: unknown) {
    return apiError(errMsg(err, "Unknown error"));
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const supabase = createAdminSupabase();
    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) return apiError("Missing id", 400);

    const { data, error } = await supabase
      .from("website_content")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return apiSuccess(data);
  } catch (err: unknown) {
    return apiError(errMsg(err, "Unknown error"));
  }
}
