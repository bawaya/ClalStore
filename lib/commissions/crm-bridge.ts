// =====================================================
// ClalMobile — CRM ↔ Commission Bridge
// Unified queries joining orders, commissions, employees
// =====================================================

import { createAdminSupabase } from "@/lib/supabase";
import { calcDeviceCommission, calcLoyaltyBonus, calcMonthlySummary } from "@/lib/commissions/calculator";
import { resolveLinkedAppUserId } from "@/lib/commissions/ledger";
import { lastDayOfMonth } from "@/lib/commissions/date-utils";

// ---------- Types ----------

export interface UnifiedEmployee {
  id: string;
  name: string;
  source: "crm" | "external" | "linked";
  user_id: string | null;
  commission_employee_id: string | null;
  token: string | null;
  role: string;
  active: boolean;
}

export interface OrderWithCommission {
  order_id: string;
  status: string;
  total: number;
  created_at: string;
  assigned_to: string | null;
  assigned_name: string | null;
  commission_synced: boolean;
  commission_amount: number | null;
  contract_commission: number | null;
  commission_source: string | null;
}

export interface SyncGap {
  order_id: string;
  status: string;
  total: number;
  created_at: string;
  assigned_to: string | null;
}

export interface BridgeDashboard {
  month: string;
  commissions: {
    lines_count: number;
    lines_commission: number;
    device_sales: number;
    devices_commission: number;
    milestones: number;
    sanctions_total: number;
    loyalty_bonus: number;
    net_commission: number;
  };
  crm: {
    total_orders: number;
    delivered_orders: number;
    synced_orders: number;
    unsynced_orders: number;
    total_revenue: number;
  };
  employees: UnifiedEmployee[];
  sync_gaps: SyncGap[];
  leaderboard: { name: string; lines: number; devices: number; commission: number }[];
  today: { sales: number; commission: number; lines: number; devices_revenue: number };
}

// ---------- Unified Employee List ----------

export async function getUnifiedEmployees(): Promise<UnifiedEmployee[]> {
  const db = createAdminSupabase();
  if (!db) return [];

  const [{ data: users }, { data: cemp }] = await Promise.all([
    db.from("users").select("id, name, role, status").eq("status", "active").order("name"),
    db.from("commission_employees").select("id, name, user_id, token, role, active").eq("active", true).order("name"),
  ]);

  const result: UnifiedEmployee[] = [];
  const linkedUserIds = new Set<string>();

  // Commission employees with user_id = linked
  for (const ce of cemp || []) {
    const linkedAppUserId = ce.user_id ? await resolveLinkedAppUserId(db, ce.user_id) : null;
    if (linkedAppUserId) {
      linkedUserIds.add(linkedAppUserId);
      result.push({
        id: linkedAppUserId,
        name: ce.name,
        source: "linked",
        user_id: linkedAppUserId,
        commission_employee_id: String(ce.id),
        token: ce.token,
        role: ce.role || "sales",
        active: ce.active,
      });
    } else {
      result.push({
        id: `ce-${ce.id}`,
        name: ce.name,
        source: "external",
        user_id: null,
        commission_employee_id: String(ce.id),
        token: ce.token,
        role: ce.role || "sales",
        active: ce.active,
      });
    }
  }

  // CRM users not linked
  for (const u of users || []) {
    if (!linkedUserIds.has(u.id)) {
      result.push({
        id: u.id,
        name: u.name,
        source: "crm",
        user_id: u.id,
        commission_employee_id: null,
        token: null,
        role: u.role || "viewer",
        active: u.status === "active",
      });
    }
  }

  return result;
}

// ---------- Orders with Commission Status ----------

