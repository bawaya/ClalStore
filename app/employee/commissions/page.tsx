import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { redirect } from "next/navigation";
import { createAdminSupabase } from "@/lib/supabase";
import CommissionsClient from "./CommissionsClient";

export const dynamic = "force-dynamic";

type Authed = {
  appUserId: string;
  name: string;
  email?: string | null;
  role: string;
};

/** Server-side gate — mirrors requireEmployee() for server components. */
async function gate(): Promise<Authed | { forbidden: true; reason: string } | { login: true }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return { forbidden: true, reason: "Server configuration error" };

  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      get: (name: string) => cookieStore.get(name)?.value,
      set: () => {},
      remove: () => {},
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { login: true };

  const db = createAdminSupabase();
  if (!db) return { forbidden: true, reason: "DB unavailable" };

  const { data: dbUser } = await db
    .from("users")
    .select("id, name, role, status, email")
    .eq("auth_id", user.id)
    .single();

  if (!dbUser) return { forbidden: true, reason: "حسابك غير مرتبط بالنظام" };
  if (dbUser.status === "inactive" || dbUser.status === "suspended") {
    return { forbidden: true, reason: "حسابك معطّل" };
  }
  if (dbUser.role === "customer") return { forbidden: true, reason: "ليس لديك صلاحيات للوصول" };

  return {
    appUserId: dbUser.id,
    name: dbUser.name || user.email?.split("@")[0] || "Employee",
    email: dbUser.email || user.email || null,
    role: dbUser.role,
  };
}

export default async function EmployeeCommissionsPage() {
  const result = await gate();

  if ("login" in result) redirect("/login?next=/employee/commissions");
  if ("forbidden" in result) {
    return (
      <div className="max-w-md mx-auto mt-12 card p-6 text-center" dir="rtl">
        <div className="text-lg font-bold text-state-error mb-2">ممنوع الوصول</div>
        <div className="text-muted text-sm">{result.reason}</div>
      </div>
    );
  }

  return (
    <CommissionsClient
      employee={{ id: result.appUserId, name: result.name, email: result.email || undefined }}
    />
  );
}
