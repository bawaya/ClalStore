
import { NextRequest, NextResponse } from "next/server";
import {
  getAdminSpotlights,
  createSpotlight,
  updateSpotlight,
  deleteSpotlight,
  logAction,
} from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/admin/auth";
import { spotlightSchema, spotlightUpdateSchema, validateBody } from "@/lib/admin/validators";
import { apiSuccess, apiError } from "@/lib/api-response";

// =====================================================
// /api/admin/store-spotlights
// Editorial spotlight rows for the /store page.
// Mirrors the /api/admin/heroes shape (single route file with all 4 verbs).
// =====================================================

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const rows = await getAdminSpotlights();
    return apiSuccess(rows);
  } catch (err: unknown) {
    console.error("Spotlights GET error:", err);
    return apiError("فشل في جلب الـ spotlights", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const body = await req.json();
    const v = validateBody(body, spotlightSchema);
    if (v.error) return apiError(v.error, 400);
    const data = v.data!;
    const row = await createSpotlight(data as any);
    await logAction(
      "مدير",
      `إضافة spotlight (موضع ${data.position})`,
      "store_spotlight",
      row.id
    );
    return apiSuccess(row);
  } catch (err: unknown) {
    console.error("Spotlights POST error:", err);
    // Duplicate-position case: surface a friendlier message
    const msg = (err as { message?: string })?.message || "";
    if (msg.includes("store_spotlights_active_position_uniq")) {
      return apiError("هذا الموضع مشغول بـ spotlight نشط آخر — أوقفه أولاً", 409);
    }
    return apiError("فشل في إضافة الـ spotlight", 500);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) return apiError("Missing id", 400);
    const v = validateBody(updates, spotlightUpdateSchema);
    if (v.error) return apiError(v.error, 400);
    const row = await updateSpotlight(id, v.data! as any);
    await logAction("مدير", `تعديل spotlight: ${id}`, "store_spotlight", id);
    return apiSuccess(row);
  } catch (err: unknown) {
    console.error("Spotlights PUT error:", err);
    const msg = (err as { message?: string })?.message || "";
    if (msg.includes("store_spotlights_active_position_uniq")) {
      return apiError("هذا الموضع مشغول بـ spotlight نشط آخر — أوقفه أولاً", 409);
    }
    return apiError("فشل في تحديث الـ spotlight", 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return apiError("Missing id", 400);
    await deleteSpotlight(id);
    await logAction("مدير", `حذف spotlight: ${id}`, "store_spotlight", id);
    return apiSuccess(null);
  } catch (err: unknown) {
    console.error("Spotlights DELETE error:", err);
    return apiError("فشل في حذف الـ spotlight", 500);
  }
}
