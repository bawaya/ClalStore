/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ────────────────────────────────────────────────────────────
// Hoisted mocks — must be declared before imports of the SUT.
// ────────────────────────────────────────────────────────────

const { hoistedAdminSupabase, hoistedRecalculate } = vi.hoisted(() => ({
  hoistedAdminSupabase: vi.fn(),
  hoistedRecalculate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/supabase", () => ({
  createAdminSupabase: () => hoistedAdminSupabase(),
  createServerSupabase: () => hoistedAdminSupabase(),
  createBrowserSupabase: () => hoistedAdminSupabase(),
  getSupabase: () => hoistedAdminSupabase(),
}));

// Keep ledger's pure helpers real, only stub out the async recalc side-effect
vi.mock("@/lib/commissions/ledger", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/commissions/ledger")>();
  return {
    ...actual,
    recalculateDeviceCommissionsForMonths: (...args: any[]) => hoistedRecalculate(...args),
  };
});

import {
  buildAutoSyncCommissionIdentity,
  syncOrdersToCommissions,
  syncCommissionForOrder,
  getLastSyncInfo,
} from "@/lib/commissions/sync-orders";

// ────────────────────────────────────────────────────────────
// Flexible Supabase mock — matches the call patterns used inside
// sync-orders.ts without us having to micro-mock every chain step.
// ────────────────────────────────────────────────────────────

interface TableState {
  /** rows returned for SELECT queries on this table */
  rows?: any[];
  /** a single row returned for .maybeSingle() / .single() */
  single?: any;
  /** error to bubble up on insert/update/upsert */
  mutationError?: { message: string } | null;
  /** track all mutations for assertions */
  inserts?: any[];
  updates?: any[];
  upserts?: any[];
}

function createDbMock(tables: Record<string, TableState> = {}) {
  const state: Record<string, TableState> = {};
  for (const [k, v] of Object.entries(tables)) {
    state[k] = {
      rows: v.rows ?? [],
      single: v.single,
      mutationError: v.mutationError ?? null,
      inserts: [],
      updates: [],
      upserts: [],
    };
  }

  function tableOf(name: string): TableState {
    if (!state[name]) {
      state[name] = { rows: [], single: null, mutationError: null, inserts: [], updates: [], upserts: [] };
    }
    return state[name]!;
  }

  const from = vi.fn((tableName: string) => {
    const t = tableOf(tableName);
    const selectResult = { data: t.rows ?? [], error: null };
    const singleResult = { data: t.single ?? null, error: null };

    const builder: any = {
      // SELECT chain — return selectResult when awaited directly,
      // singleResult when .maybeSingle / .single is called.
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue(singleResult),
      maybeSingle: vi.fn().mockResolvedValue(singleResult),
      // Thenable — awaited builder resolves to select result
      then: (resolve: any) => resolve(selectResult),

      // MUTATION chain
      insert: vi.fn((payload: any) => {
        t.inserts!.push(payload);
        return {
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: payload, error: t.mutationError }),
          then: (resolve: any) => resolve({ data: null, error: t.mutationError }),
        };
      }),
      update: vi.fn((payload: any) => {
        t.updates!.push(payload);
        return {
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          then: (resolve: any) => resolve({ data: null, error: t.mutationError }),
        };
      }),
      upsert: vi.fn((payload: any, _opts: any) => {
        t.upserts!.push(payload);
        return {
          then: (resolve: any) => resolve({ data: null, error: t.mutationError }),
        };
      }),
    };
    return builder;
  });

  return { from, __state: state };
}

// ================================================================
// buildAutoSyncCommissionIdentity — pure function
// ================================================================

