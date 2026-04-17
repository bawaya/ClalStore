import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminSupabase } from "@/lib/supabase";
import { apiError, errMsg } from "@/lib/api-response";
import type { SupabaseClient } from "@supabase/supabase-js";

// =============================================
// RBAC: In-memory permission map (mirrors DB seed)
// =============================================

const ROLE_PERMISSIONS: Record<string, Set<string>> = {
  super_admin: new Set(["*"]),
  admin: new Set([
    "admin.view", "admin.manage",
    "products.view", "products.create", "products.edit", "products.delete",
    "orders.view", "orders.create", "orders.edit", "orders.export",
    "crm.view", "crm.create", "crm.edit", "crm.delete", "crm.export", "crm.manage",
    "commissions.view", "commissions.create", "commissions.edit", "commissions.delete", "commissions.manage", "commissions.export",
    "settings.view", "settings.edit",
    "users.view", "users.create", "users.edit", "users.delete",
    "store.view", "store.edit",
    "reports.view", "reports.export",
  ]),
  sales: new Set([
    "admin.view",
    "commissions.view", "commissions.create",
    "crm.view", "crm.create", "crm.edit",
    "orders.view", "orders.create", "orders.edit",
    "products.view",
    "store.view",
  ]),
  viewer: new Set([
    "admin.view", "products.view", "orders.view", "crm.view",
    "commissions.view", "settings.view", "store.view", "reports.view",
  ]),
};

/** Check if a role has permission for a specific module+action */
export function hasPermission(userRole: string, module: string, action: string): boolean {
  const perms = ROLE_PERMISSIONS[userRole];
  if (!perms) return false;
  if (perms.has("*")) return true;
  return perms.has(`${module}.${action}`);
}

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
      .select("id, name, role, status")
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

      return {
        ...user,
        role: dbUser.role,
        appUserId: dbUser.id,
        name: dbUser.name || user.user_metadata?.full_name || user.email?.split("@")[0] || "Admin",
      };
    }

    // Bootstrap: only allow first authenticated user as admin when users table is empty
    const { count } = await adminDb
      .from("users")
      .select("id", { count: "exact", head: true });

    if ((count ?? 0) > 0) {
      return NextResponse.json({ error: "ليس لديك صلاحيات إدارية" }, { status: 403 });
    }

    // Auto-register bootstrapped admin into users table so they don't get locked out
    const { data: bootstrapped } = await adminDb.from("users").insert({
      auth_id: user.id,
      name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Admin",
      email: user.email || "",
      role: "super_admin",
      status: "active",
    }).select("id, name").single();

    return {
      ...user,
      role: "super_admin",
      appUserId: bootstrapped?.id,
      name: bootstrapped?.name || user.user_metadata?.full_name || user.email?.split("@")[0] || "Admin",
    };
  }

  return {
    ...user,
    role: "super_admin",
    name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Admin",
  };
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
  handler: (
    req: NextRequest,
    db: SupabaseClient,
    user: { id: string; email?: string; role: string; appUserId?: string; name?: string }
  ) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    try {
      const auth = await requireAdmin(req);
      if (auth instanceof NextResponse) return auth;

      const db = createAdminSupabase();
      if (!db) return apiError("DB unavailable", 500);

      return await handler(
        req,
        db,
        auth as { id: string; email?: string; role: string; appUserId?: string; name?: string },
      );
    } catch (err: unknown) {
      return apiError(errMsg(err), 500);
    }
  };
}

/**
 * Higher-order wrapper that checks permission before executing handler.
 * Composes with withAdminAuth for auth + DB init + permission check.
 *
 * Usage:
 *   export const POST = withPermission('commissions', 'create', async (req, db, user) => {
 *     // user is authenticated and has commissions.create permission
 *     return apiSuccess({ ok: true });
 *   });
 */
export function withPermission(
  module: string,
  action: string,
  handler: (
    req: NextRequest,
    db: SupabaseClient,
    user: { id: string; email?: string; role: string; appUserId?: string; name?: string }
  ) => Promise<NextResponse>
) {
  return withAdminAuth(async (req, db, user) => {
    if (!hasPermission(user.role, module, action)) {
      return NextResponse.json(
        { error: "ليس لديك صلاحية لهذا الإجراء" },
        { status: 403 }
      );
    }
    (req as any).__user = user;
    return handler(req, db, user);
  });
}

/**
 * Log an action to the audit_log table.
 * Failures are silently logged to console — never blocks the caller.
 */
export async function logAudit(
  db: SupabaseClient,
  params: {
    userId?: string;
    userName?: string;
    userRole?: string;
    action: string;
    module: string;
    entityType?: string;
    entityId?: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
  }
) {
  try {
    await db.from("audit_log").insert({
      user_id: params.userId || null,
      user_name: params.userName || null,
      user_role: params.userRole || null,
      action: params.action,
      module: params.module,
      entity_type: params.entityType || null,
      entity_id: params.entityId || null,
      details: params.details || null,
      ip_address: params.ipAddress || null,
    });
  } catch (err) {
    console.error("[AuditLog]", err instanceof Error ? err.message : err);
  }
}
