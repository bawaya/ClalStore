import { NextRequest, NextResponse } from "next/server";
import { withPermission } from "@/lib/admin/auth";
import { apiError } from "@/lib/api-response";
import type { SupabaseClient } from "@supabase/supabase-js";

export const GET = withPermission(
  "crm",
  "export",
  async (req: NextRequest, db: SupabaseClient) => {
    const { searchParams } = new URL(req.url);
    const segment = searchParams.get("segment") || undefined;

    let query = db
      .from("customers")
      .select("id, name, phone, email, city, segment, source, total_orders, total_spent, avg_order_value, last_order_at, created_at")
      .order("total_spent", { ascending: false })
      .limit(10000);

    if (segment) query = query.eq("segment", segment);

    const { data, error } = await query;
    if (error) return apiError("فشل تصدير العملاء", 500);

    const rows = data || [];
    const header = "الاسم,الهاتف,الإيميل,المدينة,التصنيف,المصدر,الطلبات,الإنفاق,المتوسط,آخر_طلب,تاريخ_الإنشاء";
    const csvRows = rows.map((c) => {
      const safeField = (v: string | null | undefined) =>
        `"${(v || "").replace(/"/g, '""')}"`;
      return [
        safeField(c.name),
        safeField(c.phone),
        safeField(c.email),
        safeField(c.city),
        safeField(c.segment),
        safeField(c.source),
        c.total_orders || 0,
        c.total_spent || 0,
        c.avg_order_value || 0,
        safeField(c.last_order_at),
        safeField(c.created_at),
      ].join(",");
    });

    const csv = "\uFEFF" + header + "\n" + csvRows.join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="customers-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  },
);