export async function getOrdersWithCommissions(
  month?: string
): Promise<OrderWithCommission[]> {
  const db = createAdminSupabase();
  if (!db) return [];

  const m = month || new Date().toISOString().slice(0, 7);

  const { data: orders } = await db
    .from("orders")
    .select("id, status, total, created_at, assigned_to, commission_synced")
    .is("deleted_at", null)
    .gte("created_at", `${m}-01`)
    .lte("created_at", `${m}-31T23:59:59.999Z`)
    .order("created_at", { ascending: false });

  if (!orders?.length) return [];

  // Get commission records for these orders
  const orderIds = orders.map((o: any) => o.id).filter(Boolean);
  const { data: commissions } = await db
    .from("commission_sales")
    .select("order_id, commission_amount, contract_commission, source")
    .is("deleted_at", null)
    .in("order_id", orderIds);

  const commMap = new Map<string, { order_id: string; commission_amount: number; contract_commission: number; source: string }>();
  for (const c of commissions || []) {
    if (c.order_id) commMap.set(c.order_id, c);
  }

  // Get user names for assigned_to
  const userIds = [...new Set(orders.map((o: any) => o.assigned_to).filter(Boolean))];
  const nameMap = new Map<string, string>();
  if (userIds.length) {
    const { data: users } = await db.from("users").select("id, name").in("id", userIds);
    for (const u of users || []) nameMap.set(u.id, u.name);
  }

  return orders.map((o: any) => {
    const c = commMap.get(o.id);
    return {
      order_id: o.id,
      status: o.status,
      total: o.total || 0,
      created_at: o.created_at,
      assigned_to: o.assigned_to,
      assigned_name: o.assigned_to ? nameMap.get(o.assigned_to) || null : null,
      commission_synced: o.commission_synced || !!c,
      commission_amount: c?.commission_amount ?? null,
      contract_commission: c?.contract_commission ?? null,
      commission_source: c?.source ?? null,
    };
  });
}

// ---------- Sync Gaps (delivered but not synced) ----------

export async function getSyncGaps(month?: string): Promise<SyncGap[]> {
  const db = createAdminSupabase();
  if (!db) return [];

  const m = month || new Date().toISOString().slice(0, 7);
  const COMPLETED = ["delivered", "shipped", "approved"];

  const { data } = await db
    .from("orders")
    .select("id, status, total, created_at, assigned_to")
    .is("deleted_at", null)
    .gte("created_at", `${m}-01`)
    .lte("created_at", `${m}-31T23:59:59.999Z`)
    .in("status", COMPLETED)
    .eq("commission_synced", false)
    .order("created_at", { ascending: false });

  return (data || []).map((o: any) => ({
    order_id: o.id,
    status: o.status,
    total: o.total || 0,
    created_at: o.created_at,
    assigned_to: o.assigned_to,
  }));
}

// ---------- Full Bridge Dashboard ----------

