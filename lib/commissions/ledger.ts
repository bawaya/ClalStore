import type { SupabaseClient } from "@supabase/supabase-js";
import { COMMISSION, DEFAULT_EMPLOYEE_PROFILE, type EmployeeProfile } from "@/lib/commissions/calculator";

export const COMMISSIONABLE_STATUSES = ["approved", "shipped", "delivered"] as const;
export const COMMISSION_CONTRACT_TARGET_KEY = "__contract__";

type CommissionableStatus = (typeof COMMISSIONABLE_STATUSES)[number];

export type OrderCommissionItem = {
  order_id: string;
  product_name: string | null;
  product_type: string | null;
  price: number | string | null;
  quantity: number | string | null;
};

export type OrderStatusHistoryRow = {
  order_id: string;
  new_status: string;
  created_at: string;
};

export type DeviceCommissionAllocationRow = {
  id: number | string;
  sale_date: string;
  device_sale_amount: number;
  employee_id: string | null;
};

export function sortBySaleDateAndId<T extends { sale_date: string; id: number | string }>(rows: T[]) {
  return [...rows].sort((a, b) => {
    const byDate = a.sale_date.localeCompare(b.sale_date);
    if (byDate !== 0) return byDate;
    return String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
  });
}

export function summarizeOrderDevices(items: OrderCommissionItem[]) {
  const deviceItems = items.filter((item) => item.product_type === "device");
  const deviceSaleAmount = deviceItems.reduce((sum, item) => {
    const price = Number(item.price || 0);
    const quantity = Number(item.quantity || 0) || 0;
    return sum + price * quantity;
  }, 0);

  const names = deviceItems
    .map((item) => item.product_name?.trim())
    .filter((name): name is string => Boolean(name));

  let deviceName: string | null = null;
  if (names.length === 1) {
    deviceName = names[0];
  } else if (names.length > 1) {
    deviceName = `${names[0]} +${names.length - 1}`;
  }

  return {
    deviceItems,
    deviceSaleAmount,
    deviceName,
    hasDevice: deviceItems.length > 0 && deviceSaleAmount > 0,
  };
}

export function resolveCommissionSaleDate(
  orderCreatedAt: string,
  statusHistory: OrderStatusHistoryRow[],
): string {
  const firstCommissionable = [...statusHistory]
    .filter((row) => COMMISSIONABLE_STATUSES.includes(row.new_status as CommissionableStatus))
    .sort((a, b) => a.created_at.localeCompare(b.created_at))[0];

  return (firstCommissionable?.created_at || orderCreatedAt).slice(0, 10);
}

export function isCommissionableOrderStatus(status: string) {
  return COMMISSIONABLE_STATUSES.includes(status as CommissionableStatus);
}

export function getCommissionTargetKey(params?: {
  targetKey?: string | null;
  employeeId?: string | null;
  employeeKey?: string | null;
}) {
  if (params?.targetKey) return params.targetKey;
  if (params?.employeeKey) return params.employeeKey;
  if (params?.employeeId) return params.employeeId;
  return COMMISSION_CONTRACT_TARGET_KEY;
}

export function getCommissionTargetKeys(params?: {
  targetKey?: string | null;
  employeeId?: string | null;
  employeeKey?: string | null;
  employeeName?: string | null;
}) {
  const fallbackKey = getCommissionTargetKey({
    targetKey: params?.targetKey,
    employeeId: params?.employeeId,
    employeeKey: params?.employeeKey,
  });

  return [
    params?.targetKey || null,
    params?.employeeKey || null,
    params?.employeeId || null,
    params?.employeeName || null,
    fallbackKey,
  ].filter((value, index, arr): value is string => Boolean(value) && arr.indexOf(value) === index);
}

export type CommissionEmployeeFilter = {
  employeeId: string | null;
  employeeName: string | null;
  employeeKey: string | null;
  commissionEmployeeId: string | null;
  notFound: boolean;
  targetKeys: string[];
};

