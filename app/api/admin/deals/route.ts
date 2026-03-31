export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin/auth";
import { apiSuccess, apiError, errMsg } from "@/lib/api-response";

// GET — Public: get active deals / Admin: get all deals
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const admin = url.searchParams.get("admin") === "true";

    if (admin) {
      const supabase = createAdminSupabase();
      if (!supabase) return apiSuccess({ deals: [] });
      const { data } = await supabase.from("deals")
        .select("*")
        .order("sort_order")
        .order("created_at", { ascending: false })
        .limit(200);
      return apiSuccess({ deals: data || [] });
    }

    // Public: only active deals within date range
    const db = createServerSupabase();
    if (!db) return apiSuccess({ deals: [] });

    // Check if feature is enabled
    const { data: setting } = await db.from("settings").select("value").eq("key", "feature_deals").maybeSingle();
    if (setting?.value !== "true") return apiSuccess({ deals: [] });

    const now = new Date().toISOString();
    const { data } = await db.from("deals")
      .select("*")
      .eq("active", true)
      .lte("starts_at", now)
      .or(`ends_at.is.null,ends_at.gte.${now}`)
      .order("sort_order");

    const res = apiSuccess({ deals: data || [] });
    res.headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    return res;
  } catch {
    return apiSuccess({ deals: [] });
  }
}

// POST — Admin: create deal
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const supabase = createAdminSupabase();
    if (!supabase) return apiError("Unauthorized", 401);

    const body = await req.json();
    const { data, error } = await supabase.from("deals").insert(body).select().single();
    if (error) throw error;
    return apiSuccess(data);
  } catch (err: unknown) {
    return apiError(errMsg(err, "Unknown error"));
  }
}

// PUT — Admin: update deal
export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const supabase = createAdminSupabase();
    if (!supabase) return apiError("Unauthorized", 401);

    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) return apiError("Missing deal ID", 400);

    updates.updated_at = new Date().toISOString();
    const { data, error } = await supabase.from("deals").update(updates).eq("id", id).select().single();
    if (error) throw error;
    return apiSuccess(data);
  } catch (err: unknown) {
    return apiError(errMsg(err, "Unknown error"));
  }
}

// DELETE — Admin: delete deal
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const supabase = createAdminSupabase();
    if (!supabase) return apiError("Unauthorized", 401);

    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return apiError("Missing ID", 400);

    const { error } = await supabase.from("deals").delete().eq("id", id);
    if (error) throw error;
    return apiSuccess(null);
  } catch (err: unknown) {
    return apiError(errMsg(err, "Unknown error"));
  }
}
