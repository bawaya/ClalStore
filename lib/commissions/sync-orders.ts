// =====================================================
// ClalMobile — Canonical order → commission sync
// =====================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminSupabase } from "@/lib/supabase";
import {
  COMMISSIONABLE_STATUSES,
  isCommissionableOrderStatus,
  recalculateDeviceCommissionsForMonths,
  resolveCommissionSaleDate,
  summarizeOrderDevices,
  type OrderCommissionItem,
  type OrderStatusHistoryRow,
} from "@/lib/commissions/ledger";

type OrderSyncRow = {
  id: string;
  status: string;
  created_at: string;
  assigned_to: string | null;
  customer_id: string | null;
};

type ExistingCommissionRow = {
  id: number;
  order_id: string | null;
  sale_date: string;
  deleted_at: string | null;
};

type PrimaryHotAccountSnapshot = {
  id: string;
  hot_mobile_id: string | null;
};

type OrderIdentitySnapshot = {
  customerCodeMap: Map<string, string | null>;
  primaryHotMap: Map<string, PrimaryHotAccountSnapshot>;
};

type SyncResult = {
  synced: number;
  skipped: number;
  totalAmount: number;
  errors: string[];
  deactivated?: number;
};

export function buildAutoSyncCommissionIdentity(
  customerId: string | null,
  snapshot: OrderIdentitySnapshot,
) {
  const primaryHot = customerId ? snapshot.primaryHotMap.get(customerId) : undefined;
  const customerCode = customerId ? snapshot.customerCodeMap.get(customerId) ?? null : null;

  return {
    customer_id: customerId || null,
    customer_hot_account_id: primaryHot?.id || null,
    hot_mobile_id_snapshot: primaryHot?.hot_mobile_id || null,
    store_customer_code_snapshot: customerCode,
    match_status: customerId ? ("matched" as const) : ("unmatched" as const),
    match_method: customerId ? "order_sync" : null,
    match_confidence: customerId ? 1.0 : null,
  };
}

async function getCandidateOrderIdsForRange(
  db: SupabaseClient,
  startDate: string,
  endDate: string,
) {
  const rangeEnd = `${endDate}T23:59:59.999Z`;
  const [historyRes, ordersRes, existingRes] = await Promise.all([
    db
      .from("order_status_history")
      .select("order_id, new_status, created_at")
      .in("new_status", [...COMMISSIONABLE_STATUSES])
      .gte("created_at", startDate)
      .lte("created_at", rangeEnd),
    db
      .from("orders")
      .select("id, status, created_at")
      .gte("created_at", startDate)
      .lte("created_at", rangeEnd),
    db
      .from("commission_sales")
      .select("order_id")
      .eq("sale_type", "device")
      .gte("sale_date", startDate)
      .lte("sale_date", endDate),
  ]);

  const ids = new Set<string>();

  for (const row of historyRes.data || []) {
    if (row.order_id) ids.add(row.order_id);
  }

  for (const row of ordersRes.data || []) {
    if (row.id && isCommissionableOrderStatus(row.status)) ids.add(row.id);
  }

  for (const row of existingRes.data || []) {
    if (row.order_id) ids.add(row.order_id);
  }

  return [...ids];
}

