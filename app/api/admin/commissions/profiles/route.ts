
// =====================================================
// ClalMobile — Employee Commission Profiles API
// GET  — list all employees with their commission profiles
// POST — create/update profile for an employee (upsert)
// DELETE — remove profile (employee reverts to contract rates)
// =====================================================

import { NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/admin/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { validateBody } from "@/lib/admin/validators";

const profileSchema = z.object({
  user_id: z.string().uuid(),
  line_multiplier: z.number().min(0).max(10).default(4),
  device_rate: z.number().min(0).max(1).default(0.05),
  device_milestone_bonus: z.number().min(0).default(0),
  min_package_price: z.number().min(0).default(19.90),
  loyalty_bonuses: z.record(z.string(), z.number()).default({}),
  notes: z.string().max(500).optional(),
  active: z.boolean().default(true),
});

// GET — all employees with their profiles (LEFT JOIN)
export const GET = withAdminAuth(async (_req: NextRequest, db: SupabaseClient) => {
  // Get all active users with sales/admin roles
  const { data: users, error: usersErr } = await db
    .from("users")
    .select("id, name, email, phone, role, status")
    .in("role", ["super_admin", "admin", "sales", "support"])
    .eq("status", "active")
    .order("name");

  if (usersErr) return apiError(usersErr.message, 500);

  // Get all profiles
  const { data: profiles, error: profErr } = await db
    .from("employee_commission_profiles")
    .select("*");

  if (profErr) return apiError(profErr.message, 500);

  const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

  const result = (users || []).map((u: any) => ({
    ...u,
    profile: profileMap.get(u.id) || null,
  }));

  return apiSuccess({ employees: result });
});

// POST — upsert profile
export const POST = withAdminAuth(async (req: NextRequest, db: SupabaseClient) => {
  const v = validateBody(await req.json(), profileSchema);
  if (!v.success) return apiError(v.error, 400);

  const { user_id, ...profileData } = v.data;

  // Verify user exists
  const { data: user } = await db
    .from("users")
    .select("id, name")
    .eq("id", user_id)
    .single();

  if (!user) return apiError("Employee not found", 404);

  const { data, error } = await db
    .from("employee_commission_profiles")
    .upsert({
      user_id,
      ...profileData,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" })
    .select()
    .single();

  if (error) return apiError(error.message, 500);
  return apiSuccess(data);
});

// DELETE — remove profile
export const DELETE = withAdminAuth(async (req: NextRequest, db: SupabaseClient) => {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("user_id");
  if (!userId) return apiError("user_id required", 400);

  const { error } = await db
    .from("employee_commission_profiles")
    .delete()
    .eq("user_id", userId);

  if (error) return apiError(error.message, 500);
  return apiSuccess({ deleted: true });
});