export async function getBridgeDashboard(month?: string): Promise<BridgeDashboard> {
  const db = createAdminSupabase();
  const m = month || new Date().toISOString().slice(0, 7);

  const empty: BridgeDashboard = {
    month: m,
    commissions: { lines_count: 0, lines_commission: 0, device_sales: 0, devices_commission: 0, milestones: 0, sanctions_total: 0, loyalty_bonus: 0, net_commission: 0 },
    crm: { total_orders: 0, delivered_orders: 0, synced_orders: 0, unsynced_orders: 0, total_revenue: 0 },
    employees: [],
    sync_gaps: [],
    leaderboard: [],
    today: { sales: 0, commission: 0, lines: 0, devices_revenue: 0 },
  };

  if (!db) return empty;

  // Parallel queries
  const todayStr = new Date().toISOString().slice(0, 10);
  const [salesRes, sanctionsRes, ordersRes, employees, gaps, todaySalesRes] = await Promise.all([
    db.from("commission_sales").select("*").is("deleted_at", null).gte("sale_date", `${m}-01`).lte("sale_date", lastDayOfMonth(m)),
    db.from("commission_sanctions").select("amount").is("deleted_at", null).gte("sanction_date", `${m}-01`).lte("sanction_date", lastDayOfMonth(m)),
    db.from("orders").select("id, status, total, commission_synced").is("deleted_at", null).gte("created_at", `${m}-01`).lte("created_at", `${lastDayOfMonth(m)}T23:59:59.999Z`),
    getUnifiedEmployees(),
    getSyncGaps(m),
    db.from("commission_sales").select("sale_type, commission_amount, device_sale_amount").is("deleted_at", null).eq("sale_date", todayStr),
  ]);

  type SaleRow = {
    sale_type: "line" | "device";
    commission_amount: number;
    source: string;
    package_price?: number;
    device_sale_amount?: number;
    loyalty_start_date?: string | null;
    loyalty_status?: string | null;
    employee_name?: string | null;
  };
  type SanctionRow = { amount: number };
  type OrderRow = { id: string; status: string; total: number; commission_synced?: boolean };
  type TodaySaleRow = { sale_type: "line" | "device"; commission_amount?: number; device_sale_amount?: number };

  const sales = (salesRes.data || []) as SaleRow[];
  const sanctions = (sanctionsRes.data || []) as SanctionRow[];
  const orders = (ordersRes.data || []) as OrderRow[];
  const todaySales = (todaySalesRes.data || []) as TodaySaleRow[];

  // Commission aggregation
  const linesSales = sales.filter((s) => s.sale_type === "line");
  const devicesSales = sales.filter((s) => s.sale_type === "device");
  const linesCount = linesSales.length;
  const totalDeviceAmount = devicesSales.reduce((sum, s) => sum + (s.device_sale_amount || 0), 0);
  const deviceCalc = calcDeviceCommission(totalDeviceAmount);

  const activeLines = linesSales.filter((s) => s.loyalty_start_date && s.loyalty_status === "active");
  const loyaltyBonus = activeLines.reduce((sum, s) => sum + calcLoyaltyBonus(s.loyalty_start_date!).earnedSoFar, 0);

  // Delegate lines/devices/sanctions/net aggregation to the authoritative helper
  // (audit issue 4.29 — was previously inlined here).
  const summary = calcMonthlySummary(sales, sanctions, loyaltyBonus, null);
  const { linesCommission, devicesCommission, totalSanctions: sanctionsTotal, netCommission } = summary;

  // CRM aggregation
  const COMPLETED = ["delivered", "shipped", "approved"];
  const deliveredOrders = orders.filter((o) => COMPLETED.includes(o.status));
  const syncedOrders = orders.filter((o) => o.commission_synced);
  const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);

  // Leaderboard
  const byEmp: Record<string, { lines: number; devices: number; commission: number }> = {};
  for (const s of sales) {
    const name = s.employee_name || "ללא שיוך";
    if (!byEmp[name]) byEmp[name] = { lines: 0, devices: 0, commission: 0 };
    if (s.sale_type === "line") byEmp[name].lines++;
    else byEmp[name].devices++;
    byEmp[name].commission += s.commission_amount || 0;
  }
  const leaderboard = Object.entries(byEmp)
    .map(([name, d]) => ({ name, ...d }))
    .sort((a, b) => b.commission - a.commission);

  // Today
  const todayLines = todaySales.filter((s) => s.sale_type === "line");
  const todayDevRev = todaySales.filter((s) => s.sale_type === "device").reduce((a, s) => a + (s.device_sale_amount || 0), 0);

  return {
    month: m,
    commissions: {
      lines_count: linesCount,
      lines_commission: linesCommission,
      device_sales: totalDeviceAmount,
      devices_commission: devicesCommission,
      milestones: deviceCalc.milestoneCount,
      sanctions_total: sanctionsTotal,
      loyalty_bonus: loyaltyBonus,
      net_commission: netCommission,
    },
    crm: {
      total_orders: orders.length,
      delivered_orders: deliveredOrders.length,
      synced_orders: syncedOrders.length,
      unsynced_orders: gaps.length,
      total_revenue: totalRevenue,
    },
    employees,
    sync_gaps: gaps,
    leaderboard,
    today: {
      sales: todaySales.length,
      commission: todaySales.reduce((a, s) => a + (s.commission_amount || 0), 0),
      lines: todayLines.length,
      devices_revenue: todayDevRev,
    },
  };
}
