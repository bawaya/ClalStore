export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { NextRequest } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase";
import { apiSuccess, apiError, errMsg } from "@/lib/api-response";

// GET — Get reviews for a product (public) or all (admin)
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const productId = url.searchParams.get("product_id");
    const admin = url.searchParams.get("admin") === "true";

    if (admin) {
      const db = createAdminSupabase();
      if (!db) return apiSuccess({ reviews: [] });
      const { data } = await db.from("product_reviews")
        .select("*")
        .order("created_at", { ascending: false });
      return apiSuccess({ reviews: data || [] });
    }

    // Public: only approved reviews for specific product
    const db = createServerSupabase();
    if (!db || !productId) return apiSuccess({ reviews: [], avg: 0, count: 0 });

    const { data } = await db.from("product_reviews")
      .select("*")
      .eq("product_id", productId)
      .eq("status", "approved")
      .order("created_at", { ascending: false });

    const reviews = data || [];
    const avg = reviews.length > 0
      ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length
      : 0;

    return apiSuccess({ reviews, avg: Math.round(avg * 10) / 10, count: reviews.length });
  } catch (err: unknown) {
    console.error("[Reviews GET]", err);
    return apiSuccess({ reviews: [], avg: 0, count: 0 });
  }
}

// POST — Submit a new review (public)
export async function POST(req: NextRequest) {
  try {
    const db = createServerSupabase();
    if (!db) return apiError("DB unavailable", 500);

    // Check if feature is enabled
    const { data: setting } = await db.from("settings").select("value").eq("key", "feature_reviews").single();
    if (setting?.value !== "true") {
      return apiError("Reviews disabled", 403);
    }

    const body = await req.json();
    const { product_id, customer_name, customer_phone, rating, title, body: reviewBody } = body;

    if (!product_id || !customer_name || !rating || rating < 1 || rating > 5) {
      return apiError("Missing required fields", 400);
    }

    // Check if customer already reviewed this product
    if (customer_phone) {
      const { data: existing } = await db.from("product_reviews")
        .select("id")
        .eq("product_id", product_id)
        .eq("customer_phone", customer_phone)
        .single();
      if (existing) {
        return apiError("Already reviewed", 409);
      }
    }

    // Check if this was a verified purchase
    let verifiedPurchase = false;
    if (customer_phone) {
      const adminDb = createAdminSupabase();
      if (adminDb) {
        const { data: customer } = await adminDb.from("customers")
          .select("id")
          .eq("phone", customer_phone)
          .single();
        if (customer) {
          const { data: orderItems } = await adminDb.from("order_items")
            .select("id, order_id")
            .eq("product_id", product_id);
          if (orderItems && orderItems.length > 0) {
            verifiedPurchase = true;
          }
        }
      }
    }

    const { data, error } = await db.from("product_reviews").insert({
      product_id,
      customer_name,
      customer_phone,
      rating,
      title,
      body: reviewBody,
      verified_purchase: verifiedPurchase,
      status: "pending",
    }).select().single();

    if (error) throw error;
    return apiSuccess({ review: data, message: "سيتم نشر تقييمك بعد الموافقة" });
  } catch (err: unknown) {
    console.error("[Reviews POST]", err);
    return apiError("Failed to submit review", 500);
  }
}

// PUT — Admin: approve/reject/reply to review
export async function PUT(req: NextRequest) {
  try {
    const db = createAdminSupabase();
    if (!db) return apiError("Unauthorized", 401);

    const body = await req.json();
    const { id, status, admin_reply } = body;

    if (!id) return apiError("Missing review ID", 400);

    const updates: any = { updated_at: new Date().toISOString() };
    if (status) updates.status = status;
    if (admin_reply !== undefined) updates.admin_reply = admin_reply;

    const { data, error } = await db.from("product_reviews")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return apiSuccess({ review: data });
  } catch (err: unknown) {
    console.error("[Reviews PUT]", err);
    return apiError("Failed to update review", 500);
  }
}

// DELETE — Admin: delete review
export async function DELETE(req: NextRequest) {
  try {
    const db = createAdminSupabase();
    if (!db) return apiError("Unauthorized", 401);

    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return apiError("Missing ID", 400);

    const { error } = await db.from("product_reviews").delete().eq("id", id);
    if (error) throw error;
    return apiSuccess(null);
  } catch (err: unknown) {
    console.error("[Reviews DELETE]", err);
    return apiError("Failed to delete review", 500);
  }
}
