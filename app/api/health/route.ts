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
    const db = createAdminSupabase();
    if (!db) throw new Error("Missing Supabase config");
    const t0 = Date.now();
    const { error } = await db.from("settings").select("key").limit(1);
    checks.database = { ok: !error, ms: Date.now() - t0 };
  } catch (err: any) {
    checks.database = { ok: false };
  }

  // 2. Environment variables
  const requiredEnvs = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
  const missingEnvs = requiredEnvs.filter((e) => !process.env[e]);
  checks.env = { ok: missingEnvs.length === 0 };

  // 3. Payment provider
  checks.payment = { ok: !!process.env.RIVHIT_API_KEY };

  // 4. Email provider
  const hasEmail = !!(process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY);
  checks.email = { ok: hasEmail };

  // 5. WhatsApp provider
  checks.whatsapp = { ok: !!process.env.YCLOUD_API_KEY };

  // 5b. AI providers — separate keys per feature
  const aiKeys = {
    bot:   process.env.ANTHROPIC_API_KEY_BOT   || process.env.ANTHROPIC_API_KEY || "",
    admin: process.env.ANTHROPIC_API_KEY_ADMIN || process.env.ANTHROPIC_API_KEY || "",
    store: process.env.ANTHROPIC_API_KEY_STORE || process.env.ANTHROPIC_API_KEY || "",
    openai: process.env.OPENAI_API_KEY_ADMIN   || process.env.OPENAI_API_KEY   || "",
  };
  checks.ai = { ok: !!(aiKeys.bot && aiKeys.admin) };

  // 6. SMS integration (DB)
  try {
    const smsDb = createAdminSupabase();
    if (!smsDb) throw new Error("Missing Supabase config");
    const { data: smsInteg } = await smsDb
      .from("integrations")
      .select("config, status, provider")
      .eq("type", "sms")
      .single();
    const cfg = smsInteg?.config as Record<string, any> || {};
    const configKeys = Object.keys(cfg).filter(k => cfg[k]);
    checks.sms = {
      ok: !!(smsInteg?.status === "active" && cfg.account_sid && cfg.verify_service_sid),
    };
  } catch {
    checks.sms = { ok: false };
  }

  // 7. Image processing
  const hasRemoveBg = !!process.env.REMOVEBG_API_KEY;
  const hasR2 = !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_PUBLIC_URL);
  checks.imageAI = { ok: hasRemoveBg && hasR2 };

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
