
import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminSupabase } from "@/lib/supabase";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return apiError("Server configuration error", 503);
    }

    // Get current user session
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        get(name: string) { return req.cookies.get(name)?.value; },
        set() {},
        remove() {},
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return apiError("غير مصرح — سجّل دخولك أولاً", 401);
    }

    const body = await req.json();
    const { newPassword, confirmPassword } = body;

    // Validate new password
    if (!newPassword || !confirmPassword) {
      return apiError("كلمة المرور الجديدة مطلوبة", 400);
    }

    if (newPassword !== confirmPassword) {
      return apiError("كلمات المرور غير متطابقة", 400);
    }

    // Password strength validation
    if (newPassword.length < 8) {
      return apiError("كلمة المرور يجب أن تكون 8 أحرف على الأقل", 400);
    }
    if (!/[A-Z]/.test(newPassword)) {
      return apiError("كلمة المرور يجب أن تحتوي على حرف كبير واحد على الأقل", 400);
    }
    if (!/[0-9]/.test(newPassword)) {
      return apiError("كلمة المرور يجب أن تحتوي على رقم واحد على الأقل", 400);
    }

    // Update password via Supabase Auth Admin
    const adminDb = createAdminSupabase();
    if (!adminDb) {
      return apiError("DB unavailable", 500);
    }

    const { error: updateError } = await adminDb.auth.admin.updateUserById(user.id, {
      password: newPassword,
    });

    if (updateError) {
      console.error("[ChangePassword] Update error:", updateError);
      return apiError("فشل في تغيير كلمة المرور", 500);
    }

    // Clear must_change_password flag
    const { error: dbError } = await adminDb
      .from("users")
      .update({
        must_change_password: false,
        temp_password_expires_at: null,
      })
      .eq("auth_id", user.id);

    if (dbError) {
      console.warn("[ChangePassword] Failed to clear must_change_password flag:", dbError);
    }

    return apiSuccess({ message: "تم تغيير كلمة المرور بنجاح" });
  } catch (err: unknown) {
    console.error("[ChangePassword] Error:", err);
    return apiError("Internal server error", 500);
  }
}
