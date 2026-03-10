export const runtime = 'edge';

// =====================================================
// ClalMobile — Admin Products API
// GET: list all | POST: create | PUT: update | DELETE
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { getAdminProducts, createProduct, updateProduct, deleteProduct, logAction } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/admin/auth";
import { productSchema, productUpdateSchema, validateBody } from "@/lib/admin/validators";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const products = await getAdminProducts();
    return NextResponse.json({ data: products });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const body = await req.json();
    const v = validateBody(body, productSchema);
    if (v.error) return NextResponse.json({ error: v.error }, { status: 400 });
    const product = await createProduct(v.data);
    await logAction("مدير", `إضافة منتج: ${v.data.name_ar}`, "product", product.id);
    return NextResponse.json({ data: product });
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
    const v = validateBody(updates, productUpdateSchema);
    if (v.error) return NextResponse.json({ error: v.error }, { status: 400 });
    const product = await updateProduct(id, v.data);
    await logAction("مدير", `تعديل منتج: ${v.data.name_ar || id}`, "product", id);
    return NextResponse.json({ data: product });
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
    await deleteProduct(id);
    await logAction("مدير", `حذف منتج: ${id}`, "product", id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
