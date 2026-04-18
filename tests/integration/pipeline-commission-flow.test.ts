/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Integration tests for the pipeline → sales_doc → commission flow (user
 * spec 3B).
 *
 * Two public entry points exercise autoRegisterWonDealCommission:
 *   - updatePipelineDealRecord (first transition into a won stage)
 *   - convertPipelineDealToOrder (order + land in won in one call)
 *
 * These tests go wider than tests/unit/pipeline-auto-commission.test.ts:
 *   - idempotency across existing sales_doc
 *   - sale type heuristic (product name → line/device)
 *   - activity-log side effect via registerSaleCommission mock
 *   - failure: commission throws but doc kept → failure event logged
 *   - convertPipelineDealToOrder happy path + guard against double-convert
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks (declared before SUT import) ──────────────────────────
const hoisted = vi.hoisted(() => ({
  registerMock: vi.fn(),
  logAuditMock: vi.fn(),
  createManualOrderMock: vi.fn(),
}));

vi.mock("@/lib/commissions/register", () => ({
  registerSaleCommission: hoisted.registerMock,
}));

vi.mock("@/lib/admin/auth", () => ({
  logAudit: hoisted.logAuditMock,
}));

vi.mock("@/lib/orders/admin", () => ({
  createManualOrder: hoisted.createManualOrderMock,
}));

import {
  updatePipelineDealRecord,
  convertPipelineDealToOrder,
} from "@/lib/crm/pipeline";

