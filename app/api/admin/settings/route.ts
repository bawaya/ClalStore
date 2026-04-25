import { NextRequest, NextResponse } from "next/server";
import {
  getAdminSettings,
  getIntegrations,
  logAction,
  updateIntegration,
  updateSetting,
} from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/admin/auth";
import { apiError, apiSuccess } from "@/lib/api-response";
import {
  maskIntegrationsForAdmin,
  prepareIntegrationConfigForUpdate,
} from "@/lib/integrations/secrets";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const [settings, integrations] = await Promise.all([getAdminSettings(), getIntegrations()]);
    const safeIntegrations = await maskIntegrationsForAdmin(integrations);

    return apiSuccess({ settings, integrations: safeIntegrations });
  } catch (error: unknown) {
    console.error("Settings GET error:", error);
    return apiError("فشل في جلب الإعدادات", 500);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const updatedBy = "appUserId" in auth ? auth.appUserId || null : null;

    const body = await req.json();

    if (body.type === "setting") {
      await updateSetting(body.key, body.value);
      await logAction(auth.name || "مدير", `تعديل إعداد: ${body.key}`, "setting");
      return apiSuccess(null);
    }

    if (body.type === "integration") {
      const allowed: Record<string, unknown> = {};

      if (body.updates?.provider !== undefined) allowed.provider = body.updates.provider;
      if (body.updates?.status !== undefined) allowed.status = body.updates.status;
      if (body.updates?.last_synced_at !== undefined) {
        allowed.last_synced_at = body.updates.last_synced_at;
      }

      if (body.updates?.config !== undefined) {
        allowed.config = await prepareIntegrationConfigForUpdate({
          integrationId: body.id,
          config: body.updates.config,
          updatedBy,
        });
      }

      await updateIntegration(body.id, allowed);
      await logAction(
        auth.name || "مدير",
        `تعديل تكامل: ${body.updates?.provider || body.id}`,
        "integration",
        body.id
      );

      return apiSuccess(null);
    }

    return apiError("نوع تحديث غير معروف", 400);
  } catch (error: unknown) {
    console.error("Settings PUT error:", error);
    const message =
      error instanceof Error ? error.message : "فشل في تحديث الإعدادات";
    return apiError(message, 500);
  }
}
