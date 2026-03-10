export const runtime = "edge";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";

const SETTINGS_KEY = "priority_product_ids";

export async function GET() {
  try {
    const db = createAdminSupabase();
    if (!db) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

    const [productsRes, settingsRes] = await Promise.all([
      db.from("products").select("id, name_ar, name_he, brand, price, image_url, type").eq("active", true).eq("type", "device").order("name_ar"),
      db.from("settings").select("value").eq("key", SETTINGS_KEY).single(),
    ]);

    const products = productsRes.data || [];
    let priorityIds: string[] = [];
    try {
      const raw = settingsRes.data?.value;
      if (raw) priorityIds = JSON.parse(raw);
      if (!Array.isArray(priorityIds)) priorityIds = [];
    } catch {}

    return NextResponse.json({ products, priorityIds: priorityIds.slice(0, 3) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const priorityIds = (body.priorityIds as string[]) || [];
    const ids = priorityIds.slice(0, 3).filter(Boolean);

    const db = createAdminSupabase();
    if (!db) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

    const { data: existing } = await db.from("settings").select("key").eq("key", SETTINGS_KEY).single();

    if (existing) {
      await db.from("settings").update({ value: JSON.stringify(ids) }).eq("key", SETTINGS_KEY);
    } else {
      await db.from("settings").insert({ key: SETTINGS_KEY, value: JSON.stringify(ids), type: "json" });
    }

    return NextResponse.json({ success: true, priorityIds: ids });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
