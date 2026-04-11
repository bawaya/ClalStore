
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
    .select("id, name, phone, email, city, address, customer_code")
    .eq("auth_token", hashedToken)
    .single();

  return customer;
}
