export const runtime = 'edge';

// =====================================================
// ClalMobile — Admin Products API
// GET: list all | POST: create | PUT: update | DELETE
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { getAdminProducts, createProduct, updateProduct, deleteProduct, logAction } from "@/lib/admin/queries";

export async function GET() {
  try {
    const products = await getAdminProducts();
    return NextResponse.json({ data: products });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const product = await createProduct(body);
    await logAction("مدير", `إضافة منتج: ${body.name_ar}`, "product", product.id);
    return NextResponse.json({ data: product });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const product = await updateProduct(id, updates);
    await logAction("مدير", `تعديل منتج: ${updates.name_ar || id}`, "product", id);
    return NextResponse.json({ data: product });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    await deleteProduct(id);
    await logAction("مدير", `حذف منتج: ${id}`, "product", id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
