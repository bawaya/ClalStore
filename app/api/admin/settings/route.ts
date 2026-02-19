export const runtime = 'edge';

import { NextRequest, NextResponse } from "next/server";
import { getAdminSettings, updateSetting, getIntegrations, updateIntegration, logAction } from "@/lib/admin/queries";

// Prevent Next.js from caching this route — settings must always be fresh
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [settings, integrations] = await Promise.all([
      getAdminSettings(),
      getIntegrations(),
    ]);
    return NextResponse.json({ settings, integrations });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.type === "setting") {
      await updateSetting(body.key, body.value);
      await logAction("مدير", `تعديل إعداد: ${body.key}`, "setting");
    } else if (body.type === "integration") {
      // Sanitize updates — only allow known fields
      const allowed: Record<string, any> = {};
      if (body.updates.provider !== undefined) allowed.provider = body.updates.provider;
      if (body.updates.config !== undefined) allowed.config = body.updates.config;
      if (body.updates.status !== undefined) allowed.status = body.updates.status;
      if (body.updates.last_synced_at !== undefined) allowed.last_synced_at = body.updates.last_synced_at;

      await updateIntegration(body.id, allowed);
      await logAction("مدير", `تعديل تكامل: ${body.updates.provider || body.id}`, "integration", body.id);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
