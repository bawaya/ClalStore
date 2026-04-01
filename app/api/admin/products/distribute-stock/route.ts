
// =====================================================
// ClalMobile — Admin Stock Distribution API
// Distributes weighted random stock across all active products
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { logAction } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/admin/auth";
import { apiSuccess, apiError, errMsg } from "@/lib/api-response";

type Mode = "scarce" | "medium" | "available" | "abundant";

const WEIGHTS: Record<Mode, { min: number; max: number; center: number; spread: number }> = {
  scarce:    { min: 2,  max: 5,  center: 3,  spread: 1 },
  medium:    { min: 4,  max: 9,  center: 6,  spread: 2 },
  available: { min: 7,  max: 13, center: 10, spread: 2 },
  abundant:  { min: 10, max: 15, center: 13, spread: 2 },
};

function weightedRandom(mode: Mode): number {
  const w = WEIGHTS[mode];
  // Gaussian-like distribution centered on w.center
  let sum = 0;
  for (let i = 0; i < 4; i++) sum += Math.random();
  const gaussian = (sum / 4 - 0.5) * 2; // -1 to 1
  const value = Math.round(w.center + gaussian * w.spread);
  return Math.max(w.min, Math.min(w.max, value));
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const { mode } = await req.json() as { mode: Mode };
    if (!WEIGHTS[mode]) {
      return apiError("Invalid mode", 400);
    }

    const s = createAdminSupabase();
    const { data: products, error } = await s
      .from("products")
      .select("id, stock, variants")
      .eq("active", true);

    if (error) throw error;
    if (!products?.length) {
      return apiError("لا يوجد منتجات نشطة", 404);
    }

    let updated = 0;
    for (const p of products) {
      const newStock = weightedRandom(mode);
      const variants = (p.variants as any[] || []).map((v: any) => ({
        ...v,
        stock: weightedRandom(mode),
      }));

      const { error: uErr } = await s
        .from("products")
        .update({ stock: newStock, variants })
        .eq("id", p.id);

      if (!uErr) updated++;
    }

    const modeLabels: Record<Mode, string> = {
      scarce: "شحيح", medium: "متوسط", available: "متوفر", abundant: "وفير",
    };
    await logAction("مدير", `توزيع مخزون ${modeLabels[mode]} على ${updated} منتج`, "stock", "all");

    return apiSuccess({ updated, mode });
  } catch (err: unknown) {
    return apiError(errMsg(err), 500);
  }
}
