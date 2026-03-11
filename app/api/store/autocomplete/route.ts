export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    const limit = Math.min(parseInt(searchParams.get("limit") || "5"), 10);

    if (!q || q.length < 1) {
      return NextResponse.json({ products: [], brands: [], categories: [] });
    }

    const supabase = createAdminSupabase();
    if (!supabase) {
      return NextResponse.json(
        { error: "DB unavailable" },
        { status: 500 }
      );
    }

    const sanitized = q.replace(/[%_\\'"]/g, "");
    const pattern = `%${sanitized}%`;

    const [productsRes, categoriesRes] = await Promise.all([
      supabase
        .from("products")
        .select("id, name_ar, name_he, name_en, brand, price, image_url")
        .eq("active", true)
        .gt("stock", 0)
        .or(
          `name_ar.ilike.${pattern},name_he.ilike.${pattern},name_en.ilike.${pattern},brand.ilike.${pattern}`
        )
        .order("sold", { ascending: false })
        .limit(limit),

      supabase
        .from("categories")
        .select("id, name_ar, name_he")
        .or(`name_ar.ilike.${pattern},name_he.ilike.${pattern}`)
        .limit(3),
    ]);

    const products = productsRes.data || [];
    const categories = categoriesRes.data || [];

    const brandSet = new Set<string>();
    products.forEach((p) => {
      if (p.brand?.toLowerCase().includes(sanitized.toLowerCase())) {
        brandSet.add(p.brand);
      }
    });

    if (brandSet.size === 0) {
      const { data: brandRows } = await supabase
        .from("products")
        .select("brand")
        .eq("active", true)
        .gt("stock", 0)
        .ilike("brand", pattern)
        .limit(5);

      brandRows?.forEach((r) => {
        if (r.brand) brandSet.add(r.brand);
      });
    }

    return NextResponse.json({
      products,
      brands: [...brandSet],
      categories,
    });
  } catch (err) {
    console.error("Autocomplete error:", err);
    return NextResponse.json(
      { products: [], brands: [], categories: [] },
      { status: 500 }
    );
  }
}
