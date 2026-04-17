
import { NextRequest } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    const limit = Math.min(parseInt(searchParams.get("limit") || "5"), 10);

    if (!q || q.length < 1) {
      return apiSuccess({ products: [], brands: [], categories: [] });
    }

    const supabase = createAdminSupabase();
    if (!supabase) {
      return apiError("DB unavailable", 500);
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
    products.forEach((p: { brand?: string }) => {
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

      brandRows?.forEach((r: { brand?: string }) => {
        if (r.brand) brandSet.add(r.brand);
      });
    }

    const res = apiSuccess({
      products,
      brands: [...brandSet],
      categories,
    });
    res.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=30");
    return res;
  } catch (err) {
    console.error("Autocomplete error:", err);
    return apiSuccess({ products: [], brands: [], categories: [] });
  }
}
