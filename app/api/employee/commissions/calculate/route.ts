/**
 * POST /api/employee/commissions/calculate
 *
 * Pure calculator — does NOT insert anything. Returns the commission
 * breakdown for a hypothetical sale so the employee can preview.
 * Uses the authed employee's current active profile.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireEmployee } from "@/lib/pwa/auth";
import { createAdminSupabase } from "@/lib/supabase";
import { apiError, apiSuccess, safeError } from "@/lib/api-response";
import {
  DEFAULT_EMPLOYEE_PROFILE,
  calcDualCommission,
  COMMISSION,
  type EmployeeProfile,
} from "@/lib/commissions/calculator";
import { z } from "zod";

const schema = z.object({
  saleType: z.enum(["line", "device", "appliance"]),
  amount: z.number().positive().max(100000),
  hasValidHK: z.boolean().optional().default(true),
});

export async function POST(req: NextRequest) {
  try {
    const authed = await requireEmployee(req);
    if (authed instanceof NextResponse) return authed;

    const db = createAdminSupabase();
    if (!db) return apiError("DB unavailable", 500);

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues.map((i) => i.message).join("; "), 400);
    }

    const { saleType, amount, hasValidHK } = parsed.data;

    const { data: profileRow } = await db
      .from("employee_commission_profiles")
      .select("line_multiplier, device_rate, device_milestone_bonus, appliance_rate, appliance_milestone_bonus, min_package_price, loyalty_bonuses")
      .eq("user_id", authed.appUserId)
      .eq("active", true)
      .maybeSingle();

    const profile: EmployeeProfile = (profileRow as EmployeeProfile) || DEFAULT_EMPLOYEE_PROFILE;

    const { contractCommission, employeeCommission } = calcDualCommission(
      saleType,
      amount,
      hasValidHK,
      profile,
    );

    const ownerProfit = contractCommission - employeeCommission;

    let calculationText: string;
    if (saleType === "line") {
      calculationText = `${amount} × ${COMMISSION.LINE_MULTIPLIER} = ${contractCommission.toFixed(2)} (contract) | ${amount} × ${profile.line_multiplier} = ${employeeCommission.toFixed(2)} (employee)`;
    } else if (saleType === "appliance") {
      const contractPct = (COMMISSION.APPLIANCE_RATE * 100).toFixed(1);
      const employeePct = (profile.appliance_rate * 100).toFixed(1);
      calculationText = `${amount} × ${contractPct}% = ${contractCommission.toFixed(2)} (contract) | ${amount} × ${employeePct}% = ${employeeCommission.toFixed(2)} (employee)`;
    } else {
      const contractPct = (COMMISSION.DEVICE_RATE * 100).toFixed(1);
      const employeePct = (profile.device_rate * 100).toFixed(1);
      calculationText = `${amount} × ${contractPct}% = ${contractCommission.toFixed(2)} (contract) | ${amount} × ${employeePct}% = ${employeeCommission.toFixed(2)} (employee)`;
    }

    return apiSuccess({
      saleType,
      amount,
      contractCommission,
      employeeCommission,
      ownerProfit,
      calculation: calculationText,
      rateSnapshot: profile,
    });
  } catch (err) {
    return safeError(err, "EmployeeCalculate", "خطأ في السيرفر", 500);
  }
}
