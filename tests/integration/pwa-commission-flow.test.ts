/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Integration tests for the PWA commission flow — spec 3C.
 *
 * Covers:
 *   - POST /api/pwa/sales  (create draft sales doc)
 *
 * The attachment endpoints were removed on 2026-04-18; sales docs now
 * register with data only, no file upload.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  createMockSupabaseClient,
  makeSalesDoc,
} from "@/tests/helpers";

// ── Hoisted shared state ──────────────────────────────
const hoisted = vi.hoisted(() => ({
  auth: {
    authId: "auth-emp1",
    appUserId: "emp1",
    role: "sales",
    name: "Sales Rep",
  },
  clientRef: { current: null as any },
  authResult: null as any,
}));

// ── Mocks ─────────────────────────────────────────────
vi.mock("@/lib/supabase", () => ({
  createServerSupabase: vi.fn(() => hoisted.clientRef.current),
  createAdminSupabase: vi.fn(() => hoisted.clientRef.current),
}));

vi.mock("@/lib/pwa/auth", () => ({
  requireEmployee: vi.fn(() =>
    Promise.resolve(hoisted.authResult ?? hoisted.auth),
  ),
}));

// ── Route imports (after mocks) ───────────────────────
import { POST as createSale } from "@/app/api/pwa/sales/route";

function makeClient(tables: Record<string, { data?: any; error?: any }> = {}) {
  return createMockSupabaseClient(tables);
}

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.authResult = null;
});

