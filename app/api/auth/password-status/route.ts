import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminSupabase } from "@/lib/supabase";
import { apiError, apiSuccess } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return apiError("Server configuration error", 503);
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

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return apiError("غير مصرح — سجّل دخولك أولاً", 401);
    }

    const adminDb = createAdminSupabase();
    if (!adminDb) {
      return apiError("DB unavailable", 500);
    }

    const { data: profile, error: profileError } = await adminDb
      .from("users")
      .select("must_change_password, temp_password_expires_at")
      .eq("auth_id", user.id)
      .maybeSingle();

    if (profileError) {
      if (profileError.code === "42703") {
        console.warn("[PasswordStatus] Missing password status columns; treating as schema lag.", {
          code: profileError.code,
          message: profileError.message,
        });
        return apiSuccess({
          mustChangePassword: false,
          tempPasswordExpiresAt: null,
          schemaLag: true,
        });
      }
      console.error("[PasswordStatus] Profile lookup error:", profileError);
      return apiError("فشل في قراءة حالة كلمة المرور", 500);
    }

    return apiSuccess({
      mustChangePassword: Boolean(profile?.must_change_password),
      tempPasswordExpiresAt: profile?.temp_password_expires_at || null,
      schemaLag: false,
    });
  } catch (err: unknown) {
    console.error("[PasswordStatus] Error:", err);
    return apiError("Internal server error", 500);
  }
}
