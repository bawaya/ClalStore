/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for the auto-commission flow in lib/crm/pipeline.ts.
 *
 * When updatePipelineDealRecord transitions a deal into a stage where
 * is_won=true for the first time, it should:
 *   - Create a sales_docs row with idempotency_key = `pipeline_${dealId}`
 *   - Call registerSaleCommission() with source='pipeline'
 *   - Skip silently (console.warn) when value is 0 or employee_id is missing
 *   - Skip completely when transitioning between non-won stages
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ─────────────────────────────────────
const hoisted = vi.hoisted(() => ({
  registerMock: vi.fn(),
  logAuditMock: vi.fn(),
}));

vi.mock("@/lib/commissions/register", () => ({
  registerSaleCommission: hoisted.registerMock,
}));

vi.mock("@/lib/admin/auth", () => ({
  logAudit: hoisted.logAuditMock,
}));

vi.mock("@/lib/orders/admin", () => ({
  createManualOrder: vi.fn(),
}));

import { updatePipelineDealRecord } from "@/lib/crm/pipeline";

// ── Chainable query-builder stub ──────────────────────
type QueryResult = { data: any; error: any };
function chain(result: QueryResult) {
  const b: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
    then: (resolve: any) => resolve(result),
  };
  return b;
}

/**
 * Build a Supabase-like db whose .from(table) returns a chain whose
 * terminal methods (single / maybeSingle) return the scripted values.
 *
 * The script supports multiple calls per-table by index.
 */
function buildDb(scripts: Record<string, QueryResult[]>) {
  const counters: Record<string, number> = {};
  const from = vi.fn().mockImplementation((table: string) => {
    const idx = counters[table] ?? 0;
    const script = scripts[table];
    const result = script
      ? script[Math.min(idx, script.length - 1)]
      : { data: null, error: null };
    counters[table] = idx + 1;
    return chain(result);
  });
  return { from } as any;
}

const actor = {
  id: "auth-u1",
  appUserId: "app-u1",
  role: "sales",
  email: "sales@test.com",
  name: "Sales Rep",
};

const wonStage = {
  id: 5,
  name: "won",
  name_ar: "مغلق",
  name_he: "זכה",
  sort_order: 99,
  is_won: true,
  is_lost: false,
  color: "#22c55e",
};

const nonWonStage = {
  id: 2,
  name: "negotiation",
  name_ar: "تفاوض",
  name_he: "משא ומתן",
  sort_order: 20,
  is_won: false,
  is_lost: false,
  color: "#f59e0b",
};

const dealBefore = { stage_id: 1 }; // previously in "lead" stage

const wonDealRow = {
  id: "deal-42",
  stage_id: 5,
  customer_name: "Ahmad",
  customer_phone: "0501234567",
  customer_id: "cust-1",
  product_name: "iPhone 15",
  estimated_value: 3000,
  value: 3000,
  employee_id: "emp-sales-1",
  employee_name: "Sales Rep",
  created_at: "2026-04-10T00:00:00Z",
  updated_at: "2026-04-18T00:00:00Z",
  order_id: null,
};

