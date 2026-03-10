export const runtime = 'edge';

import { NextRequest, NextResponse } from "next/server";
import { getAdminCoupons, createCoupon, updateCoupon, deleteCoupon, logAction } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/admin/auth";
import { couponSchema, couponUpdateSchema, validateBody } from "@/lib/admin/validators";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const coupons = await getAdminCoupons();
    return NextResponse.json({ data: coupons });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const body = await req.json();
    const v = validateBody(body, couponSchema);
    if (v.error) return NextResponse.json({ error: v.error }, { status: 400 });
    const coupon = await createCoupon(v.data);
    await logAction("مدير", `إضافة كوبون: ${v.data.code}`, "coupon", coupon.id);
    return NextResponse.json({ data: coupon });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const v = validateBody(updates, couponUpdateSchema);
    if (v.error) return NextResponse.json({ error: v.error }, { status: 400 });
    const coupon = await updateCoupon(id, v.data);
    await logAction("مدير", `تعديل كوبون: ${id}`, "coupon", id);
    return NextResponse.json({ data: coupon });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    await deleteCoupon(id);
    await logAction("مدير", `حذف كوبون: ${id}`, "coupon", id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
