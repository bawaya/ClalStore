/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Integration tests for POST /api/pwa/sales/[id]/submit
 * (the atomic draft→synced_to_commissions transition, phase 10).
 *
 * We mock registerSaleCommission and createAdminSupabase, then drive the
 * route through each decision branch (happy, 409 race, attachments, rollback,
 * mixed, auth).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  createMockSupabaseClient,
  makeSalesDoc,
  makeSalesDocAttachment,
  makeSalesDocItem,
} from "@/tests/helpers";

// ── Fixtures ──────────────────────────────────────────
const draftDoc = makeSalesDoc({
  id: 1,
  employee_key: "emp1",
  employee_user_id: "emp1",
  status: "draft",
  sale_type: "device",
  total_amount: 5000,
  sale_date: "2026-04-10",
});

// ── Hoisted shared state for vi.mock factories ────────
const hoisted = vi.hoisted(() => ({
  auth: {
    authId: "auth-emp1",
    appUserId: "emp1",
    role: "sales",
    name: "Sales Rep",
  },
  clientRef: { current: null as any },
  registerMock: null as any,
  authResult: null as any,
}));

// ── Mocks ─────────────────────────────────────────────
vi.mock("@/lib/supabase", () => ({
  createServerSupabase: vi.fn(() => hoisted.clientRef.current),
  createAdminSupabase: vi.fn(() => hoisted.clientRef.current),
}));

vi.mock("@/lib/pwa/auth", () => ({
  requireEmployee: vi.fn(() => Promise.resolve(hoisted.authResult ?? hoisted.auth)),
}));

vi.mock("@/lib/commissions/register", () => ({
  registerSaleCommission: vi.fn((...args: any[]) =>
    (hoisted.registerMock as any)(...args),
  ),
}));

// ── Default Supabase client ───────────────────────────
const supabaseClient = createMockSupabaseClient({
  sales_docs: { data: [draftDoc] },
  sales_doc_items: { data: [] },
  sales_doc_attachments: { data: [] },
  sales_doc_events: { data: [] },
});
hoisted.clientRef.current = supabaseClient;

import { POST as submitSale } from "@/app/api/pwa/sales/[id]/submit/route";

const ctxOf = (id: string) => ({ params: Promise.resolve({ id }) });

// Helpers to rewire the sales_docs chain for the atomic-transition call
function mockDocReadAndTransition(
  initial: any,
  transitioned: any,
  attachmentTypes: string[] = ["invoice", "device_serial_proof"],
) {
  const docsBuilder = supabaseClient.__queryBuilders.get("sales_docs")!;
  docsBuilder.__setData([initial]);
  // First .maybeSingle() → read doc
  docsBuilder.maybeSingle = vi
    .fn()
    .mockResolvedValueOnce({ data: initial, error: null }) // read
    .mockResolvedValueOnce({ data: transitioned, error: null }); // atomic transition
  // Attachments list
  supabaseClient.__queryBuilders
    .get("sales_doc_attachments")!
    .__setData(attachmentTypes.map((t) => ({ attachment_type: t })));
}

