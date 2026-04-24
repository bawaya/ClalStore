import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { apiSuccess, apiError, errMsg } from "@/lib/api-response";
import { createServerSupabase } from "@/lib/supabase";
import { validateBody, categorySchema, categoryUpdateSchema } from "@/lib/admin/validators";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const kind = new URL(req.url).searchParams.get("kind");
    const kindFilter = kind === "mobile" || kind === "appliance" ? kind : null;

    const sb = createServerSupabase();
    let q = sb.from("categories").select("*");
    if (kindFilter) q = q.eq("kind", kindFilter);
    const { data, error } = await q.order("sort_order", { ascending: true });

    if (error) throw error;
    return apiSuccess(data);
  } catch (err: unknown) {
    console.error("Categories GET error:", err);
    return apiError("فشل في جلب التصنيفات", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json();
    const { data: validated, error: valErr } = validateBody(body, categorySchema);
    if (valErr || !validated) return apiError(valErr || "Validation failed", 400);
    const sb = createServerSupabase();

    const { data, error } = await sb
      .from("categories")
      .insert({
        name_ar: validated.name_ar,
        name_he: validated.name_he,
        type: validated.type,
        kind: validated.kind,
        rule: validated.rule,
        product_ids: validated.product_ids,
        sort_order: validated.sort_order,
        active: validated.active,
      })
      .select()
      .single();

    if (error) throw error;
    return apiSuccess(data);
  } catch (err: unknown) {
    console.error("Categories POST error:", err);
    return apiError("فشل في إضافة التصنيف", 500);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json();
    const { id, ...updates } = body;
    
    if (!id) return apiError("معرف التصنيف مفقود", 400);

    const { data: validated, error: valErr } = validateBody(updates, categoryUpdateSchema);
    if (valErr || !validated) return apiError(valErr || "Validation failed", 400);

    const sb = createServerSupabase();
    const { data, error } = await sb
      .from("categories")
      .update(validated)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return apiSuccess(data);
  } catch (err: unknown) {
    console.error("Categories PUT error:", err);
    return apiError("فشل في تحديث التصنيف", 500);
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
    console.error("Categories DELETE error:", err);
    return apiError("فشل في حذف التصنيف", 500);
  }
}
