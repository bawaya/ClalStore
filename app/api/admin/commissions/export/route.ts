import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month") || new Date().toISOString().slice(0, 7);

  const db = createAdminSupabase();
  if (!db) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const { data: sales } = await db
    .from("commission_sales")
    .select("*")
    .gte("sale_date", `${month}-01`)
    .lte("sale_date", `${month}-31`)
    .order("sale_date", { ascending: true });

  const { data: sanctions } = await db
    .from("commission_sanctions")
    .select("*")
    .gte("sanction_date", `${month}-01`)
    .lte("sanction_date", `${month}-31`);

  // Build CSV
  const headers = ["תאריך", "סוג", "מקור", "לקוח/מכשיר", "סכום", "עמלה", "הערות"];
  const rows: (string | number)[][] = (sales || []).map((s: Record<string, string | number | null>) => [
    s.sale_date,
    s.sale_type === "line" ? "קו" : "מכשיר",
    s.source === "auto_sync" ? "סנכרון" : s.source === "csv_import" ? "CSV" : "ידני",
    s.sale_type === "line" ? (s.customer_name || s.customer_phone || "") : (s.device_name || ""),
    s.sale_type === "line" ? s.package_price : s.device_sale_amount,
    s.commission_amount,
    s.notes || "",
  ]);

  // Add sanctions section
  if (sanctions && sanctions.length > 0) {
    rows.push([]); // empty row
    rows.push(["--- סנקציות ---", "", "", "", "", "", ""]);
    for (const s of sanctions) {
      rows.push([s.sanction_date, s.sanction_type, "", "", s.amount, "", s.description || ""]);
    }
  }

  // Add BOM for Hebrew support
  const bom = "\uFEFF";
  const csv = bom + [headers, ...rows].map((row) => row.map((cell: string | number) => `"${cell}"`).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="commissions-${month}.csv"`,
    },
  });
}
