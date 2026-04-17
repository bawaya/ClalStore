export const dynamic = "force-dynamic";

import { createServerSupabase } from "@/lib/supabase";
import { apiSuccess } from "@/lib/api-response";

// GET /api/reviews/featured — up to 6 approved reviews with product name for homepage
export async function GET() {
  try {
    const db = createServerSupabase();
    if (!db) return apiSuccess({ reviews: [] });

    const { data: reviews } = await db
      .from("product_reviews")
      .select("id, product_id, customer_name, rating, title, body, verified_purchase, created_at")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(6);

    if (!reviews || reviews.length === 0) return apiSuccess({ reviews: [] });

    const productIds = [...new Set(reviews.map((r: any) => r.product_id))];
    const { data: products } = await db
      .from("products")
      .select("id, name_ar, name_he")
      .in("id", productIds);

    const productMap: Record<string, { name_ar: string; name_he?: string }> = {};
    (products || []).forEach((p: any) => {
      productMap[p.id] = { name_ar: p.name_ar, name_he: p.name_he };
    });

    const enriched = reviews.map((r: any) => ({
      ...r,
      product_name: productMap[r.product_id]?.name_ar || productMap[r.product_id]?.name_he || "منتج",
    }));

    const res = apiSuccess({ reviews: enriched });
    res.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
    return res;
  } catch {
    return apiSuccess({ reviews: [] });
  }
}
