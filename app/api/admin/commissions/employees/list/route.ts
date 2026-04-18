// =====================================================
// ClalMobile — Commission Employees List (Bearer Token Auth)
// For local HTML app — returns employee list for selection
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { corsHeaders as sharedCorsHeaders } from "@/lib/commissions/cors";
import { safeTokenEqual } from "@/lib/commissions/safe-compare";

// Preserve this route's historical "wildcard when unset" behaviour.
function corsHeaders(origin?: string | null): Record<string, string> {
  return sharedCorsHeaders(origin, { wildcardWhenUnset: true });
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const validToken = process.env.COMMISSION_API_TOKEN;

  if (!safeTokenEqual(token, validToken)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders() });
  }

  const db = createAdminSupabase();
  if (!db) {
    return NextResponse.json({ error: "DB unavailable" }, { status: 500, headers: corsHeaders() });
  }

  const { data, error } = await db
    .from("commission_employees")
    .select("id, name, phone, token, role, active")
    .eq("active", true)
    .order("name");

  if (error) {
    console.error("Employee list DB error:", error.message);
    return NextResponse.json({ error: "فشل في جلب قائمة الموظفين" }, { status: 500, headers: corsHeaders() });
  }

  return NextResponse.json(
    { employees: data || [] },
    { status: 200, headers: corsHeaders() }
  );
}
