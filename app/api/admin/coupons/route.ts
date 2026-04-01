
import { NextRequest, NextResponse } from "next/server";
import { getAdminCoupons, createCoupon, updateCoupon, deleteCoupon, logAction } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/admin/auth";
import { couponSchema, couponUpdateSchema, validateBody } from "@/lib/admin/validators";
import { apiSuccess, apiError, errMsg } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const coupons = await getAdminCoupons();
    return apiSuccess(coupons);
  } catch (err: unknown) {
    return apiError(errMsg(err, "Unknown error"));
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const body = await req.json();
    const v = validateBody(body, couponSchema);
    if (v.error) return apiError(v.error, 400);
    const data = v.data!;
    const coupon = await createCoupon(data);
    await logAction("مدير", `إضافة كوبون: ${data.code}`, "coupon", coupon.id);
    return apiSuccess(coupon);
  } catch (err: unknown) {
    return apiError(errMsg(err, "Unknown error"));
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) return apiError("Missing id", 400);
    const v = validateBody(updates, couponUpdateSchema);
    if (v.error) return apiError(v.error, 400);
    const coupon = await updateCoupon(id, v.data!);
    await logAction("مدير", `تعديل كوبون: ${id}`, "coupon", id);
    return apiSuccess(coupon);
  } catch (err: unknown) {
    return apiError(errMsg(err, "Unknown error"));
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return apiError("Missing id", 400);
    await deleteCoupon(id);
    await logAction("مدير", `حذف كوبون: ${id}`, "coupon", id);
    return apiSuccess(null);
  } catch (err: unknown) {
    return apiError(errMsg(err, "Unknown error"));
  }
}
