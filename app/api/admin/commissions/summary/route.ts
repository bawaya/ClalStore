// =====================================================
// ClalMobile — Commission Summary API (Bearer Token Auth)
// For local HTML app sync — read-only, CORS-enabled
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { calcDeviceCommission, calcLoyaltyBonus, calcMonthlySummary } from "@/lib/commissions/calculator";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  getCommissionTarget,
  resolveCommissionEmployeeFilter,
} from "@/lib/commissions/ledger";
import { corsHeaders } from "@/lib/commissions/cors";
import { safeTokenEqual } from "@/lib/commissions/safe-compare";

const RATE_LIMIT = { maxRequests: 60, windowMs: 3600_000 }; // 60/hour

// CORS preflight
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export async function GET(req: NextRequest) {
  // Bearer token auth
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  const validToken = process.env.COMMISSION_API_TOKEN;

  if (!safeTokenEqual(token, validToken)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders() });
  }

  // Rate limit by token (safeTokenEqual narrows `token` to string via predicate).
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

  try {
  const month = req.nextUrl.searchParams.get("month") || new Date().toISOString().slice(0, 7);
  const scope = await resolveCommissionEmployeeFilter(db, {
    employeeToken: req.nextUrl.searchParams.get("employee_token"),
    employeeId: req.nextUrl.searchParams.get("employee_id"),
    employeeName: req.nextUrl.searchParams.get("employee_name"),
    employeeKey: req.nextUrl.searchParams.get("employee_key"),
    targetKey: req.nextUrl.searchParams.get("target_key"),
  });
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-31`;

  if (scope.notFound && req.nextUrl.searchParams.get("employee_token")) {
    return NextResponse.json({ error: "Invalid employee token" }, { status: 403, headers: corsHeaders() });
  }

  // Build queries with optional employee filter
  let salesQ = db.from("commission_sales").select("*").is("deleted_at", null).gte("sale_date", monthStart).lte("sale_date", monthEnd).limit(5000);
  let sanctionsQ = db.from("commission_sanctions").select("*").is("deleted_at", null).gte("sanction_date", monthStart).lte("sanction_date", monthEnd).limit(5000);

  if (scope.notFound) {
    salesQ = salesQ.eq("id", -1);
    sanctionsQ = sanctionsQ.eq("id", -1);
  } else if (scope.employeeId) {
    salesQ = salesQ.eq("employee_id", scope.employeeId);
    sanctionsQ = sanctionsQ.eq("employee_id", scope.employeeId);
  } else if (scope.employeeName) {
    salesQ = salesQ.eq("employee_name", scope.employeeName);
    sanctionsQ = sanctionsQ.eq("employee_name", scope.employeeName);
  }

  // Parallel queries
  const [salesRes, sanctionsRes, targetRes] = await Promise.all([
    salesQ,
    sanctionsQ,
    getCommissionTarget(db, month, scope.targetKeys),
  ]);

  interface SaleRow { sale_type: string; sale_date: string; commission_amount: number; device_sale_amount: number; loyalty_start_date: string | null; loyalty_status: string | null; source: string; }
  interface SanctionRow { amount: number; }
  interface TargetRow { target_total: number; target_lines_amount: number; target_devices_amount: number; is_locked: boolean; }

  const sales: SaleRow[] = salesRes.data || [];
  const sanctions: SanctionRow[] = sanctionsRes.data || [];
  const target = targetRes as TargetRow | null;

  // Aggregate
  const linesSales = sales.filter((s: SaleRow) => s.sale_type === "line");
  const devicesSales = sales.filter((s: SaleRow) => s.sale_type === "device");

  const linesCount = linesSales.length;

  const totalDeviceSalesAmount = devicesSales.reduce((sum: number, s: SaleRow) => sum + (s.device_sale_amount || 0), 0);
  const deviceCalc = calcDeviceCommission(totalDeviceSalesAmount);

  // Loyalty bonuses
  const activeLines = linesSales.filter((s: SaleRow) => s.loyalty_start_date && s.loyalty_status === "active");
  const loyaltyBonus = activeLines.reduce((sum: number, s: SaleRow) => {
    const lb = calcLoyaltyBonus(s.loyalty_start_date!);
    return sum + lb.earnedSoFar;
  }, 0);

  // Delegate to authoritative helper (audit issue 4.29 — was duplicated here).
  const summary = calcMonthlySummary(
    sales,
    sanctions,
    loyaltyBonus,
    target ? { target_total: target.target_total || 0 } : null,
  );
  const {
    linesCommission,
    devicesCommission,
    totalSanctions: sanctionsTotal,
    netCommission,
    targetProgress,
  } = summary;
  const targetTotal = target?.target_total || 0;

  // Daily breakdown: { "01": { lines: 3, devices: 5000 }, ... }
  const salesByDay: Record<string, { lines: number; devices: number }> = {};
  for (const s of sales) {
    const day = s.sale_date.slice(8, 10); // "01", "02", etc.
    if (!salesByDay[day]) salesByDay[day] = { lines: 0, devices: 0 };
    if (s.sale_type === "line") salesByDay[day].lines++;
    else salesByDay[day].devices += s.device_sale_amount || 0;
  }

  // Employee breakdown (only in aggregate / admin view)
  let employee_breakdown: { name: string; lines: number; devices: number; commission: number; pct: number }[] | undefined;
  if (!scope.employeeId && !scope.employeeName) {
    const byEmp: Record<string, { lines: number; devices: number; commission: number }> = {};
    for (const s of sales) {
      const name = (s as any).employee_name || "ללא שיוך";
      if (!byEmp[name]) byEmp[name] = { lines: 0, devices: 0, commission: 0 };
      if (s.sale_type === "line") byEmp[name].lines++;
      else byEmp[name].devices++;
      byEmp[name].commission += s.commission_amount || 0;
    }
    const total = Object.values(byEmp).reduce((s, e) => s + e.commission, 0) || 1;
    employee_breakdown = Object.entries(byEmp)
      .map(([name, d]) => ({ name, ...d, pct: Math.round((d.commission / total) * 100) }))
      .sort((a, b) => b.commission - a.commission);
  }

  const body = {
    month,
    employee_id: scope.employeeId,
    employee_name: scope.employeeName,
    lines_count: linesCount,
    lines_commission: linesCommission,
    device_sales: totalDeviceSalesAmount,
    devices_commission: devicesCommission,
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
    employee_breakdown,
    last_updated: new Date().toISOString(),
  };

  return NextResponse.json(body, { status: 200, headers: corsHeaders() });
  } catch (err) {
    console.error("[CommissionSummary]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: corsHeaders() });
  }
}
