export const runtime = 'edge';

// =====================================================
// ClalMobile — Admin Product Auto-Fill from GSMArena
// POST: { name, brand } → specs, colors, images
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { fetchProductData } from "@/lib/admin/gsmarena";

export async function POST(req: NextRequest) {
  try {
    const { name, brand } = await req.json();

    if (!name || !brand) {
      return NextResponse.json({ error: "أدخل اسم المنتج والشركة" }, { status: 400 });
    }

    const data = await fetchProductData(name, brand);
    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "فشل في جلب البيانات" }, { status: 500 });
  }
}
