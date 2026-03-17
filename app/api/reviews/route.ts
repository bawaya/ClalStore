export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin/auth";

// GET — Get reviews for a product (public) or all (admin with auth)
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const productId = url.searchParams.get("product_id");
    const admin = url.searchParams.get("admin") === "true";

    if (admin) {
      const auth = await requireAdmin(req);
      if (auth instanceof NextResponse) return auth;
      const db = createAdminSupabase();
      if (!db) return NextResponse.json({ reviews: [] });
      const { data } = await db.from("product_reviews")
        .select("*")
        .order("created_at", { ascending: false });
      return NextResponse.json({ reviews: data || [] });
    }

    const db = createServerSupabase();
    if (!db || !productId) {
      return NextResponse.json({
        reviews: [], avg: 0, count: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      });
    }

    const { data } = await db.from("product_reviews")
      .select("*")
      .eq("product_id", productId)
      .eq("status", "approved")
      .order("created_at", { ascending: false });

    const reviews = data || [];
    const count = reviews.length;
    const avg = count > 0
      ? reviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / count
      : 0;

    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of reviews) {
      const star = Math.min(5, Math.max(1, Math.round(r.rating)));
      distribution[star]++;
    }

    return NextResponse.json({
      reviews,
      avg: Math.round(avg * 10) / 10,
      count,
      distribution,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({
      reviews: [], avg: 0, count: 0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      error: message,
    });
  }
}

// POST — Submit a new review (public)
export async function POST(req: NextRequest) {
  try {
    const db = createServerSupabase();
    if (!db) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

    const { data: setting } = await db
      .from("settings").select("value").eq("key", "feature_reviews").single();
    if (setting?.value !== "true") {
      return NextResponse.json({ error: "Reviews disabled" }, { status: 403 });
    }

    const body = await req.json();
    const { product_id, customer_name, customer_phone, rating, title, body: reviewBody } = body;

    if (!product_id || !customer_name || !rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (customer_phone) {
      const { data: existing } = await db.from("product_reviews")
        .select("id")
        .eq("product_id", product_id)
        .eq("customer_phone", customer_phone)
        .single();
      if (existing) {
        return NextResponse.json({ error: "Already reviewed" }, { status: 409 });
      }
    }

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
    return NextResponse.json({ review: data, success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT — Admin: approve/reject/reply to review
export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const db = createAdminSupabase();
    if (!db) return NextResponse.json({ error: "Server error" }, { status: 500 });

    const body = await req.json();
    const { id, status, admin_reply } = body;

    if (!id) return NextResponse.json({ error: "Missing review ID" }, { status: 400 });

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (status) updates.status = status;
    if (admin_reply !== undefined) updates.admin_reply = admin_reply;

    const { data, error } = await db.from("product_reviews")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ review: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE — Admin: delete review
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const db = createAdminSupabase();
    if (!db) return NextResponse.json({ error: "Server error" }, { status: 500 });

    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

    const { error } = await db.from("product_reviews").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
