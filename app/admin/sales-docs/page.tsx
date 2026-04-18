// =====================================================
// Admin — Sales Docs management
// Server Component shell — fetches initial list + employees
// and passes them to the client.
// =====================================================

import { createAdminSupabase } from "@/lib/supabase";
import SalesDocsClient, { type SalesDoc, type EmployeeOption } from "./SalesDocsClient";

export const dynamic = "force-dynamic";

function defaultFromDate() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}
function defaultToDate() {
  return new Date().toISOString().slice(0, 10);
}

export default async function AdminSalesDocsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const pick = (k: string) =>
    typeof sp[k] === "string" ? (sp[k] as string) : undefined;

  const status = pick("status");
  const employeeKey = pick("employee_key");
  const source = pick("source");
  const from = pick("from") || defaultFromDate();
  const to = pick("to") || defaultToDate();
  const search = pick("search");

  const db = createAdminSupabase();

  let docs: SalesDoc[] = [];
  let employees: EmployeeOption[] = [];
  let total = 0;

  if (db) {
    let q = db
      .from("sales_docs")
      .select("*", { count: "exact" })
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(500);

    if (status) q = q.eq("status", status);
    if (employeeKey) q = q.eq("employee_key", employeeKey);
    if (source) q = q.eq("source", source);
    if (from) q = q.gte("sale_date", from);
    if (to) q = q.lte("sale_date", to);
    if (search && search.trim()) {
      const s = search.trim();
      q = q.or(
        `notes.ilike.%${s}%,order_id.ilike.%${s}%,customer_id.ilike.%${s}%,employee_key.ilike.%${s}%`,
      );
    }

    const [docsRes, usersRes] = await Promise.all([
      q,
      db
        .from("users")
        .select("id, name, role")
        .neq("role", "customer")
        .eq("status", "active")
        .order("name"),
    ]);

    docs = (docsRes.data || []) as SalesDoc[];
    total = docsRes.count ?? docs.length;
    employees = (usersRes.data || []) as EmployeeOption[];
  }

  return (
    <SalesDocsClient
      initialDocs={docs}
      initialTotal={total}
      employees={employees}
      initialFilters={{
        status: status || "",
        employee_key: employeeKey || "",
        source: source || "",
        from,
        to,
        search: search || "",
      }}
    />
  );
}
