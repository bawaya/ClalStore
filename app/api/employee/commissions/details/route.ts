/**
 * GET /api/employee/commissions/details?month=YYYY-MM
 *
 * Per-sale breakdown for the authed employee — used by the detailed
 * commissions page (/sales-pwa/commissions) to show the full calculation
 * for each row.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireEmployee } from "@/lib/pwa/auth";
import { createAdminSupabase } from "@/lib/supabase";
import { apiError, apiSuccess, safeError } from "@/lib/api-response";
import { lastDayOfMonth } from "@/lib/commissions/ledger";
import { COMMISSION } from "@/lib/commissions/calculator";

type RateSnapshot = {
  line_multiplier?: number;
  device_rate?: number;
  device_milestone_bonus?: number;
  min_package_price?: number;
};

function explainLine(amount: number, snap: RateSnapshot | null): string {
  const empMult = snap?.line_multiplier ?? COMMISSION.LINE_MULTIPLIER;
  const contractTotal = (amount * COMMISSION.LINE_MULTIPLIER).toFixed(2);
  const empTotal = (amount * empMult).toFixed(2);
  return `${amount} × ${COMMISSION.LINE_MULTIPLIER} = ${contractTotal} (contract) | ${amount} × ${empMult} = ${empTotal} (employee)`;
}

function explainDevice(amount: number, snap: RateSnapshot | null): string {
  const empRate = snap?.device_rate ?? COMMISSION.DEVICE_RATE;
  const contractTotal = (amount * COMMISSION.DEVICE_RATE).toFixed(2);
  const empTotal = (amount * empRate).toFixed(2);
  const contractPct = (COMMISSION.DEVICE_RATE * 100).toFixed(1);
  const empPct = (empRate * 100).toFixed(1);
  return `${amount} × ${contractPct}% = ${contractTotal} (contract) | ${amount} × ${empPct}% = ${empTotal} (employee)`;
}

export async function GET(req: NextRequest) {
  try {
    const authed = await requireEmployee(req);
    if (authed instanceof NextResponse) return authed;

    const db = createAdminSupabase();
    if (!db) return apiError("DB unavailable", 500);

    const { searchParams } = new URL(req.url);
    const requested = searchParams.get("month")?.trim();
    const nowIL = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
    const defaultMonth = `${nowIL.getFullYear()}-${String(nowIL.getMonth() + 1).padStart(2, "0")}`;
    const month = requested && /^\d{4}-\d{2}$/.test(requested) ? requested : defaultMonth;
    const monthStart = `${month}-01`;
    const monthEnd = lastDayOfMonth(month);

    const [salesRes, sanctionsRes] = await Promise.all([
      db
        .from("commission_sales")
        .select(
          "id, sale_date, sale_type, customer_name, customer_phone, device_name, package_price, device_sale_amount, commission_amount, contract_commission, source, source_sales_doc_id, source_pipeline_deal_id, rate_snapshot",
        )
        .eq("employee_id", authed.appUserId)
        .is("deleted_at", null)
        .gte("sale_date", monthStart)
        .lte("sale_date", monthEnd)
        .order("sale_date", { ascending: false })
        .limit(2000),
      db
        .from("commission_sanctions")
        .select("id, sanction_date, sanction_type, amount, description, has_sale_offset")
        .eq("user_id", authed.appUserId)
        .is("deleted_at", null)
        .gte("sanction_date", monthStart)
        .lte("sanction_date", monthEnd)
        .order("sanction_date", { ascending: false }),
    ]);

    if (salesRes.error) return safeError(salesRes.error, "details/sales");
    if (sanctionsRes.error) return safeError(sanctionsRes.error, "details/sanctions");

    type SaleDetailsRow = {
      id: number;
      sale_type: string;
      sale_date: string;
      package_price: number | null;
      device_sale_amount: number | null;
      contract_commission: number | null;
      commission_amount: number | null;
      rate_snapshot: unknown;
      source: string | null;
      customer_name: string | null;
      customer_phone: string | null;
      device_name: string | null;
      source_sales_doc_id: number | null;
      source_pipeline_deal_id: number | null;
    };
    const sales = ((salesRes.data || []) as SaleDetailsRow[]).map((s: SaleDetailsRow) => {
      const amount =
        s.sale_type === "line" ? Number(s.package_price || 0) : Number(s.device_sale_amount || 0);
      const contractAmount = Number(s.contract_commission || 0);
      const employeeAmount = Number(s.commission_amount || 0);
      const snap = s.rate_snapshot as RateSnapshot | null;
      return {
        id: s.id,
        date: s.sale_date,
        type: s.sale_type,
        amount,
        source: s.source,
        commission: {
          contractAmount,
          employeeAmount,
          ownerProfit: contractAmount - employeeAmount,
          calculation:
            s.sale_type === "line" ? explainLine(amount, snap) : explainDevice(amount, snap),
        },
        customer: s.customer_name,
        phone: s.customer_phone,
        deviceName: s.device_name,
        status: "active",
        rateSnapshot: snap,
        sourceSalesDocId: s.source_sales_doc_id,
        sourcePipelineDealId: s.source_pipeline_deal_id,
      };
    });

    // Milestones touched this month
    let running = 0;
    const milestones: Array<{ threshold: number; hit_on: string; bonus: number }> = [];
    for (const s of [...sales].reverse()) {
      const before = Math.floor(running / COMMISSION.DEVICE_MILESTONE);
      running += s.amount;
      const after = Math.floor(running / COMMISSION.DEVICE_MILESTONE);
      if (after > before) {
        for (let m = before + 1; m <= after; m++) {
          milestones.push({
            threshold: m * COMMISSION.DEVICE_MILESTONE,
            hit_on: s.date as string,
            bonus: COMMISSION.DEVICE_MILESTONE_BONUS,
          });
        }
      }
    }

    return apiSuccess({
      month,
      sales,
      sanctions: sanctionsRes.data || [],
      milestones,
    });
  } catch (err) {
    return safeError(err, "EmployeeDetails", "خطأ في السيرفر", 500);
  }
}
