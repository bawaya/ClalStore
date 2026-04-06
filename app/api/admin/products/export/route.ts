import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createServerSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const sb = createServerSupabase();
    const { data: products, error } = await sb
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Build CSV header
    const headers = [
      "id", "type", "brand", "name_ar", "name_he", "name_en",
      "price", "old_price", "cost", "stock", "sold",
      "active", "featured", "category_id",
      "description_ar", "description_he",
      "image_url", "storage_options", "colors_count",
    ];

    const csvRows = [headers.join(",")];

    for (const p of (products || [])) {
      const row = [
        p.id,
        p.type,
        `"${(p.brand || "").replace(/"/g, '""')}"`,
        `"${(p.name_ar || "").replace(/"/g, '""')}"`,
        `"${(p.name_he || "").replace(/"/g, '""')}"`,
        `"${(p.name_en || "").replace(/"/g, '""')}"`,
        p.price || 0,
        p.old_price || "",
        p.cost || 0,
        p.stock || 0,
        p.sold || 0,
        p.active ? "true" : "false",
        p.featured ? "true" : "false",
        p.category_id || "",
        `"${(p.description_ar || "").replace(/"/g, '""').replace(/\n/g, " ")}"`,
        `"${(p.description_he || "").replace(/"/g, '""').replace(/\n/g, " ")}"`,
        `"${(p.image_url || "").replace(/"/g, '""')}"`,
        `"${(p.storage_options || []).join(";")}"`,
        (p.colors || []).length,
      ];
      csvRows.push(row.join(","));
    }

    const csv = "\uFEFF" + csvRows.join("\n"); // BOM for Excel Arabic support

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="clalmobile-products-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
