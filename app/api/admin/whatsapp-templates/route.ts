
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import {
  listTemplates,
  createTemplate,
  deleteTemplate,
  provisionRequiredTemplates,
  REQUIRED_TEMPLATES,
} from "@/lib/integrations/ycloud-templates";
import { apiSuccess, apiError, errDetail } from "@/lib/api-response";

export const dynamic = "force-dynamic";

/** GET — List all WhatsApp templates */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const templates = await listTemplates();
    const requiredNames = new Set(REQUIRED_TEMPLATES.map((t) => t.name));

    return apiSuccess({
      templates,
      required: REQUIRED_TEMPLATES.map((t) => t.name),
      missing: REQUIRED_TEMPLATES.filter((t) => !templates.some((e) => e.name === t.name)).map(
        (t) => t.name
      ),
      summary: {
        total: templates.length,
        approved: templates.filter((t) => t.status === "APPROVED").length,
        pending: templates.filter((t) => t.status === "PENDING").length,
        rejected: templates.filter((t) => t.status === "REJECTED").length,
        requiredReady: templates.filter(
          (t) => requiredNames.has(t.name) && t.status === "APPROVED"
        ).length,
        requiredTotal: REQUIRED_TEMPLATES.length,
      },
    });
  } catch (err: unknown) {
    const message = errDetail(err, String(err));
    console.error("[WhatsApp Templates GET]", message);
    return apiError("Failed to fetch templates");
  }
}

/** POST — Create template(s). Body: { action: "provision_all" } or { template: {...} } */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json();

    if (body.action === "provision_all") {
      const result = await provisionRequiredTemplates();
      return apiSuccess(result);
    }

    if (body.template) {
      const result = await createTemplate(body.template);
      return apiSuccess(result);
    }

    return apiError("Invalid request — send { action: 'provision_all' } or { template: {...} }", 400);
  } catch (err: unknown) {
    const message = errDetail(err, String(err));
    console.error("[WhatsApp Templates POST]", message);
    return apiError("Failed to create template");
  }
}

/** DELETE — Delete a template by name. Query: ?name=clal_xxx */
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const name = req.nextUrl.searchParams.get("name");
    if (!name) {
      return apiError("Missing ?name= parameter", 400);
    }

    const result = await deleteTemplate(name);
    return apiSuccess(result);
  } catch (err: unknown) {
    const message = errDetail(err, String(err));
    console.error("[WhatsApp Templates DELETE]", message);
    return apiError("Failed to delete template");
  }
}
