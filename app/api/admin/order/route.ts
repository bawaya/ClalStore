export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin/auth";
import { apiSuccess, apiError, errMsg } from "@/lib/api-response";

const SETTINGS_KEY = "product_sort_rules";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const supabase = createAdminSupabase();
    if (!supabase) return apiError("DB unavailable", 500);

    const [settingsRes, brandsRes] = await Promise.all([
      supabase.from("settings").select("value").eq("key", SETTINGS_KEY).single(),
      supabase.from("products").select("brand").eq("active", true).eq("type", "device"),
    ]);

    const allBrands = [...new Set((brandsRes.data || []).map((r: { brand: string }) => r.brand).filter(Boolean))].sort();

    let config = null;
    try {
      if (settingsRes.data?.value) config = JSON.parse(settingsRes.data.value);
    } catch {}

    return apiSuccess({ config, allBrands });
  } catch (err: unknown) {
    return apiError(errMsg(err, "Unknown error"));
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const body = await req.json();
    const config = body.config;

    if (!config?.rules || !Array.isArray(config.rules) || config.rules.length !== 3) {
      return apiError("يجب تحديد 3 معايير ترتيب", 400);
    }

    const validFields = new Set(["price", "brand", "has_image"]);
    const validDirs = new Set(["asc", "desc"]);
    for (const r of config.rules) {
      if (!validFields.has(r.field) || !validDirs.has(r.direction) || typeof r.enabled !== "boolean") {
        return apiError("معايير غير صالحة", 400);
      }
    }

    const supabase = createAdminSupabase();
    if (!supabase) return apiError("DB unavailable", 500);

    const value = JSON.stringify({
      rules: config.rules,
      brandOrder: Array.isArray(config.brandOrder) ? config.brandOrder : [],
    });

    const { data: existing } = await supabase.from("settings").select("key").eq("key", SETTINGS_KEY).single();

    if (existing) {
      await supabase.from("settings").update({ value }).eq("key", SETTINGS_KEY);
    } else {
      await supabase.from("settings").insert({ key: SETTINGS_KEY, value, type: "json" });
    }

    return apiSuccess(null);
  } catch (err: unknown) {
    return apiError(errMsg(err, "Unknown error"));
  }
}
