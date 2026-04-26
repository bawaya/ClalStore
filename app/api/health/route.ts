// =====================================================
// ClalMobile — Health Check API
// GET: System status for monitoring
// =====================================================

import { NextRequest } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { getConfiguredAIRuntime } from "@/lib/ai/runtime";
import { apiSuccess, apiError } from "@/lib/api-response";
import { getIntegrationConfig } from "@/lib/integrations/hub";

const EMPTY_CONFIG: Record<string, any> = {};

export async function GET(req: NextRequest) {
  // Bearer token auth for monitoring systems (no admin session required)
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const validToken = process.env.HEALTH_CHECK_TOKEN;
  if (!validToken || !token || token !== validToken) {
    return apiError("Unauthorized", 401);
  }

  const checks: Record<string, { ok: boolean; ms?: number }> = {};
  const start = Date.now();

  // 1. Database
  try {
    const t0 = Date.now();
    const { error } = await createAdminSupabase().from("settings").select("key").limit(1);
    checks.database = { ok: !error, ms: Date.now() - t0 };
  } catch (err: unknown) {
    checks.database = { ok: false };
  }

  // 2. Environment variables
  const requiredEnvs = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
  const missingEnvs = requiredEnvs.filter((e) => !process.env[e]);
  checks.env = { ok: missingEnvs.length === 0 };

  const [paymentCfg, emailCfg, whatsappCfg, smsCfg, imageCfg, storageCfg] = await Promise.all([
    getIntegrationConfig("payment").catch(() => EMPTY_CONFIG),
    getIntegrationConfig("email").catch(() => EMPTY_CONFIG),
    getIntegrationConfig("whatsapp").catch(() => EMPTY_CONFIG),
    getIntegrationConfig("sms").catch(() => EMPTY_CONFIG),
    getIntegrationConfig("image_enhance").catch(() => EMPTY_CONFIG),
    getIntegrationConfig("storage").catch(() => EMPTY_CONFIG),
  ]);

  // 3. Payment provider
  checks.payment = {
    ok: !!(
      paymentCfg.group_private_token ||
      process.env.ICREDIT_GROUP_PRIVATE_TOKEN
    ),
  };

  // 4. Email provider
  const hasEmail = !!(
    emailCfg.api_key ||
    process.env.RESEND_API_KEY ||
    process.env.SENDGRID_API_KEY
  );
  checks.email = { ok: hasEmail };

  // 5. WhatsApp provider
  checks.whatsapp = {
    ok: !!(whatsappCfg.api_key || process.env.YCLOUD_API_KEY),
  };

  // 5b. AI providers — unified via admin integration with env fallback
  try {
    const [botAI, adminAI, storeAI] = await Promise.all([
      getConfiguredAIRuntime("bot"),
      getConfiguredAIRuntime("admin"),
      getConfiguredAIRuntime("store"),
    ]);
    checks.ai = {
      ok: !!(botAI && adminAI && storeAI),
    };
  } catch {
    checks.ai = { ok: false };
  }

  // 6. SMS integration
  checks.sms = {
    ok: !!(
      (smsCfg.account_sid && smsCfg.verify_service_sid) ||
      (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_VERIFY_SERVICE_SID)
    ),
  };

  // 7. Image processing
  const hasRemoveBg = !!(imageCfg.api_key || process.env.REMOVEBG_API_KEY);
  const hasR2 = !!(
    (storageCfg.account_id && storageCfg.access_key_id && storageCfg.public_url) ||
    (process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_PUBLIC_URL)
  );
  checks.imageAI = { ok: hasRemoveBg };
  checks.storage = { ok: hasR2 };

  const allOk = Object.values(checks).every((c) => c.ok);
  const criticalOk = checks.database?.ok && checks.env?.ok;

  return apiSuccess(
    {
      status: criticalOk ? (allOk ? "healthy" : "degraded") : "unhealthy",
      uptime: 0,
      totalMs: Date.now() - start,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "1.0.0",
      checks,
    },
    undefined,
    criticalOk ? 200 : 503,
  );
}
