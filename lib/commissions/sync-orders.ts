// =====================================================
// ClalMobile — Sync completed device orders to commission_sales
// =====================================================

import { createAdminSupabase } from "@/lib/supabase";
import { calcDualCommission, type EmployeeProfile } from "@/lib/commissions/calculator";

const COMPLETED_STATUSES = ['delivered', 'shipped', 'approved'];

export async function syncOrdersToCommissions(
  startDate: string,
  endDate: string
): Promise<{
  synced: number;
  skipped: number;
  totalAmount: number;
  errors: string[];
}> {
  const db = createAdminSupabase();
  if (!db) return { synced: 0, skipped: 0, totalAmount: 0, errors: ['DB unavailable'] };

  const result = { synced: 0, skipped: 0, totalAmount: 0, errors: [] as string[] };

  // Fetch completed orders in date range (include assigned_to for employee attribution)
  const { data: orders, error } = await db
    .from('orders')
    .select('id, total, items_total, discount_amount, status, created_at, assigned_to')
    .gte('created_at', startDate)
    .lte('created_at', endDate + 'T23:59:59.999Z')
    .in('status', COMPLETED_STATUSES)
    .order('created_at', { ascending: true });

  if (error) {
    result.errors.push(error.message);
    return result;
  }

  if (!orders || orders.length === 0) return result;

  // Preload employee profiles for all assigned employees
  const employeeIds = [...new Set(orders.map((o: any) => o.assigned_to).filter(Boolean))];
  const profileMap = new Map<string, EmployeeProfile>();

  if (employeeIds.length > 0) {
    const { data: profiles } = await db
      .from('employee_commission_profiles')
      .select('user_id, line_multiplier, device_rate, device_milestone_bonus, min_package_price, loyalty_bonuses')
      .in('user_id', employeeIds)
      .eq('active', true);

    for (const p of (profiles || [])) {
      profileMap.set(p.user_id, p as EmployeeProfile);
    }
  }

  for (const order of orders) {
    // Check if already synced
    const { data: existing } = await db
      .from('commission_sales')
      .select('id')
      .eq('order_id', order.id)
      .maybeSingle();

    if (existing) {
      result.skipped++;
      continue;
    }

    const netAmount = Number(order.total) || 0;
    const employeeId = (order as any).assigned_to || null;
    const profile = employeeId ? profileMap.get(employeeId) || null : null;

    const { contractCommission, employeeCommission } = calcDualCommission(
      'device', netAmount, true, profile,
    );

    const { error: insertError } = await db
      .from('commission_sales')
      .insert({
        sale_date: new Date(order.created_at).toISOString().slice(0, 10),
        sale_type: 'device',
        source: 'auto_sync',
        order_id: order.id,
        employee_id: employeeId,
        device_name: `הזמנה ${order.id}`,
        device_sale_amount: netAmount,
        commission_amount: employeeId ? employeeCommission : contractCommission,
        contract_commission: contractCommission,
      });

    if (insertError) {
      result.errors.push(`Order ${order.id}: ${insertError.message}`);
      continue;
    }

    result.synced++;
    result.totalAmount += netAmount;
  }

  // Log the sync
  await db.from('commission_sync_log').insert({
    orders_synced: result.synced,
    orders_skipped: result.skipped,
    total_amount: result.totalAmount,
    status: result.errors.length > 0 ? 'partial' : 'success',
    error_message: result.errors.length > 0 ? result.errors.join('; ') : null,
  });

  return result;
}

export async function getLastSyncInfo(): Promise<{
  lastSync: string | null;
  ordersSynced: number;
  status: string;
} | null> {
  const db = createAdminSupabase();
  if (!db) return null;

  const { data } = await db
    .from('commission_sync_log')
    .select('sync_date, orders_synced, status')
    .order('sync_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return {
    lastSync: data.sync_date,
    ordersSynced: data.orders_synced,
    status: data.status,
  };
}
