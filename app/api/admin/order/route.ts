export const runtime = "edge";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";

const SETTINGS_KEY = "product_sort_rules";

export async function GET() {
  try {
    const db = createAdminSupabase();
    if (!db) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

    const [settingsRes, brandsRes] = await Promise.all([
      db.from("settings").select("value").eq("key", SETTINGS_KEY).single(),
      db.from("products").select("brand").eq("active", true).eq("type", "device"),
    ]);

    const allBrands = [...new Set((brandsRes.data || []).map((r: { brand: string }) => r.brand).filter(Boolean))].sort();

    let config = null;
    try {
      if (settingsRes.data?.value) config = JSON.parse(settingsRes.data.value);
    } catch {}

    return NextResponse.json({ config, allBrands });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const config = body.config;

    if (!config?.rules || !Array.isArray(config.rules) || config.rules.length !== 3) {
      return NextResponse.json({ error: "يجب تحديد 3 معايير ترتيب" }, { status: 400 });
    }

    const validFields = new Set(["price", "brand", "has_image"]);
    const validDirs = new Set(["asc", "desc"]);
    for (const r of config.rules) {
      if (!validFields.has(r.field) || !validDirs.has(r.direction) || typeof r.enabled !== "boolean") {
        return NextResponse.json({ error: "معايير غير صالحة" }, { status: 400 });
      }
    }

    const db = createAdminSupabase();
    if (!db) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

    const value = JSON.stringify({
      rules: config.rules,
      brandOrder: Array.isArray(config.brandOrder) ? config.brandOrder : [],
    });

    const { data: existing } = await db.from("settings").select("key").eq("key", SETTINGS_KEY).single();

    if (existing) {
      await db.from("settings").update({ value }).eq("key", SETTINGS_KEY);
    } else {
      await db.from("settings").insert({ key: SETTINGS_KEY, value, type: "json" });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
