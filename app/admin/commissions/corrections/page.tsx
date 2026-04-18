// =====================================================
// Admin — Commission correction requests
// Server Component shell: gates on requireAdmin + commissions:manage,
// fetches the initial list (joined with user names) via
// createAdminSupabase, and passes the data to <CorrectionsClient />.
// =====================================================

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createAdminSupabase } from "@/lib/supabase";
import CorrectionsClient, {
  type CorrectionRow,
  type TabKey,
} from "./CorrectionsClient";

export const dynamic = "force-dynamic";

async function gate(): Promise<
  | { ok: true; role: string; appUserId: string; name: string }
  | { forbidden: true; reason: string }
  | { login: true }
> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return { forbidden: true, reason: "Server configuration error" };
  }
  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      get: (name: string) => cookieStore.get(name)?.value,
      set: () => {},
      remove: () => {},
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { login: true };

  const db = createAdminSupabase();
  if (!db) return { forbidden: true, reason: "DB unavailable" };

  const { data: dbUser } = await db
    .from("users")
    .select("id, name, role, status")
    .eq("auth_id", user.id)
    .single();

  if (!dbUser) {
    return { forbidden: true, reason: "حسابك غير مرتبط بالنظام" };
  }
  if (dbUser.status === "inactive" || dbUser.status === "suspended") {
    return { forbidden: true, reason: "حسابك معطّل" };
  }
  const blockedRoles = ["customer", "viewer", "sales"];
  if (blockedRoles.includes(dbUser.role)) {
    return {
      forbidden: true,
      reason: "ليس لديك صلاحية لإدارة طلبات التصحيح",
    };
  }

  return {
    ok: true,
    role: dbUser.role,
    appUserId: dbUser.id,
    name: dbUser.name || "Admin",
  };
}

const VALID_TABS: readonly TabKey[] = [
  "pending",
  "approved",
  "rejected",
  "resolved",
  "all",
] as const;

function pickTab(val: string | undefined): TabKey {
  if (val && (VALID_TABS as readonly string[]).includes(val)) {
    return val as TabKey;
  }
  return "pending";
}

export default async function AdminCorrectionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await headers();
  const sp = await searchParams;
  const rawTab = typeof sp.tab === "string" ? sp.tab : undefined;
  const tab = pickTab(rawTab);

  const result = await gate();
  if ("login" in result) {
    redirect("/login?redirect=/admin/commissions/corrections");
  }
  if ("forbidden" in result) {
    return (
      <div dir="rtl" className="max-w-md mx-auto mt-12 card p-6 text-center">
        <div className="text-lg font-bold text-state-error mb-2">
          ممنوع الوصول
        </div>
        <div className="text-muted text-sm">{result.reason}</div>
      </div>
    );
  }

  const db = createAdminSupabase();
  let rows: CorrectionRow[] = [];
  const counts: Record<TabKey, number> = {
    pending: 0,
    approved: 0,
    rejected: 0,
    resolved: 0,
    all: 0,
  };

  if (db) {
    let q = db
      .from("commission_correction_requests")
      .select(
        "id, employee_id, commission_sale_id, sales_doc_id, request_type, description, status, admin_response, resolved_by, resolved_at, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (tab !== "all") q = q.eq("status", tab);
    const { data } = await q;
    const raw = (data || []) as Array<Record<string, unknown>>;

    const employeeIds = [
      ...new Set(raw.map((r) => String(r.employee_id || ""))),
    ].filter(Boolean);
    const nameMap = new Map<string, string>();
    if (employeeIds.length > 0) {
      const { data: users } = await db
        .from("users")
        .select("id, name")
        .in("id", employeeIds);
      for (const u of (users || []) as Array<{ id: string; name: string | null }>) {
        nameMap.set(u.id, u.name || "Unknown");
      }
    }

    rows = raw.map((r) => ({
      id: Number(r.id),
      employee_id: String(r.employee_id || ""),
      employeeName: nameMap.get(String(r.employee_id || "")) || "غير معروف",
      commission_sale_id: (r.commission_sale_id as number | null) ?? null,
      sales_doc_id: (r.sales_doc_id as number | null) ?? null,
      request_type: String(r.request_type || "other") as CorrectionRow["request_type"],
      description: String(r.description || ""),
      status: String(r.status || "pending") as CorrectionRow["status"],
      admin_response: (r.admin_response as string | null) ?? null,
      resolved_by: (r.resolved_by as string | null) ?? null,
      resolved_at: (r.resolved_at as string | null) ?? null,
      created_at: String(r.created_at || ""),
    }));

    // Tab counts (lightweight aggregate). Head+count keeps it cheap.
    const [pendingRes, approvedRes, rejectedRes, resolvedRes, allRes] =
      await Promise.all([
        db
          .from("commission_correction_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        db
          .from("commission_correction_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "approved"),
        db
          .from("commission_correction_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "rejected"),
        db
          .from("commission_correction_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "resolved"),
        db
          .from("commission_correction_requests")
          .select("id", { count: "exact", head: true }),
      ]);
    counts.pending = pendingRes.count || 0;
    counts.approved = approvedRes.count || 0;
    counts.rejected = rejectedRes.count || 0;
    counts.resolved = resolvedRes.count || 0;
    counts.all = allRes.count || 0;
  }

  return (
    <CorrectionsClient
      initialRows={rows}
      initialTab={tab}
      counts={counts}
    />
  );
}
