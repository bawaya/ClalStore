export const runtime = 'edge';

// =====================================================
// ClalMobile — Admin Website Content API
// GET: list all | PUT: update section
// =====================================================

import { NextRequest } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { apiSuccess, apiError, errMsg } from "@/lib/api-response";

export async function GET() {
  try {
    const db = createAdminSupabase();
    const { data, error } = await db
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
    const db = createAdminSupabase();
    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) return apiError("Missing id", 400);

    const { data, error } = await db
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
