
// =====================================================
// ClalMobile — Customer Authentication (shared)
// Authenticates customer via Bearer token (SHA-256 hashed)
// =====================================================

import { NextRequest } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { hashSHA256 } from "@/lib/crypto";

export async function authenticateCustomer(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  if (!token || token.length < 32) return null;

  const supabase = createAdminSupabase();
  if (!supabase) return null;

  const hashedToken = await hashSHA256(token);

  const { data: customer } = await supabase
    .from("customers")
    .select("id, name, phone, email, city, address, customer_code, auth_token_expires_at")
    .eq("auth_token", hashedToken)
    .single();

  if (!customer) return null;

  // Check token expiry (4.3.3)
  if (customer.auth_token_expires_at) {
    const expiresAt = new Date(customer.auth_token_expires_at).getTime();
    if (Date.now() > expiresAt) return null;
  }

  const { auth_token_expires_at: _, ...safeCustomer } = customer;
  return safeCustomer;
}
