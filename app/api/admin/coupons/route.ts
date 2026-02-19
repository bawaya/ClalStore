export const runtime = 'edge';

import { NextRequest, NextResponse } from "next/server";
import { getAdminCoupons, createCoupon, updateCoupon, deleteCoupon, logAction } from "@/lib/admin/queries";

export async function GET() {
  try {
    const coupons = await getAdminCoupons();
    return NextResponse.json({ data: coupons });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const coupon = await createCoupon(body);
    await logAction("مدير", `إضافة كوبون: ${body.code}`, "coupon", coupon.id);
    return NextResponse.json({ data: coupon });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const coupon = await updateCoupon(id, updates);
    await logAction("مدير", `تعديل كوبون: ${id}`, "coupon", id);
    return NextResponse.json({ data: coupon });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
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
