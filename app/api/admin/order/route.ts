export const runtime = "edge";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";

const SETTINGS_KEY = "product_sort_rules";

type SortRule = { field: "price" | "brand" | "has_image"; direction: "asc" | "desc" };

export async function GET() {
  try {
    const db = createAdminSupabase();
    if (!db) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

    const { data } = await db.from("settings").select("value").eq("key", SETTINGS_KEY).single();

    let sortRules: SortRule[] = [];
    try {
      if (data?.value) sortRules = JSON.parse(data.value);
      if (!Array.isArray(sortRules) || sortRules.length !== 3) sortRules = [];
    } catch { sortRules = []; }

    return NextResponse.json({ sortRules });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const sortRules = body.sortRules as SortRule[];

    if (!Array.isArray(sortRules) || sortRules.length !== 3) {
      return NextResponse.json({ error: "يجب تحديد 3 معايير ترتيب" }, { status: 400 });
    }

    const validFields = new Set(["price", "brand", "has_image"]);
    const validDirs = new Set(["asc", "desc"]);
    for (const r of sortRules) {
      if (!validFields.has(r.field) || !validDirs.has(r.direction)) {
        return NextResponse.json({ error: "معايير غير صالحة" }, { status: 400 });
      }
    }

    const db = createAdminSupabase();
    if (!db) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

    const value = JSON.stringify(sortRules);
    const { data: existing } = await db.from("settings").select("key").eq("key", SETTINGS_KEY).single();

    if (existing) {
      await db.from("settings").update({ value }).eq("key", SETTINGS_KEY);
    } else {
      await db.from("settings").insert({ key: SETTINGS_KEY, value, type: "json" });
    }

    return NextResponse.json({ success: true, sortRules });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
