// =====================================================
// ClalMobile — Commission Summary API (Bearer Token Auth)
// For local HTML app sync — read-only, CORS-enabled
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { calcDeviceCommission, calcLoyaltyBonus } from "@/lib/commissions/calculator";
import { checkRateLimit } from "@/lib/rate-limit";

const RATE_LIMIT = { maxRequests: 60, windowMs: 3600_000 }; // 60/hour

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  };
}

// CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET(req: NextRequest) {
  // Bearer token auth
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  const validToken = process.env.COMMISSION_API_TOKEN;

  if (!validToken || !token || token !== validToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders() });
  }

  // Rate limit by token
  const rl = checkRateLimit(`comm-api:${token.slice(-8)}`, RATE_LIMIT);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded — max 60 requests/hour" },
      { status: 429, headers: { ...corsHeaders(), "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  const db = createAdminSupabase();
  if (!db) {
    return NextResponse.json({ error: "DB unavailable" }, { status: 500, headers: corsHeaders() });
  }

  const month = req.nextUrl.searchParams.get("month") || new Date().toISOString().slice(0, 7);
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-31`;

  // Parallel queries
  const [salesRes, sanctionsRes, targetRes] = await Promise.all([
    db.from("commission_sales").select("*").gte("sale_date", monthStart).lte("sale_date", monthEnd),
    db.from("commission_sanctions").select("*").gte("sanction_date", monthStart).lte("sanction_date", monthEnd),
    db.from("commission_targets").select("*").eq("month", month).maybeSingle(),
  ]);

  interface SaleRow { sale_type: string; sale_date: string; commission_amount: number; device_sale_amount: number; loyalty_start_date: string | null; loyalty_status: string | null; }
  interface SanctionRow { amount: number; }
  interface TargetRow { target_total: number; target_lines_amount: number; target_devices_amount: number; is_locked: boolean; }

  const sales: SaleRow[] = salesRes.data || [];
  const sanctions: SanctionRow[] = sanctionsRes.data || [];
  const target = targetRes.data as TargetRow | null;

  // Aggregate
  const linesSales = sales.filter((s: SaleRow) => s.sale_type === "line");
  const devicesSales = sales.filter((s: SaleRow) => s.sale_type === "device");

  const linesCount = linesSales.length;
  const linesCommission = linesSales.reduce((sum: number, s: SaleRow) => sum + (s.commission_amount || 0), 0);

  const totalDeviceSalesAmount = devicesSales.reduce((sum: number, s: SaleRow) => sum + (s.device_sale_amount || 0), 0);
  const deviceCalc = calcDeviceCommission(totalDeviceSalesAmount);

  const sanctionsTotal = sanctions.reduce((sum: number, s: SanctionRow) => sum + (s.amount || 0), 0);

  // Loyalty bonuses
  const activeLines = linesSales.filter((s: SaleRow) => s.loyalty_start_date && s.loyalty_status === "active");
  const loyaltyBonus = activeLines.reduce((sum: number, s: SaleRow) => {
    const lb = calcLoyaltyBonus(s.loyalty_start_date!);
    return sum + lb.earnedSoFar;
  }, 0);

  const netCommission = linesCommission + deviceCalc.total + loyaltyBonus - sanctionsTotal;
  const targetTotal = target?.target_total || 0;
  const targetProgress = targetTotal > 0 ? Math.min(100, Math.round((netCommission / targetTotal) * 100)) : 0;

  // Daily breakdown: { "01": { lines: 3, devices: 5000 }, ... }
  const salesByDay: Record<string, { lines: number; devices: number }> = {};
  for (const s of sales) {
    const day = s.sale_date.slice(8, 10); // "01", "02", etc.
    if (!salesByDay[day]) salesByDay[day] = { lines: 0, devices: 0 };
    if (s.sale_type === "line") salesByDay[day].lines++;
    else salesByDay[day].devices += s.device_sale_amount || 0;
  }

  const body = {
    month,
    lines_count: linesCount,
    lines_commission: linesCommission,
    device_sales: totalDeviceSalesAmount,
    devices_commission: deviceCalc.total,
    devices_milestones: deviceCalc.milestoneCount,
    devices_milestone_bonus: deviceCalc.milestoneBonus,
    sanctions_total: sanctionsTotal,
    loyalty_bonus: loyaltyBonus,
    net_commission: netCommission,
    target_lines: target?.target_lines_amount || 0,
    target_devices: target?.target_devices_amount || 0,
    target_total: targetTotal,
    target_progress: targetProgress,
    is_locked: target?.is_locked || false,
    sales_by_day: salesByDay,
    last_updated: new Date().toISOString(),
  };

  return NextResponse.json(body, { status: 200, headers: corsHeaders() });
}
