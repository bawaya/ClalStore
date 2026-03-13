export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import {
  listTemplates,
  createTemplate,
  deleteTemplate,
  provisionRequiredTemplates,
  REQUIRED_TEMPLATES,
} from "@/lib/integrations/ycloud-templates";

export const dynamic = "force-dynamic";

/** GET — List all WhatsApp templates */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const templates = await listTemplates();
    const requiredNames = new Set(REQUIRED_TEMPLATES.map((t) => t.name));

    return NextResponse.json({
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
    const message = err instanceof Error ? err.message : String(err);
    console.error("[WhatsApp Templates GET]", message);
    return NextResponse.json({ error: message }, { status: 500 });
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
      return NextResponse.json(result);
    }

    if (body.template) {
      const result = await createTemplate(body.template);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Invalid request — send { action: 'provision_all' } or { template: {...} }" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[WhatsApp Templates POST]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** DELETE — Delete a template by name. Query: ?name=clal_xxx */
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const name = req.nextUrl.searchParams.get("name");
    if (!name) {
      return NextResponse.json({ error: "Missing ?name= parameter" }, { status: 400 });
    }

    const result = await deleteTemplate(name);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[WhatsApp Templates DELETE]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
