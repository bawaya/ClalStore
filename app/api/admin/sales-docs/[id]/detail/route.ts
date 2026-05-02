/**
 * GET /api/admin/sales-docs/[id]/detail
 *
 * Returns the full picture for the admin drawer:
 *   { doc, items, events, commission_ids, commissions, customer }
 */

import { NextRequest, NextResponse } from "next/server";
import { apiError, apiSuccess, safeError } from "@/lib/api-response";
import { withPermission } from "@/lib/admin/auth";

export const GET = withPermission(
  "commissions",
  "manage",
  async (req: NextRequest, db) => {
    try {
      const parts = new URL(req.url).pathname.split("/");
      const id = Number(parts[parts.length - 2]);
      if (!id || Number.isNaN(id)) return apiError("Invalid id", 400);

      const { data: doc, error: docErr } = await db
        .from("sales_docs")
        .select("*")
        .eq("id", id)
        .is("deleted_at", null)
        .maybeSingle();

      if (docErr) return apiError("فشل في جلب الوثيقة", 500);
      if (!doc) return apiError("Not found", 404);

      const [itemsRes, eventsRes, commRes, custRes] = await Promise.all([
        db
          .from("sales_doc_items")
          .select("id, item_type, product_id, product_name, qty, unit_price, line_total, metadata")
          .eq("sales_doc_id", id)
          .is("deleted_at", null)
          .order("id", { ascending: true }),
        db
          .from("sales_doc_events")
          .select("id, event_type, actor_user_id, actor_role, payload, created_at")
          .eq("sales_doc_id", id)
          .order("created_at", { ascending: false })
          .limit(100),
        db
          .from("commission_sales")
          .select("id, sale_type, sale_date, commission_amount, deleted_at")
          .eq("source_sales_doc_id", id),
        doc.customer_id
          ? db
              .from("customers")
              .select("id, name, phone, email, city")
              .eq("id", doc.customer_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      return apiSuccess({
        doc,
        items: itemsRes.data || [],
        events: eventsRes.data || [],
        commission_ids: (commRes.data || []).map((c: { id: number }) => c.id),
        commissions: commRes.data || [],
        customer: custRes.data || null,
      });
    } catch (err: unknown) {
      return safeError(err, "Admin SalesDocs Detail", "خطأ في السيرفر", 500);
    }
  },
);

export async function OPTIONS() {
  return apiSuccess({});
}
