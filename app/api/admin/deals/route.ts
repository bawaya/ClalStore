export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase";
import { apiSuccess, apiError, errMsg } from "@/lib/api-response";
import { requireAdmin } from "@/lib/admin/auth";
import { validateBody, dealSchema, dealUpdateSchema } from "@/lib/admin/validators";

// GET — Public: get active deals / Admin: get all deals
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const admin = url.searchParams.get("admin") === "true";

    if (admin) {
      const auth = await requireAdmin(req);
      if (auth instanceof NextResponse) return auth;
      const db = createAdminSupabase();
      if (!db) return apiSuccess({ deals: [] });
      const { data } = await db.from("deals")
        .select("*")
        .order("sort_order")
        .order("created_at", { ascending: false });
      return apiSuccess({ deals: data || [] });
    }

    // Public: only active deals within date range
    const db = createServerSupabase();
    if (!db) return apiSuccess({ deals: [] });

    // Check if feature is enabled
    const { data: setting } = await db.from("settings").select("value").eq("key", "feature_deals").single();
    if (setting?.value !== "true") return apiSuccess({ deals: [] });

    const now = new Date().toISOString();
    const { data } = await db.from("deals")
      .select("*")
      .eq("active", true)
      .lte("starts_at", now)
      .or(`ends_at.is.null,ends_at.gte.${now}`)
      .order("sort_order");

    const res = apiSuccess({ deals: data || [] });
    res.headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=60");
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

    const db = createAdminSupabase();
    if (!db) return apiError("DB unavailable", 500);

    const body = await req.json();
    const { data: validated, error: valErr } = validateBody(body, dealSchema);
    if (valErr) return apiError(valErr, 400);
    const { data, error } = await db.from("deals").insert(validated).select().single();
    if (error) throw error;
    return apiSuccess(data);
  } catch (err: unknown) {
    console.error("Deal POST error:", err);
    return apiError("فشل في إنشاء العرض", 500);
  }
}

// PUT — Admin: update deal
export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const db = createAdminSupabase();
    if (!db) return apiError("DB unavailable", 500);

    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) return apiError("Missing deal ID", 400);

    const { data: validated, error: valErr } = validateBody(updates, dealUpdateSchema);
    if (valErr || !validated) return apiError(valErr || "Validation failed", 400);
    (validated as Record<string, unknown>).updated_at = new Date().toISOString();
    const { data, error } = await db.from("deals").update(validated).eq("id", id).select().single();
    if (error) throw error;
    return apiSuccess(data);
  } catch (err: unknown) {
    console.error("Deal PUT error:", err);
    return apiError("فشل في تحديث العرض", 500);
  }
}

// DELETE — Admin: delete deal
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const db = createAdminSupabase();
    if (!db) return apiError("DB unavailable", 500);

    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return apiError("Missing ID", 400);

    const { error } = await db.from("deals").delete().eq("id", id);
    if (error) throw error;
    return apiSuccess(null);
  } catch (err: unknown) {
    console.error("Deal DELETE error:", err);
    return apiError("فشل في حذف العرض", 500);
  }
}
