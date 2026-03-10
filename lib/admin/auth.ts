import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/**
 * Verify the request is from an authenticated admin user.
 * Returns the user object if authenticated, or a 401 NextResponse if not.
 * 
 * Usage in API routes:
 *   const auth = await requireAdmin(req);
 *   if (auth instanceof NextResponse) return auth;
 *   // auth.id, auth.email available
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

  return user;
}
