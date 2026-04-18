/**
 * GET /api/employee/me
 *
 * Returns the authenticated employee's profile — used by the PWA shell
 * header to show "Hi, <name>" and as a general me-lookup for client
 * components that don't already carry the auth info.
 *
 * Auth pattern matches `lib/pwa/auth.ts::requireEmployee` (Supabase
 * server client from cookies → auth.users → users.auth_id join).
 * Returns the minimum info needed by the UI — not the full DB row.
 */

import { NextRequest } from "next/server";
import { requireEmployee } from "@/lib/pwa/auth";
import { createAdminSupabase } from "@/lib/supabase";
import { apiError, apiSuccess, safeError } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const authed = await requireEmployee(req);
    if ("status" in authed) return authed;

    const db = createAdminSupabase();
    if (!db) return apiError("DB unavailable", 500);

    // Enrich with phone + avatar (requireEmployee only fetches basics).
    // If the extra columns don't exist, silently ignore.
    let phone: string | null = null;
    let avatarUrl: string | null = null;
    try {
      const { data } = await db
        .from("users")
        .select("phone, avatar_url")
        .eq("id", authed.appUserId)
        .maybeSingle();
      if (data) {
        phone = (data as { phone?: string | null }).phone ?? null;
        avatarUrl = (data as { avatar_url?: string | null }).avatar_url ?? null;
      }
    } catch {
      // avatar_url / phone columns may not exist in all deployments
    }

    return apiSuccess({
      id: authed.appUserId,
      authId: authed.authId,
      name: authed.name,
      email: authed.email ?? null,
      role: authed.role,
      phone,
      avatarUrl,
    });
  } catch (err) {
    return safeError(err, "EmployeeMe", "خطأ في السيرفر", 500);
  }
}