describe("buildAutoSyncCommissionIdentity", () => {
  const emptySnapshot = {
    customerCodeMap: new Map<string, string | null>(),
    primaryHotMap: new Map<string, any>(),
  };

  it("returns unmatched shape when customerId is null", () => {
    const id = buildAutoSyncCommissionIdentity(null, emptySnapshot);
    expect(id.customer_id).toBeNull();
    expect(id.customer_hot_account_id).toBeNull();
    expect(id.match_status).toBe("unmatched");
    expect(id.match_method).toBeNull();
    expect(id.match_confidence).toBeNull();
  });

  it("returns matched shape with customer but no hot account", () => {
    const snapshot = {
      customerCodeMap: new Map([["cust-1", "CLAL-001"]]),
      primaryHotMap: new Map(),
    };
    const id = buildAutoSyncCommissionIdentity("cust-1", snapshot);
    expect(id.customer_id).toBe("cust-1");
    expect(id.customer_hot_account_id).toBeNull();
    expect(id.store_customer_code_snapshot).toBe("CLAL-001");
    expect(id.match_status).toBe("matched");
    expect(id.match_method).toBe("order_sync");
    expect(id.match_confidence).toBe(1.0);
  });

  it("includes hot account id and hot_mobile_id when present", () => {
    const snapshot = {
      customerCodeMap: new Map([["cust-1", "CLAL-001"]]),
      primaryHotMap: new Map([["cust-1", { id: "hot-1", hot_mobile_id: "HOT_MOB_42" }]]),
    };
    const id = buildAutoSyncCommissionIdentity("cust-1", snapshot);
    expect(id.customer_hot_account_id).toBe("hot-1");
    expect(id.hot_mobile_id_snapshot).toBe("HOT_MOB_42");
  });

  it("handles customer with no code gracefully", () => {
    const snapshot = {
      customerCodeMap: new Map([["cust-1", null]]),
      primaryHotMap: new Map(),
    };
    const id = buildAutoSyncCommissionIdentity("cust-1", snapshot);
    expect(id.store_customer_code_snapshot).toBeNull();
    expect(id.match_status).toBe("matched"); // still matched because customer_id is set
  });

  it("handles hot account with null hot_mobile_id", () => {
    const snapshot = {
      customerCodeMap: new Map(),
      primaryHotMap: new Map([["cust-1", { id: "hot-1", hot_mobile_id: null }]]),
    };
    const id = buildAutoSyncCommissionIdentity("cust-1", snapshot);
    expect(id.customer_hot_account_id).toBe("hot-1");
    expect(id.hot_mobile_id_snapshot).toBeNull();
  });

  it("ignores unknown customerId gracefully", () => {
    const snapshot = {
      customerCodeMap: new Map([["cust-1", "CLAL-001"]]),
      primaryHotMap: new Map([["cust-1", { id: "hot-1", hot_mobile_id: "X" }]]),
    };
    const id = buildAutoSyncCommissionIdentity("cust-ghost", snapshot);
    expect(id.customer_id).toBe("cust-ghost");
    expect(id.customer_hot_account_id).toBeNull();
    expect(id.store_customer_code_snapshot).toBeNull();
    expect(id.match_status).toBe("matched"); // trust customerId passed in
  });
});

// ================================================================
// syncOrdersToCommissions — integration with mocked DB
// ================================================================