describe("updatePipelineDealRecord — auto-commission on won transition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.registerMock.mockResolvedValue({
      id: 777,
      contractCommission: 150,
      employeeCommission: 150,
      rateSnapshot: {},
    });
    hoisted.logAuditMock.mockResolvedValue(undefined);
  });

  it("won transition: sales_doc inserted with idempotency_key=pipeline_<id>, commission registered", async () => {
    const db = buildDb({
      pipeline_stages: [{ data: wonStage, error: null }],
      pipeline_deals: [
        { data: dealBefore, error: null }, // before-read
        { data: wonDealRow, error: null }, // update+select
      ],
      users: [{ data: { id: "app-u1", name: "Sales Rep" }, error: null }],
      sales_docs: [
        { data: null, error: null }, // idempotency lookup: no existing doc
        { data: { id: 888 }, error: null }, // insert+select
      ],
      sales_doc_events: [{ data: null, error: null }],
      audit: [{ data: null, error: null }],
    });

    await updatePipelineDealRecord(db, actor, {
      id: "deal-42",
      stage_id: 5,
    });

    expect(hoisted.registerMock).toHaveBeenCalledTimes(1);
    const call = hoisted.registerMock.mock.calls[0][1];
    expect(call).toMatchObject({
      saleType: "device",
      amount: 3000,
      employeeId: "emp-sales-1",
      source: "pipeline",
      sourcePipelineDealId: "deal-42",
      sourceSalesDocId: 888,
    });
  });

  it("idempotency: existing sales_doc for pipeline_<id> → skip registerSaleCommission", async () => {
    const db = buildDb({
      pipeline_stages: [{ data: wonStage, error: null }],
      pipeline_deals: [
        { data: dealBefore, error: null },
        { data: wonDealRow, error: null },
      ],
      users: [{ data: { id: "app-u1", name: "Sales Rep" }, error: null }],
      sales_docs: [
        // existing doc found via idempotency_key lookup
        { data: { id: 555 }, error: null },
      ],
      sales_doc_events: [{ data: null, error: null }],
      audit: [{ data: null, error: null }],
    });

    await updatePipelineDealRecord(db, actor, {
      id: "deal-42",
      stage_id: 5,
    });

    // Early-return happens before registerSaleCommission
    expect(hoisted.registerMock).not.toHaveBeenCalled();
  });

  it("deal with amount=0: skipped with console.warn", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const db = buildDb({
      pipeline_stages: [{ data: wonStage, error: null }],
      pipeline_deals: [
        { data: dealBefore, error: null },
        {
          data: { ...wonDealRow, estimated_value: 0, value: 0 },
          error: null,
        },
      ],
      users: [{ data: { id: "app-u1", name: "Sales Rep" }, error: null }],
      sales_docs: [{ data: null, error: null }],
      sales_doc_events: [{ data: null, error: null }],
    });

    await updatePipelineDealRecord(db, actor, {
      id: "deal-42",
      stage_id: 5,
    });

    expect(hoisted.registerMock).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/non-positive value/),
    );
    warn.mockRestore();
  });

  it("deal with no employee_id: skipped with console.warn (when actor has no appUserId either)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const db = buildDb({
      pipeline_stages: [{ data: wonStage, error: null }],
      pipeline_deals: [
        { data: dealBefore, error: null },
        { data: { ...wonDealRow, employee_id: null }, error: null },
      ],
      users: [{ data: null, error: null }], // no linked users row
      sales_docs: [{ data: null, error: null }],
      sales_doc_events: [{ data: null, error: null }],
    });

    await updatePipelineDealRecord(
      db,
      { ...actor, appUserId: undefined as any },
      { id: "deal-42", stage_id: 5 },
    );

    expect(hoisted.registerMock).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/no employee_id/),
    );
    warn.mockRestore();
  });

  it("non-won → non-won transition: no commission registered", async () => {
    const db = buildDb({
      pipeline_stages: [{ data: nonWonStage, error: null }],
      pipeline_deals: [
        { data: dealBefore, error: null },
        { data: { ...wonDealRow, stage_id: 2 }, error: null },
      ],
      users: [{ data: { id: "app-u1", name: "Sales Rep" }, error: null }],
      sales_docs: [],
      sales_doc_events: [],
      audit: [{ data: null, error: null }],
    });

    await updatePipelineDealRecord(db, actor, {
      id: "deal-42",
      stage_id: 2,
    });

    expect(hoisted.registerMock).not.toHaveBeenCalled();
  });

  it("re-entering same won stage: previousStageId === stage.id so no duplicate", async () => {
    const db = buildDb({
      pipeline_stages: [{ data: wonStage, error: null }],
      pipeline_deals: [
        { data: { stage_id: 5 }, error: null }, // already in won
        { data: wonDealRow, error: null },
      ],
      users: [{ data: { id: "app-u1", name: "Sales Rep" }, error: null }],
      sales_docs: [{ data: null, error: null }],
      sales_doc_events: [{ data: null, error: null }],
      audit: [{ data: null, error: null }],
    });

    await updatePipelineDealRecord(db, actor, {
      id: "deal-42",
      stage_id: 5,
    });

    expect(hoisted.registerMock).not.toHaveBeenCalled();
  });

  it("auto-commission failure does NOT throw out of updatePipelineDealRecord", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    hoisted.registerMock.mockRejectedValueOnce(new Error("DB blew up"));

    const db = buildDb({
      pipeline_stages: [{ data: wonStage, error: null }],
      pipeline_deals: [
        { data: dealBefore, error: null },
        { data: wonDealRow, error: null },
      ],
      users: [{ data: { id: "app-u1", name: "Sales Rep" }, error: null }],
      sales_docs: [
        { data: null, error: null }, // idempotency lookup
        { data: { id: 999 }, error: null }, // insert+select
      ],
      sales_doc_events: [{ data: null, error: null }],
      audit: [{ data: null, error: null }],
    });

    // Should NOT throw — stage update succeeded, commission failure is logged
    await expect(
      updatePipelineDealRecord(db, actor, { id: "deal-42", stage_id: 5 }),
    ).resolves.toBeDefined();
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it("product_name hint 'חבילה' flips saleType to 'line'", async () => {
    const db = buildDb({
      pipeline_stages: [{ data: wonStage, error: null }],
      pipeline_deals: [
        { data: dealBefore, error: null },
        { data: { ...wonDealRow, product_name: "חבילה 59" }, error: null },
      ],
      users: [{ data: { id: "app-u1", name: "Sales Rep" }, error: null }],
      sales_docs: [
        { data: null, error: null },
        { data: { id: 888 }, error: null },
      ],
      sales_doc_events: [{ data: null, error: null }],
      audit: [{ data: null, error: null }],
    });

    await updatePipelineDealRecord(db, actor, {
      id: "deal-42",
      stage_id: 5,
    });

    const call = hoisted.registerMock.mock.calls[0][1];
    expect(call.saleType).toBe("line");
    expect(call.packagePrice).toBe(3000);
  });
});
