// =====================================================
// /api/customer/consent
// GET  → return the customer's current consent flags
// POST → update consent flags (granular: cookies + marketing channels)
// Each change is appended to consent_log for audit.
// =====================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { createAdminSupabase } from "@/lib/supabase";
import { authenticateCustomer } from "@/lib/customer-auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { hashSHA256 } from "@/lib/crypto";

const updateSchema = z.object({
  consent_functional: z.boolean().optional(),
  consent_analytics: z.boolean().optional(),
  consent_advertising: z.boolean().optional(),
  consent_marketing_email: z.boolean().optional(),
  consent_marketing_sms: z.boolean().optional(),
  consent_marketing_whatsapp: z.boolean().optional(),
  privacy_version: z.string().min(4).max(50).optional(),
});

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function GET(req: NextRequest) {
  const customer = await authenticateCustomer(req);
  if (!customer) return apiError("غير مصرح", 401);

  const supabase = createAdminSupabase();
  if (!supabase) return apiError("Service unavailable", 503);

  const { data } = await supabase
    .from("customers")
    .select(
      "consent_essential, consent_functional, consent_analytics, consent_advertising, consent_marketing_email, consent_marketing_sms, consent_marketing_whatsapp, privacy_version_accepted, privacy_accepted_at",
    )
    .eq("id", customer.id)
    .maybeSingle();

  return apiSuccess(data || {});
}

export async function POST(req: NextRequest) {
  const customer = await authenticateCustomer(req);
  if (!customer) return apiError("غير مصرح", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid body", 400);
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return apiError("Invalid payload", 400);

  const supabase = createAdminSupabase();
  if (!supabase) return apiError("Service unavailable", 503);

  // Build the customer update — only fields that were provided
  const update: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== undefined) update[k] = v;
  }
  if (parsed.data.privacy_version) {
    update.privacy_accepted_at = new Date().toISOString();
  }

  const { error: updErr } = await supabase
    .from("customers")
    .update(update)
    .eq("id", customer.id);
  if (updErr) {
    console.error("Consent update error:", updErr);
    return apiError("فشل التحديث", 500);
  }

  // Append-only audit row
  const ip = clientIp(req);
  const ipHash = ip === "unknown" ? null : await hashSHA256(ip + (process.env.IP_HASH_SALT || ""));
  await supabase.from("consent_log").insert({
    visitor_id: `customer:${customer.id}`,
    customer_id: customer.id,
    source: "account_settings",
    essential: true,
    functional: parsed.data.consent_functional ?? null,
    analytics: parsed.data.consent_analytics ?? null,
    advertising: parsed.data.consent_advertising ?? null,
    privacy_version: parsed.data.privacy_version ?? null,
    user_agent: req.headers.get("user-agent")?.slice(0, 500) || null,
    ip_hash: ipHash,
  });

  return apiSuccess({ updated: true });
}