describe("syncOrdersToCommissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns DB unavailable error when admin client is null", async () => {
    hoistedAdminSupabase.mockReturnValue(null);
    const res = await syncOrdersToCommissions("2026-04-01", "2026-04-30");
    expect(res.synced).toBe(0);
    expect(res.errors).toContain("DB unavailable");
  });

  it("returns empty result when no orders exist in the range", async () => {
    const db = createDbMock({
      order_status_history: { rows: [] },
      orders: { rows: [] },
      commission_sales: { rows: [] },
      commission_sync_log: {},
    });
    hoistedAdminSupabase.mockReturnValue(db);

    const res = await syncOrdersToCommissions("2026-04-01", "2026-04-30");
    expect(res.synced).toBe(0);
    expect(res.skipped).toBe(0);
    expect(res.errors).toEqual([]);
    // Should still write a sync log row
    expect(db.__state.commission_sync_log?.inserts?.length).toBe(1);
    expect(db.__state.commission_sync_log?.inserts?.[0].status).toBe("success");
  });

  it("upserts a device commission for an approved device order", async () => {
    const order = {
      id: "ORD-1",
      status: "approved",
      created_at: "2026-04-10T10:00:00Z",
      assigned_to: "user-1",
      customer_id: "cust-1",
    };
    const db = createDbMock({
      order_status_history: { rows: [{ order_id: "ORD-1", new_status: "approved", created_at: "2026-04-10T10:00:00Z" }] },
      orders: { rows: [order] },
      order_items: {
        rows: [
          { order_id: "ORD-1", product_name: "iPhone 15", product_type: "device", price: 3499, quantity: 1 },
        ],
      },
      commission_sales: { rows: [] },
      users: { rows: [{ id: "user-1", name: "Sami" }] },
      customers: { rows: [{ id: "cust-1", customer_code: "CLAL-001" }] },
      customer_hot_accounts: { rows: [{ id: "hot-1", customer_id: "cust-1", hot_mobile_id: "HM1" }] },
      commission_sync_log: {},
    });
    hoistedAdminSupabase.mockReturnValue(db);

    const res = await syncOrdersToCommissions("2026-04-01", "2026-04-30");
    expect(res.synced).toBe(1);
    expect(res.totalAmount).toBe(3499);
    expect(res.errors).toEqual([]);
    expect(db.__state.commission_sales?.upserts?.length).toBe(1);
    const payload = db.__state.commission_sales!.upserts![0];
    expect(payload.order_id).toBe("ORD-1");
    expect(payload.sale_type).toBe("device");
    expect(payload.source).toBe("auto_sync");
    expect(payload.employee_id).toBe("user-1");
    expect(payload.employee_name).toBe("Sami");
    expect(payload.device_sale_amount).toBe(3499);
    expect(payload.deleted_at).toBeNull();
  });

  it("deactivates a commission when a synced order is later cancelled", async () => {
    const cancelledOrder = {
      id: "ORD-2",
      status: "cancelled",
      created_at: "2026-04-05T10:00:00Z",
      assigned_to: "user-1",
      customer_id: "cust-1",
    };
    const db = createDbMock({
      order_status_history: { rows: [] },
      orders: { rows: [cancelledOrder] },
      order_items: {
        rows: [{ order_id: "ORD-2", product_name: "iPhone", product_type: "device", price: 3000, quantity: 1 }],
      },
      commission_sales: {
        rows: [{ id: 99, order_id: "ORD-2", sale_date: "2026-04-05", deleted_at: null }],
      },
      users: { rows: [{ id: "user-1", name: "Sami" }] },
      customers: { rows: [{ id: "cust-1", customer_code: "CLAL-001" }] },
      customer_hot_accounts: { rows: [] },
      commission_sync_log: {},
    });
    hoistedAdminSupabase.mockReturnValue(db);

    const res = await syncOrdersToCommissions("2026-04-01", "2026-04-30");
    expect(res.deactivated).toBe(1);
    expect(res.synced).toBe(0);
    const updates = db.__state.commission_sales!.updates!;
    expect(updates.length).toBeGreaterThan(0);
    expect(updates[0].deleted_at).toBeTruthy();
  });

  it("skips commissionable orders with no device items", async () => {
    const accessoryOnlyOrder = {
      id: "ORD-3",
      status: "approved",
      created_at: "2026-04-10T10:00:00Z",
      assigned_to: "user-1",
      customer_id: null,
    };
    const db = createDbMock({
      order_status_history: { rows: [] },
      orders: { rows: [accessoryOnlyOrder] },
      order_items: {
        rows: [{ order_id: "ORD-3", product_name: "Case", product_type: "accessory", price: 50, quantity: 1 }],
      },
      commission_sales: { rows: [] },
      commission_sync_log: {},
    });
    hoistedAdminSupabase.mockReturnValue(db);

    const res = await syncOrdersToCommissions("2026-04-01", "2026-04-30");
    expect(res.synced).toBe(0);
    expect(res.skipped).toBeGreaterThanOrEqual(1);
    expect(db.__state.commission_sales?.upserts?.length ?? 0).toBe(0);
  });

  it("records mutation errors in result.errors and marks sync log as partial", async () => {
    const order = {
      id: "ORD-4",
      status: "delivered",
      created_at: "2026-04-10T10:00:00Z",
      assigned_to: null,
      customer_id: null,
    };
    const db = createDbMock({
      order_status_history: { rows: [{ order_id: "ORD-4", new_status: "delivered", created_at: "2026-04-10T10:00:00Z" }] },
      orders: { rows: [order] },
      order_items: {
        rows: [{ order_id: "ORD-4", product_name: "iPhone", product_type: "device", price: 3000, quantity: 1 }],
      },
      commission_sales: { rows: [], mutationError: { message: "RLS denied" } },
      commission_sync_log: {},
    });
    hoistedAdminSupabase.mockReturnValue(db);

    const res = await syncOrdersToCommissions("2026-04-01", "2026-04-30");
    expect(res.errors.length).toBeGreaterThan(0);
    expect(res.errors[0]).toContain("ORD-4");
    expect(res.errors[0]).toContain("RLS denied");
    expect(db.__state.commission_sync_log?.inserts?.[0].status).toBe("partial");
  });

  it("marks orders.commission_synced=true after successful sync", async () => {
    const order = {
      id: "ORD-5",
      status: "approved",
      created_at: "2026-04-10T10:00:00Z",
      assigned_to: "user-1",
      customer_id: null,
    };
    const db = createDbMock({
      order_status_history: { rows: [] },
      orders: { rows: [order] },
      order_items: {
        rows: [{ order_id: "ORD-5", product_name: "iPhone", product_type: "device", price: 3000, quantity: 1 }],
      },
      commission_sales: { rows: [] },
      users: { rows: [{ id: "user-1", name: "Sami" }] },
      commission_sync_log: {},
    });
    hoistedAdminSupabase.mockReturnValue(db);

    await syncOrdersToCommissions("2026-04-01", "2026-04-30");
    const orderUpdates = db.__state.orders!.updates!;
    expect(orderUpdates.some((u: any) => u.commission_synced === true)).toBe(true);
  });

  it("triggers month recalculation for affected months", async () => {
    const order = {
      id: "ORD-6",
      status: "approved",
      created_at: "2026-04-10T10:00:00Z",
      assigned_to: "user-1",
      customer_id: null,
    };
    const db = createDbMock({
      order_status_history: { rows: [] },
      orders: { rows: [order] },
      order_items: {
        rows: [{ order_id: "ORD-6", product_name: "iPhone", product_type: "device", price: 3000, quantity: 1 }],
      },
      commission_sales: { rows: [] },
      users: { rows: [{ id: "user-1", name: "Sami" }] },
      commission_sync_log: {},
    });
    hoistedAdminSupabase.mockReturnValue(db);

    await syncOrdersToCommissions("2026-04-01", "2026-04-30");
    expect(hoistedRecalculate).toHaveBeenCalled();
    const [, months] = hoistedRecalculate.mock.calls[0];
    expect(months).toContain("2026-04");
  });

  it("recalculates both old and new month when an order's sale date moves", async () => {
    // existing commission in March, new status transition makes it sync to April
    const order = {
      id: "ORD-7",
      status: "approved",
      created_at: "2026-03-20T10:00:00Z",
      assigned_to: "user-1",
      customer_id: null,
    };
    const db = createDbMock({
      order_status_history: { rows: [{ order_id: "ORD-7", new_status: "approved", created_at: "2026-04-02T10:00:00Z" }] },
      orders: { rows: [order] },
      order_items: {
        rows: [{ order_id: "ORD-7", product_name: "iPhone", product_type: "device", price: 3000, quantity: 1 }],
      },
      commission_sales: {
        rows: [{ id: 77, order_id: "ORD-7", sale_date: "2026-03-20", deleted_at: null }],
      },
      users: { rows: [{ id: "user-1", name: "Sami" }] },
      commission_sync_log: {},
    });
    hoistedAdminSupabase.mockReturnValue(db);

    await syncOrdersToCommissions("2026-03-01", "2026-04-30");
    const [, months] = hoistedRecalculate.mock.calls[0];
    expect(months).toContain("2026-04");
    expect(months).toContain("2026-03");
  });

  it("is idempotent — re-syncing the same order does not create a duplicate", async () => {
    const order = {
      id: "ORD-8",
      status: "approved",
      created_at: "2026-04-10T10:00:00Z",
      assigned_to: "user-1",
      customer_id: null,
    };
    const db = createDbMock({
      order_status_history: { rows: [] },
      orders: { rows: [order] },
      order_items: {
        rows: [{ order_id: "ORD-8", product_name: "iPhone", product_type: "device", price: 3000, quantity: 1 }],
      },
      // existing commission already present — the route must UPSERT, not INSERT
      commission_sales: {
        rows: [{ id: 88, order_id: "ORD-8", sale_date: "2026-04-10", deleted_at: null }],
      },
      users: { rows: [{ id: "user-1", name: "Sami" }] },
      commission_sync_log: {},
    });
    hoistedAdminSupabase.mockReturnValue(db);

    await syncOrdersToCommissions("2026-04-01", "2026-04-30");
    // The route always uses upsert with onConflict=order_id — verify that.
    expect(db.__state.commission_sales?.upserts?.length).toBe(1);
    expect(db.__state.commission_sales?.inserts?.length ?? 0).toBe(0);
  });
});

