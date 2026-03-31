import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminSupabase } from "@/lib/supabase";
import { apiError, errMsg } from "@/lib/api-response";
import type { SupabaseClient } from "@supabase/supabase-js";

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
      .eq("auth_id", user.id)
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

/**
 * Higher-order wrapper for admin API routes.
 * Handles auth check, DB init, try/catch, and error formatting.
 *
 * Usage:
 *   export const GET = withAdminAuth(async (req, db, user) => {
 *     const { data } = await db.from("table").select("*");
 *     return apiSuccess(data);
 *   });
 */
export function withAdminAuth(
  handler: (req: NextRequest, db: SupabaseClient, user: { id: string; email?: string; role: string }) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    try {
      const auth = await requireAdmin(req);
      if (auth instanceof NextResponse) return auth;

      const db = createAdminSupabase();
      if (!db) return apiError("DB unavailable", 500);

      return await handler(req, db, auth as { id: string; email?: string; role: string });
    } catch (err: unknown) {
      return apiError(errMsg(err), 500);
    }
  };
}
