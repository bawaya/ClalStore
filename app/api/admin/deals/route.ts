export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin/auth";
import { dealSchema, dealUpdateSchema, validateBody } from "@/lib/admin/validators";

// GET — Public: get active deals / Admin: get all deals
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const url = new URL(req.url);
    const admin = url.searchParams.get("admin") === "true";

    if (admin) {
      const db = createAdminSupabase();
      if (!db) return NextResponse.json({ deals: [] });
      const { data } = await db.from("deals")
        .select("*")
        .order("sort_order")
        .order("created_at", { ascending: false });
      return NextResponse.json({ deals: data || [] });
    }

    // Public: only active deals within date range
    const db = createServerSupabase();
    if (!db) return NextResponse.json({ deals: [] });

    // Check if feature is enabled
    const { data: setting } = await db.from("settings").select("value").eq("key", "feature_deals").single();
    if (setting?.value !== "true") return NextResponse.json({ deals: [] });

    const now = new Date().toISOString();
    const { data } = await db.from("deals")
      .select("*")
      .eq("active", true)
      .lte("starts_at", now)
      .or(`ends_at.is.null,ends_at.gte.${now}`)
      .order("sort_order");

    return NextResponse.json({ deals: data || [] });
  } catch (err: any) {
    return NextResponse.json({ deals: [] }, { status: 500 });
  }
}

// POST — Admin: create deal
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const db = createAdminSupabase();
    if (!db) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const v = validateBody(body, dealSchema);
    if (v.error) return NextResponse.json({ error: v.error }, { status: 400 });
    const { data, error } = await db.from("deals").insert(v.data!).select().single();
    if (error) throw error;
    return NextResponse.json({ deal: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT — Admin: update deal
export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const db = createAdminSupabase();
    if (!db) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: "Missing deal ID" }, { status: 400 });
    const v = validateBody(updates, dealUpdateSchema);
    if (v.error) return NextResponse.json({ error: v.error }, { status: 400 });

    const toUpdate = { ...v.data!, updated_at: new Date().toISOString() };
    const { data, error } = await db.from("deals").update(toUpdate).eq("id", id).select().single();
    if (error) throw error;
    return NextResponse.json({ deal: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — Admin: delete deal
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const db = createAdminSupabase();
    if (!db) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

    const { error } = await db.from("deals").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
