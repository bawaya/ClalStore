export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";

// POST — Save/update abandoned cart
export async function POST(req: NextRequest) {
  try {
    const db = createServerSupabase();
    if (!db) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

    // Check if feature is enabled
    const { data: setting } = await db.from("settings").select("value").eq("key", "feature_abandoned_cart").single();
    if (setting?.value !== "true") return NextResponse.json({ ok: true });

    const body = await req.json();
    const { visitor_id, customer_phone, customer_name, items, total } = body;

    if (!visitor_id || !items || items.length === 0) {
      return NextResponse.json({ ok: true });
    }

    // Upsert: check existing cart for this visitor
    const { data: existing } = await db.from("abandoned_carts")
      .select("id")
      .eq("visitor_id", visitor_id)
      .eq("recovered", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (existing) {
      // Update existing cart
      await db.from("abandoned_carts")
        .update({
          items,
          total,
          customer_phone,
          customer_name,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      // Create new abandoned cart
      await db.from("abandoned_carts").insert({
        visitor_id,
        customer_phone,
        customer_name,
        items,
        total,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    // Don't fail the user experience — fire and forget
    console.error("Abandoned cart error:", err.message);
    return NextResponse.json({ ok: true });
  }
}

// DELETE — Mark cart as recovered (when user completes checkout)
export async function DELETE(req: NextRequest) {
  try {
    const db = createServerSupabase();
    if (!db) return NextResponse.json({ ok: true });

    const url = new URL(req.url);
    const visitorId = url.searchParams.get("visitor_id");
    if (!visitorId) return NextResponse.json({ ok: true });

    await db.from("abandoned_carts")
      .update({ recovered: true, updated_at: new Date().toISOString() })
      .eq("visitor_id", visitorId)
      .eq("recovered", false);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
