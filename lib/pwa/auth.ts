import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminSupabase } from "@/lib/supabase";

export type AuthedEmployee = {
  authId: string;
  appUserId: string;
  role: string;
  name: string;
  email?: string;
};

/**
 * Require a signed-in Supabase user and a corresponding row in the `users` table.
 * Unlike requireAdmin(), this allows non-admin roles (e.g. sales/support).
 */
export async function requireEmployee(req: NextRequest): Promise<AuthedEmployee | NextResponse> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ success: false, error: "Server configuration error" }, { status: 503 });
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      get(name: string) {
        return req.cookies.get(name)?.value;
      },
      set() {},
      remove() {},
    },
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ success: false, error: "غير مصرح — سجّل دخولك أولاً" }, { status: 401 });
  }

  const adminDb = createAdminSupabase();
  if (!adminDb) {
    return NextResponse.json({ success: false, error: "DB unavailable" }, { status: 500 });
  }

  const { data: dbUser } = await adminDb
    .from("users")
    .select("id, name, role, status, email")
    .eq("auth_id", user.id)
    .single();

  if (!dbUser) {
    return NextResponse.json({ success: false, error: "حسابك غير مرتبط بالنظام" }, { status: 403 });
  }

  if (dbUser.status === "inactive" || dbUser.status === "suspended") {
    return NextResponse.json({ success: false, error: "حسابك معطّل" }, { status: 403 });
  }

  if (dbUser.role === "customer") {
    return NextResponse.json({ success: false, error: "ليس لديك صلاحيات للوصول" }, { status: 403 });
  }

  return {
    authId: user.id,
    appUserId: dbUser.id,
    role: dbUser.role,
    name: dbUser.name || user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
    email: dbUser.email || user.email || undefined,
  };
}