async function loadOrderSyncSnapshot(
  db: SupabaseClient,
  orderIds: string[],
) {
  if (orderIds.length === 0) {
    return {
      orders: [] as OrderSyncRow[],
      itemMap: new Map<string, OrderCommissionItem[]>(),
      historyMap: new Map<string, OrderStatusHistoryRow[]>(),
      employeeNameMap: new Map<string, string>(),
      customerCodeMap: new Map<string, string | null>(),
      primaryHotMap: new Map<string, PrimaryHotAccountSnapshot>(),
      existingMap: new Map<string, ExistingCommissionRow>(),
    };
  }

  const [ordersRes, itemsRes, historyRes, existingRes] = await Promise.all([
    db
      .from("orders")
      .select("id, status, created_at, assigned_to, customer_id")
      .in("id", orderIds),
    db
      .from("order_items")
      .select("order_id, product_name, product_type, price, quantity")
      .in("order_id", orderIds),
    db
      .from("order_status_history")
      .select("order_id, new_status, created_at")
      .in("order_id", orderIds)
      .in("new_status", [...COMMISSIONABLE_STATUSES]),
    db
      .from("commission_sales")
      .select("id, order_id, sale_date, deleted_at")
      .in("order_id", orderIds),
  ]);

  const assignedIds = [...new Set((ordersRes.data || []).map((row) => row.assigned_to).filter(Boolean))];
  const employeeNameMap = new Map<string, string>();

  if (assignedIds.length > 0) {
    const { data: usersRes } = await db
      .from("users")
      .select("id, name")
      .in("id", assignedIds);

    for (const user of usersRes || []) {
      employeeNameMap.set(user.id, user.name);
    }
  }

  const customerIds = [...new Set((ordersRes.data || []).map((row) => row.customer_id).filter(Boolean))];
  const customerCodeMap = new Map<string, string | null>();
  const primaryHotMap = new Map<string, PrimaryHotAccountSnapshot>();

  if (customerIds.length > 0) {
    const [{ data: customersRes }, { data: hotAccountsRes }] = await Promise.all([
      db
        .from("customers")
        .select("id, customer_code")
        .in("id", customerIds),
      db
        .from("customer_hot_accounts")
        .select("id, customer_id, hot_mobile_id")
        .in("customer_id", customerIds)
        .eq("is_primary", true)
        .is("ended_at", null),
    ]);

    for (const customer of customersRes || []) {
      customerCodeMap.set(customer.id, customer.customer_code || null);
    }

    for (const account of hotAccountsRes || []) {
      primaryHotMap.set(account.customer_id, {
        id: account.id,
        hot_mobile_id: account.hot_mobile_id || null,
      });
    }
  }

  const itemMap = new Map<string, OrderCommissionItem[]>();
  for (const row of itemsRes.data || []) {
    const bucket = itemMap.get(row.order_id) || [];
    bucket.push(row as OrderCommissionItem);
    itemMap.set(row.order_id, bucket);
  }

  const historyMap = new Map<string, OrderStatusHistoryRow[]>();
  for (const row of historyRes.data || []) {
    const bucket = historyMap.get(row.order_id) || [];
    bucket.push(row as OrderStatusHistoryRow);
    historyMap.set(row.order_id, bucket);
  }

  const existingMap = new Map<string, ExistingCommissionRow>();
  for (const row of existingRes.data || []) {
    if (row.order_id) existingMap.set(row.order_id, row as ExistingCommissionRow);
  }

  return {
    orders: (ordersRes.data || []) as OrderSyncRow[],
    itemMap,
    historyMap,
    employeeNameMap,
    customerCodeMap,
    primaryHotMap,
    existingMap,
  };
}

