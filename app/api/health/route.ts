export const runtime = 'edge';

// =====================================================
// ClalMobile — Health Check API
// GET: System status for monitoring
// =====================================================

import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";

export async function GET() {
  const checks: Record<string, { ok: boolean; ms?: number; error?: string }> = {};
  const start = Date.now();

  // 1. Database
  try {
    const t0 = Date.now();
    const { error } = await createAdminSupabase().from("settings").select("key").limit(1);
    checks.database = { ok: !error, ms: Date.now() - t0, error: error?.message };
  } catch (err: any) {
    checks.database = { ok: false, error: err.message };
  }

  // 2. Environment variables
  const requiredEnvs = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
  const missingEnvs = requiredEnvs.filter((e) => !process.env[e]);
  checks.env = { ok: missingEnvs.length === 0, error: missingEnvs.length > 0 ? `Missing: ${missingEnvs.join(", ")}` : undefined };

  // 3. Payment provider
  checks.payment = { ok: !!process.env.RIVHIT_API_KEY, error: !process.env.RIVHIT_API_KEY ? "Not configured" : undefined };

  // 4. Email provider
  checks.email = { ok: !!process.env.SENDGRID_API_KEY, error: !process.env.SENDGRID_API_KEY ? "Not configured" : undefined };

  // 5. WhatsApp provider
  checks.whatsapp = { ok: !!process.env.YCLOUD_API_KEY, error: !process.env.YCLOUD_API_KEY ? "Not configured" : undefined };

  // 5b. AI providers — separate keys per feature
  const aiKeys = {
    bot:   process.env.ANTHROPIC_API_KEY_BOT   || process.env.ANTHROPIC_API_KEY || "",
    admin: process.env.ANTHROPIC_API_KEY_ADMIN || process.env.ANTHROPIC_API_KEY || "",
    store: process.env.ANTHROPIC_API_KEY_STORE || process.env.ANTHROPIC_API_KEY || "",
    openai: process.env.OPENAI_API_KEY_ADMIN   || process.env.OPENAI_API_KEY   || "",
  };
  checks.ai = {
    ok: !!(aiKeys.bot && aiKeys.admin),
    error: [
      aiKeys.bot   ? `BOT ✓ (${aiKeys.bot.substring(0, 8)}...)`     : "BOT ✗",
      aiKeys.admin ? `ADMIN ✓ (${aiKeys.admin.substring(0, 8)}...)` : "ADMIN ✗",
      aiKeys.store ? `STORE ✓ (${aiKeys.store.substring(0, 8)}...)` : "STORE ✗",
      aiKeys.openai ? "OPENAI ✓" : "OPENAI ✗",
    ].join(" | "),
  };

  // 6. SMS integration (DB)
  try {
    const { data: smsInteg } = await createAdminSupabase()
      .from("integrations")
      .select("config, status, provider")
      .eq("type", "sms")
      .single();
    const cfg = smsInteg?.config as Record<string, any> || {};
    const configKeys = Object.keys(cfg).filter(k => cfg[k]);
    checks.sms = {
      ok: !!(smsInteg?.status === "active" && cfg.account_sid && cfg.verify_service_sid),
      error: `status=${smsInteg?.status} provider=${smsInteg?.provider} keys=[${configKeys.join(",")}]`,
    };
  } catch (err: any) {
    checks.sms = { ok: false, error: err.message };
  }

  // 7. Image processing
  const hasRemoveBg = !!process.env.REMOVEBG_API_KEY;
  const hasR2 = !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_PUBLIC_URL);
  checks.imageAI = {
    ok: hasRemoveBg,
    error: [
      hasRemoveBg ? "RemoveBG ✓" : "RemoveBG ✗",
      hasR2 ? "R2 ✓" : "R2 ✗ (Supabase fallback)",
    ].join(" | "),
  };

  const allOk = Object.values(checks).every((c) => c.ok);
  const criticalOk = checks.database?.ok && checks.env?.ok;

  return NextResponse.json({
    status: criticalOk ? (allOk ? "healthy" : "degraded") : "unhealthy",
    uptime: process.uptime?.() || 0,
    totalMs: Date.now() - start,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "1.0.0",
    checks,
  }, { status: criticalOk ? 200 : 503 });
}
