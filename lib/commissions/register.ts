/**
 * Unified commission registration — the one and only path into
 * commission_sales for new sales.
 *
 * Used by:
 *   - Pipeline (deal moved to won stage)      → source='pipeline'
 *   - PWA (agent submits sales_doc)           → source='sales_doc'
 *   - sync-orders (hourly/manual order sync)  → source='auto_sync'
 *   - POST /admin/commissions/sales (manual)  → source='manual'
 *
 * Guarantees:
 *   - Every row has rate_snapshot (decision 7) — historical accuracy stays
 *     frozen even if profile changes later.
 *   - Device rows trigger a month-wide milestone recalculation so the
 *     contract-wide milestone bonus (decision 4) is always up to date.
 *   - Partial unique indexes in the DB prevent double-registration from
 *     the same source.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_EMPLOYEE_PROFILE,
  type EmployeeProfile,
  calcDualCommission,
  COMMISSION,
} from "./calculator";
import { recalculateDeviceCommissionsForMonths } from "./ledger";

export type CommissionSource =
  | "sales_doc"
  | "pipeline"
  | "order"
  | "manual"
  | "auto_sync"
  | "csv_import";

export interface RegisterSaleInput {
  saleType: "line" | "device";
  /**
   * For lines: the monthly package price (e.g. 39.90).
   * For devices: the total device sale amount.
   */
  amount: number;
  employeeId: string;
  saleDate: string; // YYYY-MM-DD
  source: CommissionSource;

  /** Provenance — at most ONE of these should be set for a given row. */
  sourceSalesDocId?: number | null;
  sourcePipelineDealId?: string | null;
  orderId?: string | null;

  customerId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;

  /** Line-only fields */
  packagePrice?: number | null;
  hasValidHK?: boolean;
  loyaltyStartDate?: string | null;

  /** Device-only fields */
  deviceName?: string | null;

  notes?: string | null;

  /** If set, this profile is used instead of fetching from DB (tests). */
  rateSnapshot?: EmployeeProfile;
}

export interface CommissionResult {
  id: number;
  contractCommission: number;
  employeeCommission: number;
  rateSnapshot: EmployeeProfile;
}

const MAX_SALE_AMOUNT = 100000; // sanity cap

function validateInput(input: RegisterSaleInput) {
  if (!input.employeeId) {
    throw new Error("registerSaleCommission: employeeId is required");
  }
  if (!input.saleDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.saleDate)) {
    throw new Error("registerSaleCommission: saleDate must be YYYY-MM-DD");
  }
  if (!(input.amount > 0)) {
    throw new Error("registerSaleCommission: amount must be positive");
  }
  if (input.amount > MAX_SALE_AMOUNT) {
    throw new Error(`registerSaleCommission: amount exceeds ${MAX_SALE_AMOUNT}`);
  }
  if (input.saleType !== "line" && input.saleType !== "device") {
    throw new Error("registerSaleCommission: saleType must be line or device");
  }
}

async function fetchCurrentProfile(
  db: SupabaseClient,
  employeeId: string,
): Promise<EmployeeProfile> {
  const { data } = await db
    .from("employee_commission_profiles")
    .select(
      "line_multiplier, device_rate, device_milestone_bonus, min_package_price, loyalty_bonuses",
    )
    .eq("user_id", employeeId)
    .eq("active", true)
    .maybeSingle();
  return (data as EmployeeProfile) || DEFAULT_EMPLOYEE_PROFILE;
}