async function syncOrdersByIds(
  db: SupabaseClient,
  orderIds: string[],
): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, skipped: 0, totalAmount: 0, errors: [], deactivated: 0 };
  if (orderIds.length === 0) return result;

  const snapshot = await loadOrderSyncSnapshot(db, orderIds);
  const monthsToRecalculate = new Set<string>();
  const activateIds: string[] = [];
  const deactivateIds: string[] = [];

  for (const order of snapshot.orders) {
    const items = snapshot.itemMap.get(order.id) || [];
    const history = snapshot.historyMap.get(order.id) || [];
    const existing = snapshot.existingMap.get(order.id);
    const deviceSummary = summarizeOrderDevices(items);

    const shouldHaveCommission =
      isCommissionableOrderStatus(order.status) && deviceSummary.hasDevice;

    if (!shouldHaveCommission) {
      if (existing && !existing.deleted_at) {
        const { error } = await db
          .from("commission_sales")
          .update({
            deleted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (error) {
          result.errors.push(`Order ${order.id}: ${error.message}`);
        } else {
          result.deactivated = (result.deactivated || 0) + 1;
          monthsToRecalculate.add(existing.sale_date.slice(0, 7));
        }
      } else {
        result.skipped++;
      }

      deactivateIds.push(order.id);
      continue;
    }

    const saleDate = resolveCommissionSaleDate(order.created_at, history);
    const month = saleDate.slice(0, 7);
    const identityFields = buildAutoSyncCommissionIdentity(order.customer_id, {
      customerCodeMap: snapshot.customerCodeMap,
      primaryHotMap: snapshot.primaryHotMap,
    });

    const { error } = await db
      .from("commission_sales")
      .upsert(
        {
          sale_date: saleDate,
          sale_type: "device",
          source: "auto_sync",
          order_id: order.id,
          ...identityFields,
          employee_id: order.assigned_to || null,
          employee_name: order.assigned_to
            ? snapshot.employeeNameMap.get(order.assigned_to) || null
            : null,
          device_name: deviceSummary.deviceName || `Order ${order.id}`,
          device_sale_amount: deviceSummary.deviceSaleAmount,
          commission_amount: 0,
          contract_commission: 0,
          deleted_at: null,
          notes: `Order-synced commission (${order.status})`,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "order_id,sale_type" },
      );

    if (error) {
      result.errors.push(`Order ${order.id}: ${error.message}`);
      continue;
    }

    result.synced++;
    result.totalAmount += deviceSummary.deviceSaleAmount;
    monthsToRecalculate.add(month);
    if (existing?.sale_date && existing.sale_date.slice(0, 7) !== month) {
      monthsToRecalculate.add(existing.sale_date.slice(0, 7));
    }
    activateIds.push(order.id);
  }

  if (monthsToRecalculate.size > 0) {
    await recalculateDeviceCommissionsForMonths(db, [...monthsToRecalculate]);
  }

  if (activateIds.length > 0) {
    await db.from("orders").update({ commission_synced: true }).in("id", activateIds);
  }

  if (deactivateIds.length > 0) {
    await db.from("orders").update({ commission_synced: false }).in("id", deactivateIds);
  }

  return result;
}

export async function syncOrdersToCommissions(
  startDate: string,
  endDate: string,
): Promise<SyncResult> {
  const db = createAdminSupabase();
  if (!db) {
    return { synced: 0, skipped: 0, totalAmount: 0, errors: ["DB unavailable"], deactivated: 0 };
  }

  const candidateOrderIds = await getCandidateOrderIdsForRange(db, startDate, endDate);
  const result = await syncOrdersByIds(db, candidateOrderIds);

  await db.from("commission_sync_log").insert({
    orders_synced: result.synced,
    orders_skipped: result.skipped,
    total_amount: result.totalAmount,
    status: result.errors.length > 0 ? "partial" : "success",
    error_message: result.errors.length > 0 ? result.errors.join("; ") : null,
  });

  return result;
}

export async function syncCommissionForOrder(
  orderId: string,
  db?: SupabaseClient,
) {
  const resolvedDb = db || createAdminSupabase();
  if (!resolvedDb) {
    return { synced: 0, skipped: 0, totalAmount: 0, errors: ["DB unavailable"], deactivated: 0 };
  }

  return syncOrdersByIds(resolvedDb, [orderId]);
}

export async function getLastSyncInfo(): Promise<{
  lastSync: string | null;
  ordersSynced: number;
  status: string;
} | null> {
  const db = createAdminSupabase();
  if (!db) return null;

  const { data } = await db
    .from("commission_sync_log")
    .select("sync_date, orders_synced, status")
    .order("sync_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return {
    lastSync: data.sync_date,
    ordersSynced: data.orders_synced,
    status: data.status,
  };
}
