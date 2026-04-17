// =====================================================
// ClalMobile — Commission Employees List (Bearer Token Auth)
// For local HTML app — returns employee list for selection
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";

const ALLOWED_ORIGINS = (process.env.COMMISSION_ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);

function corsHeaders(origin?: string | null) {
  const allowed = ALLOWED_ORIGINS.length === 0
    ? "*"
    : (origin && ALLOWED_ORIGINS.includes(origin)) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const validToken = process.env.COMMISSION_API_TOKEN;

  if (!validToken || !token || token !== validToken) {
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
