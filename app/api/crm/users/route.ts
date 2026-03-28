export const runtime = 'edge';

import { NextRequest, NextResponse } from "next/server";
import { getCRMUsers, updateUser, getAuditLog } from "@/lib/crm/queries";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminSupabase } from "@/lib/supabase";
import { logAction } from "@/lib/admin/queries";
import { apiSuccess, apiError, errMsg } from "@/lib/api-response";

/** Generate a secure random temporary password (16 chars) */
function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => chars[b % chars.length]).join("");
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const { searchParams } = new URL(req.url);

    if (searchParams.get("audit") === "true") {
      const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : 50;
      const data = await getAuditLog(limit);
      return apiSuccess(data);
    }

    const data = await getCRMUsers();
    return apiSuccess(data);
  } catch (err: unknown) {
    return apiError(errMsg(err), 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json();
    const { name, email, phone, role } = body;

    // Validate required fields
    if (!name?.trim() || !email?.trim()) {
      return apiError("الاسم والبريد الإلكتروني مطلوبان", 400);
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return apiError("البريد الإلكتروني غير صالح", 400);
    }

    // Validate role
    const validRoles = ["super_admin", "admin", "sales", "support", "content", "viewer"];
    if (role && !validRoles.includes(role)) {
      return apiError("الصلاحية غير صالحة", 400);
    }

    const supabase = createAdminSupabase();
    if (!supabase) {
      return apiError("DB unavailable", 500);
    }

    // Check if email already exists
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("email", email.trim().toLowerCase())
      .single();

    if (existing) {
      return apiError("البريد الإلكتروني مسجّل مسبقاً", 409);
    }

    // Generate temporary password
    const tempPassword = generateTempPassword();

    // Create Supabase Auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: tempPassword,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      console.error("[UserCreate] Auth error:", authError);
      return apiError(authError?.message || "فشل في إنشاء حساب المستخدم", 500);
    }

    // Temp password expires in 24 hours
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // Find the current admin's users table ID for invited_by
    let invitedById: string | null = null;
    const { data: adminRow } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", auth.id)
      .single();
    if (adminRow) invitedById = adminRow.id;

    // Insert into users table — only include columns that exist
    const insertData: Record<string, unknown> = {
      auth_id: authData.user.id,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone?.trim() || null,
      role: role || "viewer",
      status: "active",
    };

    // Add optional columns (may not exist if migration not run)
    try {
      insertData.must_change_password = true;
      insertData.temp_password_expires_at = expiresAt;
      if (invitedById) insertData.invited_by = invitedById;
      insertData.invited_at = new Date().toISOString();
    } catch {}

    const { data: newUser, error: dbError } = await supabase
      .from("users")
      .insert(insertData)
      .select("id, name, email, phone, role, status, created_at")
      .single();

    if (dbError) {
      // Cleanup: delete the auth user if DB insert fails
      await supabase.auth.admin.deleteUser(authData.user.id);
      console.error("[UserCreate] DB error:", JSON.stringify(dbError));
      return apiError(`فشل في حفظ بيانات المستخدم: ${dbError.message || dbError.code || "unknown"}`, 500);
    }

    // Log the action
    await logAction(
      (auth as { email?: string }).email || "مدير",
      `إنشاء مستخدم جديد: ${name} (${email}) — الصلاحية: ${role || "viewer"}`,
      "user",
      newUser.id
    );

    // Send credentials via available channels
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://clalmobile.com";
    const loginUrl = `${baseUrl}/login`;
    const credentialMessage = [
      `مرحباً ${name}! 👋`,
      ``,
      `تم إنشاء حسابك في ClalMobile.`,
      ``,
      `رابط الدخول: ${loginUrl}`,
      `البريد: ${email}`,
      `كلمة المرور المؤقتة: ${tempPassword}`,
      ``,
      `⚠️ هذه كلمة مرور مؤقتة — ستُطلب منك تغييرها عند أول دخول.`,
      `صلاحية كلمة المرور: 24 ساعة.`,
    ].join("\n");

    const notificationResults: { channel: string; success: boolean }[] = [];

    // Try email first via provider hub
    try {
      const { getProvider } = await import("@/lib/integrations/hub");
      const emailProvider = await getProvider<{ send(p: { to: string; subject: string; html: string }): Promise<{ success: boolean }> }>("email");
      if (emailProvider) {
        await emailProvider.send({
          to: email,
          subject: "حسابك الجديد في ClalMobile",
          html: `
            <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #3b82f6;">مرحباً ${name.trim()}!</h2>
              <p>تم إنشاء حسابك في <strong>ClalMobile</strong>.</p>
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
                <p style="margin: 4px 0;"><strong>رابط الدخول:</strong> <a href="${loginUrl}">${loginUrl}</a></p>
                <p style="margin: 4px 0;"><strong>البريد:</strong> ${email}</p>
                <p style="margin: 4px 0;"><strong>كلمة المرور المؤقتة:</strong> <code style="background: #fef3c7; padding: 2px 6px; border-radius: 4px;">${tempPassword}</code></p>
              </div>
              <p style="color: #ef4444; font-weight: bold;">هذه كلمة مرور مؤقتة — ستُطلب منك تغييرها عند أول دخول.</p>
              <p style="color: #6b7280; font-size: 12px;">صلاحية كلمة المرور: 24 ساعة.</p>
            </div>
          `,
        });
        notificationResults.push({ channel: "email", success: true });
      } else {
        notificationResults.push({ channel: "email", success: false });
      }
    } catch (emailErr) {
      console.warn("[UserCreate] Email send failed:", emailErr);
      notificationResults.push({ channel: "email", success: false });
    }

    // Try WhatsApp if phone provided
    if (phone?.trim()) {
      try {
        const { sendWhatsAppText } = await import("@/lib/bot/whatsapp");
        await sendWhatsAppText(phone.trim(), credentialMessage);
        notificationResults.push({ channel: "whatsapp", success: true });
      } catch (waErr) {
        console.warn("[UserCreate] WhatsApp send failed:", waErr);
        notificationResults.push({ channel: "whatsapp", success: false });
      }
    }

    return apiSuccess({
      user: newUser,
      tempPassword,
      notifications: notificationResults,
      message: `تم إنشاء المستخدم ${name} بنجاح`,
    });
  } catch (err: unknown) {
    console.error("[UserCreate] Error:", errMsg(err));
    return apiError(errMsg(err), 500);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const { id, ...updates } = await req.json();
    if (!id) return apiError("Missing id", 400);
    await updateUser(id, updates);
    return apiSuccess({ ok: true });
  } catch (err: unknown) {
    return apiError(errMsg(err), 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const { id } = await req.json();
    if (!id) return apiError("Missing id", 400);

    const supabase = createAdminSupabase();
    if (!supabase) return apiError("DB unavailable", 500);

    // Get user's auth_id before deleting
    const { data: user } = await supabase.from("users").select("auth_id, name, email").eq("id", id).single();
    if (!user) return apiError("المستخدم غير موجود", 404);

    // Prevent deleting yourself
    if (user.auth_id === auth.id) {
      return apiError("لا يمكنك حذف حسابك الخاص", 400);
    }

    // Delete from users table (cascade will handle auth)
    const { error: dbError } = await supabase.from("users").delete().eq("id", id);
    if (dbError) throw dbError;

    // Delete from Supabase Auth
    if (user.auth_id) {
      await supabase.auth.admin.deleteUser(user.auth_id);
    }

    await logAction(
      (auth as { email?: string }).email || "مدير",
      `حذف مستخدم: ${user.name} (${user.email})`,
      "user",
      id
    );

    return apiSuccess({ ok: true });
  } catch (err: unknown) {
    return apiError(errMsg(err), 500);
  }
}
