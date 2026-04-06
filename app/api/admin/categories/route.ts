import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { apiSuccess, apiError, errMsg } from "@/lib/api-response";
import { createServerSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const sb = createServerSupabase();
    const { data, error } = await sb
      .from("categories")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) throw error;
    return apiSuccess(data);
  } catch (err: unknown) {
    return apiError(errMsg(err), 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json();
    const sb = createServerSupabase();

    const { data, error } = await sb
      .from("categories")
      .insert({
        name_ar: body.name_ar,
        name_he: body.name_he,
        type: body.type || "manual",
        rule: body.rule || null,
        product_ids: body.product_ids || [],
        sort_order: body.sort_order || 0,
        active: body.active !== false,
      })
      .select()
      .single();

    if (error) throw error;
    return apiSuccess(data);
  } catch (err: unknown) {
    return apiError(errMsg(err), 500);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json();
    const { id, ...updates } = body;
    
    if (!id) return apiError("معرف التصنيف مفقود", 400);

    const sb = createServerSupabase();
    const { data, error } = await sb
      .from("categories")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return apiSuccess(data);
  } catch (err: unknown) {
    return apiError(errMsg(err), 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    
    if (!id) return apiError("معرف التصنيف مفقود", 400);

    const sb = createServerSupabase();
    const { error } = await sb
      .from("categories")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return apiSuccess({ success: true });
  } catch (err: unknown) {
    return apiError(errMsg(err), 500);
  }
}
