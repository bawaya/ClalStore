import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminSupabase } from "@/lib/supabase";

/**
 * Verify the request is from an authenticated admin user.
 * Returns the user object (with role) if authenticated, or a 401/403 NextResponse if not.
 * 
 * Usage in API routes:
 *   const auth = await requireAdmin(req);
 *   if (auth instanceof NextResponse) return auth;
 *   // auth.id, auth.email, auth.role available
 */
export async function requireAdmin(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 503 });
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
    return NextResponse.json({ error: "غير مصرح — سجّل دخولك أولاً" }, { status: 401 });
  }

  const adminDb = createAdminSupabase();
  if (adminDb) {
    const { data: dbUser, error: _dbError } = await adminDb
      .from("users")
      .select("role, status")
      .eq("id", user.id)
      .single();

    if (dbUser) {
      if (dbUser.status === "inactive" || dbUser.status === "suspended") {
        return NextResponse.json({ error: "حسابك معطّل" }, { status: 403 });
      }

      const blockedRoles = ["customer", "viewer"];
      if (blockedRoles.includes(dbUser.role)) {
        return NextResponse.json({ error: "ليس لديك صلاحيات إدارية" }, { status: 403 });
      }

      return { ...user, role: dbUser.role };
    }

    // Bootstrap: only allow first authenticated user as admin when users table is empty
    const { count } = await adminDb
      .from("users")
      .select("id", { count: "exact", head: true });

    if ((count ?? 0) > 0) {
      return NextResponse.json({ error: "ليس لديك صلاحيات إدارية" }, { status: 403 });
    }
  }

  return { ...user, role: "admin" };
}
