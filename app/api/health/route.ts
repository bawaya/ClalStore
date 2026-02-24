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

  // 5b. AI providers
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  checks.ai = {
    ok: hasAnthropic,
    error: [
      !hasAnthropic ? "ANTHROPIC_API_KEY missing" : `ANTHROPIC ✓ (${process.env.ANTHROPIC_API_KEY?.substring(0, 8)}...)`,
      !hasOpenAI ? "OPENAI_API_KEY missing" : "OPENAI ✓",
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
