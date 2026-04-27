// =====================================================
// Test-only admin login — used by Postman/Newman to
// authenticate against the admin API in local/staging.
//
// Hard-disabled in production: returns 404 to look like
// the route doesn't exist. CSRF-exempt is granted by
// adding /api/test to middleware.CSRF_EXEMPT or by
// hitting GET /api/csrf first.
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { apiError, apiSuccess } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return apiError("Supabase env not configured", 503);
  }

  const body = (await req.json().catch(() => null)) as { email?: string; password?: string } | null;
  const email = body?.email?.trim();
  const password = body?.password;

  if (!email || !password) {
    return apiError("email and password required", 400);
  }

  // Capture cookies the SSR client wants to set so we can pass them on the response.
  const setCookies: Array<{ name: string; value: string; options?: Record<string, unknown> }> = [];
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      get(name: string) {
        return req.cookies.get(name)?.value;
      },
      set(name: string, value: string, options?: Record<string, unknown>) {
        setCookies.push({ name, value, options });
      },
      remove(name: string, options?: Record<string, unknown>) {
        setCookies.push({ name, value: "", options: { ...options, maxAge: 0 } });
      },
    },
  });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    return apiError(error?.message || "login failed", 401);
  }

  const res = apiSuccess({
    ok: true,
    userId: data.user?.id,
    email: data.user?.email,
  });
  for (const c of setCookies) {
    res.cookies.set({
      name: c.name,
      value: c.value,
      ...(c.options as Record<string, unknown>),
    });
  }
  return res;
}