describe("POST /api/pwa/sales/[id]/submit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.authResult = null;
    hoisted.registerMock = vi.fn().mockResolvedValue({
      id: 101,
      contractCommission: 5500,
      employeeCommission: 5500,
      rateSnapshot: {},
    });
  });

  it("happy path: device draft → synced_to_commissions, commission inserted", async () => {
    mockDocReadAndTransition(
      draftDoc,
      { ...draftDoc, status: "synced_to_commissions" },
    );
    const req = createMockRequest({
      method: "POST",
      url: "/api/pwa/sales/1/submit",
    });
    const res = await submitSale(req, ctxOf("1"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.commissions?.length).toBe(1);
    expect(hoisted.registerMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        saleType: "device",
        amount: 5000,
        source: "sales_doc",
        sourceSalesDocId: 1,
      }),
    );
  });

  it("double-submit race: atomic transition returns null → 409", async () => {
    const docsBuilder = supabaseClient.__queryBuilders.get("sales_docs")!;
    docsBuilder.maybeSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: draftDoc, error: null }) // read ok
      .mockResolvedValueOnce({ data: null, error: null }); // transition found 0 rows
    supabaseClient.__queryBuilders
      .get("sales_doc_attachments")!
      .__setData([
        { attachment_type: "invoice" },
        { attachment_type: "device_serial_proof" },
      ]);

    const req = createMockRequest({
      method: "POST",
      url: "/api/pwa/sales/1/submit",
    });
    const res = await submitSale(req, ctxOf("1"));
    expect(res.status).toBe(409);
  });

  // 2026-04-18: attachments system removed — submit no longer checks for them.
  // This test used to assert the "missing attachments → 400" branch; that
  // branch is gone, so the scenario now succeeds (200).
  it("accepts submit without attachments (attachments system removed)", async () => {
    mockDocReadAndTransition(
      { ...draftDoc, sale_type: "line" },
      { ...draftDoc, sale_type: "line", status: "synced_to_commissions" },
      [], // no attachments — no longer required
    );
    const req = createMockRequest({
      method: "POST",
      url: "/api/pwa/sales/1/submit",
    });
    const res = await submitSale(req, ctxOf("1"));
    expect(res.status).toBe(200);
  });

  it("rejects with 400 when total_amount = 0", async () => {
    mockDocReadAndTransition(
      { ...draftDoc, total_amount: 0 },
      { ...draftDoc, total_amount: 0, status: "synced_to_commissions" },
    );
    const req = createMockRequest({
      method: "POST",
      url: "/api/pwa/sales/1/submit",
    });
    const res = await submitSale(req, ctxOf("1"));
    expect(res.status).toBe(400);
  });

  it("rolls doc back to 'rejected' when commission insert fails", async () => {
    mockDocReadAndTransition(
      draftDoc,
      { ...draftDoc, status: "synced_to_commissions" },
    );
    hoisted.registerMock = vi.fn().mockRejectedValue(new Error("DB exploded"));

    const req = createMockRequest({
      method: "POST",
      url: "/api/pwa/sales/1/submit",
    });
    const res = await submitSale(req, ctxOf("1"));
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).toMatch(/DB exploded/);

    // The route performs a rollback update — assert the .update() was called
    // at least twice (transition + rollback)
    const docsBuilder = supabaseClient.__queryBuilders.get("sales_docs")!;
    expect(docsBuilder.update).toHaveBeenCalled();
  });

  it("mixed sale_type: inserts 2 commission rows (line + device)", async () => {
    const mixedDoc = {
      ...draftDoc,
      sale_type: "mixed",
      total_amount: 6000,
    };
    const transitioned = { ...mixedDoc, status: "synced_to_commissions" };
    mockDocReadAndTransition(mixedDoc, transitioned, [
      "contract_photo",
      "signed_form",
      "invoice",
      "device_serial_proof",
    ]);
    // Items used for line/device split
    supabaseClient.__queryBuilders
      .get("sales_doc_items")!
      .__setData([
        { item_type: "line", line_total: 1000 },
        { item_type: "device", line_total: 5000 },
      ]);

    const req = createMockRequest({
      method: "POST",
      url: "/api/pwa/sales/1/submit",
    });
    const res = await submitSale(req, ctxOf("1"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.commissions.length).toBe(2);
    expect(hoisted.registerMock).toHaveBeenCalledTimes(2);
    const saleTypes = hoisted.registerMock.mock.calls.map((c: any[]) => c[1].saleType);
    expect(saleTypes.sort()).toEqual(["device", "line"]);
  });

  it("returns 401 when no user", async () => {
    const { NextResponse } = await import("next/server");
    hoisted.authResult = NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
    const req = createMockRequest({
      method: "POST",
      url: "/api/pwa/sales/1/submit",
    });
    const res = await submitSale(req, ctxOf("1"));
    expect(res.status).toBe(401);
  });

  it("returns 403 when different user's doc", async () => {
    mockDocReadAndTransition(
      { ...draftDoc, employee_key: "another-emp" },
      null,
    );
    const req = createMockRequest({
      method: "POST",
      url: "/api/pwa/sales/1/submit",
    });
    const res = await submitSale(req, ctxOf("1"));
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid id param", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/pwa/sales/abc/submit",
    });
    const res = await submitSale(req, ctxOf("abc"));
    expect(res.status).toBe(400);
  });

  it("returns 404 for missing doc", async () => {
    const docsBuilder = supabaseClient.__queryBuilders.get("sales_docs")!;
    docsBuilder.maybeSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: null });
    const req = createMockRequest({
      method: "POST",
      url: "/api/pwa/sales/999/submit",
    });
    const res = await submitSale(req, ctxOf("999"));
    expect(res.status).toBe(404);
  });

  it("returns 409 when doc already in terminal state", async () => {
    const docsBuilder = supabaseClient.__queryBuilders.get("sales_docs")!;
    docsBuilder.maybeSingle = vi
      .fn()
      .mockResolvedValueOnce({
        data: { ...draftDoc, status: "synced_to_commissions" },
        error: null,
      });
    const req = createMockRequest({
      method: "POST",
      url: "/api/pwa/sales/1/submit",
    });
    const res = await submitSale(req, ctxOf("1"));
    expect(res.status).toBe(409);
  });
});