// ════════════════════════════════════════════════════════
// POST /api/pwa/sales — create draft
// ════════════════════════════════════════════════════════
describe("POST /api/pwa/sales", () => {
  it("creates draft sales_doc with employee_key set to the authed user", async () => {
    const client = makeClient({
      sales_docs: { data: [] },
      customers: { data: [] },
      sales_doc_items: { data: [] },
      sales_doc_events: { data: [] },
    });
    // insert returns the created row
    client.__queryBuilders.get("sales_docs")!.single = vi.fn().mockResolvedValue({
      data: makeSalesDoc({
        id: 1,
        status: "draft",
        employee_key: "emp1",
        employee_user_id: "emp1",
        sale_type: "device",
        total_amount: 5000,
      }),
      error: null,
    });
    hoisted.clientRef.current = client;

    const req = createMockRequest({
      method: "POST",
      url: "/api/pwa/sales",
      body: {
        sale_type: "device",
        total_amount: 5000,
        sale_date: "2026-04-10",
      },
    });
    const res = await createSale(req);
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data?.employee_key).toBe("emp1");
    expect(body.data?.status).toBe("draft");
  });

  it("links customer by phone when customer_phone is provided", async () => {
    const client = makeClient({
      sales_docs: { data: [] },
      customers: { data: [{ id: "cust-42" }] },
      sales_doc_items: { data: [] },
      sales_doc_events: { data: [] },
    });
    // customer phone lookup
    client.__queryBuilders.get("customers")!.maybeSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: { id: "cust-42" }, error: null });
    // insert returns the created row with resolved customer
    client.__queryBuilders.get("sales_docs")!.single = vi.fn().mockResolvedValue({
      data: makeSalesDoc({
        id: 2,
        customer_id: "cust-42",
        status: "draft",
        employee_key: "emp1",
        sale_type: "line",
      }),
      error: null,
    });
    hoisted.clientRef.current = client;

    const req = createMockRequest({
      method: "POST",
      url: "/api/pwa/sales",
      body: {
        sale_type: "line",
        total_amount: 39.9,
        customer_phone: "0501234567",
        sale_date: "2026-04-10",
      },
    });
    const res = await createSale(req);
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.data?.customer_id).toBe("cust-42");
  });

  it("customer not found by phone → customer_id stays null", async () => {
    const client = makeClient({
      sales_docs: { data: [] },
      customers: { data: [] },
      orders: { data: [] },
      sales_doc_items: { data: [] },
      sales_doc_events: { data: [] },
    });
    client.__queryBuilders.get("customers")!.maybeSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: null });
    client.__queryBuilders.get("sales_docs")!.single = vi.fn().mockResolvedValue({
      data: makeSalesDoc({
        id: 3,
        customer_id: null,
        status: "draft",
        sale_type: "line",
      }),
      error: null,
    });
    hoisted.clientRef.current = client;

    const req = createMockRequest({
      method: "POST",
      url: "/api/pwa/sales",
      body: {
        sale_type: "line",
        total_amount: 39.9,
        customer_phone: "0509999999",
        sale_date: "2026-04-10",
      },
    });
    const res = await createSale(req);
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.data?.customer_id).toBeNull();
  });

  it("rejects total_amount = 0 (Zod .positive())", async () => {
    hoisted.clientRef.current = makeClient({
      sales_docs: { data: [] },
    });
    const req = createMockRequest({
      method: "POST",
      url: "/api/pwa/sales",
      body: {
        sale_type: "device",
        total_amount: 0,
        sale_date: "2026-04-10",
      },
    });
    const res = await createSale(req);
    expect(res.status).toBe(400);
  });

  it("rejects negative total_amount", async () => {
    hoisted.clientRef.current = makeClient({ sales_docs: { data: [] } });
    const req = createMockRequest({
      method: "POST",
      url: "/api/pwa/sales",
      body: {
        sale_type: "device",
        total_amount: -100,
        sale_date: "2026-04-10",
      },
    });
    const res = await createSale(req);
    expect(res.status).toBe(400);
  });

  it("rejects sale_date in the future (> +1 day)", async () => {
    hoisted.clientRef.current = makeClient({ sales_docs: { data: [] } });
    const futureISO = new Date(Date.now() + 10 * 86400000)
      .toISOString()
      .slice(0, 10);
    const req = createMockRequest({
      method: "POST",
      url: "/api/pwa/sales",
      body: {
        sale_type: "device",
        total_amount: 1000,
        sale_date: futureISO,
      },
    });
    const res = await createSale(req);
    expect(res.status).toBe(400);
  });

  it("rejects sale_date older than 90 days", async () => {
    hoisted.clientRef.current = makeClient({ sales_docs: { data: [] } });
    const oldISO = new Date(Date.now() - 120 * 86400000)
      .toISOString()
      .slice(0, 10);
    const req = createMockRequest({
      method: "POST",
      url: "/api/pwa/sales",
      body: {
        sale_type: "device",
        total_amount: 1000,
        sale_date: oldISO,
      },
    });
    const res = await createSale(req);
    expect(res.status).toBe(400);
  });

  it("rejects missing sale_type (required)", async () => {
    hoisted.clientRef.current = makeClient({ sales_docs: { data: [] } });
    const req = createMockRequest({
      method: "POST",
      url: "/api/pwa/sales",
      body: {
        total_amount: 100,
        sale_date: "2026-04-10",
      },
    });
    const res = await createSale(req);
    expect(res.status).toBe(400);
  });

  it("accepts idempotency_key in payload (passed through to insert)", async () => {
    const client = makeClient({
      sales_docs: { data: [] },
      customers: { data: [] },
      sales_doc_items: { data: [] },
      sales_doc_events: { data: [] },
    });
    client.__queryBuilders.get("sales_docs")!.single = vi.fn().mockResolvedValue({
      data: makeSalesDoc({
        id: 42,
        status: "draft",
        idempotency_key: "my-key-xyz",
      }),
      error: null,
    });
    hoisted.clientRef.current = client;

    const req = createMockRequest({
      method: "POST",
      url: "/api/pwa/sales",
      body: {
        sale_type: "line",
        total_amount: 39.9,
        sale_date: "2026-04-10",
        idempotency_key: "my-key-xyz",
      },
    });
    const res = await createSale(req);
    expect(res.status).toBe(201);
    // the insert builder received the idempotency_key as part of the payload
    const insertMock = client.__queryBuilders.get("sales_docs")!.insert;
    const passedPayload = insertMock.mock.calls[0]?.[0];
    expect(passedPayload?.idempotency_key).toBe("my-key-xyz");
  });

  it("returns 401 when unauthenticated", async () => {
    const { NextResponse } = await import("next/server");
    hoisted.authResult = NextResponse.json({ error: "unauth" }, { status: 401 });
    hoisted.clientRef.current = makeClient({});
    const req = createMockRequest({
      method: "POST",
      url: "/api/pwa/sales",
      body: { sale_type: "device", total_amount: 1000 },
    });
    const res = await createSale(req);
    expect(res.status).toBe(401);
  });
});
