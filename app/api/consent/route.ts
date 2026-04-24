// =====================================================
// /api/consent — record cookie consent events to consent_log
// Public endpoint; no auth required (visitor_id from client cookie)
// Mandatory under Israeli Privacy Protection Law Amendment 13
// for proof-of-consent in case of regulatory enforcement.
// =====================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { createAdminSupabase } from "@/lib/supabase";
import { authenticateCustomer } from "@/lib/customer-auth";
import { hashSHA256 } from "@/lib/crypto";
import { apiSuccess, apiError } from "@/lib/api-response";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";

const bodySchema = z.object({
  visitor_id: z.string().min(4).max(120),
  source: z.enum(["cookie_banner", "account_settings", "checkout", "withdraw"]),
  functional: z.boolean(),
  analytics: z.boolean(),
  advertising: z.boolean(),
  privacy_version: z.string().min(4).max(50),
});

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(req: NextRequest) {
  // Mild rate-limit to deter abuse (consent is normally written 1-2x per visitor)
  const rl = checkRateLimit(getRateLimitKey(clientIp(req), "consent"), {
    maxRequests: 30,
    windowMs: 60_000,
  });
  if (!rl.allowed) return apiError("Too many requests", 429);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid body", 400);
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return apiError("Invalid payload", 400);

  const supabase = createAdminSupabase();
  if (!supabase) return apiError("Service unavailable", 503);

  // If the visitor is logged in, link the consent event to the customer.
  // We don't FAIL when not authenticated — guests must also have a record.
  let customerId: string | null = null;
  try {
    const customer = await authenticateCustomer(req);
    if (customer) customerId = customer.id;
  } catch {
    /* guest */
  }

  const ip = clientIp(req);
  const ipHash = ip === "unknown" ? null : await hashSHA256(ip + (process.env.IP_HASH_SALT || ""));

  // 1. Append-only audit row
  const { error: logErr } = await supabase.from("consent_log").insert({
    visitor_id: parsed.data.visitor_id,
    customer_id: customerId,
    source: parsed.data.source,
    essential: true,
    functional: parsed.data.functional,
    analytics: parsed.data.analytics,
    advertising: parsed.data.advertising,
    privacy_version: parsed.data.privacy_version,
    user_agent: req.headers.get("user-agent")?.slice(0, 500) || null,
    ip_hash: ipHash,
  });
  if (logErr) {
    console.error("consent_log insert error:", logErr);
    return apiError("فشل تسجيل الموافقة", 500);
  }

  // 2. Mirror current consent into customers if logged in
  if (customerId) {
    await supabase
      .from("customers")
      .update({
        consent_functional: parsed.data.functional,
        consent_analytics: parsed.data.analytics,
        consent_advertising: parsed.data.advertising,
        privacy_version_accepted: parsed.data.privacy_version,
        privacy_accepted_at: new Date().toISOString(),
      })
      .eq("id", customerId);
  }

  return apiSuccess({ recorded: true });
}
