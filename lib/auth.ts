// =====================================================
// ClalMobile — Auth Utilities
// Login, session check, role check, middleware
// =====================================================

import { getSupabase } from "./supabase";
import type { UserRole } from "./constants";
import { ROLE_PERMISSIONS } from "./constants";

// ===== Types =====
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar_url?: string;
}

function ensureAuthClient() {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error("خدمة المصادقة غير متوفرة حالياً — حاول لاحقاً");
  }
  return supabase;
}

// ===== Get current session =====
export async function getCurrentUser(): Promise<AuthUser | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Fetch profile from users table
  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("auth_id", user.id)
    .single() as { data: Record<string, unknown> | null };

  if (!profile) return null;

  return {
    id: profile.id as string,
    email: user.email || "",
    name: profile.name as string,
    role: profile.role as UserRole,
    avatar_url: (profile.avatar_url as string) || undefined,
  };
}

// ===== Sign in =====
export async function signIn(email: string, password: string) {
  const supabase = ensureAuthClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

// ===== Sign out =====
export async function signOut() {
  const supabase = ensureAuthClient();
  await supabase.auth.signOut();
}

// ===== Check permission =====
export function hasPermission(role: UserRole, permission: string): boolean {
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return false;
  if (perms.includes("*")) return true;
  // Check exact match or section match
  return perms.some(
    (p) => p === permission || permission.startsWith(p + ".")
  );
}

// ===== Check if role can access a page =====
export function canAccessPage(role: UserRole, page: string): boolean {
  return hasPermission(role, page);
}
