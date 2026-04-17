/**
 * tests/types/command-center-types.test.ts
 * Validates that components/command-center/types.ts exports the expected interfaces.
 */

import { describe, it, expect } from "vitest";
import type {
  CRMData,
  InboxData,
  TaskItem,
  AnalyticsData,
  TxItem,
  ExpenseItem,
  MonthlyRow,
  RevenueStream,
} from "@/components/command-center/types";

// Compile-time assertion helper
function assertType<T>(_val: T): void { /* no-op */ }

describe("command-center types", () => {
  describe("CRMData", () => {
    it("can be instantiated with expected shape", () => {
      const data: CRMData = {
        revenue: 50000,
        totalOrders: 100,
        newCount: 10,
        totalCustomers: 500,
        vipCount: 20,
        pipelineValue: 30000,
        pipelineDeals: 15,
        byStatus: { new: 5, approved: 3 },
        bySource: { store: 10, whatsapp: 5 },
        recentOrders: [{ id: "CLM-1", total: 3000, status: "new", created_at: "2026-01-01" }],
        alerts: [{ msg: "Low stock", count: 3, color: "red" }],
      };
      expect(data.revenue).toBe(50000);
      expect(data.recentOrders).toBeInstanceOf(Array);
      expect(data.alerts).toBeInstanceOf(Array);
    });
  });

  describe("InboxData", () => {
    it("can be instantiated with expected shape", () => {
      const data: InboxData = {
        active: 5, waiting: 3, bot: 10, resolved_today: 8,
        messages_today: 50, unread_total: 12,
      };
      expect(typeof data.active).toBe("number");
      expect(typeof data.unread_total).toBe("number");
    });
  });

  describe("TaskItem", () => {
    it("can be instantiated with expected shape", () => {
      const task: TaskItem = {
        id: "t1", title: "Follow up", priority: "high", status: "pending",
      };
      expect(task.id).toBe("t1");
      expect(task.title).toBeDefined();
    });

    it("supports optional due_date", () => {
      const task: TaskItem = {
        id: "t2", title: "Call", priority: "low", status: "done", due_date: "2026-04-20",
      };
      expect(task.due_date).toBe("2026-04-20");
    });
  });

  describe("AnalyticsData", () => {
    it("can be instantiated with expected shape", () => {
      const data: AnalyticsData = {
        metrics: { revenue: 50000, orders: 100 },
        dailyRevenue: [{ label: "Mon", value: 5000 }],
        topProducts: [{ label: "iPhone", value: 30 }],
        customerGrowth: [{ label: "Jan", value: 50 }],
      };
      expect(typeof data.metrics).toBe("object");
      expect(data.dailyRevenue).toBeInstanceOf(Array);
      expect(data.topProducts).toBeInstanceOf(Array);
    });
  });

  describe("TxItem", () => {
    it("can be instantiated with expected shape", () => {
      const tx: TxItem = {
        id: 1, date: "2026-04-17", type: "income", category: "sales",
        amount: 5000, note: "Product sale", method: "credit",
      };
      expect(typeof tx.id).toBe("number");
      expect(typeof tx.amount).toBe("number");
    });
  });

  describe("ExpenseItem", () => {
    it("can be instantiated with expected shape", () => {
      const expense: ExpenseItem = {
        id: "e1", name: "Rent", icon: "home", color: "#FF0000",
        budget: 5000, actual: 4500,
      };
      expect(expense.name).toBe("Rent");
      expect(typeof expense.budget).toBe("number");
    });
  });

  describe("MonthlyRow", () => {
    it("can be instantiated with expected shape", () => {
      const row: MonthlyRow = {
        month: "2026-04", revenue: 50000, expenses: 20000,
        profit: 30000, orders: 100, avgOrder: 500,
      };
      expect(row.month).toBeDefined();
      expect(row.profit).toBe(30000);
    });
  });

  describe("RevenueStream", () => {
    it("can be instantiated with expected shape", () => {
      const stream: RevenueStream = {
        name: "Devices", value: 40000, color: "#3B82F6",
      };
      expect(stream.name).toBe("Devices");
      expect(typeof stream.value).toBe("number");
    });
  });

  describe("all types compile", () => {
    it("all 8 interfaces exist (compile-time check)", () => {
      assertType<CRMData>({} as CRMData);
      assertType<InboxData>({} as InboxData);
      assertType<TaskItem>({} as TaskItem);
      assertType<AnalyticsData>({} as AnalyticsData);
      assertType<TxItem>({} as TxItem);
      assertType<ExpenseItem>({} as ExpenseItem);
      assertType<MonthlyRow>({} as MonthlyRow);
      assertType<RevenueStream>({} as RevenueStream);
      expect(true).toBe(true);
    });
  });
});
