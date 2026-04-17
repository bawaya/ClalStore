export interface CRMData {
  revenue: number; totalOrders: number; newCount: number;
  totalCustomers: number; vipCount: number; pipelineValue: number;
  pipelineDeals: number;
  byStatus: Record<string, number>;
  bySource: Record<string, number>;
  recentOrders: { id: string; total: number; status: string; created_at: string }[];
  alerts: { msg: string; count: number; color: string }[];
}

export interface InboxData {
  active: number; waiting: number; bot: number; resolved_today: number; messages_today: number; unread_total: number;
}

export interface TaskItem {
  id: string; title: string; priority: string; status: string; due_date?: string;
}

export interface AnalyticsData {
  metrics: Record<string, number>;
  dailyRevenue: { label: string; value: number }[];
  topProducts: { label: string; value: number }[];
  customerGrowth: { label: string; value: number }[];
}

export interface TxItem {
  id: number; date: string; type: string; category: string; amount: number; note: string; method: string;
}

export interface ExpenseItem {
  id: string; name: string; icon: string; color: string; budget: number; actual: number;
}

export interface MonthlyRow {
  month: string; revenue: number; expenses: number; profit: number; orders: number; avgOrder: number;
}

export interface RevenueStream {
  name: string; value: number; color: string;
}
