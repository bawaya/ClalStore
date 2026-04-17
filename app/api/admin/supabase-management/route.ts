import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import {
  getProject,
  getApiKeys,
  getAuthConfig,
  getMigrations,
  listSecrets,
  checkHealth,
  runSql,
  syncEnvSecrets,
} from "@/lib/supabase-management";

/**
 * GET /api/admin/supabase-management?action=health|project|keys|auth|migrations|secrets
 * إدارة مشروع Supabase عبر Management API
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const action = req.nextUrl.searchParams.get("action") || "health";

  switch (action) {
    case "health": {
      const result = await checkHealth();
      if (!result.healthy) return apiError(result.error || "فشل الاتصال", 502);
      return apiSuccess(result);
    }
    case "project": {
      const { data, error } = await getProject();
      if (error) return apiError(error, 502);
      return apiSuccess(data);
    }
    case "keys": {
      const { data, error } = await getApiKeys();
      if (error) return apiError(error, 502);
      return apiSuccess(data);
    }
    case "auth": {
      const { data, error } = await getAuthConfig();
      if (error) return apiError(error, 502);
      return apiSuccess(data);
    }
    case "migrations": {
      const { data, error } = await getMigrations();
      if (error) return apiError(error, 502);
      return apiSuccess(data);
    }
    case "secrets": {
      const { data, error } = await listSecrets();
      if (error) return apiError(error, 502);
      // لا نرجع القيم — فقط الأسماء
      const names = Array.isArray(data) ? data.map((s) => s.name) : [];
      return apiSuccess({ secrets: names });
    }
    default:
      return apiError("action غير معروف", 400);
  }
}

/**
 * POST /api/admin/supabase-management
 * body: { action: "sql" | "sync-secrets", ... }
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  // Only super_admin can use management operations
  if ("role" in auth && auth.role !== "super_admin") {
    return apiError("صلاحيات غير كافية — super_admin فقط", 403);
  }

  const body = await req.json();
  const action = body?.action;

  switch (action) {
    case "sql": {
      const query = body?.query;
      if (!query || typeof query !== "string") {
        return apiError("query مطلوب", 400);
      }
      // Block destructive operations
      const upper = query.toUpperCase().trim();
      if (upper.startsWith("DROP") || upper.startsWith("TRUNCATE")) {
        return apiError("عمليات حذف محظورة من الـ API", 403);
      }
      const { data, error } = await runSql(query);
      if (error) return apiError(error, 502);
      return apiSuccess(data);
    }
    case "sync-secrets": {
      const secrets = body?.secrets;
      if (!secrets || typeof secrets !== "object") {
        return apiError("secrets object مطلوب", 400);
      }
      const { data, error } = await syncEnvSecrets(secrets);
      if (error) return apiError(error, 502);
      return apiSuccess(data);
    }
    default:
      return apiError("action غير معروف", 400);
  }
}