export async function registerSaleCommission(
  db: SupabaseClient,
  input: RegisterSaleInput,
): Promise<CommissionResult> {
  validateInput(input);

  // 1. Pin the profile at sale time (rate_snapshot / decision 7)
  const profile = input.rateSnapshot ?? (await fetchCurrentProfile(db, input.employeeId));

  // 2. Compute base commission (milestone for devices is added during recalc)
  const { contractCommission, employeeCommission } = calcDualCommission(
    input.saleType,
    input.amount,
    input.hasValidHK ?? true,
    profile,
  );

  // 3. Build row — existing commission_sales uses TEXT employee_id and user_id
  //    columns historically. We prefer employee_id going forward.
  const row: Record<string, unknown> = {
    employee_id: input.employeeId,
    sale_type: input.saleType,
    source: input.source,
    sale_date: input.saleDate,
    customer_id: input.customerId ?? null,
    customer_name: input.customerName ?? null,
    customer_phone: input.customerPhone ?? null,
    order_id: input.orderId ?? null,
    source_sales_doc_id: input.sourceSalesDocId ?? null,
    source_pipeline_deal_id: input.sourcePipelineDealId ?? null,
    rate_snapshot: profile,
    commission_amount: employeeCommission,
    contract_commission: contractCommission,
    notes: input.notes ?? null,
  };

  if (input.saleType === "line") {
    row.package_price = input.packagePrice ?? input.amount;
    row.multiplier = profile.line_multiplier;
    row.has_valid_hk = input.hasValidHK ?? true;
    row.loyalty_start_date = input.loyaltyStartDate ?? null;
    row.loyalty_status = "pending";
    row.device_sale_amount = 0;
  } else {
    row.device_name = input.deviceName ?? null;
    row.device_sale_amount = input.amount;
    row.package_price = 0;
    row.has_valid_hk = true;
  }

  // 4. Insert. Unique indexes (see migration 20260418000003) reject duplicates
  //    from the same source — those surface as a FK/unique violation.
  const { data, error } = await db
    .from("commission_sales")
    .insert(row)
    .select("id")
    .single();

  if (error) {
    throw new Error(`registerSaleCommission failed: ${error.message}`);
  }

  // 5. For devices, recompute the whole month so the contract-wide milestone
  //    is applied correctly after this new sale.
  if (input.saleType === "device") {
    const month = input.saleDate.slice(0, 7);
    await recalculateDeviceCommissionsForMonths(db, [month]);

    // Re-read the row to get the possibly-updated commission_amount
    const { data: updated } = await db
      .from("commission_sales")
      .select("commission_amount, contract_commission")
      .eq("id", data.id)
      .single();
    return {
      id: data.id as number,
      contractCommission: Number(
        updated?.contract_commission ?? contractCommission,
      ),
      employeeCommission: Number(
        updated?.commission_amount ?? employeeCommission,
      ),
      rateSnapshot: profile,
    };
  }

  return {
    id: data.id as number,
    contractCommission,
    employeeCommission,
    rateSnapshot: profile,
  };
}

/** Cancel flow — soft-delete commission rows for a given source, then
 * recompute the affected months so milestones stay consistent.
 */
async function cancelCommissionsByFilter(
  db: SupabaseClient,
  filter: { source_sales_doc_id?: number; source_pipeline_deal_id?: string },
): Promise<{ cancelledIds: number[]; affectedMonths: string[] }> {
  let query = db
    .from("commission_sales")
    .select("id, sale_date, sale_type")
    .is("deleted_at", null);

  if (filter.source_sales_doc_id !== undefined) {
    query = query.eq("source_sales_doc_id", filter.source_sales_doc_id);
  }
  if (filter.source_pipeline_deal_id !== undefined) {
    query = query.eq("source_pipeline_deal_id", filter.source_pipeline_deal_id);
  }

  const { data: rows, error } = await query;
  if (error) throw new Error(`cancelCommissions lookup: ${error.message}`);
  if (!rows || rows.length === 0) {
    return { cancelledIds: [], affectedMonths: [] };
  }

  const cancelledIds = rows.map((r) => r.id as number);
  const affectedMonths = [
    ...new Set(
      rows
        .filter((r) => r.sale_type === "device")
        .map((r) => String(r.sale_date).slice(0, 7)),
    ),
  ];

  const { error: updateError } = await db
    .from("commission_sales")
    .update({ deleted_at: new Date().toISOString() })
    .in("id", cancelledIds);

  if (updateError) throw new Error(`cancelCommissions: ${updateError.message}`);

  if (affectedMonths.length > 0) {
    await recalculateDeviceCommissionsForMonths(db, affectedMonths);
  }

  return { cancelledIds, affectedMonths };
}

export function cancelCommissionsByDoc(db: SupabaseClient, docId: number) {
  return cancelCommissionsByFilter(db, { source_sales_doc_id: docId });
}

export function cancelCommissionsByDeal(db: SupabaseClient, dealId: string) {
  return cancelCommissionsByFilter(db, { source_pipeline_deal_id: dealId });
}

export { MAX_SALE_AMOUNT, COMMISSION };