export async function resolveCommissionEmployeeFilter(
  db: SupabaseClient,
  params?: {
    employeeId?: string | null;
    employeeName?: string | null;
    employeeKey?: string | null;
    employeeToken?: string | null;
    targetKey?: string | null;
  },
): Promise<CommissionEmployeeFilter> {
  const rawEmployeeId = params?.employeeId?.trim() || null;
  const rawEmployeeName = params?.employeeName?.trim() || null;
  const rawEmployeeKey = params?.employeeKey?.trim() || null;
  const rawEmployeeToken = params?.employeeToken?.trim() || null;
  const rawTargetKey = params?.targetKey?.trim() || null;

  let employeeId = rawEmployeeId ? (await resolveLinkedAppUserId(db, rawEmployeeId)) || rawEmployeeId : null;
  let employeeName = rawEmployeeName;
  let employeeKey =
    rawEmployeeKey && rawEmployeeKey !== COMMISSION_CONTRACT_TARGET_KEY ? rawEmployeeKey : null;
  let commissionEmployeeId: string | null = null;
  let notFound = false;

  const needsRegistryLookup =
    Boolean(rawEmployeeToken) || Boolean(rawEmployeeKey && rawEmployeeKey.startsWith("emp:"));

  if (needsRegistryLookup) {
    let query = db
      .from("commission_employees")
      .select("id, name, user_id")
      .eq("active", true);

    if (rawEmployeeToken) {
      query = query.eq("token", rawEmployeeToken);
    } else if (rawEmployeeKey) {
      query = query.eq("id", rawEmployeeKey.replace(/^emp:/, ""));
    }

    const { data: registryEmployee } = await query.maybeSingle();

    if (!registryEmployee) {
      notFound = true;
    } else {
      commissionEmployeeId = String(registryEmployee.id);
      employeeName = registryEmployee.name || employeeName;

      const linkedAppUserId = await resolveLinkedAppUserId(db, registryEmployee.user_id);
      if (linkedAppUserId) {
        employeeId = linkedAppUserId;
        employeeKey = linkedAppUserId;
      } else {
        employeeId = null;
        employeeKey = `emp:${registryEmployee.id}`;
      }
    }
  } else if (rawEmployeeKey && rawEmployeeKey !== COMMISSION_CONTRACT_TARGET_KEY) {
    const linkedAppUserId = (await resolveLinkedAppUserId(db, rawEmployeeKey)) || rawEmployeeKey;
    employeeId = linkedAppUserId;
    employeeKey = linkedAppUserId;
  }

  return {
    employeeId,
    employeeName,
    employeeKey,
    commissionEmployeeId,
    notFound,
    targetKeys: [
      ...getCommissionTargetKeys({
        targetKey: rawTargetKey,
        employeeId,
        employeeKey,
        employeeName,
      }),
      commissionEmployeeId ? `emp:${commissionEmployeeId}` : null,
    ].filter((value, index, arr): value is string => Boolean(value) && arr.indexOf(value) === index),
  };
}

export async function getCommissionTarget(
  db: SupabaseClient,
  month: string,
  preferredKeys: Array<string | null | undefined>,
) {
  const orderedKeys = [...new Set(preferredKeys.filter((key): key is string => Boolean(key)))];

  if (orderedKeys.length > 0) {
    const { data, error } = await db
      .from("commission_targets")
      .select("*")
      .eq("month", month)
      .in("user_id", orderedKeys);

    if (error) throw error;
    if (data?.length) {
      for (const key of orderedKeys) {
        const match = data.find((row) => row.user_id === key);
        if (match) return match;
      }
      return data[0];
    }
  }

  const { data: nullScoped, error: nullScopedError } = await db
    .from("commission_targets")
    .select("*")
    .eq("month", month)
    .is("user_id", null)
    .maybeSingle();
  if (nullScopedError) throw nullScopedError;
  if (nullScoped) return nullScoped;

  const { data: fallbackRows, error: fallbackError } = await db
    .from("commission_targets")
    .select("*")
    .eq("month", month)
    .limit(2);
  if (fallbackError) throw fallbackError;

  return fallbackRows?.length === 1 ? fallbackRows[0] : null;
}

export async function resolveLinkedAppUserId(
  db: SupabaseClient,
  rawUserId?: string | null,
): Promise<string | null> {
  if (!rawUserId) return null;

  const { data: direct } = await db
    .from("users")
    .select("id")
    .eq("id", rawUserId)
    .maybeSingle();

  if (direct?.id) return direct.id;

  const { data: byAuth } = await db
    .from("users")
    .select("id")
    .eq("auth_id", rawUserId)
    .maybeSingle();

  return byAuth?.id || null;
}

