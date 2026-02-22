export const runtime = 'edge';

import { NextRequest, NextResponse } from "next/server";
import { getAdminSettings, updateSetting, getIntegrations, updateIntegration, logAction } from "@/lib/admin/queries";

// Prevent Next.js from caching this route — settings must always be fresh
export const dynamic = "force-dynamic";

/** Sensitive config keys that should be masked when returned to the frontend */
const SENSITIVE_KEYS = new Set([
  "api_key", "auth_token", "secret_key", "password", "access_token",
  "client_secret", "verify_token", "project_token",
]);

const MASK = "••••••••";

/** Mask sensitive fields in integration config, preserving a _has_ prefix for frontend */
function maskConfig(config: Record<string, any> | null): Record<string, any> {
  if (!config) return {};
  const masked: Record<string, any> = {};
  for (const [key, value] of Object.entries(config)) {
    if (SENSITIVE_KEYS.has(key) && value && typeof value === "string" && value.length > 0) {
      // Show last 4 chars for identification, mask the rest
      masked[key] = value.length > 6 ? MASK + value.slice(-4) : MASK;
      masked[`_has_${key}`] = true;
    } else {
      masked[key] = value;
    }
  }
  return masked;
}

export async function GET() {
  try {
    const [settings, integrations] = await Promise.all([
      getAdminSettings(),
      getIntegrations(),
    ]);
    // Mask sensitive fields in integration configs
    const safeIntegrations = integrations.map((integ: any) => ({
      ...integ,
      config: maskConfig(integ.config),
    }));
    return NextResponse.json({ settings, integrations: safeIntegrations });
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
      if (body.updates.status !== undefined) allowed.status = body.updates.status;
      if (body.updates.last_synced_at !== undefined) allowed.last_synced_at = body.updates.last_synced_at;

      // Config: merge with existing — don't overwrite masked values
      if (body.updates.config !== undefined) {
        const newConfig = { ...body.updates.config };
        // Remove _has_ metadata keys
        for (const key of Object.keys(newConfig)) {
          if (key.startsWith("_has_")) delete newConfig[key];
        }
        // If a sensitive field still contains the mask, get the old value from DB
        const hasMaskedValues = Object.entries(newConfig).some(
          ([key, val]) => SENSITIVE_KEYS.has(key) && typeof val === "string" && val.includes(MASK)
        );
        if (hasMaskedValues) {
          const integrations = await getIntegrations();
          const existing = integrations.find((i: any) => i.id === body.id);
          const oldConfig = existing?.config || {};
          for (const [key, val] of Object.entries(newConfig)) {
            if (SENSITIVE_KEYS.has(key) && typeof val === "string" && val.includes(MASK)) {
              newConfig[key] = oldConfig[key] || "";
            }
          }
        }
        allowed.config = newConfig;
      }

      await updateIntegration(body.id, allowed);
      await logAction("مدير", `تعديل تكامل: ${body.updates.provider || body.id}`, "integration", body.id);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
