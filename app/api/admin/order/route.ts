export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { withPermission, logAudit } from "@/lib/admin/auth";
import { apiError, apiSuccess } from "@/lib/api-response";
import type { SupabaseClient } from "@supabase/supabase-js";

export const GET = withPermission(
  "products",
  "view",
  async (_req: NextRequest, db: SupabaseClient) => {
    const { data, error } = await db
      .from("products")
      .select("id, brand, name_ar, name_he, image_url, active, type, sort_position, created_at")
      .order("sort_position", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      console.error("Order GET error:", error);
      return apiError("فشل في جلب المنتجات", 500);
    }

    return apiSuccess({ products: data || [] });
  },
);

export const PUT = withPermission(
  "products",
  "edit",
  async (req: NextRequest, db: SupabaseClient, user) => {
    const body = await req.json();
    const orderedIds = Array.isArray(body.orderedIds) ? body.orderedIds.filter(Boolean) : [];

    if (!orderedIds.length) {
      return apiError("orderedIds is required", 400);
    }

    for (const [index, productId] of orderedIds.entries()) {
      const { error } = await db
        .from("products")
        .update({ sort_position: index + 1 })
        .eq("id", productId);

      if (error) {
        console.error("Order PUT reorder error:", error);
        return apiError("فشل في ترتيب المنتجات", 500);
      }
    }

    await logAudit(db, {
      userId: user.appUserId,
      userName: user.name,
      userRole: user.role,
      action: "reorder",
      module: "products",
      entityType: "product",
      details: { count: orderedIds.length },
    });

    return apiSuccess({ ok: true });
  },
);