export function allocateDeviceCommissionRows(
  rows: DeviceCommissionAllocationRow[],
  profileMap = new Map<string, EmployeeProfile | null>(),
) {
  const allocations = new Map<
    number | string,
    { contract_commission: number; commission_amount: number }
  >();

  const sortedRows = sortBySaleDateAndId(rows);

  let contractRunningTotal = 0;
  for (const row of sortedRows) {
    const amount = Number(row.device_sale_amount || 0);
    const beforeMilestones = Math.floor(contractRunningTotal / COMMISSION.DEVICE_MILESTONE);
    const afterMilestones = Math.floor((contractRunningTotal + amount) / COMMISSION.DEVICE_MILESTONE);
    const milestoneDelta = afterMilestones - beforeMilestones;
    const contractCommission =
      amount * COMMISSION.DEVICE_RATE + milestoneDelta * COMMISSION.DEVICE_MILESTONE_BONUS;

    allocations.set(row.id, {
      contract_commission: contractCommission,
      commission_amount: contractCommission,
    });

    contractRunningTotal += amount;
  }

  const byEmployee = new Map<string, DeviceCommissionAllocationRow[]>();
  for (const row of sortedRows) {
    if (!row.employee_id) continue;
    const key = row.employee_id;
    const bucket = byEmployee.get(key) || [];
    bucket.push(row);
    byEmployee.set(key, bucket);
  }

  for (const [employeeId, employeeRows] of byEmployee) {
    const profile = profileMap.get(employeeId) || DEFAULT_EMPLOYEE_PROFILE;
    const sortedEmployeeRows = sortBySaleDateAndId(employeeRows);
    let employeeRunningTotal = 0;

    for (const row of sortedEmployeeRows) {
      const amount = Number(row.device_sale_amount || 0);
      const beforeMilestones = Math.floor(employeeRunningTotal / COMMISSION.DEVICE_MILESTONE);
      const afterMilestones = Math.floor((employeeRunningTotal + amount) / COMMISSION.DEVICE_MILESTONE);
      const milestoneDelta = afterMilestones - beforeMilestones;
      const employeeCommission =
        amount * profile.device_rate + milestoneDelta * profile.device_milestone_bonus;

      const previous = allocations.get(row.id);
      allocations.set(row.id, {
        contract_commission: previous?.contract_commission || 0,
        commission_amount: employeeCommission,
      });

      employeeRunningTotal += amount;
    }
  }

  return allocations;
}

export async function recalculateDeviceCommissionsForMonths(
  db: SupabaseClient,
  months: string[],
) {
  const uniqueMonths = [...new Set(months.filter(Boolean))];
  if (uniqueMonths.length === 0) return;

  for (const month of uniqueMonths) {
    const { data: rows, error } = await db
      .from("commission_sales")
      .select("id, sale_date, device_sale_amount, employee_id")
      .eq("sale_type", "device")
      .is("deleted_at", null)
      .gte("sale_date", `${month}-01`)
      .lte("sale_date", `${month}-31`);

    if (error) throw error;
    if (!rows?.length) continue;

    const employeeIds = [...new Set(rows.map((row) => row.employee_id).filter(Boolean))];
    const profileMap = new Map<string, EmployeeProfile | null>();

    if (employeeIds.length > 0) {
      const { data: profiles, error: profilesError } = await db
        .from("employee_commission_profiles")
        .select("user_id, line_multiplier, device_rate, device_milestone_bonus, min_package_price, loyalty_bonuses")
        .in("user_id", employeeIds)
        .eq("active", true);

      if (profilesError) throw profilesError;
      for (const profile of profiles || []) {
        profileMap.set(profile.user_id, profile as EmployeeProfile);
      }
    }

    const allocations = allocateDeviceCommissionRows(
      rows.map((row) => ({
        id: row.id,
        sale_date: row.sale_date,
        device_sale_amount: Number(row.device_sale_amount || 0),
        employee_id: row.employee_id || null,
      })),
      profileMap,
    );

    for (const row of rows) {
      const allocation = allocations.get(row.id);
      if (!allocation) continue;

      const { error: updateError } = await db
        .from("commission_sales")
        .update({
          commission_amount: allocation.commission_amount,
          contract_commission: allocation.contract_commission,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      if (updateError) throw updateError;
    }
  }
}
