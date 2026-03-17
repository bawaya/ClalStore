export const runtime = 'nodejs';

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
    const data = v.data!;
    const product = await createProduct(data);
    await logAction("مدير", `إضافة منتج: ${data.name_ar}`, "product", product.id);
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
    const data = v.data!;
    const product = await updateProduct(id, data);
    await logAction("مدير", `تعديل منتج: ${data.name_ar || id}`, "product", id);
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
    const ids = searchParams.get("ids");

    if (ids) {
      const idList = ids.split(",").map((s) => s.trim()).filter(Boolean);
      if (idList.length === 0) return NextResponse.json({ error: "No IDs provided" }, { status: 400 });
      if (idList.length > 50) return NextResponse.json({ error: "Max 50 items per batch" }, { status: 400 });
      let deleted = 0;
      for (const pid of idList) {
        try {
          await deleteProduct(pid);
          deleted++;
        } catch (e) {
          console.error(`Failed to delete product ${pid}:`, e);
        }
      }
      await logAction("مدير", `حذف جماعي: ${deleted} منتج`, "product", idList[0]);
      return NextResponse.json({ success: true, deleted });
    }

    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    await deleteProduct(id);
    await logAction("مدير", `حذف منتج: ${id}`, "product", id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