// ================================================================
// syncCommissionForOrder — single-order path
// ================================================================

describe("syncCommissionForOrder", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns DB unavailable error when neither admin client nor injected db is provided", async () => {
    hoistedAdminSupabase.mockReturnValue(null);
    const res = await syncCommissionForOrder("ORD-NONE");
    expect(res.errors).toContain("DB unavailable");
  });

  it("uses the injected db client when provided (no call to createAdminSupabase)", async () => {
    const order = {
      id: "ORD-INJ",
      status: "approved",
      created_at: "2026-04-15T10:00:00Z",
      assigned_to: null,
      customer_id: null,
    };
    const db = createDbMock({
      orders: { rows: [order] },
      order_items: {
        rows: [{ order_id: "ORD-INJ", product_name: "iPhone", product_type: "device", price: 2000, quantity: 1 }],
      },
      order_status_history: { rows: [] },
      commission_sales: { rows: [] },
    });

    const res = await syncCommissionForOrder("ORD-INJ", db as any);
    expect(res.synced).toBe(1);
    expect(hoistedAdminSupabase).not.toHaveBeenCalled();
  });

  it("falls back to createAdminSupabase when no db is injected", async () => {
    const order = {
      id: "ORD-FALL",
      status: "approved",
      created_at: "2026-04-15T10:00:00Z",
      assigned_to: null,
      customer_id: null,
    };
    const db = createDbMock({
      orders: { rows: [order] },
      order_items: {
        rows: [{ order_id: "ORD-FALL", product_name: "iPhone", product_type: "device", price: 2000, quantity: 1 }],
      },
      order_status_history: { rows: [] },
      commission_sales: { rows: [] },
    });
    hoistedAdminSupabase.mockReturnValue(db);

    await syncCommissionForOrder("ORD-FALL");
    expect(hoistedAdminSupabase).toHaveBeenCalled();
  });
});

// ================================================================
// getLastSyncInfo
// ================================================================

describe("getLastSyncInfo", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when admin client is unavailable", async () => {
    hoistedAdminSupabase.mockReturnValue(null);
    const res = await getLastSyncInfo();
    expect(res).toBeNull();
  });

  it("returns null when the log table has no rows", async () => {
    const db = createDbMock({ commission_sync_log: { single: null } });
    hoistedAdminSupabase.mockReturnValue(db);
    const res = await getLastSyncInfo();
    expect(res).toBeNull();
  });

  it("returns the latest sync log row with expected shape", async () => {
    const db = createDbMock({
      commission_sync_log: {
        single: { sync_date: "2026-04-17T12:00:00Z", orders_synced: 42, status: "success" },
      },
    });
    hoistedAdminSupabase.mockReturnValue(db);
    const res = await getLastSyncInfo();
    expect(res).toEqual({
      lastSync: "2026-04-17T12:00:00Z",
      ordersSynced: 42,
      status: "success",
    });
  });
});