// ── Chainable stub ───────────────────────────────────────────────────────
type QueryResult = { data: any; error: any };
function chain(result: QueryResult) {
  const b: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
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
 * terminal methods (single / maybeSingle) return scripted values by call
 * index. Also captures inserts/updates into `calls` for assertions.
 *
 * NOTE: chain() uses .mockReturnThis() — the wrapped insert/update replace
 * the mock on the shared builder itself (so it still returns `this`) and
 * we stash a side channel to capture payloads.
 */
function buildDb(scripts: Record<string, QueryResult[]>) {
  const counters: Record<string, number> = {};
  const calls: Record<string, { inserts: any[]; updates: any[] }> = {};

  const from = vi.fn().mockImplementation((table: string) => {
    const idx = counters[table] ?? 0;
    const script = scripts[table];
    const result = script
      ? script[Math.min(idx, script.length - 1)]
      : { data: null, error: null };
    counters[table] = idx + 1;

    if (!calls[table]) calls[table] = { inserts: [], updates: [] };
    const built = chain(result);

    // Capture payloads while preserving .mockReturnThis() semantics
    built.insert = vi.fn().mockImplementation((payload: any) => {
      calls[table].inserts.push(payload);
      return built;
    });
    built.update = vi.fn().mockImplementation((payload: any) => {
      calls[table].updates.push(payload);
      return built;
    });
    return built;
  });

  return { db: { from } as any, calls, counters };
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

const dealBefore = { stage_id: 1 };

const baseWonDeal = {
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

// ============================================================================
// autoRegisterWonDealCommission via updatePipelineDealRecord
// ============================================================================

describe("updatePipelineDealRecord → autoRegisterWonDealCommission", () => {
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

  it("deal ينتقل إلى stage is_won=true → sales_doc + commission يسجلان", async () => {
    const { db, calls } = buildDb({
      pipeline_stages: [{ data: wonStage, error: null }],
      pipeline_deals: [
        { data: dealBefore, error: null },
        { data: baseWonDeal, error: null },
      ],
      users: [{ data: { id: "app-u1", name: "Sales Rep" }, error: null }],
      sales_docs: [
        { data: null, error: null }, // idempotency lookup → no existing
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
    expect(calls.sales_docs.inserts.length).toBe(1);
  });

  it("sales_doc له status='synced_to_commissions', source='pipeline', idempotency_key='pipeline_<dealId>'", async () => {
    const { db, calls } = buildDb({
      pipeline_stages: [{ data: wonStage, error: null }],
      pipeline_deals: [
        { data: dealBefore, error: null },
        { data: baseWonDeal, error: null },
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

    const docInsert = calls.sales_docs.inserts[0];
    expect(docInsert).toMatchObject({
      status: "synced_to_commissions",
      source: "pipeline",
      idempotency_key: "pipeline_deal-42",
    });
  });

  it("commission row: source='pipeline', source_pipeline_deal_id=<dealId>, employee_id from deal", async () => {
    const { db } = buildDb({
      pipeline_stages: [{ data: wonStage, error: null }],
      pipeline_deals: [
        { data: dealBefore, error: null },
        { data: baseWonDeal, error: null },
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
    expect(call).toMatchObject({
      source: "pipeline",
      sourcePipelineDealId: "deal-42",
      employeeId: "emp-sales-1",
    });
  });

  it("idempotency: sales_doc موجود للـdealId → لا تسجيل مكرر", async () => {
    const { db, calls } = buildDb({
      pipeline_stages: [{ data: wonStage, error: null }],
      pipeline_deals: [
        { data: dealBefore, error: null },
        { data: baseWonDeal, error: null },
      ],
      users: [{ data: { id: "app-u1", name: "Sales Rep" }, error: null }],
      sales_docs: [
        { data: { id: 555 }, error: null }, // idempotency lookup returns existing doc
      ],
      sales_doc_events: [{ data: null, error: null }],
      audit: [{ data: null, error: null }],
    });

    await updatePipelineDealRecord(db, actor, {
      id: "deal-42",
      stage_id: 5,
    });

    expect(hoisted.registerMock).not.toHaveBeenCalled();
    // No fresh insert — the only sales_docs operation was the lookup.
    expect(calls.sales_docs.inserts.length).toBe(0);
  });

  it("deal قيمته 0 → يُتخطى مع console.warn (بدون doc ولا commission)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { db, calls } = buildDb({
      pipeline_stages: [{ data: wonStage, error: null }],
      pipeline_deals: [
        { data: dealBefore, error: null },
        { data: { ...baseWonDeal, estimated_value: 0, value: 0 }, error: null },
      ],
      users: [{ data: { id: "app-u1", name: "Sales Rep" }, error: null }],
      sales_docs: [{ data: null, error: null }],
      audit: [{ data: null, error: null }],
    });

    await updatePipelineDealRecord(db, actor, {
      id: "deal-42",
      stage_id: 5,
    });

    expect(hoisted.registerMock).not.toHaveBeenCalled();
    // sales_docs might not be queried at all when the early-return happens
    // before the idempotency lookup; either 0 inserts or table untouched is fine.
    expect(calls.sales_docs?.inserts?.length ?? 0).toBe(0);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/non-positive value/));
    warn.mockRestore();
  });

  it("deal بلا employee_id (ولا actor.appUserId) → يُتخطى مع console.warn", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { db, calls } = buildDb({
      pipeline_stages: [{ data: wonStage, error: null }],
      pipeline_deals: [
        { data: dealBefore, error: null },
        { data: { ...baseWonDeal, employee_id: null }, error: null },
      ],
      users: [{ data: null, error: null }],
      sales_docs: [{ data: null, error: null }],
      audit: [{ data: null, error: null }],
    });

    await updatePipelineDealRecord(
      db,
      { ...actor, appUserId: undefined as any },
      { id: "deal-42", stage_id: 5 },
    );

    expect(hoisted.registerMock).not.toHaveBeenCalled();
    expect(calls.sales_docs?.inserts?.length ?? 0).toBe(0);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/no employee_id/));
    warn.mockRestore();
  });

  it("transition بين مرحلتين non-won → بلا commission", async () => {
    const { db } = buildDb({
      pipeline_stages: [{ data: nonWonStage, error: null }],
      pipeline_deals: [
        { data: dealBefore, error: null },
        { data: { ...baseWonDeal, stage_id: 2 }, error: null },
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

  it("sale type heuristic: 'חבילה 59' → line (packagePrice set)", async () => {
    const { db } = buildDb({
      pipeline_stages: [{ data: wonStage, error: null }],
      pipeline_deals: [
        { data: dealBefore, error: null },
        { data: { ...baseWonDeal, product_name: "חבילה 59" }, error: null },
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

  it("sale type heuristic: 'iPhone 15' → device (deviceName set)", async () => {
    const { db } = buildDb({
      pipeline_stages: [{ data: wonStage, error: null }],
      pipeline_deals: [
        { data: dealBefore, error: null },
        { data: baseWonDeal, error: null },
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
    expect(call.saleType).toBe("device");
    expect(call.deviceName).toBe("iPhone 15");
  });

  it("sale type heuristic: 'package' (English) → line", async () => {
    const { db } = buildDb({
      pipeline_stages: [{ data: wonStage, error: null }],
      pipeline_deals: [
        { data: dealBefore, error: null },
        { data: { ...baseWonDeal, product_name: "Basic package 39" }, error: null },
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

    expect(hoisted.registerMock.mock.calls[0][1].saleType).toBe("line");
  });

  it("activity_log side effect: registerSaleCommission يُستدعى (activity log داخله هو الذي يكتب)", async () => {
    const { db } = buildDb({
      pipeline_stages: [{ data: wonStage, error: null }],
      pipeline_deals: [
        { data: dealBefore, error: null },
        { data: baseWonDeal, error: null },
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

    // registerSaleCommission (mocked) is what writes activity_log in production;
    // verify it was invoked with a shape compatible with the activity logger.
    expect(hoisted.registerMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        employeeId: "emp-sales-1",
        saleType: "device",
        amount: 3000,
        source: "pipeline",
      }),
    );
  });

  it("commission registration يفشل لكن doc تم إنشاؤه → failure event logged, doc محفوظ (idempotency)", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    hoisted.registerMock.mockRejectedValueOnce(new Error("register blew up"));

    const { db, calls } = buildDb({
      pipeline_stages: [{ data: wonStage, error: null }],
      pipeline_deals: [
        { data: dealBefore, error: null },
        { data: baseWonDeal, error: null },
      ],
      users: [{ data: { id: "app-u1", name: "Sales Rep" }, error: null }],
      sales_docs: [
        { data: null, error: null }, // idempotency lookup
        { data: { id: 999 }, error: null }, // insert+select OK
      ],
      sales_doc_events: [{ data: null, error: null }],
      audit: [{ data: null, error: null }],
    });

    // updatePipelineDealRecord's outer try/catch catches the register throw
    await expect(
      updatePipelineDealRecord(db, actor, { id: "deal-42", stage_id: 5 }),
    ).resolves.toBeDefined();

    // Doc was created (kept for idempotency)
    expect(calls.sales_docs.inserts.length).toBe(1);
    // Failure event logged
    const failureEvent = calls.sales_doc_events.inserts.find(
      (e: any) => e.event_type === "auto_register_commission_failed",
    );
    expect(failureEvent).toBeDefined();
    expect(failureEvent.payload).toMatchObject({
      deal_id: "deal-42",
      error: "register blew up",
    });
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("auto_created_from_pipeline event يُكتب في sales_doc_events عند النجاح", async () => {
    const { db, calls } = buildDb({
      pipeline_stages: [{ data: wonStage, error: null }],
      pipeline_deals: [
        { data: dealBefore, error: null },
        { data: baseWonDeal, error: null },
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

    const successEvent = calls.sales_doc_events.inserts.find(
      (e: any) => e.event_type === "auto_created_from_pipeline",
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload).toMatchObject({
      deal_id: "deal-42",
      commission_id: 777,
      commission_amount: 150,
    });
  });
});

// ============================================================================
// convertPipelineDealToOrder — conversion + auto-commission
// ============================================================================

describe("convertPipelineDealToOrder → auto-commission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.registerMock.mockResolvedValue({
      id: 777,
      contractCommission: 150,
      employeeCommission: 150,
      rateSnapshot: {},
    });
    hoisted.logAuditMock.mockResolvedValue(undefined);
    hoisted.createManualOrderMock.mockResolvedValue({
      id: "CLM-100",
      total: 3000,
      status: "new",
    });
  });

  it("conversion ينشئ order + يهبط deal في won → autoRegister يُستدعى → commission يظهر", async () => {
    // Stage at convert-time is 'closing' (eligible). The code then fetches
    // 'won' via getStageByName to land the deal.
    const closingStage = {
      id: 4,
      name: "closing",
      name_ar: "إغلاق",
      name_he: "סגירה",
      sort_order: 80,
      is_won: false,
      is_lost: false,
      color: "#3b82f6",
    };
    const dealPre = {
      ...baseWonDeal,
      stage_id: 4,
      order_id: null,
    };
    const dealAfterUpdate = {
      ...baseWonDeal,
      stage_id: 5,
      order_id: "CLM-100",
      converted_at: new Date().toISOString(),
    };

    const { db } = buildDb({
      pipeline_stages: [
        { data: closingStage, error: null }, // getStageById(deal.stage_id) = closing
        { data: wonStage, error: null }, // getStageByName("won")
      ],
      pipeline_deals: [
        { data: dealPre, error: null }, // deal lookup at start of convert
        { data: dealAfterUpdate, error: null }, // update+select after createManualOrder
      ],
      users: [{ data: { id: "app-u1", name: "Sales Rep" }, error: null }],
      sales_docs: [
        { data: null, error: null }, // idempotency lookup
        { data: { id: 888 }, error: null }, // insert+select
      ],
      sales_doc_events: [{ data: null, error: null }],
      audit: [{ data: null, error: null }],
    });

    const res = await convertPipelineDealToOrder(db, actor, "deal-42");
    expect(res.order.id).toBe("CLM-100");
    expect(hoisted.registerMock).toHaveBeenCalledTimes(1);
    const call = hoisted.registerMock.mock.calls[0][1];
    expect(call).toMatchObject({
      source: "pipeline",
      sourcePipelineDealId: "deal-42",
    });
  });

  it("convert على deal موجود له order_id → يرمي خطأ قبل إنشاء commission ثانية", async () => {
    const wonStageEligible = { ...wonStage };
    const dealAlreadyConverted = {
      ...baseWonDeal,
      stage_id: 5,
      order_id: "CLM-ALREADY",
    };

    const { db } = buildDb({
      pipeline_stages: [{ data: wonStageEligible, error: null }],
      pipeline_deals: [
        { data: dealAlreadyConverted, error: null },
      ],
    });

    await expect(
      convertPipelineDealToOrder(db, actor, "deal-42"),
    ).rejects.toThrow(/already converted/);

    // Neither a new order nor a new commission was created
    expect(hoisted.createManualOrderMock).not.toHaveBeenCalled();
    expect(hoisted.registerMock).not.toHaveBeenCalled();
  });

  it("convert على deal في stage غير مؤهل (lead) → يرمي خطأ", async () => {
    const leadStage = {
      id: 1,
      name: "lead",
      name_ar: "عميل محتمل",
      name_he: "ליד",
      sort_order: 10,
      is_won: false,
      is_lost: false,
      color: "#3B82F6",
    };
    const dealLead = { ...baseWonDeal, stage_id: 1, order_id: null };

    const { db } = buildDb({
      pipeline_stages: [{ data: leadStage, error: null }],
      pipeline_deals: [{ data: dealLead, error: null }],
    });

    await expect(
      convertPipelineDealToOrder(db, actor, "deal-42"),
    ).rejects.toThrow(/closing or won/);

    expect(hoisted.registerMock).not.toHaveBeenCalled();
  });

  it("idempotency داخل convert: deal له pipeline_<id> sales_doc موجود → لا تسجيل مكرر", async () => {
    // If by the time convert runs a sales_doc already exists for pipeline_<id>
    // (e.g. a prior transition created one), autoRegisterWonDealCommission
    // early-returns and registerSaleCommission is NOT called.
    const dealPre = { ...baseWonDeal, stage_id: 5, order_id: null };
    const dealAfter = {
      ...baseWonDeal,
      stage_id: 5,
      order_id: "CLM-100",
      converted_at: new Date().toISOString(),
    };

    const { db } = buildDb({
      pipeline_stages: [
        { data: wonStage, error: null }, // getStageById
        // Since stage.is_won is already true, getStageByName is NOT called.
      ],
      pipeline_deals: [
        { data: dealPre, error: null },
        { data: dealAfter, error: null },
      ],
      users: [{ data: { id: "app-u1", name: "Sales Rep" }, error: null }],
      sales_docs: [
        { data: { id: 555 }, error: null }, // existing doc found via idempotency_key
      ],
      sales_doc_events: [{ data: null, error: null }],
      audit: [{ data: null, error: null }],
    });

    await convertPipelineDealToOrder(db, actor, "deal-42");
    expect(hoisted.registerMock).not.toHaveBeenCalled();
  });
});
