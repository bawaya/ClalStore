// =====================================================================
// Sales-request service — shared business logic between employee + admin
// routes. Owns the approve / reject / info-request state transitions and
// the approval-time fan-out into commission_sales.
//
// Consumers:
//   app/api/admin/sales-requests/**      (approve, request_info, reject)
//   app/api/employee/sales-requests/**   (create, submit, reply)
// =====================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { registerSaleCommission } from "@/lib/commissions/register";

export type SalesRequestStatus =
  | "draft"
  | "pending"
  | "needs_info"
  | "approved"
  | "rejected";

export type SalesRequestEventType =
  | "created"
  | "submitted"
  | "info_requested"
  | "info_provided"
  | "approved"
  | "rejected"
  | "edited"
  | "deleted";

export interface SalesRequestDeviceInput {
  device_name: string;
  total_price: number;
  installments_count: number;
  position?: number;
}

export interface SalesRequestPackageInput {
  package_name: string;
  monthly_price: number;
  lines_count: number;
  position?: number;
}

export interface SalesRequestRow {
  id: number;
  employee_id: string;
  status: SalesRequestStatus;
  customer_name: string;
  customer_id_number: string;
  contact_number: string;
  delivery_address: string;
  locality_name: string | null;
  bank_name: string;
  bank_code: string | null;
  bank_branch: string;
  bank_account: string;
  total_devices_amount: number;
  total_packages_monthly: number;
  total_devices_count: number;
  total_lines_count: number;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalesRequestDeviceRow extends SalesRequestDeviceInput {
  id: number;
  request_id: number;
  monthly_installment: number;
}

export interface SalesRequestPackageRow extends SalesRequestPackageInput {
  id: number;
  request_id: number;
}

export interface SalesRequestEventRow {
  id: number;
  request_id: number;
  event_type: SalesRequestEventType;
  actor_id: string | null;
  actor_role: string | null;
  message: string | null;
  metadata: unknown;
  created_at: string;
}

/** Recompute denormalised totals from children. */
export function computeTotals(
  devices: SalesRequestDeviceInput[],
  packages: SalesRequestPackageInput[],
): {
  total_devices_amount: number;
  total_devices_count: number;
  total_packages_monthly: number;
  total_lines_count: number;
} {
  const total_devices_amount = devices.reduce(
    (sum, d) => sum + Number(d.total_price || 0),
    0,
  );
  const total_packages_monthly = packages.reduce(
    (sum, p) => sum + Number(p.monthly_price || 0) * Number(p.lines_count || 1),
    0,
  );
  return {
    total_devices_amount: Math.round(total_devices_amount * 100) / 100,
    total_devices_count: devices.length,
    total_packages_monthly: Math.round(total_packages_monthly * 100) / 100,
    total_lines_count: packages.reduce((sum, p) => sum + Number(p.lines_count || 1), 0),
  };
}

/** Append an audit event. Swallows errors — audit log is best-effort. */
export async function logEvent(
  db: SupabaseClient,
  input: {
    request_id: number;
    event_type: SalesRequestEventType;
    actor_id?: string | null;
    actor_role?: string | null;
    message?: string | null;
    metadata?: Record<string, unknown> | null;
  },
): Promise<void> {
  try {
    await db.from("sales_request_events").insert({
      request_id: input.request_id,
      event_type: input.event_type,
      actor_id: input.actor_id ?? null,
      actor_role: input.actor_role ?? null,
      message: input.message ?? null,
      metadata: input.metadata ?? null,
    });
  } catch {
    // Intentionally ignored — don't let audit log failures block the
    // primary workflow.
  }
}

export interface ApprovalResult {
  createdSaleIds: number[];
  totalEmployeeCommission: number;
  totalContractCommission: number;
}

/**
 * Approve a request: for each device, insert a commission_sales row
 * (sale_type=device) crediting the employee. For each package, insert
 * `lines_count` rows (sale_type=line) using the package's monthly_price
 * as the package_price.
 *
 * All writes go through registerSaleCommission so rate_snapshot and
 * milestone-recalc are handled consistently with every other commission
 * path (pipeline, sales_doc, auto_sync).
 */
export async function approveSalesRequest(
  db: SupabaseClient,
  opts: {
    request: SalesRequestRow;
    devices: SalesRequestDeviceRow[];
    packages: SalesRequestPackageRow[];
    reviewerId: string;
    reviewerRole: string;
    note?: string | null;
    saleDate?: string; // defaults to today IL
  },
): Promise<ApprovalResult> {
  const { request, devices, packages, reviewerId, reviewerRole, note } = opts;

  if (request.status !== "pending" && request.status !== "needs_info") {
    throw new Error(`approveSalesRequest: request ${request.id} is not in an approvable state (${request.status})`);
  }
  if (devices.length === 0) {
    throw new Error("approveSalesRequest: at least one device is required");
  }

  const saleDate = opts.saleDate || (() => {
    const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  const createdSaleIds: number[] = [];
  let totalEmployeeCommission = 0;
  let totalContractCommission = 0;

  // Devices — one row per device entry
  for (const device of devices) {
    const result = await registerSaleCommission(db, {
      saleType: "device",
      amount: Number(device.total_price),
      employeeId: request.employee_id,
      saleDate,
      source: "manual", // from approval flow — not tied to a sales_doc
      customerName: request.customer_name,
      customerPhone: request.contact_number,
      deviceName: device.device_name,
      notes: `sales_request#${request.id} approved by ${reviewerRole}:${reviewerId}${
        note ? ` — ${note}` : ""
      }`,
    });
    createdSaleIds.push(result.id);
    totalEmployeeCommission += result.employeeCommission;
    totalContractCommission += result.contractCommission;
  }

  // Packages — N rows per package (where N = lines_count)
  for (const pkg of packages) {
    for (let i = 0; i < pkg.lines_count; i++) {
      const result = await registerSaleCommission(db, {
        saleType: "line",
        amount: Number(pkg.monthly_price),
        packagePrice: Number(pkg.monthly_price),
        employeeId: request.employee_id,
        saleDate,
        source: "manual",
        customerName: request.customer_name,
        customerPhone: request.contact_number,
        hasValidHK: true,
        loyaltyStartDate: saleDate,
        notes: `sales_request#${request.id} package "${pkg.package_name}" (line ${i + 1}/${pkg.lines_count})`,
      });
      createdSaleIds.push(result.id);
      totalEmployeeCommission += result.employeeCommission;
      totalContractCommission += result.contractCommission;
    }
  }

  // Mark request approved
  const { error: updateError } = await db
    .from("sales_requests")
    .update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewerId,
      review_note: note ?? null,
    })
    .eq("id", request.id);
  if (updateError) {
    throw new Error(`approveSalesRequest: failed to update request status — ${updateError.message}`);
  }

  await logEvent(db, {
    request_id: request.id,
    event_type: "approved",
    actor_id: reviewerId,
    actor_role: reviewerRole,
    message: note ?? null,
    metadata: {
      sale_ids: createdSaleIds,
      total_employee_commission: totalEmployeeCommission,
      total_contract_commission: totalContractCommission,
      sale_date: saleDate,
    },
  });

  return {
    createdSaleIds,
    totalEmployeeCommission: Math.round(totalEmployeeCommission * 100) / 100,
    totalContractCommission: Math.round(totalContractCommission * 100) / 100,
  };
}
