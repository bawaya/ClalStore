// =====================================================
// Admin — Announcements (broadcast messages to employees)
// Server Component shell: gates on requireAdmin + settings:manage,
// fetches the initial list via createAdminSupabase, and passes
// the data to <AnnouncementsClient />.
// =====================================================

import { redirect } from "next/navigation";
import { headers, cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createAdminSupabase } from "@/lib/supabase";
import AnnouncementsClient, {
  type AdminAnnouncementRow,
} from "./AnnouncementsClient";

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
    return { forbidden: true, reason: "ليس لديك صلاحية لإدارة الرسائل" };
  }

  return {
    ok: true,
    role: dbUser.role,
    appUserId: dbUser.id,
    name: dbUser.name || "Admin",
  };
}

export default async function AdminAnnouncementsPage() {
  // Mark headers/cookies as read so Next flags this route as dynamic.
  await headers();
  const result = await gate();
  if ("login" in result) redirect("/login?redirect=/admin/announcements");
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
  let announcements: AdminAnnouncementRow[] = [];
  let totalRecipients = 0;

  if (db) {
    const { data } = await db
      .from("admin_announcements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    const rows = (data || []) as Array<Record<string, unknown>>;

    const ids = rows.map((a) => Number(a.id));
    const readCounts = new Map<number, number>();
    if (ids.length > 0) {
      const { data: reads } = await db
        .from("admin_announcement_reads")
        .select("announcement_id")
        .in("announcement_id", ids);
      for (const r of (reads || []) as Array<{ announcement_id: number }>) {
        const cur = readCounts.get(r.announcement_id) || 0;
        readCounts.set(r.announcement_id, cur + 1);
      }
    }

    const { count } = await db
      .from("users")
      .select("id", { count: "exact", head: true })
      .neq("role", "customer")
      .neq("status", "inactive")
      .neq("status", "suspended");
    totalRecipients = count || 0;

    announcements = rows.map((a) => ({
      id: Number(a.id),
      title: String(a.title || ""),
      body: String(a.body || ""),
      priority: String(a.priority || "normal") as AdminAnnouncementRow["priority"],
      target: String(a.target || "all") as AdminAnnouncementRow["target"],
      created_by: String(a.created_by || ""),
      expires_at: (a.expires_at as string | null) || null,
      created_at: String(a.created_at || ""),
      readCount: readCounts.get(Number(a.id)) || 0,
      totalRecipients,
    }));
  }

  return (
    <AnnouncementsClient
      initialAnnouncements={announcements}
      totalRecipients={totalRecipients}
    />
  );
}
